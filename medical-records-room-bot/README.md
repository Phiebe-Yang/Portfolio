# 🏥 台大醫院病歷申請查詢 RAG 機器人

醫院實習期間開發的 AI 問答系統，讓民眾用自然語言詢問「病歷摘要/複製本申請」的相關規定與流程，取代翻閱冗長公告與 PDF 表單。系統會依據台大醫院官方公告與常見問答，透過 RAG（檢索增強生成）給出有依據的回答。

> 本專案為醫院實習作品，非台大醫院官方系統，僅供學習與作品展示使用。

## 功能

- 用中文自然語言提問病歷申請規定（如：「委託他人申請病歷需要準備什麼文件？」）
- 依申請情境（現場 / email / 傳真、保險公司調閱、英文證明書…）給出對應流程與所需文件
- 回答附上引用來源，避免模型憑空捏造
- 對話式介面，可追問細節

## 資料來源與知識庫建置

`data/` 內為台大醫院官方病歷申請相關公告、申請書格式與常見問答資料，由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供，經過整理轉換為 Markdown 後餵給 AutoRAG 建立知識庫：

- `data/org/` — 原始 PDF / HTML 公告（官方申請書、規定）
- `data/fin/`、`data/type/`、`data/normal/`、`data/Q&A/`、`data/same/` — 整理後的 Markdown 知識庫內容與問答集
- `pdf_md.py` — 用 `pymupdf4llm` 批次將 PDF 公告轉成 Markdown
- `upload-docs.ps1` / `upload_docs.py` — 將整理好的 Markdown 批次上傳到 Cloudflare R2，供 AutoRAG 索引

## 技術架構 (Cloudflare)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API |
| Durable Objects | 對話狀態管理 |
| R2 Storage | 知識庫文件儲存 |
| Workers AI | 模型推論（`@cf/openai/gpt-oss-120b`） |
| AutoRAG | 檢索增強生成 |
| Browser Rendering | 擷取台大醫院公告內容 |

前端：React 18 + TypeScript + Emotion（CSS-in-JS）+ esbuild 打包

## 本機開發 / 部署

```bash
npm install
npm install --save-dev esbuild @types/react @types/react-dom

wrangler login

# 建立知識庫儲存空間，並上傳整理好的資料
wrangler r2 bucket create ntuh-rag-articles
wrangler r2 object put ntuh-rag-articles/faq.txt --file ./path/to/faq.txt

# 到 Cloudflare Dashboard 設定 AutoRAG，來源指向 ntuh-rag-articles

npm run build
wrangler deploy
```

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間重新設計資料管線、前端介面與問答內容，改造為病歷申請查詢用途。資料由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。
