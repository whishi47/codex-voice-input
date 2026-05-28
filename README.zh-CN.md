# Codex Voice Input 🎤

> **Codex++ 语音输入插件** — 悬浮麦克风按钮，点击录音，自动转文字填入 Codex 输入框。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.9%2B-blue)](https://www.python.org/)
[![Codex++](https://img.shields.io/badge/Codex%2B%2B-plugin-orange)](https://github.com/BigPizzaV3/CodexPlusPlusScriptMarket)

## 功能

- 🎤 **一键录音**：Codex 对话框悬浮麦克风按钮，点击开始/停止录音
- 🔤 **自动转文字**：录音完成后自动发送到本地识别服务，文字自动填入输入框
- 🔒 **完全离线**：基于 faster-whisper 本地运行，录音数据不出本机
- 🌐 **中英文识别**：支持中文和英文，可配置语言偏好
- ⌨️ **快捷键**：`Ctrl+Shift+V` 切换录音
- 🎨 **毛玻璃 UI**：深色半透明按钮，完美融入 Codex 界面
- 📡 **服务检测**：识别服务断开时按钮自动灰显，恢复后自动重连

## 安装

### 1. 安装 Codex++ 用户脚本

将 `codex-voice-input.js` 复制到 Codex++ 用户脚本目录：

```cmd
copy /Y codex-voice-input.js "%APPDATA%\Codex++\user_scripts\codex-voice-input.js"
```

重启 Codex 后生效。

### 2. 启动语音识别服务

```bash
# 安装 Python 依赖（仅首次）
pip install -r requirements.txt

# 启动服务
python tools/voice-helper.py --port 17420 --model small
```

首次运行时 faster-whisper 会自动下载 `small` 模型（约 1.3GB）。

一键启动：

```cmd
tools\start-voice-helper.bat
```

## 使用

1. 确保识别服务已启动（控制台显示 "服务已启动，等待请求..."）
2. 在 Codex 对话框底部找到 🎤 按钮
3. **点击按钮**开始录音（红色脉冲动画）
4. 对着麦克风说话
5. **再次点击**停止录音 → 自动识别 → 文字填入输入框

> 💡 如果按钮显示**灰色**且提示"服务未连接"，说明识别服务未启动。启动 `tools/voice-helper.py` 后按钮会自动恢复。

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+V` | 切换录音 |

### 右键菜单

右键按钮可切换**内联**或**悬浮**显示模式。

## 配置

编辑 `config/config.json`：

```json
{
  "language": "zh",      // auto / zh / en
  "model": "small",      // tiny / base / small / medium / large-v3
  "helperPort": 17420
}
```

## 模型选择

| 模型 | 大小 | 中文准确率 | 速度 |
|------|------|-----------|------|
| tiny | 390MB | 一般 | 实时 |
| base | 580MB | 较好 | 实时 |
| **small** (推荐) | **1.3GB** | **优秀** | **1.5x** |
| medium | 2.6GB | 更优 | 2-3x |
| large-v3 | 5.7GB | 最佳 | 3-5x |

## 架构

```
Codex Electron 渲染进程
┌─────────────────────────────────┐
│  codex-voice-input.js           │
│  🎤 按钮 → AudioContext → WAV   │
│       ↓                         │
│  fetch POST → localhost:17420   │
└───────────────┬─────────────────┘
                │ HTTP
┌───────────────▼─────────────────┐
│  tools/voice-helper.py          │
│  Flask → faster-whisper → 文字  │
│  🔒 全程本地，不联网             │
└─────────────────────────────────┘
```

## 常见问题

**按钮显示灰色？**  
识别服务未启动，运行 `python tools/voice-helper.py` 即可。

**麦克风权限被拒绝？**  
在 Windows 隐私设置中允许 Codex 访问麦克风（设置 → 隐私 → 麦克风）。

**识别准确率不理想？**  
将 `config.json` 中的 `model` 改为 `medium` 或 `large-v3`（注意需要更大内存和存储）。

## 许可证

MIT
