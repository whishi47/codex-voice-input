# AGENTS.md

## 生效位置

这个仓库是 Codex++ 的用户脚本，不是 Codex 原生插件，也不是 Codex 插件市场里的插件。只有先安装并启用 Codex++，再把这个仓库里的用户脚本放到 Codex++ 用户脚本目录后才会生效：

```cmd
%APPDATA%\Codex++\user_scripts
```

在当前 Windows 用户下，这个路径也可写成：

```cmd
%USERPROFILE%\AppData\Roaming\Codex++\user_scripts
```

提交到远端的文档、脚本和示例命令应优先使用 `%APPDATA%` 形式，避免写入本机用户名或绝对用户目录。

## 本插件依赖

除了 Codex++ 注入的用户脚本外，本插件还有一个语音识别助手 `tools/voice-helper.py`，它是独立 Python 进程：

- **用户脚本 (必装)**: `codex-voice-input.js` → `%APPDATA%\Codex++\user_scripts\`
- **语音助手 (必装)**: `python tools/voice-helper.py`，需要 Python 3.9+ 和 faster-whisper
- **配置文件**: `config/config.json`（语言、模型偏好）

如果不运行语音助手，按钮仍会显示，但点击后会提示"识别服务未启动"。

## Agent 安装入口

当用户用下面这种方式指向本仓库时：

```text
请帮我安装：[your-username/codex-voice-input](https://github.com/your-username/codex-voice-input)
```

Agent 应先读取 `README.md` 确认这是 Codex++ 用户脚本，再执行本文件的部署命令。

### 安装用户脚本

标准安装：把仓库根目录的 `codex-voice-input.js` 复制到用户脚本目录。

不要去 Codex 插件市场查找或安装，不要修改 Codex 全局配置，不要用 DevTools 临时代码替代安装，不要把脚本放到其它目录作为替代安装方式。

### 安装语音助手（完整功能）

1. 确保 Python ≥ 3.9 已安装
2. 运行 `pip install flask faster-whisper numpy` 安装依赖
3. 首次运行时 faster-whisper 会自动下载模型文件（~1.3GB）
4. 运行 `python tools/voice-helper.py` 启动识别服务

### 一键启动

```powershell
powershell -ExecutionPolicy Bypass -File tools\start-voice-helper.ps1
```

或：

```cmd
tools\start-voice-helper.bat
```

## 部署命令

### 用户脚本

从仓库根目录更新本机 Codex++ 脚本：

```cmd
copy /Y codex-voice-input.js "%APPDATA%\Codex++\user_scripts\codex-voice-input.js"
```

PowerShell 等价：

```powershell
Copy-Item -LiteralPath .\codex-voice-input.js -Destination (Join-Path $env:APPDATA 'Codex++\user_scripts\codex-voice-input.js') -Force
```

## 修改约定

- 保持仓库内源码与 `%APPDATA%\Codex++\user_scripts` 下的实际生效脚本同步。
- 不要在可提交文件中硬编码本机用户目录绝对路径。
- 不要提交任何 API Key 或隐私数据。
- 修改后至少确认目标脚本已复制到用户脚本目录，再验证 Codex++ 中的实际效果。
- push 到远端前必须检查本次提交内容是否包含隐私数据或本机敏感信息，例如真实用户目录、Token、密钥、邮箱、私网地址、带凭据的 URL。
- 主脚本 `codex-voice-input.js` 是 Codex++ 用户脚本，运行在 Codex 的 Electron 渲染进程中，依赖 `window`/`document`/`fetch` 等浏览器 API，不要尝试用 Node.js 直接 require 它。
