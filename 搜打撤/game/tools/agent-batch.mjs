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
import { mkdirSync, writeFileSync } from 'node:fs';
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
const RUN_TIMEOUT_MS = (parseFloat(argOf('timeout', '180')) || 180) * 1000;
const MODE = argOf('mode', 'standard');   // standard | nest（nest 走基地「研究所」入口）

const ROOT = resolve(fileURLToPath(import.meta.url), '../../..');   // 搜打撤/

// ---------- jsdom 环境（boot.test.js 同款补桩） ----------
const html = (await import('node:fs')).readFileSync(resolve(ROOT, 'game/index.html'), 'utf8');
const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
const body = bodyMatch[1].replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(`<!DOCTYPE html><html><body>${body}</body></html>`, {
  url: 'http://localhost/',
  pretendToBeVisual: true,
  virtualConsole: new VirtualConsole().on('jsdomError', () => { /* jsdom 无 canvas 渲染噪音：吞掉 */ }),
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
  try { cb(t); } catch { /* 渲染异常不影响跑批 */ }
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
  for (let i = 0; i < 40 && window.SDT.Agent.phase() !== 'title'; i++) {
    try { session.exitToTitle(); } catch { /* 拒绝时下一轮重试 */ }
    await new Promise(r => setTimeout(r, 80));
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
const records = [];
for (let i = 0; i < RUNS; i++) {
  const before = Agent.recorder.listRuns().length;
  const startedAt = Date.now();
  const phaseHist = {};
  let trace = [];
  let timedOut = false;
  try {
    trace = await Promise.race([
      Agent.autoRun({
        decide: policyFactory({ resetSlots: true, preferNest: MODE === 'nest' }),
        driver: DRIVER,
        maxSteps: MAX_STEPS,
        onStep: (r, stepIdx) => {
          phaseHist[r.obs.phase] = (phaseHist[r.obs.phase] || 0) + 1;
          if (DEBUG_STEPS && stepIdx < DEBUG_STEPS) {
            const acts = (r.obs.actions || []).map(a => `${a.type}:${a.name}${a.type === 'ui' ? '[' + (a.label || '').slice(0, 14) + ']' : ''}`);
            console.log(`[debug] s${stepIdx} ${r.obs.phase} pick=${r.id || 'null'} acts=${JSON.stringify(acts.slice(0, 12))}`);
          }
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('run-timeout')), RUN_TIMEOUT_MS)),
    ]);
  } catch (error) {
    timedOut = String(error?.message || error).includes('run-timeout');
    if (!timedOut) console.error(`[agent-batch] 第 ${i + 1} 局异常：`, error?.message || error);
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
  records.push(record);
  const stuck = record.why === '批跑无终局记录' || timedOut ? ` · 阶段分布 ${JSON.stringify(phaseHist)} 末步 ${JSON.stringify(trace.slice(-2))}` : '';
  console.log(`[agent-batch] ${i + 1}/${RUNS} ${record.outcome} 层${record.maxLayer ?? '—'} 行动${record.turns ?? '—'} 价值${record.carriedValue} ${Math.round(record.batchMs / 100) / 10}s ${trace.length}步${stuck}`);
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
};
writeFileSync(resolve(OUT_DIR, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`[agent-batch] 完成 → ${resolve(OUT_DIR, 'runs.jsonl')}`);
console.log(`[agent-batch] 汇总：通关率 ${summary.overall.clearRate}% · 撤离率 ${summary.overall.extractRate}% · 死亡率 ${summary.overall.deathRate}% · 均带出价值 ${summary.overall.avgCarriedValue}`);
process.exit(0);
