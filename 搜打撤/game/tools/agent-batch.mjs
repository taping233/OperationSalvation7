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
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

// ---------- CLI ----------
const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : dflt;
};
const RUNS = Math.max(1, parseInt(argOf('runs', '10'), 10) || 10);
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
// rAF 回调吞渲染异常（jsdom 无真 canvas）：保时序，渲染栈错误不中断逻辑跑批
const rawRaf = win.requestAnimationFrame;
win.requestAnimationFrame = (cb) => rawRaf((t) => {
  try { cb(t); } catch (e) { console.error('[raf]', e && (e.stack || e.message) || e); }
});
define('requestAnimationFrame', win.requestAnimationFrame);

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
Agent.setTurbo(true);
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
};

// ---------- 逐局驱动 ----------
const policyFactory = Agent.policies[POLICY] || Agent.policies.greedy;
const DEBUG_STEPS = parseInt(argOf('debug-steps', '0'), 10) || 0;
if (DEBUG_STEPS) globalThis.__sigdbg = true;   // debug 模式开失败记忆 sig 差异探针
const records = [];
// 单步耗时仪表（老板 09-26 规矩：实验进行中单局 >1s 必查因）——
// 相邻 onStep 间隔≈步耗时；超标步立刻打印现场（phase/id/stall），每局记 maxStepMs
const SLOW_STEP_MS = (parseFloat(argOf('slow-step', '1000')) || 1000);
mkdirSync(OUT_DIR, { recursive: true });   // 目录先行：局内 errors.log 追加才可写
// 游戏侧探针钩子（chests 揭晓链等）：进程内直写文件，无缓冲丢失；浏览器环境无 __probe 无副作用
const PROBE_LOG = resolve(OUT_DIR, 'probe.log');
writeFileSync(PROBE_LOG, '', 'utf8');
globalThis.__probe = (tag, msg) => { try { appendFileSync(PROBE_LOG, `[${tag}] ${msg}\n`, 'utf8'); } catch { /* 忽略 */ } };
let lastStepAt = 0;
for (let i = 0; i < RUNS; i++) {
  const before = Agent.recorder.listRuns().length;
  const startedAt = Date.now();
  const phaseHist = {};
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
    outcome: 'abandon', why: timedOut ? '批跑超时' : '批跑无终局记录', seed: null,
    mode: window.SDT.game?.nestActive ? 'nest' : 'standard',
    class: null, characterId: null, maxLayer: null, turns: null, coins: null, hpLeft: null,
    durationSec: Math.round((Date.now() - startedAt) / 1000),
    battles: { fought: 0, won: 0 }, carried: [], carriedValue: 0,
  };
  record.batchSteps = trace.length;
  record.batchMs = Date.now() - startedAt;
  record.phaseHist = phaseHist;
  record.maxStepMs = maxStepMs;
  record.slowSteps = slowSteps;
  // 异常入账（09-26 机制）：本局真错误桶 + trace 内的单步自愈错误；jsdom 渲染噪音单独计数
  record.traceErrors = trace.filter(t => t.error).map(t => `${t.phase}:${t.error}`).slice(0, 5);
  record.errors = [...errorBucket.slice(0, 6), ...record.traceErrors].slice(0, 8);
  record.jsdomNoise = noiseBucket.length ? { count: noiseBucket.length, first: noiseBucket[0].split('\n')[0].slice(0, 200) } : null;
  record.avgStepMs = trace.length ? Math.round(record.batchMs / trace.length) : 0;
  record.stopReason = trace.stopReason || (timedOut ? 'timeout' : 'unknown');
  records.push(record);
  if (fullTrace.length) {
    try { writeFileSync(resolve(OUT_DIR, `trace-${i + 1}.json`), JSON.stringify(fullTrace, null, 1), 'utf8'); }
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
}

// ---------- 落盘 ----------
mkdirSync(OUT_DIR, { recursive: true });
const jsonl = records.map(r => JSON.stringify(r)).join('\n') + '\n';
writeFileSync(resolve(OUT_DIR, 'runs.jsonl'), jsonl, 'utf8');
const summary = Agent.stats.aggregate(records);
summary.meta = {
  policy: POLICY, driver: DRIVER, runs: RUNS, mode: MODE, generatedAt: new Date().toISOString(),
  avgRunMs: Math.round(records.reduce((s, r) => s + (r.batchMs || 0), 0) / (records.length || 1)),
  avgStepMs: (() => { const steps = records.reduce((s, r) => s + (r.batchSteps || 0), 0); return steps ? Math.round(records.reduce((s, r) => s + (r.batchMs || 0), 0) / steps) : 0; })(),
  errRuns: records.filter(r => (r.errors || []).length).length,
  errTotal: records.reduce((s, r) => s + (r.errors || []).length, 0),
  jsdomNoiseRuns: records.filter(r => r.jsdomNoise).length,
  slowStepRuns: records.filter(r => (r.maxStepMs || 0) > SLOW_STEP_MS).length,
};
writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`[agent-batch] 完成 → ${resolve(OUT_DIR, 'runs.jsonl')}`);
console.log(`[agent-batch] 汇总：通关率 ${summary.overall.clearRate}% · 撤离率 ${summary.overall.extractRate}% · 死亡率 ${summary.overall.deathRate}% · 均带出价值 ${summary.overall.avgCarriedValue}`);
process.exit(0);
