import { PubMedBigQueryClient, PubMedArticle } from './pubmedBigQuery';
import {
  EvidenceObject,
  createEvidenceObjects,
  formatEvidenceForPrompt,
  parseStructuredLLMResponse,
  validateAndCorrectCitations,
  renderVerifiedCitationsAndReferences,
  stripRawIdentifiers,
} from './citationIntegrity';
import {
  parseClinicalQuery,
  buildEnhancedSearchQuery,
  buildPubMedSearchTerm,
  applyClinicalFilters,
  filterArticlesByPublicationDate,
  rerankClinicalEvidence,
  selectBalancedClinicalEvidence,
  evaluateMultiDimensionalEligibility,
} from './clinicalRetrieval';
import {
  verifyClaimAccuracy,
  checkEvidenceSufficiency,
} from './claimAccuracy';
import {
  canonicalizeVerifiedCandidates,
  fetchCanonicalPubMedEFetch,
  searchCanonicalPubMed,
} from './canonicalPubMedGate';
import {
  renderProfessionalUISections,
} from './professionalUI';

interface ChatMessage {
    id: string;
    text: string;
    timestamp: number;
    isAI?: boolean;
    pubmedResults?: PubMedArticle[];
    meta?: {
      provider: string;
      model_id: string;
      request_id: string;
      retrieved_count: number;
      used_count: number;
    };
  }
  
  interface AIResponse {
    object: string;
    search_query: string;
    response: string;
    data: any[];
    has_more: boolean;
    next_page: null;
  }
  
  interface Env {
    AI: {
      autorag: (name: string) => {
        aiSearch: (params: { query: string }) => Promise<string | AIResponse>;
      };
      run: (model: string, params: { messages: Array<{ role: string; content: string }>; max_tokens?: number }) => Promise<any>;
    };
    PUBMED_BIGQUERY_CREDENTIALS?: string;
    PUBMED_BIGQUERY_PROJECT_ID?: string;
    PUBMED_QUERY_MODE?: boolean;
    NCBI_API_KEY?: string;
    NCBI_TOOL_EMAIL?: string;
  }
  
  export class ChatState {
    private state: DurableObjectState;
    private messages: ChatMessage[];
    private env: Env;
    private pubmedClient: PubMedBigQueryClient | null = null;
  
    constructor(state: DurableObjectState, env: Env) {
      this.state = state;
      this.env = env;
      this.messages = [];
      this.state.blockConcurrencyWhile(async () => {
        const stored = await this.state.storage.get<ChatMessage[]>('messages');
        if (stored) {
          this.messages = stored;
        }
        
        // Initialize PubMed BigQuery client if credentials are provided
        if (env.PUBMED_BIGQUERY_CREDENTIALS && env.PUBMED_BIGQUERY_PROJECT_ID) {
          try {
            const credentials = JSON.parse(env.PUBMED_BIGQUERY_CREDENTIALS);
            this.pubmedClient = new PubMedBigQueryClient(
              env.PUBMED_BIGQUERY_PROJECT_ID,
              credentials
            );
          } catch (error) {
            console.error('Failed to initialize PubMed BigQuery client:', error);
          }
        }
      });
    }
  
    async fetch(request: Request) {
      const url = new URL(request.url);
      
      if (request.method === 'GET') {
        return new Response(JSON.stringify({ messages: this.messages }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
  
      if (request.method === 'POST') {
        const body = await request.json() as { text: string; usePubMed?: boolean };
        console.log('Received message:', body.text);
        
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          text: body.text,
          timestamp: Date.now(),
          isAI: false
        };
        this.messages.push(userMessage);
  
        try {
          let responseText: string;
          let pubmedResults: PubMedArticle[] | undefined;

          const aiModelId = "@cf/openai/gpt-oss-120b";
          const aiProvider = "Cloudflare Workers AI";
          const requestId = userMessage.id;
          let candidateCount = 0;
          let answerUsedEvidenceCount = 0;

          // Check if PubMed query mode is enabled
          const usePubMed = body.usePubMed || this.env.PUBMED_QUERY_MODE;
          
          if (usePubMed) {
            console.log('Running Phase 2 Clinical Retrieval Pipeline...');
            try {
              // 1. Clinical Query Parsing & PICO Extraction
              const parsedQuery = parseClinicalQuery(body.text);

              // 2. Run BigQuery and live PubMed retrieval in parallel. Live PubMed
              // closes the baseline freshness gap and improves recall for major journals.
              const retrievalLimit = parsedQuery.filterCriteria.dateFilter ? 50 : 30;
              const candidateSql = buildEnhancedSearchQuery(parsedQuery, retrievalLimit);
              const pubmedSearchTerm = buildPubMedSearchTerm(parsedQuery);
              const ncbiOptions = {
                apiKey: this.env.NCBI_API_KEY,
                email: this.env.NCBI_TOOL_EMAIL,
                tool: 'pubmed-bigquery-qa-bot',
                timeoutMs: 8000,
              };
              const [bigQueryResult, livePubMedResult] = await Promise.allSettled([
                this.pubmedClient
                  ? this.pubmedClient.searchArticlesCustomSQL(candidateSql, retrievalLimit)
                  : Promise.resolve([] as PubMedArticle[]),
                searchCanonicalPubMed(pubmedSearchTerm, retrievalLimit, ncbiOptions),
              ]);

              const bigQueryArticles = bigQueryResult.status === 'fulfilled' ? bigQueryResult.value : [];
              const livePubMedArticles = livePubMedResult.status === 'fulfilled' ? livePubMedResult.value : [];
              if (bigQueryResult.status === 'rejected') console.error('BigQuery candidate retrieval failed:', bigQueryResult.reason);
              if (livePubMedResult.status === 'rejected') console.error('Live PubMed candidate retrieval failed:', livePubMedResult.reason);

              const candidatesByPmid = new Map<string, PubMedArticle>();
              bigQueryArticles.forEach((article) => candidatesByPmid.set(article.pmid, article));
              livePubMedArticles.forEach((article) => {
                const bigQueryMatch = candidatesByPmid.get(article.pmid);
                candidatesByPmid.set(article.pmid, {
                  ...bigQueryMatch,
                  ...article,
                  relevance_score: bigQueryMatch?.relevance_score ?? article.relevance_score ?? 85,
                });
              });
              const candidateArticles = Array.from(candidatesByPmid.values());
              candidateCount = candidateArticles.length;

              // 3. Apply Multi-faceted Clinical Filters
              const dateEligibleCandidates = filterArticlesByPublicationDate(
                candidateArticles,
                parsedQuery.filterCriteria.dateFilter
              );
              const filteredArticles = applyClinicalFilters(dateEligibleCandidates, parsedQuery.filterCriteria);
              
              // Hard Constraint: If query required disease filter and zero filtered articles match, Fail Closed (No Unrelated Pool Fallback)
              if ((parsedQuery.filterCriteria.dateFilter && dateEligibleCandidates.length === 0) ||
                  (parsedQuery.filterCriteria.diseaseFilter && parsedQuery.filterCriteria.diseaseFilter.length > 0 && filteredArticles.length === 0)) {
                console.warn(`Evidence Eligibility Gate Rejected all ${candidateArticles.length} candidates for query "${body.text}". Fail Closed triggered.`);
                pubmedResults = [];
              } else {
                // 4. Clinical Relevance Reranking & Direct vs Related Classification
                const rerankedArticles = rerankClinicalEvidence(dateEligibleCandidates, parsedQuery);
                const topCandidates = selectBalancedClinicalEvidence(rerankedArticles, 10, 10);

                // 5. Strict NCBI EFetch gate. Reuse already fetched live records and
                // batch-fetch only BigQuery candidates that have not been canonicalized.
                const canonicalMap = new Map(livePubMedArticles.map((article) => [article.pmid, article]));
                const missingPmids = topCandidates
                  .map((candidate) => candidate.pmid)
                  .filter((pmid) => !canonicalMap.has(pmid));
                if (missingPmids.length > 0) {
                  const fetchedMap = await fetchCanonicalPubMedEFetch(missingPmids, ncbiOptions);
                  fetchedMap.forEach((article, pmid) => canonicalMap.set(pmid, article));
                }

                const canonicalized = canonicalizeVerifiedCandidates(topCandidates, canonicalMap);
                canonicalized.rejected.forEach((rejection) => {
                  console.warn(`Canonical Gate Rejected PMID ${rejection.pmid}: ${rejection.mismatchReason}`);
                });

                // Fail closed: never fall back to an unverified BigQuery row.
                const dateVerifiedCanonical = filterArticlesByPublicationDate(
                  canonicalized.verified,
                  parsedQuery.filterCriteria.dateFilter
                );
                // Recompute every derived clinical field from the canonical
                // PubMed abstract and Publication Types, never from a BigQuery candidate.
                const dateVerified = rerankClinicalEvidence(dateVerifiedCanonical, parsedQuery);
                const bestMatches = dateVerified
                  .filter((article) => evaluateMultiDimensionalEligibility(article, parsedQuery).eligible_for_direct_answer)
                  .slice(0, 5);
                const bestPmids = new Set(bestMatches.map((article) => article.pmid));
                const possiblyRelated = dateVerified
                  .filter((article) => !bestPmids.has(article.pmid))
                  .slice(0, 5);
                pubmedResults = [
                  ...bestMatches.map((article) => ({ ...article, result_group: 'best_match' as const })),
                  ...possiblyRelated.map((article) => ({ ...article, result_group: 'possibly_related' as const })),
                ];
                console.log(`Phase 2 & Canonical Gate completed: retrieved ${candidateArticles.length}, filtered to ${filteredArticles.length}, canonical verified top ${pubmedResults.length}`);
              }
            } catch (error) {
              console.error('Clinical retrieval failed closed:', error);
              pubmedResults = [];
            }
          }

          // Get AI response with or without PubMed context
          console.log('Getting AI response with Citation Integrity pipeline...');
          
          // P1-3 Evidence Pack Assertion & Explicit Direct/Background Separation
          let directEvidenceObjects: EvidenceObject[] = [];
          let backgroundEvidenceObjects: EvidenceObject[] = [];
          let allEvidenceObjects: EvidenceObject[] = [];
          const directEvidenceMap = new Map<string, EvidenceObject>();
          const backgroundEvidenceMap = new Map<string, EvidenceObject>();
          const allEvidenceMap = new Map<string, EvidenceObject>();

          if (usePubMed && pubmedResults && pubmedResults.length > 0) {
            const parsedQuery = parseClinicalQuery(body.text);
            const directArticles: PubMedArticle[] = [];
            const backgroundArticles: PubMedArticle[] = [];
            pubmedResults.forEach((art) => {
              const multiElig = evaluateMultiDimensionalEligibility(art, parsedQuery);
              if (art.result_group === 'best_match' && multiElig.eligible_for_direct_answer) {
                directArticles.push(art);
              } else {
                backgroundArticles.push(art);
              }
            });
            // Assign one unique Evidence ID sequence across both result groups.
            allEvidenceObjects = createEvidenceObjects([...directArticles, ...backgroundArticles]);
            directEvidenceObjects = allEvidenceObjects.slice(0, directArticles.length);
            backgroundEvidenceObjects = allEvidenceObjects.slice(directArticles.length);
            directEvidenceObjects.forEach((evidence) => {
              evidence.evidenceType = 'direct';
              evidence.evidenceCategory = 'Direct Evidence';
              evidence.result_group = 'best_match';
              directEvidenceMap.set(evidence.id, evidence);
              allEvidenceMap.set(evidence.id, evidence);
            });
            backgroundEvidenceObjects.forEach((evidence) => {
              evidence.evidenceType = 'related';
              evidence.evidenceCategory = 'Background / Related Evidence';
              evidence.result_group = 'possibly_related';
              backgroundEvidenceMap.set(evidence.id, evidence);
              allEvidenceMap.set(evidence.id, evidence);
            });
          }

          // FAIL CLOSED RULE: If no direct evidence exists, DO NOT generate hallucinated direct numbers/claims
          if (usePubMed && directEvidenceObjects.length === 0) {
            console.warn(`Fail Closed Enforcement: directEvidenceObjects.length === 0 for query "${body.text}".`);
            responseText = `目前數據庫中查無足以支持具體臨床結論或數據的直接 PubMed 實證文獻。`;

            // If background evidence exists, render background section ONLY (No direct citations or direct claims)
            if (backgroundEvidenceObjects.length > 0) {
              const allIds = allEvidenceObjects.map((evidence) => evidence.id);
              const bgUI = renderProfessionalUISections(allEvidenceMap, allIds, {
                provider: aiProvider,
                model_id: aiModelId,
                retrieved_count: candidateCount || allEvidenceObjects.length,
                request_id: requestId,
                used_evidence_ids: [],
              });
              responseText += bgUI;
            }
          } else {
            // Direct Evidence Exists -> Pass ONLY directEvidenceObjects to LLM Prompt
            const systemMessage = usePubMed && directEvidenceObjects.length > 0
              ? `你是一位專為繁忙臨床醫師設計的臨床研究簡報助手。請根據下方提供的【直接臨床實證 (Direct Evidence)】回答問題。

【引用與格式嚴格規範】
1. 輸出格式：請以 JSON 格式回應：{"answer": "回答內容", "used_evidence_ids": ["E1"]}
2. 絕對禁止：
   - 絕對禁止自行寫出任何 PMID 數字、DOI 或網址！
   - 絕對禁止引用 Background / Related Evidence 標籤來回答直接臨床問題！
3. 每一個療效、安全性、族群或數值敘述句末都必須附上對應的 [E#]；只能使用下方存在的 Evidence ID。
4. answer 必須使用下列三個明確段落標題，標題前後換行；「主要研究證據」每篇研究各自一個 Markdown 條列，不可全部擠在同一段：
   - 臨床結論：最多 3 句，直接回答問題，並區分已核准適應症與研究中用途（若摘要可判定）。
   - 主要研究證據：每個 E 編號各列一點，保留研究設計、族群、樣本數、追蹤時間、主要終點與數值；資料未出現在摘要時明確寫「摘要未報告」，不可猜測。
   - 侷限與適用性：每項限制各列一點，說明年齡、研究設計及僅依 PubMed 摘要可確認的限制。
5. 所有自行撰寫的敘述、標題與欄位名稱一律使用臺灣繁體中文，禁止輸出簡體中文；僅藥名、試驗名稱、期刊名、論文原文標題、醫學縮寫及必要專有名詞保留英文。專業但易於快速閱讀，禁止 Emoji。

直接臨床實證 (Direct Evidence Objects):
${formatEvidenceForPrompt(directEvidenceObjects)}`
              : `你是一位專為繁忙臨床醫師設計的臨床研究簡報助手。請精準、高效率地回答臨床問題。

【格式規範】
1. 請以 JSON 格式回應：{"answer": "回答內容", "used_evidence_ids": []}
2. 絕對禁止自行產生或偽造 PMID、DOI 或 URL。
3. 精準、簡潔明瞭、直奔主題。
4. 所有自行撰寫的內容一律使用臺灣繁體中文，禁止簡體中文；僅藥名、試驗名稱、期刊名、論文原文標題、醫學縮寫及必要專有名詞保留英文。禁止使用任何表情符號。`;

            const messages = [
              { role: "system", content: systemMessage },
              { role: "user", content: body.text }
            ];

            const response = await this.env.AI.run(aiModelId, {
              messages,
              max_tokens: 4096
            });

            // Step 1: Parse structured JSON output
            const parsedLLM = parseStructuredLLMResponse(response);

            // Step 2: Post-Generation Claim-to-Evidence Binding Verification against directEvidenceMap ONLY
            const claimReport = verifyClaimAccuracy(parsedLLM.answer, directEvidenceMap, body.text);

            if (claimReport.abstainRequired) {
              const directIds = directEvidenceObjects.map((evidence) => evidence.id);
              responseText = `已找到 ${directIds.length} 篇符合條件且經 PubMed 官方核對的研究，但生成的臨床結論未通過逐句引用驗證，因此不顯示未驗證結論。以下僅呈現可直接查證的來源資料。`;
              responseText += renderProfessionalUISections(allEvidenceMap, allEvidenceObjects.map((evidence) => evidence.id), {
                provider: aiProvider,
                model_id: aiModelId,
                retrieved_count: candidateCount || allEvidenceMap.size,
                request_id: requestId,
                used_evidence_ids: [],
              });
            } else {
              // Step 3: Citation Validation against directEvidenceMap
              const validationResult = validateAndCorrectCitations(claimReport.validatedAnswer, directEvidenceMap);

              if (validationResult.warnings.length > 0) {
                console.warn('Citation Validation Warnings:', validationResult.warnings);
              }

              if (validationResult.verifiedEvidenceIds.length === 0) {
                const directIds = directEvidenceObjects.map((evidence) => evidence.id);
                responseText = `已找到 ${directIds.length} 篇符合條件且經 PubMed 官方核對的研究，但生成的臨床結論未保留任何通過驗證的引用，因此不顯示未驗證結論。以下僅呈現可直接查證的來源資料。`;
                responseText += renderProfessionalUISections(allEvidenceMap, allEvidenceObjects.map((evidence) => evidence.id), {
                  provider: aiProvider,
                  model_id: aiModelId,
                  retrieved_count: candidateCount || allEvidenceMap.size,
                  request_id: requestId,
                  used_evidence_ids: [],
                });
              } else {
                answerUsedEvidenceCount = validationResult.verifiedEvidenceIds.length;
                // Step 4: Backend Citation Renderer - append verified direct references
                responseText = renderVerifiedCitationsAndReferences(
                  validationResult.validatedAnswer,
                  directEvidenceMap,
                  validationResult.verifiedEvidenceIds,
                  {
                    provider: aiProvider,
                    model_id: aiModelId,
                    retrieved_count: candidateCount || directEvidenceMap.size,
                    request_id: requestId,
                    displayEvidenceMap: allEvidenceMap,
                    displayEvidenceIds: allEvidenceObjects.map((evidence) => evidence.id),
                  }
                );
              }
            }
          }

          // Strip any emojis
          responseText = responseText.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]|[\u{1F600}-\u{1F64F}]|[\u{1F680}-\u{1F6FF}]/gu, '');
  
          console.log('Final verified response text:', responseText);
  
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: responseText,
            timestamp: Date.now(),
            isAI: true,
            pubmedResults: pubmedResults,
            meta: {
              provider: aiProvider,
              model_id: aiModelId,
              request_id: requestId,
              retrieved_count: candidateCount || (pubmedResults?.length || 0),
              used_count: answerUsedEvidenceCount,
            },
          };
  
          this.messages.push(aiMessage);
          await this.state.storage.put('messages', this.messages);
          
          // Return the new messages
          return new Response(JSON.stringify({ 
            messages: [userMessage, aiMessage]
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error) {
          console.error('Error getting AI response:', error);
          // Return just the user message if AI fails
          return new Response(JSON.stringify({ messages: [userMessage] }), {
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }
  
      if (request.method === 'DELETE') {
        this.messages = [];
        await this.state.storage.delete('messages');
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }
  
      return new Response('Method not allowed', { status: 405 });
    }

    private parseAIResponse(response: any): string {
      if (!response) return "無回應內容。";
      
      if (typeof response === 'string') {
        try {
          const parsed = JSON.parse(response);
          return this.parseAIResponse(parsed);
        } catch {
          return response;
        }
      }

      if (response.choices && Array.isArray(response.choices) && response.choices.length > 0) {
        const choice = response.choices[0];
        if (choice.message?.content) {
          return choice.message.content;
        }
        if (choice.text) {
          return choice.text;
        }
      }

      if (typeof response.response === 'string') {
        return response.response;
      }

      if (typeof response.result?.response === 'string') {
        return response.result.response;
      }

      if (typeof response.content === 'string') {
        return response.content;
      }

      return JSON.stringify(response);
    }

    private formatPubMedContext(articles: PubMedArticle[]): string {
      return articles
        .map(
          (article) => {
            let authorsStr = 'Unknown';
            if (article.authors && article.authors.length > 0) {
              if (article.authors.length > 3) {
                authorsStr = `${article.authors.slice(0, 3).join(', ')} et al.`;
              } else {
                authorsStr = article.authors.join(', ');
              }
            }
            return `
Title: ${article.title}
PMID: ${article.pmid}
Authors: ${authorsStr}
Journal: ${article.journal || 'Unknown'}
Publication Date: ${article.publication_date || 'Unknown'}
Relevance Score: ${article.relevance_score || 85}%
Abstract: ${article.abstract?.substring(0, 500) || 'No abstract available'}
---`;
          }
        )
        .join('\n');
    }
  } 
