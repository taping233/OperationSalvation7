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
import { normalizeAction } from './agent.protocol.js';
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

const SYSTEM_PROMPT = `你是《搜打撤》游戏 AI。读局面 JSON，回一个动作 JSON，不要输出别的。
游戏目标：在四层地图走到终局撤离点撤离（或击败首脑后撤离）；死亡会丢失大部分带入卡牌。
战斗规则：每回合 2 点能量，出牌耗能量，击破全部敌人获胜；敌人意图写在 foes[].intent。
地图规则：actions 里 move 是可走的相邻节点，优先未 visited 的宝箱/事件/战斗，残血找火堆。
回复格式（严格 JSON，无代码块外文字）：{"type":"ui|move|battle|sys","name":"...","params":{},"args":[],"li":0,"idx":0}
- ui 动作填 name+params（来自 actions 清单）；move 填 li+idx；battle 填 name+args。
只回当前 actions 清单里存在的动作。`;

function buildUserMessage(obs, lastError) {
  const actions = (obs.actions || []).map(a => ({
    type: a.type, name: a.name, params: a.params || undefined,
    args: a.args || undefined, li: a.li, idx: a.idx, label: a.label || undefined,
    id: a.id,
  }));
  return JSON.stringify({
    phase: obs.phase, turn: obs.turn,
    run: obs.run ? { hp: obs.run.hp, maxHp: obs.run.maxHp, coins: obs.run.coins, atk: obs.run.atk, layer: obs.run.layer, node: obs.run.node, class: obs.run.class } : null,
    battle: obs.battle,
    ui: { title: obs.ui?.title || '', actions: obs.ui?.actions?.length ?? 0 },
    actions,
    ...(lastError ? { lastError } : {}),
  });
}

// 从模型回复中提取动作 JSON：优先整体解析，其次抓第一个 {...} 块（容代码块围栏）
function parseActionReply(text) {
  const raw = String(text || '').trim();
  const candidates = [];
  candidates.push(raw);
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) candidates.push(fence[1].trim());
  const brace = raw.match(/\{[\s\S]*\}/);
  if (brace) candidates.push(brace[0]);
  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate);
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) return { ok: true, raw: obj };
    } catch { /* 试下一个候选 */ }
  }
  return { ok: false, code: 'LLM_REPLY_NOT_JSON', message: '回复里没有可解析的动作 JSON' };
}

async function chatComplete(config, messages, signal) {
  const url = `${String(config.baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      messages,
    }),
    signal,
  });
  if (!response.ok) throw new Error(`LLM HTTP ${response.status}`);
  const data = await response.json();
  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string') throw new Error('LLM 响应缺少 message.content');
  return text;
}

const MAX_RETRIES = 3;

// decide 函数：供 SDT.Agent.autoRun({ decide: SDT.Agent.llm.decide() })
function decide(options = {}) {
  const fallback = greedyPolicy(options.greedy || {});
  return async (obs) => {
    const config = loadConfig();
    if (!config.apiKey || !config.model) return fallback(obs);   // 未配置：退化贪心，链路不断
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserMessage(obs, null) },
    ];
    let lastError = '';
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let text;
      try {
        text = await chatComplete(config, messages);
      } catch (error) {
        lastError = `调用失败：${String(error?.message || error)}`;
        break;   // 网络/接口层失败重试无益，直接退化
      }
      const parsed = parseActionReply(text);
      const norm = parsed.ok ? normalizeAction(parsed.raw) : { ok: false, code: parsed.code, message: parsed.message };
      if (norm.ok) return norm.action;
      lastError = `${norm.code}: ${norm.message}`;
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: `动作非法（${lastError}）。请只回一个当前 actions 清单里存在的动作 JSON。` });
    }
    options.onFallback?.(lastError);
    return fallback(obs);
  };
}

export { decide, loadConfig, saveConfig, isEnabled, parseActionReply, SYSTEM_PROMPT };
