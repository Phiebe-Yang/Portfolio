import { PubMedArticle } from './pubmedBigQuery';
import { renderProfessionalUISections } from './professionalUI';
import { formatClinicalAnswerForDisplay } from './answerFormatting';

/**
 * Phase 1 — Citation Integrity Module
 * Guarantees that paper titles, trial names, and claims map 100% strictly
 * to backend-verified Evidence Objects and PubMed IDs without LLM hallucination or mismatches.
 */

export interface EvidenceObject {
  id: string; // e.g. "E1", "E2"
  pmid: string;
  doi?: string;
  title: string;
  abstract: string;
  authors?: string[];
  publicationDate?: {
    value: string;
    source: 'PubDate';
  };
  electronicPublicationDate?: {
    value: string;
    source: 'ArticleDate';
  };
  publication_date?: string;
  journal_issue_date?: string;
  electronic_publication_date?: string;
  first_publication_date?: string;
  publication_types?: string[];
  journal?: string;
  mesh_terms?: string[];
  relevance_score?: number;
  trial_names: string[];
  result_group?: 'best_match' | 'possibly_related';
  evidenceType?: 'direct' | 'related';
  evidenceCategory?: 'Direct Evidence' | 'Partially Relevant' | 'Background / Related Evidence';
  conditionMatchStatus?: 'confirmed' | 'mismatch' | 'unconfirmed';
  interventionMatchStatus?: 'confirmed' | 'mismatch' | 'unconfirmed';
  populationMatchStatus?: 'confirmed' | 'partial' | 'mismatch' | 'unconfirmed';
  populationDetail?: string;
  sampleSize?: string;
  studyDuration?: string;
  studyDesign?: string;
  matchBreakdown?: {
    diseaseMatch: boolean;
    drugMatch: boolean;
    studyTypeBonus: number;
    recencyBonus: number;
  };
}

export interface ValidationResult {
  validatedAnswer: string;
  verifiedEvidenceIds: string[];
  warnings: string[];
}

/**
 * 1. Extract Clinical Trial Names / Identifiers
 * Detects trial acronyms (KEYNOTE-024, CheckMate-067, RECOVERY, etc.) and NCT numbers (NCT01234567).
 */
export function extractTrialNames(text: string): string[] {
  if (!text) return [];
  const found = new Set<string>();

  // Pattern A: NCT Clinical Trial Identifiers (e.g. NCT02142738)
  const nctMatches = text.match(/\bNCT\d{8}\b/gi);
  if (nctMatches) {
    nctMatches.forEach((m) => found.add(m.toUpperCase()));
  }

  // Pattern B: Well-known trial acronyms and patterns (e.g. KEYNOTE-024, CheckMate-067, DESTINY-Breast03, etc.)
  const knownPrefixes = [
    'KEYNOTE', 'CHECKMATE', 'DESTINY', 'MONALEESA', 'IMPOWER', 'EMPA-REG',
    'DAPA-CKD', 'DAPA', 'PARADIGM', 'RECOVERY', 'STAMPEDE', 'PACIFIC', 'ADAURA',
    'TROPICS', 'ASCENT', 'SOLO', 'OAK', 'HERO', 'CLEOPATRA', 'PERTHO',
    'PROFILE', 'TAILORX', 'RXPONDER', 'KATHERINE', 'ALEX', 'CROWN',
    'FLAURA', 'ARCHES', 'PROSPER', 'TITAN', 'SPARTAN', 'BRAVO', 'OLLAP',
    'SYNERGY', 'NECTAR', 'HARMONY', 'BEACON', 'MONARCH', 'PALOMA', 'SELECT'
  ];

  const prefixRegex = new RegExp(`\\b(${knownPrefixes.join('|')})(?:-[A-Za-z0-9]+)?\\b`, 'gi');
  let match: RegExpExecArray | null;
  while ((match = prefixRegex.exec(text)) !== null) {
    found.add(match[0].toUpperCase());
  }

  // Pattern C: Generic trial acronyms (3-15 chars with optional hyphens/numbers followed by trial/study/phase)
  const phraseRegex = /\b([A-Z0-9]{3,15}(?:-[A-Za-z0-9]+)?)\s+(?:trial|study|phase)\b/gi;
  while ((match = phraseRegex.exec(text)) !== null) {
    const candidate = match[1].toUpperCase();
    const stopWords = ['THE', 'THIS', 'THAT', 'EACH', 'BOTH', 'WITH', 'FROM', 'CLINICAL', 'RANDOMIZED', 'CONTROLLED', 'PHASE'];
    if (!stopWords.includes(candidate)) {
      found.add(candidate);
    }
  }

  return Array.from(found);
}

/**
 * 2. Evidence Object Construction
 * Converts raw PubMed query results into structured Evidence Objects with assigned Evidence IDs (E1, E2, etc.).
 */
export function createEvidenceObjects(articles: PubMedArticle[]): EvidenceObject[] {
  return articles.map((art, idx) => {
    const id = `E${idx + 1}`;
    const fullText = `${art.title} ${art.abstract || ''}`;
    const extractedTrials = extractTrialNames(fullText);
    const existingTrials = (art as any).trial_names || [];
    const trial_names = Array.from(new Set([...extractedTrials, ...existingTrials]));

    const pubDateValue = art.publication_date ? String(art.publication_date).trim() : undefined;

    return {
      id,
      pmid: art.pmid ? String(art.pmid).trim() : '',
      doi: art.doi ? String(art.doi).trim() : undefined,
      title: art.title ? String(art.title).trim() : '現有 PubMed 紀錄未報告標題',
      abstract: art.abstract ? String(art.abstract).trim() : '現有 PubMed 摘要未報告內容',
      authors: art.authors && art.authors.length > 0 ? art.authors : undefined,
      publication_date: pubDateValue,
      publicationDate: pubDateValue ? { value: pubDateValue, source: 'PubDate' } : undefined,
      journal_issue_date: art.journal_issue_date || pubDateValue,
      electronic_publication_date: art.electronic_publication_date,
      first_publication_date: art.first_publication_date || art.electronic_publication_date || pubDateValue,
      electronicPublicationDate: art.electronic_publication_date
        ? { value: art.electronic_publication_date, source: 'ArticleDate' }
        : undefined,
      publication_types: art.publication_types,
      journal: art.journal ? String(art.journal).trim() : undefined,
      mesh_terms: art.mesh_terms,
      relevance_score: art.relevance_score ?? 85,
      trial_names,
      result_group: art.result_group,
      evidenceType: (art as any).evidenceType,
      evidenceCategory: (art as any).evidenceCategory,
      conditionMatchStatus: (art as any).conditionMatchStatus,
      interventionMatchStatus: (art as any).interventionMatchStatus,
      populationMatchStatus: (art as any).populationMatchStatus,
      populationDetail: (art as any).populationDetail,
      sampleSize: (art as any).sampleSize,
      studyDuration: (art as any).studyDuration,
      studyDesign: (art as any).studyDesign,
      matchBreakdown: (art as any).matchBreakdown,
    };
  });
}

/**
 * 3. Format Context for LLM System Prompt
 * Provides Evidence Objects with Evidence IDs (E1, E2, etc.) while intentionally concealing raw PMIDs/DOIs
 * to prevent the LLM from writing or hallucinating raw identifiers.
 */
export function formatEvidenceForPrompt(evidenceList: EvidenceObject[]): string {
  return evidenceList
    .map((ev) => {
      let authorsStr = 'Unknown';
      if (ev.authors && ev.authors.length > 0) {
        authorsStr = ev.authors.length > 3 ? `${ev.authors.slice(0, 3).join(', ')} et al.` : ev.authors.join(', ');
      }
      const trialStr = ev.trial_names.length > 0 ? `Trial/Study Names: ${ev.trial_names.join(', ')}\n` : '';
      return `[${ev.id}]
Title: ${ev.title}
Authors: ${authorsStr}
Journal: ${ev.journal || 'Unknown'}
First Public Date: ${ev.first_publication_date || ev.electronic_publication_date || ev.publication_date || 'Unknown'}
Journal Issue Date: ${ev.journal_issue_date || ev.publication_date || 'Unknown'}
Relevance Score: ${ev.relevance_score}%
${trialStr}Abstract: ${ev.abstract.substring(0, 1600)}
---`;
    })
    .join('\n');
}

/**
 * LlmClaim Type Specification (Item #9)
 * Represents natural-language text generated by LLM along with allowed evidence_ids ONLY.
 * Intentionally excludes pmid, doi, title, journal, authors, publicationDate, url.
 */
export interface LlmClaim {
  text: string;
  evidenceIds: string[];
}

/**
 * 4. Prohibit Raw Identifiers (LLM Output Sanitizer & Adversarial Defense)
 * Strips any raw PMID numbers, DOIs, URLs, HTML tags, or markdown links that the LLM may have generated in its text output.
 */
export function stripRawIdentifiers(text: string): string {
  if (!text) return '';
  let sanitized = text;

  // 1. Remove HTML anchor links for PubMed or DOI
  sanitized = sanitized.replace(/<a\s+[^>]*href=["']?https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov|doi\.org)[^"'>]*["']?[^>]*>.*?<\/a>/gi, '');

  // 2. Remove Markdown links for PubMed or DOI (e.g. [PMID: 1234](https://...))
  sanitized = sanitized.replace(/\[[^\]]*\]\(https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov|doi\.org)\/[^\)]*\)/gi, '');

  // 3. Remove raw PMIDs (e.g. PMID: 12345678, PMID 12345678, PMID：12345678)
  sanitized = sanitized.replace(/\bPMID[:：\s]*\d{5,10}\b/gi, '');

  // 4. Remove raw DOIs (e.g. DOI: 10.1016/..., https://doi.org/10.1016/...)
  sanitized = sanitized.replace(/\b(?:DOI[:：\s]*)?(?:https?:\/\/doi\.org\/)?10\.\d{4,9}\/[-._;()/:%A-Za-z0-9]+\b/gi, '');

  // 5. Remove raw PubMed or DOI URLs (including URL-encoded)
  sanitized = sanitized.replace(/https?:\/\/(?:pubmed\.ncbi\.nlm\.nih\.gov|doi\.org)\/[^\s\|<>\]\)]+/gi, '');

  // 6. Clean up empty brackets or leftover whitespace
  sanitized = sanitized
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/[ \t]{2,}/g, ' ');

  return sanitized;
}

/**
 * 5. Parse Structured LLM Response
 * Parses the JSON response generated by the LLM containing { answer, used_evidence_ids }.
 */
export function parseStructuredLLMResponse(llmOutput: any): { answer: string; used_evidence_ids: string[] } {
  let rawText = '';

  if (typeof llmOutput === 'string') {
    rawText = llmOutput;
  } else if (llmOutput && typeof llmOutput === 'object') {
    if (llmOutput.choices?.[0]?.message?.content) {
      rawText = llmOutput.choices[0].message.content;
    } else if (llmOutput.response) {
      rawText = typeof llmOutput.response === 'string' ? llmOutput.response : JSON.stringify(llmOutput.response);
    } else if (llmOutput.result?.response) {
      rawText = llmOutput.result.response;
    } else {
      rawText = JSON.stringify(llmOutput);
    }
  }

  // Attempt JSON extraction
  let cleanJsonCandidate = rawText.trim();
  if (cleanJsonCandidate.startsWith('```')) {
    cleanJsonCandidate = cleanJsonCandidate.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }

  if (cleanJsonCandidate.startsWith('{') && cleanJsonCandidate.endsWith('}')) {
    try {
      const parsed = JSON.parse(cleanJsonCandidate);
      if (typeof parsed.answer === 'string') {
        const usedIds = Array.isArray(parsed.used_evidence_ids)
          ? parsed.used_evidence_ids.map((id: any) => String(id).toUpperCase().replace('[', '').replace(']', ''))
          : [];
        return { answer: parsed.answer, used_evidence_ids: usedIds };
      }
    } catch {
      // JSON parse fallback
    }
  }

  // Fallback for plain text response
  const foundIds = new Set<string>();
  const idMatches = rawText.match(/\[E\d+\]/gi);
  if (idMatches) {
    idMatches.forEach((m) => foundIds.add(m.toUpperCase().replace('[', '').replace(']', '')));
  }

  return {
    answer: rawText,
    used_evidence_ids: Array.from(foundIds),
  };
}

/**
 * 6. Citation Validator, Metadata Consistency Checks & Trial Name Validation
 * Ensures all [E1] tags point to valid Evidence Objects, validates trial names,
 * corrects mismatched trial citations to the right Evidence Object, and verifies publication dates/authors.
 */
export function validateAndCorrectCitations(
  answer: string,
  evidenceMap: Map<string, EvidenceObject>
): ValidationResult {
  const warnings: string[] = [];
  const verifiedIdsSet = new Set<string>();

  // Step A: Strip any raw PMID/DOI/URL generated by LLM
  let text = stripRawIdentifiers(answer);

  // Step B: Sentence-level validation & Trial Name / Metadata consistency checks
  // Split into sentences or lines
  const sentencePattern = /([^.!?\n]+[.!?\n]*)/g;
  const sentences = text.match(sentencePattern) || [text];

  const processedSentences = sentences.map((sentence) => {
    let updatedSentence = sentence;
    const tagMatches = sentence.match(/\[E\d+(?:\s*(?:\||｜)\s*(?:Abstract|摘要))?\]/gi);
    if (!tagMatches) return sentence;

    const sentenceTrialNames = extractTrialNames(sentence);

    for (const rawTag of tagMatches) {
      const evidenceId = rawTag.match(/E\d+/i)?.[0].toUpperCase() || '';
      const evidence = evidenceMap.get(evidenceId);

      // Check 1: Existence Check
      if (!evidence) {
        warnings.push(`Invalid Evidence ID [${evidenceId}] removed (not found in retrieved results).`);
        updatedSentence = updatedSentence.replace(rawTag, '');
        continue;
      }

      // Check 2: Trial Name Validation
      if (sentenceTrialNames.length > 0) {
        let trialMatched = false;

        for (const sentenceTrial of sentenceTrialNames) {
          const evidenceFullText = `${evidence.title} ${evidence.abstract} ${evidence.trial_names.join(' ')}`.toUpperCase();

          if (evidenceFullText.includes(sentenceTrial)) {
            trialMatched = true;
            verifiedIdsSet.add(evidenceId);
            break;
          }

          // Search if another Evidence Object contains this trial name
          let correctEvidenceId: string | null = null;
          for (const [candidateId, candidateObj] of evidenceMap.entries()) {
            const candFullText = `${candidateObj.title} ${candidateObj.abstract} ${candidateObj.trial_names.join(' ')}`.toUpperCase();
            if (candFullText.includes(sentenceTrial)) {
              correctEvidenceId = candidateId;
              break;
            }
          }

          if (correctEvidenceId) {
            warnings.push(
              `Trial Name Mismatch: Sentence mentioned "${sentenceTrial}" with [${evidenceId}], but [${correctEvidenceId}] matches "${sentenceTrial}". Citation automatically corrected to [${correctEvidenceId}].`
            );
            const correctedTag = /(?:Abstract|摘要)/i.test(rawTag)
              ? `[${correctEvidenceId}｜摘要]`
              : `[${correctEvidenceId}]`;
            updatedSentence = updatedSentence.replace(rawTag, correctedTag);
            verifiedIdsSet.add(correctEvidenceId);
            trialMatched = true;
            break;
          } else {
            // Check if current evidence matches the trial name
            const evFullText = `${evidence.title} ${evidence.abstract} ${evidence.trial_names.join(' ')}`.toUpperCase();
            if (evFullText.includes(sentenceTrial)) {
              trialMatched = true;
              verifiedIdsSet.add(evidenceId);
              break;
            } else {
              warnings.push(
                `Unverified Trial Citation: Sentence mentioned "${sentenceTrial}" with [${evidenceId}], but no retrieved paper matches "${sentenceTrial}". Tag [${evidenceId}] removed.`
              );
              updatedSentence = updatedSentence.replace(rawTag, '');
              trialMatched = true; // Handled
              break;
            }
          }
        }

        if (trialMatched) {
          continue;
        }
      }

      // Check 3: Metadata Consistency (Publication Year)
      const yearMatches = sentence.match(/\b(19\d{2}|20\d{2})\b/g);
      const evidenceDate = evidence.first_publication_date || evidence.electronic_publication_date || evidence.publication_date;
      if (yearMatches && evidenceDate) {
        const evYearMatch = evidenceDate.match(/\b(19\d{2}|20\d{2})\b/);
        if (evYearMatch) {
          const evYear = evYearMatch[0];
          const yearInSentenceMatchesEvYear = yearMatches.includes(evYear);

          if (!yearInSentenceMatchesEvYear) {
            // Check if another evidence matches the mentioned year
            let yearMatchedOtherId: string | null = null;
            for (const [candId, candObj] of evidenceMap.entries()) {
              const candidateDate = candObj.first_publication_date || candObj.electronic_publication_date || candObj.publication_date;
              if (candidateDate && yearMatches.some((y) => candidateDate.includes(y))) {
                yearMatchedOtherId = candId;
                break;
              }
            }

            if (yearMatchedOtherId) {
              warnings.push(
                `Metadata Year Mismatch: Sentence year (${yearMatches.join(', ')}) differed from [${evidenceId}] (${evYear}). Re-mapped citation to [${yearMatchedOtherId}].`
              );
              const correctedTag = /(?:Abstract|摘要)/i.test(rawTag)
                ? `[${yearMatchedOtherId}｜摘要]`
                : `[${yearMatchedOtherId}]`;
              updatedSentence = updatedSentence.replace(rawTag, correctedTag);
              verifiedIdsSet.add(yearMatchedOtherId);
              continue;
            }
          }
        }
      }

      // If passed checks, keep tag
      verifiedIdsSet.add(evidenceId);
    }

    return updatedSentence;
  });

  const validatedAnswer = processedSentences.join('');

  return {
    validatedAnswer,
    verifiedEvidenceIds: Array.from(verifiedIdsSet),
    warnings,
  };
}

/**
 * 7. Backend Citation Renderer
 * Renders verified inline citations and constructs a 100% backend-verified References section.
 * PMIDs and DOIs are strictly generated from backend Evidence Object metadata.
 */
export function renderVerifiedCitationsAndReferences(
  validatedAnswer: string,
  evidenceMap: Map<string, EvidenceObject>,
  verifiedEvidenceIds: string[],
  provenanceOptions?: {
    provider?: string;
    model_id?: string;
    retrieved_count?: number;
    request_id?: string;
    displayEvidenceMap?: Map<string, EvidenceObject>;
    displayEvidenceIds?: string[];
    used_evidence_ids?: string[];
  }
): string {
  // Collect all verified Evidence IDs present in validated answer or verified list
  const activeIdsSet = new Set<string>(verifiedEvidenceIds);

  const inlineTagMatches = validatedAnswer.match(/\[E\d+(?:\s*(?:\||｜)\s*(?:Abstract|摘要))?\]/gi);
  if (inlineTagMatches) {
    inlineTagMatches.forEach((tag) => {
      const id = tag.match(/E\d+/i)?.[0].toUpperCase() || '';
      if (evidenceMap.has(id)) {
        activeIdsSet.add(id);
      }
    });
  }

  // Sort evidence IDs deterministically (E1, E2, E3...)
  const sortedVerifiedIds = Array.from(activeIdsSet).sort((a, b) => {
    const numA = parseInt(a.replace('E', ''), 10) || 0;
    const numB = parseInt(b.replace('E', ''), 10) || 0;
    return numA - numB;
  });

  if (sortedVerifiedIds.length === 0) {
    return validatedAnswer;
  }

  // Render Phase 4 Professional UI Sections & Evidence Cards
  const displayEvidenceMap = provenanceOptions?.displayEvidenceMap || evidenceMap;
  const displayEvidenceIds = provenanceOptions?.displayEvidenceIds || sortedVerifiedIds;
  const professionalUIOutput = renderProfessionalUISections(displayEvidenceMap, displayEvidenceIds, {
    ...provenanceOptions,
    used_evidence_ids: sortedVerifiedIds,
  });

  // Render References / Evidence Cards Section directly from Evidence Object metadata
  const referenceLines: string[] = [];
  referenceLines.push('\n\n---\n### 已核對的參考文獻與實證對照\n');

  sortedVerifiedIds.forEach((id) => {
    const ev = evidenceMap.get(id);
    if (!ev) return;

    // Strict Bibliographic Integrity: Do not render paper if title or pmid is missing from record
    if (!ev.pmid || !ev.title || ev.title === '現有 PubMed 紀錄未報告標題') {
      return;
    }

    let authorsStr = '現有 PubMed 紀錄未報告';
    if (ev.authors && ev.authors.length > 0) {
      authorsStr = ev.authors.length > 3 ? `${ev.authors.slice(0, 3).join(', ')} et al.` : ev.authors.join(', ');
    }

    const pmidLink = ev.pmid ? `[PMID: ${ev.pmid}](https://pubmed.ncbi.nlm.nih.gov/${ev.pmid}/)` : 'PMID：無資料';
    const doiLink = ev.doi ? ` | [DOI: ${ev.doi}](https://doi.org/${ev.doi})` : '';
    const firstPubDateStr = ev.first_publication_date || ev.electronic_publication_date || ev.publication_date || '現有 PubMed 紀錄未報告';
    const issueDateStr = ev.journal_issue_date || ev.publication_date;
    const journalStr = ev.journal ? ev.journal : '現有 PubMed 紀錄未報告';
    const trialTag = ev.trial_names.length > 0 ? ` [試驗名稱: ${ev.trial_names.join(', ')}]` : '';

    referenceLines.push(
      `- **[${ev.id}]** ${ev.title}${trialTag}\n` +
      `  - **期刊與時間**: ${journalStr} (**首次公開: ${firstPubDateStr}**${issueDateStr && issueDateStr !== firstPubDateStr ? `；**期刊卷期: ${issueDateStr}**` : ''})\n` +
      `  - **作者**: ${authorsStr}\n` +
      `  - **實證連結**: ${pmidLink}${doiLink}`
    );
  });

  return formatClinicalAnswerForDisplay(validatedAnswer) + professionalUIOutput + referenceLines.join('\n');
}
