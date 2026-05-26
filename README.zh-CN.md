<p align="center">
  <img src="images/logo.svg" width="160" alt="Codex DeepSeek Billing"/>
</p>

<p align="center">
  <a href="./README.md">English</a>
  &nbsp;·&nbsp;
  <strong>简体中文</strong>
  &nbsp;·&nbsp;
  <a href="https://github.com/whishi47/codex-deepseek-billing">GitHub</a>
  &nbsp;·&nbsp;
  <a href="./AGENTS.md">Agent 安装指南</a>
</p>

<p align="center">
  <a href="https://github.com/whishi47/codex-deepseek-billing"><img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square&labelColor=161b22&color=2ea043&logo=git&logoColor=white" alt="version"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square&labelColor=161b22&color=8b949e" alt="license"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing/stargazers"><img src="https://img.shields.io/badge/stars-0-yellow.svg?style=flat-square&labelColor=161b22&color=dbab09&logo=github&logoColor=white" alt="stars"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing"><img src="https://img.shields.io/badge/Codex++-插件-58a6ff.svg?style=flat-square&labelColor=161b22&logo=react&logoColor=white" alt="Codex++"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing/graphs/contributors"><img src="https://img.shields.io/badge/contributors-1-bc8cff.svg?style=flat-square&labelColor=161b22&logo=github&logoColor=white" alt="contributors"/></a>
</p>

<br/>

<h3 align="center">在 Codex++ 中实时追踪 DeepSeek V4 的 Token 消耗与费用。</h3>
<p align="center">每一笔 token 都算清楚。每一次缓存命中都省下钱。余额、费用、命中率——全在你的对话面板里。</p>

<br/>

> [!TIP]
> **先看账单再花钱。** DeepSeek V4 的定价不简单——输入 vs 输出、缓存命中 vs 未命中，差价高达 50 倍。这个插件把一切实时呈现，跟你的 Codex++ 对话在一起。

> [!IMPORTANT]
> **专为 Codex++ 用户脚本系统打造。** 放进去，启用，完事。跟其他插件不冲突。开源、可审计、不上报任何数据。

<br/>

## 功能一览

- **Token 明细** — 输入 token、输出 token、缓存命中、缓存未命中、缓存写入——全部分开统计
- **实时计费** — 按 DeepSeek V4 Flash / Pro 定价自动算钱。每次对话后即时更新
- **缓存经济学** — 命中率百分比、缓存节省金额。99% 命中率时，输入成本从 $0.14/1M 降到 ~$0.0028/1M
- **余额监控** — 通过 DeepSeek `/user/balance` API 实时查询余额。颜色预警：¥5 黄色、¥2 红色闪烁
- **双模式面板** — 内联模式（嵌在对话区）或悬浮模式（可拖动浮窗）。右键切换
- **双币种显示** — 美元 ¥ 和人民币 ¥ 并排显示。汇率：7.2
- **五层 Token 检测** — React 状态扫描、DOM 文本提取、fetch/XHR/WebSocket 拦截、SSE 流式响应解析
- **余额助手** — 独立 Node.js 进程（`deepseek-billing-helper`），定时查询余额并通过 CDP 推送到 Codex++ 页面

<br/>

## 安装

```bash
# 克隆仓库
git clone https://github.com/whishi47/codex-deepseek-billing.git
cd codex-deepseek-billing

# 一键安装
powershell -ExecutionPolicy Bypass -File tools/install.ps1
```

前提条件：[Codex 桌面版](https://codex.gallery/) + [Codex++](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket) + [DeepSeek API Key](https://platform.deepseek.com/api_keys)。余额助手需要 Node.js ≥ 14。

### 快速参考

| 步骤 | 说明 |
|------|------|
| `tools/install.ps1` | 一键安装：复制文件、填 API Key、启动 helper |
| `config/api-key.txt` | 编辑此文件填入你的 DeepSeek API Key |
| `node tools/deepseek-billing-helper.js` | 独立运行——每 30 秒查询一次余额 |
| `--once` | 单次查询，不驻留 |
| `--validate` | 验证 API Key 是否有效 |
| `--no-cdp` | 跳过 CDP，直接在终端打印余额 |

### 手动安装

1. 把 `codex-deepseek-billing.js` 复制到 `%APPDATA%\Codex++\user_scripts\`
2. 打开 Codex++ → 增强功能 → **启用用户脚本**
3. 确认列表中已有该脚本且已**开启**
4. （可选）启动余额助手：`node tools/deepseek-billing-helper.js`

<br/>

## DeepSeek V4 定价

| 模型 | 输入 (缓存未命中) | 输入 (缓存命中) | 输出 |
|------|:-----------------:|:---------------:|:----:|
| **V4-Flash** | $0.14 / 1M | $0.0028 / 1M | $0.28 / 1M |
| **V4-Pro** (75% 优惠) | $0.435 / 1M | $0.003625 / 1M | $0.87 / 1M |

> 💡 **缓存命中率是省钱的关键。** 99% 命中时，输入成本几乎为零（$0.0028/1M）。插件实时追踪命中率，帮你优化会话结构。

<br/>

## 架构

```
┌─────────────────────────────────────────────┐
│              Codex++ 页面 (Electron)          │
│  ┌───────────────────────────────────────┐  │
│  │  codex-deepseek-billing.js           │  │
│  │                                       │  │
│  │  • Token 检测 (React/DOM)             │  │
│  │  • API 监控 (fetch/XHR/WS)            │  │
│  │  • 费用计算 (V4 定价)                 │  │
│  │  • UI 面板 (内联 / 悬浮)              │  │
│  └──────────────┬────────────────────────┘  │
│                 │ CustomEvent                │
│  ┌──────────────▼────────────────────────┐  │
│  │  deepseek-billing-helper.js           │  │
│  │  (独立 Node.js 进程)                   │  │
│  │                                       │  │
│  │  • 读取 API Key                       │  │
│  │  • 调用 /user/balance（每 30 秒）      │  │
│  │  • 脱敏后推送余额到页面                │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### Token 检测机制

插件不止读 DOM——它在每一层数据流中捕获信息：

1. **React 状态扫描** — 读取 React fiber 树中的 token usage hooks
2. **DOM 文本提取** — 兜底方案，直接从 DOM 读取 token 数值
3. **fetch/XHR 拦截** — 包装 `fetch()` 和 `XMLHttpRequest`，截获 API 响应
4. **WebSocket 拦截** — 捕获 WebSocket 帧中的流式 token 计数
5. **SSE 流式解析** — 从流式响应的 `data:` 行中提取 usage JSON 并重组

<br/>

## 横向对比

|                          | Codex DeepSeek Billing | 手动记账 | CCM（通用） |
|--------------------------|:----------------------:|:--------:|:-----------:|
| DeepSeek V4 定价         | ✅ 内置                | ❌        | ❌           |
| 缓存命中率               | ✅ 实时                | ❌        | ❌           |
| 缓存节省金额 ($)          | ✅ 自动计算            | ❌        | ❌           |
| 余额监控                 | ✅ 实时 API            | ❌        | ❌           |
| 双币种 (USD/CNY)         | ✅ 并排显示            | ❌        | ❌           |
| SSE 流式解析             | ✅                     | ❌        | ❌           |
| 内联 / 悬浮双模式        | ✅                     | ❌        | ❌           |
| 开源 (MIT)               | ✅                     | —        | ✅           |
| 无上报无埋点              | ✅                     | —        | ✅           |
| Codex++ 用户脚本         | ✅ 专为                | —        | ✅           |

<br/>

## 这个插件做什么，不做什么

> [!IMPORTANT]
> Codex DeepSeek Billing 是一个专注的工具。有些事情它刻意去做——有些事情它刻意不做。

- **只支持 DeepSeek V4。** 这是刻意的——V4 的定价模型（缓存命中 vs 未命中、Flash vs Pro）让实时计费有意义。其他模型的计算逻辑不同。
- **只读，不主动发起 API 调用。** 插件从 Codex++ 页面本身观察 token，不把你的数据发往任何地方。唯一的外部调用是余额助手通过你的 API Key 查询 DeepSeek 的 `/user/balance`。
- **不是代理。** 它不挡在你和 DeepSeek 之间。它只是坐在 Codex++ 对话旁边，看着数据流过。
- **不是性能分析工具。** 它显示的是费用，不是性能。要分析延迟或吞吐量，请用浏览器的 DevTools。

<br/>

## 项目结构

```
codex-deepseek-billing/
├── codex-deepseek-billing.js    # 主脚本（~150KB，4149 行）
├── AGENTS.md                     # AI Agent 自动化安装指南
├── market-entry.json             # 脚本市场上架清单
├── package.json                  # ws 依赖
├── config/
│   ├── api-key.txt               # API Key 模板
│   └── config.json               # 余额阈值配置
└── tools/
    ├── deepseek-billing-helper.js # 余额查询守护进程
    ├── install.ps1               # Windows 一键安装
    └── uninstall.ps1             # 卸载脚本
```

<br/>

## 上架脚本市场

向 [CodexPlusPlusScriptMarket](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket) 提 PR：

1. Fork 市场仓库
2. 把 `codex-deepseek-billing.js` 复制到你的 fork 的 `scripts/` 目录
3. 在 `index.json` 中添加以下条目：

```json
{
  "id": "codex-deepseek-billing",
  "name": "Codex DeepSeek Billing",
  "description": "DeepSeek V4 专用计费面板：实时 Token 消耗、费用($)、缓存命中率、余额监控",
  "version": "1.0.0",
  "author": "whishi47",
  "tags": ["deepseek", "billing", "tokens", "cost", "cache", "balance"],
  "homepage": "https://github.com/whishi47/codex-deepseek-billing",
  "script_url": "https://raw.githubusercontent.com/whishi47/codex-deepseek-billing/main/codex-deepseek-billing.js",
  "sha256": "<脚本的 SHA-256>"
}
```

4. 提交 PR

<br/>

## License

MIT — 详见 [LICENSE](./LICENSE)。

<br/>

---

<p align="center">
  <sub>作者 <a href="https://github.com/whishi47">whishi47</a></sub>
  <br/>
  <sub>Codex DeepSeek Billing — MIT 协议</sub>
</p>
