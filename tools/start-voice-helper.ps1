# Codex++ Voice Helper 启动脚本 (PowerShell)
# 首次运行会自动下载 faster-whisper 模型 (~1.3GB)

param(
    [int]$Port = 17420,
    [string]$Model = "small",
    [switch]$Install
)

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$HelperScript = Join-Path $ScriptDir "voice-helper.py"

if (-not (Test-Path $HelperScript)) {
    Write-Host "[错误] 未找到 voice-helper.py，请确保在正确目录下运行" -ForegroundColor Red
    exit 1
}

# 检查 Python
$pythonCmd = $null
$pythonPaths = @(
    "$env:USERPROFILE\.workbuddy\binaries\python\envs\voice-mcp\Scripts\python.exe",
    "$env:USERPROFILE\.workbuddy\binaries\python\versions\3.13.12\python.exe",
    "python",
    "python3"
)

foreach ($p in $pythonPaths) {
    try {
        $result = & $p --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            $pythonCmd = $p
            break
        }
    } catch {}
}

if (-not $pythonCmd) {
    Write-Host "[错误] 未找到可用的 Python，请先安装 Python 3.9+" -ForegroundColor Red
    exit 1
}

Write-Host "使用 Python: $pythonCmd" -ForegroundColor Cyan

# 安装依赖（可选）
if ($Install) {
    Write-Host "正在安装依赖..." -ForegroundColor Yellow
    & $pythonCmd -m pip install flask faster-whisper numpy --quiet
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[警告] 依赖安装可能失败，请手动运行: pip install flask faster-whisper numpy" -ForegroundColor Yellow
    }
}

# 创建虚拟环境（如果不存在）
$venvPath = Join-Path $ScriptDir ".." "voice-mcp-env"
if (-not (Test-Path $venvPath)) {
    Write-Host "创建虚拟环境: $venvPath" -ForegroundColor Yellow
    & $pythonCmd -m venv $venvPath
    if ($LASTEXITCODE -eq 0) {
        $pipPath = Join-Path $venvPath "Scripts" "pip.exe"
        & $pipPath install flask faster-whisper numpy
        $pythonCmd = Join-Path $venvPath "Scripts" "python.exe"
    }
}

Write-Host ""
Write-Host "启动 Voice Helper..." -ForegroundColor Green
Write-Host "  端口: $Port" -ForegroundColor White
Write-Host "  模型: $Model" -ForegroundColor White
Write-Host "  端点: http://127.0.0.1:$Port/health" -ForegroundColor White
Write-Host ""

& $pythonCmd $HelperScript --port $Port --model $Model
