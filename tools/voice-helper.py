#!/usr/bin/env python3
"""
Codex++ Voice Helper — 本地语音识别服务
基于 faster-whisper 的轻量 HTTP 转录服务，与 codex-voice-input.js 配合使用。

启动: python voice-helper.py --port 17420 --model small
"""

import argparse
import json
import os
import sys
import tempfile
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from io import BytesIO

# ─── 全局 ──────────────────────────────────────────────
MODEL = None
MODEL_SIZE = "small"
MODEL_LOADING = False
MODEL_LOADED_AT = 0
TOTAL_TRANSCRIBES = 0
TOTAL_AUDIO_SECONDS = 0.0
STARTED_AT = time.time()


def get_model(model_size="small"):
    """懒加载 faster-whisper 模型（首次调用时下载，之后缓存）"""
    global MODEL, MODEL_SIZE, MODEL_LOADING, MODEL_LOADED_AT
    if MODEL is not None and model_size == MODEL_SIZE:
        return MODEL

    # 模型大小变了，重新加载
    if MODEL is not None and model_size != MODEL_SIZE:
        MODEL = None

    if MODEL is None and not MODEL_LOADING:
        MODEL_LOADING = True
        print(f"[VoiceHelper] 正在加载模型: {model_size} (首次可能需要下载 ~1.3GB)...", flush=True)
        try:
            from faster_whisper import WhisperModel
            MODEL = WhisperModel(model_size, device="cpu", compute_type="int8")
            MODEL_SIZE = model_size
            MODEL_LOADED_AT = time.time()
            elapsed = MODEL_LOADED_AT - STARTED_AT
            print(f"[VoiceHelper] 模型加载完成 ({model_size}), 耗时 {elapsed:.1f}s", flush=True)
        except Exception as e:
            MODEL_LOADING = False
            raise RuntimeError(f"模型加载失败: {e}")
        finally:
            MODEL_LOADING = False

    return MODEL


def transcribe_audio(audio_path, language="auto", model_size="small"):
    """转录音频文件，返回 (text, detected_language)"""
    global TOTAL_TRANSCRIBES, TOTAL_AUDIO_SECONDS

    model = get_model(model_size)

    lang = None if language == "auto" else language
    segments, info = model.transcribe(
        audio_path,
        language=lang,
        beam_size=5,
        vad_filter=True,  # 过滤静音片段
    )

    text_parts = []
    for seg in segments:
        text_parts.append(seg.text.strip())

    text = " ".join(text_parts)

    TOTAL_TRANSCRIBES += 1
    TOTAL_AUDIO_SECONDS += info.duration

    print(f"[VoiceHelper] 转录完成: lang={info.language}, "
          f"duration={info.duration:.1f}s, text_len={len(text)}", flush=True)

    return text, info.language, info.duration


# ─── HTTP Server ───────────────────────────────────────

class VoiceHandler(BaseHTTPRequestHandler):
    """HTTP 请求处理器"""

    def log_message(self, format, *args):
        """自定义日志格式"""
        print(f"[VoiceHelper] {self.client_address[0]} - {format % args}", flush=True)

    def _send_json(self, data, status=200):
        """发送 JSON 响应"""
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, message, status=400, hint=None):
        """发送错误 JSON 响应"""
        data = {"error": message}
        if hint:
            data["hint"] = hint
        self._send_json(data, status)

    def do_OPTIONS(self):
        """CORS 预检"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/health":
            self._health()
        else:
            self._send_error_json("Not Found", 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path = parsed.path.rstrip("/")

        if path == "/transcribe":
            self._transcribe()
        elif path == "/health":
            self._health()
        else:
            self._send_error_json("Not Found", 404)

    def _health(self):
        """健康检查 + 服务状态"""
        uptime = time.time() - STARTED_AT
        model_status = "loaded" if MODEL is not None else ("loading" if MODEL_LOADING else "not_loaded")

        self._send_json({
            "status": "ok",
            "version": "1.0.0",
            "uptime_seconds": round(uptime, 1),
            "model": {
                "status": model_status,
                "size": MODEL_SIZE,
                "loaded_at": MODEL_LOADED_AT if MODEL_LOADED_AT else None,
            },
            "stats": {
                "total_transcribes": TOTAL_TRANSCRIBES,
                "total_audio_seconds": round(TOTAL_AUDIO_SECONDS, 1),
            }
        })

    def _transcribe(self):
        """接收 WAV 音频文件，返回转录文字"""
        global MODEL

        # 解析 multipart/form-data
        content_type = self.headers.get("Content-Type", "")
        if "multipart/form-data" not in content_type:
            self._send_error_json(
                "请求格式错误",
                status=400,
                hint="请使用 multipart/form-data 格式上传音频文件"
            )
            return

        # 读取请求体
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._send_error_json("请求体为空", status=400, hint="请上传音频文件")
            return

        body = self.rfile.read(content_length)

        # 从 multipart 中提取边界
        boundary = None
        for part in content_type.split(";"):
            part = part.strip()
            if part.startswith("boundary="):
                boundary = part[9:].strip('"')
                break

        if not boundary:
            self._send_error_json("无法解析 multipart 边界", status=400)
            return

        # 解析 multipart 数据
        boundary_bytes = boundary.encode("utf-8")
        parts = body.split(b"--" + boundary_bytes)

        audio_data = None
        language = "auto"
        model_size = MODEL_SIZE

        for part in parts:
            if b"Content-Disposition" not in part:
                continue

            # 分离头部和内容
            header_end = part.find(b"\r\n\r\n")
            if header_end == -1:
                continue

            header = part[:header_end].decode("utf-8", errors="ignore")
            content = part[header_end + 4:]

            # 去掉末尾的 \r\n--
            if content.endswith(b"\r\n"):
                content = content[:-2]
            if content.endswith(b"--"):
                content = content[:-2]
            if content.endswith(b"\r\n"):
                content = content[:-2]

            if 'name="audio"' in header:
                audio_data = content
            elif 'name="language"' in header:
                language = content.decode("utf-8", errors="ignore").strip()
            elif 'name="model"' in header:
                model_size = content.decode("utf-8", errors="ignore").strip()

        if not audio_data or len(audio_data) < 44:
            self._send_error_json(
                "未检测到有效的音频数据",
                status=400,
                hint=f"收到 {len(audio_data) if audio_data else 0} 字节数据，请检查录音是否正常"
            )
            return

        # 验证 WAV 头
        if audio_data[:4] != b"RIFF":
            self._send_error_json(
                "音频格式不正确，需要 WAV 格式",
                status=400,
                hint="请确保录音后正确构造了 WAV 文件头"
            )
            return

        # 保存临时文件
        tmp_path = None
        try:
            fd, tmp_path = tempfile.mkstemp(suffix=".wav", prefix="codex_voice_")
            os.close(fd)
            with open(tmp_path, "wb") as f:
                f.write(audio_data)

            print(f"[VoiceHelper] 收到音频: {len(audio_data)} bytes, "
                  f"language={language}, model={model_size}", flush=True)

            # 转录
            text, detected_lang, duration = transcribe_audio(
                tmp_path, language=language, model_size=model_size
            )

            if not text or not text.strip():
                self._send_error_json(
                    "未检测到语音输入",
                    status=200,
                    hint="请确保麦克风已启用，然后对着麦克风说话"
                )
                return

            self._send_json({
                "text": text.strip(),
                "language": detected_lang,
                "duration_seconds": round(duration, 1),
            })

        except RuntimeError as e:
            self._send_error_json(
                f"模型加载失败: {str(e)}",
                status=503,
                hint="请检查网络连接（首次使用需下载模型），或稍后重试"
            )
        except Exception as e:
            self._send_error_json(
                f"转录失败: {str(e)}",
                status=500,
                hint="请重试或检查音频文件是否损坏"
            )
        finally:
            # 清理临时文件
            if tmp_path and os.path.exists(tmp_path):
                try:
                    os.unlink(tmp_path)
                except OSError:
                    pass


# ─── 主函数 ────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Codex++ Voice Helper — 本地语音识别服务",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python voice-helper.py                          # 默认端口 17420，模型 small
  python voice-helper.py --port 8080              # 自定义端口
  python voice-helper.py --model medium          # 使用更大模型（更准但更慢）
  python voice-helper.py --model large-v3        # 最佳质量（需 ~5.7GB 模型文件）
        """,
    )
    parser.add_argument("--port", type=int, default=17420, help="HTTP 服务端口 (默认 17420)")
    parser.add_argument("--model", type=str, default="small",
                        choices=["tiny", "base", "small", "medium", "large-v3"],
                        help="Whisper 模型大小 (默认 small)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="监听地址 (默认 127.0.0.1)")

    args = parser.parse_args()

    global MODEL_SIZE, STARTED_AT
    MODEL_SIZE = args.model
    STARTED_AT = time.time()

    print(f"╔══════════════════════════════════════════════╗")
    print(f"║   Codex++ Voice Helper v1.0.0                ║")
    print(f"║   本地语音识别服务                            ║")
    print(f"╠══════════════════════════════════════════════╣")
    print(f"║  地址: http://{args.host}:{args.port}               ║")
    print(f"║  模型: {args.model:<10}                        ║")
    print(f"║  端点: /health  /transcribe                  ║")
    print(f"╚══════════════════════════════════════════════╝")
    print(f"")
    print(f"[VoiceHelper] 提示: 模型将在首次转录音频时自动加载", flush=True)

    try:
        server = HTTPServer((args.host, args.port), VoiceHandler)
        print(f"[VoiceHelper] 服务已启动，等待请求...", flush=True)
        print(f"[VoiceHelper] 按 Ctrl+C 停止服务", flush=True)
        server.serve_forever()
    except KeyboardInterrupt:
        print(f"\n[VoiceHelper] 服务已停止", flush=True)
        server.server_close()
    except OSError as e:
        if "Address already in use" in str(e) or "10048" in str(e):
            print(f"[VoiceHelper] 错误: 端口 {args.port} 已被占用，请使用 --port 指定其他端口", flush=True)
        else:
            print(f"[VoiceHelper] 错误: {e}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
