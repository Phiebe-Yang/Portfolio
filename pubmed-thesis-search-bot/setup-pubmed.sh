#!/bin/bash

# PubMed BigQuery QA Bot - Setup Script
# 這個腳本幫助您設置 Google API 認證用於 PubMed 查詢

set -e

echo "🔬 PubMed BigQuery QA Bot Setup"
echo "================================"
echo ""

# 檢查 wrangler 是否已安裝
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler 未安裝。請先運行:"
    echo "   npm install -g wrangler"
    exit 1
fi

# 檢查 Node.js 版本
node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$node_version" -lt 18 ]; then
    echo "❌ 需要 Node.js 18 或更高版本。當前版本: $(node -v)"
    exit 1
fi

echo "✅ 環境檢查通過"
echo ""

# 步驟 1: Google Cloud Setup
echo "步驟 1: Google Cloud Setup"
echo "========================="
echo ""
echo "請執行以下步驟:"
echo "1. 訪問 https://console.cloud.google.com"
echo "2. 創建或選擇一個項目"
echo "3. 啟用 BigQuery API"
echo "4. 創建服務帳戶並下載 JSON 密鑰"
echo ""
echo "如果需要詳細說明，請查看 PUBMED_SETUP.md"
echo ""

# 步驟 2: 配置密鑰
echo "步驟 2: 配置 Wrangler 密鑰"
echo "=========================="
echo ""

echo "請輸入您的 Google Cloud 項目 ID:"
read -r project_id

if [ -z "$project_id" ]; then
    echo "❌ 項目 ID 不能為空"
    exit 1
fi

echo "將項目 ID 設置為密鑰..."
echo "$project_id" | wrangler secret put PUBMED_BIGQUERY_PROJECT_ID --path wrangler.jsonc 2>/dev/null || true

echo ""
echo "請貼上您下載的 Google 服務帳戶 JSON 密鑰。"
echo "（按 Ctrl+D 或 Cmd+D 完成輸入）:"
echo ""

# 讀取多行輸入
credentials=$(cat)

if [ -z "$credentials" ]; then
    echo "❌ 認證信息不能為空"
    exit 1
fi

# 驗證 JSON 格式
if ! echo "$credentials" | jq . &> /dev/null; then
    echo "❌ 無效的 JSON 格式。請確保正確複製了密鑰文件。"
    exit 1
fi

echo "$credentials" | wrangler secret put PUBMED_BIGQUERY_CREDENTIALS --path wrangler.jsonc 2>/dev/null || true

echo ""
echo "✅ 密鑰已配置"
echo ""

# 步驟 3: 安裝依賴項
echo "步驟 3: 安裝依賴項"
echo "=================="
echo ""

if [ ! -d "node_modules" ]; then
    echo "正在安裝依賴項..."
    npm install
    npm install --save-dev esbuild @types/react @types/react-dom
    echo "✅ 依賴項安裝完成"
else
    echo "✅ 依賴項已安裝"
fi

echo ""

# 步驟 4: 構建
echo "步驟 4: 構建前端"
echo "================"
echo ""

echo "正在構建前端資源..."
npm run build
echo "✅ 構建完成"

echo ""

# 步驟 5: 本地測試
echo "步驟 5: 本地測試 (可選)"
echo "======================="
echo ""
echo "要在本地測試，請運行:"
echo "  npm run dev"
echo ""
echo "然後訪問: http://localhost:8787"
echo ""

# 步驟 6: 部署
echo "步驟 6: 部署到 Cloudflare Workers"
echo "=================================="
echo ""
echo "要部署到生產環境，請運行:"
echo "  npm run deploy"
echo ""

# 驗證設置
echo ""
echo "步驟 7: 驗證設置"
echo "================"
echo ""

echo "檢查 wrangler.jsonc 配置..."
if grep -q "PUBMED_QUERY_MODE" wrangler.jsonc; then
    echo "✅ wrangler.jsonc 已正確配置"
else
    echo "⚠️  警告: wrangler.jsonc 中未找到 PUBMED_QUERY_MODE"
    echo "請確保環境變量已正確設置"
fi

echo ""
echo "🎉 設置完成！"
echo ""
echo "下一步:"
echo "1. 運行 'npm run dev' 在本地測試"
echo "2. 運行 'npm run deploy' 部署到 Cloudflare Workers"
echo "3. 訪問您的 Worker URL 開始使用"
echo ""
echo "如有問題，請查看:"
echo "  - PUBMED_SETUP.md - 詳細設置指南"
echo "  - PUBMED_QUICK_START.md - 快速入門指南"
echo ""
