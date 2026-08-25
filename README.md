# 醫院實習作品集 — RAG 聊天機器人

醫院實習期間開發的一系列 RAG（檢索增強生成）聊天機器人與學習筆記，皆使用 Cloudflare Workers + AutoRAG 打造。

## 專案

| 專案 | 說明 |
|---|---|
| [medical-records-room-bot](./medical-records-room-bot) | 台大醫院病歷申請查詢 RAG 機器人 |
| [sensory-care-poster-bot](./sensory-care-poster-bot) | 感官衛教海報問答機器人 |
| [targeted-therapy-video-bot](./targeted-therapy-video-bot) | 頭頸癌標靶藥物治療影音 RAG 問答系統（影片時間點自動跳轉） |
| [pubmed-thesis-search-bot](./pubmed-thesis-search-bot) | PubMed BigQuery 醫學文獻問答機器人 |
| [rag-chatbot-guide](./rag-chatbot-guide) | RAG 機器人建置學習筆記與架構圖 |

## 專案背景

前 4 個聊天機器人都是以同一份開源範例 [chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss](https://github.com/elizabethsiegle/chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss)（Cloudflare Workers + AutoRAG 打造 RAG 聊天機器人的示範專案）`git clone` 後，依各自用途重新設計資料管線、前端介面與問答內容而成，個別修改內容與規模詳見各專案 README。

其中「病歷申請查詢」、「感官衛教海報」、「頭頸癌衛教影片」3 個專案所使用的資料（病歷申請規定、衛教海報、衛教影片），由 [@TeemoNTUH](https://github.com/TeemoNTUH) 提供。

「RAG 機器人建置學習筆記」記錄了整個學習與建置 RAG 系統的過程，是後續 4 個機器人共用的方法論基礎。
