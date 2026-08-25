# PubMed BigQuery QA 機器人設置指南

## 概述

這個項目現在支持通過 Google BigQuery API 查詢 PubMed 醫學文獻數據庫。用戶可以提出醫學研究問題，系統會自動從 PubMed 搜索相關文章，並使用 AI 生成基於這些文獻的答案。

## 功能

- **PubMed 搜索**：通過 Google BigQuery API 搜索 PubMed 數據庫
- **AI 問答**：使用 OpenAI GPT-OSS-120B 模型生成答案
- **文獻引用**：自動引用和展示相關的 PubMed 文章
- **雙模式界面**：支持 Taylor Swift/Travis Kelce 聊天和 PubMed 研究模式

## 前置要求

1. **Google Cloud 帳戶**
   - 訪問 [Google Cloud Console](https://console.cloud.google.com)
   - 啟用 BigQuery API
   - 創建服務帳戶並下載 JSON 密鑰

2. **Cloudflare 帳戶**
   - 具有 Workers 計劃的有效帳戶
   - Wrangler CLI 已安裝

3. **Node.js**
   - 版本 18 或更高版本

## 詳細設置步驟

### 步驟 1：設置 Google Cloud 認證

#### 1.1 創建服務帳戶

1. 前往 [Google Cloud Console](https://console.cloud.google.com)
2. 選擇或創建一個項目
3. 在左側菜單中，選擇 **IAM & Admin** > **Service Accounts**
4. 點擊 **Create Service Account**
5. 填寫以下信息：
   - **Service account name**: `pubmed-bigquery-bot`
   - **Service account ID**: 自動填充
   - **Description**: PubMed BigQuery QA Bot

#### 1.2 添加角色權限

1. 在服務帳戶創建後，點擊它
2. 進入 **Permissions** 選項卡
3. 點擊 **Grant Access**
4. 為以下角色授予權限：
   - `BigQuery Data Editor`
   - `BigQuery User`

#### 1.3 創建 JSON 密鑰

1. 在服務帳戶詳情頁面，進入 **Keys** 選項卡
2. 點擊 **Add Key** > **Create new key**
3. 選擇 **JSON** 格式
4. 下載並安全保存此文件

### 步驟 2：啟用 BigQuery API

1. 在 Google Cloud Console 中
2. 使用搜索框找到 **BigQuery API**
3. 點擊 **Enable**

### 步驟 3：配置 Cloudflare Wrangler

#### 3.1 將 Google 認證信息添加為密鑰

```bash
# 首先，將 JSON 文件內容複製到剪貼板
# 然後運行以下命令

wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
# 粘貼整個 JSON 密鑰文件內容，然後按 Ctrl+D (或 Cmd+D)

wrangler secret put PUBMED_BIGQUERY_PROJECT_ID
# 輸入您的 Google Cloud 項目 ID
```

#### 3.2 更新 wrangler.jsonc

確保您的 `wrangler.jsonc` 包含以下配置：

```json
{
  "env": {
    "production": {
      "vars": {
        "PUBMED_QUERY_MODE": "true"
      },
      "secrets": [
        "PUBMED_BIGQUERY_CREDENTIALS",
        "PUBMED_BIGQUERY_PROJECT_ID"
      ]
    },
    "development": {
      "vars": {
        "PUBMED_QUERY_MODE": "false"
      }
    }
  }
}
```

### 步驟 4：安裝依賴項

```bash
npm install
npm install --save-dev esbuild @types/react @types/react-dom
```

### 步驟 5：構建和部署

```bash
# 本地測試
npm run dev

# 構建前端
npm run build

# 部署到 Cloudflare Workers
npm run deploy
```

## 使用方式

### 訪問應用

部署後，訪問您的 Worker URL：

1. **主頁** (Taylor & Travis 聊天)：`https://your-worker-url.workers.dev/`
2. **PubMed QA 演示**：`https://your-worker-url.workers.dev/pubmed`
3. **PubMed 聊天**：使用主頁上的 🔬 PubMed Research 標籤

### 示例問題

在 PubMed 模式中，您可以提出以下類型的問題：

- "What are the latest studies on COVID-19 vaccines?"
- "Tell me about CRISPR gene therapy recent developments"
- "Summarize current research on cancer immunotherapy"
- "What are the recent findings on neurodegenerative diseases?"

## 架構

### 後端組件

1. **`src/pubmedBigQuery.ts`**
   - `PubMedBigQueryClient` 類：處理 BigQuery 查詢
   - 搜索和獲取文章詳情的方法
   - OAuth 2.0 認證邏輯

2. **`src/chatState.ts`**
   - 更新的 `ChatState` Durable Object
   - PubMed 集成支持
   - 上下文管理

3. **`src/index.ts`**
   - PubMed 演示頁面路由
   - 新的 `/pubmed` 端點
   - HTML UI 生成

### 前端組件

1. **`src/client.tsx`**
   - 雙模式聊天界面
   - PubMed/Taylor & Travis 切換
   - 實時消息渲染

## API 端點

| 端點 | 方法 | 描述 |
|------|------|------|
| `/chat/init` | POST | 初始化聊天會話 |
| `/chat/{id}` | GET | 獲取聊天消息歷史 |
| `/chat/{id}` | POST | 發送消息（支持 `usePubMed` 參數） |
| `/chat/{id}` | DELETE | 清除聊天歷史 |
| `/pubmed` | GET | PubMed 演示頁面 |

## 環境變量

| 變量 | 類型 | 描述 |
|------|------|------|
| `PUBMED_BIGQUERY_CREDENTIALS` | Secret | Google 服務帳戶 JSON 密鑰 |
| `PUBMED_BIGQUERY_PROJECT_ID` | Secret | Google Cloud 項目 ID |
| `PUBMED_QUERY_MODE` | Var | 啟用/禁用 PubMed 功能 (true/false) |

## 常見問題

### Q: 我收到 "BigQuery API error" 怎麼辦？

A: 確保：
1. 在 Google Cloud Console 中啟用了 BigQuery API
2. 服務帳戶有正確的權限（BigQuery Data Editor, BigQuery User）
3. 項目 ID 正確

### Q: 搜索返回很少或沒有結果

A: 
1. 檢查 PubMed 數據集是否可訪問
2. 確保查詢語法正確
3. 嘗試使用更通用的搜索詞

### Q: 如何在開發中禁用 PubMed？

A: 在 `wrangler.jsonc` 中設置 `PUBMED_QUERY_MODE` 為 `false`：
```json
{
  "env": {
    "development": {
      "vars": {
        "PUBMED_QUERY_MODE": "false"
      }
    }
  }
}
```

## 安全考慮

1. **密鑰管理**：永遠不要在代碼中硬編碼 Google 認證信息
2. **速率限制**：BigQuery 有配額限制，監控使用情況
3. **成本**：BigQuery 查詢可能會產生費用，設置 Google Cloud 預算警報

## 故障排除

### 部署失敗

```bash
# 清理並重新安裝
rm -rf node_modules package-lock.json
npm install

# 檢查 Wrangler 配置
wrangler publish --dry-run
```

### 本地開發問題

```bash
# 啟用詳細日誌
WRANGLER_LOG=debug npm run dev

# 檢查類型
npm run cf-typegen
```

## 技術棧

- **後端**：Cloudflare Workers + Durable Objects
- **AI**：OpenAI GPT-OSS-120B on Workers AI
- **數據**：Google BigQuery + PubMed
- **前端**：React 18 + Emotion CSS-in-JS
- **構建**：esbuild + TypeScript
- **部署**：Wrangler

## 下一步

1. **自定義搜索**：修改 `pubmedBigQuery.ts` 中的 SQL 查詢
2. **增強上下文**：添加 MeSH 詞彙或其他元數據
3. **多語言支持**：擴展 UI 以支持更多語言
4. **緩存優化**：在 Durable Objects 中實現文章緩存

## 參考資源

- [PubMed BigQuery 文檔](https://www.ncbi.nlm.nih.gov/research/bionlm/APIs/BioC-PubMed/Server/)
- [Google BigQuery 文檔](https://cloud.google.com/bigquery/docs)
- [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
- [Cloudflare Durable Objects](https://developers.cloudflare.com/durable-objects/)

## 許可

本項目基於原始的 Taylor Swift/Travis Kelce 聊天項目進行擴展。
