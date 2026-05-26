$ErrorActionPreference = "Stop"

# ===== Codex DeepSeek Billing - 一键安装脚本 =====
# 功能: 安装插件 + 设置余额查询助手

$scriptName = "codex-deepseek-billing"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$appDataDir = Join-Path $env:APPDATA $scriptName
$codexPlusPlusDir = Join-Path $env:APPDATA "Codex++"
$codexPlusPlusScriptsDir = Join-Path $codexPlusPlusDir "user_scripts"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host " Codex DeepSeek Billing - 安装" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# === 第 1 步: 创建配置目录 ===
Write-Host "[1/4] 创建配置目录..." -ForegroundColor Yellow
if (-not (Test-Path $appDataDir)) {
    New-Item -ItemType Directory -Path $appDataDir -Force | Out-Null
    Write-Host "  ✓ 已创建: $appDataDir" -ForegroundColor Green
} else {
    Write-Host "  ✓ 已存在: $appDataDir" -ForegroundColor Green
}

# === 第 2 步: 复制配置文件 ===
Write-Host "[2/4] 复制配置文件..." -ForegroundColor Yellow

$configSrc = Join-Path $repoRoot "config"
$configJsonDst = Join-Path $appDataDir "config.json"
$apiKeyDst = Join-Path $appDataDir "api-key.txt"

# 复制 config.json (不覆盖已有)
if (-not (Test-Path $configJsonDst)) {
    Copy-Item (Join-Path $configSrc "config.json") $configJsonDst
    Write-Host "  ✓ config.json" -ForegroundColor Green
} else {
    Write-Host "  - config.json 已存在，跳过" -ForegroundColor Gray
}

# 复制 api-key.txt (不覆盖已有)
if (-not (Test-Path $apiKeyDst)) {
    Copy-Item (Join-Path $configSrc "api-key.txt") $apiKeyDst
    Write-Host "  ✓ api-key.txt (请编辑填入 API Key!)" -ForegroundColor Yellow
} else {
    Write-Host "  - api-key.txt 已存在，跳过" -ForegroundColor Gray
}

# === 第 3 步: 安装 Codex++ 用户脚本 ===
Write-Host "[3/4] 安装 Codex++ 用户脚本..." -ForegroundColor Yellow

if (-not (Test-Path $codexPlusPlusScriptsDir)) {
    New-Item -ItemType Directory -Path $codexPlusPlusScriptsDir -Force | Out-Null
    Write-Host "  ✓ 已创建: $codexPlusPlusScriptsDir" -ForegroundColor Green
}

$scriptSrc = Join-Path $repoRoot "$scriptName.js"
$scriptDst = Join-Path $codexPlusPlusScriptsDir "$scriptName.js"

Copy-Item $scriptSrc $scriptDst -Force
Write-Host "  ✓ 脚本已复制到 Codex++ user_scripts" -ForegroundColor Green

# === 第 4 步: 启动余额查询助手 ===
Write-Host "[4/4] 启动余额查询助手..." -ForegroundColor Yellow

# 安装 ws 依赖
Write-Host "  ⚠ 安装 ws 依赖..." -ForegroundColor Yellow
Push-Location $repoRoot
npm install ws --save 2>&1 | Out-Null
Pop-Location
Write-Host "  ✓ ws 已安装" -ForegroundColor Green

# 测试 API Key
$apiKeyPath = $apiKeyDst
$apiKey = ""
if (Test-Path $apiKeyPath) {
    $apiKey = (Get-Content $apiKeyPath -Raw).Trim()
}

if ($apiKey -and $apiKey -ne "sk-your-deepseek-api-key-here" -and $apiKey.Length -gt 10) {
    Write-Host "  ✓ 检测到 API Key" -ForegroundColor Green
    Write-Host ""
    Write-Host "  验证 API Key..." -ForegroundColor Yellow
    Push-Location $repoRoot
    $env:DEEPSEEK_API_KEY = $apiKey
    $result = node tools/deepseek-billing-helper.js --validate --once 2>&1
    Pop-Location
    Write-Host $result
} else {
    Write-Host "  ⚠ 请设置 API Key:" -ForegroundColor Yellow
    Write-Host "    编辑文件: $apiKeyDst" -ForegroundColor White
    Write-Host "    获取地址: https://platform.deepseek.com/api_keys" -ForegroundColor White
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host " 安装完成!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "下一步:" -ForegroundColor White
Write-Host "  1. 确保已安装 Codex++" -ForegroundColor Gray
Write-Host "  2. 打开 Codex++ 管理工具 → 增强功能 → 启用用户脚本" -ForegroundColor Gray
Write-Host "  3. 确认 '$scriptName.js' 已启用" -ForegroundColor Gray
Write-Host "  4. (可选) 设置余额查询助手自动启动:" -ForegroundColor Gray
Write-Host "     node tools/deepseek-billing-helper.js" -ForegroundColor Gray
Write-Host ""
