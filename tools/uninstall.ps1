$ErrorActionPreference = "Stop"

$scriptName = "codex-deepseek-billing"
$appDataDir = Join-Path $env:APPDATA $scriptName
$codexPlusPlusScriptsDir = Join-Path $env:APPDATA "Codex++\user_scripts"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Codex DeepSeek Billing - 卸载" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# 停止后台 helper
Write-Host "[1/3] 停止余额查询助手..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match 'deepseek-billing-helper\.js'
} | ForEach-Object {
    Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    Write-Host "  ✓ 已停止 helper 进程 (PID: $($_.Id))" -ForegroundColor Green
}

# 删除 Codex++ 用户脚本
Write-Host "[2/3] 删除 Codex++ 用户脚本..." -ForegroundColor Yellow
$scriptDst = Join-Path $codexPlusPlusScriptsDir "$scriptName.js"
if (Test-Path $scriptDst) {
    Remove-Item $scriptDst -Force
    Write-Host "  ✓ 已删除: $scriptDst" -ForegroundColor Green
} else {
    Write-Host "  - 脚本不存在，跳过" -ForegroundColor Gray
}

# 询问是否删除配置
Write-Host "[3/3] 配置文件..." -ForegroundColor Yellow
$yes = Read-Host "  是否删除所有配置文件? (y/N)"
if ($yes -eq "y" -or $yes -eq "Y") {
    if (Test-Path $appDataDir) {
        Remove-Item -Recurse -Force $appDataDir
        Write-Host "  ✓ 已删除: $appDataDir" -ForegroundColor Green
    }
} else {
    Write-Host "  - 保留配置文件" -ForegroundColor Gray
}

Write-Host ""
Write-Host "卸载完成!" -ForegroundColor Green
