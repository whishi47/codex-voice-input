<p align="center">
  <img src="./images/banner.svg" height="160" alt="Codex Voice Input" />
</p>

<h1 align="center">Codex Voice Input</h1>

<p align="center">
  A Codex++ plugin — floating microphone button with <b>local offline</b> Whisper transcription.<br>
  Click to record. Click again to transcribe. Text appears in your input box. ✨
</p>

<p align="center">
  <a href="./LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License" />
  </a>
  <a href="https://www.python.org/">
    <img src="https://img.shields.io/badge/python-3.9%2B-blue" alt="Python" />
  </a>
  <a href="https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket">
    <img src="https://img.shields.io/badge/Codex%2B%2B-plugin-orange" alt="Codex++" />
  </a>
</p>

<p align="center">
  <a href="./README.md">中文</a>
  ·
  <a href="#-features">Features</a>
  ·
  <a href="#-quick-start">Quick Start</a>
  ·
  <a href="#-configuration">Config</a>
  ·
  <a href="#-faq">FAQ</a>
</p>

---

## ✨ Features

- 🎤 **One-Click Recording** — Floating mic button right inside the Codex composer
- 🔤 **Auto Transcription** — Recording stops → local Whisper transcribes → text appears in the input
- 🔒 **100% Offline** — Powered by [faster-whisper](https://github.com/SYSTRAN/faster-whisper); your voice never leaves your machine
- 🌐 **Chinese & English** — Excellent bilingual recognition with configurable language preference
- ⌨️ **Keyboard Shortcut** — `Ctrl+Shift+V` to toggle recording
- 🎨 **Glassmorphism UI** — Dark translucent button that blends seamlessly with Codex
- 🪄 **Floating Menu** — Hover the floating button for recording, display mode, setup, and GitHub usage guide actions
- 📡 **Offline-Aware** — Button auto-greys out when backend is down, reconnects when it's back

## 🚀 Quick Start

### One-Command Install

Run this in PowerShell. It prefers the local installer when you are already inside the repository; otherwise it downloads the installer from GitHub, deploys the user script, and starts the local voice helper.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -Command '$localInstaller=Join-Path (Get-Location) ''tools\install-and-start.ps1''; if (Test-Path $localInstaller) { & powershell -NoProfile -ExecutionPolicy Bypass -File $localInstaller; } else { $u=''https://github.com/whishi47/codex-voice-input/raw/master/tools/install-and-start.ps1''; $p=Join-Path $env:TEMP ''codex-voice-input-install.ps1''; Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $p; & powershell -NoProfile -ExecutionPolicy Bypass -File $p; }'
```

The first real transcription may download the faster-whisper model. The helper can be online before that download finishes.

### 1. Install the User Script

Copy `codex-voice-input.js` to your Codex++ user scripts directory:

```cmd
copy /Y codex-voice-input.js "%APPDATA%\Codex++\user_scripts\"
```

Restart Codex to activate.

### 2. Start the Voice Helper

```bash
pip install -r requirements.txt
python tools/voice-helper.py --port 17420 --model small
```

> The first run downloads the faster-whisper `small` model (~1.3 GB). Make sure you have internet.

One-click launcher:

```cmd
tools\start-voice-helper.bat
```

### 3. Start Using

Find the 🎤 button in the Codex composer toolbar. Click to record, click again to stop — text auto-inserts into the input box.

> If the button appears **greyed out** with "Service Offline", the voice helper isn't running. Start it with `python tools/voice-helper.py` — the button recovers within 30 seconds.

### Demo

```
┌─ Codex Chat ───────────────────────────────────────┐
│                                                     │
│  Prompt:  Build me a login endpoint...               │
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │  [Type your prompt...]             🎤 ← here  │  │
│  └──────────────────────────────────────────────┘  │
│                                                     │
│  ① Click 🎤 → pulses red → speak                    │
│  ② Click 🎤 → spins blue → transcribing...          │
│  ③ Text appears in the input ✨                     │
└─────────────────────────────────────────────────────┘
```

## ⌨️ Usage

| Action | Description |
|--------|-------------|
| Click button | Start / stop recording |
| `Ctrl+Shift+V` | Keyboard toggle |
| Hover floating button | Open the floating menu |
| Right-click | Open the same action menu |
| Drag button | In floating mode, drag anywhere on screen |

### Floating Menu

The floating menu includes:

- Start / stop recording
- Switch inline / floating display
- Copy the one-command setup launcher
- Open the GitHub project and usage guide

## ⚙️ Configuration

Edit `config/config.json`:

```jsonc
{
  "language": "zh",       // auto / zh / en
  "model": "small",       // tiny / base / small / medium / large-v3
  "helperPort": 17420     // local service port
}
```

## 🧠 Model Selection

| Model | Size | Chinese Accuracy | Speed (10s audio) |
|-------|------|:---:|:---:|
| `tiny` | 390 MB | Fair | Realtime |
| `base` | 580 MB | Good | Realtime |
| **`small`** | **1.3 GB** | **Excellent** | **~7s** |
| `medium` | 2.6 GB | Better | ~20s |
| `large-v3` | 5.7 GB | Best | ~35s |

> `small` is recommended for the best speed–accuracy tradeoff.

## 🏗 Architecture

```
Codex Electron Renderer Process
┌──────────────────────────────────────────┐
│  codex-voice-input.js (Codex++ plugin)   │
│                                          │
│  🎤 → AudioContext 16kHz PCM → WAV      │
│         │                                │
│         │  fetch POST                    │
│         ▼                                │
│  text ← JSON  ← localhost:17420          │
│         │                                │
│  injected into Codex input               │
└──────────────────┬───────────────────────┘
                   │ HTTP (loopback)
┌──────────────────▼───────────────────────┐
│  tools/voice-helper.py (Python process)  │
│                                          │
│  HTTP Server → faster-whisper (small)    │
│  Receive WAV → Transcribe → Return JSON  │
│                                          │
│  🔒 No network · No API key · Fully local│
└──────────────────────────────────────────┘
```

## ❓ FAQ

<details>
<summary><b>The button is greyed out. What's wrong?</b></summary>

The voice helper service isn't running. Start it with `python tools/voice-helper.py` — the button auto-recovers within 30 seconds.
</details>

<details>
<summary><b>Microphone permission denied?</b></summary>

Go to Windows Settings → Privacy & Security → Microphone, and allow Codex to access your microphone.
</details>

<details>
<summary><b>Transcription quality is poor?</b></summary>

Set `"model": "medium"` or `"large-v3"` in `config.json`. Larger models use more RAM and disk space.
</details>

<details>
<summary><b>Can I use a different port?</b></summary>

Yes. Start the helper with `--port 8080` and update `helperPort` in `config.json`.
</details>

<details>
<summary><b>How much RAM does the service use?</b></summary>

`small`: ~2 GB · `medium`: ~3 GB · `large-v3`: ~6 GB.
</details>

## 🔗 Related Projects

- [CodexPlusPlusScriptMarket](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket) — Codex++ plugin marketplace
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2-based Whisper
- [Codex Desktop](https://github.com/openai/codex) — OpenAI Codex CLI & Desktop

## 🤝 Contribution Review

Issues and pull requests are welcome. For user safety, external code contributions require maintainer review before they are merged.

- Do not commit API keys, tokens, real user directories, email addresses, private network addresses, or credentialed URLs
- Run `npm test` after editing `codex-voice-input.js`
- Explain security impact for changes that touch installation, startup, dependencies, or local processes
- Maintainers review code, test results, and privacy-sensitive data before merging

## 📄 License

[MIT](./LICENSE) License
