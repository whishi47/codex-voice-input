@echo off
REM Codex++ Voice Helper 启动脚本 (CMD)
REM 首次运行会自动下载 faster-whisper 模型 (~1.3GB)

set PORT=17420
set MODEL=small

echo.
echo ╔════════════════════════════════════════╗
echo ║   Codex++ Voice Helper 启动器         ║
echo ╚════════════════════════════════════════╝
echo.

REM 查找 Python
set PYTHON_CMD=
for %%p in (
    "%USERPROFILE%\.workbuddy\binaries\python\envs\voice-mcp\Scripts\python.exe"
    "%USERPROFILE%\.workbuddy\binaries\python\versions\3.13.12\python.exe"
    "python"
    "python3"
) do (
    if not defined PYTHON_CMD (
        %%p --version >nul 2>&1
        if not errorlevel 1 set PYTHON_CMD=%%p
    )
)

if not defined PYTHON_CMD (
    echo [错误] 未找到可用的 Python，请先安装 Python 3.9+
    pause
    exit /b 1
)

echo 使用 Python: %PYTHON_CMD%

REM 检查依赖
%PYTHON_CMD% -c "import flask; import faster_whisper" >nul 2>&1
if errorlevel 1 (
    echo [提示] 正在安装依赖...
    %PYTHON_CMD% -m pip install flask faster-whisper numpy
    if errorlevel 1 (
        echo [警告] 依赖安装失败，请手动运行: pip install flask faster-whisper numpy
    )
)

echo.
echo 启动 Voice Helper...
echo   端口: %PORT%
echo   模型: %MODEL%
echo   端点: http://127.0.0.1:%PORT%/health
echo   按 Ctrl+C 停止服务
echo.

%PYTHON_CMD% "%~dp0voice-helper.py" --port %PORT% --model %MODEL%

pause
