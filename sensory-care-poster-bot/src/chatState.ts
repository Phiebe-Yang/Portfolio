interface ChatMessage {
    id: string;
    text: string;
    timestamp: number;
    isAI?: boolean;
    images?: string[];
  }
  
  interface Env {
    R2_BUCKET: R2Bucket;
    AI: {
      autorag: (name: string) => {
        search: (params: { query: string }) => Promise<any>;
        aiSearch: (params: { query: string }) => Promise<any>;
      };
      run: (model: string, params: any) => Promise<any>;
    };
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
          // 1. 呼叫 AutoRAG 的 search()（不是 aiSearch()），取得檢索結果與對應的原始檔名
          console.log('Calling AutoRAG search()...');
          let searchResult: any = null;
          try {
            if (this.env.AI && typeof (this.env.AI as any).autorag === 'function') {
              // 支援傳入以 image-rag 命名的 AutoRAG instance，若無則降級為預設
              const autoragInstance = (this.env.AI as any).autorag("image-rag") || (this.env.AI as any).autorag("proud-thunder-70c9");
              searchResult = await autoragInstance.search({
                query: body.text,
              });
              console.log('AutoRAG search result:', JSON.stringify(searchResult, null, 2));
            }
          } catch (autoragErr) {
            console.warn('AutoRAG search failed or not configured, continuing with general LLM QA:', autoragErr);
          }

          let dataItems: any[] = [];
          if (Array.isArray(searchResult)) {
            dataItems = searchResult;
          } else if (searchResult && Array.isArray((searchResult as any).data)) {
            dataItems = (searchResult as any).data;
          } else if (searchResult && Array.isArray((searchResult as any).results)) {
            dataItems = (searchResult as any).results;
          }

          const retrievedTexts: string[] = [];
          const candidateFilenames: string[] = [];

          for (const item of dataItems) {
            const textChunk = item.content || item.text || item.chunk || '';
            if (textChunk && typeof textChunk === 'string') {
              retrievedTexts.push(textChunk);

              // 嘗試從文字中解析出圖片檔名 (例如 sample.png, pic.jpg)
              const imgMatches = textChunk.match(/[\w\.-]+\.(?:png|jpg|jpeg|webp|gif)/gi);
              if (imgMatches) {
                candidateFilenames.push(...imgMatches);
              }
            }

            const fn = item.filename || item.file_name || item.name || item.source || item.key || 
                       item.file?.name || item.file?.key || item.file?.filename ||
                       item.metadata?.filename || item.metadata?.file_name || item.metadata?.key || item.metadata?.name ||
                       item.document?.name || item.document?.filename || item.document?.key ||
                       item.uri || item.url;
            if (fn && typeof fn === 'string') {
              candidateFilenames.push(fn);
            }
          }

          // 2. 從結果中篩出副檔名是圖片的項目（.png .jpg .jpeg .webp .gif）
          const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
          let matchedImageFiles = Array.from(new Set(
            candidateFilenames.filter(fn => {
              const lower = fn.toLowerCase();
              return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
            })
          ));

          // 若 AutoRAG 搜尋結果未找到圖片，直接查詢 R2 bucket 中最符合問題的圖片檔案
          if (matchedImageFiles.length === 0 && this.env.R2_BUCKET) {
            try {
              console.log('No images found in AutoRAG search. Listing images directly from R2 bucket...');
              const r2List = await this.env.R2_BUCKET.list({ limit: 50 });
              if (r2List && r2List.objects && r2List.objects.length > 0) {
                const r2Images = r2List.objects
                  .map(o => o.key)
                  .filter(key => {
                    const lower = key.toLowerCase();
                    return IMAGE_EXTENSIONS.some(ext => lower.endsWith(ext));
                  });

                if (r2Images.length > 0) {
                  const queryLower = body.text.toLowerCase();
                  // 1. 完全關鍵字比對
                  const keywords = queryLower.split(/[\s,，.。!！?？_\-\/\\]+/).filter(k => k.length > 0);
                  
                  // 2. 多層次相似度與主題領域特徵權重計算 (包含子字詞、注音/英文拼音、健康/洗手/醫療等常用圖片語意匹配)
                  const scoredImages = r2Images.map(key => {
                    const keyLower = key.toLowerCase();
                    let score = 0;

                    // 關鍵字與檔名匹配
                    for (const kw of keywords) {
                      if (keyLower.includes(kw)) {
                        score += kw.length * 5;
                      } else {
                        // 檢查是否有部分字元重疊 (子字串模糊匹配)
                        for (let len = Math.min(kw.length, 4); len >= 2; len--) {
                          for (let i = 0; i <= kw.length - len; i++) {
                            const sub = kw.substring(i, i + len);
                            if (keyLower.includes(sub)) {
                              score += len * 2;
                            }
                          }
                        }
                      }
                    }

                    // 領域知識語意比對（洗手、衛生、咳嗽、TOCC、VAP、UTI、病菌等醫療衛教預設高關聯）
                    const domainKeywords: Record<string, string[]> = {
                      '洗手': ['手', '手部', '洗', '衛生', '病菌', '時機', '五時機', '兒童', '7', '七步驟'],
                      '咳嗽': ['咳嗽', '呼吸', '禮節', 'tocc', '台大'],
                      '衛生': ['衛生', '清潔', '防護'],
                      '感染': ['uti', 'vap', 'bundle', '組合'],
                      '小朋友': ['兒童', '兒童版', '可愛'],
                    };

                    for (const [topic, topicKws] of Object.entries(domainKeywords)) {
                      if (queryLower.includes(topic)) {
                        if (topicKws.some(tk => keyLower.includes(tk))) {
                          score += 10;
                        }
                      }
                    }

                    return { key, score };
                  });

                  // 依分數高低排序
                  scoredImages.sort((a, b) => b.score - a.score);

                  // 挑選得分最高（最符合問題）的圖片；若完全抽象無得分，選取評分排序第一的最適切圖片
                  const bestMatch = scoredImages[0];
                  if (bestMatch.score > 0) {
                    matchedImageFiles = scoredImages.filter(s => s.score > 0).map(s => s.key).slice(0, 3);
                  } else {
                    console.log('Abstract query detected. Selected highest relevance image based on domain index:', bestMatch.key);
                    matchedImageFiles = [bestMatch.key];
                  }
                }
              }
            } catch (r2ListErr) {
              console.error('Error listing R2 bucket for fallback images:', r2ListErr);
            }
          }

          console.log('Matched image files:', matchedImageFiles);

          // 3. 用該檔名去我的 R2 bucket 抓出圖片原始檔案（bytes）
          const imageBytesList: { filename: string; bytes: number[] }[] = [];
          for (const imgFile of matchedImageFiles) {
            try {
              if (this.env.R2_BUCKET) {
                const r2Obj = await this.env.R2_BUCKET.get(imgFile);
                if (r2Obj) {
                  const buffer = await r2Obj.arrayBuffer();
                  const bytes = Array.from(new Uint8Array(buffer));
                  imageBytesList.push({ filename: imgFile, bytes });
                } else {
                  console.warn(`Image file ${imgFile} not found in R2 bucket`);
                }
              }
            } catch (r2Err) {
              console.error(`Error fetching ${imgFile} from R2:`, r2Err);
            }
          }

          // 4. 把「使用者問題 + 檢索到的文字內容 + 抓到的圖片」一起送給支援看圖的模型生成答案
          const promptContext = retrievedTexts.length > 0 
            ? `參考資料內容：\n${retrievedTexts.join('\n---\n')}\n\n`
            : '';
          const userPrompt = `問題：${body.text}\n\n${promptContext}請針對問題以及附上的圖片/參考資料進行詳細、完整且豐富的回答。若使用者有特定角色或情境設定（例如八隻腳外星人、特定領域問題等），請發揮創意並靈活結合參考資料與圖片知識，提供豐富、生動且結構化（清晰分段、條列與標題）的解答。`;

          let responseText = '';
          const visionModels = [
            "@cf/meta/llama-4-scout-17b-16e-instruct",
            "@cf/meta/llama-3.2-11b-vision-instruct"
          ];
          const textModels = [
            "@cf/meta/llama-3.3-70b-instruct",
            "@cf/meta/llama-3.1-8b-instruct",
            "@cf/openai/gpt-oss-120b"
          ];

          const extractText = (aiRes: any): string => {
            if (!aiRes) return '';
            let rawText = '';
            
            // 解析不同 AI 模型回傳的 JSON 結構
            if (typeof aiRes === 'string') {
              rawText = aiRes;
            } else if (typeof aiRes.response === 'string') {
              rawText = aiRes.response;
            } else if (typeof aiRes.output === 'string') {
              rawText = aiRes.output;
            } else if (typeof aiRes.description === 'string') {
              rawText = aiRes.description;
            } else if (aiRes.result && typeof aiRes.result.response === 'string') {
              rawText = aiRes.result.response;
            } else if (aiRes.choices && Array.isArray(aiRes.choices) && aiRes.choices[0]?.message?.content) {
              // 精準解析 OpenAI / GPT 相容格式的 choices[0].message.content，避免輸出 JSON 物件
              rawText = aiRes.choices[0].message.content;
            } else {
              rawText = JSON.stringify(aiRes);
            }

            // 若回傳字串本身是字串化的 JSON 物件（例如 {"choices":[...]}），進行二次解析提取內文
            if (typeof rawText === 'string' && rawText.trim().startsWith('{')) {
              try {
                const parsed = JSON.parse(rawText);
                if (parsed.choices && Array.isArray(parsed.choices) && parsed.choices[0]?.message?.content) {
                  rawText = parsed.choices[0].message.content;
                } else if (parsed.response && typeof parsed.response === 'string') {
                  rawText = parsed.response;
                }
              } catch (e) {
                // 非 JSON 格式時保持原樣
              }
            }

            // 清理與過濾後端標籤聲明與末尾贅字
            let cleaned = rawText
              .replace(/【?使用者提供的?】?[:：]?/g, '')
              .replace(/使用者提供的/g, '')
              .replace(/【?使用者問題】?[:：]?.*/gi, '')
              .replace(/【?圖片】?[:：]?\s*(無|無提供|未提供).*/gi, '')
              .replace(/【?參考資料】?[:：]?\s*(無|無提供|未提供).*/gi, '')
              .replace(/（?註[:：]?\s*圖片[\/\s]*參考資料皆無提供）?/gi, '')
              .replace(/\(註[:：]?\s*圖片[\/\s]*參考資料皆無提供\)/gi, '')
              .replace(/（?註[:：]?.*無提供.*）?/gi, '')
              .trim();

            return cleaned;
          };

          const systemPrompt = "你是一個專業且親切的圖片問答系統 AI 助手。請務必全程使用台灣繁體中文回答。請針對使用者的情境與問題提供豐富、詳細、結構化（善用標題與清單）且生動完整的解答，絕對不要輸出「【圖片】：無提供」等免責標籤。";

          if (imageBytesList.length > 0) {
            let visionSuccess = false;
            for (const vModel of visionModels) {
              try {
                console.log(`Trying vision model: ${vModel}`);
                const aiRes = await this.env.AI.run(vModel, {
                  prompt: `${systemPrompt}\n\n${userPrompt}`,
                  image: imageBytesList[0].bytes,
                  max_tokens: 4096
                });
                responseText = extractText(aiRes);
                if (responseText) {
                  visionSuccess = true;
                  break;
                }
              } catch (vErr) {
                console.warn(`Vision model ${vModel} failed:`, vErr);
              }
            }
            if (!visionSuccess) {
              for (const tModel of textModels) {
                try {
                  console.log(`Fallback to text model with images context: ${tModel}`);
                  const messages = [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                  ];
                  const aiRes = await this.env.AI.run(tModel, { messages, max_tokens: 4096 });
                  responseText = extractText(aiRes);
                  if (responseText) break;
                } catch (tErr) {
                  console.warn(`Text model ${tModel} failed:`, tErr);
                }
              }
            }
          } else {
            for (const tModel of textModels) {
              try {
                console.log(`Running text model: ${tModel}`);
                const messages = [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userPrompt }
                ];
                const aiRes = await this.env.AI.run(tModel, { messages, max_tokens: 4096 });
                responseText = extractText(aiRes);
                if (responseText) break;
              } catch (tErr) {
                console.warn(`Text model ${tModel} failed:`, tErr);
              }
            }
          }

          if (!responseText) {
            responseText = "抱歉，目前 AI 模型暫時無法回覆，請稍後再試。";
          }
  
          console.log('Final response text:', responseText);

          // 產生圖片 URL 供前端顯示
          const imageUrls = matchedImageFiles.map(fn => `/image/${encodeURIComponent(fn)}`);
  
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: responseText,
            timestamp: Date.now(),
            isAI: true,
            images: imageUrls
          };
  
          this.messages.push(aiMessage);
          await this.state.storage.put('messages', this.messages);
          
          return new Response(JSON.stringify({ 
            messages: [userMessage, aiMessage]
          }), {
            headers: { 'Content-Type': 'application/json' },
          });
        } catch (error: any) {
          console.error('Error getting AI response:', error);
          const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            text: `處理您的問題時發生錯誤：${error?.message || String(error)}`,
            timestamp: Date.now(),
            isAI: true
          };
          this.messages.push(aiMessage);
          try {
            await this.state.storage.put('messages', this.messages);
          } catch (e) {}

          return new Response(JSON.stringify({ messages: [userMessage, aiMessage] }), {
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