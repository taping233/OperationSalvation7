/* ============================================================
 * agent.llm.js —— 内置 LLM 决策适配器（OpenAI 兼容 /chat/completions）
 *
 * decide 契约与 greedy/random 相同：(obs) => action | null。
 * 提示词 = 精简规则说明 + observe JSON + 动作清单；要求回严格动作 JSON。
 * 解析失败 / 动作非法带错误重试（≤3 次）；仍失败退化为贪心安全动作，不卡死循环。
 *
 * 配置存 localStorage 'sdt-agent-llm'（不进 git）；Node 无头批量下可用环境变量
 * SDT_AGENT_BASE_URL / SDT_AGENT_API_KEY / SDT_AGENT_MODEL 覆盖。
 * ============================================================ */
import { parseActionReply } from './agent.llm-parser.js';
import { greedyPolicy } from './agent.policy.js';

const CONFIG_KEY = 'sdt-agent-llm';
const DEFAULT_CONFIG = Object.freeze({
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: '',
  temperature: 0.2,
  maxTokens: 800,
});

function env(name) {
  try { return (typeof process !== 'undefined' && process.env?.[name]) || ''; } catch { return ''; }
}

function loadConfig() {
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; } catch { /* 无存储：用默认 */ }
  return {
    ...DEFAULT_CONFIG,
    ...Object.fromEntries(Object.entries(stored).filter(([, v]) => v != null && v !== '')),
    baseUrl: env('SDT_AGENT_BASE_URL') || stored.baseUrl || DEFAULT_CONFIG.baseUrl,
    apiKey: env('SDT_AGENT_API_KEY') || stored.apiKey || '',
    model: env('SDT_AGENT_MODEL') || stored.model || '',
  };
}

function saveConfig(patch) {
  const next = { ...loadConfig(), ...(patch || {}) };
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify({
      baseUrl: next.baseUrl, apiKey: next.apiKey, model: next.model,
      temperature: next.temperature, maxTokens: next.maxTokens,
    }));
  } catch { /* 存储不可用 */ }
  return next;
}

const isEnabled = () => !!(loadConfig().apiKey && loadConfig().model);

// Config and policy factories are synchronous; fetch/timeout machinery is only needed by a configured decision.
let runtime = null;
let runtimePromise = null;
function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = import('./agent.llm.runtime.js').then(module => {
      runtime = module;
      return module;
    }).catch(error => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}
async function waitForRuntime(signal, timeoutMs) {
  let timer;
  let onAbort;
  const interrupted = new Promise(resolve => {
    onAbort = () => resolve({ reason: '调用已取消（stopRun）' });
    signal?.addEventListener('abort', onAbort, { once: true });
    if (signal?.aborted) onAbort();
    timer = setTimeout(() => resolve({ reason: `执行器加载超时（>${timeoutMs}ms）` }), timeoutMs);
  });
  try { return await Promise.race([loadRuntime().then(module => ({ module })), interrupted]); }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}
function decide(options = {}) {
  const fallback = greedyPolicy(options.greedy || {});
  return async (obs, extras = null) => {
    const config = loadConfig();
    if (!config.apiKey || !config.model || extras?.signal?.aborted) return fallback(obs);
    let loaded;
    try {
      const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0 ? options.timeoutMs : 30000;
      loaded = runtime ? { module: runtime } : await waitForRuntime(extras?.signal, timeoutMs);
    }
    catch (error) {
      options.onFallback?.(`LLM 执行器加载失败：${String(error?.message || error)}`);
      return fallback(obs);
    }
    if (loaded.reason) {
      options.onFallback?.(loaded.reason);
      return fallback(obs);
    }
    // Stop may arrive while the optional chunk is loading. Never issue a request after it.
    if (extras?.signal?.aborted) return fallback(obs);
    return loaded.module.decideConfigured(obs, config, fallback, options, extras);
  };
}
export { decide, loadConfig, saveConfig, isEnabled, parseActionReply };
