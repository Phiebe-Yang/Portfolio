# PubMed BigQuery QA 機器人 - 對話紀錄與執行歷程全紀錄

本檔案詳細記錄了您與 AI 助手（GitHub Copilot）在此次開發對話中的所有需求、討論、排錯過程、代碼修改與最終部署成果。

---

## 📅 開發日期
**2026年8月17日**

---

## 項目簡介
* **專案名稱**：`pubmed-bigquery-qa-bot` (原 `taylor-newheights-rag`)
* **核心技術**：Cloudflare Workers, Durable Objects, Workers AI (`@cf/openai/gpt-oss-120b`), Google BigQuery API, React, TypeScript, esbuild, `marked` Markdown 解析器
* **線上部署網址**：[https://pubmed-bigquery-qa-bot.12400583.workers.dev](https://pubmed-bigquery-qa-bot.12400583.workers.dev)

---

## 💬 對話歷程與執行任務總覽

### 1. 初始需求：撰寫 PubMed BigQuery 問答 QA 機器人
* **使用者需求**：撰寫一個 QA 機器人，串接 Google API，提供 PubMed BigQuery 問答。
* **執行動作**：
  - 檢視現有 Cloudflare Workers 專案架構。
  - 建立 `src/pubmedBigQuery.ts`：實現 Google BigQuery API 查詢、OAuth 2.0 認證與 JWT 簽署。
  - 更新 `src/chatState.ts`：整合 PubMed 檢索結果至 AI 上下文 (Context) 中。
  - 更新 `wrangler.jsonc`：加入環境變數與安全密鑰設定。
  - 建立前後端網頁與專案說明文件 (`PUBMED_SETUP.md`, `PUBMED_QUICK_START.md`, `setup-pubmed.sh`, `setup-pubmed.bat`)。

---

### 2. 專案部署與基礎設施設定
* **使用者需求**：部屬專案。
* **執行動作**：
  - 執行 `npm install` 與 `npm run build` 打包前端檔案。
  - 建立 Cloudflare R2 Bucket (`taylor-rag-articles`)。
  - 修正 Wrangler SQLite 遷移設定（將 `new_classes` 改為 `new_sqlite_classes`）以相容免費版 Durable Objects。
  - 成功執行 `npx wrangler deploy` 完成初次部署。

---

### 3. Google Cloud 安全政策排錯與認證升級
* **問題背景**：使用者在 GCP 建立服務帳戶時跳出錯誤 `iam.disableServiceAccountKeyCreation`（組織政策禁止建立服務帳戶 JSON 金鑰）。
* **執行動作**：
  - 升級 `src/pubmedBigQuery.ts` 認證模組：除了 Service Account JWT 之外，新增支援 **OAuth 2.0 Client ID + Refresh Token** 認證。
  - 引導使用者設定 GCP OAuth 同意畫面、建立 Web 應用程式憑證，並透過 Google OAuth Playground 取得 `refresh_token`。
  - 協助排錯 `redirect_uri_mismatch` 與 `403: access_denied`（將使用者 email 加進 GCP 測試人員清單）。
  - 取得憑證後，成功寫入 Cloudflare Secret：
    ```bash
    npx wrangler secret put PUBMED_BIGQUERY_PROJECT_ID
    npx wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
    ```

---

### 4. 介面視覺與主題改造（移除 Emoji、改為 PubMed 主題）
* **使用者需求**：把網頁改成跟 PubMed BigQuery 問答有關的，然後不要有任何 emoji。
* **執行動作**：
  - 修改 `src/client.tsx` 與 `src/index.ts`，將主題由美式足球/流行音樂主題全數改為專業醫學生醫數據庫風格。
  - 移除首頁、對話框、載入畫面、按鈕及頁尾的所有 Emoji 符號。
  - 替換 `public/index.html` 中的 Favicon 圖示與標題。

---

### 5. AI 回答格式修正（解析 JSON 回應、版面簡化、專案重命名）
* **使用者需求**：網址名稱改一下，把圖一（簡介卡片）刪除，圖二（JSON 回應）改成能看得懂的回答。
* **執行動作**：
  - **重命名專案**：在 `wrangler.jsonc` 中將專案名稱改為 `pubmed-bigquery-qa-bot`，並重新發布 Secret。
  - **刪除頂部卡片**：在 `client.tsx` 中徹底移除頂部 Intro 卡片區塊。
  - **修復 JSON 輸出**：修改 `chatState.ts` 與 `client.tsx` 中的 AI 回應解析函數，精準提取 `choices[0].message.content` 文字內容，不再呈現原始 JSON。

---

### 6. Markdown 格式化、表格渲染與 Token 上限調整
* **使用者需求**：希望 Markdown `##文字` `**文字**` 能轉為粗體或正確格式，表格也要呈現表格；將 AI 回答最大 Token 上限提高至 10000，避免表格截斷。
* **執行動作**：
  - 安裝 `marked` npm 套件。
  - 在 `client.tsx` 中加入 `renderMarkdownHTML()` 函數，結合 `dangerouslySetInnerHTML` 渲染標準 HTML。
  - 新增表格 (`<table>`)、標頭 (`<h1>-<h3>`)、清單 (`<ul>/<ol>`) 等 CSS 樣式與橫向滾動條。
  - 將 `src/chatState.ts` 中的 AI 調用參數 `max_tokens` 調高至 `10000`。

---

### 7. DOI / PMID 超連結修復與重複連結去重
* **使用者需求**：DOI 不能點；DOI 與 PMID 會重複；網址不完整/多包文字。
* **排錯與修正**：
  - **防止重複嵌套**：實作 **佔位符保護機制 (Placeholder Mechanism)**，在轉鏈前先將現有的 Markdown 超連結保護，避免次與重複匹配（例如 `DOI: DOI:` 或 `[DOI: ...](url)` 嵌套）。
  - **完整抓取複雜 DOI**：修復正則表達式與括號對稱計數，完整支援如 `10.1016/S2352-3026(2200123-4)` 等帶有括號的複雜 DOI。
  - **保護普通網址**：確保如 `https://meshb.nlm.nih.gov` 等常規網址不會被誤切或多包中文字。

---

### 8. AI 回答簡潔性與作者清單優化
* **使用者需求**：回答精簡且正確，不要多補充東西；作者要列全；參考文獻請簡單但正式表示。
* **執行動作**：
  - **System Prompt 優化**：要求 AI 回答必須直奔主題，禁止無關廢話與過度延伸。
  - **作者數簡化**：在資料傳給 AI 前，超過 3 位的作者自動收合為 `前 3 位作者 et al.`，防止上百位作者展開擠爆版面。
  - **參考文獻格式**：指示 AI 採用學術格式表示（例如：`第一作者 等, 期刊名, 年份 (PMID: xxx / DOI: yyy)`）。

---

### 9. 手機版行動裝置響應式設計 (Mobile RWD)
* **使用者需求**：請幫我做好手機板的 RWD 的排版與按鈕跟字體大小。
* **執行動作**：
  - **防 iOS 自動放大**：設定輸入框字體為 `16px`。
  - **按鈕防擠壓**：設定按鈕 `white-space: nowrap` 與 `flex-shrink: 0`。
  - **行動端字體與間距**：加入 `@media (max-width: 640px)` 媒體查詢，縮小 Mobile 標題與對話框 Padding。

---

## 🛠️ 最終專案架構說明

```
chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss/
├── public/
│   ├── index.html               # 乾淨無 Emoji 的 HTML 入口點
│   └── bundle.js                # esbuild 打包後的前端 Bundle
├── src/
│   ├── index.ts                 # Cloudflare Worker 主進入點、靜態資源路由
│   ├── chatState.ts            # Durable Object 聊天狀態管理與 AI 提示詞控制
│   ├── client.tsx              # React 前端元件、Markdown 渲染、RWD 樣式
│   └── pubmedBigQuery.ts       # PubMed BigQuery 檢索模組 (支援 JWT 與 OAuth2)
├── wrangler.jsonc               # Worker 設定檔 (pubmed-bigquery-qa-bot)
├── package.json                 # 專案套件依賴 (包含 marked, react, emotion 等)
├── CONVERSATION_AND_ACTION_LOG.md# 本紀錄檔
├── PUBMED_SETUP.md              # 詳細設定指南
└── PUBMED_QUICK_START.md        # 快速入門指南
```

---

## 🚀 最新線上存取資訊

* **專案 Worker 名稱**：`pubmed-bigquery-qa-bot`
* **正式營運網址**：[https://pubmed-bigquery-qa-bot.12400583.workers.dev](https://pubmed-bigquery-qa-bot.12400583.workers.dev)

---
*本記錄檔已成功生成於專案根目錄下的 `CONVERSATION_AND_ACTION_LOG.md`。*
