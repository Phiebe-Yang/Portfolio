# PubMed BigQuery QA 機器人 - 快速入門指南

## 🚀 快速開始

### 1. 本地開發

```bash
# 安裝依賴項
npm install

# 啟動開發服務器
npm run dev

# 構建前端資源
npm run build
```

### 2. 配置 Google API

#### 簡要步驟：
1. 在 [Google Cloud Console](https://console.cloud.google.com) 創建服務帳戶
2. 下載 JSON 密鑰文件
3. 啟用 BigQuery API
4. 配置 Wrangler 密鑰：

```bash
wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
# 粘貼 JSON 密鑰內容

wrangler secret put PUBMED_BIGQUERY_PROJECT_ID
# 輸入您的 Google Cloud 項目 ID
```

### 3. 部署

```bash
npm run deploy
```

## 📚 文件結構

```
src/
├── index.ts                 # Worker 主文件，路由處理
├── chatState.ts            # Durable Object，聊天狀態管理
├── client.tsx              # React 前端應用
├── pubmedBigQuery.ts       # PubMed BigQuery 客戶端
└── scrapegq.ts            # GQ 文章抓取

public/
├── index.html              # HTML 入口點
└── bundle.js              # 打包後的前端 (npm run build)
```

## 🔧 核心功能

### PubMedBigQueryClient (`src/pubmedBigQuery.ts`)

```typescript
// 創建客戶端
const client = new PubMedBigQueryClient(projectId, clientEmail, privateKey);

// 搜索文章
const articles = await client.searchArticles("COVID-19 vaccine", 10);

// 獲取文章詳情
const article = await client.getArticleDetails("12345678");

// 生成摘要
const summary = await client.generateSummaryResponse(articles, "What are the latest COVID-19 vaccines?");
```

### ChatState 更新 (`src/chatState.ts`)

新增的功能：
- 支持 PubMed 查詢模式
- 自動初始化 PubMed 客戶端
- 格式化 PubMed 上下文用於 AI 處理

### React 前端 (`src/client.tsx`)

功能：
- **雙模式界面**：在 Taylor & Travis 和 PubMed 研究之間切換
- **智能路由**：根據模式動態改變提示和 UI
- **實時聊天**：支持 PubMed 查詢

## 📖 使用示例

### 示例 1：問醫學問題

```
用戶: "What are the latest treatments for diabetes?"

系統：
1. 在 PubMed 中搜索相關文章
2. 返回 5-10 篇相關研究論文
3. AI 基於這些論文生成答案
4. 在聊天中展示相關文獻和 PMID
```

### 示例 2：查詢特定研究

```
用戶: "Tell me about CRISPR gene therapy developments"

系統：
1. 搜索 PubMed 的 CRISPR 基因療法論文
2. 提取摘要和關鍵信息
3. 使用 GPT-OSS-120B 生成專業解答
```

## 🛠️ 自定義和擴展

### 修改搜索查詢

在 `src/pubmedBigQuery.ts` 中修改 `buildSearchQuery` 方法：

```typescript
private buildSearchQuery(query: string, limit: number): string {
  const escapedQuery = query.replace(/'/g, "\\'");
  
  // 自定義您的 SQL 查詢
  return `
    SELECT ... FROM ...
    WHERE ... AND ...
  `;
}
```

### 添加自定義過濾器

```typescript
// 按日期過濾
WHERE pubdate > '2023-01-01'

// 按期刊過濾
WHERE journal LIKE '%Nature%' OR journal LIKE '%Science%'

// 按 MeSH 詞彙過濾
WHERE mesh_headings CONTAINS 'Vaccines'
```

### 集成其他 AI 模型

在 `src/chatState.ts` 中修改 AI 調用：

```typescript
// 替換模型
const response = await this.env.AI.run("@cf/meta/llama-2-7b", { messages });
```

## 💡 最佳實踐

1. **錯誤處理**
   ```typescript
   try {
     const results = await pubmedClient.searchArticles(query);
   } catch (error) {
     console.error('Search failed:', error);
     // 返回友好的錯誤消息
   }
   ```

2. **性能優化**
   - 緩存常見搜索結果
   - 限制 API 調用频率
   - 使用 Durable Objects 存儲會話

3. **成本管理**
   - 監控 BigQuery 查詢成本
   - 優化 SQL 查詢
   - 設置查詢結果限制

## 🐛 常見問題排查

### 問題：「PUBMED_BIGQUERY_CREDENTIALS 不存在」

**解決方案**：
```bash
wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
# 確保粘貼完整的 JSON 密鑰
```

### 問題：「BigQuery API 錯誤 401」

**解決方案**：
1. 檢查服務帳戶權限
2. 重新生成 JSON 密鑰
3. 確保項目 ID 正確

### 問題：搜索結果為空

**解決方案**：
1. 嘗試使用更通用的搜索詞
2. 檢查 PubMed 數據集是否可訪問
3. 查看 BigQuery 查詢日誌

## 📊 監控和調試

### 啟用詳細日誌

```bash
WRANGLER_LOG=debug npm run dev
```

### 檢查 Worker 日誌

```bash
wrangler tail --format json
```

### BigQuery 查詢成本

在 Google Cloud Console 中監控：
- **BigQuery** > **Jobs**
- 查看每個查詢的成本
- 優化高成本查詢

## 🎯 高級用法

### 自定義論文排序

修改 SQL 以按相關性排序：

```typescript
// 按引用次數排序
ORDER BY citation_count DESC

// 按發表日期排序
ORDER BY pubdate DESC

// 按相關性評分排序
ORDER BY relevance_score DESC
```

### 集成引文管理

```typescript
// 生成 BibTeX 引文
function generateBibTeX(article: PubMedArticle): string {
  return `@article{${article.pmid},
    title={${article.title}},
    journal={${article.journal}},
    year={${article.publication_date?.split('-')[0]}},
    authors={${article.authors?.join(' and ')}}
  }`;
}
```

### 多語言支持

在 `src/chatState.ts` 中：

```typescript
const systemMessage = usePubMed && pubmedResults
  ? `你是一位醫學研究助手。...` // 中文
  : `You are a medical research assistant...`; // 英文
```

## 📞 技術支持

遇到問題？查看：

1. [PUBMED_SETUP.md](./PUBMED_SETUP.md) - 詳細設置指南
2. [Google Cloud 文檔](https://cloud.google.com/docs)
3. [Cloudflare Workers 文檔](https://developers.cloudflare.com/workers/)
4. [PubMed API 文檔](https://www.ncbi.nlm.nih.gov/research/bionlm/)

## 🎉 成功標誌

當您看到以下情況時，表示安裝成功：

✅ 本地開發服務器運行（`npm run dev`）
✅ 前端編譯成功（`npm run build`）
✅ 能訪問主頁和 PubMed 演示頁面
✅ 聊天功能正常工作
✅ 部署成功（`npm run deploy`）

## 🚀 下一步

1. ✅ 完成基本設置
2. ✅ 配置 Google API
3. ✅ 測試本地開發
4. ✅ 部署到 Cloudflare Workers
5. ✅ 開始使用 PubMed QA 機器人！

祝您使用愉快！ 🔬📚
