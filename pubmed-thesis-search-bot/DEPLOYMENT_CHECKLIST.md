# PubMed BigQuery QA 機器人 - 部署檢查清單

## ✅ 實現完成清單

### 核心功能
- [x] PubMed BigQuery 客戶端實現 (`src/pubmedBigQuery.ts`)
- [x] ChatState Durable Object 集成
- [x] 雙模式聊天界面 (Taylor & Travis + PubMed)
- [x] PubMed 搜索和結果展示
- [x] AI 驅動的答案生成
- [x] 文獻引用和 PMID 展示

### 文件更新
- [x] `src/chatState.ts` - PubMed 集成
- [x] `src/index.ts` - PubMed 演示頁面和路由
- [x] `src/client.tsx` - 雙模式 UI 切換
- [x] `wrangler.jsonc` - 環境配置

### 新增文件
- [x] `src/pubmedBigQuery.ts` - BigQuery 客戶端 (~350 行)
- [x] `PUBMED_SETUP.md` - 詳細設置指南
- [x] `PUBMED_QUICK_START.md` - 快速入門指南
- [x] `PROJECT_SUMMARY.md` - 實現摘要
- [x] `setup-pubmed.sh` - Linux/Mac 設置腳本
- [x] `setup-pubmed.bat` - Windows 設置腳本
- [x] `DEPLOYMENT_CHECKLIST.md` - 本文件

### 文檔和指南
- [x] README.md 更新
- [x] 完整的 API 文檔
- [x] 故障排除指南
- [x] 安全最佳實踐

---

## 🚀 部署前準備

### 1. 環境準備
```bash
# 檢查 Node.js 版本 (需要 18+)
node --version

# 檢查 npm
npm --version

# 全局安裝 Wrangler
npm install -g wrangler

# 驗證 Wrangler
wrangler --version
```

### 2. Google Cloud 設置

#### 2.1 創建 Google Cloud 項目
```bash
# 訪問 Google Cloud Console
# https://console.cloud.google.com

# 創建新項目或選擇現有項目
# 記下項目 ID (例: my-pubmed-project)
```

#### 2.2 設置服務帳戶
```bash
# 在 Google Cloud Console 中:
# 1. IAM & Admin > Service Accounts
# 2. Create Service Account
# 3. 名稱: pubmed-bigquery-bot
# 4. Grant Roles:
#    - BigQuery Data Editor
#    - BigQuery User
# 5. Create Key > JSON
# 6. 下載並保存 JSON 文件
```

#### 2.3 啟用 BigQuery API
```bash
# 在 Google Cloud Console 中:
# 1. 搜索 "BigQuery API"
# 2. 點擊 "Enable"
```

### 3. Cloudflare 設置

#### 3.1 Cloudflare 帳戶
```bash
# 登錄 Wrangler
wrangler login

# 驗證登錄
wrangler whoami
```

#### 3.2 配置 Wrangler
```bash
# 檢查 wrangler.jsonc 配置
cat wrangler.jsonc

# 確保包含以下配置:
# - ai binding
# - browser binding
# - r2_buckets
# - env.production 和 env.development
```

---

## 📦 部署步驟

### 步驟 1: 安裝依賴項

```bash
# 進入項目目錄
cd chat-w-taylor-on-newheights-and-travis-gq-autorag-openaioss

# 安裝依賴項
npm install

# 安裝開發依賴項
npm install --save-dev esbuild @types/react @types/react-dom
```

### 步驟 2: 配置密鑰

```bash
# 方法 1: 自動設置 (推薦)
# Linux/Mac
bash setup-pubmed.sh

# Windows
setup-pubmed.bat

# 方法 2: 手動設置
wrangler secret put PUBMED_BIGQUERY_PROJECT_ID
# 輸入您的 Google Cloud 項目 ID，然後按 Ctrl+D

wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
# 打開下載的 JSON 文件，複製內容，粘貼，然後按 Ctrl+D
```

### 步驟 3: 構建前端

```bash
npm run build

# 驗證構建
ls -la public/bundle.js
```

### 步驟 4: 本地測試 (可選)

```bash
# 啟動開發服務器
npm run dev

# 訪問 http://localhost:8787

# 測試 Taylor & Travis 聊天
# 測試 PubMed QA 機器人 (訪問 /pubmed)

# 停止服務器
# Ctrl+C
```

### 步驟 5: 部署到 Cloudflare

```bash
# 部署到生產環境
npm run deploy

# 驗證部署
wrangler deployments list

# 查看您的 Worker URL (例如: https://taylor-newheights-rag.your-account.workers.dev)
```

### 步驟 6: 驗證部署

```bash
# 訪問您的 Worker:
# 1. 主頁: https://your-worker-url.workers.dev
# 2. PubMed 演示: https://your-worker-url.workers.dev/pubmed
# 3. 聊天功能: 測試雙模式切換

# 檢查日誌
wrangler tail

# 測試 Taylor & Travis 模式
# 測試 PubMed 搜索功能
```

---

## 🔐 安全檢查

### 生產部署前

- [ ] 確認密鑰已正確設置
  ```bash
  wrangler secret list
  # 應顯示: PUBMED_BIGQUERY_CREDENTIALS, PUBMED_BIGQUERY_PROJECT_ID
  ```

- [ ] 驗證環境變量
  ```bash
  # wrangler.jsonc 應包含:
  grep -A 5 "env.*production" wrangler.jsonc
  ```

- [ ] 檢查 Google Cloud IAM 權限
  ```bash
  # 在 Google Cloud Console 驗證服務帳戶具有:
  # - BigQuery Data Editor
  # - BigQuery User
  ```

- [ ] 設置 BigQuery 配額
  ```bash
  # 在 Google Cloud Console:
  # 1. BigQuery > Admin > Project Settings
  # 2. 設置最大查詢字節數限制
  # 3. 設置最大月度查詢成本
  ```

- [ ] 啟用日誌記錄
  ```bash
  # wrangler.jsonc:
  # "observability": { "enabled": true }
  ```

---

## 🧪 測試檢查清單

### 單元測試

```bash
# 運行現有測試
npm run test

# 查看測試覆蓋率
npm run test -- --coverage
```

### 集成測試

```bash
# 本地測試所有功能
npm run dev

# 測試項目:
# 1. [ ] 主頁加載
# 2. [ ] 初始化聊天
# 3. [ ] Taylor & Travis 模式
#    - 發送消息
#    - 接收 AI 響應
#    - 查看消息歷史
# 4. [ ] PubMed 模式
#    - 切換到 PubMed
#    - 發送醫學問題
#    - 查看 PubMed 結果 (如果配置)
#    - 查看 AI 響應
# 5. [ ] 清除聊天
# 6. [ ] 訪問 /pubmed 演示頁面
# 7. [ ] 訪問 /transcript 和 /gq-article
```

### 生產驗證

```bash
# 部署後測試
curl https://your-worker-url.workers.dev/

# 測試聊天端點
curl -X POST https://your-worker-url.workers.dev/chat/init \
  -H "Content-Type: application/json"

# 測試 PubMed 頁面
curl https://your-worker-url.workers.dev/pubmed | head -20
```

---

## 📊 性能監控

### 監控指標

```bash
# 查看 Worker 統計信息
wrangler analytics --json

# 監視實時日誌
wrangler tail --format json | jq '.logs'

# 檢查錯誤
wrangler tail --format json | jq '.outcomes[] | select(.status != "ok")'
```

### 成本估算

1. **Cloudflare Workers**
   - 免費層: 100,000 請求/天
   - 付費層: $5/百萬請求

2. **Google BigQuery**
   - 免費層: 1TB 查詢/月
   - 按需: $6.25 per TB

3. **估算每月成本** (中等使用)
   - Workers: $5-10
   - BigQuery: $10-20
   - **總計: $15-30/月**

---

## 🆘 故障排除

### 部署失敗

#### 錯誤: "wrangler: command not found"

```bash
# 全局安裝 Wrangler
npm install -g wrangler

# 驗證安裝
wrangler --version
```

#### 錯誤: "Authentication failed"

```bash
# 重新登錄 Cloudflare
wrangler login

# 檢查認證狀態
wrangler whoami
```

#### 錯誤: "Invalid wrangler.jsonc"

```bash
# 驗證 JSON 格式
cat wrangler.jsonc | jq .

# 檢查語法
npm run build 2>&1 | grep -i error
```

### 運行時錯誤

#### PubMed 查詢返回空結果

```bash
# 檢查 BigQuery 連接
# 在 Google Cloud Console 中測試查詢

# 驗證服務帳戶權限
# 檢查 Wrangler 日誌
wrangler tail --format json | jq '.logs'
```

#### AI 響應為空

```bash
# 檢查 Workers AI 配置
# 驗證 wrangler.jsonc 中的 ai binding

# 檢查 AI 使用配額
# 在 Cloudflare Dashboard 中驗證
```

---

## 📞 快速參考

### 常用命令

```bash
# 開發
npm run dev              # 啟動本地服務器
npm run build           # 構建前端
npm run test            # 運行測試

# 部署
npm run deploy          # 部署到生產環境
wrangler tail           # 監視實時日誌
wrangler secret list    # 列出所有密鑰

# 配置
wrangler secret put <name>        # 設置密鑰
wrangler secret delete <name>     # 刪除密鑰
wrangler deployments list         # 查看部署歷史

# 清理
rm -rf node_modules     # 清理依賴項
rm -rf .wrangler        # 清理 Wrangler 緩存
```

### 環境變量

| 變量 | 類型 | 環境 | 必需 |
|------|------|------|------|
| PUBMED_BIGQUERY_PROJECT_ID | Secret | prod | ✅ |
| PUBMED_BIGQUERY_CREDENTIALS | Secret | prod | ✅ |
| PUBMED_QUERY_MODE | Var | prod | ✅ |
| CHAT_STATE | Binding | all | ✅ |
| AI | Binding | all | ✅ |
| BROWSER | Binding | all | ✅ |
| R2_BUCKET | Binding | all | ✅ |
| ASSETS | Binding | all | ✅ |

---

## 📈 後續部署步驟

### 階段 1: 初始部署 (完成)
- [x] 設置 Google Cloud
- [x] 配置 Cloudflare
- [x] 部署基本功能

### 階段 2: 優化 (推薦)
- [ ] 實現查詢緩存
- [ ] 添加速率限制
- [ ] 優化 SQL 查詢
- [ ] 設置成本告警

### 階段 3: 擴展 (可選)
- [ ] 多源集成 (PMC, arXiv)
- [ ] 高級搜索功能
- [ ] 用戶帳戶系統
- [ ] 分析儀表板

---

## 📋 最終檢查清單

在宣稱部署完成之前:

- [ ] 所有文件已創建和修改
- [ ] 依賴項已安裝
- [ ] Google Cloud 已配置
- [ ] Wrangler 密鑰已設置
- [ ] 前端已構建
- [ ] 本地測試通過
- [ ] 部署命令成功
- [ ] 生產驗證通過
- [ ] 監控已啟用
- [ ] 文檔已更新

---

## 🎉 完成!

當所有項都被檢查時，您的 PubMed BigQuery QA 機器人已準備好使用!

### 下一步:

1. **分享您的 Worker URL**
   ```
   https://your-worker-url.workers.dev
   ```

2. **開始使用**
   - 訪問主頁進行 Taylor & Travis 聊天
   - 訪問 `/pubmed` 了解 PubMed QA

3. **監控和優化**
   - 定期檢查日誌
   - 監視 API 成本
   - 收集用戶反饋

4. **持續改進**
   - 添加新功能
   - 優化性能
   - 增強安全性

---

**祝賀！部署完成! 🚀🔬📚**

如有問題，請參考:
- [PUBMED_SETUP.md](./PUBMED_SETUP.md)
- [PUBMED_QUICK_START.md](./PUBMED_QUICK_START.md)
- [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)
