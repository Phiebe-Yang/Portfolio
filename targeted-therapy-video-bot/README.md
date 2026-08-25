# 🎬 頭頸癌標靶藥物治療 - 影音 RAG 智慧問答系統

醫院實習期間開發的衛教影片問答系統。病人或家屬觀看《頭頸癌標靶藥物治療》衛教影片時，可直接用自然語言提問（如副作用、藥物種類、作用機制），系統會結合逐字稿內容準確回答，並**自動將影片跳轉到最相關的字幕時間點**，不必整支影片重看一遍找答案。

> 本專案為醫院實習作品，僅供學習與作品展示使用。影片內容為衛教用途，非醫療建議。

## 功能

- 影片 + 逐字稿同步播放，AI 回答後自動跳轉到對應時間點
- 針對標靶治療常見問題提供衛教助理式回答（副作用、藥物種類、適用階段、與化療的差異等）
- 對話式介面，可持續追問

## 資料來源與逐字稿處理流程

原始衛教影片由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。`mp4_to_transcript.py`、`update_transcript.py`、`update_transcript_v2.py` 是將影片轉成可檢索逐字稿、並切分成有時間戳的段落供前端跳轉使用的工具：

- `mp4_to_transcript.py` — 用 `faster-whisper` 將影片轉成逐字稿（`.srt` + `.txt`）
- `update_transcript.py` / `update_transcript_v2.py` — 將逐字稿依內容切分為有標題、起訖秒數的段落（`src/transcriptData.ts`），供前端點選/跳轉使用

> 影片原始檔（`頭頸癌標靶治療指南.mp4`，約 38MB）未包含在此 repo 中；如需展示，建議另外上傳到 YouTube（可設不公開）或雲端硬碟，並在此 README 附上連結。

## 技術架構 (Cloudflare)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API |
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

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間改造為衛教影片逐字稿問答用途，並加入影片時間點自動跳轉功能。
