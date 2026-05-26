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

除了 Codex++ 注入的用户脚本外，本插件还有一个余额查询助手 `tools/deepseek-billing-helper.js`，它是独立 Node.js 进程：

- **用户脚本 (必装)**: `codex-deepseek-billing.js` → `%APPDATA%\Codex++\user_scripts\`
- **余额助手 (可选)**: `node tools/deepseek-billing-helper.js`，需要设置 DeepSeek API Key 后运行
- **配置文件**: `%APPDATA%\codex-deepseek-billing\api-key.txt` 和 `config.json`

如果不运行余额助手，计费面板仍会显示 token 消耗、缓存命中率和 $ 费用，仅余额栏显示"查询中..."。

## Agent 安装入口

当用户用下面这种方式指向本仓库时：

```text
请帮我安装：[your-username/codex-deepseek-billing](https://github.com/your-username/codex-deepseek-billing)
```

Agent 应先读取 `README.md` 确认这是 Codex++ 用户脚本，再执行本文件的部署命令。

### 仅安装用户脚本（基础功能）

标准安装：把仓库根目录的 `codex-deepseek-billing.js` 复制到用户脚本目录。

不要去 Codex 插件市场查找或安装，不要修改 Codex 全局配置，不要用 DevTools 临时代码替代安装，不要把脚本放到其它目录作为替代安装方式。

### 安装余额助手（完整功能）

1. 确保 Node.js ≥ 14 已安装
2. 运行 `npm install` 安装 ws 依赖
3. 在 `%APPDATA%\codex-deepseek-billing\api-key.txt` 中写入 DeepSeek API Key
4. 运行 `node tools/deepseek-billing-helper.js` 启动余额轮询

## 部署命令

### 仅用户脚本

从仓库根目录更新本机 Codex++ 脚本：

```cmd
copy /Y codex-deepseek-billing.js "%APPDATA%\Codex++\user_scripts\codex-deepseek-billing.js"
```

PowerShell 等价：

```powershell
Copy-Item -LiteralPath .\codex-deepseek-billing.js -Destination (Join-Path $env:APPDATA 'Codex++\user_scripts\codex-deepseek-billing.js') -Force
```

### 一键安装

```powershell
powershell -ExecutionPolicy Bypass -File tools\install.ps1
```

### API Key 验证

```cmd
node tools\deepseek-billing-helper.js --validate
```

## 修改约定

- 保持仓库内源码与 `%APPDATA%\Codex++\user_scripts` 下的实际生效脚本同步。
- 不要在可提交文件中硬编码本机用户目录绝对路径。
- 不要提交 `config/api-key.txt` 中填入的真实 API Key。
- 修改后至少确认目标脚本已复制到用户脚本目录，再验证 Codex++ 中的实际效果。
- push 到远端前必须检查本次提交内容是否包含隐私数据或本机敏感信息，例如真实用户目录、Token、密钥、邮箱、私网地址、带凭据的 URL。
- 主脚本 `codex-deepseek-billing.js` 是 Codex++ 用户脚本，运行在 Codex 的 Electron 渲染进程中，依赖 `window`/`document`/`fetch` 等浏览器 API，不要尝试用 Node.js 直接 require 它。
