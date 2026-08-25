@echo off
REM PubMed BigQuery QA Bot - Setup Script for Windows
REM 這個腳本幫助您設置 Google API 認證用於 PubMed 查詢

setlocal enabledelayedexpansion
color 0A

echo.
echo 0x1B[36m================================================0x1B[0m
echo 0x1B[36m  ^C PubMed BigQuery QA Bot Setup (Windows)    0x1B[0m
echo 0x1B[36m================================================0x1B[0m
echo.

REM 檢查 wrangler 是否已安裝
wrangler --version >nul 2>&1
if errorlevel 1 (
    echo [X] Wrangler 未安裝。請先運行:
    echo     npm install -g wrangler
    pause
    exit /b 1
)

REM 檢查 Node.js 是否已安裝
node --version >nul 2>&1
if errorlevel 1 (
    echo [X] Node.js 未安裝。請從 https://nodejs.org 下載安裝
    pause
    exit /b 1
)

echo [OK] 環境檢查通過
echo.
echo 步驟 1: Google Cloud Setup
echo ===========================
echo.
echo 請執行以下步驟:
echo   1. 訪問 https://console.cloud.google.com
echo   2. 創建或選擇一個項目
echo   3. 啟用 BigQuery API
echo   4. 創建服務帳戶並下載 JSON 密鑰
echo.
echo 如需詳細說明，請查看 PUBMED_SETUP.md
echo.
pause

REM 步驟 2: 配置密鑰
echo.
echo 步驟 2: 配置 Wrangler 密鑰
echo ==========================
echo.
set /p project_id="請輸入您的 Google Cloud 項目 ID: "

if "!project_id!"=="" (
    echo [X] 項目 ID 不能為空
    pause
    exit /b 1
)

echo.
echo 將項目 ID 設置為密鑰...
echo !project_id! | wrangler secret put PUBMED_BIGQUERY_PROJECT_ID 2>nul
echo [OK] 項目 ID 已配置
echo.

echo 請執行以下步驟配置認證密鑰:
echo   1. 在命令行中運行:
echo      wrangler secret put PUBMED_BIGQUERY_CREDENTIALS
echo   2. 打開您下載的 JSON 密鑰文件
echo   3. 複製整個內容
echo   4. 粘貼到命令行中
echo   5. 按 Ctrl+D 完成輸入
echo.
pause

wrangler secret put PUBMED_BIGQUERY_CREDENTIALS

echo [OK] 認證信息已配置
echo.

REM 步驟 3: 安裝依賴項
echo 步驟 3: 安裝依賴項
echo ==================
echo.

if not exist "node_modules" (
    echo 正在安裝依賴項...
    call npm install
    call npm install --save-dev esbuild @types/react @types/react-dom
    echo [OK] 依賴項安裝完成
) else (
    echo [OK] 依賴項已安裝
)

echo.

REM 步驟 4: 構建
echo 步驟 4: 構建前端
echo ================
echo.

echo 正在構建前端資源...
call npm run build
echo [OK] 構建完成

echo.

REM 步驟 5: 本地測試選項
echo 步驟 5: 本地測試 (可選)
echo =======================
echo.
echo 要在本地測試，請執行:
echo   npm run dev
echo.
echo 然後訪問: http://localhost:8787
echo.

REM 步驟 6: 部署選項
echo 步驟 6: 部署到 Cloudflare Workers
echo ==================================
echo.
echo 要部署到生產環境，請執行:
echo   npm run deploy
echo.

REM 步驟 7: 驗證設置
echo.
echo 步驟 7: 驗證設置
echo ================
echo.

findstr /C:"PUBMED_QUERY_MODE" wrangler.jsonc >nul 2>&1
if errorlevel 1 (
    echo [WARNING] wrangler.jsonc 中未找到 PUBMED_QUERY_MODE
    echo 請確保環境變量已正確設置
) else (
    echo [OK] wrangler.jsonc 已正確配置
)

echo.
echo ===============================================
echo   ^! 設置完成！
echo ===============================================
echo.
echo 下一步:
echo   1. 運行 'npm run dev' 在本地測試
echo   2. 運行 'npm run deploy' 部署到 Cloudflare Workers
echo   3. 訪問您的 Worker URL 開始使用
echo.
echo 如有問題，請查看:
echo   - PUBMED_SETUP.md - 詳細設置指南
echo   - PUBMED_QUICK_START.md - 快速入門指南
echo.

pause
