# 🖼️ 感官衛教海報問答機器人 (Sensory Care Poster QA Bot)

醫院實習期間開發的圖片衛教問答系統。將病房張貼的感官照護衛教海報數位化，讓病人與家屬可以直接針對海報內容用自然語言提問，取代「站在海報前自己找重點」。

> 本專案為醫院實習作品，僅供學習與作品展示使用。

## 功能

- 使用 LLM 進行衛教海報圖片內容分析
- 結合 Cloudflare AutoRAG 提供精準知識檢索與問答
- 對話式介面，可針對海報內容持續追問

## 資料來源

衛教海報圖片與內容由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。

## 技術架構 (Cloudflare)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API |
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

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間改造為衛教海報圖片問答用途。
