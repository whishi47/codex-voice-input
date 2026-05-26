<p align="center">
  <img src="images/logo.png" alt="Codex DeepSeek Billing" width="640"/>
</p>

<p align="center">
  <strong>English</strong>
  &nbsp;·&nbsp;
  <a href="./README.zh-CN.md">简体中文</a>
  &nbsp;·&nbsp;
  <a href="https://github.com/whishi47/codex-deepseek-billing">GitHub</a>
  &nbsp;·&nbsp;
  <a href="./AGENTS.md">Agent Guide</a>
</p>

<p align="center">
  <a href="https://github.com/whishi47/codex-deepseek-billing"><img src="https://img.shields.io/badge/version-1.0.0-blue.svg?style=flat-square&labelColor=161b22&color=2ea043&logo=git&logoColor=white" alt="version"/></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-green.svg?style=flat-square&labelColor=161b22&color=8b949e" alt="license"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing/stargazers"><img src="https://img.shields.io/badge/stars-0-yellow.svg?style=flat-square&labelColor=161b22&color=dbab09&logo=github&logoColor=white" alt="stars"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing"><img src="https://img.shields.io/badge/Codex++-plugin-58a6ff.svg?style=flat-square&labelColor=161b22&logo=react&logoColor=white" alt="Codex++"/></a>
  <a href="https://github.com/whishi47/codex-deepseek-billing/graphs/contributors"><img src="https://img.shields.io/badge/contributors-1-bc8cff.svg?style=flat-square&labelColor=161b22&logo=github&logoColor=white" alt="contributors"/></a>
</p>

<br/>

<h3 align="center">Real-time DeepSeek V4 cost tracking for your Codex++ coding sessions.</h3>
<p align="center">Every token counted. Every dollar tracked. Cache hits, costs, balance — all visible without leaving your workflow.</p>

<br/>

> [!TIP]
> **Know what you spend before you get the bill.** DeepSeek V4 pricing is non-trivial — input vs. output, cache-hit vs. cache-miss, the 50× difference between them. This plugin surfaces it all in real-time, inline with your Codex++ conversations.

> [!IMPORTANT]
> **Designed for Codex++ user script system.** Drop the script in, enable it, done. Works alongside other Codex++ plugins without conflict. Open source, auditable, no telemetry.

<br/>

## Features

- **Token-level breakdown** — input tokens, output tokens, cache-hit tokens, cache-miss tokens, cache-write tokens — all counted separately
- **Real-time cost** — auto-calculated using DeepSeek V4 Flash & Pro pricing. Updates after every message
- **Cache economics** — hit rate percentage, savings from cache hits. At 99% hit rate, input cost drops from $0.14/1M to ~$0.0028/1M
- **Balance monitoring** — live balance via DeepSeek `/user/balance` API. Color-coded warnings: ¥5 (yellow), ¥2 (red blinking)
- **Dual display modes** — inline mode (sits inside the conversation panel) or float mode (draggable overlay). Switch via right-click
- **Dual currency** — USD and CNY side by side. Exchange rate: 7.2
- **Multi-layer token detection** — React state scanning, DOM text extraction, fetch/XHR/WebSocket interception, SSE streaming response parsing
- **Balance helper** — standalone Node.js process (`deepseek-billing-helper`) that polls balance and pushes it to the Codex++ page via CDP

<br/>

## Install

```bash
# Clone the repo
git clone https://github.com/whishi47/codex-deepseek-billing.git
cd codex-deepseek-billing

# One-shot install
powershell -ExecutionPolicy Bypass -File tools/install.ps1
```

Requires [Codex desktop app](https://codex.gallery/) with [Codex++](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket) installed, and a [DeepSeek API key](https://platform.deepseek.com/api_keys). Node.js ≥ 14 for the balance helper.

### Quick reference

| Step | What |
|------|------|
| `tools/install.ps1` | One-shot: copies files, prompts for API key, starts helper |
| `config/api-key.txt` | Edit this to set your DeepSeek API key |
| `node tools/deepseek-billing-helper.js` | Standalone — polls `/user/balance` every 30s |
| `--once` | Single balance check, no daemon |
| `--validate` | Verify your API key is valid |
| `--no-cdp` | Skip CDP, print to stdout |

### Manual install

1. Copy `codex-deepseek-billing.js` to `%APPDATA%\Codex++\user_scripts\`
2. Open Codex++ → Extensions → **Enable user scripts**
3. Verify the script appears in the list and is toggled **on**
4. (Optional) Start the balance helper: `node tools/deepseek-billing-helper.js`

<br/>

## DeepSeek V4 pricing

| Model | Input (cache miss) | Input (cache hit) | Output |
|-------|:------------------:|:-----------------:|:------:|
| **V4-Flash** | $0.14 / 1M | $0.0028 / 1M | $0.28 / 1M |
| **V4-Pro** (75% off) | $0.435 / 1M | $0.003625 / 1M | $0.87 / 1M |

> 💡 **Cache hit rate is the single biggest cost lever.** At 99% hit, input is practically free ($0.0028/1M). The plugin tracks hit rate in real-time so you can optimize your session structure.

<br/>

## Architecture

```
┌─────────────────────────────────────────────┐
│              Codex++ Page (Electron)          │
│  ┌───────────────────────────────────────┐  │
│  │  codex-deepseek-billing.js           │  │
│  │                                       │  │
│  │  • Token detection (React/DOM)        │  │
│  │  • API monitoring (fetch/XHR/WS)      │  │
│  │  • Cost calculation (V4 pricing)      │  │
│  │  • UI panel (inline / float)          │  │
│  └──────────────┬────────────────────────┘  │
│                 │ CustomEvent                │
│  ┌──────────────▼────────────────────────┐  │
│  │  deepseek-billing-helper.js           │  │
│  │  (standalone Node.js process)          │  │
│  │                                       │  │
│  │  • Reads API key from config          │  │
│  │  • Calls /user/balance every 30s      │  │
│  │  • Pushes sanitized balance to page   │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### How detection works

The plugin doesn't just read the DOM — it taps into the data flow at every layer:

1. **React state scan** — reads the internal React fiber tree for token usage hooks
2. **DOM text scan** — backs up React reads with direct DOM text extraction
3. **fetch/XHR intercept** — wraps `fetch()` and `XMLHttpRequest` to capture API response payloads
4. **WebSocket intercept** — captures streaming token counts from WebSocket frames
5. **SSE stream parser** — extracts `data:` lines from streaming responses and reassembles usage JSON

<br/>

## How it compares

|                          | Codex DeepSeek Billing | Manual tracking | CCM (generic) |
|--------------------------|:----------------------:|:---------------:|:-------------:|
| DeepSeek V4 pricing      | ✅ built-in           | ❌              | ❌             |
| Cache hit rate           | ✅ real-time          | ❌              | ❌             |
| Cache savings ($)        | ✅ auto-computed      | ❌              | ❌             |
| Balance monitoring       | ✅ live API           | ❌              | ❌             |
| Dual currency (USD/CNY)  | ✅ side-by-side       | ❌              | ❌             |
| SSE streaming parse      | ✅                    | ❌              | ❌             |
| Inline / float dual mode | ✅                    | ❌              | ❌             |
| Open source (MIT)        | ✅                    | —               | ✅             |
| No telemetry             | ✅                    | —               | ✅             |
| Codex++ user script      | ✅ dedicated          | —               | ✅             |

<br/>

## What this is and isn't

> [!IMPORTANT]
> Codex DeepSeek Billing is a focused tool. Some things it deliberately does — and doesn't do.

- **DeepSeek V4 only.** This is intentional — V4's pricing model (cache-hit vs cache-miss, Flash vs Pro) is what makes real-time tracking meaningful. For other providers, the math is different.
- **Read-only, no API calls of its own.** The plugin observes tokens from the Codex++ page itself. It never sends your data anywhere. The only external call is the balance helper, which hits DeepSeek's `/user/balance` endpoint with your own API key.
- **Not a proxy.** It doesn't sit between you and DeepSeek. It sits beside your Codex++ session, watching what goes through.
- **Not a profiler.** It shows cost, not performance. For latency or throughput analysis, use the browser's DevTools.

<br/>

## Project structure

```
codex-deepseek-billing/
├── codex-deepseek-billing.js    # Main script (~150KB, 4149 lines)
├── AGENTS.md                     # Agent-based installation guide
├── market-entry.json             # Script market submission manifest
├── package.json                  # ws dependency
├── config/
│   ├── api-key.txt               # API key template
│   └── config.json               # Balance thresholds
└── tools/
    ├── deepseek-billing-helper.js # Balance polling daemon
    ├── install.ps1               # Windows installer
    └── uninstall.ps1             # Windows uninstaller
```

<br/>

## To the Script Market

Submit a PR to [CodexPlusPlusScriptMarket](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket):

1. Fork the market repo
2. Copy `codex-deepseek-billing.js` to `scripts/` in your fork
3. Add an entry to `index.json`:

```json
{
  "id": "codex-deepseek-billing",
  "name": "Codex DeepSeek Billing",
  "description": "Real-time DeepSeek V4 token usage, cost($), cache hit rate, and balance monitor",
  "version": "1.0.0",
  "author": "whishi47",
  "tags": ["deepseek", "billing", "tokens", "cost", "cache", "balance"],
  "homepage": "https://github.com/whishi47/codex-deepseek-billing",
  "script_url": "https://raw.githubusercontent.com/whishi47/codex-deepseek-billing/main/codex-deepseek-billing.js",
  "sha256": "<SHA-256 of the script>"
}
```

4. Submit the PR

<br/>

## License

MIT — see [LICENSE](./LICENSE).

<br/>

---

<p align="center">
  <sub>Built by <a href="https://github.com/whishi47">whishi47</a></sub>
  <br/>
  <sub>Codex DeepSeek Billing — MIT</sub>
</p>
