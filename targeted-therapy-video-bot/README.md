# 🎬 頭頸癌標靶藥物治療 - 影音 RAG 智慧問答系統

**🔗 Live Demo：[targeted-therapy-video-bot.12400583.workers.dev](https://targeted-therapy-video-bot.12400583.workers.dev)**

醫院實習期間開發的衛教影片問答系統。病人或家屬觀看《頭頸癌標靶藥物治療》衛教影片時，可直接用自然語言提問，系統會結合逐字稿內容準確回答，並**自動將影片跳轉到最相關的字幕時間點**，不必整支影片重看一遍找答案。

> 本專案為醫院實習作品，僅供學習與作品展示使用。影片內容為衛教用途，非醫療建議。

## 功能

- 影片 + 逐字稿同步播放，AI 回答後自動跳轉到對應時間點
- 針對標靶治療常見問題提供衛教助理式回答，例如：
  - 標靶治療常見的副作用有哪些？
  - 頭頸癌在什麼階段適合進行標靶治療？
  - 標靶治療與傳統化學治療有什麼不同？
  - 標靶治療會影響哪些身體器官或功能？
- 對話式介面，可持續追問

## 系統運作方式

1. 衛教影片先用 `faster-whisper` 轉成逐字稿，再依內容切分成有時間戳的段落
2. 逐字稿段落上傳到 Cloudflare R2，由 AutoRAG 建立索引
3. 使用者提問時，AutoRAG 檢索最相關的段落，交給 Workers AI 上的 LLM（`gpt-oss-120b`）生成回答
4. 前端依回答所引用的段落時間戳，自動將影片播放進度跳轉到對應位置

## 逐字稿處理流程

測試與合成資料由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。以下工具用於將影片轉成可檢索逐字稿：

- `mp4_to_transcript.py` — 用 `faster-whisper` 將影片轉成逐字稿（`.srt` + `.txt`）
- `update_transcript.py` / `update_transcript_v2.py` — 將逐字稿依內容切分為有標題、起訖秒數的段落（`src/transcriptData.ts`），供前端點選/跳轉使用

> 影片原始檔（`頭頸癌標靶治療指南.mp4`，約 38MB）未包含在此 repo 中；歡迎直接透過上方 Live Demo 觀看。

## 技術架構 (Cloudflare)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API，同時提供線上 Demo |
| Durable Objects | 對話狀態管理 |
| R2 Storage | 逐字稿與衛教資料儲存 |
| Workers AI | 模型推論（`@cf/openai/gpt-oss-120b`） |
| AutoRAG | 檢索增強生成 |

前端：React 18 + TypeScript + Emotion（CSS-in-JS）+ esbuild 打包

## 本機開發 / 部署

```bash
npm install

wrangler login

wrangler r2 bucket create head-neck-video-rag
# 上傳逐字稿 / 衛教資料到 R2，並在 Cloudflare Dashboard 設定 AutoRAG 指向該 bucket

npm run build
wrangler deploy
```

## 已知限制與未來規劃

- 逐字稿時間戳段落目前為手動切分，影片較長時需人工核對切點是否合理
- 規劃：支援多支衛教影片，並讓使用者提問時可跨影片查找相關段落

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間改造為衛教影片逐字稿問答用途，並加入影片時間點自動跳轉功能。
