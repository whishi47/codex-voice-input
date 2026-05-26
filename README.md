# Codex DeepSeek Billing for Codex++

> Codex 桌面应用的 DeepSeek V4 专用计费面板插件。

实时显示 DeepSeek V4 API 的 **token 消耗、费用 ($)、缓存命中率、账户余额**。

---

## 🌐 语言设置

插件支持 Codex++ 原生多语言切换，可在界面右上角一键切换：

| 语言 | 说明 |
|------|------|
| 🇨🇳 **中文** | 简体中文界面 |
| 🇬🇧 **English** | 英文界面 |

> 切换语言后插件面板同步跟随，计费数据（Token / $ / 余额）不受影响。

---

## ⚙️ 编译选项

插件可在 Codex++ 设置中搭配以下编译模式使用：

| 模式 | 说明 |
|------|------|
| **VS Code** | 将代码直接写入本地 VS Code 工作区 |
| **Node** | 以 Node.js 环境执行代码（适用于 Node.js 项目） |
| **License** | 仅生成 License 文件，不执行代码 |
| **TypeScript** | TypeScript 编译模式，保留类型检查 |

> 💡 计费面板与上述编译选项无关，始终显示当前会话的 Token 消耗与费用。

---

## 🎯 功能

| 功能 | 说明 |
|------|------|
| **Context 使用率** | 进度条显示当前会话上下文窗口使用情况 |
| **Token 统计** | 分别统计输入/输出 token 数量 |
| **缓存命中率** | V4-Flash 缓存命中仅 $0.0028/1M，比未命中便宜 50 倍 |
| **费用计算** | 自动按 DeepSeek V4 定价换算为美元 |
| **余额监控** | 通过 `deepseek-billing-helper` 实时查询账户余额 |
| **余额警告** | 余额 < ¥5 黄色提醒，< ¥2 红色闪烁 |
| **双模式** | 内联模式（嵌入对话区）/ 悬浮模式（自由拖动） |
| **右键菜单** | 右键切换模式 |

---

## 📦 安装

### 前置条件

1. [Codex 桌面应用](https://codex.gallery/) 已安装
2. Codex++ 已安装
3. DeepSeek API Key（[获取](https://platform.deepseek.com/api_keys)）
4. Node.js ≥ 14

### 一键安装

```powershell
# 克隆仓库
git clone https://github.com/whishi47/codex-deepseek-billing.git
cd codex-deepseek-billing

# 运行安装脚本
powershell -ExecutionPolicy Bypass -File tools/install.ps1
```

### 手动安装

**1. 设置 API Key**

编辑 `%APPDATA%\codex-deepseek-billing\api-key.txt`，填入你的 DeepSeek API Key。

**2. 复制脚本到 Codex++**

```
复制 codex-deepseek-billing.js 到:
%APPDATA%\Codex++\user_scripts\codex-deepseek-billing.js
```

**3. 启用 Codex++ 用户脚本**

打开 Codex++ 管理工具 → 增强功能 → 启用用户脚本。

**4. 启动余额查询助手（可选，推荐）**

```bash
npm install
node tools/deepseek-billing-helper.js
```

或使用环境变量:
```bash
set DEEPSEEK_API_KEY=sk-xxx
node tools/deepseek-billing-helper.js --verbose
```

### 验证安装

```bash
# 验证 API Key
node tools/deepseek-billing-helper.js --validate

# 手动推送一次余额
node tools/deepseek-billing-helper.js --once
```

---

## 📊 DeepSeek V4 定价

| 模型 | 输入 (缓存未命中) | 输入 (缓存命中) | 输出 |
|------|:---:|:---:|:---:|
| **V4-Flash** | $0.14 / 1M | $0.0028 / 1M | $0.28 / 1M |
| **V4-Pro** (75% off) | $0.435 / 1M | $0.003625 / 1M | $0.87 / 1M |

> 💡 **缓存命中率是 DeepSeek V4 省钱的关键**。99% 命中率时，输入成本接近 $0.0028/1M，几乎可以忽略。

---

## 🏗️ 项目结构

```
codex-deepseek-billing/
├── codex-deepseek-billing.js   # 主注入脚本 (Codex++ 用户脚本)
├── tools/
│   ├── deepseek-billing-helper.js # 余额查询 Node.js 助手
│   ├── install.ps1                # Windows 一键安装
│   └── uninstall.ps1              # 卸载脚本
├── config/
│   ├── api-key.txt                # API Key 模板
│   └── config.json                # 插件配置
├── package.json
└── README.md
```

---

## 🔧 架构说明

```
┌──────────────────────────────────────────────┐
│                 Codex 页面                     │
│  ┌────────────────────────────────────────┐  │
│  │   codex-deepseek-billing.js         │  │
│  │                                        │  │
│  │  • Token 检测 (React State / DOM)      │  │
│  │  • API 监控 (fetch/XHR 拦截)           │  │
│  │  • 费用计算 (V4 定价)                  │  │
│  │  • UI 面板 (内联/悬浮)                 │  │
│  └──────────────┬─────────────────────────┘  │
│                 │ CustomEvent                 │
│  ┌──────────────▼─────────────────────────┐  │
│  │   deepseek-billing-helper.js           │  │
│  │   (独立 Node.js 进程)                  │  │
│  │                                        │  │
│  │  • 读 API Key                          │  │
│  │  • 调 /user/balance                    │  │
│  │  • 脱敏推送到页面                       │  │
│  └────────────────────────────────────────┘  │
└──────────────────────────────────────────────┘
```

---

## 📤 发布

在脚本市场仓库提 PR:

1. Fork 市场仓库
2. 将 `codex-deepseek-billing.js` 复制到 `scripts/` 目录
3. 在 `index.json` 的 `scripts` 数组中添加:

```json
{
  "id": "codex-deepseek-billing",
  "name": "Codex DeepSeek Billing",
  "description": "DeepSeek V4 专用计费面板: token 消耗、费用($)、缓存命中率、余额",
  "version": "1.0.0",
  "author": "whishi47",
  "tags": ["deepseek", "billing", "tokens", "cost", "balance"],
  "homepage": "https://github.com/whishi47/codex-deepseek-billing",
  "script_url": "https://raw.githubusercontent.com/whishi47/codex-deepseek-billing/main/codex-deepseek-billing.js",
  "sha256": "<计算脚本的 SHA-256>"
}
```

4. 提交 PR

---

## 📄 License

MIT
