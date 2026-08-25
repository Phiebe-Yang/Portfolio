interface ChatMessage {
    id: string;
    text: string;
    timestamp: number;
    isAI?: boolean;
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
      run: (model: string, params: { messages: Array<{ role: string; content: string }> }) => Promise<any>;
    };
  }

  export function sanitizeResponseText(text: string, originalPrompt?: string): string {
    if (!text) return text;
    let cleaned = text;

    // 若傳入的是 JSON 字串，嘗試解包 content
    if (cleaned.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(cleaned);
        const extracted = extractResponseText(parsed);
        if (extracted && extracted !== cleaned) {
          cleaned = extracted;
        }
      } catch {
        // 非 JSON 字串，保留原內容
      }
    }

    // 移除 SAME_NOT_FOUND
    cleaned = cleaned.replace(/SAME_NOT_FOUND/g, '');

    // 徹底移除各種「根據...文件/檔案/資料/文章/內容/xray_application_info.md...」開頭與過渡贅句
    cleaned = cleaned.replace(/(?:根據|依據|基於|參考)\s*(?:提供|上述|相關|檢索|檢索到)?\s*的?\s*(?:[a-zA-Z0-9_\-\.]+\.(?:md|txt|html?)|[a-zA-Z0-9_\-\.]+\s*(?:文件|檔案|資料))?\s*(?:文件|資料|文章|資料庫|紀錄|檔案)?\s*(?:內容)?\s*(?:顯示|指出|提及|記載|說明|所述)?\s*[，：:\s]*/g, '');
    cleaned = cleaned.replace(/根據[a-zA-Z0-9_\-\.]+\s*(?:文件|檔案|資料)?[，：:\s]*/g, '');

    // 去除用中括號包裹 URL 的格式，例如 [https://example.com] -> https://example.com
    cleaned = cleaned.replace(/\[(https?:\/\/[^\]]+)\]/g, '$1');

    cleaned = cleaned.trim();

    // 移除自我重複段落：若回答中包含相同的重複句子或相同段落（例如連續出現兩次完全相同的內容/連結說明），只保留一份
    const lines = cleaned.split('\n');
    const uniqueLines: string[] = [];
    let prevLine = '';
    for (const l of lines) {
      const trimmedLine = l.trim();
      if (trimmedLine !== '' && trimmedLine === prevLine) {
        continue;
      }
      uniqueLines.push(l);
      if (trimmedLine !== '') {
        prevLine = trimmedLine;
      }
    }
    cleaned = uniqueLines.join('\n');

    // 去除重複句/重複網址與尾部殘留贅字拼接
    const urlPattern = /https?:\/\/[^\s\n\r>"\)]+/g;
    const matches = Array.from(cleaned.matchAll(urlPattern));
    if (matches.length > 0) {
      const firstMatch = matches[0];
      const endOfFirstUrl = (firstMatch.index || 0) + firstMatch[0].length;
      let afterUrl = cleaned.substring(endOfFirstUrl).trim();
      // 如果第一個網址後面只有句號/標點，或只有重複文字如「請官網說明...」，直接截斷
      if (/^[。，；：\s]*$/v.test(afterUrl) || afterUrl.includes('https://') || afterUrl.length < 15) {
        cleaned = cleaned.substring(0, endOfFirstUrl).trim();
      }
    }

    // 若 AI 回答第一行包含了完整的原始問題題目，則去除第一行題目，避免重複
    const finalLines = cleaned.split('\n');
    if (finalLines.length > 1) {
      const firstLine = finalLines[0].trim();
      const prompt = originalPrompt ? originalPrompt.trim() : '';
      if (
        (prompt && (firstLine === prompt || firstLine.includes(prompt))) ||
        firstLine.startsWith('請問' + prompt) ||
        firstLine.startsWith('問題：')
      ) {
        finalLines.shift();
        while (finalLines.length > 0 && finalLines[0].trim() === '') {
          finalLines.shift();
        }
        cleaned = finalLines.join('\n');
      }
    }

    return cleaned.trim();
  }

  function extractResponseText(aiResult: any): string {
    if (!aiResult) return '';

    if (typeof aiResult === 'string') {
      const trimmed = aiResult.trim();
      if (trimmed.startsWith('{')) {
        try {
          const parsed = JSON.parse(trimmed);
          const extracted = extractResponseText(parsed);
          if (extracted && extracted !== trimmed) return extracted;
        } catch {
          // not JSON
        }
      }
      return aiResult;
    }

    if (aiResult?.choices?.[0]?.message?.content) {
      const content = aiResult.choices[0].message.content;
      if (typeof content === 'string') {
        return extractResponseText(content);
      }
      if (Array.isArray(content)) {
        return content.map((c: any) => (typeof c === 'string' ? c : c.text || '')).join('');
      }
    }

    if (typeof aiResult?.response === 'string') {
      return extractResponseText(aiResult.response);
    }

    if (aiResult?.response) {
      return extractResponseText(aiResult.response);
    }

    return JSON.stringify(aiResult);
  }

  function hasSameFolderChunks(data: any[]): boolean {
    if (!Array.isArray(data) || data.length === 0) return false;
    return data.some((item: any) => {
      const fn = (item?.filename || item?.file_name || item?.key || item?.path || item?.name || item?.source || '').toLowerCase();
      return fn.includes('same');
    });
  }
  
  export class ChatState {
    private state: DurableObjectState;
    private messages: ChatMessage[];
    private env: Env;
  
    constructor(state: DurableObjectState, env: Env) {
      this.state = state;
      this.env = env;
      this.messages = [];
      this.state.blockConcurrencyWhile(async () => {
        const stored = await this.state.storage.get<ChatMessage[]>('messages');
        if (stored) {
          this.messages = stored;
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
        const body = await request.json() as { text: string };
        console.log('Received message:', body.text);
        
        const userMessage: ChatMessage = {
          id: crypto.randomUUID(),
          text: body.text,
          timestamp: Date.now(),
          isAI: false
        };
        this.messages.push(userMessage);
  
        try {
          // Get AI response
          console.log('Getting AI response...');
          
          const formatInstruction = "\n\n(極重要回答格式要求：\n1. 知識庫 .md 檔案的第一行為問題題目，第二行開始才是解答內容。回答時，請『只輸出第二行開始的解答內容』，『絕對不可重複或呈現第一行的問題題目』。\n2. 請嚴格保持知識庫原文的 Markdown 排版格式與換行。如果原文有數字列表如『1. 』、『2. 』或項目符號，必須照實換行並完整顯示數字標號（例如 1.、2.、3.）。絕對不可把多個項目擠在同一行或省略數字標號！\n3. 若內容中包含網址或連結，請務必『完全照抄原文網址』，包含網址內的中文與括號（如 ...病歷摘要及複製本申請書(E-mail及傳真).pdf），切勿截斷、修改或遺漏網址的任何部分，亦切勿將句號、逗號放進網址內或用中括號包住網址。\n4. 請一律使用繁體中文，切勿包含問候語、開場白或『根據文件內容』等贅字。)";

          // 判斷回覆是否為「無法回答 / 查無資料 / 轉請尋找其他資源」的拒絕或無效回覆
          const isInvalidResponse = (text: string) => {
            if (!text || text.trim().length === 0) return true;
            const lower = text.toLowerCase();
            const invalidKeywords = [
              '很抱歉',
              '沒有這方面的相關資料',
              '沒有相關資料',
              '沒有直接回答',
              '沒有提到',
              '未提及',
              '未記載',
              '未包含',
              '不包含',
              '無相關',
              '無法確定',
              '無法回答',
              '無法根據',
              '找不到',
              '資料庫中未',
              '資料庫內目前沒有',
              '尋找其他',
              '無法直接回答',
              '未提供與'
            ];
            return invalidKeywords.some(kw => lower.includes(kw));
          };

          // 階段一：優先檢索 same/ 資料夾中的文件
          console.log('Stage 1: Searching in same/ folder first...');
          const sameQuery = body.text + formatInstruction + "\n(極重要優先檢索規則：請優先搜尋與參考檔名或路徑含有『same/』或『same』的知識庫檔案內容來回答。若 same 資料夾的檔案中有相關解答，請直接回答；若 same 資料夾中完全沒有與此問題相關的解答，請務必只回覆『SAME_NOT_FOUND』，切勿拿其他資料夾解答湊數。)";
          
          let aiResponse = await this.env.AI.autorag("ntuh-med-record-rag").aiSearch({
            query: sameQuery,
          });
          console.log('Raw AI response (same search):', aiResponse);

          let aiResult = aiResponse as AIResponse;
          let responseText = extractResponseText(aiResult);
          let foundInSame = false;

          if (responseText && !responseText.includes('SAME_NOT_FOUND')) {
            if (!isInvalidResponse(responseText) && (typeof aiResponse === 'string' || hasSameFolderChunks(aiResult?.data) || responseText.length > 5)) {
              foundInSame = true;
            }
          }

          // 階段二：如果在 same 資料夾沒找到答案，則搜尋其他資料夾
          if (!foundInSame) {
            console.log('Stage 2: No answer in same/ folder. Searching in other folders...');
            const fallbackQuery = body.text + formatInstruction + "\n(檢索規則：此問題在 same 資料夾未找到，請搜尋知識庫中的其他資料夾如 Q&A/、type/、fin/、normal/ 等來回答問題。若問題屬於抽象、通用或哲學議題且資料庫無紀錄，請結合通用知識與專業觀點溫和且完整地解答，切勿直接回覆拒絕或無資料。)";
            
            aiResponse = await this.env.AI.autorag("ntuh-med-record-rag").aiSearch({
              query: fallbackQuery,
            });
            console.log('Raw AI response (other folders search):', aiResponse);
            aiResult = aiResponse as AIResponse;
            responseText = extractResponseText(aiResult);
          }

          // 階段三：如果 AutoRAG 回覆無效/拒絕或無檢索結果，啟用 LLM 通用與抽象問題解答 Fallback
          if (isInvalidResponse(responseText) || (typeof aiResponse !== 'string' && (!aiResult?.data || aiResult.data.length === 0))) {
            console.log('AutoRAG returned no valid data or refusal response, using LLM general fallback...');
            const messages = [
              {
                role: "system",
                content: "You are a professional, empathetic, and knowledgeable AI assistant for NTUH (National Taiwan University Hospital) medical record applications as well as general health, psychological, legal, and philosophical inquiries.\n\nYou MUST ALWAYS reply in Traditional Chinese (繁體中文) ONLY. Do NOT use Simplified Chinese under any circumstances.\n\nGuidance:\n1. If the question is about NTUH medical record rules, fees, or procedures, provide structured guidance.\n2. If the question is abstract, hypothetical, philosophical, creative, or a personal/emotional question (e.g. asking about life, health concepts, emotional support, or hypothetical scenarios like naming a tumor):\n   - Do NOT say '很抱歉，資料庫內沒有資料' or refuse to answer.\n   - Answer thoughtfully, kindly, and comprehensively from medical, psychological, legal, or philosophical perspectives as appropriate.\n3. Do NOT use conversational filler like '根據文件內容' or unnecessary greetings."
              },
              {
                role: "user",
                content: body.text,
              },
            ];
            try {
              const response = await this.env.AI.run("@cf/meta/llama-3.3-70b-instruct", { messages });
              responseText = extractResponseText(response);
            } catch (llmErr) {
              console.error('LLM fallback error:', llmErr);
            }
          }

          responseText = sanitizeResponseText(responseText, body.text);
  
          console.log('Final response text:', responseText);
  
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: responseText,
            timestamp: Date.now(),
            isAI: true
          };
  
          this.messages.push(aiMessage);
          await this.state.storage.put('messages', this.messages);
          
          // Return only the new messages
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
  } 