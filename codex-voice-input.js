(() => {
  // Codex++ Voice Input �?悬浮麦克风语音输入插�?  // 点击按钮开始录音，再次点击停止，自动转文字填入 Codex 输入�?  // 依赖: tools/voice-helper.py (本地 faster-whisper 识别服务)

  const INSTALL_KEY = "__codexVoiceInputInstalled";
  const API_KEY = "__codexVoiceInput";
  const STYLE_ID = "codex-voice-input-style";
  const ROOT_ID = "codex-voice-input";
  const SCRIPT_VERSION = 104;

  const HELPER_URL = "http://127.0.0.1:17420";
  const TRANSCRIBE_URL = HELPER_URL + "/transcribe";
  const HEALTH_URL = HELPER_URL + "/health";
  const REPO_URL = "https://github.com/whishi47/codex-voice-input";
  const PROJECT_URL = REPO_URL + "#readme";
  const INSTALL_SCRIPT_URL = REPO_URL + "/raw/master/tools/install-and-start.ps1";
  const INSTALL_POWERSHELL = [
    "$ErrorActionPreference='Stop';",
    "$localInstaller=Join-Path (Get-Location) 'tools\\install-and-start.ps1';",
    "$cachedRoot=Join-Path $env:APPDATA 'Codex++\\codex-voice-input';",
    "$cachedInstaller=Join-Path $cachedRoot 'tools\\install-and-start.ps1';",
    "$cachedUserScript=Join-Path $cachedRoot 'codex-voice-input.js';",
    "$cachedHelper=Join-Path $cachedRoot 'tools\\voice-helper.py';",
    "if (Test-Path $localInstaller) {",
    "& powershell -NoProfile -ExecutionPolicy Bypass -File $localInstaller;",
    "} else {",
    "$u='" + INSTALL_SCRIPT_URL + "';",
    "$p=Join-Path $env:TEMP ('codex-voice-input-install-' + [guid]::NewGuid().ToString('N') + '.ps1');",
    "try {",
    "Invoke-WebRequest -UseBasicParsing -Uri $u -OutFile $p;",
    "} catch {",
    "if ((Test-Path $cachedInstaller) -and (Test-Path $cachedUserScript) -and (Test-Path $cachedHelper)) {",
    "Write-Host '[Codex Voice Input] 无法�?GitHub 下载安装器，改用本地缓存安装器�? -ForegroundColor Yellow;",
    "& powershell -NoProfile -ExecutionPolicy Bypass -File $cachedInstaller;",
    "return;",
    "}",
    "throw '无法�?GitHub 下载安装器，也没有找到完整的本地缓存项目。请检查网络，或先在项目目录里运行 tools\\install-and-start.ps1。详细信�? ' + $_.Exception.Message;",
    "}",
    "& powershell -NoProfile -ExecutionPolicy Bypass -File $p;",
    "}",
  ].join(" ");
  const INSTALL_COMMAND = "powershell -NoProfile -ExecutionPolicy Bypass -Command " + quotePowerShellCommand(INSTALL_POWERSHELL);

  const CONFIG_STORAGE_KEY = "__codexVoiceInputConfig";
  const UI_STATE_STORAGE_KEY = "__codexVoiceInputUiState";

  // ===== 常量 =====
  const SAMPLE_RATE = 16000;
  const MAX_RECORD_SECONDS = 60;
  const STATUS_IDLE = "idle";
  const STATUS_RECORDING = "recording";
  const STATUS_PROCESSING = "processing";
  const STATUS_DONE = "done";
  const STATUS_ERROR = "error";

  const DEFAULT_CONFIG = {
    language: "zh",
    model: "small",
    helperPort: 17420,
  };

  const DEFAULT_UI_STATE = {
    mode: "floating",
    floatingX: null,
    floatingY: null,
  };

  // ===== 去重安装 =====
  for (const key of Object.keys(window)) {
    if (!/CodexVoiceInput(?:Installed)?$/.test(key)) continue;
    const legacy = window[key];
    if (legacy && typeof legacy.destroy === "function") legacy.destroy();
    delete window[key];
  }

  document.getElementById(ROOT_ID)?.remove();
  document.getElementById(STYLE_ID)?.remove();

  if (window[INSTALL_KEY]) {
    const api = window[API_KEY];
    if (api && api.version !== SCRIPT_VERSION && typeof api.destroy === "function") {
      api.destroy();
    } else {
      if (api && typeof api.refresh === "function") api.refresh();
      return;
    }
  }

  window[INSTALL_KEY] = true;

  // ===== 状�?=====
  const state = {
    status: STATUS_IDLE,
    audioCtx: null,
    stream: null,
    source: null,
    processor: null,
    audioChunks: [],
    recordStartTime: 0,
    recordTimer: null,
    root: null,
    button: null,
    buttonSvg: null,
    statusLabel: null,
    waveformEl: null,
    uiState: DEFAULT_UI_STATE,
    lastText: "",
    helperOnline: null,       // null=checking, true=在线, false=离线
    helperModel: "",
    helperCheckTimer: null,
    hoverOpenTimer: null,
    hoverCloseTimer: null,
    suppressNextClick: false,
  };

  // ===== 配置 =====
  function readConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      return raw ? Object.assign({}, DEFAULT_CONFIG, JSON.parse(raw)) : Object.assign({}, DEFAULT_CONFIG);
    } catch (e) {
      return Object.assign({}, DEFAULT_CONFIG);
    }
  }

  function writeConfig(cfg) {
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(cfg));
    } catch (e) {}
  }

  function readUiState() {
    try {
      const raw = localStorage.getItem(UI_STATE_STORAGE_KEY);
      return raw ? Object.assign({}, DEFAULT_UI_STATE, JSON.parse(raw)) : Object.assign({}, DEFAULT_UI_STATE);
    } catch (e) {
      return Object.assign({}, DEFAULT_UI_STATE);
    }
  }

  function writeUiState(ui) {
    try {
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(ui));
    } catch (e) {}
  }

  // ===== 工具 =====
  function isVisibleElement(node) {
    if (!node || node.nodeType !== 1) return false;
    const style = window.getComputedStyle(node);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function quotePowerShellCommand(command) {
    return "'" + String(command).replace(/'/g, "''") + "'";
  }

  // ===== CSS =====
  function installStyle() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) {
      if (existing.dataset.version === String(SCRIPT_VERSION)) return;
      existing.remove();
    }
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.dataset.version = String(SCRIPT_VERSION);
    s.textContent = [
      // Root
      "#" + ROOT_ID + "{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;z-index:2147483646;}",
      "#" + ROOT_ID + "[hidden]{display:none!important;}",
      "#" + ROOT_ID + "[data-placement=floating]{position:fixed;z-index:2147483647;touch-action:none;user-select:none;cursor:grab;animation:cvi-float-enter .28s cubic-bezier(.2,.8,.2,1);}",

      // Mic Button
      "#" + ROOT_ID + " .cvi-mic-btn{",
      "  position:relative;display:flex;align-items:center;justify-content:center;",
      "  width:36px;height:36px;padding:0;border:1px solid rgba(255,255,255,.15);",
      "  border-radius:50%;background:rgba(12,16,28,.78);",
      "  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);",
      "  color:rgba(255,255,255,.82);cursor:pointer;outline:none;",
      "  transition:transform .18s ease,border-color .22s ease,color .22s ease,background .22s ease,box-shadow .22s ease;box-shadow:0 2px 8px rgba(0,0,0,.15);",
      "  -webkit-app-region:no-drag;overflow:visible;",
      "}",
      "#" + ROOT_ID + " .cvi-mic-btn::before{",
      "  content:\"\";position:absolute;inset:-5px;border-radius:inherit;",
      "  border:1px solid rgba(78,161,255,0);opacity:0;transform:scale(.82);pointer-events:none;",
      "}",
      "#" + ROOT_ID + " .cvi-mic-btn:hover{",
      "  border-color:rgba(78,161,255,.4);color:#fff;",
      "  box-shadow:0 4px 16px rgba(78,161,255,.15);",
      "  background:rgba(18,24,42,.88);",
      "  transform:translateY(-1px) scale(1.04);",
      "}",
      "#" + ROOT_ID + " .cvi-mic-btn:active{transform:scale(.94);}",
      "#" + ROOT_ID + "[data-placement=floating] .cvi-mic-btn:hover::before{animation:cvi-hover-pop .42s ease-out;}",

      // Button SVG icon
      "#" + ROOT_ID + " .cvi-mic-icon{",
      "  width:18px;height:18px;display:flex;align-items:center;justify-content:center;",
      "  transition:transform .15s ease;",
      "}",
      "#" + ROOT_ID + " .cvi-mic-icon svg{width:18px;height:18px;fill:currentColor;}",

      // Recording state
      "#" + ROOT_ID + "[data-status=recording] .cvi-mic-btn{",
      "  border-color:rgba(239,68,68,.6);color:#f87171;",
      "  background:rgba(30,10,10,.88);",
      "  animation:cvi-pulse-record 1.2s ease-in-out infinite;",
      "}",
      "#" + ROOT_ID + "[data-status=recording] .cvi-mic-btn::before{",
      "  border-color:rgba(239,68,68,.42);opacity:1;animation:cvi-record-ring 1.35s ease-out infinite;",
      "}",
      "#" + ROOT_ID + "[data-status=recording] .cvi-mic-btn:hover{",
      "  border-color:rgba(239,68,68,.8);color:#ef4444;",
      "  box-shadow:0 4px 20px rgba(239,68,68,.25);",
      "}",

      // Processing state
      "#" + ROOT_ID + "[data-status=processing] .cvi-mic-btn{",
      "  border-color:rgba(78,161,255,.5);color:#4ea1ff;",
      "}",
      "#" + ROOT_ID + "[data-status=processing] .cvi-processing-sheen{",
      "  display:block;animation:cvi-processing-sheen 1.05s ease-in-out infinite;",
      "}",
      "#" + ROOT_ID + "[data-status=processing] .cvi-mic-icon{",
      "  animation:cvi-spin .8s linear infinite;",
      "}",

      // Done state
      "#" + ROOT_ID + "[data-status=done] .cvi-mic-btn{",
      "  border-color:rgba(74,222,128,.5);color:#4ade80;",
      "  background:rgba(8,28,14,.88);",
      "  box-shadow:0 2px 12px rgba(74,222,128,.2);",
      "}",
      "#" + ROOT_ID + "[data-status=done] .cvi-done-spark{",
      "  display:block;animation:cvi-done-spark .55s ease-out both;",
      "}",

      // Helper disconnected state
      "#" + ROOT_ID + "[data-helper=offline] .cvi-mic-btn{",
      "  border-color:rgba(255,255,255,.08);color:rgba(255,255,255,.3);",
      "  background:rgba(12,16,28,.5);cursor:not-allowed;opacity:.55;",
      "}",
      "#" + ROOT_ID + "[data-helper=offline] .cvi-mic-btn:hover{",
      "  border-color:rgba(255,255,255,.1);color:rgba(255,255,255,.4);",
      "  box-shadow:none;background:rgba(12,16,28,.55);",
      "}",
      "#" + ROOT_ID + "[data-helper=offline][data-status=idle] .cvi-status-label{",
      "  display:block;color:rgba(255,255,255,.45);bottom:-20px;",
      "}",

      // Error state
      "#" + ROOT_ID + "[data-status=error] .cvi-mic-btn{",
      "  border-color:rgba(239,68,68,.5);color:#f87171;",
      "}",

      // Waveform indicator (recording)
      "#" + ROOT_ID + " .cvi-waveform{",
      "  display:none;position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);",
      "  width:48px;height:48px;pointer-events:none;",
      "}",
      "#" + ROOT_ID + "[data-status=recording] .cvi-waveform{display:block;}",
      "#" + ROOT_ID + " .cvi-processing-sheen{",
      "  display:none;position:absolute;inset:5px;border-radius:50%;pointer-events:none;",
      "  background:linear-gradient(115deg,transparent 10%,rgba(78,161,255,.34) 45%,transparent 75%);",
      "}",
      "#" + ROOT_ID + " .cvi-done-spark{",
      "  display:none;position:absolute;inset:-7px;border-radius:50%;pointer-events:none;",
      "  border:1px solid rgba(74,222,128,.55);",
      "}",

      // Status tooltip label
      "#" + ROOT_ID + " .cvi-status-label{",
      "  display:none;position:absolute;bottom:-22px;left:50%;transform:translateX(-50%);",
      "  padding:2px 8px;border-radius:4px;",
      "  background:rgba(0,0,0,.85);color:rgba(255,255,255,.8);",
      "  font:10px/1.4 system-ui,-apple-system,sans-serif;white-space:nowrap;",
      "  pointer-events:none;",
      "}",
      "#" + ROOT_ID + "[data-status=recording] .cvi-status-label{display:block;color:#f87171;}",
      "#" + ROOT_ID + "[data-status=processing] .cvi-status-label{display:block;color:#4ea1ff;}",
      "#" + ROOT_ID + "[data-status=done] .cvi-status-label{display:block;color:#4ade80;}",
      "#" + ROOT_ID + "[data-status=error] .cvi-status-label{display:block;color:#f87171;}",

      // Animations
      "@keyframes cvi-float-enter{",
      "  from{opacity:0;transform:translateY(8px) scale(.88)}",
      "  to{opacity:1;transform:translateY(0) scale(1)}",
      "}",
      "@keyframes cvi-hover-pop{",
      "  0%{opacity:0;transform:scale(.82);border-color:rgba(78,161,255,0)}",
      "  45%{opacity:1;transform:scale(1.16);border-color:rgba(78,161,255,.48)}",
      "  100%{opacity:0;transform:scale(1.28);border-color:rgba(78,161,255,0)}",
      "}",
      "@keyframes cvi-pulse-record{",
      "  0%,100%{box-shadow:0 2px 8px rgba(239,68,68,.2);}",
      "  50%{box-shadow:0 2px 20px rgba(239,68,68,.4);}",
      "}",
      "@keyframes cvi-record-ring{",
      "  0%{opacity:.72;transform:scale(.86)}",
      "  100%{opacity:0;transform:scale(1.5)}",
      "}",
      "@keyframes cvi-processing-sheen{",
      "  0%{transform:rotate(0deg) translateX(-3px);opacity:.35}",
      "  50%{opacity:.85}",
      "  100%{transform:rotate(360deg) translateX(-3px);opacity:.35}",
      "}",
      "@keyframes cvi-done-spark{",
      "  0%{opacity:0;transform:scale(.78)}",
      "  45%{opacity:1;transform:scale(1.12)}",
      "  100%{opacity:0;transform:scale(1.34)}",
      "}",
      "@keyframes cvi-spin{",
      "  from{transform:rotate(0deg)}",
      "  to{transform:rotate(360deg)}",
      "}",
      "@keyframes cvi-fade-done{",
      "  0%{opacity:1;transform:scale(1)}",
      "  100%{opacity:0;transform:scale(.8)}",
      "}",

      // Toast notification
      ".cvi-toast{",
      "  position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:2147483647;",
      "  padding:10px 20px;border-radius:10px;",
      "  background:rgba(12,16,28,.94);color:#fff;",
      "  backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);",
      "  border:1px solid rgba(255,255,255,.15);",
      "  font:13px/1.4 system-ui,-apple-system,sans-serif;",
      "  box-shadow:0 8px 32px rgba(0,0,0,.3);",
      "  animation:cvi-toast-in .25s ease, cvi-toast-out .25s ease 2.5s forwards;",
      "  pointer-events:none;",
      "}",
      ".cvi-toast.cvi-toast-error{",
      "  border-color:rgba(239,68,68,.4);color:#f87171;",
      "}",
      ".cvi-toast.cvi-toast-success{",
      "  border-color:rgba(74,222,128,.4);color:#4ade80;",
      "}",
      ".cvi-context-menu{",
      "  animation:cvi-menu-in .16s cubic-bezier(.2,.8,.2,1);transform-origin:top left;",
      "}",
      ".cvi-context-menu button{",
      "  transition:background .14s ease,transform .14s ease,color .14s ease;",
      "}",
      ".cvi-context-menu button:not(:disabled):hover{",
      "  background:rgba(255,255,255,.08)!important;transform:translateX(2px);",
      "}",
      "@keyframes cvi-menu-in{",
      "  from{opacity:0;transform:translateY(4px) scale(.96)}",
      "  to{opacity:1;transform:translateY(0) scale(1)}",
      "}",
      "@keyframes cvi-toast-in{",
      "  from{opacity:0;transform:translateX(-50%) translateY(12px)}",
      "  to{opacity:1;transform:translateX(-50%) translateY(0)}",
      "}",
      "@keyframes cvi-toast-out{",
      "  from{opacity:1}",
      "  to{opacity:0}",
      "}",
      "@media (prefers-reduced-motion:reduce){",
      "  #" + ROOT_ID + ",#" + ROOT_ID + " *, .cvi-context-menu,.cvi-context-menu *, .cvi-toast{",
      "    animation:none!important;transition:none!important;",
      "  }",
      "}",
    ].join("");

    (document.head || document.documentElement).appendChild(s);
  }

  // ===== Toast 提示 =====
  function showToast(message, type) {
    // 移除�?toast
    document.querySelectorAll(".cvi-toast").forEach(function(t) { t.remove(); });

    var toast = document.createElement("div");
    toast.className = "cvi-toast" + (type ? " cvi-toast-" + type : "");
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(function() {
      if (toast.parentNode) toast.remove();
    }, 2800);
  }

  function showSetupHelp() {
    navigator.clipboard.writeText(INSTALL_COMMAND).then(function() {
      showToast("已复制一键安装启动命令，请粘贴到 PowerShell 运行", "success");
    }).catch(function() {
      showToast("请在 PowerShell 运行一键安装启动命�?, "error");
    });
    console.log("[VoiceInput] One-command setup:", INSTALL_COMMAND);
  }

  function openProjectGuide() {
    try {
      window.open(PROJECT_URL, "_blank", "noopener,noreferrer");
      showToast("已打开 GitHub 使用说明", "success");
    } catch (e) {
      navigator.clipboard.writeText(PROJECT_URL).then(function() {
        showToast("GitHub 地址已复制到剪贴�?, "");
      }).catch(function() {});
    }
  }

  // ===== DOM 创建 =====
  function ensureRoot() {
    var root = document.getElementById(ROOT_ID);
    if (root) {
      state.root = root;
      state.button = root.querySelector(".cvi-mic-btn");
      state.buttonSvg = root.querySelector(".cvi-mic-icon");
      state.statusLabel = root.querySelector(".cvi-status-label");
      state.waveformEl = root.querySelector(".cvi-waveform");
      installFloatingDrag(root);
      installHoverMenu(root);
      mountRoot(root);
      updateButtonUI();
      return root;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.setAttribute("data-status", STATUS_IDLE);
    root.setAttribute("title", "语音输入 �?点击开始录�?);

    // Mic SVG icon
    var micSvg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>' +
      '<path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>' +
      '</svg>';

    root.innerHTML =
      '<button class="cvi-mic-btn" type="button">' +
        '<span class="cvi-mic-icon">' + micSvg + '</span>' +
        '<span class="cvi-waveform"></span>' +
        '<span class="cvi-processing-sheen"></span>' +
        '<span class="cvi-done-spark"></span>' +
        '<span class="cvi-status-label">录音�?..</span>' +
      '</button>';

    state.root = root;
    state.button = root.querySelector(".cvi-mic-btn");
    state.buttonSvg = root.querySelector(".cvi-mic-icon");
    state.statusLabel = root.querySelector(".cvi-status-label");
    state.waveformEl = root.querySelector(".cvi-waveform");

    // 事件绑定
    state.button.addEventListener("click", handleMicClick);
    state.button.addEventListener("click", function(e) {
      if (!state.suppressNextClick) return;
      state.suppressNextClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    // 右键菜单：切换模�?    state.button.addEventListener("contextmenu", function(e) {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY);
    });

    installFloatingDrag(root);
    installHoverMenu(root);
    mountRoot(root);
    updateButtonUI();
    updateHelperUI();

    // 检�?helper 服务是否在线
    checkHelperHealth();

    return root;
  }

  // ===== 菜单 =====
  function buildVoiceMenuItems() {
    var isFloating = state.uiState.mode === "floating";
    var recordLabel = state.status === STATUS_RECORDING ? "停止录音" : "开始录�?;
    if (state.status === STATUS_PROCESSING) recordLabel = "识别�?..";

    return [
      {
        label: recordLabel,
        action: handleMicClick,
        checked: state.status === STATUS_RECORDING,
        disabled: state.status === STATUS_PROCESSING,
      },
      { label: "内联显示", action: function() { switchMode("inline"); }, checked: !isFloating },
      { label: "悬浮显示", action: function() { switchMode("floating"); }, checked: isFloating },
      { label: "安装/启动语音服务", action: showSetupHelp, checked: false },
      { label: "GitHub / 使用说明", action: openProjectGuide, checked: false },
    ];
  }

  function closeVoiceMenu(source) {
    var selector = source ? '.cvi-context-menu[data-menu-source="' + source + '"]' : ".cvi-context-menu";
    document.querySelectorAll(selector).forEach(function(menu) { menu.remove(); });
  }

  function showVoiceMenu(x, y, source) {
    closeVoiceMenu();

    var menu = document.createElement("div");
    menu.className = "cvi-context-menu";
    menu.setAttribute("data-menu-source", source || "context");
    menu.style.cssText =
      "position:fixed;z-index:2147483647;min-width:168px;padding:4px;" +
      "border:1px solid rgba(255,255,255,.14);border-radius:8px;" +
      "background:rgba(12,16,28,.96);color:rgba(255,255,255,.92);" +
      "box-shadow:0 8px 32px rgba(0,0,0,.36);" +
      "font:12px/1.35 system-ui,-apple-system,sans-serif;" +
      "backdrop-filter:blur(12px);-webkit-app-region:no-drag;";

    var items = buildVoiceMenuItems();
    var html = "";
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      html += '<button ' + (item.disabled ? "disabled " : "") +
        'style="display:flex;align-items:center;gap:6px;width:100%;' +
        'padding:6px 8px;border:0;border-radius:5px;background:transparent;' +
        'color:inherit;font:inherit;cursor:' + (item.disabled ? "default" : "pointer") + ';text-align:left;">' +
        '<span style="flex:0 0 14px;width:14px;color:#86efac;font-weight:700;text-align:center;">' +
        (item.checked ? '\u2713' : '') + '</span>' +
        '<span>' + item.label + '</span></button>';
    }

    menu.innerHTML = html;
    document.body.appendChild(menu);

    var mw = 168, mh = items.length * 32 + 8;
    menu.style.left = Math.max(8, Math.min(x, window.innerWidth - mw - 8)) + "px";
    menu.style.top = Math.max(8, Math.min(y, window.innerHeight - mh - 8)) + "px";

    var buttons = menu.querySelectorAll("button");
    for (var j = 0; j < buttons.length; j++) {
      (function(idx) {
        buttons[idx].addEventListener("click", function() {
          if (items[idx].disabled) return;
          items[idx].action();
          closeVoiceMenu();
        });
      })(j);
    }

    if (source === "hover") {
      menu.addEventListener("mouseenter", function() {
        clearTimeout(state.hoverCloseTimer);
      });
      menu.addEventListener("mouseleave", function() {
        scheduleHoverMenuClose();
      });
    }

    var closeListener = function(e) {
      if (!menu.contains(e.target)) {
        closeVoiceMenu();
        document.removeEventListener("click", closeListener, true);
      }
    };
    setTimeout(function() {
      document.addEventListener("click", closeListener, true);
    }, 10);
  }

  function showContextMenu(x, y) {
    showVoiceMenu(x, y, "context");
  }

  function scheduleHoverMenuClose() {
    clearTimeout(state.hoverCloseTimer);
    state.hoverCloseTimer = setTimeout(function() {
      closeVoiceMenu("hover");
    }, 240);
  }

  function installHoverMenu(root) {
    if (state._hoverCleanup) return;

    function openFromHover() {
      if (root.dataset.placement !== "floating") return;
      clearTimeout(state.hoverCloseTimer);
      clearTimeout(state.hoverOpenTimer);
      state.hoverOpenTimer = setTimeout(function() {
        if (!state.root || root.dataset.placement !== "floating") return;
        var rect = state.root.getBoundingClientRect();
        showVoiceMenu(rect.right + 8, rect.top, "hover");
      }, 220);
    }

    function closeFromHover() {
      clearTimeout(state.hoverOpenTimer);
      scheduleHoverMenuClose();
    }

    root.addEventListener("mouseenter", openFromHover);
    root.addEventListener("mouseleave", closeFromHover);

    state._hoverCleanup = function() {
      root.removeEventListener("mouseenter", openFromHover);
      root.removeEventListener("mouseleave", closeFromHover);
      clearTimeout(state.hoverOpenTimer);
      clearTimeout(state.hoverCloseTimer);
      closeVoiceMenu("hover");
    };
  }

  function switchMode(mode) {
    closeVoiceMenu("hover");
    state.uiState.mode = mode;
    writeUiState(state.uiState);
    mountRoot(state.root);
    updateButtonUI();
  }

  // ===== 挂载逻辑 =====
  function findInlineMount() {
    var visibleChildren = function(node) {
      return Array.from(node.children || []).filter(function(c) {
        return c.id !== ROOT_ID && isVisibleElement(c);
      });
    };

    // 策略 1: �?composer-footer 中的 justify-end 区域
    var footers = Array.from(document.querySelectorAll(".composer-footer"))
      .filter(function(f) {
        return isVisibleElement(f) && f.getBoundingClientRect().top > window.innerHeight * 0.45;
      })
      .sort(function(a, b) {
        return b.getBoundingClientRect().top - a.getBoundingClientRect().top;
      });

    for (var i = 0; i < footers.length; i++) {
      var footer = footers[i];
      var rightGroup = visibleChildren(footer).find(function(c) {
        var cls = typeof c.className === "string" ? c.className : "";
        return /justify-end/.test(cls) && c.querySelector("button, [role='button']");
      });
      if (rightGroup) {
        return { parent: rightGroup };
      }
    }

    // 策略 2: 找输入框附近的工具栏
    var inputs = document.querySelectorAll("textarea, [contenteditable=true], [role='textbox']");
    for (var j = 0; j < inputs.length; j++) {
      if (!isVisibleElement(inputs[j])) continue;
      var rect = inputs[j].getBoundingClientRect();
      if (rect.top < window.innerHeight * 0.3) continue;

      // 向父级查找工具栏
      var parent = inputs[j].parentElement;
      for (var level = 0; level < 4; level++) {
        if (!parent) break;
        var buttons = parent.querySelectorAll("button, [role='button']");
        if (buttons.length > 0 && buttons.length < 20) {
          // 找最后一个可见按钮所在容�?          var lastBtn = null;
          buttons.forEach(function(b) {
            if (b.closest && b.closest("#" + ROOT_ID)) return;
            if (isVisibleElement(b)) lastBtn = b;
          });
          if (lastBtn) {
            return { parent: lastBtn.parentElement, before: lastBtn };
          }
        }
        parent = parent.parentElement;
      }
    }

    return null;
  }

  function mountRoot(root) {
    state.uiState = readUiState();

    if (state.uiState.mode === "floating") {
      // Floating mode always moves root under body to avoid clipping by the composer.
      (document.body || document.documentElement).appendChild(root);
      root.dataset.placement = "floating";

      // 恢复位置
      if (state.uiState.floatingX != null && state.uiState.floatingY != null) {
        root.style.left = state.uiState.floatingX + "px";
        root.style.top = state.uiState.floatingY + "px";
      } else {
        // 默认右下�?        root.style.left = (window.innerWidth - 60) + "px";
        root.style.top = (window.innerHeight - 100) + "px";
      }
    } else {
      // 内联模式
      var mount = findInlineMount();
      if (mount && mount.parent) {
        state.inlineHost = mount.parent;
        state.inlineBefore = mount.before || null;
        root.dataset.placement = "inline";
        root.style.left = "";
        root.style.top = "";
        if (mount.before) {
          mount.parent.insertBefore(root, mount.before);
        } else {
          mount.parent.appendChild(root);
        }
      } else {
        // 兜底：悬�?        (document.body || document.documentElement).appendChild(root);
        root.dataset.placement = "floating";
        root.style.left = (window.innerWidth - 60) + "px";
        root.style.top = (window.innerHeight - 100) + "px";
      }
    }
  }

  // ===== 悬浮拖拽 =====
  function installFloatingDrag(root) {
    var dragging = false;
    var startX, startY, origLeft, origTop;
    var dragThreshold = 3;
    var moved = false;

    function onPointerDown(e) {
      if (root.dataset.placement !== "floating") return;
      if (state.status === STATUS_RECORDING) return; // 录音中不拖拽
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      clearTimeout(state.hoverOpenTimer);
      closeVoiceMenu("hover");
      startX = e.clientX;
      startY = e.clientY;
      origLeft = parseInt(root.style.left) || 0;
      origTop = parseInt(root.style.top) || 0;
      root.setPointerCapture(e.pointerId);
      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerMove(e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      var dy = e.clientY - startY;
      if (Math.abs(dx) < dragThreshold && Math.abs(dy) < dragThreshold) return;
      moved = true;
      root.style.left = Math.max(0, Math.min(window.innerWidth - 48, origLeft + dx)) + "px";
      root.style.top = Math.max(0, Math.min(window.innerHeight - 48, origTop + dy)) + "px";
      e.preventDefault();
      e.stopPropagation();
    }

    function onPointerUp(e) {
      if (!dragging) return;
      dragging = false;
      try { root.releasePointerCapture(e.pointerId); } catch (ex) {}
      if (moved) {
        state.suppressNextClick = true;
        state.uiState.floatingX = parseInt(root.style.left) || 0;
        state.uiState.floatingY = parseInt(root.style.top) || 0;
        writeUiState(state.uiState);
      }
      e.preventDefault();
      e.stopPropagation();
    }

    root.addEventListener("pointerdown", onPointerDown);
    // Use document-level listeners for move/up �?more reliable for drag
    document.addEventListener("pointermove", onPointerMove, true);
    document.addEventListener("pointerup", onPointerUp, true);
    document.addEventListener("pointercancel", onPointerUp, true);

    state._floatingCleanup = function() {
      root.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("pointermove", onPointerMove, true);
      document.removeEventListener("pointerup", onPointerUp, true);
      document.removeEventListener("pointercancel", onPointerUp, true);
    };
  }

  // ===== 按钮状�?UI =====
  function setStatus(newStatus) {
    state.status = newStatus;
    state.root.setAttribute("data-status", newStatus);
    updateButtonUI();

    // done 状�?2 秒后自动恢复 idle
    if (newStatus === STATUS_DONE || newStatus === STATUS_ERROR) {
      clearTimeout(state._resetTimer);
      state._resetTimer = setTimeout(function() {
        if (state.status === newStatus) {
          setStatus(STATUS_IDLE);
        }
      }, newStatus === STATUS_DONE ? 2000 : 3000);
    }
  }

  function updateButtonUI() {
    if (!state.button || !state.statusLabel) return;

    var labels = {};
    labels[STATUS_IDLE] = "";
    labels[STATUS_RECORDING] = "录音�?..";
    labels[STATUS_PROCESSING] = "识别�?..";
    labels[STATUS_DONE] = "完成";
    labels[STATUS_ERROR] = "失败";

    var titles = {};
    titles[STATUS_IDLE] = "语音输入 �?点击开始录�?;
    titles[STATUS_RECORDING] = "点击停止录音";
    titles[STATUS_PROCESSING] = "正在识别语音...";
    titles[STATUS_DONE] = "识别完成，已填入输入�?;
    titles[STATUS_ERROR] = "识别失败，点击重�?;

    state.statusLabel.textContent = labels[state.status] || "";
    state.button.title = titles[state.status] || "语音输入";
  }

  // ===== 音频采集 =====
  async function startRecording() {
    try {
      var stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: SAMPLE_RATE,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      var audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SAMPLE_RATE });
      var source = audioCtx.createMediaStreamSource(stream);

      // 使用 ScriptProcessorNode 采集原始 PCM
      var processor = audioCtx.createScriptProcessor(4096, 1, 1);
      state.audioChunks = [];

      processor.onaudioprocess = function(e) {
        if (state.status !== STATUS_RECORDING) return;
        var inputData = e.inputBuffer.getChannelData(0);
        // 复制一份（避免复用 buffer�?        state.audioChunks.push(new Float32Array(inputData));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);

      state.audioCtx = audioCtx;
      state.stream = stream;
      state.source = source;
      state.processor = processor;
      state.recordStartTime = Date.now();

      // 最长录音时间保�?      state.recordTimer = setTimeout(function() {
        if (state.status === STATUS_RECORDING) {
          showToast("已达最长录音时�?(60�?，自动停�?, "");
          stopAndTranscribe();
        }
      }, MAX_RECORD_SECONDS * 1000);

    } catch (e) {
      console.error("[VoiceInput] 录音启动失败:", e);
      if (e.name === "NotAllowedError") {
        showToast("麦克风权限被拒绝，请在浏览器设置中允许麦克风访问", "error");
      } else if (e.name === "NotFoundError") {
        showToast("未检测到麦克风设�?, "error");
      } else {
        showToast("录音启动失败: " + (e.message || "未知错误"), "error");
      }
      setStatus(STATUS_ERROR);
      cleanupAudio();
      throw e;
    }
  }

  function stopRecording() {
    if (state.recordTimer) {
      clearTimeout(state.recordTimer);
      state.recordTimer = null;
    }

    if (state.processor) {
      state.processor.disconnect();
      state.processor = null;
    }
    if (state.source) {
      state.source.disconnect();
      state.source = null;
    }
    if (state.audioCtx) {
      state.audioCtx.close().catch(function() {});
      state.audioCtx = null;
    }
    if (state.stream) {
      state.stream.getTracks().forEach(function(track) { track.stop(); });
      state.stream = null;
    }
  }

  function buildWavBlob() {
    // 合并所�?PCM 数据
    var totalLength = 0;
    for (var i = 0; i < state.audioChunks.length; i++) {
      totalLength += state.audioChunks[i].length;
    }

    if (totalLength === 0) return null;

    var pcmData = new Float32Array(totalLength);
    var offset = 0;
    for (var j = 0; j < state.audioChunks.length; j++) {
      pcmData.set(state.audioChunks[j], offset);
      offset += state.audioChunks[j].length;
    }

    // Float32 �?Int16 PCM
    var int16Length = pcmData.length;
    var wavBuffer = new ArrayBuffer(44 + int16Length * 2);
    var view = new DataView(wavBuffer);

    // RIFF header
    writeString(view, 0, "RIFF");
    view.setUint32(4, 36 + int16Length * 2, true);
    writeString(view, 8, "WAVE");

    // fmt chunk
    writeString(view, 12, "fmt ");
    view.setUint32(16, 16, true);        // chunk size
    view.setUint16(20, 1, true);         // PCM format
    view.setUint16(22, 1, true);         // mono
    view.setUint32(24, SAMPLE_RATE, true);
    view.setUint32(28, SAMPLE_RATE * 2, true); // byte rate
    view.setUint16(32, 2, true);         // block align
    view.setUint16(34, 16, true);        // bits per sample

    // data chunk
    writeString(view, 36, "data");
    view.setUint32(40, int16Length * 2, true);

    // Write samples
    var dataOffset = 44;
    for (var k = 0; k < pcmData.length; k++) {
      var s = Math.max(-1, Math.min(1, pcmData[k]));
      view.setInt16(dataOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      dataOffset += 2;
    }

    return new Blob([wavBuffer], { type: "audio/wav" });
  }

  function writeString(view, offset, str) {
    for (var i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  function cleanupAudio() {
    stopRecording();
    state.audioChunks = [];
  }

  // ===== 核心流程 =====
  async function handleMicClick(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    // 服务未连接时不允许录�?    if (state.helperOnline === false) {
      showSetupHelp();
      return;
    }
    if (state.helperOnline === null) {
      showToast("正在检测识别服务，请稍�?..", "");
      return;
    }

    switch (state.status) {
      case STATUS_IDLE:
      case STATUS_DONE:
      case STATUS_ERROR:
        // 开始录�?        cleanupAudio();
        setStatus(STATUS_RECORDING);
        try {
          await startRecording();
        } catch (err) {
          // 错误已在 startRecording 中处�?        }
        break;

      case STATUS_RECORDING:
        // 停止录音 �?转录
        stopAndTranscribe();
        break;

      case STATUS_PROCESSING:
        // 处理中，不允许操�?        showToast("正在识别中，请稍�?..", "");
        break;
    }
  }

  async function stopAndTranscribe() {
    if (state.audioChunks.length === 0) {
      cleanupAudio();
      setStatus(STATUS_IDLE);
      showToast("未录制到音频，请重试", "error");
      return;
    }

    var wavBlob = buildWavBlob();
    cleanupAudio();
    setStatus(STATUS_PROCESSING);

    if (!wavBlob || wavBlob.size < 100) {
      setStatus(STATUS_ERROR);
      showToast("录制的音频太短，请重�?, "error");
      return;
    }

    console.log("[VoiceInput] 录音完成: " + (wavBlob.size / 1024).toFixed(1) + "KB, 开始转�?..");

    try {
      var config = readConfig();
      var formData = new FormData();
      formData.append("audio", wavBlob, "recording.wav");
      formData.append("language", config.language || "zh");
      formData.append("model", config.model || "small");

      var res = await fetch(TRANSCRIBE_URL, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        if (res.status === 0 || res.status >= 500) {
          throw new Error("语音识别服务未响�?);
        }
        throw new Error("服务返回错误: " + res.status);
      }

      var data = await res.json();

      if (data.error) {
        throw new Error(data.error);
      }

      if (!data.text || !data.text.trim()) {
        setStatus(STATUS_IDLE);
        showToast("未检测到语音内容，请靠近麦克风再�?, "error");
        return;
      }

      // 注入文字�?Codex 输入�?      var text = data.text.trim();
      insertText(text);
      state.lastText = text;

      setStatus(STATUS_DONE);
      var langLabel = data.language === "zh" ? "中文" : (data.language || "未知");
      showToast("识别完成 (" + langLabel + ", " + (data.duration_seconds || "?") + "s)", "success");

      console.log("[VoiceInput] 转录完成: lang=" + data.language +
        ", dur=" + data.duration_seconds + "s, text=" + text.substring(0, 50) + "...");

    } catch (e) {
      console.error("[VoiceInput] 转录失败:", e);
      setStatus(STATUS_ERROR);

      if (e.message && e.message.includes("未响�?)) {
        showSetupHelp();
      } else {
        showToast("识别失败: " + (e.message || "未知错误"), "error");
      }
    }
  }

  // ===== 文字注入 =====
  function insertText(text) {
    // �?Codex 输入框（textarea �?contenteditable�?    var input = document.querySelector("textarea:not([readonly])");
    if (!input) {
      input = document.querySelector("[contenteditable=true]");
    }
    if (!input) {
      input = document.querySelector("[role='textbox']");
    }
    if (!input) {
      // 兜底：复制到剪贴�?      navigator.clipboard.writeText(text).then(function() {
        showToast("未找到输入框，文字已复制到剪贴板", "");
      }).catch(function() {});
      return;
    }

    try {
      // textarea / input
      if (input.tagName === "TEXTAREA" || input.tagName === "INPUT") {
        var start = input.selectionStart || input.value.length;
        var before = input.value.substring(0, start);
        var after = input.value.substring(input.selectionEnd || start);
        // 如果前面有文字且不以空格结尾，自动加空格
        var prefix = before && !/[\s\n]$/.test(before) ? " " : "";
        input.value = before + prefix + text + after;

        // 移动光标到插入文本末�?        var newPos = start + prefix.length + text.length;
        input.setSelectionRange(newPos, newPos);

        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.focus();
      } else {
        // contenteditable
        input.focus();
        // 如果已有内容，先加个空格
        if (input.textContent && !/[\s\n]$/.test(input.textContent)) {
          document.execCommand("insertText", false, " ");
        }
        document.execCommand("insertText", false, text);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
    } catch (e) {
      // 兜底：复制到剪贴�?      navigator.clipboard.writeText(text).then(function() {
        showToast("文字已复制到剪贴板，请手动粘�?, "");
      }).catch(function() {});
    }
  }

  // ===== Helper 健康检�?=====
  async function checkHelperHealth() {
    try {
      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 4000);
      var res = await fetch(HEALTH_URL, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        var data = await res.json();
        state.helperOnline = true;
        state.helperModel = (data.model && data.model.size) ? data.model.size : "";
        console.log("[VoiceInput] Helper 已连�? model=" + state.helperModel + ", status=" + (data.model && data.model.status));
        updateHelperUI();
        return true;
      }
    } catch (e) {
      clearTimeout(timeoutId);
      // 服务不可�?    }
    state.helperOnline = false;
    state.helperModel = "";
    updateHelperUI();
    console.log("[VoiceInput] Helper 未连接，请启�?tools/voice-helper.py");
    return false;
  }

  // ===== Helper 定时探测 =====
  function startHelperHealthPoll() {
    stopHelperHealthPoll();
    // 立即检查一�?    checkHelperHealth();
    // �?30 秒检查一�?    state.helperCheckTimer = setInterval(checkHelperHealth, 30000);
  }

  function stopHelperHealthPoll() {
    if (state.helperCheckTimer) {
      clearInterval(state.helperCheckTimer);
      state.helperCheckTimer = null;
    }
  }

  // 刷新按钮上的 helper 状态指�?  function updateHelperUI() {
    if (!state.root) return;
    if (state.helperOnline === true) {
      state.root.removeAttribute("data-helper");
      if (state.status === STATUS_IDLE) {
        state.statusLabel.textContent = "";
        state.statusLabel.style.display = "none";
      }
      state.button.title = "语音输入 �?点击开始录�?(" + state.helperModel + ")";
    } else if (state.helperOnline === false) {
      state.root.setAttribute("data-helper", "offline");
      if (state.status === STATUS_IDLE) {
        state.statusLabel.textContent = "服务未连�?;
        state.statusLabel.style.display = "block";
      }
      state.button.title = "语音识别服务未启�?�?请先运行 tools/voice-helper.py";
    } else {
      // null = checking
      state.root.removeAttribute("data-helper");
      state.button.title = "语音输入 �?正在检测服�?..";
    }
  }

  // ===== 键盘快捷�?(Ctrl+Shift+V 触发录音) =====
  function installKeyboardShortcut() {
    state._keyHandler = function(e) {
      // Ctrl+Shift+V: 切换录音
      if (e.ctrlKey && e.shiftKey && e.key === "V" && !e.metaKey && !e.altKey) {
        e.preventDefault();
        handleMicClick();
      }
    };
    document.addEventListener("keydown", state._keyHandler, true);
  }

  // ===== 销�?=====
  function destroy() {
    cleanupAudio();
    stopHelperHealthPoll();
    if (state.root && state.root.parentNode) {
      state.root.parentNode.removeChild(state.root);
    }
    var style = document.getElementById(STYLE_ID);
    if (style) style.remove();

    if (state._floatingCleanup) {
      state._floatingCleanup();
      state._floatingCleanup = null;
    }
    if (state._hoverCleanup) {
      state._hoverCleanup();
      state._hoverCleanup = null;
    }
    if (state._keyHandler) {
      document.removeEventListener("keydown", state._keyHandler, true);
      state._keyHandler = null;
    }

    clearTimeout(state._resetTimer);
    clearTimeout(state.recordTimer);
    clearTimeout(state.hoverOpenTimer);
    clearTimeout(state.hoverCloseTimer);
    closeVoiceMenu();

    delete window[API_KEY];
    delete window[INSTALL_KEY];
  }

  // ===== 对外 API =====
  window[API_KEY] = {
    version: SCRIPT_VERSION,
    getStatus: function() { return state.status; },
    getLastText: function() { return state.lastText; },
    start: function() {
      if (state.status !== STATUS_RECORDING) handleMicClick();
    },
    toggle: handleMicClick,
    destroy: destroy,
    refresh: function() {
      updateButtonUI();
    },
  };

  // ===== lean startup =====
  try { installStyle(); } catch(e) { console.error("[VoiceInput] CSS注入失败:", e); }
  try { state.uiState = readUiState(); } catch(e) {}
  try { ensureRoot(); } catch(e) { console.error("[VoiceInput] DOM创建失败:", e); }
  try { installKeyboardShortcut(); } catch(e) {}

  // 启动定时 helper 探测（立即一�?+ �?30s�?  try { startHelperHealthPoll(); } catch(e) {}

  console.log("[VoiceInput] codex-voice-input v" + SCRIPT_VERSION + " started");
})();
