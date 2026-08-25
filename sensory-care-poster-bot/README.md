# 🖼️ 感官衛教海報問答機器人 (Sensory Care Poster QA Bot)

**🔗 Live Demo：[sensory-care-poster-bot.12400583.workers.dev](https://sensory-care-poster-bot.12400583.workers.dev)**

醫院實習期間開發的圖片衛教問答系統。將病房張貼的感官照護衛教海報數位化，讓病人與家屬可以直接針對海報內容用自然語言提問，取代「站在海報前自己找重點」。

> 本專案為醫院實習作品，僅供學習與作品展示使用。

## 功能

- 使用 LLM 進行衛教海報圖片內容分析，例如：「請輸入關於圖片或圖像內容的問題」
- 結合 Cloudflare AutoRAG 提供精準知識檢索與問答
- 對話式介面，可針對海報內容持續追問

## 系統運作方式

1. 衛教海報圖片與對應說明文字上傳到 Cloudflare R2
2. Cloudflare AutoRAG 對圖片內容與說明文字建立索引
3. 使用者提問時，AutoRAG 檢索最相關的內容，交給 Workers AI 上的 LLM（`gpt-oss-120b`）生成回答
4. Durable Objects 保存對話狀態，支援多輪追問

## 資料來源

測試與合成資料由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。

## 技術架構 (Cloudflare)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API，同時提供線上 Demo |
| Durable Objects | 對話狀態管理 |
| R2 Storage | 圖片與衛教文件儲存 |
| Workers AI | 模型推論（`@cf/openai/gpt-oss-120b`） |
| AutoRAG | 檢索增強生成 |
| Browser Rendering | 內容擷取 |

前端：React 18 + TypeScript + Emotion（CSS-in-JS）+ esbuild 打包

## 本機開發 / 部署

```bash
npm install

wrangler login

# 建立知識庫儲存空間，存放衛教海報圖片與說明文字
wrangler r2 bucket create image-qa-bucket

# 到 Cloudflare Dashboard 設定 AutoRAG，來源指向 image-qa-bucket

npm run build
wrangler deploy
```

## 已知限制與未來規劃

- 目前針對單張海報內容問答，尚未支援跨多張海報的比較式提問
- 規劃：加入更多科別的衛教海報，擴充知識庫覆蓋範圍

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間改造為衛教海報圖片問答用途。
