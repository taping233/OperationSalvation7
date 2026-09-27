/* ============================================================
 * agent-batch.mjs —— Node 无头批量跑局（数据分析系统的量产出数口）
 *
 * 用法（vite-node 负责 src 内的 JSON import 转换）：
 *   npx vite-node game/tools/agent-batch.mjs --runs 100 --policy greedy --out output/agent/
 * 可选：--policy greedy|random|llm   --max-steps 2000   --driver <标签>   --timeout 180
 *
 * 引导复用 tests/boot.test.js 手法：canvas/Audio/WebAudio 补桩 + index.html
 * 真实页面结构 + main.js 全量启动；游戏逻辑与浏览器同源，只是不渲染。
 * 跑完写 <out>/runs.jsonl（逐局记录，与游戏内数据页同一 schema）+ summary.json。
 * ============================================================ */
import { mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

// ---------- CLI ----------
// VITEST 演出口径（09-26 均耗时⑦）：仅 4 处消费点，全是演出时长——
//   SURGE_WAVE_MS 850ms×4发=3.4s（turbo 漏网的裸 setTimeout，wait-limit 根因伴生）
//   battle.clock/feedback waitMs 短路（与 isTurbo 同效果）
//   enemy-phase 步进 420ms→0（同上）
// 游戏逻辑/结算零差异，只是无头批跑不需要的演出节拍
process.env.VITEST = 'true';
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const RUNS = Math.max(1, parseInt(argOf('runs', '10'), 10) || 10);
// 固定 seed 底（09-26 迭代方法论①）：第 i 局 seed = seedBase+i —— 同一 seed 底下
// 策略 A/B 跑的是同一批地图/掉落/战斗（配对实验，消 seed 方差，模仿 ML 固定测试集）
const SEED_BASE = argOf('seed-base', '') !== '' ? (parseInt(argOf('seed-base', '0'), 10) || 0) : null;
// 固定 seed 注入：替换 Random 服务（random.js 官方扩展点，测试同款手法）——
// newRun 里的 Random.reseed()（无参）改吐 pendingSeed，有参原样透传；只在批跑进程内生效。
// 必须在 window 全局就位后动态导入：random.js→sdt-facade 顶层求值 typeof window，
// 提前导入会让 window.SDT 永不挂载（camera.js 顶层 window.SDT.Camera 即炸）
let pendingSeed = null;
async function installSeedService() {
  const { SeededRandomService, generateSeed, setRandomService } = await import('../src/core/random.js');
  const real = new SeededRandomService();
  setRandomService({
    random: (...a) => real.random(...a),
    reseed: (seed) => real.reseed(seed ?? pendingSeed ?? generateSeed()),
    snapshot: () => real.snapshot(),
    restore: (x) => real.restore(x),
  });
}
const POLICY = argOf('policy', 'greedy');
const OUT_DIR = resolve(process.cwd(), argOf('out', 'output/agent/'));
const MAX_STEPS = parseInt(argOf('max-steps', '2000'), 10) || 2000;
const DRIVER = argOf('driver', POLICY);
const RUN_TIMEOUT_MS = (parseFloat(argOf('timeout', '30')) || 30) * 1000;   // 老板 09-26 定：单局 ≤30s
const MODE = argOf('mode', 'standard');   // standard | nest（nest 走基地「研究所」入口）

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');   // 搜打撤/

// ---------- jsdom 环境（boot.test.js 同款补桩） ----------
const html = (await import('node:fs')).readFileSync(resolve(ROOT, 'game/index.html'), 'utf8');
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
// ---------- 异常检测-报错-修复机制（09-26 老板要求） ----------
// 两个桶：errorBucket=真错误（console.error/未处理 Promise/未捕获异常/trace 自愈错），
// noiseBucket=jsdom 无 canvas 渲染噪音（计数+首条，不淹没信号）。
// 每局开头清空 → 局末写进记录；[err] 行只对真错误；errors.log 双桶落盘。
const errorBucket = [];
const noiseBucket = [];
const pushText = (bucket, detail) => {
  const text = typeof detail === 'string' ? detail
    : (detail && (detail.stack || detail.message)) || String(detail);
  bucket.push(text);
  if (bucket.length > 40) bucket.shift();
};
process.on('unhandledRejection', (e) => pushText(errorBucket, `[unhandledRejection] ${e && (e.stack || e.message) || e}`));
process.on('uncaughtException', (e) => pushText(errorBucket, `[uncaughtException] ${e && (e.stack || e.message) || e}`));   // 记录但不杀进程，继续跑批
const rawConsoleError = console.error.bind(console);
console.error = (...args) => { pushText(errorBucket, `[console.error] ${args.map(String).join(' ')}`); rawConsoleError(...args); };

const dom = new JSDOM(`<!DOCTYPE html><html><body>${body}</body></html>`, {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole().on('jsdomError', (e) => {
    // jsdom 无 canvas 渲染异常是已知噪音：入噪桶计数，不打断跑批
    pushText(noiseBucket, `[jsdomError] ${e && (e.stack || e.message) || e}`);
  }),
});
const win = dom.window;
const define = (name, value) => {
  try { Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }); }
  catch { /* 已有只读全局：跳过 */ }
};
for (const key of [
  'window', 'document', 'navigator', 'localStorage', 'sessionStorage', 'location',
  'HTMLElement', 'HTMLCanvasElement', 'Element', 'Node', 'NodeFilter', 'Event', 'CustomEvent',
  'getComputedStyle', 'requestAnimationFrame', 'cancelAnimationFrame', 'DOMParser',
  'Image', 'Blob', 'FileReader', 'MutationObserver',
]) {
  if (win[key] !== undefined) define(key, win[key]);
}
define('matchMedia', win.matchMedia || ((query) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })));

// —— fetch 桩（09-26 噪音修复）——jsdom 的 fetch 不解析相对 URL，game.boot.js 启动
// 必 fetch('version.json') → ERR_INVALID_URL（boot 的 .catch 兜住了不中断，但 console.warn
// 每次启动带 8 行堆栈污染 stderr，supervise 归因报告的 stderr 尾全被它占掉）。
// 桩返回最小 manifest 让 boot 走正常 then 链，噪音归零；其他 URL 透传原 fetch。
const realFetch = win.fetch ? win.fetch.bind(win) : (() => Promise.reject(new Error('jsdom 无 fetch')));
win.fetch = (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (String(url).includes('version.json')) {
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ version: '0.0.0' }), text: async () => '{"version":"0.0.0"}' });
  }
  return realFetch(input, init);
};
// 关键：game.boot.js 跑在 Node 侧，其顶层 fetch 引用 Node 全局 fetch（undici）而非
// window.fetch——undici 不解析相对 URL 必炸 ERR_INVALID_URL。桩必须同时顶到 globalThis。
define('fetch', win.fetch);

// canvas 2D / Audio / WebAudio / navigator.locks / fetch 补桩
const noopCtx = () => new Proxy(function () {}, {
  get: (_t, k) => {
    if (k === 'canvas') return null;
    if (k === 'measureText') return () => ({ width: 10 });
    if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern' || k === 'getImageData') {
      return () => ({ addColorStop: () => {}, data: [] });
    }
    return () => noopCtx();
  },
  set: () => true,
  apply: () => noopCtx(),
});
win.HTMLCanvasElement.prototype.getContext = function () { return noopCtx(); };
// —— 渲染异常修复（09-26 异常机制首次实战抓获）——
// jsdom 缺 Path2D / Element.animate，渲染层走到即 ReferenceError/TypeError 并污染局面
// （实测导致 closeOverlay 连点熔断弃局）：补齐最小无害实现。
class FakePath2D {
  constructor() {
    return new Proxy(this, {
      get: (t, k) => (typeof k === 'symbol' || k in t) ? t[k] : (...args) => new FakePath2D(),
      set: () => true,
    });
  }
}
win.Path2D = FakePath2D;
define('Path2D', FakePath2D);
win.Element.prototype.animate = function () {
  return {
    finished: Promise.resolve(), cancel() {}, playState: 'finished', currentTime: 0,
    startTime: 0, effect: null, timeline: null, onfinish: null, oncancel: null,
    addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; },
  };
};
// motion 动画库根治（09-26 异常机制第二案）：Element.animate 存在会打开 motion 执行路径，
// 其在 jsdom 抛 No valid elements 毁掉转场链（flowContinue 打转弃局）。
// 用游戏原生「减少动态效果」开关让 canAnimate 全程 false——必须在 main.js import 前设置。
try { win.localStorage.setItem('sdt-reduce-motion', '1'); } catch { /* 存储不可用 */ }
// 静音（09-26 均耗时）：sfx/noise 在 jsdom 全是白算（profile ~2.5%），无头批跑不需要声音
try { win.localStorage.setItem('sdt-muted', '1'); } catch { /* 同上 */ }
win.Audio = class FakeAudio {
  constructor() { this.loop = false; this.volume = 1; this.preload = ''; }
  play() { return Promise.resolve(); }
  pause() {}
  addEventListener() {}
  load() {}
};
win.AudioContext = class FakeAudioContext {
  constructor() { this.currentTime = 0; this.destination = {}; this.sampleRate = 44100; }
  createGain() { return { connect: () => {}, disconnect: () => {}, gain: { value: 0, setValueAtTime: () => {}, linearRampToValueAtTime: () => {}, cancelScheduledValues: () => {}, setTargetAtTime: () => {} } }; }
  createDynamicsCompressor() { return { connect: () => {}, disconnect: () => {}, threshold: {}, knee: {}, ratio: {}, attack: {}, release: {} }; }
  createBuffer() { return { numberOfChannels: 1, getChannelData: () => new Float32Array(8) }; }
  createBufferSource() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, buffer: null, loop: false }; }
  createBiquadFilter() { return { connect: () => {}, disconnect: () => {}, type: '', frequency: { value: 0 }, Q: { value: 0 } }; }
  createOscillator() { return { connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {}, frequency: { value: 0, setValueAtTime: () => {} } }; }
  decodeAudioData() { return Promise.resolve(this.createBuffer()); }
  resume() { return Promise.resolve(); }
  close() { return Promise.resolve(); }
};
try {
  Object.defineProperty(win.navigator, 'locks', {
    value: { request: (_name, _opts, cb) => cb() }, configurable: true,
  });
} catch { /* 有的话用原生 */ }

// ---------- 全量启动（main.js + DOMContentLoaded） ----------
// rAF 回调吞渲染异常（jsdom 无真 canvas）：保时序，渲染栈错误不中断逻辑跑批。
// 09-26 均耗时⑤：pretendToBeVisual 的原生 rAF 实测 ~29ms/帧（对齐显示器刷新），
// 而战斗渲染 flush/overlay 转场/状态推进都挂在 rAF 上——无头批跑不需要 60fps 节流，
// 换 setTimeout(0) 让渲染调度立即跑，推进等待不再被帧间隔拖住
// setImmediate 优先（0.1ms 级）：Node 的 setTimeout(0) 被钳到 1ms，而渲染/状态推进链
// 常连续挂 2-3 帧 rAF——每帧省 ~1ms，尾部稳定窗等待直接砍掉渲染链那部分
win.requestAnimationFrame = (cb) => (typeof setImmediate === 'function'
  ? setImmediate(() => { try { cb(performance.now()); } catch (e) { console.error('[raf]', e && (e.stack || e.message) || e); } })
  : setTimeout(() => { try { cb(performance.now()); } catch (e) { console.error('[raf]', e && (e.stack || e.message) || e); } }, 0));
define('requestAnimationFrame', win.requestAnimationFrame);
// 配套取消：句柄可能是 Immediate 或 Timeout，按类型分派
win.cancelAnimationFrame = (h) => { if (h && typeof h === 'object' && typeof h._onImmediate === 'function') clearImmediate(h); else clearTimeout(h); };
define('cancelAnimationFrame', win.cancelAnimationFrame);

await installSeedService();
await import('../src/main.js');

// 批跑提速：关层走 immediate（跳过 210ms 淡出计时），纯无头不需要过渡动画
{
  const UI = win.SDT.UI;
  const origHide = UI.hideOverlay.bind(UI);
  UI.hideOverlay = (opts) => origHide({ immediate: true, ...(opts || {}) });
}
document.dispatchEvent(new Event('DOMContentLoaded', { bubbles: true }));
await new Promise(r => setTimeout(r, 50));

const Agent = window.SDT?.Agent;
if (!Agent) {
  console.error('[agent-batch] SDT.Agent 未挂载，启动失败');
  process.exit(1);
}
const { RunStorage } = await import('../src/hub/game.storage.js');   // 局间清档用正删接口（cleanup）
Agent.setTurbo(true);
// llm 策略 fail-fast（09-26）：未配 key 时 llmDecide 会静默退化贪心（agent.llm.js 决定链
// 「未配置：退化贪心」），100 局跑完产出的是假 LLM 数据还当真——配置缺失直接拒跑，不做静默降级
if (POLICY === 'llm' && !Agent.llm?.isEnabled?.()) {
  console.error('[agent-batch] --policy llm 但 LLM 未配置（localStorage sdt-agent-llm 或环境变量 SDT_AGENT_API_KEY/SDT_AGENT_MODEL）——拒绝跑局：未配置时 llm 会静默退化贪心，产出假 LLM 数据');
  process.exit(1);
}
const session = await import('../src/run/game.session.js');
// --mode nest 夹具（仅本进程内存）：解锁研究所大门 + 牌盒素材不足 10 张招式/装备时从卡池补。
// 注意：档位页 newSlot 会触发 Base.reset(slot) 把基地数据归零——夹具必须包在 reset 后重放。
if (MODE === 'nest') {
  const B = win.SDT.Base;
  const applyNestFixture = () => {
    B.data.keys = Math.max(B.data.keys || 0, B.KEY_NEEDED || 10);
    B.data.nestUnlocked = true;
    const eligible = () => B.data.stash.filter(s => ['武术', '法术', '装备'].includes(s.card?.type) && !s.card?.cls);
    if (eligible().length < 10) {
      const pool = win.SDT.Cards.all().filter(c => ['武术', '法术', '装备'].includes(c.type) && !c.cls);
      for (const card of pool) {
        if (eligible().length >= 12) break;
        if (!B.data.stash.some(s => s.card?.id === card.id)) B.data.stash.push({ card, count: 1 });
      }
    }
  };
  applyNestFixture();
  const origReset = B.reset.bind(B);
  B.reset = (...args) => { const r = origReset(...args); applyNestFixture(); return r; };
  console.log(`[agent-batch] nest 夹具就绪（含 reset 后重放）：钥匙 ${B.data.keys} · 牌盒素材 ${B.data.stash.filter(s => ['武术', '法术', '装备'].includes(s.card?.type) && !s.card?.cls).length} 张`);
}
console.log(`[agent-batch] 启动完成 · runs=${RUNS} policy=${POLICY} driver=${DRIVER} mode=${MODE}`);

// 局间清理：上一局被熔断/超时残留的战斗与对局不带入下一局。
// 回标题页轮询兜底（exitToTitle 在战斗未收尾时会拒绝），3.2s 仍未回则强清内存态。
const cleanup = async () => {
  const g = window.SDT.game;
  if (g.battleActive && window.SDT.Battle?.commands?.flee) {
    window.SDT.Battle.commands.flee();
    for (let i = 0; i < 60 && g.battleActive; i++) await new Promise(r => setTimeout(r, 50));
  }
  // 状态兜底收口（09-26：phase==='idle' 曾被漏放行导致下一局零动作开局）：
  // 只要有对局/战斗/残留弹层就反复回标题
  for (let i = 0; i < 40 && (g.runActive || g.battleActive || g.nestActive || g.terminalPending
      || window.SDT.Agent.phase() === 'overlay'); i++) {
    try { session.exitToTitle(); } catch { /* 战斗未收尾时拒绝，下一轮重试 */ }
    await new Promise(r => setTimeout(r, 25));
  }
  if (window.SDT.Agent.phase() !== 'title') {
    try { session.exitToTitle(); } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 60));
  }
  // 最后兜底（09-26 30s 卡死根因：state 卡 modal 无弹层）：仍未回标题则直接 showTitle
  if (window.SDT.game.state !== 'title' && typeof session.showTitle === 'function') {
    try { session.showTitle(); } catch { /* ignore */ }
    await new Promise(r => setTimeout(r, 60));
  }
  g.terminalPending = null;
  g.extractionPending = false;
  g.nestActive = false;
  g.runActive = false;
  g.battleActive = false;
  const UI = window.SDT.UI;
  if (UI?.el?.overlay && !UI.el.overlay.hidden) UI.hideOverlay({ immediate: true });
  // 局间清档（09-26 冷启动根因修复）：局1 结束写入 slot 档案后，局2+ 的开局路径从
  // newSlot（空档位新建）变成 overwriteSlot（覆盖重开）——两条路径的 UI 状态与开局
  // 行为不同，实测同 seed 局1 57 步 vs 热局 66 步（battle 段差 8 步），这就是
  // 「首局冷启动噪声、必须 warm-up 丢弃」的真根因。每局清档让所有局走同一开局
  // 路径，首局不再特殊。只清局档三件套+坏档标记，不动 sdt-agent-llm/设置键；
  // nest 夹具 hook 在 Base.reset 上，newSlot 重放不受影响。
  try {
    // 09-27 撤离保存死锁修复：对局档（save-v2）必须走 RunStorage.remove 正删接口——
    // 裸 removeItem 会绕过 RunStorage 的 writeBaseline（进程内存编辑基线），基线残留
    // 旧档长度而实际键已删 → 本局所有 RunStorage.write 被 STALE_SLOT 静默拒绝 → 整局
    // 零存档 → 紧急撤离 begin 读档报「版本或结构无效」→ extractRetry 死循环（实测
    // V 底 40 局弃 22 的主力根因）。base-v2/tx-v1/corrupt 无该基线问题，保留裸删
    for (const k of Object.keys(win.localStorage)) {
      const m = k.match(/^sdt-save-v2-slot(\d+)$/);
      if (m) { RunStorage.remove(Number(m[1])); continue; }
      if (/^sdt-(base-v2|tx-v1)-slot\d+$/.test(k) || /^sdt-base-\d+-corrupt$/.test(k)) win.localStorage.removeItem(k);
    }
  } catch { /* 存储不可用：跳过（不影响跑局，只是首局差异回来） */ }
};

// ---------- 逐局驱动 ----------
const policyFactory = Agent.policies[POLICY] || Agent.policies.greedy;
const DEBUG_STEPS = parseInt(argOf('debug-steps', '0'), 10) || 0;
if (DEBUG_STEPS) globalThis.__sigdbg = true;
const SCDBG = argOf('scdbg', '0') === '1';
if (SCDBG) globalThis.__scdbg = true;   // debug 模式开失败记忆 sig 差异探针
const records = [];
// 单步耗时仪表（老板 09-26 规矩：实验进行中单局 >1s 必查因）——
// 相邻 onStep 间隔≈步耗时；超标步立刻打印现场（phase/id/stall），每局记 maxStepMs
const SLOW_STEP_MS = (parseFloat(argOf('slow-step', '1000')) || 1000);
// 权重向量覆盖（09-26 架构升级）：--weights 传 evolve 产物的 JSON 文件路径，或直接传
// 内联 JSON 对象串——读入后注入 globalThis.__SDT_AGENT_WEIGHTS（agent.weights.resolveWeights 消费）
const WEIGHTS = argOf('weights', '');
if (WEIGHTS) {
  const raw = WEIGHTS.trim().startsWith('{') ? WEIGHTS : readFileSync(resolve(WEIGHTS), 'utf8');
  globalThis.__SDT_AGENT_WEIGHTS = JSON.parse(raw);
}
// 分相计时探针（--profile 开）：runner.step 内 settle/decide/act/tail 四段累计
const PROFILE = argOf('profile', '0') === '1';
if (PROFILE) globalThis.__stepProf = { settle: 0, decide: 0, act: 0, tail: 0, steps: 0, sigMs: 0, sigCalls: 0, obsMs: 0, obsCalls: 0, actLoopSigMs: 0, actLoopCalls: 0, wsSigMs: 0, wsSigCalls: 0, deferMs: 0, actChanged: 0, actDeadline: 0, actIdleExit: 0, wsResets: 0, wsIters: 0, wsOk: 0, wsWaitKeys: 0, wsTimeout: 0, wsDurMs: 0, wsBlockModal: 0, wsBlockKeys: 0 };
mkdirSync(OUT_DIR, { recursive: true });   // 目录先行：局内 errors.log 追加才可写
// 游戏侧探针钩子（chests 揭晓链等）：进程内直写文件，无缓冲丢失；浏览器环境无 __probe 无副作用
const PROBE_LOG = resolve(OUT_DIR, 'probe.log');
writeFileSync(PROBE_LOG, '', 'utf8');
globalThis.__probe = (tag, msg) => { try { appendFileSync(PROBE_LOG, `[${tag}] ${msg}\n`, 'utf8'); } catch { /* 忽略 */ } };
// UI.log 桥（09-27 死锁诊断）：游戏侧边日志（撤离失败码/节点结算等）只写 DOM 不进
// console——桥到 probe.log 后死锁复盘不用再猜错误码。去 HTML 标签只留文本。
// **默认关闭（--probe-ui 1 开）**：appendFileSync 同步 I/O 拖慢时序会混沌放大路径
// 分歧（实测撤离率 46%→29% 级别的崩坏）——诊断跑批才开，正式统计跑批必须关
if (argOf('probe-ui', '0') === '1' && window.SDT?.UI?.log) {
  const origLog = window.SDT.UI.log.bind(window.SDT.UI);
  window.SDT.UI.log = (html, cls) => {
    globalThis.__probe('uilog', String(html).replace(/<[^>]*>/g, '').slice(0, 200));
    return origLog(html, cls);
  };
}
// localStorage 探针（09-27 撤离保存事务诊断）：盯局档键的写/删时间线——
// 撤离 begin 读 RUN_KEY 报 INVALID_STATE（null）= 键不存在，找出谁删的/谁该写没写。
// 劫持 Storage.prototype（实例方法赋值在 jsdom 不生效，首版实测探针零输出）
try {
  if (argOf('probe-ui', '0') !== '1') throw 0;   // 与 UI.log 桥同开关：正式统计跑批默认关
  const lsProto = Object.getPrototypeOf(window.localStorage);
  const _setItem = lsProto.setItem;
  const _removeItem = lsProto.removeItem;
  const _getItem = lsProto.getItem;
  lsProto.setItem = function (k, v) {
    try {
      const r = _setItem.call(this, k, v);
      if (/^sdt-save-v2-slot/.test(String(k))) globalThis.__probe('ls-set', `${k} len=${String(v).length} OK`);
      return r;
    } catch (e) {
      globalThis.__probe('ls-set-FAIL', `${k} ${e?.message || e}`);
      throw e;
    }
  };
  lsProto.removeItem = function (k) {
    if (/^sdt-/.test(String(k))) globalThis.__probe('ls-del', String(k));
    return _removeItem.call(this, k);
  };
  lsProto.getItem = function (k) {
    const v = _getItem.call(this, k);
    if (/^sdt-save-v2-slot/.test(String(k))) {
      globalThis.__probe('ls-get', `${k} → ${v == null ? 'NULL（键不存在）' : 'len=' + String(v).length}`);
    }
    return v;
  };
} catch { /* 探针失败不影响跑批 */ }
let lastStepAt = 0;
// 单局驱动抽成函数（09-26 漂移哨兵）：--selfcheck 会用同 seed 复跑局1 比对确定性，
// 主循环与哨兵共用同一份局体，避免两份代码漂移
const runOne = async (i) => {
  pendingSeed = SEED_BASE === null ? null : ((SEED_BASE + i) >>> 0);
  const before = Agent.recorder.listRuns().length;
  // 战斗计数+流水清零（弃局兜底路径不经 recordRun，不清会串局）
  Agent.recorder.resetRunCounters?.();
  const startedAt = Date.now();
  const phaseHist = {};
  const phaseMs = {};
  const fullTrace = [];   // debug 模式逐步 trace（局末落 trace-N.json）
  let trace = [];
  let timedOut = false;
  let maxStepMs = 0;
  let slowSteps = 0;
  lastStepAt = Date.now();
  errorBucket.length = 0;   // 每局错误桶清空（本局抓取）
  noiseBucket.length = 0;
  try {
    trace = await Promise.race([
      Agent.autoRun({
        decide: policyFactory({ resetSlots: true, preferNest: MODE === 'nest' }),
        driver: DRIVER,
        maxSteps: MAX_STEPS,
        onStep: (r, stepIdx) => {
          const now = Date.now();
          const stepMs = now - lastStepAt;
          lastStepAt = now;
          if (stepMs > maxStepMs) maxStepMs = stepMs;
          if (stepMs > SLOW_STEP_MS) {
            slowSteps += 1;
            console.log(`[slow] 局${i + 1} step${stepIdx}: ${stepMs}ms phase=${r.obs.phase} id=${r.id || 'null'} stalled=${r.settleStalled === true}`);
          }
          phaseHist[r.obs.phase] = (phaseHist[r.obs.phase] || 0) + 1;
          // 按阶段分桶步耗（09-26 耗时查因）：定位哪类步变慢
          phaseMs[r.obs.phase] = (phaseMs[r.obs.phase] || 0) + stepMs;
          if (DEBUG_STEPS && stepIdx < DEBUG_STEPS) {
            // 完整逐步 trace 落 JSON（离散 stdout 拼不出时序真相——09-26 教训）
            const bodyHead = (document.getElementById('ovBody')?.textContent || '').replace(/\s+/g, ' ').trim();
            const pt = r.obs.battle?.pendingTarget;
            fullTrace.push({
              s: stepIdx, t: Date.now(), phase: r.obs.phase,
              pick: r.id || null,
              args: r.action ? (r.action.args ?? r.action.params ?? null) : null,
              ok: r.res?.ok ?? null, code: r.res?.code || null,
              pt: pt ? { uid: pt.uid, name: pt.name } : null,
              e: r.obs.battle?.energy ?? null, turns: r.obs.battle?.turn ?? null,
              actions: (r.obs.actions || []).map(a => a.id),
              mv: (r.obs.actions || []).filter(a => a.type === 'move').map(a => `${a.id}|${a.label}|v=${a.visited ? 1 : 0}`),
              hp: r.obs.battle?.player?.hp ?? r.obs.run?.hp ?? null,
              hpMax: r.obs.battle?.player?.maxHp ?? r.obs.run?.maxHp ?? null,
              body: bodyHead.slice(0, 140),
            });
          }
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('run-timeout')), RUN_TIMEOUT_MS)),
    ]);
  } catch (error) {
    timedOut = String(error?.message || error).includes('run-timeout');
    if (!timedOut) console.error(`[agent-batch] 第 ${i + 1} 局异常：`, error?.message || error);
    if (timedOut) console.log(`[slow] 局${i + 1} 超时现场：phase=${Agent.phase()} maxStep=${maxStepMs}ms slowSteps=${slowSteps} hist=${JSON.stringify(phaseHist)}`);
  }
  const after = Agent.recorder.listRuns();
  const fresh = after.slice(before);
  const record = fresh[fresh.length - 1] || {
    id: `run-timeout-${Date.now().toString(36)}`, ts: Date.now(), driver: DRIVER,
    // seed 必须回填（09-26 配对检验）：无终局记录的弃局走这条兜底，
    // seed=null 会丢配对键——agent-compare 按 seed join，缺一局就废一半样本
    // 死亡结算挂起（09-26 死锁修复④）：terminalPending.kind='death' = 已死亡，
    // 结算确认流程没走完 recordRun 没写——兜底按真实结局记 death，不再误记 abandon
    outcome: window.SDT?.game?.terminalPending?.kind === 'death' ? 'death' : 'abandon',
    why: timedOut ? '批跑超时' : window.SDT?.game?.terminalPending ? '死亡结算挂起（terminal-pending）' : '批跑无终局记录',
    seed: pendingSeed ?? null,
    mode: window.SDT.game?.nestActive ? 'nest' : 'standard',
    class: null, characterId: null, maxLayer: null, turns: null, coins: null, hpLeft: null,
    durationSec: Math.round((Date.now() - startedAt) / 1000),
    battles: { fought: 0, won: 0 }, carried: [], carriedValue: 0,
  };
  record.batchSteps = trace.length;
  record.batchMs = Date.now() - startedAt;
  record.phaseHist = phaseHist;
  record.phaseMs = phaseMs;
  record.maxStepMs = maxStepMs;
  record.slowSteps = slowSteps;
  // 异常入账（09-26 机制）：本局真错误桶 + trace 内的单步自愈错误；jsdom 渲染噪音单独计数
  record.traceErrors = trace.filter(t => t.error).map(t => `${t.phase}:${t.error}`).slice(0, 5);
  record.errors = [...errorBucket.slice(0, 6), ...record.traceErrors].slice(0, 8);
  record.jsdomNoise = noiseBucket.length ? { count: noiseBucket.length, first: noiseBucket[0].split('\n')[0].slice(0, 200) } : null;
  record.avgStepMs = trace.length ? Math.round(record.batchMs / trace.length) : 0;
  record.stopReason = trace.stopReason || (timedOut ? 'timeout' : 'unknown');
  // push 由调用方负责（主循环逐局 push；selfcheck 复跑不进 records，不污染统计）
  if (fullTrace.length) {
    try { writeFileSync(resolve(OUT_DIR, `trace-${i + 1}.json`), JSON.stringify(fullTrace, null, 1), 'utf8'); }
    catch { /* 落盘失败不打断 */ }
  } else if (record.outcome === 'abandon' && trace.length) {
    // 弃局必落轻量 trace（09-26）：非 debug 跑弃局没现场可查——stopReason+逐步 id/spin
    // 足以定位空转键（spin/wait/stay 死因复盘不再依赖重跑）
    try { writeFileSync(resolve(OUT_DIR, `trace-lite-${i + 1}.json`), JSON.stringify({ stopReason: record.stopReason, steps: trace }, null, 1), 'utf8'); }
    catch { /* 落盘失败不打断 */ }
  }
  if (record.errors.length) {
    console.log(`[err] 局${i + 1} ${record.outcome} err=${record.errors.length} 首条: ${record.errors[0].split('\n')[0].slice(0, 160)}`);
    try {
      appendFileSync(resolve(OUT_DIR, 'errors.log'),
        `=== 局${i + 1} ${record.outcome} steps=${trace.length} ===\n${record.errors.join('\n')}\n${record.jsdomNoise ? `[noise] x${record.jsdomNoise.count} ${record.jsdomNoise.first}\n` : ''}\n`, 'utf8');
    } catch { /* 日志落盘失败不打断 */ }
  }
  const stuck = record.outcome === 'abandon' ? ` · 停因=${record.stopReason} 阶段 ${JSON.stringify(phaseHist)}` : '';
  const timing = maxStepMs > SLOW_STEP_MS ? ` ⚠最大步${maxStepMs}ms×${slowSteps}` : '';
  const noise = record.jsdomNoise ? ` ·jsdom噪×${record.jsdomNoise.count}` : '';
  console.log(`[agent-batch] ${i + 1}/${RUNS} ${record.outcome} 层${record.maxLayer ?? '—'} 行动${record.turns ?? '—'} 价值${record.carriedValue} ${Math.round(record.batchMs / 100) / 10}s ${trace.length}步 ${record.avgStepMs}ms/步${timing}${noise}${stuck}`);
  await cleanup();
  return record;
};

for (let i = 0; i < RUNS; i++) records.push(await runOne(i));

// ---------- 漂移哨兵（--selfcheck 1，09-26 老板拍板）----------
// VITEST 归零了演出节拍，但 turbo 漏网的裸 setTimeout 与真实时钟仍有竞争——实测同 seed
// 结果层稳定、轨迹步数会漂 ±2 步。哨兵把"漂移是否有数"从人肉比对变机器自检：
// 同 seed 复跑局1，四元组（outcome/层/行动/价值）必须全同（配对统计只消费结果层）；
// 步数漂移只告警不失败。结果层漂移 = 配对前提受损，exit 1 拒出数据。
if (argOf('selfcheck', '0') === '1') {
  console.log('[selfcheck] 复跑局1（同 seed）比对确定性……');
  const orig = records[0];
  const rerun = await runOne(0);
  const quad = (r) => [r.outcome, r.maxLayer, r.turns, r.carriedValue].join('/');
  if (orig.seed === rerun.seed && quad(orig) === quad(rerun)) {
    const d = Math.abs(orig.batchSteps - rerun.batchSteps);
    console.log(d === 0
      ? `[selfcheck] ✓ 完全一致：${quad(orig)}，${orig.batchSteps} 步`
      : `[selfcheck] ◐ 结果层一致（${quad(orig)}），轨迹步数漂移 ${orig.batchSteps}→${rerun.batchSteps}（±${d} 步，时钟竞争所致，不进统计不影响配对）`);
  } else {
    console.error(`[selfcheck] ✗ 结果层漂移！局1 ${quad(orig)} → 复跑 ${quad(rerun)}（seed ${orig.seed} vs ${rerun.seed}）——同 seed 不同结局，配对前提受损，先查因再跑实验`);
    process.exit(1);
  }
}

// ---------- 落盘 ----------
mkdirSync(OUT_DIR, { recursive: true });
const jsonl = records.map(r => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(resolve(OUT_DIR, 'runs.jsonl'), jsonl, 'utf8');
const summary = Agent.stats.aggregate(records);
summary.meta = {
  policy: POLICY, driver: DRIVER, runs: RUNS, mode: MODE, seedBase: SEED_BASE, generatedAt: new Date().toISOString(),
  avgRunMs: Math.round(records.reduce((s, r) => s + (r.batchMs || 0), 0) / (records.length || 1)),
  avgStepMs: (() => { const steps = records.reduce((s, r) => s + (r.batchSteps || 0), 0); return steps ? Math.round(records.reduce((s, r) => s + (r.batchMs || 0), 0) / steps) : 0; })(),
  errRuns: records.filter(r => (r.errors || []).length).length,
  errTotal: records.reduce((s, r) => s + (r.errors || []).length, 0),
  jsdomNoiseRuns: records.filter(r => r.jsdomNoise).length,
  slowStepRuns: records.filter(r => (r.maxStepMs || 0) > SLOW_STEP_MS).length,
  // 超时局单列（09-26 口径修复）：批跑 30s 超时=卡死/慢死螺旋，是故障不是策略弃局。
  // outcome 仍记 abandon（schema 兼容：数据页/aggregate 只认四枚举），上层一律用
  // stopReason==='timeout' 区分——evolve fitness / compare 判决都不再把它混进弃局率。
  timeoutRuns: records.filter(r => r.stopReason === 'timeout').length,
};
writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
if (PROFILE && globalThis.__stepProf) {
  const p = globalThis.__stepProf;
  const tot = Math.max(1, p.settle + p.decide + p.act + p.tail);
  const line = `settle=${Math.round(p.settle)}ms decide=${Math.round(p.decide)}ms act=${Math.round(p.act)}ms tail=${Math.round(p.tail)}ms steps=${p.steps} | settle ${(p.settle * 100 / tot).toFixed(1)}% decide ${(p.decide * 100 / tot).toFixed(1)}% act ${(p.act * 100 / tot).toFixed(1)}% tail ${(p.tail * 100 / tot).toFixed(1)}% :: sig ${Math.round(p.sigMs)}ms×${p.sigCalls} (${(p.sigMs * 100 / tot).toFixed(1)}%) observe ${Math.round(p.obsMs)}ms×${p.obsCalls} (${(p.obsMs * 100 / tot).toFixed(1)}%) :: actLoop-sig ${Math.round(p.actLoopSigMs)}ms×${p.actLoopCalls} waitSettle-sig ${Math.round(p.wsSigMs)}ms×${p.wsSigCalls} defer ${Math.round(p.deferMs)}ms (${(p.deferMs * 100 / tot).toFixed(1)}%) :: act 出口 changed=${p.actChanged} idleExit=${p.actIdleExit} deadline=${p.actDeadline} :: ws 稳定窗重置=${p.wsResets} wsOk=${p.wsOk} 平均时长=${(p.wsDurMs / Math.max(1, p.wsOk)).toFixed(1)}ms 平均轮数=${Math.round(p.wsIters / Math.max(1, p.wsOk))} 阻塞modal=${p.wsBlockModal} 阻塞keys=${p.wsBlockKeys}`;
  console.log(`[profile] ${line}`);
  summary.profile = p;
  writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
}
console.log(`[agent-batch] 完成 → ${resolve(OUT_DIR, 'runs.jsonl')}`);
console.log(`[agent-batch] 汇总：通关率 ${summary.overall.clearRate}% · 撤离率 ${summary.overall.extractRate}% · 死亡率 ${summary.overall.deathRate}% · 均带出价值 ${summary.overall.avgCarriedValue}`);
if (summary.meta.timeoutRuns) console.log(`[agent-batch] ⚠ 超时 ${summary.meta.timeoutRuns} 局（stopReason=timeout，卡死/慢死螺旋——不计入弃局口径，先查因再判实验）`);
// 死因分桶 top（09-26 方法论补强）：死亡高发点直接可读，下个假设从这里长
if (summary.deathBucket && Object.keys(summary.deathBucket).length) {
  const top = Object.entries(summary.deathBucket).sort((a, b) => b[1] - a[1]).slice(0, 6);
  console.log(`[agent-batch] 死因分桶: ${top.map(([k, v]) => `${k}=${v}`).join(' · ')}`);
}
process.exit(0);
