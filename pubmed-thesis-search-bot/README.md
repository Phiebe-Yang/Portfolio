# 🔬 PubMed BigQuery 醫學問答機器人

**🔗 Live Demo：[pubmed-thesis-search-bot.12400583.workers.dev](https://pubmed-thesis-search-bot.12400583.workers.dev)**

醫院實習期間開發的醫學文獻問答系統。透過 Google BigQuery 上的 PubMed 公開資料集查詢數百萬篇醫學研究論文，並由 LLM 依實際文獻內容生成有 PMID 引用依據的回答，協助快速掌握特定主題的研究現況。

> 本專案為醫院實習作品，僅供學習與作品展示使用。

## 功能

- **PubMed 文獻檢索**：透過 Google BigQuery 查詢大量醫學研究論文，例如：「請提供癌症免疫療法的最新文獻摘要」
- **AI 生成回答**：根據實際文獻內容生成專業回答，而非憑空生成
- **引用管理**：自動附上相關論文的 PMID 引用
- **對話式介面**：可針對查到的文獻持續追問

## 系統運作方式

1. 使用者提問後，Worker 將問題轉換為 BigQuery 查詢，搜尋 PubMed 公開資料集中的相關論文
2. 查到的論文摘要與中繼資料（PMID、標題等）作為上下文，交給 Workers AI 上的 LLM（`gpt-oss-120b`）
3. LLM 依實際文獻內容生成回答，並附上引用的 PMID，避免無依據的回答
4. Durable Objects 保存對話狀態，支援多輪追問

## 技術架構 (Cloudflare + Google Cloud)

| 元件 | 用途 |
|---|---|
| Cloudflare Workers | Serverless 後端 / API，同時提供線上 Demo |
| Durable Objects | 對話狀態管理 |
| Workers AI | 模型推論（`@cf/openai/gpt-oss-120b`） |
| AutoRAG | 檢索增強生成 |
| Google BigQuery | PubMed 公開資料集查詢 |

前端：React 18 + TypeScript + Emotion（CSS-in-JS）+ esbuild 打包

核心程式：
```
src/
├── index.ts            # Worker 主入口與路由
├── chatState.ts         # Durable Object，對話狀態管理
├── client.tsx            # React 前端
└── pubmedBigQuery.ts     # PubMed BigQuery 查詢客戶端
```

## 本機開發 / 部署

```bash
npm install
npm run dev      # 本機開發
npm run build    # 打包前端
```

### 設定 Google BigQuery

1. 在 [Google Cloud Console](https://console.cloud.google.com) 建立服務帳戶並啟用 BigQuery API
2. 下載服務帳戶 JSON 金鑰
3. 設定 Wrangler secrets（**不要**把金鑰寫進程式碼或 commit 進 repo）：

```bash
wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
wrangler secret put PUBMED_BIGQUERY_PROJECT_ID
```

4. 部署：`npm run deploy`

更完整的設定步驟見 [PUBMED_SETUP.md](./PUBMED_SETUP.md)，快速上手範例見 [PUBMED_QUICK_START.md](./PUBMED_QUICK_START.md)。

## 已知限制與未來規劃

- BigQuery 查詢成本會隨使用量增加，正式上線前需評估用量與費用
- 目前查詢範圍為 PubMed 公開資料集摘要，未涵蓋全文內容
- 規劃：加入依期刊影響係數或發表年份排序的檢索選項

## 專案背景

本專案透過 `git clone` [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（示範如何用 Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的開源範例）為起點，在醫院實習期間加入 PubMed BigQuery 文獻檢索功能，改造為醫學文獻問答用途。
