# 設定原始資料夾路徑和 R2 Bucket 名稱
$BaseDir = ".\data"
$BucketName = "ntuh-rag-articles"

# 檢查資料夾是否存在
if (-not (Test-Path $BaseDir)) {
    Write-Error "資料夾 $BaseDir 不存在！"
    exit
}

# 取得所有 .md 檔案（包含 same, fin, normal, Q&A, type 等子資料夾）
$Files = Get-ChildItem -Path $BaseDir -Recurse -Filter "*.md"

$Total = $Files.Count
$Count = 0

Write-Host "準備上傳 $Total 個檔案到 $BucketName..." -ForegroundColor Cyan

$BaseFullPath = (Get-Item $BaseDir).FullName

foreach ($File in $Files) {
    $Count++
    # 取得相對於 data 的路徑作為 R2 的 Key (例如: same/1.md)
    $RelativePath = $File.FullName.Substring($BaseFullPath.Length + 1)
    $Key = $RelativePath.Replace("\", "/")
    $FilePath = $File.FullName
    
    # 計算進度百分比
    $Percent = "{0:N2}" -f (($Count / $Total) * 100)
    
    Write-Host "[$Count/$Total] ($Percent%) 上傳: $Key" -NoNewline
    
    # 執行 Wrangler 命令上傳
    try {
        $output = npx wrangler r2 object put "$BucketName/$Key" --file "$FilePath" 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-Host " [成功]" -ForegroundColor Green
        } else {
            Write-Host " [失敗]" -ForegroundColor Red
            Write-Host $output
        }
    } catch {
        Write-Host " [例外錯誤]" -ForegroundColor Red
        Write-Host $_
    }
}

Write-Host "上傳完成！" -ForegroundColor Cyan   