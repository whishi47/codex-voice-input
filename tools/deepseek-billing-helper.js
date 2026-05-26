#!/usr/bin/env node
"use strict";

/**
 * DeepSeek V4 Billing Helper
 *
 * 独立 Node.js 进程，负责：
 * 1. 从本地配置读取 DeepSeek API Key
 * 2. 定期调用 /user/balance 获取实时余额
 * 3. 脱敏后通过 CDP 写入 Codex 页面
 *
 * 使用方式:
 *   node tools/deepseek-billing-helper.js            # 持续运行
 *   node tools/deepseek-billing-helper.js --once     # 执行一次
 *   node tools/deepseek-billing-helper.js --validate # 验证 API Key
 */

const fs = require("node:fs");
const path = require("node:path");
const https = require("node:https");
const os = require("node:os");

// ===== 常量 =====

const APP_NAME = "codex-deepseek-billing";
const CONFIG_DIR = path.join(process.env.APPDATA || os.homedir(), APP_NAME);
const CONFIG_KEY_FILE = process.env.DEEPSEEK_API_KEY_FILE ||
  path.join(CONFIG_DIR, "api-key.txt");
const CONFIG_JSON_FILE = process.env.DEEPSEEK_BILLING_CONFIG ||
  path.join(CONFIG_DIR, "config.json");

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
const REQUEST_TIMEOUT_MS = 15000;
const DEFAULT_POLL_INTERVAL_MS = 30000; // 30 秒轮询余额
const CDP_HTTP_TIMEOUT_MS = 3000;
const CDP_CONNECT_TIMEOUT_MS = 4000;
const CDP_COMMAND_TIMEOUT_MS = 4000;

const SUMMARY_KEY = "__codexDeepseekBillingSummary";
const SUMMARY_EVENT = "codex-deepseek-billing-summary";

// DeepSeek V4-Flash 定价 (每 1M tokens，美元)
const PRICING = {
  "deepseek-v4-flash": {
    inputCacheMiss: 0.14,
    inputCacheHit: 0.0028,
    output: 0.28,
  },
  "deepseek-v4-pro": {
    inputCacheMiss: 0.435,
    inputCacheHit: 0.003625,
    output: 0.87,
  },
  default: {
    inputCacheMiss: 0.14,
    inputCacheHit: 0.0028,
    output: 0.28,
  },
};

// ===== 命令行参数解析 =====

function parseArgs(argv) {
  return {
    once: argv.includes("--once"),
    noCdp: argv.includes("--no-cdp"),
    validate: argv.includes("--validate"),
    verbose: argv.includes("--verbose"),
    help: argv.includes("--help") || argv.includes("-h"),
    interval: (() => {
      const idx = argv.indexOf("--interval");
      if (idx >= 0 && idx + 1 < argv.length) {
        return parseInt(argv[idx + 1], 10) * 1000;
      }
      return DEFAULT_POLL_INTERVAL_MS;
    })(),
  };
}

function usage() {
  return [
    "DeepSeek V4 Billing Helper",
    "",
    "用法: node tools/deepseek-billing-helper.js [选项]",
    "",
    "选项:",
    "  --once           执行一次后退出",
    "  --no-cdp         不通过 CDP 推送到 Codex (仅本地打印)",
    "  --validate       验证 API Key 有效性",
    "  --verbose        详细输出",
    "  --interval <秒>  余额轮询间隔 (默认 30 秒)",
    "  --help           显示帮助",
    "",
    "API Key 设置方法 (优先级从高到低):",
    "  1. 环境变量: DEEPSEEK_API_KEY",
    `  2. 配置文件:   ${CONFIG_KEY_FILE}`,
  ].join("\n");
}

// ===== 配置读取 =====

function loadApiKey() {
  // 1. 环境变量
  const envKey = process.env.DEEPSEEK_API_KEY;
  if (envKey && envKey.trim().length > 10) {
    return { key: envKey.trim(), source: "env:DEEPSEEK_API_KEY" };
  }

  // 2. 配置文件 (%APPDATA%/codex-deepseek-billing/api-key.txt)
  try {
    const keyPath = CONFIG_KEY_FILE;
    if (fs.existsSync(keyPath)) {
      const content = fs.readFileSync(keyPath, "utf8");
      // 过滤注释行和空行，取第一行有效 Key
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      if (lines.length > 0) {
        const key = lines[0];
        if (key.length > 10 && !key.startsWith("sk-")) {
          console.warn("⚠️  API Key 格式异常: 应以 'sk-' 开头");
        }
        return { key, source: keyPath };
      }
    }
  } catch (err) {
    // 文件不存在，继续尝试其他方式
  }

  // 3. 从 config.json 读取
  try {
    if (fs.existsSync(CONFIG_JSON_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_JSON_FILE, "utf8"));
      if (config.apiKey && config.apiKey.trim().length > 10) {
        return { key: config.apiKey.trim(), source: CONFIG_JSON_FILE };
      }
    }
  } catch (err) {
    // 忽略
  }

  // 4. 回退：项目本地 config/api-key.txt
  const localKeyPath = path.join(__dirname, "..", "config", "api-key.txt");
  try {
    if (fs.existsSync(localKeyPath)) {
      const content = fs.readFileSync(localKeyPath, "utf8");
      const lines = content.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith("#"));
      if (lines.length > 0) {
        return { key: lines[0], source: localKeyPath };
      }
    }
  } catch (err) {
    // 忽略
  }

  return null;
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_JSON_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_JSON_FILE, "utf8"));
    }
  } catch (err) {
    // 忽略
  }
  return {};
}

// ===== DeepSeek API 调用 =====

function deepseekRequest(endpoint, apiKey) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "User-Agent": "DeepSeekV4BillingHelper/1.0",
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(json);
          } else {
            resolve({ error: true, status: res.statusCode, body: json });
          }
        } catch (err) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      reject(new Error("request-timeout"));
    });

    req.on("error", (err) => {
      reject(new Error(`request-failed: ${err.message}`));
    });

    req.end();
  });
}

async function fetchBalance(apiKey) {
  let raw;
  try {
    raw = await deepseekRequest(DEEPSEEK_BALANCE_URL, apiKey);
  } catch (err) {
    return { status: "request-error", message: err.message };
  }

  if (raw.error) {
    return {
      status: "api-error",
      code: raw.status,
      message: raw.body?.error?.message || `HTTP ${raw.status}`,
    };
  }

  const balanceInfo = raw.balance_infos?.find(
    (b) => b.currency === "CNY" || b.currency === "USD"
  );

  if (!balanceInfo) {
    return {
      status: "no-balance-info",
      raw: raw,
    };
  }

  return {
    status: "ok",
    isAvailable: raw.is_available === true,
    currency: balanceInfo.currency,
    totalBalance: parseFloat(balanceInfo.total_balance) || 0,
    grantedBalance: parseFloat(balanceInfo.granted_balance) || 0,
    toppedUpBalance: parseFloat(balanceInfo.topped_up_balance) || 0,
  };
}

// ===== CDP 通信 =====

function fetchJson(url, timeoutMs) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      controller.abort();
      reject(new Error("cdp-http-timeout"));
    }, timeoutMs);

    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: "GET",
      timeout: timeoutMs,
      headers: { "Accept": "application/json" },
    };

    const req = require("node:http").request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        clearTimeout(timeout);
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error("invalid-json"));
        }
      });
    });

    req.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    req.end();
  });
}

async function getCdpTargets(port) {
  try {
    const targets = await fetchJson(`http://127.0.0.1:${port}/json`, CDP_HTTP_TIMEOUT_MS);
    return Array.isArray(targets) ? targets : [];
  } catch {
    return [];
  }
}

function findCodexTarget(targets) {
  // 找 Codex 主窗口
  const pages = targets.filter(
    (t) => t.type === "page" && t.webSocketDebuggerUrl
  );

  // 排除副窗口 (pet, avatar-overlay, hotkey-window)
  const scored = pages
    .map((t) => {
      const url = (t.url || "").toLowerCase();
      let score = 0;
      if (url.includes("app://-/index.html")) score += 10;
      if (url.includes("avatar-overlay") || url.includes("hotkey") || url.includes("pet")) score -= 20;
      if (url.includes("codex")) score += 3;
      return { target: t, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.target || null;
}

function connectWebSocket(url) {
  return new Promise((resolve, reject) => {
    const WebSocket = require("ws");
    const socket = new WebSocket(url);
    const timeout = setTimeout(() => {
      try { socket.close(); } catch {}
      reject(new Error("cdp-connect-timeout"));
    }, CDP_CONNECT_TIMEOUT_MS);

    socket.on("open", () => {
      clearTimeout(timeout);
      resolve(socket);
    });

    socket.on("error", () => {
      clearTimeout(timeout);
      reject(new Error("cdp-connect-failed"));
    });
  });
}

function sendCdp(socket, method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const payload = JSON.stringify({ id, method, params });
    const timeout = setTimeout(() => {
      socket.removeAllListeners("message");
      reject(new Error("cdp-command-timeout"));
    }, CDP_COMMAND_TIMEOUT_MS);

    function onMessage(data) {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.id === id) {
          clearTimeout(timeout);
          socket.removeListener("message", onMessage);
          if (msg.error) reject(new Error(msg.error.message || "cdp-error"));
          else resolve(msg.result || {});
        }
      } catch {}
    }

    socket.on("message", onMessage);
    socket.send(payload);
  });
}

async function pushToCodex(summary) {
  // 尝试多个可能的 CDP 端口
  const candidatePorts = [9229, 9222, 9230, 9231, 9228];
  let lastError = null;

  for (const port of candidatePorts) {
    try {
      const targets = await getCdpTargets(port);
      const codexTarget = findCodexTarget(targets);
      if (!codexTarget) continue;

      const socket = await connectWebSocket(codexTarget.webSocketDebuggerUrl);
      try {
        const expression = `
(() => {
  const summary = ${JSON.stringify(summary)};
  window["${SUMMARY_KEY}"] = summary;
  try {
    window.dispatchEvent(new CustomEvent("${SUMMARY_EVENT}", { detail: summary }));
  } catch {}
  return { ok: true };
})()
`;
        await sendCdp(socket, "Runtime.evaluate", {
          expression,
          awaitPromise: false,
          allowUnsafeEvalBlockedByCSP: true,
        });
        return { ok: true, port, target: codexTarget.url };
      } finally {
        try { socket.close(); } catch {}
      }
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("codex-not-found");
}

// ===== 余额摘要构建 =====

function buildSummary(balanceData, config) {
  const userConfig = loadConfig();
  const warnThreshold = userConfig.warnBalance || 5;    // 默认余额低于 5 元警告
  const dangerThreshold = userConfig.dangerBalance || 2;  // 默认余额低于 2 元危险

  const model = userConfig.model || "deepseek-v4-flash";
  const pricing = PRICING[model] || PRICING.default;

  if (balanceData.status !== "ok") {
    return {
      status: balanceData.status,
      error: balanceData.message || "unknown",
      timestamp: Date.now(),
      pricing: pricing,
      model: model,
      warnThreshold,
      dangerThreshold,
    };
  }

  const balanceLevel = balanceData.totalBalance <= dangerThreshold ? "danger"
    : balanceData.totalBalance <= warnThreshold ? "warn"
    : "normal";

  return {
    status: "ok",
    balance: {
      total: balanceData.totalBalance,
      granted: balanceData.grantedBalance,
      toppedUp: balanceData.toppedUpBalance,
      currency: balanceData.currency,
      isAvailable: balanceData.isAvailable,
    },
    balanceLevel: balanceLevel,
    pricing: pricing,
    model: model,
    warnThreshold,
    dangerThreshold,
    timestamp: Date.now(),
  };
}

// ===== 主流程 =====

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    console.log(usage());
    process.exit(0);
  }

  // 加载 API Key
  const keyInfo = loadApiKey();
  if (!keyInfo) {
    console.error("❌ 未找到 DeepSeek API Key。请通过以下方式设置:");
    console.error(`   1. 环境变量: DEEPSEEK_API_KEY=sk-xxx`);
    console.error(`   2. 文件:      ${CONFIG_KEY_FILE}`);
    console.error(`       echo "sk-your-key" > "${CONFIG_KEY_FILE}"`);
    process.exit(1);
  }

  if (args.verbose) {
    console.log(`🔑 API Key 来源: ${keyInfo.source}`);
    console.log(`🔄 轮询间隔: ${(args.interval / 1000).toFixed(0)} 秒`);
  }

  // 验证模式
  if (args.validate) {
    console.log("🔍 验证 API Key...");
    try {
      const balance = await fetchBalance(keyInfo.key);
      if (balance.status === "ok") {
        console.log("✅ API Key 有效!");
        console.log(`   余额: ${balance.currency} ${balance.totalBalance.toFixed(2)}`);
        console.log(`   赠送: ${balance.currency} ${balance.grantedBalance.toFixed(2)}`);
        console.log(`   充值: ${balance.currency} ${balance.toppedUpBalance.toFixed(2)}`);
      } else {
        console.error(`❌ API 验证失败: ${balance.message || "未知错误"}`);
        process.exit(1);
      }
    } catch (err) {
      console.error(`❌ 请求失败: ${err.message}`);
      process.exit(1);
    }
    return;
  }

  // 主循环
  let running = true;
  let lastBalanceData = null;
  let failureCount = 0;
  const MAX_FAILURES = 5;

  const tick = async () => {
    try {
      const balance = await fetchBalance(keyInfo.key);
      lastBalanceData = balance;
      failureCount = 0;

      const summary = buildSummary(balance, {});

      if (args.once && args.verbose) {
        console.log(JSON.stringify(summary, null, 2));
      }

      if (!args.noCdp) {
        await pushToCodex(summary);
        if (args.verbose) {
          const levelEmoji = summary.balanceLevel === "danger" ? "🔴" :
            summary.balanceLevel === "warn" ? "🟡" : "🟢";
          console.log(`${levelEmoji} 余额已推送到 Codex: ${summary.balance?.currency || "?"} ${summary.balance?.total?.toFixed(2) || summary.status}`);
        }
      } else if (args.verbose) {
        console.log(`💰 余额: ${summary.balance?.currency || "?"} ${summary.balance?.total?.toFixed(2) || "N/A"}`);
      }
    } catch (err) {
      failureCount++;
      console.error(`⚠️ 第 ${failureCount} 次失败: ${err.message}`);
      if (failureCount >= MAX_FAILURES) {
        console.error("❌ 连续失败次数过多，退出");
        running = false;
      }
    }
  };

  await tick();

  if (args.once) {
    if (!args.noCdp && !args.verbose) {
      console.log("✅ 已推送到 Codex");
    }
    return;
  }

  // 持续模式
  console.log("🔄 持续运行中，Ctrl+C 退出...");
  const timer = setInterval(async () => {
    if (!running) {
      clearInterval(timer);
      process.exit(1);
    }
    await tick();
  }, args.interval);

  // 优雅退出
  process.on("SIGINT", () => {
    console.log("\n👋 再见");
    running = false;
    clearInterval(timer);
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(`致命错误: ${err.message}`);
  process.exit(1);
});
