(() => {
  // Codex++ 会把本文件注入 Codex 渲染页；所有读取都只能依赖页面里已经暴露的运行态信号。
  const INSTALL_KEY = "__codexDeepseekBillingInstalled";
  const API_KEY = "__codexDeepseekBilling";
  const STYLE_ID = "codex-deepseek-billing-style";
  const ROOT_ID = "codex-deepseek-billing";
  const CAPTURE_STATE_KEY = "__codexDeepseekBillingCaptureState";
  const CONFIG_KEY = "__codexDeepseekBillingConfig";
  const UI_STATE_STORAGE_KEY = "__codexDeepseekBillingUiState";
  const PROVIDER_SUMMARY_KEY = "__codexDeepseekBillingSummary";
  const PROVIDER_SUMMARY_EVENT = "codex-deepseek-billing-summary";
  const SCRIPT_VERSION = 81;
  const UPDATE_INTERVAL_MS = 5000;
  const SLOW_SCAN_INTERVAL_MS = 30000;
  const SWITCH_RETRY_WINDOW_MS = 8000;
  const SWITCH_RETRY_INTERVAL_MS = 700;
  const NAVIGATION_PENDING_MS = 1500;
  const CAPTURE_UPDATE_DELAY_MS = 30;
  const MUTATION_UPDATE_DELAY_MS = 500;
  const ACTIVE_CONVERSATION_LOOKUP_CACHE_MS = 250;
  const APP_SIGNAL_READING_CACHE_MS = 120;
  const APP_SIGNAL_IMPORT_GRACE_MS = 600;
  // 以下限额只约束兜底扫描；主路径读 app signal / 已缓存读数，不受这些值影响。
  const EXPENSIVE_FALLBACK_INTERVAL_MS = 2500;
  const REACT_HOST_SCAN_LIMIT = 180;
  const STATUS_TEXT_NODE_SCAN_LIMIT = 1200;
  const DOM_ATTRIBUTE_SCAN_LIMIT = 500;
  const DOM_TEXT_PART_LIMIT = 120;
  const WINDOW_KEY_CACHE_MS = 10000;
  const MAX_TEXT_LENGTH = 120000;
  const MAX_CAPTURE_TEXT_LENGTH = 2000000;
  const SPEND_HISTORY_WINDOW_MS = 60 * 60 * 1000;
  const SPEND_HISTORY_MAX_ITEMS = 200;
  const SPEND_HISTORY_CHART_WIDTH = 244;
  const SPEND_HISTORY_CHART_HEIGHT = 72;
  const SPEND_HISTORY_CHART_PADDING = 8;
  const SPEND_HISTORY_CHART_AXIS_WIDTH = 52;
  const SPEND_EFFECT_DURATION_MS = 3000;
  const SPEND_EFFECT_FALLBACK_MS = 3200;
  const CONTEXT_SPEND_DEDUPE_WINDOW_MS = UPDATE_INTERVAL_MS * 2 + MUTATION_UPDATE_DELAY_MS;
  const CONTEXT_SPEND_DEDUPE_KEY = "__codexDeepseekBillingContextSpendDedupe";
  const BALANCE_SPEND_DEDUPE_WINDOW_MS = 1500;
  const PROVIDER_SPEND_DEDUPE_KEY = "__codexDeepseekBillingBalanceDedupe";
  const HISTORY_PANEL_CLOSE_DELAY_MS = 240;
  const FLOAT_DRAG_HOLD_MS = 260;
  const FLOAT_SCALE_MIN = 0.7;
  const FLOAT_SCALE_MAX = 1.8;
  const FLOAT_SCALE_STEP = 0.08;
  const DEFAULT_FLOATING_UI = {
    mode: "inline",
    floatingLayout: "horizontal",
    x: 16,
    y: 10,
    scale: 1,
  };
  const DEFAULT_UI_CONFIG = {
    context: {
      showUsedInsteadOfLeft: false,
      compressionWarningLeftPercent: 20,
      levelThresholds: {
        criticalLeftPercent: 30,
        dangerLeftPercent: 40,
        warnLeftPercent: 50,
        noticeLeftPercent: 60,
      },
    },
    provider: {
      levelThresholds: {
        criticalLeftPercent: 30,
        dangerLeftPercent: 40,
        warnLeftPercent: 50,
        noticeLeftPercent: 60,
      },
    },
  };

  // ===== DeepSeek V4 计费常量 =====
  // 定价: $ / 1M tokens
  const CDS_PRICING = {
    inputCacheMiss: 0.14,
    inputCacheHit: 0.0028,
    output: 0.28,
  };
  const CDS_MODEL = "DeepSeek V4";
  const BALANCE_WARN = 5;    // 余额 < ¥5 黄色警告
  const BALANCE_DANGER = 2;  // 余额 < ¥2 红色警告
  const USD_TO_CNY = 7.2;    // 美元→人民币汇率

  const CAPTURE_TEXT_HINT_RE = /context|token|usage|latestTokenUsageInfo|window|budget|remaining|上下文|令牌|使用|窗口/i;
  const THREAD_CONTENT_SELECTOR = [
    '[data-app-shell-main-content-layout*="thread"]',
    '[class*="thread-edge"]',
    '[class*="transcript"]',
    '[data-testid*="thread"], [data-test-id*="thread"]',
    '[data-testid*="conversation"], [data-test-id*="conversation"]',
  ].join(",");
  const REACT_STATE_HOST_SELECTOR = [
    "[data-app-action-sidebar-thread-id]",
    "[data-testid*='thread' i]",
    "[data-testid*='conversation' i]",
    "[data-testid*='message' i]",
    "[data-message-author-role]",
    "main",
    "article",
  ].join(",");
  const CONVERSATION_CONTENT_SELECTOR = [
    `[data-thread-find-target]`,
    `[data-message-author-role]`,
    `[data-testid*="conversation" i]`,
    `[data-testid*="message" i]`,
    `article`,
  ].join(",");
  const MESSAGE_MUTATION_SELECTOR = [
    `[data-thread-find-target]`,
    `[data-message-author-role]`,
    `[data-testid*="message" i]`,
    `article`,
  ].join(",");
  const PREFERRED_STATUS_KEYS = [
    "contextUsage",
    "context_usage",
    "tokenUsage",
    "token_usage",
    "usage",
    "data",
    "props",
    "memoizedState",
    "memoizedProps",
    "pendingProps",
    "updateQueue",
    "dependencies",
    "alternate",
    "return",
    "child",
    "sibling",
    "stateNode",
    "current",
    "value",
    "store",
    "atom",
    "atoms",
    "map",
    "cache",
  ];
  const PREFERRED_STATUS_KEY_SET = new Set(PREFERRED_STATUS_KEYS);
  const STATUS_TREE_KEY_RE = /context|usage|status|thread|conversation|token|query|data|props|memoized|pending|return|child|sibling|state|value|current|store|atom|map|cache/i;
  const APP_SIGNAL_SCOPE_KEY_RE = /memoized|pending|dependencies|firstContext|context|value|current|return|child|sibling|state|store|node|chain|scope|provider|props|query|cache/i;
  const VALUE_TEXT_KEY_RE = /context|token|tokens|usage|window|budget|remaining|上下文|令牌|使用|窗口/i;
  const REACT_PRIVATE_KEY_RE = /^__react(?:Props|Fiber|Container)\$/;

  for (const key of Object.keys(window)) {
    if (!/CodexContextUsageMeter(?:Installed)?$/.test(key)) continue;

    const legacyApi = window[key];
    if (legacyApi && typeof legacyApi.destroy === "function") {
      legacyApi.destroy();
    }
    delete window[key];
  }

  const legacyRootId = ["codex", "context", "usage", "meter"].join("-");
  document.getElementById(legacyRootId)?.remove();
  document.getElementById(`${legacyRootId}-style`)?.remove();

  if (window[INSTALL_KEY]) {
    const api = window[API_KEY];
    if (api && api.version !== SCRIPT_VERSION && typeof api.destroy === "function") {
      api.destroy();
    } else {
      if (api && typeof api.refresh === "function") {
        api.refresh();
      }
      return;
    }
  }

  window[INSTALL_KEY] = true;

  const contextTerms =
    /context|token|tokens|usage|window|budget|remaining|上下文|令牌|使用|窗口/i;
  const ratioWords =
    /context|token|tokens|usage|window|budget|remaining|上下文|令牌|使用|窗口/i;
  const state = {
    activeConversationId: null,
    lastReading: null,
    readingsByConversationId: new Map(),
    lastAnimatedUsedByConversationId: new Map(),
    lastAnimatedProviderUsedById: new Map(),
    root: null,
    contextCard: null,
    providerCard: null,
    historyPanel: null,
    value: null,
    fill: null,
    providerValue: null,
    providerFill: null,
    providerSummary: null,
    inlineHost: null,
    inlineBefore: null,
    uiState: DEFAULT_FLOATING_UI,
    contextMenu: null,
    contextMenuCloseListener: null,
    floatingPointerCleanup: null,
    floatingDrag: null,
    spendHistory: {
      context: [],
      provider: [],
    },
    spendEffectQueue: [],
    spendEffectActive: null,
    spendEffectTimer: 0,
    contextSessionTotalsByConversationId: new Map(),
    providerSessionTotalsByConversationId: new Map(),
    historyCloseTimer: 0,
    historyHoverCleanup: null,
    uiConfig: DEFAULT_UI_CONFIG,
    providerSummaryListener: null,
    lastScanAt: 0,
    lastScannedConversationId: null,
    navigationPendingUntil: 0,
    switchRetryUntil: 0,
    retryTimer: 0,
    timer: 0,
    observer: null,
    navigationListener: null,
    pendingUpdate: 0,
    pendingUpdateDueAt: 0,
    cachedActiveConversationId: null,
    activeConversationIdLookupAt: 0,
    appSignalScope: null,
    appSignalModules: null,
    appSignalModulesPromise: null,
    appSignalLastLookupAt: 0,
    appSignalCachedReading: null,
    appSignalCachedConversationId: null,
    appSignalCachedAt: 0,
    appSignalModulesRequestedAt: 0,
    waitingForAppSignalModules: false,
    expensiveFallbackScannedAt: 0,
    expensiveFallbackConversationId: null,
    windowContextTextKeys: null,
    windowContextTextKeysAt: 0,
    windowUsageKeys: null,
    windowUsageKeysAt: 0,
    reactPrivateKeyCache: new WeakMap(),
    scanGeneration: 0,
    filteredReflectKeyCache: new WeakMap(),
    appSignalSkipGeneration: new WeakMap(),
    threadContentLookupAt: 0,
    threadContentLookupResult: false,
    // DeepSeek V4 计费状态
    cdsSessionInputTokens: 0,
    cdsSessionOutputTokens: 0,
    cdsSessionCacheHitTokens: 0,
    cdsSessionCacheMissTokens: 0,
    cdsSessionCacheWriteTokens: 0,
    cdsSessionCost: 0,
    cdsSessionCostCNY: 0,
    cdsSessionCacheSavings: 0,
    cdsBalance: null,
    cdsBalanceLevel: "unknown",
    cdsBalanceTimestamp: 0,
    cdsApiKey: null,
    cdsApiKeySource: null,
    cdsApiMonitorInstalled: false,
    cdsBalanceFetching: false,
    cdsBalanceTimer: null,
    cdsTurnSeq: 0,
  };

  function getCaptureState() {
    let captureState = window[CAPTURE_STATE_KEY];
    if (!captureState || typeof captureState !== "object") {
      captureState = {};
      window[CAPTURE_STATE_KEY] = captureState;
    }

    captureState.version = SCRIPT_VERSION;
    captureState.inspectText = inspectCandidateText;
    captureState.inspectValue = inspectCandidateValue;
    captureState.acceptReading = acceptReading;
    captureState.parsePayloadText = parsePayloadText;
    return captureState;
  }

  function installStyle() {
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle && existingStyle.dataset.version === String(SCRIPT_VERSION)) return;
    existingStyle?.remove();

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.dataset.version = String(SCRIPT_VERSION);
    style.textContent = `
      #${ROOT_ID} {
        --cds-ring-size: 22px;
        --cds-ring-width: 3px;
        --cds-inline-max-width: 210px;
        position: fixed;
        top: var(--cds-float-y, 10px);
        left: var(--cds-float-x, 16px);
        transform: scale(var(--cds-float-scale, 1));
        transform-origin: top left;
        z-index: 2147483647;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        min-height: var(--cds-ring-size);
        max-width: calc(100vw - 32px);
        overflow: visible;
        pointer-events: auto;
        user-select: none;
        /* Codex/Electron 顶部可能是窗口拖拽区；不退出拖拽区时，真实鼠标 hover 会被系统层吞掉。 */
        -webkit-app-region: no-drag;
      }

      #${ROOT_ID}[data-placement="inline"] {
        position: relative;
        inset: auto;
        z-index: auto;
        transform: none;
        flex: 0 0 auto;
        align-self: center;
        max-width: min(42vw, 360px);
        margin-right: 8px;
        justify-content: flex-start;
      }

      #${ROOT_ID}[data-placement="inline"] .cds-card {
        width: var(--cds-ring-size);
        max-width: var(--cds-ring-size);
        padding: 0;
        border: 0;
        background: transparent;
        box-shadow: none;
        backdrop-filter: none;
      }

      #${ROOT_ID}[data-placement="inline"] .cds-row {
        gap: 0;
      }

      #${ROOT_ID}[data-placement="inline"] .cds-value,
      #${ROOT_ID}[data-placement="inline"] .cds-provider-value,
      #${ROOT_ID}[data-placement="inline"] .cds-history-panel {
        display: none !important;
      }

      #${ROOT_ID}[data-placement="floating"] {
        cursor: default;
      }

      #${ROOT_ID}[data-placement="floating"][data-floating-layout="vertical"] {
        flex-direction: column;
        align-items: stretch;
      }

      #${ROOT_ID}[data-dragging="true"] {
        cursor: grabbing;
      }

      #${ROOT_ID}[hidden] {
        display: none !important;
      }

      #${ROOT_ID} .cds-card {
        position: relative;
        box-sizing: border-box;
        flex: 0 1 auto;
        width: auto;
        min-width: 0;
        max-width: var(--cds-inline-max-width);
        padding: 5px 8px;
        border: 1px solid rgba(255, 255, 255, 0.16);
        border-radius: 999px;
        background: rgba(20, 22, 28, 0.78);
        color: rgba(255, 255, 255, 0.92);
        box-shadow: 0 5px 18px rgba(0, 0, 0, 0.18);
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        overflow: visible;
        backdrop-filter: blur(10px);
        pointer-events: auto;
        -webkit-app-region: no-drag;
      }

      #${ROOT_ID}[data-placement="floating"] .cds-card {
        max-width: 240px;
        padding: 8px 10px 9px;
        border-radius: 8px;
        background: rgba(20, 22, 28, 0.88);
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.24);
      }

      #${ROOT_ID}[data-placement="floating"] .cds-row {
        justify-content: center;
        margin-bottom: 6px;
      }

      #${ROOT_ID}[data-placement="floating"] .cds-ring {
        display: none;
      }

      #${ROOT_ID}[data-placement="floating"] .cds-track {
        display: block;
      }

      #${ROOT_ID} .cds-card[hidden] {
        display: none !important;
      }

      #${ROOT_ID} .cds-row {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        gap: 7px;
        min-width: 0;
        margin-bottom: 0;
        white-space: nowrap;
      }

      #${ROOT_ID} .cds-ring {
        position: relative;
        flex: 0 0 var(--cds-ring-size);
        width: var(--cds-ring-size);
        height: var(--cds-ring-size);
        border-radius: 50%;
        background:
          conic-gradient(var(--cds-fill-color, #4ade80) 0deg, var(--cds-fill-color, #4ade80) var(--cds-ring-angle, 0deg), rgba(255, 255, 255, 0.18) var(--cds-ring-angle, 0deg) 360deg);
      }

      #${ROOT_ID} .cds-ring::after {
        content: "";
        position: absolute;
        inset: var(--cds-ring-width);
        border-radius: 50%;
        background: rgba(20, 22, 28, 0.96);
      }

      #${ROOT_ID} .cds-value {
        color: rgba(255, 255, 255, 0.98);
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-align: left;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .cds-track {
        display: none;
        position: relative;
        width: 100%;
        height: 7px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.16);
      }

      #${ROOT_ID} .cds-fill {
        --cds-fill-color: #4ade80;
        --cds-fill-gradient: linear-gradient(90deg, #4ea1ff, #4ade80);
        width: 0%;
        height: 100%;
        border-radius: inherit;
        background: var(--cds-fill-gradient);
        transition: width 180ms ease, background 180ms ease;
      }

      #${ROOT_ID} .cds-compression-zone {
        position: absolute;
        inset: 0 auto 0 0;
        z-index: 1;
        width: 0%;
        border-radius: inherit;
        background:
          linear-gradient(90deg, rgba(255, 196, 0, 0.2), rgba(255, 126, 34, 0.12)),
          repeating-linear-gradient(
            -45deg,
            rgba(253, 224, 71, 0.72) 0,
            rgba(253, 224, 71, 0.72) 4px,
            rgba(251, 146, 60, 0.64) 4px,
            rgba(251, 146, 60, 0.64) 8px
          );
        box-shadow:
          inset 0 0 0 1px rgba(251, 191, 36, 0.38),
          inset 0 0 7px rgba(251, 146, 60, 0.18);
        opacity: 0.82;
        pointer-events: none;
        transition: width 180ms ease, opacity 180ms ease;
      }

      #${ROOT_ID} .cds-provider-value {
        color: rgba(255, 255, 255, 0.98);
        font-weight: 650;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-align: left;
        text-overflow: ellipsis;
      }

      #${ROOT_ID} .cds-context-card[data-level="warn"] .cds-fill,
      #${ROOT_ID} .cds-context-card[data-level="warn"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="warn"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="warn"] .cds-fill {
        --cds-fill-color: #f97316;
        --cds-fill-gradient: linear-gradient(90deg, #f59e0b, #f97316);
      }

      #${ROOT_ID} .cds-context-card[data-level="danger"] .cds-fill,
      #${ROOT_ID} .cds-context-card[data-level="danger"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="danger"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="danger"] .cds-fill {
        --cds-fill-color: #ef4444;
        --cds-fill-gradient: linear-gradient(90deg, #fb7185, #ef4444);
      }

      #${ROOT_ID} .cds-context-card[data-level="notice"] .cds-fill,
      #${ROOT_ID} .cds-context-card[data-level="notice"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="notice"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="notice"] .cds-fill {
        --cds-fill-color: #38bdf8;
        --cds-fill-gradient: linear-gradient(90deg, #22d3ee, #38bdf8);
      }

      #${ROOT_ID} .cds-context-card[data-level="critical"] .cds-fill,
      #${ROOT_ID} .cds-context-card[data-level="critical"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="critical"] .cds-ring,
      #${ROOT_ID} .cds-provider-card[data-level="critical"] .cds-fill {
        --cds-fill-color: #dc2626;
        --cds-fill-gradient: linear-gradient(90deg, #f43f5e, #dc2626);
      }

      #${ROOT_ID} .cds-context-card[data-compression-warning="true"] .cds-compression-zone {
        opacity: 1;
      }

      #${ROOT_ID} .cds-context-card[data-show-used-instead-of-left="true"] .cds-compression-zone {
        left: auto;
        right: 0;
      }

      #${ROOT_ID} .cds-history-panel {
        position: absolute;
        top: calc(100% + 8px);
        left: 0;
        right: auto;
        z-index: 1;
        box-sizing: border-box;
        width: max-content;
        min-width: 240px;
        max-width: min(560px, calc(100vw - 32px));
        padding: 9px 10px 10px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        background: rgba(16, 18, 24, 0.94);
        color: rgba(255, 255, 255, 0.9);
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.28);
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        opacity: 0;
        transform: translateY(-4px);
        pointer-events: none;
        visibility: hidden;
        backdrop-filter: blur(12px);
        -webkit-app-region: no-drag;
        transition: opacity 140ms ease, transform 140ms ease, visibility 140ms ease;
      }

      #${ROOT_ID} .cds-history-panel::before {
        content: "";
        position: absolute;
        left: 0;
        right: 0;
        top: -8px;
        height: 8px;
        pointer-events: auto;
      }

      #${ROOT_ID}[data-history-open="true"] .cds-history-panel {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
        visibility: visible;
      }

      #${ROOT_ID} .cds-history-grid {
        display: grid;
        grid-template-columns: minmax(0, 260px) minmax(0, 260px);
        gap: 12px;
      }

      #${ROOT_ID} .cds-history-grid[data-provider-visible="false"] {
        grid-template-columns: minmax(0, 292px);
      }

      #${ROOT_ID} .cds-history-section {
        min-width: 0;
        --cds-history-accent: #38bdf8;
        --cds-history-fill: rgba(56, 189, 248, 0.12);
      }

      #${ROOT_ID} .cds-history-section[data-history-kind="provider"] {
        --cds-history-accent: #f97316;
        --cds-history-fill: rgba(249, 115, 22, 0.12);
      }

      #${ROOT_ID} .cds-history-section[hidden] {
        display: none !important;
      }

      #${ROOT_ID} .cds-history-head {
        display: flex;
        align-items: baseline;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 6px;
        white-space: nowrap;
      }

      #${ROOT_ID} .cds-history-title {
        color: rgba(255, 255, 255, 0.98);
        font-weight: 700;
      }

      #${ROOT_ID} .cds-history-total {
        color: rgba(255, 255, 255, 0.72);
        font-variant-numeric: tabular-nums;
      }

      #${ROOT_ID} .cds-history-chart {
        position: relative;
        width: 100%;
        min-height: 78px;
      }

      #${ROOT_ID} .cds-history-svg {
        display: block;
        width: 100%;
        height: 78px;
        overflow: visible;
      }

      #${ROOT_ID} .cds-history-axis-line {
        fill: none;
        stroke: rgba(255, 255, 255, 0.16);
        stroke-width: 1;
        vector-effect: non-scaling-stroke;
      }

      #${ROOT_ID} .cds-history-axis-label {
        fill: rgba(255, 255, 255, 0.46);
        font-size: 10px;
        font-variant-numeric: tabular-nums;
      }

      #${ROOT_ID} .cds-history-gridline {
        fill: none;
        stroke: rgba(255, 255, 255, 0.1);
        stroke-dasharray: 2 4;
        stroke-width: 1;
      }

      #${ROOT_ID} .cds-history-area {
        fill: var(--cds-history-fill);
      }

      #${ROOT_ID} .cds-history-line {
        fill: none;
        stroke: var(--cds-history-accent);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 2.2;
        vector-effect: non-scaling-stroke;
      }

      #${ROOT_ID} .cds-history-point {
        fill: #fff7ed;
        stroke: var(--cds-history-accent);
        stroke-width: 1.5;
      }

      #${ROOT_ID} .cds-history-hit {
        fill: transparent;
        pointer-events: all;
      }

      #${ROOT_ID} .cds-history-caption {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-top: 2px;
        color: rgba(255, 255, 255, 0.48);
        font-size: 11px;
        font-variant-numeric: tabular-nums;
        white-space: nowrap;
      }

      #${ROOT_ID} .cds-history-empty {
        position: absolute;
        inset: 19px 0 auto 0;
        color: rgba(255, 255, 255, 0.46);
      }

      .cds-context-menu {
        position: fixed;
        z-index: 2147483647;
        min-width: 150px;
        padding: 5px;
        border: 1px solid rgba(255, 255, 255, 0.14);
        border-radius: 8px;
        background: rgba(18, 20, 26, 0.96);
        color: rgba(255, 255, 255, 0.92);
        box-shadow: 0 12px 32px rgba(0, 0, 0, 0.36);
        font: 12px/1.35 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        backdrop-filter: blur(12px);
        -webkit-app-region: no-drag;
      }

      .cds-context-menu button {
        display: flex;
        align-items: center;
        gap: 7px;
        box-sizing: border-box;
        width: 100%;
        padding: 6px 8px;
        border: 0;
        border-radius: 6px;
        background: transparent;
        color: inherit;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .cds-context-menu button:hover {
        background: rgba(255, 255, 255, 0.1);
      }

      .cds-context-menu button[aria-checked="true"] {
        background: rgba(255, 255, 255, 0.08);
      }

      .cds-context-menu .cds-menu-separator {
        height: 1px;
        margin: 5px 4px;
        background: rgba(255, 255, 255, 0.12);
      }

      .cds-context-menu .cds-menu-check {
        flex: 0 0 14px;
        width: 14px;
        color: #86efac;
        font-weight: 800;
        text-align: center;
      }

      .cds-context-menu .cds-menu-hint {
        padding: 5px 8px 6px 21px;
        color: rgba(255, 255, 255, 0.48);
        font-size: 11px;
        line-height: 1.3;
        white-space: nowrap;
      }

      #${ROOT_ID} .cds-hit-pop {
        position: absolute;
        left: 0;
        right: auto;
        top: 50%;
        z-index: 1;
        color: #fff7ed;
        background: linear-gradient(92deg, #fff7ed 0%, #fecdd3 38%, #fb7185 68%, #f97316 100%);
        -webkit-background-clip: text;
        background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 14px;
        font-weight: 850;
        line-height: 1;
        opacity: 0;
        filter: drop-shadow(0 1px 0 rgba(0, 0, 0, 0.78))
          drop-shadow(0 3px 8px rgba(0, 0, 0, 0.58))
          drop-shadow(0 0 14px rgba(251, 113, 133, 0.56))
          drop-shadow(0 0 26px rgba(249, 115, 22, 0.24));
        text-shadow: 0 0 1px rgba(255, 255, 255, 0.45);
        transform: translate(-108%, -50%) scale(0.72);
        transform-origin: center center;
        animation: cds-hit-pop ${SPEND_EFFECT_DURATION_MS}ms cubic-bezier(0.16, 0.84, 0.24, 1) forwards;
        pointer-events: none;
        white-space: nowrap;
        will-change: opacity, transform, filter;
      }

      @keyframes cds-hit-pop {
        0% {
          opacity: 0;
          transform: translate(-108%, -50%) scale(0.72);
        }
        12% {
          opacity: 1;
          transform: translate(-114%, -51%) scale(1);
        }
        72% {
          opacity: 1;
          transform: translate(-146%, -54%) scale(1.22);
        }
        100% {
          opacity: 0;
          transform: translate(-160%, -55%) scale(1.34);
        }
      }

      @media (max-width: 720px) {
        #${ROOT_ID}[data-placement="inline"] {
          max-width: 72px;
        }

        #${ROOT_ID}[data-placement="inline"] .cds-value,
        #${ROOT_ID}[data-placement="inline"] .cds-provider-value {
          display: none;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function ensureRoot() {
    let root = document.getElementById(ROOT_ID);
    if (root) {
      root.querySelector(".cds-hover-zone")?.remove();
      const contextTrack = root.querySelector(".cds-context-card .cds-track");
      if (contextTrack && !contextTrack.querySelector(".cds-compression-zone")) {
        contextTrack.insertBefore(document.createElement("div"), contextTrack.firstChild);
        contextTrack.firstElementChild.className = "cds-compression-zone";
      }
      state.root = root;
      state.contextCard = root.querySelector(".cds-context-card");
      state.providerCard = root.querySelector(".cds-provider-card");
      state.historyPanel = root.querySelector(".cds-history-panel");
      state.value = root.querySelector(".cds-value");
      state.fill = root.querySelector(".cds-fill");
      state.providerValue = root.querySelector(".cds-provider-value");
      state.providerFill = root.querySelector(".cds-provider-fill");
      installHistoryHover(root);
      installContextMenu(root);
      installFloatingControls(root);
      mountRoot(root);
      return root;
    }

    root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="cds-card cds-context-card" data-known="false" data-level="normal" hidden>
        <div class="cds-row">
          <span class="cds-ring" aria-hidden="true"></span>
          <span class="cds-value">Context Left --</span>
        </div>
        <div class="cds-track">
          <div class="cds-compression-zone"></div>
          <div class="cds-fill"></div>
        </div>
      </div>
      <div class="cds-card cds-provider-card" data-known="false" data-level="normal" hidden>
        <div class="cds-row">
          <span class="cds-ring cds-provider-ring" aria-hidden="true"></span>
          <span class="cds-provider-value">Provider Left --</span>
        </div>
        <div class="cds-track">
          <div class="cds-fill cds-provider-fill"></div>
        </div>
      </div>
      <div class="cds-history-panel" aria-hidden="true">
        <div class="cds-history-grid">
          <div class="cds-history-section" data-history-kind="context">
            <div class="cds-history-head">
              <span class="cds-history-title">Context / Session</span>
              <span class="cds-history-total">--</span>
            </div>
            <div class="cds-history-chart"></div>
          </div>
          <div class="cds-history-section" data-history-kind="provider">
            <div class="cds-history-head">
              <span class="cds-history-title">Provider / Session</span>
              <span class="cds-history-total">--</span>
            </div>
            <div class="cds-history-chart"></div>
          </div>
        </div>
      </div>
    `;
    state.root = root;
    state.contextCard = root.querySelector(".cds-context-card");
    state.providerCard = root.querySelector(".cds-provider-card");
    state.historyPanel = root.querySelector(".cds-history-panel");
    state.value = root.querySelector(".cds-value");
    state.fill = root.querySelector(".cds-fill");
    state.providerValue = root.querySelector(".cds-provider-value");
    state.providerFill = root.querySelector(".cds-provider-fill");
    installHistoryHover(root);
    installContextMenu(root);
    installFloatingControls(root);
    mountRoot(root);
    return root;
  }

  function findInlineMount() {
    const visibleDirectChildren = (node) =>
      Array.from(node.children || []).filter((child) => child.id !== ROOT_ID && isVisibleElement(child));
    const buttonLikeCount = (node) =>
      Array.from(node.querySelectorAll("button, [role='button']")).filter((child) => isVisibleElement(child)).length;
    const nodeLabel = (node) =>
      `${node.textContent || ""} ${node.getAttribute?.("aria-label") || ""} ${node.getAttribute?.("title") || ""} ${node.getAttribute?.("data-testid") || ""}`;
    const isComposerAction = (node) =>
      /send|submit|attach|upload|file|image|screenshot|voice|audio|mic|microphone|dictat/i.test(nodeLabel(node));
    const looksLikeProviderModelControl = (node) => {
      if (!node || node.id === ROOT_ID || !isVisibleElement(node)) return false;
      if (node.closest("textarea, input, [contenteditable='true'], [role='textbox']")) return false;
      if (isComposerAction(node)) return false;

      const label = nodeLabel(node).trim();
      if (/provider|model|gpt-|claude|gemini|codex|auto|standard|reason|thinking|high|medium|low|o[0-9]/i.test(label)) return true;
      return /\S{2,}/.test(label) && Boolean(node.querySelector("button, [role='button'], [aria-haspopup], svg"));
    };
    const findProviderModelBefore = (toolbar) => {
      const children = visibleDirectChildren(toolbar).sort(
        (left, right) => left.getBoundingClientRect().left - right.getBoundingClientRect().left
      );
      return children.find(looksLikeProviderModelControl) || null;
    };
    const isComposerArea = (node) => {
      const rect = node && node.getBoundingClientRect();
      if (!rect || rect.top < window.innerHeight * 0.45) return false;
      if (node.closest(CONVERSATION_CONTENT_SELECTOR)) return false;
      if (node.closest("aside, nav, [data-app-action-sidebar-thread-id], [data-app-action-sidebar-thread-active], [class*='sidebar' i]")) return false;
      if (node.closest("article, [data-message-author-role], [data-testid*='message' i], [data-testid*='conversation' i]")) return false;
      if (!node.querySelector("textarea, input, [contenteditable='true'], [role='textbox']")) return false;
      return true;
    };
    const findComposerArea = (node) => {
      let current = node;
      while (current && current !== document.body) {
        if (isComposerArea(current)) return current;
        current = current.parentElement;
      }
      return null;
    };
    const directChildOf = (parent, node) => {
      let current = node;
      while (current && current.parentElement && current.parentElement !== parent) {
        current = current.parentElement;
      }
      return current && current.parentElement === parent ? current : null;
    };
    const findToolbarForButton = (button) => {
      let current = button.parentElement;
      while (current && current !== document.body) {
        const rect = current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.45) break;
        if (current.closest(CONVERSATION_CONTENT_SELECTOR)) break;
        const children = visibleDirectChildren(current);
        const hasModel = /gpt-|o[0-9]|auto|high|medium|low|standard|模型/i.test(current.textContent || "");
        const hasSubmit = /send|提交|发送/i.test(current.textContent || "");
        if (children.length >= 3 && buttonLikeCount(current) >= 2 && (hasModel || hasSubmit)) {
          return current;
        }
        current = current.parentElement;
      }
      return button.parentElement || button;
    };
    const firstVisibleChild = (node) => visibleDirectChildren(node)[0] || null;
    const classText = (node) => (typeof node?.className === "string" ? node.className : "");
    const findComposerFooterMount = () => {
      const footers = Array.from(document.querySelectorAll(".composer-footer"))
        .filter((footer) => isVisibleElement(footer) && footer.getBoundingClientRect().top > window.innerHeight * 0.45)
        .sort((left, right) => right.getBoundingClientRect().top - left.getBoundingClientRect().top);

      for (const footer of footers) {
        const rightGroup = visibleDirectChildren(footer).find((child) => {
          const className = classText(child);
          if (!/justify-end/.test(className)) return false;
          if (!child.querySelector("button, [role='button'], [aria-haspopup]")) return false;
          return !/full access/i.test(nodeLabel(child));
        });
        if (!rightGroup) continue;

        const providerGroup =
          visibleDirectChildren(rightGroup).find((child) => {
            const className = classText(child);
            if (!/justify-end/.test(className)) return false;
            if (!child.querySelector("button, [role='button'], [aria-haspopup]")) return false;
            return !isComposerAction(child);
          }) || rightGroup;
        return {
          parent: providerGroup,
          before: firstVisibleChild(providerGroup),
        };
      }

      return null;
    };
    const findToolbarForProviderModel = (control) => {
      let current = control.parentElement;
      while (current && current !== document.body) {
        const rect = current.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.45) break;
        if (current.closest(CONVERSATION_CONTENT_SELECTOR)) break;
        const children = visibleDirectChildren(current);
        if (children.length >= 2 && children.some(looksLikeProviderModelControl)) return current;
        current = current.parentElement;
      }
      return control.parentElement || control;
    };

    const footerMount = findComposerFooterMount();
    if (footerMount) return footerMount;

    const providerModelControls = Array.from(document.querySelectorAll("button, [role='button'], [aria-haspopup]"))
      .filter(looksLikeProviderModelControl)
      .sort((left, right) => {
        const leftRect = left.getBoundingClientRect();
        const rightRect = right.getBoundingClientRect();
        return rightRect.top - leftRect.top || leftRect.left - rightRect.left;
      });
    for (const control of providerModelControls) {
      const bar = findComposerArea(control);
      if (!bar || !isVisibleElement(bar) || !isComposerArea(bar)) continue;
      const toolbar = findToolbarForProviderModel(control);
      const before = directChildOf(toolbar, control) || findProviderModelBefore(toolbar) || firstVisibleChild(toolbar);
      return {
        parent: toolbar,
        before,
      };
    }

    const sendButtons = Array.from(document.querySelectorAll("button, [role='button']"));
    for (const button of sendButtons) {
      if (!isVisibleElement(button) || button.closest(`#${ROOT_ID}`)) continue;
      const text = `${button.textContent || ""} ${button.getAttribute("aria-label") || ""} ${button.getAttribute("title") || ""}`;
      if (!/send|提交|发送/i.test(text)) continue;

      const bar = findComposerArea(button);
      if (!bar || !isVisibleElement(bar)) continue;
      if (!isComposerArea(bar)) continue;
      const toolbar = findToolbarForButton(button);
      const providerModelBefore = findProviderModelBefore(toolbar);
      return {
        parent: toolbar,
        before: providerModelBefore || firstVisibleChild(toolbar),
      };
    }

    return null;
  }

  function mountRoot(root) {
    state.uiState = readUiState();
    if (state.uiState.mode === "floating") {
      if (root.parentNode !== document.body) document.body.appendChild(root);
      state.inlineHost = null;
      root.dataset.placement = "floating";
      applyFloatingUiState(root);
      return;
    }

    const mount = findInlineMount();
    if (!mount || !mount.parent || root.contains(mount.parent)) {
      state.inlineHost = null;
      state.inlineBefore = null;
      if (root.parentNode !== document.body) document.body.appendChild(root);
      root.dataset.placement = "floating";
      applyFloatingUiState(root);
      return;
    }

    const before = mount.before || null;
    if (before !== root && (root.parentNode !== mount.parent || root.nextSibling !== before)) {
      mount.parent.insertBefore(root, before);
    }
    state.inlineHost = mount.parent;
    state.inlineBefore = before;
    root.dataset.placement = "inline";
  }

  function applyFloatingUiState(root) {
    const uiState = state.uiState || DEFAULT_FLOATING_UI;
    root.style.setProperty("--cds-float-x", `${Math.round(uiState.x)}px`);
    root.style.setProperty("--cds-float-y", `${Math.round(uiState.y)}px`);
    root.style.setProperty("--cds-float-scale", String(uiState.scale));
    root.dataset.floatingLayout = uiState.floatingLayout === "vertical" ? "vertical" : "horizontal";
  }

  function setUiMode(mode) {
    state.uiState = {
      ...readUiState(),
      mode: mode === "floating" ? "floating" : "inline",
    };
    writeUiState();
    closeContextMenu();
    const root = state.root || document.getElementById(ROOT_ID);
    if (root) mountRoot(root);
  }

  function setFloatingLayout(layout) {
    state.uiState = {
      ...readUiState(),
      floatingLayout: layout === "vertical" ? "vertical" : "horizontal",
    };
    writeUiState();
    closeContextMenu();
    const root = state.root || document.getElementById(ROOT_ID);
    if (root) applyFloatingUiState(root);
  }

  function closeContextMenu() {
    if (state.contextMenu) {
      state.contextMenu.remove();
      state.contextMenu = null;
    }
    if (state.contextMenuCloseListener) {
      document.removeEventListener("pointerdown", state.contextMenuCloseListener, true);
      document.removeEventListener("keydown", state.contextMenuCloseListener, true);
      state.contextMenuCloseListener = null;
    }
  }

  function openContextMenu(event) {
    const root = state.root || document.getElementById(ROOT_ID);
    if (!root || !root.contains(event.target)) return;
    event.preventDefault();
    closeContextMenu();

    const currentMode = (state.uiState && state.uiState.mode) === "floating" ? "floating" : "inline";
    const currentFloatingLayout =
      (state.uiState && state.uiState.floatingLayout) === "vertical" ? "vertical" : "horizontal";
    const menu = document.createElement("div");
    menu.className = "cds-context-menu";
    menu.setAttribute("role", "menu");
    const createRadioItem = (group, value, label, checked) => {
      const item = document.createElement("button");
      item.type = "button";
      item.dataset[group] = value;
      item.setAttribute("role", "menuitemradio");
      item.setAttribute("aria-checked", checked ? "true" : "false");

      const check = document.createElement("span");
      check.className = "cds-menu-check";
      check.setAttribute("aria-hidden", "true");
      check.textContent = checked ? "✓" : "";

      const text = document.createElement("span");
      text.textContent = label;

      item.append(check, text);
      return item;
    };
    const items = [
      createRadioItem("mode", "inline", "Inline mode", currentMode === "inline"),
      createRadioItem("mode", "floating", "Floating mode", currentMode === "floating"),
    ];
    if (currentMode === "floating") {
      const separator = document.createElement("div");
      separator.className = "cds-menu-separator";
      separator.setAttribute("role", "separator");
      const hint = document.createElement("div");
      hint.className = "cds-menu-hint";
      hint.textContent = "Use mouse wheel to resize";
      items.push(
        separator,
        createRadioItem("floatingLayout", "horizontal", "Horizontal layout", currentFloatingLayout === "horizontal"),
        createRadioItem("floatingLayout", "vertical", "Vertical layout", currentFloatingLayout === "vertical"),
        hint,
      );
    }
    menu.replaceChildren(...items);
    const x = Math.min(event.clientX, window.innerWidth - 170);
    const y = Math.min(event.clientY, window.innerHeight - 80);
    menu.style.left = `${Math.max(6, x)}px`;
    menu.style.top = `${Math.max(6, y)}px`;
    menu.addEventListener("pointerdown", (menuEvent) => {
      menuEvent.stopPropagation();
    });
    menu.addEventListener("click", (menuEvent) => {
      const button = menuEvent.target && menuEvent.target.closest("button[data-mode]");
      if (button) {
        setUiMode(button.dataset.mode);
        return;
      }

      const layoutButton = menuEvent.target && menuEvent.target.closest("button[data-floating-layout]");
      if (layoutButton) setFloatingLayout(layoutButton.dataset.floatingLayout);
    });
    document.body.appendChild(menu);
    state.contextMenu = menu;
    state.contextMenuCloseListener = (closeEvent) => {
      if (closeEvent.type === "keydown" && closeEvent.key !== "Escape") return;
      if (state.contextMenu && closeEvent.target && state.contextMenu.contains(closeEvent.target)) return;
      closeContextMenu();
    };
    window.setTimeout(() => {
      document.addEventListener("pointerdown", state.contextMenuCloseListener, true);
      document.addEventListener("keydown", state.contextMenuCloseListener, true);
    }, 0);
  }

  function installContextMenu(root) {
    if (!root || root.dataset.contextMenuInstalled === "true") return;
    root.dataset.contextMenuInstalled = "true";
    root.addEventListener("contextmenu", openContextMenu);
  }

  function clampFloatingPosition(root, x, y, scale) {
    const rect = root.getBoundingClientRect();
    const safeScale = clampNumber(scale, FLOAT_SCALE_MIN, FLOAT_SCALE_MAX);
    const width = Math.max(40, rect.width / (Number(state.uiState.scale) || 1) * safeScale);
    const height = Math.max(28, rect.height / (Number(state.uiState.scale) || 1) * safeScale);
    return {
      x: clampNumber(x, 0, Math.max(0, window.innerWidth - width)),
      y: clampNumber(y, 0, Math.max(0, window.innerHeight - height)),
      scale: safeScale,
    };
  }

  function installFloatingControls(root) {
    if (!root || root.dataset.floatingControlsInstalled === "true") return;
    root.dataset.floatingControlsInstalled = "true";

    const onPointerDown = (event) => {
      if (root.dataset.placement !== "floating" || event.button !== 0) return;
      if (event.target && event.target.closest(".cds-context-menu")) return;

      const uiState = readUiState();
      const startX = event.clientX;
      const startY = event.clientY;
      const pointerId = event.pointerId;
      let dragging = false;
      const holdTimer = window.setTimeout(() => {
        dragging = true;
        root.dataset.dragging = "true";
        try {
          root.setPointerCapture(pointerId);
        } catch {
        }
      }, FLOAT_DRAG_HOLD_MS);

      const onPointerMove = (moveEvent) => {
        if (!dragging) return;
        const next = clampFloatingPosition(
          root,
          uiState.x + moveEvent.clientX - startX,
          uiState.y + moveEvent.clientY - startY,
          uiState.scale,
        );
        state.uiState = { ...uiState, ...next, mode: "floating" };
        applyFloatingUiState(root);
      };

      const finish = () => {
        window.clearTimeout(holdTimer);
        document.removeEventListener("pointermove", onPointerMove, true);
        document.removeEventListener("pointerup", finish, true);
        document.removeEventListener("pointercancel", finish, true);
        if (dragging) {
          root.dataset.dragging = "false";
          writeUiState();
        }
      };

      document.addEventListener("pointermove", onPointerMove, true);
      document.addEventListener("pointerup", finish, true);
      document.addEventListener("pointercancel", finish, true);
    };

    const onWheel = (event) => {
      if (root.dataset.placement !== "floating") return;
      event.preventDefault();
      const current = readUiState();
      const direction = event.deltaY < 0 ? 1 : -1;
      const nextScale = clampNumber(current.scale + direction * FLOAT_SCALE_STEP, FLOAT_SCALE_MIN, FLOAT_SCALE_MAX);
      const next = clampFloatingPosition(root, current.x, current.y, nextScale);
      state.uiState = { ...current, ...next, mode: "floating" };
      applyFloatingUiState(root);
      writeUiState();
    };

    root.addEventListener("pointerdown", onPointerDown);
    root.addEventListener("wheel", onWheel, { passive: false });
    state.floatingPointerCleanup = () => {
      root.removeEventListener("pointerdown", onPointerDown);
      root.removeEventListener("wheel", onWheel);
    };
  }

  function toNumber(value, unit) {
    if (value == null) return null;

    const parsed = Number(String(value).replace(/,/g, ""));
    if (!Number.isFinite(parsed)) return null;

    const normalizedUnit = String(unit || "").toLowerCase();
    if (normalizedUnit === "k") return parsed * 1000;
    if (normalizedUnit === "m") return parsed * 1000000;
    return parsed;
  }

  function clampPercent(value) {
    if (!Number.isFinite(value)) return null;
    return Math.max(0, Math.min(100, value));
  }

  function clampNumber(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
  }

  function numberOrDefault(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function readUiState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(UI_STATE_STORAGE_KEY) || "null");
      const input = parsed && typeof parsed === "object" ? parsed : {};
      return {
        mode: input.mode === "floating" ? "floating" : "inline",
        floatingLayout: input.floatingLayout === "vertical" ? "vertical" : "horizontal",
        x: clampNumber(Number(input.x), 0, Math.max(0, window.innerWidth - 80)),
        y: clampNumber(Number(input.y), 0, Math.max(0, window.innerHeight - 40)),
        scale: clampNumber(Number(input.scale) || 1, FLOAT_SCALE_MIN, FLOAT_SCALE_MAX),
      };
    } catch {
      return { ...DEFAULT_FLOATING_UI };
    }
  }

  function writeUiState() {
    try {
      localStorage.setItem(UI_STATE_STORAGE_KEY, JSON.stringify(state.uiState));
    } catch {
    }
  }

  function shouldShowUsedInsteadOfLeft(config = state.uiConfig) {
    const context = config && config.context;
    return !!(context && context.showUsedInsteadOfLeft === true);
  }

  function normalizeLevelThresholds(value, defaults) {
    const input = value && typeof value === "object" ? value : {};

    return {
      criticalLeftPercent: clampPercent(numberOrDefault(input.criticalLeftPercent, defaults.criticalLeftPercent)),
      dangerLeftPercent: clampPercent(numberOrDefault(input.dangerLeftPercent, defaults.dangerLeftPercent)),
      warnLeftPercent: clampPercent(numberOrDefault(input.warnLeftPercent, defaults.warnLeftPercent)),
      noticeLeftPercent: clampPercent(numberOrDefault(input.noticeLeftPercent, defaults.noticeLeftPercent)),
    };
  }

  function normalizeUiConfig(value) {
    const input = value && typeof value === "object" ? value : {};
    const context = input.context && typeof input.context === "object" ? input.context : {};
    const provider = input.provider && typeof input.provider === "object" ? input.provider : {};

    return {
      context: {
        showUsedInsteadOfLeft: context.showUsedInsteadOfLeft === true,
        compressionWarningLeftPercent: clampPercent(numberOrDefault(
          context.compressionWarningLeftPercent,
          DEFAULT_UI_CONFIG.context.compressionWarningLeftPercent,
        )),
        levelThresholds: normalizeLevelThresholds(
          context.levelThresholds,
          DEFAULT_UI_CONFIG.context.levelThresholds,
        ),
      },
      provider: {
        levelThresholds: normalizeLevelThresholds(
          provider.levelThresholds,
          DEFAULT_UI_CONFIG.provider.levelThresholds,
        ),
      },
    };
  }

  function readUiConfig() {
    const summaryConfig = state.providerSummary && state.providerSummary.ui;
    return normalizeUiConfig(summaryConfig || window[CONFIG_KEY] || DEFAULT_UI_CONFIG);
  }

  function levelForLeftPercent(leftPercent, scope) {
    const config = scope === "provider" ? state.uiConfig.provider : state.uiConfig.context;
    const thresholds = config.levelThresholds;
    if (leftPercent <= thresholds.criticalLeftPercent) return "critical";
    if (leftPercent <= thresholds.dangerLeftPercent) return "danger";
    if (leftPercent <= thresholds.warnLeftPercent) return "warn";
    if (leftPercent <= thresholds.noticeLeftPercent) return "notice";
    return "normal";
  }

  function shouldShowCompressionWarning(leftPercent) {
    const threshold = state.uiConfig.context.compressionWarningLeftPercent;
    return Number.isFinite(threshold) && leftPercent <= threshold;
  }

  function compactNumber(value) {
    if (!Number.isFinite(value)) return "";
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return String(Math.round(value));
  }

  function formatTokenCount(value) {
    if (!Number.isFinite(value)) return "--";
    return Math.round(value).toLocaleString("en-US");
  }

  function formatAmount(value) {
    if (!Number.isFinite(value)) return "--";
    if (Math.abs(value) >= 1000) return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
    return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function formatMoney(value) {
    const amount = formatAmount(value);
    return amount === "--" ? amount : `$${amount}`;
  }

  function formatProviderTitle(name, provider, usedAmount, remainingAmount, totalAmount, usedPercent, leftPercent) {
    return [
      `${name} Balance`,
      `Left: ${formatMoney(remainingAmount)} (${leftPercent.toFixed(1)}%)`,
      `Used: ${formatMoney(usedAmount)} (${usedPercent.toFixed(1)}%)`,
      `Total: ${formatMoney(totalAmount)}`,
      `Status: ${provider.status || "unknown"}`,
    ].join(" | ");
  }

  function formatContextTitle(reading, usedTokens, remainingTokens, leftPercent, usedPercent) {
    const limitTokens = Number.isFinite(reading.limit) ? reading.limit : null;
    const parts = [
      "Context",
      `Left: ${formatTokenCount(remainingTokens)} Tokens (${leftPercent.toFixed(1)}%)`,
      `Used: ${formatTokenCount(usedTokens)} Tokens (${usedPercent.toFixed(1)}%)`,
    ];
    if (Number.isFinite(limitTokens)) parts.push(`Total: ${formatTokenCount(limitTokens)} Tokens`);
    if (reading.source) parts.push(`Source: ${reading.source}`);
    return parts.join(" | ");
  }

  function pruneSpendHistory(now = Date.now()) {
    const cutoff = now - SPEND_HISTORY_WINDOW_MS;
    for (const kind of ["context", "provider"]) {
      const items = state.spendHistory[kind];
      while (items.length && items[0].time < cutoff) items.shift();
      if (items.length > SPEND_HISTORY_MAX_ITEMS) {
        items.splice(0, items.length - SPEND_HISTORY_MAX_ITEMS);
      }
    }
  }

  function recordSpend(kind, amount, meta) {
    if (!Number.isFinite(amount) || amount <= 0 || !state.spendHistory[kind]) return;

    const now = Date.now();
    const conversationId =
      kind === "context"
        ? normalizeConversationId(meta || state.activeConversationId || "__unknown__") || "__unknown__"
        : metaConversationId();
    const itemMeta = kind === "provider" ? String(meta || "") : "";
    if (kind === "context") {
      const previousTotal = state.contextSessionTotalsByConversationId.get(conversationId) || 0;
      state.contextSessionTotalsByConversationId.set(conversationId, previousTotal + amount);
    } else {
      const previousTotal = state.providerSessionTotalsByConversationId.get(conversationId) || 0;
      state.providerSessionTotalsByConversationId.set(conversationId, previousTotal + amount);
    }

    state.spendHistory[kind].push({
      time: now,
      amount,
      conversationId,
      meta: itemMeta,
    });
    pruneSpendHistory(now);
    if (state.root && state.root.dataset.historyOpen === "true") {
      renderSpendHistory();
    }
  }

  function formatHistoryTime(time) {
    const date = new Date(time);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function formatHistoryDelta(kind, amount) {
    if (kind === "provider") return `-${formatMoney(amount)}`;
    return `-${Math.round(amount).toLocaleString("en-US")} Tokens`;
  }

  function formatHistoryAxisValue(kind, amount) {
    if (kind === "provider") return formatMoney(amount);
    if (!Number.isFinite(amount)) return "--";
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(1)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K`;
    return String(Math.round(amount));
  }

  function formatHistoryPointTitle(kind, point) {
    const lines = [
      `${formatHistoryTime(point.item.time)} ${formatHistoryDelta(kind, point.item.amount)}`,
    ];
    if (point.item.meta) lines.push(String(point.item.meta));
    return lines.join("\n");
  }

  function svgPoint(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "0.0";
  }

  function makeSpendHistoryChart(items, kind) {
    const now = Date.now();
    const cutoff = now - SPEND_HISTORY_WINDOW_MS;
    const width = SPEND_HISTORY_CHART_WIDTH;
    const height = SPEND_HISTORY_CHART_HEIGHT;
    const padding = SPEND_HISTORY_CHART_PADDING;
    const axisWidth = SPEND_HISTORY_CHART_AXIS_WIDTH;
    const plotLeft = axisWidth;
    const plotRight = width - padding;
    const plotTop = padding;
    const plotBottom = height - padding;
    const innerWidth = plotRight - plotLeft;
    const innerHeight = height - padding * 2;
    const chart = document.createElement("div");
    chart.className = "cds-history-chart";

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "cds-history-svg");
    svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
    svg.setAttribute("preserveAspectRatio", "none");
    svg.setAttribute("aria-hidden", "true");

    const validItems = [];
    for (const item of items) {
      if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
      const time = Number(item.time);
      if (!Number.isFinite(time) || time < cutoff) continue;
      validItems.push({
        time: clampNumber(time, cutoff, now),
        amount: item.amount,
        meta: item.meta || "",
      });
    }

    if (!validItems.length) {
      const empty = document.createElement("div");
      empty.className = "cds-history-empty";
      empty.textContent = "No spend in the last hour";
      chart.append(svg, empty);
      return chart;
    }

    const firstTime = validItems[0].time;
    const lastTime = validItems[validItems.length - 1].time;
    const timeSpan = lastTime - firstTime;
    const useIndexAxis = validItems.length === 1 || timeSpan <= 0;
    const axisLabel = formatHistoryTime(firstTime) === formatHistoryTime(lastTime)
      ? formatHistoryTime(firstTime)
      : `${formatHistoryTime(firstTime)}-${formatHistoryTime(lastTime)}`;
    const rawPoints = [];
    validItems.forEach((item, index) => {
      const xRatio = useIndexAxis
        ? index / Math.max(validItems.length - 1, 1)
        : (item.time - firstTime) / timeSpan;
      const x = plotLeft + xRatio * innerWidth;
      rawPoints.push({ x, value: item.amount, item });
    });

    const minValue = Math.min(...rawPoints.map((point) => point.value));
    const maxValue = Math.max(...rawPoints.map((point) => point.value));
    const fallbackRange = Math.max(maxValue, 1) * 0.12;
    const axisMin = minValue === maxValue ? Math.max(0, minValue - fallbackRange) : minValue;
    const axisMax = minValue === maxValue ? maxValue + fallbackRange : maxValue;
    const axisRange = Math.max(axisMax - axisMin, 1);
    const yForValue = (value) => plotBottom - ((value - axisMin) / axisRange) * innerHeight;
    const points = rawPoints.map((point) => ({
      ...point,
      y: yForValue(point.value),
    }));

    if (points.length === 1) {
      const onlyPoint = points[0];
      points.push({
        x: plotRight,
        y: onlyPoint.y,
        value: onlyPoint.value,
        item: onlyPoint.item,
        isSynthetic: true,
      });
    }

    const yAxis = document.createElementNS("http://www.w3.org/2000/svg", "path");
    yAxis.setAttribute("class", "cds-history-axis-line");
    yAxis.setAttribute("d", `M ${svgPoint(plotLeft)} ${svgPoint(plotTop)} V ${svgPoint(plotBottom)} H ${svgPoint(plotRight)}`);
    svg.appendChild(yAxis);

    const topGridline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    topGridline.setAttribute("class", "cds-history-gridline");
    topGridline.setAttribute("d", `M ${svgPoint(plotLeft)} ${svgPoint(plotTop)} H ${svgPoint(plotRight)}`);
    svg.appendChild(topGridline);

    const bottomGridline = document.createElementNS("http://www.w3.org/2000/svg", "path");
    bottomGridline.setAttribute("class", "cds-history-gridline");
    bottomGridline.setAttribute("d", `M ${svgPoint(plotLeft)} ${svgPoint(plotBottom)} H ${svgPoint(plotRight)}`);
    svg.appendChild(bottomGridline);

    const topLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    topLabel.setAttribute("class", "cds-history-axis-label");
    topLabel.setAttribute("x", "2");
    topLabel.setAttribute("y", svgPoint(plotTop + 4));
    topLabel.textContent = formatHistoryAxisValue(kind, axisMax);
    svg.appendChild(topLabel);

    const bottomLabel = document.createElementNS("http://www.w3.org/2000/svg", "text");
    bottomLabel.setAttribute("class", "cds-history-axis-label");
    bottomLabel.setAttribute("x", "2");
    bottomLabel.setAttribute("y", svgPoint(plotBottom));
    bottomLabel.textContent = formatHistoryAxisValue(kind, axisMin);
    svg.appendChild(bottomLabel);

    const linePath = points
      .map((point, index) => `${index === 0 ? "M" : "L"} ${svgPoint(point.x)} ${svgPoint(point.y)}`)
      .join(" ");
    const areaPath = `${linePath} L ${svgPoint(points[points.length - 1].x)} ${svgPoint(plotBottom)} L ${svgPoint(points[0].x)} ${svgPoint(plotBottom)} Z`;

    const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
    area.setAttribute("class", "cds-history-area");
    area.setAttribute("d", areaPath);
    svg.appendChild(area);

    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("class", "cds-history-line");
    line.setAttribute("d", linePath);
    svg.appendChild(line);

    const realPoints = points.filter((historyPoint) => !historyPoint.isSynthetic);
    const lastPoint = realPoints[realPoints.length - 1] || points[points.length - 1];
    for (const historyPoint of realPoints) {
      const isLatestPoint = historyPoint === lastPoint;
      const point = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      point.setAttribute("class", "cds-history-point");
      point.setAttribute("cx", svgPoint(historyPoint.x));
      point.setAttribute("cy", svgPoint(historyPoint.y));
      point.setAttribute("r", isLatestPoint ? "3" : "2.4");
      const pointTitle = document.createElementNS("http://www.w3.org/2000/svg", "title");
      pointTitle.textContent = formatHistoryPointTitle(kind, historyPoint);
      point.appendChild(pointTitle);
      svg.appendChild(point);

      const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      hit.setAttribute("class", "cds-history-hit");
      hit.setAttribute("cx", svgPoint(historyPoint.x));
      hit.setAttribute("cy", svgPoint(historyPoint.y));
      hit.setAttribute("r", "8");
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = formatHistoryPointTitle(kind, historyPoint);
      hit.appendChild(title);
      svg.appendChild(hit);
    }

    const caption = document.createElement("div");
    caption.className = "cds-history-caption";
    const windowLabel = document.createElement("span");
    windowLabel.textContent = axisLabel;
    const lastLabel = document.createElement("span");
    lastLabel.textContent = formatHistoryDelta(kind, lastPoint.item.amount);
    if (lastPoint.item.meta) lastLabel.title = String(lastPoint.item.meta);
    caption.append(windowLabel, lastLabel);

    chart.append(svg, caption);
    return chart;
  }

  function renderHistorySection(kind) {
    const panel = state.historyPanel;
    const section = panel && panel.querySelector(`[data-history-kind="${kind}"]`);
    if (!section) return;

    const visibleCard = kind === "provider" ? state.providerCard : state.contextCard;
    if (!visibleCard || visibleCard.hidden) {
      section.hidden = true;
      return;
    }
    if (section.hidden) section.hidden = false;

    pruneSpendHistory();
    const conversationId = metaConversationId();
    const items = state.spendHistory[kind].filter((item) => {
      const itemConversationId = normalizeConversationId(item.conversationId || "__unknown__") || "__unknown__";
      return itemConversationId === conversationId;
    });
    const total =
      kind === "context"
        ? contextSessionTotal(conversationId)
        : providerSessionTotal(conversationId);
    const totalNode = section.querySelector(".cds-history-total");
    const chart = section.querySelector(".cds-history-chart");
    if (totalNode) totalNode.textContent = total > 0 ? formatHistoryDelta(kind, total) : "--";
    if (!chart) return;

    chart.replaceWith(makeSpendHistoryChart(items, kind));
  }

  function metaConversationId() {
    return normalizeConversationId(state.activeConversationId || (state.lastReading && state.lastReading.conversationId) || "__unknown__") || "__unknown__";
  }

  function contextSessionTotal(conversationId) {
    const normalizedConversationId = normalizeConversationId(conversationId || "__unknown__") || "__unknown__";
    return state.contextSessionTotalsByConversationId.get(normalizedConversationId) || 0;
  }

  function providerSessionTotal(conversationId) {
    const normalizedConversationId = normalizeConversationId(conversationId || "__unknown__") || "__unknown__";
    return state.providerSessionTotalsByConversationId.get(normalizedConversationId) || 0;
  }

  function renderSpendHistory() {
    const grid = state.historyPanel && state.historyPanel.querySelector(".cds-history-grid");
    if (grid) {
      grid.dataset.providerVisible = state.providerCard && !state.providerCard.hidden ? "true" : "false";
    }
    renderHistorySection("context");
    renderHistorySection("provider");
  }

  function openSpendHistory() {
    const root = state.root;
    if (!root) return;
    if (root.hidden) {
      closeSpendHistory();
      return;
    }
    if (state.historyCloseTimer) {
      window.clearTimeout(state.historyCloseTimer);
      state.historyCloseTimer = 0;
    }
    renderSpendHistory();
    if (root.dataset.historyOpen !== "true") root.dataset.historyOpen = "true";
    if (state.historyPanel) state.historyPanel.setAttribute("aria-hidden", "false");
  }

  function closeSpendHistory() {
    const root = state.root;
    if (!root) return;
    if (state.historyCloseTimer) {
      window.clearTimeout(state.historyCloseTimer);
      state.historyCloseTimer = 0;
    }
    if (root.dataset.historyOpen !== "false") root.dataset.historyOpen = "false";
    if (state.historyPanel) state.historyPanel.setAttribute("aria-hidden", "true");
  }

  function scheduleCloseSpendHistory(event) {
    const root = state.root;
    if (!root) return;
    const relatedTarget = event && event.relatedTarget;
    if (relatedTarget && typeof relatedTarget.nodeType === "number" && root.contains(relatedTarget)) return;
    if (state.historyCloseTimer) window.clearTimeout(state.historyCloseTimer);
    state.historyCloseTimer = window.setTimeout(() => {
      state.historyCloseTimer = 0;
      if (root.matches(":hover")) return;
      closeSpendHistory();
    }, HISTORY_PANEL_CLOSE_DELAY_MS);
  }

  function rectContainsPoint(rect, x, y) {
    return !!rect && x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  }

  function expandedRectContainsPoint(rect, x, y, expand) {
    return !!rect &&
      x >= rect.left - expand &&
      x <= rect.right + expand &&
      y >= rect.top - expand &&
      y <= rect.bottom + expand;
  }

  function isPointerInsideHistorySurface(x, y) {
    const root = state.root;
    if (!root || root.hidden) return false;

    const cards = [state.contextCard, state.providerCard].filter((card) => card && !card.hidden);
    if (cards.some((card) => expandedRectContainsPoint(card.getBoundingClientRect(), x, y, 6))) {
      return true;
    }

    if (state.historyPanel && root.dataset.historyOpen === "true") {
      const panelRect = state.historyPanel.getBoundingClientRect();
      if (expandedRectContainsPoint(panelRect, x, y, 6)) return true;

      for (const card of cards) {
        const cardRect = card.getBoundingClientRect();
        const bridgeLeft = Math.min(cardRect.left, panelRect.left) - 6;
        const bridgeRight = Math.max(cardRect.right, panelRect.right) + 6;
        const bridgeTop = Math.min(cardRect.bottom, panelRect.top) - 2;
        const bridgeBottom = Math.max(cardRect.bottom, panelRect.top) + 10;
        if (x >= bridgeLeft && x <= bridgeRight && y >= bridgeTop && y <= bridgeBottom) return true;
      }
    }

    return false;
  }

  function installHistoryPointerTracker(root) {
    const onPointerMove = (event) => {
      if (isPointerInsideHistorySurface(event.clientX, event.clientY)) {
        openSpendHistory();
      } else if (root.dataset.historyOpen === "true") {
        scheduleCloseSpendHistory();
      }
    };
    const onPointerLeave = () => {
      if (root.dataset.historyOpen === "true") scheduleCloseSpendHistory();
    };

    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerdown", onPointerMove, { passive: true });
    window.addEventListener("blur", closeSpendHistory);
    document.addEventListener("mouseleave", onPointerLeave);

    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerdown", onPointerMove);
      window.removeEventListener("blur", closeSpendHistory);
      document.removeEventListener("mouseleave", onPointerLeave);
    };
  }

  function installHistoryHover(root) {
    if (!root) return;
    if (state.historyHoverCleanup && root.dataset.historyHoverInstalled === "true") return;
    if (state.historyHoverCleanup) state.historyHoverCleanup();
    root.dataset.historyHoverInstalled = "true";
    if (root.dataset.historyOpen !== "true") root.dataset.historyOpen = "false";
    state.historyHoverCleanup = installHistoryPointerTracker(root);
  }

  function clearSpendEffects() {
    window.clearTimeout(state.spendEffectTimer);
    state.spendEffectTimer = 0;
    state.spendEffectQueue.length = 0;
    if (state.spendEffectActive) {
      state.spendEffectActive.remove();
      state.spendEffectActive = null;
    }
    const root = state.root || document.getElementById(ROOT_ID);
    root?.querySelectorAll(".cds-hit-pop").forEach((node) => node.remove());
  }

  function hasPendingSpendEffects() {
    return !!(state.spendEffectActive || state.spendEffectQueue.length);
  }

  function finishSpendEffect(pop) {
    if (state.spendEffectActive !== pop) return;
    window.clearTimeout(state.spendEffectTimer);
    state.spendEffectTimer = 0;
    state.spendEffectActive = null;
    pop.remove();
    playNextSpendEffect();
    if (!hasPendingSpendEffects()) {
      const root = state.root || document.getElementById(ROOT_ID);
      if (root) updateDockVisibility(root);
    }
  }

  function playNextSpendEffect() {
    if (state.spendEffectActive) return;
    const root = state.root || document.getElementById(ROOT_ID);
    if (!root || root.hidden) return;

    const text = state.spendEffectQueue.shift();
    if (!text) return;

    const pop = document.createElement("div");
    pop.className = "cds-hit-pop";
    pop.textContent = text;
    state.spendEffectActive = pop;
    root.appendChild(pop);

    const onAnimationEnd = (event) => {
      if (event.target !== pop || event.animationName !== "cds-hit-pop") return;
      pop.removeEventListener("animationend", onAnimationEnd);
      finishSpendEffect(pop);
    };
    pop.addEventListener("animationend", onAnimationEnd);
    state.spendEffectTimer = window.setTimeout(() => finishSpendEffect(pop), SPEND_EFFECT_FALLBACK_MS);
  }

  function enqueueSpendEffect(text) {
    if (!text) return;
    state.spendEffectQueue.push(text);
    playNextSpendEffect();
  }

  function showTokenSpendEffect(deltaTokens) {
    if (!Number.isFinite(deltaTokens) || deltaTokens <= 0) return;
    enqueueSpendEffect(`-${Math.round(deltaTokens).toLocaleString("en-US")} Tokens`);
  }

  function showProviderSpendEffect(deltaAmount) {
    if (!Number.isFinite(deltaAmount) || deltaAmount <= 0) return;
    enqueueSpendEffect(`-${formatMoney(deltaAmount)}`);
  }

  function shouldShowContextSpendEffect(conversationId, currentUsed) {
    if (!Number.isFinite(currentUsed)) return false;
    const now = Date.now();
    const normalizedConversationId = normalizeConversationId(conversationId || "__unknown__") || "__unknown__";
    const roundedCurrentUsed = Math.round(currentUsed);
    const previous = window[CONTEXT_SPEND_DEDUPE_KEY];
    const isSameReading =
      previous &&
      previous.currentUsed === roundedCurrentUsed &&
      (
        previous.conversationId === normalizedConversationId ||
        previous.conversationId === "__unknown__" ||
        normalizedConversationId === "__unknown__"
      );
    if (isSameReading && now - previous.at < CONTEXT_SPEND_DEDUPE_WINDOW_MS) {
      return false;
    }
    window[CONTEXT_SPEND_DEDUPE_KEY] = {
      conversationId: normalizedConversationId,
      currentUsed: roundedCurrentUsed,
      at: now,
    };
    return true;
  }

  function shouldShowProviderSpendEffect(providerId, currentUsed) {
    if (!providerId || !Number.isFinite(currentUsed)) return false;
    const now = Date.now();
    const key = `${providerId}:${currentUsed}`;
    const previous = window[PROVIDER_SPEND_DEDUPE_KEY];
    if (previous && previous.key === key && now - previous.at < PROVIDER_SPEND_DEDUPE_WINDOW_MS) {
      return false;
    }
    window[PROVIDER_SPEND_DEDUPE_KEY] = { key, at: now };
    return true;
  }

  function hasDescendant(element, selector) {
    return !!(element && element.querySelector(selector));
  }

  // 只把主会话内容区当作可显示区域；Codex App DOM 更新后，优先从这里重找 thread/transcript 锚点。
  function hasThreadContentSurface() {
    if (!isConversationWindow()) return false;

    const now = Date.now();
    if (now - state.threadContentLookupAt < ACTIVE_CONVERSATION_LOOKUP_CACHE_MS) {
      return state.threadContentLookupResult;
    }

    const main = document.querySelector("main");
    const result = hasDescendant(main, THREAD_CONTENT_SELECTOR);
    state.threadContentLookupAt = now;
    state.threadContentLookupResult = result;
    return result;
  }

  function invalidateThreadContentCache() {
    state.threadContentLookupAt = 0;
  }

  // Pet/头像层也运行在 app://-/index.html，需要额外按 route 排除非对话窗口。
  function isConversationWindow() {
    const url = new URL(location.href);
    const route = `${url.pathname} ${url.search} ${url.hash}`.toLowerCase();
    if (route.includes("avatar-overlay") || route.includes("pet")) return false;

    return url.protocol === "app:" && url.pathname.endsWith("/index.html");
  }

  function updateDockVisibility(root) {
    const contextVisible = state.contextCard && !state.contextCard.hidden;
    const providerVisible = state.providerCard && !state.providerCard.hidden;
    const hidden = !contextVisible && !providerVisible;
    const keepVisibleForSpend = hidden && hasPendingSpendEffects();
    root.hidden = hidden && !keepVisibleForSpend;
    if (hidden) {
      closeSpendHistory();
      if (!keepVisibleForSpend) clearSpendEffects();
    } else if (root.dataset.historyOpen === "true") {
      renderSpendHistory();
    }
    if (!root.hidden) playNextSpendEffect();
  }

  function hideMeter(root, card, value, fill, title) {
    if (!card) return;
    if (card.dataset.known !== "false") card.dataset.known = "false";
    if (card.dataset.level !== "normal") card.dataset.level = "normal";
    if (card.dataset.compressionWarning !== "false") card.dataset.compressionWarning = "false";
    if (card.title !== title) card.title = title;
    if (value.textContent !== "Context Left --") value.textContent = "Context Left --";
    if (fill.style.width !== "0%") fill.style.width = "0%";
    const ring = card.querySelector(".cds-ring");
    if (ring) ring.style.setProperty("--cds-ring-angle", "0deg");
    card.hidden = true;
    updateDockVisibility(root);
  }

  function hideProviderMeter(root, reason) {
    const card = state.providerCard;
    if (!card) return;
    if (card.dataset.known !== "false") card.dataset.known = "false";
    if (card.dataset.level !== "normal") card.dataset.level = "normal";
    if (card.title !== reason) card.title = reason;
    if (state.providerFill && state.providerFill.style.width !== "0%") state.providerFill.style.width = "0%";
    const ring = card.querySelector(".cds-ring");
    if (ring) ring.style.setProperty("--cds-ring-angle", "0deg");
    card.hidden = true;
    updateDockVisibility(root);
  }

  function pickProviderSummary(summary) {
    const providers = summary && Array.isArray(summary.providers) ? summary.providers : [];
    return providers.find((provider) => provider && provider.status === "active") || null;
  }

  function renderProviderMeter(root) {
    state.providerSummary = readProviderSummary();
    state.uiConfig = readUiConfig();

    // DeepSeek V4: 始终显示计费面板 (不依赖 provider summary)
    const card = state.providerCard;
    if (!card || !state.providerValue || !state.providerFill) return;

    const balance = state.cdsBalance;
    const balanceLevel = state.cdsBalanceLevel || "normal";
    const cacheRate = getCacheHitRate();
    const cost = state.cdsSessionCost;

    // 余额显示
    let balanceText = "查询中...";
    let leftPercent = 50; // 默认 50%
    let level = "normal";

    if (balance && balance.total != null) {
      const total = balance.total;
      const currency = balance.currency === "CNY" ? "¥" : "$";
      balanceText = `${currency}${total.toFixed(2)}`;

      // 余额进度条: 假设 100 为满额, 显示剩余比例
      const ratio = Math.min(total / 100, 1);
      leftPercent = clampPercent(ratio * 100);

      level = balanceLevel === "danger" ? "critical"
        : balanceLevel === "warn" ? "warn"
        : balanceLevel === "critical" ? "critical"
        : balanceLevel === "warning" ? "warn"
        : "normal";
    } else {
      // 无余额数据时仍显示基本信息
      balanceText = "设定 API Key →";
      leftPercent = 30;
      level = "notice";
    }

    // 缓存命中率
    const cacheDisplay = state.cdsSessionInputTokens > 0
      ? `${cacheRate.toFixed(1)}%`
      : "—";

    // 本轮花费
    const costCNY = state.cdsSessionCostCNY || (cost * USD_TO_CNY);
    const costDisplay = cost > 0 ? `$${cost.toFixed(3)}/¥${costCNY.toFixed(3)}` : "$0.000";
    const savingsDisplay = state.cdsSessionCacheSavings > 0
      ? ` (省$${state.cdsSessionCacheSavings.toFixed(3)})` : "";

    // 构建显示文本
    const text = `${CDS_MODEL} | Cache ${cacheDisplay}${savingsDisplay} | ${costDisplay} | ${balanceText}`;
    const title = [
      "DeepSeek V4",
      "输入: " + formatTokenCount(state.cdsSessionInputTokens) + " | 输出: " + formatTokenCount(state.cdsSessionOutputTokens),
      "缓存命中: " + formatTokenCount(state.cdsSessionCacheHitTokens) + " | 未命中: " + formatTokenCount(state.cdsSessionCacheMissTokens) + " | 写入: " + formatTokenCount(state.cdsSessionCacheWriteTokens),
      "缓存命中率: " + cacheRate.toFixed(1) + "% | 缓存节省: $" + state.cdsSessionCacheSavings.toFixed(4),
      "本轮花费: $" + cost.toFixed(4) + " / ¥" + costCNY.toFixed(2),
      "余额: " + balanceText
    ].join("\n");

    const width = `${leftPercent}%`;

    // 余额变化检测(触发消费动效)
    const currentCost = Math.round(cost * 10000);
    const previousCost = state.lastAnimatedProviderUsedById.get("dsv4") || 0;
    if (currentCost > previousCost && previousCost > 0) {
      const delta = (currentCost - previousCost) / 10000;
      if (shouldShowProviderSpendEffect("dsv4", currentCost)) {
        recordSpend("provider", delta, "dsv4");
        showProviderSpendEffect(delta);
      }
    }
    state.lastAnimatedProviderUsedById.set("dsv4", currentCost);

    if (card.dataset.known !== "true") card.dataset.known = "true";
    if (card.dataset.level !== level) card.dataset.level = level;
    if (card.title !== title) card.title = title;
    if (state.providerValue.textContent !== text) state.providerValue.textContent = text;
    if (state.providerFill.style.width !== width) state.providerFill.style.width = width;
    const providerRing = card.querySelector(".cds-ring");
    if (providerRing) providerRing.style.setProperty("--cds-ring-angle", `${leftPercent * 3.6}deg`);
    if (card.hidden) card.hidden = false;
    updateDockVisibility(root);
  }

  function readProviderSummary() {
    const summary = window[PROVIDER_SUMMARY_KEY];
    return summary && typeof summary === "object" ? summary : null;
  }

  // helper 通过 CDP 写入脱敏 summary；真实 token、用户 ID 和服务商地址不进入渲染页。
  // DeepSeek 版: summary 直接包含 balance / status / pricing 等字段
  function setProviderSummary(summary) {
    state.providerSummary = summary && typeof summary === "object" ? summary : null;
    if (state.providerSummary) {
      window[PROVIDER_SUMMARY_KEY] = state.providerSummary;
      if (state.providerSummary.ui && typeof state.providerSummary.ui === "object") {
        window[CONFIG_KEY] = normalizeUiConfig(state.providerSummary.ui);
      }
    }
    // DeepSeek: 更新余额状态
    updateCdsBalance(summary);
    const root = state.root || document.getElementById(ROOT_ID);
    if (root) renderProviderMeter(root);
  }

  function installProviderSummaryListener() {
    if (state.providerSummaryListener) return;
    state.providerSummary = readProviderSummary();
    state.providerSummaryListener = (event) => {
      setProviderSummary(event && event.detail);
    };
    try {
      window.addEventListener(PROVIDER_SUMMARY_EVENT, state.providerSummaryListener);
    } catch {
    }
  }

  // ===== DeepSeek V4 计费功能 =====

  function calculateCdsCost() {
    const missCost = (state.cdsSessionCacheMissTokens / 1_000_000) * CDS_PRICING.inputCacheMiss;
    const hitCost = (state.cdsSessionCacheHitTokens / 1_000_000) * CDS_PRICING.inputCacheHit;
    const outputCost = (state.cdsSessionOutputTokens / 1_000_000) * CDS_PRICING.output;
    return missCost + hitCost + outputCost;
  }

  function calculateCacheSavings() {
    // 缓存命中的 token 如果按 cache-miss 价格计算会是多少，减去实际 cache-hit 价格
    if (state.cdsSessionCacheHitTokens === 0) return 0;
    const fullPrice = (state.cdsSessionCacheHitTokens / 1_000_000) * CDS_PRICING.inputCacheMiss;
    const actualPrice = (state.cdsSessionCacheHitTokens / 1_000_000) * CDS_PRICING.inputCacheHit;
    return fullPrice - actualPrice;
  }

  function getCacheHitRate() {
    const total = state.cdsSessionCacheHitTokens + state.cdsSessionCacheMissTokens;
    if (total === 0) return 0;
    return (state.cdsSessionCacheHitTokens / total) * 100;
  }

  function getBalanceLevel(total) {
    if (total == null || !Number.isFinite(total)) return "unknown";
    if (total <= BALANCE_DANGER) return "critical";
    if (total <= BALANCE_WARN) return "warning";
    return "normal";
  }

  function updateCdsBalance(summary) {
    if (!summary || summary.status !== "ok") {
      state.cdsBalance = null;
      state.cdsBalanceLevel = "unknown";
      return;
    }
    state.cdsBalance = summary.balance || null;
    state.cdsBalanceLevel = summary.balanceLevel || getBalanceLevel(state.cdsBalance?.total);
    state.cdsBalanceTimestamp = summary.timestamp || Date.now();
  }

  // 直接从页面调 /user/balance (无需 Helper，Key 从拦截到的请求头提取)
  function fetchBalanceFromPage() {
    if (state.cdsBalanceFetching || !state.cdsApiKey) return;
    state.cdsBalanceFetching = true;

    var req = new XMLHttpRequest();
    req.open("GET", "https://api.deepseek.com/user/balance", true);
    req.setRequestHeader("Accept", "application/json");
    req.setRequestHeader("Authorization", "Bearer " + state.cdsApiKey);
    req.timeout = 10000;

    req.onloadend = function () {
      state.cdsBalanceFetching = false;
      try {
        if (req.status >= 200 && req.status < 300) {
          var json = JSON.parse(req.responseText);
          var info = (json.balance_infos || []).find(function (b) {
            return b.currency === "CNY" || b.currency === "USD";
          });
          if (info) {
            updateCdsBalance({
              status: "ok",
              balance: {
                total: parseFloat(info.total_balance) || 0,
                granted: parseFloat(info.granted_balance) || 0,
                toppedUp: parseFloat(info.topped_up_balance) || 0,
                currency: info.currency,
                isAvailable: json.is_available === true,
              },
              balanceLevel: getBalanceLevel(parseFloat(info.total_balance) || 0),
              timestamp: Date.now(),
            });
          }
        }
      } catch (e) {}
    };

    req.onerror = function () { state.cdsBalanceFetching = false; };
    req.ontimeout = function () { state.cdsBalanceFetching = false; };
    req.send();
  }

  function startBalancePolling() {
    if (state.cdsBalanceTimer) return;
    // 每 30 秒查一次余额
    state.cdsBalanceTimer = setInterval(function () {
      if (state.cdsApiKey) fetchBalanceFromPage();
    }, 30000);
  }

  // SSE 流式解析: 从 data: 行中提取 JSON 片段
  function extractSSEFragments(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (line) { return line.trim(); })
      .filter(function (line) { return line.indexOf("data:") === 0; })
      .map(function (line) { return line.slice(5).trim(); })
      .filter(function (line) { return line && line !== "[DONE]"; });
  }

  // API 响应监控: 拦截 fetch/XHR/WebSocket 解析 DeepSeek usage 数据
  function installCdsApiMonitor() {
    if (state.cdsApiMonitorInstalled) return;
    state.cdsApiMonitorInstalled = true;

    // 拦截 fetch (支持流式 SSE) + 捕获 API Key
    var origFetch = window.fetch;
    window.fetch = function () {
      var args = arguments;
      var url = args[0];
      var urlStr = typeof url === "string" ? url : (url && url.url ? url.url : "");
      var options = args[1];

      // 捕获 DeepSeek API Key (从 Authorization 头)
      if (!state.cdsApiKey && /deepseek/i.test(urlStr) && options && options.headers) {
        try {
          var auth = null;
          if (options.headers instanceof Headers) {
            auth = options.headers.get("Authorization") || options.headers.get("authorization");
          } else if (typeof options.headers === "object") {
            auth = options.headers["Authorization"] || options.headers["authorization"];
          }
          if (auth && auth.indexOf("Bearer ") === 0) {
            state.cdsApiKey = auth.slice(7).trim();
            state.cdsApiKeySource = "page-intercept";
            // 首次捕获到 Key 后立即查余额
            fetchBalanceFromPage();
          }
        } catch (e) {}
      }

      var responsePromise = origFetch.apply(this, args);
      responsePromise.then(function (response) {
        processCdsFetchResponse(url, response.clone());
      }).catch(function () {});
      return responsePromise;
    };

    // 同时检查 localStorage 是否有 Codex++ 存储的 Key
    if (!state.cdsApiKey) {
      try {
        var storedKey = localStorage.getItem("codex-api-key")
          || localStorage.getItem("deepseek-api-key")
          || localStorage.getItem("apiKey");
        if (storedKey && storedKey.trim().length > 10) {
          state.cdsApiKey = storedKey.trim();
          state.cdsApiKeySource = "localStorage";
          fetchBalanceFromPage();
        }
      } catch (e) {}
    }

    // 拦截 XMLHttpRequest (也抓 Key)
    var origSetRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
    XMLHttpRequest.prototype.setRequestHeader = function (name, value) {
      if (!state.cdsApiKey && /authorization/i.test(name) && value && value.indexOf("Bearer ") === 0) {
        state.cdsApiKey = value.slice(7).trim();
        state.cdsApiKeySource = "xhr-intercept";
        fetchBalanceFromPage();
      }
      return origSetRequestHeader.apply(this, arguments);
    };

    // 拦截 XMLHttpRequest
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__dsv4Url = String(url || "");
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      var xhr = this;
      xhr.addEventListener("loadend", function () {
        if (xhr.__dsv4Url && /deepseek|chat\/completions/i.test(xhr.__dsv4Url)) {
          try { processCdsResponseText(xhr.responseText || ""); } catch (e) {}
        }
      });
      return origSend.apply(this, arguments);
    };

    // 拦截 WebSocket (参考 codex-token-usage)
    if (typeof window.WebSocket === "function" && !window.WebSocket.__dsv4Wrapped) {
      var NativeWS = window.WebSocket;
      function DSV4WebSocket() {
        var socket = new (Function.prototype.bind.apply(NativeWS, [null].concat(Array.prototype.slice.call(arguments))))();
        socket.addEventListener("message", function (event) {
          try {
            if (typeof event.data === "string") {
              processCdsResponseText(event.data);
            } else if (event.data instanceof Blob && event.data.size <= 512000) {
              event.data.text().then(function (text) {
                processCdsResponseText(text);
              }).catch(function () {});
            }
          } catch (e) {}
        });
        return socket;
      }
      try {
        DSV4WebSocket.prototype = NativeWS.prototype;
        DSV4WebSocket.CONNECTING = NativeWS.CONNECTING;
        DSV4WebSocket.OPEN = NativeWS.OPEN;
        DSV4WebSocket.CLOSING = NativeWS.CLOSING;
        DSV4WebSocket.CLOSED = NativeWS.CLOSED;
      } catch (e) {}
      window.WebSocket = DSV4WebSocket;
      window.WebSocket.__dsv4Wrapped = true;
    }
  }

  function processCdsFetchResponse(url, response) {
    try {
      var urlStr = typeof url === "string" ? url : (url && url.url ? url.url : "");
      if (!/deepseek|chat\/completions|responses/i.test(urlStr)) return;
      response.text().then(function (text) {
        processCdsResponseText(text);
      }).catch(function () {});
    } catch (e) {}
  }

  function processCdsResponseText(text) {
    if (!text || text.length < 10) return;

    // 先尝试直接 JSON 解析 (非流式)
    try {
      var json = JSON.parse(text);
      if (processCdsApiResponse(json)) return;
    } catch (e) {}

    // SSE 流式解析: 从 data: 行中提取 usage
    var fragments = extractSSEFragments(text);
    for (var i = 0; i < fragments.length; i++) {
      try {
        var frag = JSON.parse(fragments[i]);
        if (processCdsApiResponse(frag)) return;
      } catch (e) {}
    }
  }

  function processCdsApiResponse(json) {
    if (!json || !json.usage) return false;
    var u = json.usage;

    var promptTokens = u.prompt_tokens || u.input_tokens || 0;
    var completionTokens = u.completion_tokens || u.output_tokens || 0;
    // 优先用 API 原始字段，其次用 details 对象
    var cacheHit = u.prompt_cache_hit_tokens
      || (u.prompt_tokens_details && u.prompt_tokens_details.cached_tokens)
      || (u.input_tokens_details && u.input_tokens_details.cached_tokens)
      || 0;
    var cacheMiss = u.prompt_cache_miss_tokens
      || Math.max(0, promptTokens - cacheHit);
    var cacheWrite = u.prompt_cache_write_tokens
      || (u.prompt_tokens_details && u.prompt_tokens_details.cache_write_tokens)
      || 0;

    if (promptTokens === 0 && completionTokens === 0) return false;

    state.cdsSessionInputTokens += promptTokens;
    state.cdsSessionOutputTokens += completionTokens;
    state.cdsSessionCacheHitTokens += cacheHit;
    state.cdsSessionCacheMissTokens += Math.max(0, cacheMiss);
    state.cdsSessionCacheWriteTokens += cacheWrite;
    state.cdsSessionCost = calculateCdsCost();
    state.cdsSessionCostCNY = state.cdsSessionCost * USD_TO_CNY;
    state.cdsSessionCacheSavings = calculateCacheSavings();

    return true;
  }

  function makeReading(percent, source, raw, used, limit) {
    const safePercent = clampPercent(percent);
    if (safePercent == null) return null;

    return {
      percent: safePercent,
      source,
      raw: String(raw || "").slice(0, 240),
      used: Number.isFinite(used) ? used : null,
      limit: Number.isFinite(limit) ? limit : null,
      conversationId: null,
    };
  }

  function normalizeConversationId(value) {
    if (value == null) return null;
    if (typeof value !== "string" && typeof value !== "number") return null;

    const text = String(value).trim();
    if (!text) return null;

    const uuidMatch = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(text);
    if (uuidMatch) return uuidMatch[0].toLowerCase();

    return text.replace(/^[a-z]+:/i, "").toLowerCase();
  }

  function conversationIdsMatch(left, right) {
    const normalizedLeft = normalizeConversationId(left);
    const normalizedRight = normalizeConversationId(right);
    return !!normalizedLeft && !!normalizedRight && normalizedLeft === normalizedRight;
  }

  function withConversationId(reading, conversationId) {
    if (!reading) return null;

    const normalizedConversationId = normalizeConversationId(conversationId);
    if (normalizedConversationId) {
      reading.conversationId = normalizedConversationId;
    }

    return reading;
  }

  // React 私有 key 每次构建都会换后缀；按节点缓存 key 列表能避开冷启动时的大量 Reflect.ownKeys。
  function getReactPrivateKeys(node) {
    if (!node || (typeof node !== "object" && typeof node !== "function")) return [];

    const cached = state.reactPrivateKeyCache.get(node);
    if (cached) return cached;

    let keys = [];
    try {
      keys = Reflect.ownKeys(node).map(String).filter((key) => REACT_PRIVATE_KEY_RE.test(key));
    } catch {
      keys = [];
    }

    state.reactPrivateKeyCache.set(node, keys);
    return keys;
  }

  function getFilteredReflectKeys(value, cacheName, pattern, limit) {
    if (!value || (typeof value !== "object" && typeof value !== "function")) return [];

    let cache = state.filteredReflectKeyCache.get(value);
    if (!cache) {
      cache = {};
      state.filteredReflectKeyCache.set(value, cache);
    }

    if (cache[cacheName]) return cache[cacheName];

    let keys = [];
    try {
      keys = Reflect.ownKeys(value)
        .map(String)
        .filter((key) => pattern.test(key))
        .slice(0, limit);
    } catch {
      keys = [];
    }

    cache[cacheName] = keys;
    return keys;
  }

  // 只缓存对象 key 列表，不缓存属性值；React/store 对象的值会变，key 通常稳定。
  function getContextValueKeys(value) {
    return getFilteredReflectKeys(value, "contextValueText", VALUE_TEXT_KEY_RE, 100);
  }

  // Codex 部分会话 ID 只存在于 React 写到 DOM 节点上的私有 props，普通 attribute 读不到。
  function getReactPropValue(node, propName) {
    if (!node) return null;

    for (const key of getReactPrivateKeys(node)) {
      if (!key.startsWith("__reactProps$")) continue;

      let props;
      try {
        props = node[key];
      } catch {
        continue;
      }

      if (props && props[propName] != null) {
        return props[propName];
      }
    }

    return null;
  }

  function getElementConversationId(element) {
    for (let node = element; node && node.nodeType === Node.ELEMENT_NODE; node = node.parentElement) {
      const attrValue =
        node.getAttribute("data-app-action-sidebar-thread-id") ||
        node.getAttribute("data-thread-id") ||
        node.getAttribute("data-conversation-id") ||
        getReactPropValue(node, "data-app-action-sidebar-thread-id") ||
        getReactPropValue(node, "data-thread-id") ||
        getReactPropValue(node, "data-conversation-id");
      const normalized = normalizeConversationId(attrValue);
      if (normalized) return normalized;
    }

    return null;
  }

  function readActiveConversationId() {
    const now = Date.now();
    if (now - state.activeConversationIdLookupAt < ACTIVE_CONVERSATION_LOOKUP_CACHE_MS) {
      return state.cachedActiveConversationId;
    }

    // 当前会话 ID 主要挂在左侧会话列表的 current/selected/active 状态节点上。
    const selectors = [
      `[aria-current="page"][data-app-action-sidebar-thread-id]`,
      `[data-app-action-sidebar-thread-active="true"][data-app-action-sidebar-thread-id]`,
      `[aria-selected="true"][data-app-action-sidebar-thread-id]`,
      `[aria-current="page"]`,
      `[data-app-action-sidebar-thread-active="true"]`,
      `[aria-selected="true"]`,
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const conversationId = getElementConversationId(element);
      if (conversationId) {
        state.cachedActiveConversationId = conversationId;
        state.activeConversationIdLookupAt = now;
        return conversationId;
      }
    }

    state.cachedActiveConversationId = null;
    state.activeConversationIdLookupAt = now;
    return null;
  }

  function getObjectConversationId(value) {
    if (!value || typeof value !== "object") return null;

    const candidates = [
      value.conversationId,
      value.localConversationId,
      value.threadId,
      value.id,
      value.key,
      value.params && value.params.conversationId,
      value.params && value.params.localConversationId,
      value.params && value.params.threadId,
      value.thread && value.thread.id,
      value.thread && value.thread.threadId,
      value.conversation && value.conversation.id,
    ];

    for (const candidate of candidates) {
      const normalized = normalizeConversationId(candidate);
      if (normalized) return normalized;
    }

    return null;
  }

  function activateConversationId(activeConversationId, options = {}) {
    const normalizedConversationId = normalizeConversationId(activeConversationId);
    if (!normalizedConversationId) return false;

    if (normalizedConversationId !== state.activeConversationId) {
      clearRetryUpdate();
      window.clearTimeout(state.pendingUpdate);
      state.pendingUpdateDueAt = 0;
      state.activeConversationId = normalizedConversationId;
      state.cachedActiveConversationId = normalizedConversationId;
      state.activeConversationIdLookupAt = Date.now();
      state.lastReading = state.readingsByConversationId.get(normalizedConversationId) || null;
      state.lastScanAt = 0;
      state.lastScannedConversationId = null;
      state.expensiveFallbackScannedAt = 0;
      state.expensiveFallbackConversationId = null;
      state.navigationPendingUntil = options.pendingNavigation ? Date.now() + NAVIGATION_PENDING_MS : 0;
      state.switchRetryUntil = Date.now() + SWITCH_RETRY_WINDOW_MS;
      scheduleRetryUpdate();
      return true;
    }

    return false;
  }

  // 只刷新会话指针，不触发“切换会话”副作用；用于侧栏隐藏或短暂缺失 active 节点的场景。
  function retainConversationId(conversationId) {
    const normalizedConversationId = normalizeConversationId(conversationId);
    if (!normalizedConversationId) return false;

    state.activeConversationId = normalizedConversationId;
    state.cachedActiveConversationId = normalizedConversationId;
    state.activeConversationIdLookupAt = Date.now();
    return true;
  }

  function updateActiveConversationId() {
    const activeConversationId = readActiveConversationId();
    if (activeConversationId) {
      if (
        state.activeConversationId &&
        !conversationIdsMatch(activeConversationId, state.activeConversationId) &&
        Date.now() < state.navigationPendingUntil
      ) {
        return state.activeConversationId;
      }

      activateConversationId(activeConversationId);
    } else if (hasThreadContentSurface() && state.activeConversationId) {
      // sidebar 隐藏时 active/current 节点会消失；主会话区仍在时沿用最后确认的会话 ID。
      retainConversationId(state.activeConversationId);
    } else if (hasThreadContentSurface() && state.lastReading && state.lastReading.conversationId) {
      retainConversationId(state.lastReading.conversationId);
    } else {
      state.activeConversationId = null;
      state.lastReading = null;
      state.cachedActiveConversationId = null;
      state.activeConversationIdLookupAt = Date.now();
      state.navigationPendingUntil = 0;
      state.switchRetryUntil = 0;
      clearRetryUpdate();
    }

    return state.activeConversationId;
  }

  function parsePercentText(text, source) {
    if (!text || !contextTerms.test(text)) return null;

    const patterns = [
      /(?:context|token|tokens|usage|window|budget|remaining|上下文|令牌|使用|窗口)[^%\n]{0,80}?(\d{1,3}(?:\.\d+)?)\s*%/i,
      /(\d{1,3}(?:\.\d+)?)\s*%[^%\n]{0,80}?(?:context|token|tokens|usage|window|budget|remaining|上下文|令牌|使用|窗口)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) continue;

      const percent = Number(match[1]);
      if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        const raw = match[0];
        const usedPercent = /left|remaining|remain|available|free|剩余|可用/i.test(raw)
          ? 100 - percent
          : percent;
        return makeReading(usedPercent, source, raw);
      }
    }

    return null;
  }

  // /status 输出格式的文本锚点；如果上游改了 Context 行文案，优先同步这里。
  function parseStatusContextText(text, source) {
    if (!text || !/\bContext\s*:/i.test(text)) return null;

    const normalized = String(text).replace(/\s+/g, " ");
    const statusPattern =
      /\bContext\s*:\s*(\d{1,3}(?:\.\d+)?)\s*%\s*(left|remaining|used|full)?\s*\(\s*([\d,.]+)\s*([kKmM]?)\s*used\s*\/\s*([\d,.]+)\s*([kKmM]?)\s*\)/i;
    const statusMatch = statusPattern.exec(normalized);

    if (statusMatch) {
      const reportedPercent = Number(statusMatch[1]);
      const mode = String(statusMatch[2] || "left").toLowerCase();
      const used = toNumber(statusMatch[3], statusMatch[4]);
      const limit = toNumber(statusMatch[5], statusMatch[6]);

      if (used != null && limit != null && limit > 0 && used >= 0 && used <= limit * 1.25) {
        return makeReading((used / limit) * 100, source, statusMatch[0], used, limit);
      }

      if (Number.isFinite(reportedPercent)) {
        const usedPercent = mode === "left" || mode === "remaining" ? 100 - reportedPercent : reportedPercent;
        return makeReading(usedPercent, source, statusMatch[0]);
      }
    }

    const leftPattern = /\bContext\s*:\s*(\d{1,3}(?:\.\d+)?)\s*%\s*(left|remaining)\b/i;
    const leftMatch = leftPattern.exec(normalized);
    if (leftMatch) {
      const leftPercent = Number(leftMatch[1]);
      if (Number.isFinite(leftPercent)) {
        return makeReading(100 - leftPercent, source, leftMatch[0]);
      }
    }

    return null;
  }

  function parseRatioText(text, source) {
    if (!text || !ratioWords.test(text)) return null;

    const patterns = [
      /(?:context|token|tokens|usage|window|budget|上下文|令牌|使用|窗口)[^\n]{0,100}?([\d,.]+)\s*([kKmM]?)\s*(?:\/|of)\s*([\d,.]+)\s*([kKmM]?)/i,
      /([\d,.]+)\s*([kKmM]?)\s*(?:\/|of)\s*([\d,.]+)\s*([kKmM]?)[^\n]{0,100}?(?:context|token|tokens|usage|window|budget|上下文|令牌|使用|窗口)/i,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(text);
      if (!match) continue;

      const used = toNumber(match[1], match[2]);
      const limit = toNumber(match[3], match[4]);
      if (!used || !limit || used < 0 || limit <= 0 || used > limit * 1.25) {
        continue;
      }

      return makeReading((used / limit) * 100, source, match[0], used, limit);
    }

    return null;
  }

  function parseStructuredText(text, source) {
    if (!text || !contextTerms.test(text)) return null;

    const percentFields = [
      /["']?(?:context|token|usage|window)[A-Za-z0-9_$-]{0,36}(?:percent|percentage)["']?\s*[:=]\s*(\d{1,3}(?:\.\d+)?)/i,
      /["']?(?:percent|percentage)[A-Za-z0-9_$-]{0,36}(?:context|token|usage|window)["']?\s*[:=]\s*(\d{1,3}(?:\.\d+)?)/i,
      /["']?(?:context|token|usage|window)[A-Za-z0-9_$-]{0,36}(?:ratio)["']?\s*[:=]\s*(0?\.\d+|1(?:\.0+)?)/i,
    ];

    for (const pattern of percentFields) {
      const match = pattern.exec(text);
      if (!match) continue;

      let percent = Number(match[1]);
      if (pattern.source.includes("ratio")) percent *= 100;
      if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
        return makeReading(percent, source, match[0]);
      }
    }

    const usedMatch =
      /["']?(?:context|token|tokens)[A-Za-z0-9_$-]{0,36}(?:used|current|total|input)["']?\s*[:=]\s*(\d+(?:\.\d+)?)/i.exec(
        text,
      );
    const limitMatch =
      /["']?(?:context|token|tokens)[A-Za-z0-9_$-]{0,36}(?:limit|max|window|capacity|budget)["']?\s*[:=]\s*(\d+(?:\.\d+)?)/i.exec(
        text,
      );

    if (usedMatch && limitMatch) {
      const used = Number(usedMatch[1]);
      const limit = Number(limitMatch[1]);
      if (Number.isFinite(used) && Number.isFinite(limit) && limit > 0) {
        return makeReading((used / limit) * 100, source, `${usedMatch[0]} ${limitMatch[0]}`, used, limit);
      }
    }

    return null;
  }

  function lowerCompact(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "");
  }

  function collectNumericFields(value, path, depth, seen, fields) {
    if (fields.length > 400 || depth < 0 || value == null) return;

    const valueType = typeof value;
    if (valueType === "number" && Number.isFinite(value)) {
      const key = lowerCompact(path);
      const relevant = /(context|token|usage|window|budget|上下文|令牌|使用|窗口)/i.test(path);
      fields.push({ path, key, value, relevant });
      return;
    }

    if (valueType === "string") {
      const number = Number(value.replace(/,/g, ""));
      if (Number.isFinite(number)) {
        const key = lowerCompact(path);
        const relevant = /(context|token|usage|window|budget|上下文|令牌|使用|窗口)/i.test(path);
        fields.push({ path, key, value: number, relevant });
      }
      return;
    }

    if (valueType !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    let keys = [];
    try {
      keys = Object.keys(value).slice(0, 120);
    } catch {
      return;
    }

    for (const key of keys) {
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }

      collectNumericFields(child, path ? `${path}.${key}` : key, depth - 1, seen, fields);
    }
  }

  function findField(fields, pattern) {
    return fields.find((field) => field.relevant && pattern.test(field.key));
  }

  // 面向未知 payload 的最后一层结构化解析：只根据字段路径语义配对数值，避免绑定单一接口形状。
  function parseStructuredValue(value, source) {
    const fields = [];
    collectNumericFields(value, "", 8, new WeakSet(), fields);

    const percentField = findField(fields, /(percent|percentage|pct|百分比)/);
    if (percentField && percentField.value >= 0 && percentField.value <= 100) {
      return makeReading(percentField.value, source, percentField.path);
    }

    const ratioField = findField(fields, /(ratio|fraction|比例)/);
    if (ratioField && ratioField.value >= 0 && ratioField.value <= 1) {
      return makeReading(ratioField.value * 100, source, ratioField.path);
    }

    const usedField = findField(fields, /(used|current|consumed|filled|total|input|prompt|已用|当前|消耗)/);
    const limitField = findField(fields, /(limit|max|maximum|capacity|window|budget|contextwindow|上限|最大|容量|预算|窗口)/);
    if (usedField && limitField && limitField.value > 0 && usedField.value >= 0 && usedField.value <= limitField.value * 1.25) {
      return makeReading(
        (usedField.value / limitField.value) * 100,
        source,
        `${usedField.path} / ${limitField.path}`,
        usedField.value,
        limitField.value,
      );
    }

    const remainingField = findField(fields, /(remaining|remain|left|available|free|剩余|可用)/);
    if (remainingField && limitField && limitField.value > 0 && remainingField.value >= 0 && remainingField.value <= limitField.value) {
      const used = limitField.value - remainingField.value;
      return makeReading(
        (used / limitField.value) * 100,
        source,
        `${remainingField.path} / ${limitField.path}`,
        used,
        limitField.value,
      );
    }

    if (usedField && remainingField && usedField.value >= 0 && remainingField.value >= 0) {
      const limit = usedField.value + remainingField.value;
      if (limit > 0) {
        return makeReading(
          (usedField.value / limit) * 100,
          source,
          `${usedField.path} / ${remainingField.path}`,
          usedField.value,
          limit,
        );
      }
    }

    return null;
  }

  function parseStatusContextUsageObject(value, source, conversationId) {
    if (!value || typeof value !== "object") return null;

    const modelContextWindow = firstFiniteNumber(value.modelContextWindow, value.model_context_window);
    const lastUsage = value.last || value.lastTokenUsage || value.last_token_usage;
    const totalTokens = firstFiniteNumber(
      lastUsage && lastUsage.totalTokens,
      lastUsage && lastUsage.total_tokens,
    );
    if (Number.isFinite(modelContextWindow) && modelContextWindow > 0 && Number.isFinite(totalTokens) && totalTokens >= 0) {
      const usedTokens = Math.min(totalTokens, modelContextWindow);
      return withConversationId(makeReading(
        (usedTokens / modelContextWindow) * 100,
        source,
        "status tokenUsage",
        usedTokens,
        modelContextWindow,
      ), conversationId);
    }

    const percent = Number(value.percent);
    const usedTokens = firstFiniteNumber(value.usedTokens, value.used_tokens);
    const contextWindow = firstFiniteNumber(value.contextWindow, value.context_window);

    if (Number.isFinite(usedTokens) && Number.isFinite(contextWindow) && contextWindow > 0) {
      return withConversationId(makeReading(
        (usedTokens / contextWindow) * 100,
        source,
        "status contextUsage",
        usedTokens,
        contextWindow,
      ), conversationId);
    }

    if (Number.isFinite(percent) && percent >= 0 && percent <= 100) {
      return withConversationId(makeReading(percent, source, "status contextUsage.percent"), conversationId);
    }

    return null;
  }

  function firstFiniteNumber(...values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }

    return null;
  }

  function parseTokenCountInfoObject(value, source, conversationId) {
    if (!value || typeof value !== "object") return null;

    const modelContextWindow = firstFiniteNumber(value.model_context_window, value.modelContextWindow);
    const lastUsage = value.last_token_usage || value.lastTokenUsage || value.last;
    const totalTokens = firstFiniteNumber(
      lastUsage && lastUsage.total_tokens,
      lastUsage && lastUsage.totalTokens,
    );

    if (!Number.isFinite(modelContextWindow) || modelContextWindow <= 0) return null;
    if (!Number.isFinite(totalTokens) || totalTokens < 0) return null;

    const usedTokens = Math.min(totalTokens, modelContextWindow);
    return withConversationId(makeReading(
      (usedTokens / modelContextWindow) * 100,
      source,
      "token_count info",
      usedTokens,
      modelContextWindow,
    ), conversationId);
  }

  // fetch / websocket / postMessage 捕获到的对象形状不一致，这里统一收敛到 reading 并过滤非当前会话。
  function inspectCandidateValue(value, source, ownerConversationId) {
    if (!value || typeof value !== "object") return null;

    const activeConversationId = state.activeConversationId || readActiveConversationId();
    const valueConversationId = getObjectConversationId(value) || normalizeConversationId(ownerConversationId);

    if (activeConversationId && valueConversationId && !conversationIdsMatch(activeConversationId, valueConversationId)) {
      return null;
    }

    const directReading = parseStatusContextUsageObject(value, source, valueConversationId);
    if (directReading) return directReading;

    if (
      value.method === "thread/tokenUsage/updated" ||
      value.type === "thread/tokenUsage/updated" ||
      value.event === "thread/tokenUsage/updated"
    ) {
      const eventConversationId = getObjectConversationId(value.params || value) || valueConversationId;
      if (activeConversationId && eventConversationId && !conversationIdsMatch(activeConversationId, eventConversationId)) {
        return null;
      }

      const paramsReading =
        parseStatusContextUsageObject(value.params && value.params.tokenUsage, source, eventConversationId) ||
        parseStatusContextUsageObject(value.params, source, eventConversationId);
      if (paramsReading) return paramsReading;
    }

    if (value.type === "token_count" || value.event === "token_count") {
      const tokenCountReading = parseTokenCountInfoObject(value.info, source, valueConversationId || activeConversationId);
      if (tokenCountReading) return tokenCountReading;
    }

    if (value.payload && value.payload.type === "token_count") {
      const payloadConversationId = getObjectConversationId(value.payload) || valueConversationId || activeConversationId;
      const tokenCountReading = parseTokenCountInfoObject(value.payload.info, source, payloadConversationId);
      if (tokenCountReading) return tokenCountReading;
    }

    const nestedReading = parseStatusContextUsageObject(
      value.contextUsage || value.tokenUsage || value.usage,
      source,
      valueConversationId,
    );
    if (nestedReading) return nestedReading;

    const tokenCountInfoReading = parseTokenCountInfoObject(value.info, source, valueConversationId || activeConversationId);
    if (tokenCountInfoReading) return tokenCountInfoReading;

    return null;
  }

  // 反向遍历 React / window 状态树时，Map key 或父对象常常比叶子值更像会话归属来源。
  function findStatusContextUsageObject(value, depth, seen, activeConversationId, ownerConversationId) {
    if (!value || typeof value !== "object" || depth < 0) return null;
    if (seen.has(value)) return null;
    seen.add(value);

    const valueConversationId = getObjectConversationId(value);
    const nextOwnerConversationId = valueConversationId || ownerConversationId;
    const ownerMatchesActive =
      !activeConversationId ||
      conversationIdsMatch(activeConversationId, nextOwnerConversationId) ||
      conversationIdsMatch(activeConversationId, ownerConversationId);

    if (ownerMatchesActive) {
      const direct = parseStatusContextUsageObject(value, "status-react", nextOwnerConversationId);
      if (direct) return direct;
    }

    if (Array.isArray(value)) {
      const limit = Math.min(value.length, 120);
      for (let index = 0; index < limit; index += 1) {
        const reading = findStatusContextUsageObject(
          value[index],
          depth - 1,
          seen,
          activeConversationId,
          nextOwnerConversationId,
        );
        if (reading) return reading;
      }
      return null;
    }

    if (value instanceof Map) {
      let index = 0;
      for (const [mapKey, mapValue] of value) {
        if (index >= 120) break;

        const mapKeyConversationId = normalizeConversationId(mapKey);
        const childOwnerConversationId = mapKeyConversationId || nextOwnerConversationId;

        const keyReading = findStatusContextUsageObject(
          mapKey,
          depth - 1,
          seen,
          activeConversationId,
          childOwnerConversationId,
        );
        if (keyReading) return keyReading;

        const valueReading = findStatusContextUsageObject(
          mapValue,
          depth - 1,
          seen,
          activeConversationId,
          childOwnerConversationId,
        );
        if (valueReading) return valueReading;

        index += 1;
      }
      return null;
    }

    if (value instanceof Set) {
      let index = 0;
      for (const setValue of value) {
        if (index >= 120) break;

        const reading = findStatusContextUsageObject(
          setValue,
          depth - 1,
          seen,
          activeConversationId,
          nextOwnerConversationId,
        );
        if (reading) return reading;

        index += 1;
      }
      return null;
    }

    const keys = getFilteredReflectKeys(value, "statusTree", STATUS_TREE_KEY_RE, 120);
    const keySet = new Set(keys);

    for (const key of PREFERRED_STATUS_KEYS) {
      if (!keySet.has(key)) continue;

      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }

      const reading = findStatusContextUsageObject(
        child,
        depth - 1,
        seen,
        activeConversationId,
        nextOwnerConversationId,
      );
      if (reading) return reading;
    }

    for (const key of keys) {
      if (PREFERRED_STATUS_KEY_SET.has(key)) continue;

      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }

      const keyConversationId = normalizeConversationId(key);
      const childOwnerConversationId = keyConversationId || nextOwnerConversationId;
      const reading = findStatusContextUsageObject(
        child,
        depth - 1,
        seen,
        activeConversationId,
        childOwnerConversationId,
      );
      if (reading) return reading;
    }

    return null;
  }

  // React 私有字段是从界面节点回溯运行态状态的桥；升级后若读不到值，优先检查 __react* 键。
  function scanStatusReactContextUsage(activeConversationId) {
    const nodes = [
      document.getElementById("root"),
      document.querySelector(`[aria-current="page"]`),
      document.querySelector(`[data-app-action-sidebar-thread-active="true"]`),
      document.body,
      document.documentElement,
    ].filter(Boolean);
    const limit = nodes.length;

    for (let index = 0; index < limit; index += 1) {
      const node = nodes[index];
      const keys = getReactPrivateKeys(node);

      for (const key of keys) {
        let value;
        try {
          value = node[key];
        } catch {
          continue;
        }

        const reading = findStatusContextUsageObject(value, 10, new WeakSet(), activeConversationId, null);
        if (reading) return reading;
      }
    }

    return null;
  }

  function isAppSignalScope(value) {
    return !!(
      value &&
      typeof value === "object" &&
      typeof value.get === "function" &&
      typeof value.watch === "function" &&
      value.node &&
      value.chain
    );
  }

  // app signal scope 没有稳定全局入口，只能从 React fiber 链里按结构特征反查。
  function findAppSignalScopeInValue(value, depth, seen) {
    if (!value || typeof value !== "object" || depth < 0) return null;
    if (seen.has(value)) return null;
    if (state.appSignalSkipGeneration.get(value) === state.scanGeneration) return null;
    seen.add(value);

    if (isAppSignalScope(value)) return value;

    if (Array.isArray(value)) {
      const limit = Math.min(value.length, 40);
      for (let index = 0; index < limit; index += 1) {
        const scope = findAppSignalScopeInValue(value[index], depth - 1, seen);
        if (scope) return scope;
      }
      return null;
    }

    if (value instanceof Map) {
      let index = 0;
      for (const [mapKey, mapValue] of value) {
        if (index >= 30) break;

        const keyScope = findAppSignalScopeInValue(mapKey, depth - 1, seen);
        if (keyScope) return keyScope;

        const valueScope = findAppSignalScopeInValue(mapValue, depth - 1, seen);
        if (valueScope) return valueScope;

        index += 1;
      }
    }

    const keys = getFilteredReflectKeys(value, "appSignalScope", APP_SIGNAL_SCOPE_KEY_RE, 120);

    for (const key of keys) {
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }

      const scope = findAppSignalScopeInValue(child, depth - 1, seen);
      if (scope) return scope;
    }

    state.appSignalSkipGeneration.set(value, state.scanGeneration);
    return null;
  }

  function findAppSignalScope() {
    if (isAppSignalScope(state.appSignalScope)) return state.appSignalScope;

    const now = Date.now();
    if (now - state.appSignalLastLookupAt < 2000) return null;
    state.appSignalLastLookupAt = now;

    // app signal scope 挂在 React 树里；只扫稳定锚点，避免初始化时遍历整页 DOM。
    const root = document.getElementById("root");
    const current = document.querySelector(`[aria-current="page"]`);
    const activeThread = document.querySelector(`[data-app-action-sidebar-thread-active="true"]`);
    const nodes = [
      root,
      current,
      activeThread,
      current && current.closest("[data-app-action-sidebar-thread-id]"),
      activeThread && activeThread.closest("[data-app-action-sidebar-thread-id]"),
      document.body,
      document.documentElement,
      ...(root
        ? Array.from(root.querySelectorAll(REACT_STATE_HOST_SELECTOR)).slice(0, REACT_HOST_SCAN_LIMIT)
        : []),
    ].filter(Boolean);

    const seen = new WeakSet();
    for (const node of nodes) {
      const keys = getReactPrivateKeys(node);
      for (const key of keys) {
        let value;
        try {
          value = node[key];
        } catch {
          continue;
        }

        const scope = findAppSignalScopeInValue(value, 18, seen);
        if (scope) {
          state.appSignalScope = scope;
          return scope;
        }
      }
    }

    return null;
  }

  // hashed asset 文件名会随版本变化；先从已加载资源定位，fallback 只保留当前版本的相对路径。
  function findLoadedAssetUrl(fragment, fallbackPath) {
    const selectors = [
      `script[src*="${fragment}"]`,
      `link[href*="${fragment}"]`,
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element && (element.src || element.href);
      if (value) return value;
    }

    const resources =
      typeof performance !== "undefined" && typeof performance.getEntriesByType === "function"
        ? performance.getEntriesByType("resource")
        : [];
    for (const resource of resources) {
      if (resource && typeof resource.name === "string" && resource.name.includes(fragment)) {
        return resource.name;
      }
    }

    return new URL(fallbackPath, location.href).href;
  }

  // 优先读取 Status 使用的 app signal；bundle hash 或导出名变化时，先更新这两个资产入口。
  function ensureAppSignalModules() {
    if (state.appSignalModules) return state.appSignalModules;
    if (state.appSignalModulesPromise) return null;
    state.appSignalModulesRequestedAt = Date.now();

    const appServerUrl = findLoadedAssetUrl(
      "app-server-manager-signals",
      "./assets/app-server-manager-signals-WXrD8bmC.js",
    );
    const signalUrl = findLoadedAssetUrl(
      "setting-storage",
      "./assets/setting-storage-DBp4-kRn.js",
    );

    state.appSignalModulesPromise = Promise.all([
      import(appServerUrl),
      import(signalUrl),
    ])
      .then(([appServerSignals, signalStorage]) => {
        state.appSignalModules = { appServerSignals, signalStorage };
        scheduleUpdate();
        return state.appSignalModules;
      })
      .catch(() => {
        state.appSignalModulesPromise = null;
        return null;
      });

    return null;
  }

  // setting-storage 的 rt helper 会解开嵌套 signal；缺失时退回 scope.get 的两段读取。
  function readSignalValue(scope, selector, argument) {
    if (!scope || !selector) return null;

    const modules = state.appSignalModules;
    const readHelper = modules && modules.signalStorage && modules.signalStorage.rt;
    if (typeof readHelper === "function") {
      try {
        return readHelper(scope, selector, argument);
      } catch {
        return null;
      }
    }

    try {
      const nestedSignal = scope.get(selector, argument);
      if (nestedSignal && typeof nestedSignal === "object") {
        return scope.get(nestedSignal);
      }
    } catch {
      return null;
    }

    return null;
  }

  function scanAppSignalContextUsage(activeConversationId) {
    const now = Date.now();
    const requestedConversationId = normalizeConversationId(activeConversationId);
    if (
      state.appSignalCachedReading &&
      requestedConversationId &&
      conversationIdsMatch(requestedConversationId, state.appSignalCachedConversationId) &&
      now - state.appSignalCachedAt < APP_SIGNAL_READING_CACHE_MS
    ) {
      return state.appSignalCachedReading;
    }

    const modules = ensureAppSignalModules();
    if (!modules || !modules.appServerSignals) {
      state.waitingForAppSignalModules = !!state.appSignalModulesPromise;
      return null;
    }
    state.waitingForAppSignalModules = false;

    const scope = findAppSignalScope();
    if (!scope) return null;

    const conversationId =
      normalizeConversationId(activeConversationId) ||
      normalizeConversationId(scope.value && scope.value.conversationId);
    if (!conversationId) return null;

    // 当前版本里 appServerSignals.B 对应 latestTokenUsageInfo；上游重排导出时需要重新定位。
    const latestTokenUsageSelector = modules.appServerSignals.B;
    const tokenUsage = readSignalValue(scope, latestTokenUsageSelector, conversationId);
    const reading = parseStatusContextUsageObject(tokenUsage, "app-signal", conversationId);
    if (reading) {
      state.appSignalCachedReading = reading;
      state.appSignalCachedConversationId = conversationId;
      state.appSignalCachedAt = now;
      return reading;
    }

    return null;
  }

  function shouldWaitForAppSignalModules(now) {
    return !!(
      state.appSignalModulesPromise &&
      !state.appSignalModules &&
      now - state.appSignalModulesRequestedAt < APP_SIGNAL_IMPORT_GRACE_MS
    );
  }

  // 流式响应可能是 JSONL，也可能是一整段 JSON；两种都按同一套 reading 规则落库。
  function parsePayloadText(text, source, ownerConversationId) {
    const clipped = String(text || "").slice(0, MAX_CAPTURE_TEXT_LENGTH);
    const textReading = parseTextForReading(clipped, source);
    if (textReading) return withConversationId(textReading, ownerConversationId);

    if (!contextTerms.test(clipped)) return null;

    const lines = clipped.split(/\r?\n/);
    if (lines.length > 1) {
      for (const line of lines) {
        if (!line || !contextTerms.test(line)) continue;

        try {
          const parsedLine = JSON.parse(line);
          const reading =
            inspectCandidateValue(parsedLine, source, ownerConversationId) ||
            parseStructuredValue(parsedLine, source);
          if (reading) return withConversationId(reading, reading.conversationId || ownerConversationId);
        } catch {
          const lineReading = parseTextForReading(line, source);
          if (lineReading) return withConversationId(lineReading, ownerConversationId);
        }
      }
    }

    try {
      const parsed = JSON.parse(clipped);
      const reading = inspectCandidateValue(parsed, source, ownerConversationId) || parseStructuredValue(parsed, source);
      return withConversationId(reading, reading && reading.conversationId ? reading.conversationId : ownerConversationId);
    } catch {
      return null;
    }
  }

  // 捕获层会先缓存非当前会话读数，只有会话匹配时才推动当前 UI 刷新。
  function acceptReading(reading) {
    if (!reading) return;

    const activeConversationId = state.activeConversationId || readActiveConversationId();
    if (reading.conversationId) {
      state.readingsByConversationId.set(reading.conversationId, reading);
    }

    if (activeConversationId && reading.conversationId && !conversationIdsMatch(activeConversationId, reading.conversationId)) {
      return;
    }

    state.lastReading = reading;
    scheduleUpdate(CAPTURE_UPDATE_DELAY_MS);
  }

  function inspectCandidateText(text, source, ownerConversationId) {
    if (!text || text.length > MAX_CAPTURE_TEXT_LENGTH) return;
    if (!CAPTURE_TEXT_HINT_RE.test(text)) return;

    acceptReading(parsePayloadText(text, source, ownerConversationId));
  }

  function hasCaptureHintText(text) {
    if (typeof text !== "string" || text.length > MAX_CAPTURE_TEXT_LENGTH) return false;
    return CAPTURE_TEXT_HINT_RE.test(text);
  }

  function getRequestConversationId(input) {
    const direct = normalizeConversationId(input && (input.url || input.href || input));
    if (direct) return direct;

    return state.activeConversationId || readActiveConversationId();
  }

  function getNativeFetch(captureState) {
    return captureState.nativeFetch || window.fetch;
  }

  function getNativeWebSocket(captureState) {
    return captureState.NativeWebSocket || window.WebSocket;
  }

  // fetch 捕获只 clone 小体积文本响应，不消费原 response，避免影响 Codex 自己的请求链。
  function installFetchCapture() {
    const captureState = getCaptureState();
    if (captureState.fetchVersion === SCRIPT_VERSION || typeof window.fetch !== "function") return;

    const originalFetch = getNativeFetch(captureState);
    captureState.nativeFetch = originalFetch;
    window.fetch = function cdsBillingFetch(...args) {
      const requestConversationId = getRequestConversationId(args[0]);
      return originalFetch.apply(this, args).then((response) => {
        try {
          const urlText = String(args[0] && (args[0].url || args[0].href || args[0]) || response.url || "");
          if (urlText && !CAPTURE_TEXT_HINT_RE.test(urlText)) return response;

          const contentType = response.headers && response.headers.get("content-type");
          const contentLength = response.headers && Number(response.headers.get("content-length"));
          const isTextLike = !contentType || /json|text|event-stream|x-ndjson/i.test(contentType);
          if (isTextLike && (!Number.isFinite(contentLength) || contentLength <= MAX_CAPTURE_TEXT_LENGTH)) {
            response
              .clone()
              .text()
              .then((text) => {
                const currentCaptureState = window[CAPTURE_STATE_KEY];
                if (currentCaptureState && typeof currentCaptureState.inspectText === "function") {
                  currentCaptureState.inspectText(text, "fetch", requestConversationId);
                }
              })
              .catch(() => {});
          }
        } catch {
          return response;
        }

        return response;
      });
    };

    captureState.fetchVersion = SCRIPT_VERSION;
    window.__codexDeepseekBillingFetchPatched = true;
  }

  // WebSocket 构造器需要保留原型和 readyState 常量，减少对页面侧类型判断的影响。
  function installWebSocketCapture() {
    const captureState = getCaptureState();
    if (captureState.webSocketVersion === SCRIPT_VERSION || typeof window.WebSocket !== "function") return;

    const NativeWebSocket = getNativeWebSocket(captureState);
    captureState.NativeWebSocket = NativeWebSocket;

    function MeterWebSocket(...args) {
      const socket = new NativeWebSocket(...args);
      socket.addEventListener("message", (event) => {
        try {
          if (typeof event.data === "string") {
            if (!hasCaptureHintText(event.data)) return;

            const currentCaptureState = window[CAPTURE_STATE_KEY];
            if (currentCaptureState && typeof currentCaptureState.inspectText === "function") {
              currentCaptureState.inspectText(event.data, "websocket", state.activeConversationId || readActiveConversationId());
            }
          } else if (event.data instanceof Blob && event.data.size <= MAX_CAPTURE_TEXT_LENGTH) {
            event.data
              .text()
              .then((text) => {
                const currentCaptureState = window[CAPTURE_STATE_KEY];
                if (currentCaptureState && typeof currentCaptureState.inspectText === "function") {
                  currentCaptureState.inspectText(text, "websocket", state.activeConversationId || readActiveConversationId());
                }
              })
              .catch(() => {});
          }
        } catch {
          return;
        }
      });
      return socket;
    }

    MeterWebSocket.prototype = NativeWebSocket.prototype;
    MeterWebSocket.CONNECTING = NativeWebSocket.CONNECTING;
    MeterWebSocket.OPEN = NativeWebSocket.OPEN;
    MeterWebSocket.CLOSING = NativeWebSocket.CLOSING;
    MeterWebSocket.CLOSED = NativeWebSocket.CLOSED;
    window.WebSocket = MeterWebSocket;
    captureState.webSocketVersion = SCRIPT_VERSION;
    window.__codexDeepseekBillingWebSocketPatched = true;
  }

  // postMessage 监听器每次重装前先移除旧实例，支持 Codex++ 反复重新加载用户脚本。
  function installPostMessageCapture() {
    const captureState = getCaptureState();
    if (captureState.messageListener) {
      window.removeEventListener("message", captureState.messageListener, true);
    }

    captureState.messageListener = (event) => {
      try {
        const currentCaptureState = window[CAPTURE_STATE_KEY];
        if (!currentCaptureState) return;

        const reading =
          (typeof currentCaptureState.inspectValue === "function"
            ? currentCaptureState.inspectValue(event.data, "message", state.activeConversationId || readActiveConversationId())
            : null) ||
          (hasCaptureHintText(event.data) && typeof currentCaptureState.parsePayloadText === "function"
            ? currentCaptureState.parsePayloadText(event.data, "message", state.activeConversationId || readActiveConversationId())
            : null);

        if (typeof currentCaptureState.acceptReading === "function") {
          currentCaptureState.acceptReading(reading);
        }
      } catch {
        return;
      }
    };

    window.addEventListener("message", captureState.messageListener, true);
    captureState.messageVersion = SCRIPT_VERSION;
    window.__codexDeepseekBillingPostMessagePatched = true;
  }

  function parseTextForReading(text, source) {
    const clipped = String(text || "").slice(0, MAX_TEXT_LENGTH);
    return (
      parseStatusContextText(clipped, source) ||
      parsePercentText(clipped, source) ||
      parseRatioText(clipped, source) ||
      parseStructuredText(clipped, source)
    );
  }

  function isVisibleElement(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return false;

    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || "1") > 0;
  }

  function isConversationContent(element) {
    return !!(element && element.closest(CONVERSATION_CONTENT_SELECTOR));
  }

  function shouldIgnoreMutationTarget(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return false;
    if (element.closest(`#${ROOT_ID}`)) return true;
    return !!element.closest(MESSAGE_MUTATION_SELECTOR);
  }

  // 兜底读取已渲染的 /status 输出；排除会话正文，避免把用户消息里的 Context 行当成状态。
  function collectStatusCommandText() {
    const chunks = [];
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    let visited = 0;
    let node = walker.nextNode();

    while (node && visited < STATUS_TEXT_NODE_SCAN_LIMIT) {
      visited += 1;
      if (chunks.length >= 12) break;
      const current = node;
      node = walker.nextNode();

      const text = (current.textContent || "").replace(/\s+/g, " ").trim();
      if (text.length < 20 || text.length > 1800) continue;
      if (!/\bStatus\b/i.test(text) || !/\bContext\s*:\s*\d{1,3}(?:\.\d+)?\s*%/i.test(text)) continue;
      if (!/\bSession\s*:|\b5h limit\s*:|\b7d limit\s*:/i.test(text)) continue;
      if (current.id === ROOT_ID || current.closest(`#${ROOT_ID}`)) continue;
      if (isConversationContent(current)) continue;
      if (!isVisibleElement(current)) continue;

      chunks.push(text);
    }

    return chunks.join("\n");
  }

  function collectDomText() {
    const parts = [];
    let scanned = 0;

    const attrNodes = document.querySelectorAll("[aria-label], [title], [data-testid], [data-test-id]");
    for (const node of attrNodes) {
      if (scanned >= DOM_ATTRIBUTE_SCAN_LIMIT || parts.length >= DOM_TEXT_PART_LIMIT) break;
      scanned += 1;
      if (node.closest(`#${ROOT_ID}`)) continue;

      for (const attr of ["aria-label", "title", "data-testid", "data-test-id"]) {
        const value = node.getAttribute(attr);
        if (value && contextTerms.test(value)) parts.push(value);
      }

      const text = (node.textContent || "").trim();
      if (text && text.length <= 500 && contextTerms.test(text)) {
        parts.push(text);
      }
    }

    return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
  }

  function safeStorageText(storage) {
    const parts = [];
    for (let index = 0; index < storage.length && parts.length < 80; index += 1) {
      const key = storage.key(index);
      if (!key || !contextTerms.test(key)) continue;

      let value = "";
      try {
        value = storage.getItem(key) || "";
      } catch {
        value = "";
      }
      parts.push(`${key}: ${value.slice(0, 4000)}`);
    }
    return parts.join("\n");
  }

  function collectValueText(value, depth, seen, parts) {
    if (parts.length > 160 || depth < 0 || value == null) return;

    const valueType = typeof value;
    if (valueType === "string" || valueType === "number" || valueType === "boolean") {
      const text = String(value);
      if (contextTerms.test(text)) parts.push(text);
      return;
    }

    if (valueType !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      const limit = Math.min(value.length, 80);
      for (let index = 0; index < limit; index += 1) {
        collectValueText(value[index], depth - 1, seen, parts);
      }
      return;
    }

    if (value instanceof Map) {
      let index = 0;
      for (const [mapKey, mapValue] of value) {
        if (index >= 80) break;
        collectValueText(mapKey, depth - 1, seen, parts);
        collectValueText(mapValue, depth - 1, seen, parts);
        index += 1;
      }
      return;
    }

    if (value instanceof Set) {
      let index = 0;
      for (const setValue of value) {
        if (index >= 80) break;
        collectValueText(setValue, depth - 1, seen, parts);
        index += 1;
      }
      return;
    }

    const keys = getContextValueKeys(value);

    for (const key of keys) {
      let child;
      try {
        child = value[key];
      } catch {
        continue;
      }

      if (child == null || typeof child !== "object") {
        parts.push(`${key}: ${String(child)}`);
      } else {
        parts.push(key);
      }

      if (typeof child === "object") {
        collectValueText(child, depth - 1, seen, parts);
      }
    }
  }

  // window 全局对象很大，先缓存候选 key；只有主路径失败时才读取这些值。
  function scanLikelyWindowState() {
    const parts = [];
    const seen = new WeakSet();
    const now = Date.now();
    if (!state.windowContextTextKeys || now - state.windowContextTextKeysAt > WINDOW_KEY_CACHE_MS) {
      state.windowContextTextKeys = Object.keys(window).filter((key) => contextTerms.test(key));
      state.windowContextTextKeysAt = now;
    }

    for (const key of state.windowContextTextKeys) {
      let value;
      try {
        value = window[key];
      } catch {
        continue;
      }

      parts.push(key);
      collectValueText(value, 3, seen, parts);
    }

    return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
  }

  // React 兜底只检查可能承载线程/消息状态的宿主节点，避免遍历全部 body 元素。
  function scanReactProps() {
    const parts = [];
    const seen = new WeakSet();
    const root = document.getElementById("root");
    const nodes = root ? root.querySelectorAll(REACT_STATE_HOST_SELECTOR) : [];
    const limit = Math.min(nodes.length, REACT_HOST_SCAN_LIMIT);

    for (let index = 0; index < limit && parts.length < 160; index += 1) {
      const node = nodes[index];
      const keys = getReactPrivateKeys(node);
      for (const key of keys) {
        let value;
        try {
          value = node[key];
        } catch {
          continue;
        }
        collectValueText(value, 4, seen, parts);
      }
    }

    return parts.join("\n").slice(0, MAX_TEXT_LENGTH);
  }

  // 这里直接找结构化 usage 对象，比把 window 状态拼成文本再正则解析更便宜。
  function scanWindowForContextUsage(activeConversationId) {
    const seen = new WeakSet();
    const now = Date.now();
    if (!state.windowUsageKeys || now - state.windowUsageKeysAt > WINDOW_KEY_CACHE_MS) {
      state.windowUsageKeys = Object.keys(window).filter((key) =>
        /codex|thread|token|usage|context|store|query|cache|notification|message/i.test(key),
      );
      state.windowUsageKeysAt = now;
    }

    for (const key of state.windowUsageKeys) {
      let value;
      try {
        value = window[key];
      } catch {
        continue;
      }

      const reading = findStatusContextUsageObject(value, 6, seen, activeConversationId, null);
      if (reading) return reading;
    }

    return null;
  }

  // 读取顺序按稳定性排列：app signal > React 状态 > window 缓存 > /status 文本 > storage/DOM 兜底。
  function detectReading() {
    state.scanGeneration += 1;
    const activeConversationId = updateActiveConversationId();
    const cachedReading = activeConversationId ? state.readingsByConversationId.get(activeConversationId) : null;
    if (cachedReading) return cachedReading;

    if (!activeConversationId) {
      const appSignalReading = scanAppSignalContextUsage(null);
      if (appSignalReading && appSignalReading.conversationId) {
        retainConversationId(appSignalReading.conversationId);
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return appSignalReading;
      }

      return null;
    }

    if (state.lastReading && state.lastReading.conversationId && conversationIdsMatch(activeConversationId, state.lastReading.conversationId)) {
      return state.lastReading;
    }

    const now = Date.now();
    const activeChangedSinceScan = activeConversationId !== state.lastScannedConversationId;
    const inSwitchRetryWindow = !!activeConversationId && now < state.switchRetryUntil;
    if (!activeChangedSinceScan && !inSwitchRetryWindow && now - state.lastScanAt < SLOW_SCAN_INTERVAL_MS) {
      return null;
    }
    // 会话切换初期允许快速兜底；同一会话内的昂贵扫描按窗口限频。
    const canRunExpensiveFallback =
      activeChangedSinceScan ||
      !conversationIdsMatch(activeConversationId, state.expensiveFallbackConversationId) ||
      now - state.expensiveFallbackScannedAt >= EXPENSIVE_FALLBACK_INTERVAL_MS;

    state.lastScannedConversationId = activeConversationId;
    state.lastScanAt = now;

    const appSignalReading = scanAppSignalContextUsage(activeConversationId);
    if (appSignalReading) {
      if (!activeConversationId && appSignalReading.conversationId) {
        retainConversationId(appSignalReading.conversationId);
      }
      state.switchRetryUntil = 0;
      clearRetryUpdate();
      return appSignalReading;
    }

    if (shouldWaitForAppSignalModules(now)) {
      scheduleUpdate(APP_SIGNAL_IMPORT_GRACE_MS);
      return state.lastReading;
    }

    const statusReactReading = scanStatusReactContextUsage(activeConversationId);
    if (statusReactReading) {
      state.switchRetryUntil = 0;
      clearRetryUpdate();
      return statusReactReading;
    }

    if (canRunExpensiveFallback) {
      state.expensiveFallbackScannedAt = now;
      state.expensiveFallbackConversationId = activeConversationId;

      // 以下 fallback 从“结构化且便宜”逐步降级到“文本化且昂贵”，顺序不要随意调换。
      const windowReading = scanWindowForContextUsage(activeConversationId);
      if (windowReading) {
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return windowReading;
      }

      const statusReading = parseTextForReading(collectStatusCommandText(), "status");
      if (statusReading) {
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return statusReading;
      }

      const localReading = parseTextForReading(safeStorageText(localStorage), "localStorage");
      if (localReading) {
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return localReading;
      }

      const sessionReading = parseTextForReading(safeStorageText(sessionStorage), "sessionStorage");
      if (sessionReading) {
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return sessionReading;
      }

      const domReading = parseTextForReading(collectDomText(), "dom");
      if (domReading) {
        state.switchRetryUntil = 0;
        clearRetryUpdate();
        return domReading;
      }

      const slowWindowReading = parseTextForReading(scanLikelyWindowState(), "window");
      if (slowWindowReading) return slowWindowReading;

      const reactReading = parseTextForReading(scanReactProps(), "react");
      if (reactReading) return reactReading;
    }

    if (inSwitchRetryWindow) {
      scheduleRetryUpdate();
    } else {
      clearRetryUpdate();
    }

    if (
      !state.lastReading ||
      !state.lastReading.conversationId ||
      conversationIdsMatch(activeConversationId, state.lastReading.conversationId)
    ) {
      return state.lastReading;
    }

    return null;
  }

  function updateMeter() {
    installStyle();

    if (!document.body) return;

    const root = ensureRoot();
    state.uiConfig = readUiConfig();
    const contextCard = state.contextCard;
    const value = state.value || root.querySelector(".cds-value");
    const fill = state.fill || root.querySelector(".cds-fill");
    const compressionZone = root.querySelector(".cds-context-card .cds-compression-zone");
    const reading = detectReading();
    const activeConversationId = state.activeConversationId || readActiveConversationId();

    if (!contextCard || !value || !fill) return;

    if (!hasThreadContentSurface()) {
      state.lastReading = null;
      hideProviderMeter(root, "No thread content is open in the main view.");
      hideMeter(root, contextCard, value, fill, "No thread content is open in the main view.");
      return;
    }
    renderProviderMeter(root);

    if (!reading) {
      if (state.waitingForAppSignalModules) {
        scheduleUpdate(APP_SIGNAL_IMPORT_GRACE_MS);
        if (contextCard.dataset.known === "true" && value.textContent !== "Context Left --") return;
        hideMeter(root, contextCard, value, fill, "Waiting for Codex context usage signal.");
        return;
      }

      const title = activeConversationId
        ? `No context usage value is exposed for conversation ${activeConversationId} in the current page state yet.`
        : "No context usage value is exposed in the current page state yet.";
      hideMeter(root, contextCard, value, fill, title);
      return;
    }

    state.lastReading = reading;

    const leftPercent = clampPercent(100 - reading.percent);
    const showUsedInsteadOfLeft = shouldShowUsedInsteadOfLeft(state.uiConfig);
    const displayPercent = showUsedInsteadOfLeft ? clampPercent(reading.percent) : leftPercent;
    const percentText = displayPercent.toFixed(1);
    const details =
      reading.used != null && reading.limit != null
        ? ` ${compactNumber(reading.used)} / ${compactNumber(reading.limit)}`
        : "";
    const readingConversationId = normalizeConversationId(
      reading.conversationId || activeConversationId || "__unknown__"
    );

    if (readingConversationId && Number.isFinite(reading.used)) {
      const previousUsed = state.lastAnimatedUsedByConversationId.get(readingConversationId);
      if (Number.isFinite(previousUsed) && reading.used > previousUsed) {
        const deltaTokens = reading.used - previousUsed;
        if (shouldShowContextSpendEffect(readingConversationId, reading.used)) {
          recordSpend("context", deltaTokens, readingConversationId);
          showTokenSpendEffect(deltaTokens);
        }
      }
      state.lastAnimatedUsedByConversationId.set(readingConversationId, reading.used);
    }

    const level = levelForLeftPercent(leftPercent, "context");
    const compressionWarning = shouldShowCompressionWarning(leftPercent) ? "true" : "false";
    const remainingTokens = reading.used != null && reading.limit != null ? Math.max(0, reading.limit - reading.used) : null;
    const title = formatContextTitle(reading, reading.used, remainingTokens, leftPercent, reading.percent);
    const text = showUsedInsteadOfLeft
      ? `Context Used ${percentText}%${details}`
      : Number.isFinite(remainingTokens)
        ? `Context Left ${percentText}% (${compactNumber(remainingTokens)} left)`
        : `Context Left ${percentText}%${details}`;
    const width = `${displayPercent.toFixed(1)}%`;
    const compressionZoneWidth = `${state.uiConfig.context.compressionWarningLeftPercent.toFixed(1)}%`;

    if (contextCard.dataset.known !== "true") contextCard.dataset.known = "true";
    if (contextCard.hidden) contextCard.hidden = false;
    if (contextCard.dataset.level !== level) contextCard.dataset.level = level;
    const showUsedInsteadOfLeftValue = showUsedInsteadOfLeft ? "true" : "false";
    if (contextCard.dataset.showUsedInsteadOfLeft !== showUsedInsteadOfLeftValue) {
      contextCard.dataset.showUsedInsteadOfLeft = showUsedInsteadOfLeftValue;
    }
    if (contextCard.dataset.compressionWarning !== compressionWarning) {
      contextCard.dataset.compressionWarning = compressionWarning;
    }
    if (contextCard.title !== title) contextCard.title = title;
    if (value.textContent !== text) value.textContent = text;
    if (fill.style.width !== width) fill.style.width = width;
    const contextRing = contextCard.querySelector(".cds-ring");
    if (contextRing) contextRing.style.setProperty("--cds-ring-angle", `${displayPercent * 3.6}deg`);
    if (compressionZone && compressionZone.style.width !== compressionZoneWidth) {
      compressionZone.style.width = compressionZoneWidth;
    }
    updateDockVisibility(root);
  }

  function scheduleUpdate(delayMs = MUTATION_UPDATE_DELAY_MS) {
    const delay = Math.max(0, Number(delayMs) || 0);
    const dueAt = Date.now() + delay;
    if (state.pendingUpdate && state.pendingUpdateDueAt <= dueAt) return;

    window.clearTimeout(state.pendingUpdate);
    state.pendingUpdateDueAt = dueAt;
    state.pendingUpdate = window.setTimeout(() => {
      state.pendingUpdate = 0;
      state.pendingUpdateDueAt = 0;
      updateMeter();
    }, delay);
  }

  // 提前捕获侧栏会话切换，避免 DOM/状态更新滞后时短暂沿用旧会话读数。
  function handlePotentialNavigation(event) {
    const target = event.target && event.target.closest
      ? event.target.closest("[data-app-action-sidebar-thread-id]")
      : null;
    const conversationId = getElementConversationId(target);
    if (!conversationId) return;

    activateConversationId(conversationId, { pendingNavigation: true });
    scheduleUpdate(CAPTURE_UPDATE_DELAY_MS);
  }

  function clearRetryUpdate() {
    window.clearTimeout(state.retryTimer);
    state.retryTimer = 0;
  }

  function scheduleRetryUpdate() {
    if (state.retryTimer || Date.now() >= state.switchRetryUntil) return;

    state.retryTimer = window.setTimeout(() => {
      state.retryTimer = 0;
      updateMeter();
    }, SWITCH_RETRY_INTERVAL_MS);
  }

  function installObserver() {
    if (state.observer) return;

    state.navigationListener = handlePotentialNavigation;
    document.addEventListener("pointerdown", state.navigationListener, true);
    document.addEventListener("click", state.navigationListener, true);
    document.addEventListener("keydown", state.navigationListener, true);

    state.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
      const target = mutation.target && mutation.target.nodeType === Node.ELEMENT_NODE
          ? mutation.target
          : mutation.target && mutation.target.parentElement;
        if (shouldIgnoreMutationTarget(target)) continue;

        invalidateThreadContentCache();
        scheduleUpdate(MUTATION_UPDATE_DELAY_MS);
        return;
      }
    });
    state.observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: [
        // 会话切换只依赖侧栏 active/current/id 相关属性；Codex 改名时同步这组属性。
        "aria-current",
        "aria-selected",
        "data-app-action-sidebar-thread-active",
        "data-app-action-sidebar-thread-id",
      ],
      childList: true,
      subtree: true,
    });
  }

  window[API_KEY] = {
    version: SCRIPT_VERSION,
    refresh: updateMeter,
    setProviderSummary,
    destroy() {
      window.clearInterval(state.timer);
      window.clearTimeout(state.pendingUpdate);
      window.clearTimeout(state.historyCloseTimer);
      state.pendingUpdateDueAt = 0;
      state.historyCloseTimer = 0;
      if (state.historyHoverCleanup) {
        state.historyHoverCleanup();
        state.historyHoverCleanup = null;
      }
      if (state.floatingPointerCleanup) {
        state.floatingPointerCleanup();
        state.floatingPointerCleanup = null;
      }
      closeContextMenu();
      clearSpendEffects();
      clearRetryUpdate();
      if (state.observer) state.observer.disconnect();
      if (state.navigationListener) {
        document.removeEventListener("pointerdown", state.navigationListener, true);
        document.removeEventListener("click", state.navigationListener, true);
        document.removeEventListener("keydown", state.navigationListener, true);
      }
      if (state.providerSummaryListener) {
        window.removeEventListener(PROVIDER_SUMMARY_EVENT, state.providerSummaryListener);
        state.providerSummaryListener = null;
      }

      const root = document.getElementById(ROOT_ID);
      if (root) root.remove();

      const style = document.getElementById(STYLE_ID);
      if (style) style.remove();

      const captureState = window[CAPTURE_STATE_KEY];
      if (captureState && captureState.messageListener) {
        window.removeEventListener("message", captureState.messageListener, true);
        delete captureState.messageListener;
      }
      if (captureState) {
        delete captureState.fetchVersion;
        delete captureState.webSocketVersion;
        delete captureState.messageVersion;
      }

      delete window[INSTALL_KEY];
      delete window[API_KEY];
    },
    getState() {
      return {
        activeConversationId: state.activeConversationId,
        lastReading: state.lastReading,
        cachedConversationIds: Array.from(state.readingsByConversationId.keys()),
        animatedConversationIds: Array.from(state.lastAnimatedUsedByConversationId.keys()),
        hasAppSignalScope: isAppSignalScope(state.appSignalScope),
        hasAppSignalModules: !!state.appSignalModules,
        providerSummary: state.providerSummary,
      };
    },
  };

  installStyle();
  installCdsApiMonitor();
  startBalancePolling();
  installFetchCapture();
  installWebSocketCapture();
  installPostMessageCapture();
  installProviderSummaryListener();
  updateMeter();
  installObserver();
  state.timer = window.setInterval(updateMeter, UPDATE_INTERVAL_MS);
})();

