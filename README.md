# 醫院實習作品集 — RAG 聊天機器人

醫院實習期間開發的一系列 RAG（檢索增強生成）聊天機器人與學習筆記，皆使用 Cloudflare Workers + AutoRAG 打造，並已部署上線。

## 專案

| 專案 | 說明 | Live Demo |
|---|---|---|
| [medical-records-room-bot](./medical-records-room-bot) | 台大醫院病歷申請查詢 RAG 機器人 | [開啟 →](https://medical-records-room-bot.12400583.workers.dev) |
| [sensory-care-poster-bot](./sensory-care-poster-bot) | 感官衛教海報問答機器人 | [開啟 →](https://sensory-care-poster-bot.12400583.workers.dev) |
| [targeted-therapy-video-bot](./targeted-therapy-video-bot) | 頭頸癌標靶藥物治療影音 RAG 問答系統（影片時間點自動跳轉） | [開啟 →](https://targeted-therapy-video-bot.12400583.workers.dev) |
| [pubmed-thesis-search-bot](./pubmed-thesis-search-bot) | PubMed BigQuery 醫學文獻問答機器人 | [開啟 →](https://pubmed-thesis-search-bot.12400583.workers.dev) |
| [rag-chatbot-guide](./rag-chatbot-guide) | RAG 機器人建置學習筆記與架構圖 | — |

## 專案背景

前 4 個聊天機器人都是以同一份開源範例 [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的示範專案）`git clone` 後，依各自用途重新設計資料管線、前端介面與問答內容而成，個別修改內容與規模詳見各專案 README。

其中「病歷申請查詢」、「感官衛教海報」、「頭頸癌衛教影片」3 個專案所使用的測試與合成資料（病歷申請規定、衛教海報、衛教影片），由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。

「RAG 機器人建置學習筆記」記錄了整個學習與建置 RAG 系統的過程，是後續 4 個機器人共用的方法論基礎。

## 共同技術架構

所有機器人皆採用相同的核心架構：Cloudflare Workers 作為 serverless 後端、Durable Objects 管理對話狀態、R2 儲存知識庫、Workers AI（`gpt-oss-120b`）負責生成回答、AutoRAG 負責檢索增強生成。前端使用 React 18 + TypeScript，esbuild 打包。各專案依用途在此基礎上加入不同的資料來源與功能（如圖片問答、影片時間點跳轉、BigQuery 文獻檢索等），詳見各自 README。
