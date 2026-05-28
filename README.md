# Codex Voice Input 🎤

> **Codex++ plugin** — A floating microphone button for Codex Desktop. Click to record, click again to stop, and the transcribed text is automatically inserted into the Codex input box.

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)
[![Codex++](https://img.shields.io/badge/Codex%2B%2B-plugin-orange)](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket)

## ✨ Features

- 🎤 **One-Click Recording** — Floating button right inside the Codex composer area
- 🔤 **Auto Transcription** — Recording stops → local Whisper transcribes → text appears in the input
- 🔒 **100% Offline** — Powered by faster-whisper running locally; your voice never leaves your machine
- 🌐 **Chinese & English** — Excellent support for both languages, configurable preference
- ⌨️ **Keyboard Shortcut** — `Ctrl+Shift+V` to toggle recording
- 🎨 **Glassmorphism UI** — Dark translucent button that blends seamlessly with Codex
- 📡 **Service Detection** — Button greys out when the backend is offline, auto-reconnects

## 📦 Installation

### 1. Install Codex++ User Script

Copy `codex-voice-input.js` to your Codex++ user scripts directory:

```cmd
copy /Y codex-voice-input.js "%APPDATA%\Codex++\user_scripts\codex-voice-input.js"
```

Or via PowerShell:

```powershell
Copy-Item -LiteralPath .\codex-voice-input.js -Destination (Join-Path $env:APPDATA 'Codex++\user_scripts\codex-voice-input.js') -Force
```

Restart Codex to activate.

### 2. Start the Voice Helper

```bash
# Install Python dependencies (first time only)
pip install -r requirements.txt

# Start the transcription service
python tools/voice-helper.py --port 17420 --model small
```

> **Note:** On first run, faster-whisper will automatically download the `small` model (~1.3 GB). Make sure you have a stable internet connection.

#### One-click launchers

```cmd
tools\start-voice-helper.bat
```

```powershell
powershell -ExecutionPolicy Bypass -File tools\start-voice-helper.ps1
```

## 🚀 Usage

1. Make sure the voice helper is running (console shows "服务已启动，等待请求...")
2. Find the 🎤 button in the Codex composer toolbar
3. **Click** to start recording (button pulses red)
4. Speak into your microphone
5. **Click again** to stop
6. Wait for transcription (button spins blue) — text is auto-inserted

### Keyboard Shortcut

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+V` | Toggle recording (start/stop) |

### Right-Click Menu

Right-click the mic button to switch display modes:
- **Inline** — Fixed inside the Codex input toolbar
- **Floating** — Draggable, place anywhere on screen

When the voice helper service is not running, the button will appear **greyed out** with a "Service Offline" tooltip.

## ⚙️ Configuration

Edit `config/config.json`:

```json
{
  "language": "zh",       // auto / zh / en
  "model": "small",       // tiny / base / small / medium / large-v3
  "helperPort": 17420     // Local transcription service port
}
```

## 🧠 Model Selection

| Model | Size | Chinese Accuracy | Speed |
|-------|------|-----------------|-------|
| tiny | 390 MB | Fair | Realtime |
| base | 580 MB | Good | Realtime |
| **small** (recommended) | **1.3 GB** | **Excellent** | **1.5× realtime** |
| medium | 2.6 GB | Better | 2–3× |
| large-v3 | 5.7 GB | Best | 3–5× |

## 🏗️ Architecture

```
Codex Electron Renderer Process
┌──────────────────────────────────────────┐
│  codex-voice-input.js (Codex++ plugin)   │
│                                          │
│  🎤 Button → AudioContext (16kHz PCM)    │
│       │                     │            │
│       │ Click to toggle     │ WAV Blob   │
│       ▼                     ▼            │
│  [Record] → [Transcribe] → Insert Text   │
│                    │                     │
└────────────────────┼─────────────────────┘
                     │ HTTP POST (127.0.0.1:17420)
┌────────────────────▼─────────────────────┐
│  tools/voice-helper.py (Python)          │
│                                          │
│  HTTP Server → faster-whisper (small)    │
│  Receive WAV → Transcribe → Return Text  │
│                                          │
│  🔒 No network, no API, fully local      │
└──────────────────────────────────────────┘
```

## 🛠️ Development

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/codex-voice-input.git
cd codex-voice-input

# Install Python deps
pip install -r requirements.txt

# Start the helper
python tools/voice-helper.py

# Deploy the plugin
copy /Y codex-voice-input.js "%APPDATA%\Codex++\user_scripts\"
```

## ❓ FAQ

**Q: Why does the button appear grey?**  
A: The voice helper service is not running. Start it with `python tools/voice-helper.py`.

**Q: Microphone permission denied?**  
A: Allow Codex to access your microphone in Windows privacy settings (`Settings → Privacy → Microphone`).

**Q: Transcription quality is poor?**  
A: Try a larger model — set `"model": "medium"` in `config/config.json`. Note that larger models use more RAM and are slower.

**Q: Can I use a different port?**  
A: Yes. Start the helper with `--port 8080` and update `helperPort` in `config.json`.

## 🔗 Related Projects

- [CodexPlusPlusScriptMarket](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket) — Codex++ plugin marketplace
- [faster-whisper](https://github.com/SYSTRAN/faster-whisper) — CTranslate2-based Whisper implementation
- [Codex Desktop](https://github.com/openai/codex) — OpenAI Codex CLI & Desktop

## 📄 License

MIT — see [LICENSE](LICENSE) for details.
