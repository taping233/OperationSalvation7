/* ============================================================
 * perf-ledger-capture.mjs —— 全场景性能账本采集脚本（夜班 B 线 2026-09-29）
 *
 * 只测量、不优化：驱动《搜打撤》Vite 网页版走完各主要画面，
 * 每个场景采集 N 轮（默认 3 轮 × 6 秒），原始数据逐场景落 JSON。
 *
 * 测量环境（隔离，绝不在共享工作区起服务/改源码）：
 *   - 源码：git worktree `D:\素材\代号柒\.perf-wt-b`（detached @47001e3）
 *   - 依赖：node_modules junction 回主区；Vite cacheDir 用系统临时目录
 *   - 浏览器：本机 Edge `--headless=new` + 独立临时 user-data-dir（localStorage 为空，
 *     与老板真实存档完全隔离），游戏内用「档位 5 开新档」流程造测试档
 *   - 通信：Node 内置 WebSocket 直连 CDP（Runtime/Page/Performance 域），零新依赖
 *   - 游戏驱动：window.SDT.Agent（observe/act/waitSettle/policies.greedy，见 docs/agent-protocol.md）
 *
 * 一条命令重跑（仓库 搜打撤/ 下）：
 *   node scripts/perf-ledger-capture.mjs
 * 常用参数：
 *   --base-url http://localhost:5330   复用已在跑的隔离 dev server（否则自起）
 *   --out docs/evidence/perf-ledger-2026-09-29  原始数据输出目录
 *   --rounds 3  --duration 6000        每场景轮数 / 单轮采样毫秒
 *   --wt D:/素材/代号柒/.perf-wt-b/搜打撤  worktree 路径（自起 server 时用）
 *   --cdp-port 5331 --port 5330        Edge 调试口 / dev server 口（5330-5339 专用段）
 *   --only 场景名1,场景名2             只跑指定场景（title/slot/hub/prep/photo/settings/run）
 *   --keep-server                      结束后保留自起的 dev server
 * ============================================================ */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// ---------- CLI ----------
const argv = process.argv.slice(2);
function argOf(name, fallback) {
  const i = argv.indexOf('--' + name);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
}
const argFlag = name => argv.includes('--' + name);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..');
const MAIN_NODE_MODULES = path.join(REPO, 'node_modules');
const WT = argOf('wt', 'D:/素材/代号柒/.perf-wt-b/搜打撤');
const PORT = Number(argOf('port', '5330'));
const BASE_URL = argOf('base-url', `http://localhost:${PORT}/`);
const OUT_DIR = path.resolve(REPO, argOf('out', 'docs/evidence/perf-ledger-2026-09-29'));
const ROUNDS = Number(argOf('rounds', '3'));
const DURATION = Number(argOf('duration', '6000'));
const CDP_PORT = Number(argOf('cdp-port', '5331'));
const ONLY = (argOf('only', '') || '').split(',').map(s => s.trim()).filter(Boolean);
const EDGE_CANDIDATES = [
  argOf('edge', ''),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const TMP = path.join(os.tmpdir(), 'perf-wt-b');
const RUN_TAG = `${process.pid}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
const UDD = path.join(TMP, 'edge-profile-' + RUN_TAG);   // 每次运行独立档案：杜绝历史会话数据混入
fs.mkdirSync(TMP, { recursive: true });

const log = (...a) => console.log('[perf-ledger]', ...a);

// ---------- dev server（自起或复用） ----------
let serverProc = null;
async function reachable(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch { return false; }
}
async function ensureServer() {
  if (await reachable(BASE_URL)) { log('复用已在跑的 dev server:', BASE_URL); return; }
  const viteBin = path.join(MAIN_NODE_MODULES, 'vite', 'bin', 'vite.js');
  const cacheDir = path.join(TMP, 'vite-cache').replace(/\\/g, '/');
  const cfg = path.join(TMP, 'vite.config.mjs');
  const wtFileUrl = pathToFileURL(path.join(WT, 'vite.config.js')).href;
  fs.writeFileSync(cfg, `// perf-ledger-capture 自动生成的隔离配置（cacheDir 独立，避免与主区并发写）\nimport base from ${JSON.stringify(wtFileUrl)};\nexport default { ...base, cacheDir: ${JSON.stringify(cacheDir)} };\n`);
  log('自起隔离 dev server（worktree + 独立 cacheDir）:', WT);
  serverProc = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(PORT), '--strictPort'], { cwd: WT, stdio: 'ignore' });
  for (let i = 0; i < 100; i++) {
    if (await reachable(BASE_URL)) { log('dev server 就绪:', BASE_URL); return; }
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error('dev server 启动失败（端口 ' + PORT + '）');
}

// ---------- Edge + CDP ----------
let edgeProc = null;
function ensureCdpPortFree() {
  // INFRA-06：不再自动杀任何进程（旧实现按端口 netstat 挑 PID 直接 taskkill /T /F，
  // 会误杀其他会话/无主进程整棵树）。端口被占=现场归人工：报错退出，只允许
  // cleanup() 收拾本脚本自己 spawn 的 edgeProc/serverProc。
  let out = '';
  try { out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 30000 }); }
  catch (e) { log('netstat 不可用（跳过端口预检，CDP 连不上会自然失败）:', String(e.message).slice(0, 120)); return; }
  for (const line of out.split('\n')) {
    if (line.includes(`:${CDP_PORT} `) && /LISTENING/i.test(line)) {
      const pid = Number(line.trim().split(/\s+/).pop()) || null;
      throw new Error(`CDP 端口 ${CDP_PORT} 已被${pid ? ` pid=${pid} 的进程` : '其他进程'}占用。`
        + `本脚本不自动杀进程，请人工核对归属后处置（如 netstat -ano | findstr ":${CDP_PORT}"），`
        + `确认无主或属旧自动化残留再自行清理，然后重跑。`);
    }
  }
}
function killEdgeTree() {
  if (!edgeProc?.pid) return;
  try { execFileSync('taskkill', ['/pid', String(edgeProc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {}
}
function startEdge(url) {
  const edge = EDGE_CANDIDATES.find(p => fs.existsSync(p));
  if (!edge) throw new Error('找不到 Edge（msedge.exe）');
  ensureCdpPortFree();
  const flags = [
    ...(argFlag('headed') ? [] : ['--headless=new']),
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${UDD}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1920,1080', '--hide-scrollbars',
    '--autoplay-policy=no-user-gesture-required',
    url,
  ];
  edgeProc = spawn(edge, flags, { stdio: 'ignore' });
}

const evalTimeoutMs = Number(argOf('eval-timeout', '45000'));
class Cdp {
  constructor() { this.seq = 0; this.pending = new Map(); this.ws = null; }
  async connect() {
    let page = null;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (r.ok) {
          const list = await r.json();
          page = list.find(t => t.type === 'page' && (t.url === 'about:blank' || t.url.startsWith('http://localhost'))) 
            || list.find(t => t.type === 'page');
          if (page) break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 250));
    }
    if (!page) throw new Error('Edge CDP 不可达: ' + CDP_PORT);
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws 连接失败')); });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
    };
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, msg => msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalJson(expression, timeoutMs = evalTimeoutMs) {
    const work = (async () => {
      const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) {
        throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 500));
      }
      return r.result.value;
    })();
    let timer = null;
    try {
      return await Promise.race([
        work,
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('页面执行超时（' + timeoutMs + 'ms）: ' + expression.slice(0, 120))), timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); }
  }
  async evalSoft(expression) {
    try { return await this.evalJson(expression); } catch { return null; }
  }
}

// ---------- 页面内辅助（整函数序列化注入，见 plInstall） ----------
function plInstall() {
  const W = window;
  const g = () => W.SDT?.game;
  const Agent = () => W.SDT?.Agent;
  const round = v => v == null ? null : +v.toFixed(2);
  const med = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
  const p95 = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return s[Math.max(0, Math.ceil(s.length * 0.95) - 1)]; };
  const findScrollable = () => {
    let n = document.getElementById('libGrid');
    while (n) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 4) return n;
      n = n.parentElement;
    }
    return null;
  };

  async function sample(opts = {}) {
    const { mode = 'idle', duration = 6000 } = opts;
    const SDT = W.SDT;
    const cv = document.getElementById('game');
    const rect = cv ? cv.getBoundingClientRect() : null;
    const viewport = rect ? {
      cssWidth: round(rect.width), cssHeight: round(rect.height),
      bufferWidth: cv.width, bufferHeight: cv.height, dpr: W.devicePixelRatio || 1,
    } : null;
    const gaps = [], draws = [], longTasks = [], loaf = [];
    const obsLT = typeof PerformanceObserver === 'function' ? new PerformanceObserver(l => l.getEntries().forEach(e => longTasks.push(+e.duration.toFixed(1)))) : null;
    try { obsLT?.observe({ type: 'longtask', buffered: false }); } catch {}
    const obsLoaf = typeof PerformanceObserver === 'function' ? new PerformanceObserver(l => l.getEntries().forEach(e => loaf.push(+e.duration.toFixed(1)))) : null;
    try { obsLoaf?.observe({ type: 'long-animation-frame', buffered: false }); } catch {}
    let origDraw = null, drawWrapped = false;
    if (SDT?.Renderer?.draw) {
      origDraw = SDT.Renderer.draw;
      SDT.Renderer.draw = function (...a) {
        const t0 = performance.now();
        try { return origDraw.apply(this, a); } finally { draws.push(performance.now() - t0); }
      };
      drawWrapped = true;
    }
    const cam = g()?.cam || null;
    const camBase = cam ? { cx: cam.cx, cy: cam.cy, zoom: cam.zoom, frameMode: cam.frameMode } : null;
    const mem0 = performance.memory?.usedJSHeapSize ?? null;
    const phaseBefore = Agent() ? Agent().phase() : null;
    const t0 = performance.now();
    let prev = 0, stopped = false, tickError = null;
    const rafDone = new Promise(resolve => {
      const tick = now => {
        if (stopped) return;
        try {
          if (prev) gaps.push(now - prev);
          prev = now;
          if (mode === 'pan' && cam) {
            cam.cx = camBase.cx + Math.sin((now - t0) / 450) * 36;
            cam.cy = camBase.cy + Math.cos((now - t0) / 620) * 24;
            cam.frameMode = 'manual';
            SDT.RenderScheduler.invalidate();
          }
          if (mode === 'scroll') {
            const c = findScrollable();
            if (c) c.scrollTop = ((now - t0) / duration) * (c.scrollHeight - c.clientHeight);
          }
          if (now - t0 < duration) { requestAnimationFrame(tick); return; }
        } catch (e) { tickError = String(e?.message || e); }
        resolve();
      };
      requestAnimationFrame(tick);
      // 看门狗：rAF 停摆/页面被占死时也放行（degraded 标记），绝不挂死采集
      const wall = setInterval(() => {
        if (stopped || performance.now() - t0 >= duration + 12000) { clearInterval(wall); resolve(); }
      }, 500);
    });
    let moveHops = 0;
    const moving = (async () => {
      if (mode !== 'move') return;
      const A = Agent();
      while (performance.now() - t0 < duration - 900) {
        const obs = A.observe();
        if (obs.phase !== 'map') return;
        const acts = obs.actions.filter(a => a.type === 'move' && !/紧急撤离|emergencyExit/i.test(a.label || ''));
        const fwd = acts.filter(a => a.li >= (obs.run?.layer - 1) && !a.visited).sort((a, b) => b.li - a.li);
        const pick = fwd[0] || acts[0];
        if (!pick) return;
        const r = await A.act(pick);
        if (!r || r.ok === false) return;
        moveHops++;
        await A.waitSettle({ timeoutMs: 9000 });
      }
    })();
    await rafDone;
    stopped = true;
    await moving.catch(() => {});
    if (drawWrapped && SDT.Renderer.draw !== origDraw) SDT.Renderer.draw = origDraw;
    obsLT?.disconnect(); obsLoaf?.disconnect();
    if (cam && camBase) Object.assign(cam, camBase);
    SDT.RenderScheduler?.invalidate?.();
    const mem1 = performance.memory?.usedJSHeapSize ?? null;
    return {
      mode, viewport, phaseBefore,
      phaseAfter: Agent() ? Agent().phase() : null,
      tickError: tickError || undefined,
      degraded: gaps.length < (duration / 100) ? true : undefined,   // rAF 停摆降级标记
      frames: gaps.length,
      rafHz: round(gaps.length * 1000 / duration),
      rafMedianMs: round(med(gaps)), rafP95Ms: round(p95(gaps)),
      rafMaxMs: gaps.length ? round(Math.max(...gaps)) : null,
      slowOver20msPercent: round(gaps.filter(x => x > 20).length * 100 / Math.max(1, gaps.length)),
      drawWrapped, drawCalls: draws.length,
      drawMedianMs: round(med(draws)), drawP95Ms: round(p95(draws)),
      drawMaxMs: draws.length ? round(Math.max(...draws)) : null,
      longTasks: longTasks.length,
      longTaskMaxMs: longTasks.length ? round(Math.max(...longTasks)) : null,
      longAnimationFrameCount: loaf.length,
      longAnimationFrameMaxMs: loaf.length ? round(Math.max(...loaf)) : null,
      heapUsedMiB: mem1 == null ? null : round(mem1 / 1048576),
      heapDeltaMiB: mem0 != null && mem1 != null ? round((mem1 - mem0) / 1048576) : null,
      visibility: document.visibilityState,
      moveHops: mode === 'move' ? moveHops : undefined,
    };
  }

  async function loadReport() {
    const nav = performance.getEntriesByType('navigation')[0];
    return {
      navigation: nav ? {
        responseEndMs: round(nav.responseEnd),
        domInteractiveMs: round(nav.domInteractive),
        domContentLoadedMs: round(nav.domContentLoadedEventEnd),
        loadEventMs: round(nav.loadEventEnd),
      } : null,
      paint: performance.getEntriesByType('paint').map(e => [e.name, round(e.startTime)]),
      battleModuleLoadsMs: performance.getEntriesByName('sdt:battle-load', 'measure').map(e => round(e.duration)),
      battleFrameLoads: performance.getEntriesByType('measure')
        .filter(e => e.name.startsWith('sdt:battle-frames-'))
        .map(e => [e.name.slice('sdt:battle-frames-'.length), round(e.duration)]),
      resourceCount: performance.getEntriesByType('resource').length,
      resourceTransferKiB: round(performance.getEntriesByType('resource').reduce((s, e) => s + e.transferSize, 0) / 1024),
    };
  }

  async function waitReady(timeoutMs = 60000) {
    const t0 = performance.now();
    for (;;) {
      const A = Agent();
      if (A && g() && document.getElementById('title') && A.phase() !== 'boot') {
        return { ms: round(performance.now() - t0), phase: A.phase() };
      }
      if (performance.now() - t0 > timeoutMs) return { timeout: true, phase: A ? A.phase() : 'no-agent' };
      await new Promise(r => setTimeout(r, 120));
    }
  }

  const act = a => Agent()?.act(a) ?? { ok: false, code: 'NO_AGENT' };
  const observe = () => Agent()?.observe() ?? { ok: false };
  const waitSettle = o => Agent()?.waitSettle(o) ?? { ok: false };
  const setTurbo = v => Agent()?.setTurbo(v);
  const phase = () => Agent()?.phase() ?? 'no-agent';
  const uiClick = name => {
    const el = document.querySelector(`#ovBody [data-act="${name}"]`) || document.querySelector(`[data-act="${name}"]`);
    if (!el) return false;
    el.click();
    return true;
  };
  const pressAlt = key => {
    window.dispatchEvent(new KeyboardEvent('keydown', { altKey: true, key, bubbles: true }));
    return true;
  };
  const esc = () => W.SDT?.UI?.closeTopOverlayByEsc?.() ?? false;
  const photoInfo = () => {
    const grid = document.getElementById('libGrid');
    const c = findScrollable();
    return {
      items: grid ? grid.querySelectorAll('.lib-item').length : 0,   // 已挂载 DOM 张数（窗口挂载：首屏 24）
      catalogCount: +(document.querySelector('.clib-count b')?.textContent || 0) || null,   // 馆藏总数
      sentinel: !!document.querySelector('.lib-mount-sentinel'),
      scroll: c ? { scrollHeight: c.scrollHeight, clientHeight: c.clientHeight, maxScroll: c.scrollHeight - c.clientHeight } : null,
    };
  };
  const battleInfo = () => {
    const snap = W.SDT?.Battle?.getSnapshot?.();
    return snap ? {
      turn: snap.turn, busy: !!snap.busy, phase: snap.phase || null,
      foes: snap.foes.filter(f => !f.dead).map(f => ({ name: f.name, hp: f.hp, maxHp: f.maxHp })),
      hand: snap.hand.length, deckSel: !!snap.deckSelection,
      isBossDeck: !!(snap.deckSelection?.boss),
    } : null;
  };
  const runInfo = () => {
    const game = g();
    if (!game) return null;
    return {
      runActive: !!game.runActive,
      layer: game.layerIdx != null ? game.layerIdx + 1 : null,
      node: game.trackPos, hp: game.hp, maxHp: game.maxHp,
      class: game.myClass || null, characterId: game.characterId || null,
      mode: game.mode || null, seed: game.seed ?? null,
      bossKilled: !!game.bossKilled,
    };
  };
  const stateSummary = () => ({ phase: phase(), run: runInfo(), battle: battleInfo() });

  // —— 对局推进（页内自驱，避免 Node↔页面往返竞态）——
  const pickMoveInPage = (obs, targetLayer, opts = {}) => {
    const acts = (obs.actions || []).filter(a => a.type === 'move');
    if (!acts.length) return null;
    const curLayer = obs.run.layer - 1;
    const cur = obs.run.node;
    const safe = acts.filter(a => !/紧急撤离|emergencyExit/i.test(a.label || ''));
    let pool = safe.length ? safe : acts;
    // 避免立即原路返回（贪心游走的震荡根源）
    const notLast = pool.filter(a => !(a.li === curLayer && a.idx === (opts.lastNode ?? -1)));
    pool = notLast.length ? notLast : pool;
    // 1) 未访问格；2) next 展开里有更深层（通向环间门/下一层）；3) next 有未访问；4) 兜底
    const unvisited = pool.filter(a => !a.visited);
    if (unvisited.length) return unvisited[0];
    const deeperNext = pool.find(a => (a.next || []).some(n => n.li > curLayer));
    if (deeperNext) return deeperNext;
    const freshNext = pool.find(a => (a.next || []).some(n => !n.visited));
    if (freshNext) return freshNext;
    if (opts.boss) {
      const b = pool.find(a => /首脑|boss/i.test(a.label || ''));
      if (b) return b;
    }
    return pool[0];
  };
  async function fightWithGreedy(A, maxSteps = 160) {
    const decide = A.policies.greedy({ strategic: true });
    for (let i = 0; i < maxSteps; i++) {
      const obs = A.observe();
      if (obs.phase !== 'battle') return { ended: true, steps: i, phase: obs.phase };
      const r = await A.step(decide, { commandTimeoutMs: 20000 });
      if (r.error) return { error: r.error, steps: i };
      if (r.stopReason) return { stop: r.stopReason, steps: i };
    }
    return { timeout: true };
  }
  // 推进用弹层快解：一次返回「应当直取的动作」或 null（交给贪心）。
  // 口径：教学确认 → 开箱揭示 → 跳过开箱 → 离开商店 → 关包（商店里不关）→ 职业授予页用 Esc 链关闭
  const overlayQuickAct = (obs) => {
    const acts = (obs.actions || []).filter(a => a.type === 'ui');
    if (!acts.length) return null;
    const find = n => acts.find(a => a.name === n);
    const inShop = acts.some(a => a.name === 'shopOpenBag' || a.name === 'backShop' || a.name === 'closeShop');
    return find('ammoTeachOk')
      || find('chestReveal')
      || find('chestSkip')
      || find('goDoor')
      || find('closeShop')
      || (inShop ? null : find('closeBag'))
      || (find('clsGrantGo') ? find('closeOverlay') : null)
      || (inShop ? null : find('czClose'))
      || null;
  };
  async function runDrive(opts = {}) {
    // 推进到 targetLayer 层稳态；stopAtBattle 时停在第一场战斗战场稳态（turbo 关）
    const A = Agent();
    const t0 = performance.now();
    const maxMs = opts.maxMs || 240000;
    const events = [];
    let lastPhaseSig = '', phaseRepeat = 0;
    let lastNode = null;
    const stuckMap = new Map();
    await A.setTurbo(true);
    for (let i = 0; i < 400; i++) {
      if (performance.now() - t0 > maxMs) { events.push('timeout'); break; }
      const obs = A.observe();
      if (!obs.ok) { await new Promise(r => setTimeout(r, 300)); continue; }
      const phaseSig = JSON.stringify([obs.phase, obs.run?.layer, obs.run?.node, obs.run?.state, obs.ui?.title]);
      phaseRepeat = phaseSig === lastPhaseSig ? phaseRepeat + 1 : 0;
      lastPhaseSig = phaseSig;
      if (phaseRepeat === 40) {
        events.push({ stall: phaseSig.slice(0, 200), acts: obs.actions.slice(0, 10).map(a => a.type + ':' + a.name + JSON.stringify(a.params || {})) });
      }
      if (phaseRepeat >= 120) { events.push({ giveUp: phaseSig.slice(0, 200) }); break; }
      if (obs.phase === 'battle') {
        const b = A.observe().battle;
        if (opts.stopAtBattle && !b?.deckSelection) {
          // 战场稳态等待后交还外部测量
          for (let q = 0; q < 40; q++) {
            const s = window.SDT.Battle?.getSnapshot?.();
            if (s && !s.busy && !s.deckSelection) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 1200));
          await A.setTurbo(false);
          return { ok: true, stoppedAt: 'battle', steps: i, events, battle: battleInfo(), run: runInfo() };
        }
        const fight = await fightWithGreedy(A);
        events.push({ fight });
        continue;
      }
      if (obs.phase === 'map' && obs.run?.active && !obs.ui?.open) {
        if ((obs.run.layer || 1) >= (opts.targetLayer || 1) && obs.run.state === 'idle') {
          await A.setTurbo(false);
          return { ok: true, stoppedAt: 'map-idle', steps: i, events, run: obs.run };
        }
        const pick = pickMoveInPage(obs, opts.targetLayer || 1, { lastNode });
        if (pick) {
          lastNode = obs.run.node;
          const r = await A.act(pick);
          if (r.ok !== false) { await A.waitSettle({ timeoutMs: 15000 }); continue; }
        }
        await new Promise(r => setTimeout(r, 400));
        continue;
      }
      // 弹层/其他阶段：推进优先动作直取，再交贪心
      const overlayTraceCap = 30;
      if (obs.phase === 'overlay' && events.filter(e => e.ov).length < overlayTraceCap) {
        events.push({ ov: obs.ui?.title || '?', node: obs.run?.node, acts: (obs.actions || []).slice(0, 4).map(a => a.name) });
      }
      const priority = overlayQuickAct(obs);
      if (priority) {
        const pr = await A.act(priority);
        events.push({ took: priority.name, ok: pr.ok !== false });
        // 等弹层真正退场（hideOverlay 有 210ms 淡出；期间旧按钮仍在 DOM，
        // 立即重查会重复点击同一动作并触发重渲染）
        for (let w = 0; w < 15; w++) {
          await new Promise(r => setTimeout(r, 200));
          const o2 = A.observe();
          if (!o2.ok || !o2.ui?.open || o2.ui?.title !== (obs.ui?.title || '')) break;
        }
        continue;
      }
      if (obs.phase === 'hub' || obs.phase === 'settlement') {
        // 对局已终结（死亡/撤离/结算）：结算页交给贪心点完，回基地后重新出发
        if (obs.phase === 'settlement') {
          await A.step(A.policies.greedy(), { commandTimeoutMs: 20000 });
          continue;
        }
        events.push({ redeploy: true });
        await A.act({ type: 'ui', name: 'hubTab', params: { tab: 'deploy' } });
        await new Promise(r => setTimeout(r, 500));
        await A.act({ type: 'ui', name: 'deploy' });
        await new Promise(r => setTimeout(r, 700));
        await A.act({ type: 'ui', name: 'confirmDeploy' });
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      const r = await A.step(A.policies.greedy(), { commandTimeoutMs: 20000 });
      if (r.error) { events.push({ error: r.error }); break; }
    }
    await A.setTurbo(false);
    return { ok: false, events, run: runInfo() };
  }
  async function driveBoss() {
    // 从第 4 层稳态走到首脑格、确认编组，停在战场稳态（turbo 关）
    const A = Agent();
    const events = [];
    await A.setTurbo(true);
    for (let i = 0; i < 120; i++) {
      const obs = A.observe();
      if (!obs.ok) { await new Promise(r => setTimeout(r, 300)); continue; }
      if (obs.phase === 'battle') {
        const b = A.observe().battle;
        if (b?.deckSelection) {
          // 编组确认
          for (let k = 0; k < 40; k++) {
            const o2 = A.observe();
            const d = o2.battle?.deckSelection;
            if (!d) break;
            if ((d.selected || []).length >= (d.need || 0)) {
              const r = await A.act({ type: 'battle', name: 'confirmDeck', args: [] });
              if (r.ok === false) events.push({ confirmErr: r });
            } else {
              const pick = d.cards.find(c => !(d.selected || []).includes(c.uid));
              if (!pick) { events.push({ noCard: true }); break; }
              await A.act({ type: 'battle', name: 'selectDeckCard', args: [pick.uid] });
            }
            await new Promise(r => setTimeout(r, 120));
          }
          for (let q = 0; q < 40; q++) {
            const s = window.SDT.Battle?.getSnapshot?.();
            if (s && !s.busy && !s.deckSelection) break;
            await new Promise(r => setTimeout(r, 250));
          }
          await new Promise(r => setTimeout(r, 1200));
          await A.setTurbo(false);
          return { ok: true, stoppedAt: 'boss-battle', steps: i, events, battle: battleInfo(), run: runInfo() };
        }
        events.push({ note: 'battle-without-deck' });
        await A.setTurbo(false);
        return { ok: false, stoppedAt: 'battle-no-deck', events, battle: battleInfo() };
      }
      if (obs.phase === 'map' && obs.run?.active && !obs.ui?.open) {
        const acts = (obs.actions || []).filter(a => a.type === 'move' && /首脑|boss/i.test(a.label || ''));
        if (acts.length) {
          const r = await A.act(acts[0]);
          if (r.ok !== false) { await A.waitSettle({ timeoutMs: 20000 }); continue; }
        }
        await new Promise(r => setTimeout(r, 500));
        continue;
      }
      if (obs.phase === 'hub' || obs.phase === 'settlement') {
        if (obs.phase === 'settlement') { await A.step(A.policies.greedy(), { commandTimeoutMs: 20000 }); continue; }
        events.push({ redeploy: true });
        await A.act({ type: 'ui', name: 'hubTab', params: { tab: 'deploy' } });
        await new Promise(r => setTimeout(r, 500));
        await A.act({ type: 'ui', name: 'deploy' });
        await new Promise(r => setTimeout(r, 700));
        await A.act({ type: 'ui', name: 'confirmDeploy' });
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      const r = await A.step(A.policies.greedy(), { commandTimeoutMs: 20000 });
      if (r.error) { events.push({ error: r.error }); break; }
      const qb = overlayQuickAct(obs);
      if (qb) { await A.act(qb); await A.waitSettle({ timeoutMs: 8000 }); }
    }
    await A.setTurbo(false);
    return { ok: false, events };
  }

  W.__PL = { sample, loadReport, waitReady, act, observe, waitSettle, setTurbo, phase, uiClick, pressAlt, esc, photoInfo, battleInfo, runInfo, stateSummary, findScrollable, runDrive, driveBoss, fightWithGreedy };
  return true;
}

// ---------- 场景编排 ----------
const results = new Map();
function record(name, conditions, sample) {
  if (!results.has(name)) results.set(name, { scenario: name, conditions, rounds: [] });
  results.get(name).rounds.push(sample);
}
const median = arr => { const s = [...arr].filter(v => v != null).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
function summarizeForLedger(entry) {
  const pick = key => median(entry.rounds.map(r => r[key]));
  return {
    rounds: entry.rounds.length,
    rafMedianMs: pick('rafMedianMs'), rafP95Ms: pick('rafP95Ms'), rafMaxMs: pick('rafMaxMs'), rafHz: pick('rafHz'),
    drawCalls: pick('drawCalls'), drawMedianMs: pick('drawMedianMs'), drawP95Ms: pick('drawP95Ms'),
    longTasks: pick('longTasks'), longTaskMaxMs: pick('longTaskMaxMs'),
    loafCount: pick('longAnimationFrameCount'), loafMaxMs: pick('longAnimationFrameMaxMs'),
    heapUsedMiB: pick('cdpHeapUsedMiB'), slowOver20msPercent: pick('slowOver20msPercent'),
  };
}
async function ensureVisible(cdp) {
  for (let i = 0; i < 5; i++) {
    const vis = await cdp.evalSoft(`document.visibilityState`);
    if (vis === 'visible') return true;
    await cdp.send('Page.bringToFront').catch(() => {});
    await new Promise(r => setTimeout(r, 600));
  }
  return (await cdp.evalSoft(`document.visibilityState`)) === 'visible';
}
async function sampleScene(cdp, name, conditions, opts = {}) {
  log(`采样 ${name} ×${ROUNDS}（mode=${opts.mode || 'idle'}, ${DURATION}ms/轮）`);
  for (let i = 0; i < ROUNDS; i++) {
    if (!(await ensureVisible(cdp))) {
      log(`  轮${i + 1}: 跳过（页面不可见，rAF 无效）`);
      record(name, typeof conditions === 'function' ? conditions() : conditions, { skipped: true, reason: 'visibility-hidden' });
      continue;
    }
    const s = await cdp.evalJson(`window.__PL.sample(${JSON.stringify({ mode: 'idle', duration: DURATION, ...opts })})`,
      DURATION + 30000);
    const metrics = (await cdp.send('Performance.getMetrics')).metrics;
    s.cdpHeapUsedMiB = +(metrics.find(m => m.name === 'JSHeapUsedSize')?.value / 1048576).toFixed(2);
    s.cdpNodes = metrics.find(m => m.name === 'Nodes')?.value;
    record(name, typeof conditions === 'function' ? conditions() : conditions, s);
    log(`  轮${i + 1}: rAF中位 ${s.rafMedianMs} p95 ${s.rafP95Ms} | draw×${s.drawCalls} 中位 ${s.drawMedianMs} p95 ${s.drawP95Ms} | LT ${s.longTasks} | 堆 ${s.cdpHeapUsedMiB}MiB | ${s.phaseAfter}`);
  }
  writeSummary();
}
function writeSummary() {
  const summary = [];
  for (const [name, entry] of results) {
    summary.push({ scenario: name, conditions: entry.conditions, ...summarizeForLedger(entry) });
    try { fs.writeFileSync(path.join(OUT_DIR, `scene-${name}.json`), JSON.stringify(entry, null, 2)); } catch {}
  }
  // 与既有 summary.json 合并（按场景名 upsert），支持分批采集（--only）落入同一账本
  const summaryPath = path.join(OUT_DIR, 'summary.json');
  let merged = [...summary];
  try {
    const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    const byName = new Map(summary.map(s => [s.scenario, s]));
    for (const old of prev.scenarios || []) {
      if (!byName.has(old.scenario)) merged.push(old);
      else merged[merged.findIndex(m => m.scenario === old.scenario)] = byName.get(old.scenario);
    }
    merged.sort((a, b) => a.scenario.localeCompare(b.scenario));
  } catch {}
  fs.writeFileSync(summaryPath, JSON.stringify({
    capturedAt: new Date().toISOString(), baseUrl: BASE_URL, rounds: ROUNDS, durationMs: DURATION,
    browser: browserEnv, worktree: WT, scenarios: merged,
  }, null, 2));
}
async function settleState(cdp, want, timeoutMs = 30000) {
  const t0 = Date.now();
  for (;;) {
    const st = await cdp.evalSoft(`(async () => { await window.__PL.waitSettle({ timeoutMs: 6000 }); return window.__PL.stateSummary(); })()`);
    if (st && (!want || want.includes(st.phase))) return st;
    if (Date.now() - t0 > timeoutMs) return st;
    await new Promise(r => setTimeout(r, 300));
  }
}

let browserEnv = null;
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await ensureServer();

  const cdp = new Cdp();
  startEdge('about:blank');
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('Performance.enable');
  await cdp.send('Page.bringToFront').catch(() => {});

  const env = {
    gpu: await cdp.evalJson(`(() => { const c = document.createElement('canvas'); const gl = c.getContext('webgl2') || c.getContext('webgl'); if (!gl) return 'no-webgl'; const e = gl.getExtension('WEBGL_debug_renderer_info'); return { renderer: e ? gl.getParameter(e.UNMASKED_RENDERER_WEBGL) : null, vendor: e ? gl.getParameter(e.UNMASKED_VENDOR_WEBGL) : null }; })()`),
    ua: await cdp.evalJson('navigator.userAgent'),
  };
  browserEnv = env;
  log('浏览器:', JSON.stringify(env));

  // —— S0 加载（含 boot）——
  log('加载页面:', BASE_URL);
  await cdp.send('Page.navigate', { url: BASE_URL });
  for (let i = 0; i < 120; i++) {
    const ok = await cdp.evalSoft(`!!window.SDT && !!window.SDT.Agent`);
    if (ok) break;
    await new Promise(r => setTimeout(r, 300));
  }
  await cdp.evalSoft(`window.__PL ? true : ((${plInstall.toString()})())`);
  const bootState = await cdp.evalJson(`window.__PL.waitReady()`);
  const load = await cdp.evalJson(`window.__PL.loadReport()`);
  log('boot 就绪:', JSON.stringify(bootState));
  // 隔离断言：档案必须全新（档位 5 无数据、无 turbo 记忆），否则测量条件被历史会话污染
  const isolation = await cdp.evalJson(`JSON.stringify({ slot5: !!localStorage.getItem('sdt-base-v2-slot5'), turbo: localStorage.getItem('sdt-agent-turbo') })`);
  if (isolation.slot5 || isolation.turbo != null) {
    throw new Error('浏览器档案隔离破坏（slot5=' + isolation.slot5 + ', turbo=' + isolation.turbo + '），中止不测');
  }
  fs.writeFileSync(path.join(OUT_DIR, 's0-load.json'), JSON.stringify({ scenario: 'load', capturedAt: new Date().toISOString(), bootState, browser: env, ...load }, null, 2));

  const plan = new Set(ONLY);
  const want = n => !plan.size || plan.has(n);

  // —— S1 标题页 ——
  if (want('title')) {
    await sampleScene(cdp, 'title', { page: '标题页', note: 'boot 完成后的静止标题画面' });
  }

  // —— S2 选档页 ——
  if (want('slot') || want('hub') || want('prep') || want('photo') || want('settings') || want('run')) {
    const sg = await cdp.evalJson(`window.__PL.act({ type: 'sys', name: 'startGame' })`);
    log('startGame:', JSON.stringify(sg));
    await settleState(cdp, null, 15000);
    log('选档前状态:', JSON.stringify(await cdp.evalJson(`window.__PL.stateSummary()`)));
    if (process.env.PLF_DEBUG_STORAGE) {
      log('storage 现况:', await cdp.evalJson(`JSON.stringify(Object.keys(localStorage).filter(k => k.includes('sdt')).map(k => [k, (localStorage.getItem(k) || '').length]))`));
    }
    if (want('slot')) {
      await sampleScene(cdp, 'slotSelect', { page: '选档页', note: '五档位卡片页（全部空档案）' });
    }
    let entered = false;
    for (let attempt = 0; attempt < 5 && !entered; attempt++) {
      const st = await cdp.evalJson(`window.__PL.stateSummary()`);
      if (st.phase === 'hub') { entered = true; break; }
      if (st.phase === 'title') {
        await cdp.evalJson(`window.__PL.act({ type: 'sys', name: 'startGame' })`);
        await new Promise(r => setTimeout(r, 1000));
      }
      const r = await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'newSlot', params: { slot: '5' } })`);
      log(`newSlot(5) 第${attempt + 1}次:`, JSON.stringify(r));
      await settleState(cdp, null, 20000);
      const st2 = await cdp.evalJson(`window.__PL.stateSummary()`);
      if (st2.phase === 'hub') entered = true;
      else if (attempt === 4) {
        log('!! 无法进入档位 5，当前状态:', JSON.stringify(st2));
        const dump = await cdp.evalSoft(`JSON.stringify({
          acts: window.SDT.Agent.observe().ui.actions.map(a => a.name + '|' + JSON.stringify(a.params || {})).slice(0, 20),
          ovTitle: (document.getElementById('ovTitle')?.textContent || '').slice(0, 40),
          ovHead: (document.getElementById('ovBody')?.innerHTML || '').slice(0, 200),
        })`);
        log('!! 现场转储:', dump);
      }
    }
    if (!entered) throw new Error('进入档位 5 失败，中止（后续场景依赖基地）');
  }

  // —— S3 基地六页签 ——
  if (want('hub')) {
    for (const tab of ['deploy', 'stash', 'shop', 'upgrade', 'classes', 'ach']) {
      await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'hubTab', params: { tab: '${tab}' } })`);
      await settleState(cdp, ['hub']);
      await sampleScene(cdp, `hub-${tab}`, { page: '基地·' + tab, slot: 5, note: '空档案基地' });
    }
  }

  // —— S4 出发整备页 ——
  if (want('prep')) {
    await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'hubTab', params: { tab: 'deploy' } })`);
    await settleState(cdp, ['hub']);
    await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'deploy' })`);
    await settleState(cdp, null, 15000);
    await sampleScene(cdp, 'prep', { page: '出发整备页', slot: 5 });
    await cdp.evalJson(`window.__PL.uiClick('depBack') || window.__PL.esc()`);
    await settleState(cdp, ['hub']);
  }

  // —— S5 照相馆 ——
  if (want('photo')) {
    await cdp.evalJson(`window.__PL.pressAlt('7')`);
    await settleState(cdp, null, 15000);
    await new Promise(r => setTimeout(r, 800));   // 等目录渲染 + 预热解码启动
    const info = await cdp.evalJson(`window.__PL.photoInfo()`);
    log('照相馆:', JSON.stringify(info));
    if (info.items > 0) {
      await sampleScene(cdp, 'photo-catalog', { page: '照相馆·目录静止（首屏窗口挂载）', photos: info.items, catalogCount: info.catalogCount });
      await sampleScene(cdp, 'photo-scroll', { page: '照相馆·目录连续滚动（线性滚完全程，沿途窗口挂载追批）', photos: info.items, catalogCount: info.catalogCount, scroll: info.scroll }, { mode: 'scroll' });
      const after = await cdp.evalJson(`window.__PL.photoInfo()`);
      log('滚动后照相馆:', JSON.stringify(after));
      const scEntry = results.get('photo-scroll');
      if (scEntry) scEntry.conditions.mountedAfterScroll = after.items;
    } else {
      log('!! 照相馆未打开（登记未测）');
      record('photo-catalog', { page: '照相馆', error: '未能打开或无条目' }, { skipped: true });
    }
    await cdp.evalJson(`window.__PL.uiClick('closeCardPage') || window.__PL.esc()`);
    await new Promise(r => setTimeout(r, 700));
    await cdp.evalSoft(`window.__PL.esc()`);
    await settleState(cdp, null, 10000);
  }

  // —— S6 设置页 ——
  if (want('settings')) {
    await cdp.evalJson(`window.__PL.pressAlt('0')`);
    await settleState(cdp, null, 15000);
    const isSettings = await cdp.evalJson(`!!document.querySelector('.settings-page')`);
    if (isSettings) {
      await sampleScene(cdp, 'settings', { page: '设置页' });
      await cdp.evalJson(`window.__PL.uiClick('closeSettings') || window.__PL.esc()`);
      await settleState(cdp, null, 10000);
    } else {
      log('!! 设置页未打开（登记未测）');
      record('settings', { page: '设置页', error: '未能打开' }, { skipped: true });
      await cdp.evalSoft(`window.__PL.esc()`);
    }
  }

  // —— S7 对局：地图 1-4 层 + 普通战斗 + BOSS 战 ——
  // 架构：推进逻辑全部在页内（__PL.runDrive/driveBoss，一次 evaluate 自驱到底），
  // Node 只在「测量点」介入采样，消除 Node↔页面往返竞态。
  const runTrace = { layersMeasured: [], battleNormal: 0, boss: false, events: [], lastRun: null };
  if (want('run')) {
    // 前置：确保在基地（设置页关闭后可能落在标题/其他页）
    for (let i = 0; i < 8; i++) {
      const st = await cdp.evalSoft(`window.__PL.stateSummary()`);
      if (st?.phase === 'hub') break;
      if (st?.phase === 'title' || st?.phase === 'idle') {
        await cdp.evalSoft(`window.__PL.act({ type: 'sys', name: 'startGame' })`);
        await new Promise(r => setTimeout(r, 1000));
        const pick = await cdp.evalSoft(`window.__PL.observe()`);
        const enter = (pick?.actions || []).find(a => a.name === 'enterSlot' && a.params?.slot === '5');
        if (enter) { await cdp.evalSoft(`window.__PL.act(enter)`); }
        else {
          const nw = (pick?.actions || []).find(a => a.name === 'newSlot' && a.params?.slot === '5');
          if (nw) await cdp.evalSoft(`window.__PL.act(nw)`);
        }
        await new Promise(r => setTimeout(r, 1500));
        continue;
      }
      await cdp.evalSoft(`window.__PL.esc()`);
      await new Promise(r => setTimeout(r, 600));
    }
    await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'hubTab', params: { tab: 'deploy' } })`);
    await settleState(cdp, ['hub']);
    await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'deploy' })`);
    await settleState(cdp, null, 15000);
    await cdp.evalJson(`window.__PL.act({ type: 'ui', name: 'confirmDeploy' })`);
    await new Promise(r => setTimeout(r, 1200));

    let battleMeasured = 0, bossMeasured = false;
    const measuredLayers = new Set();

    for (const targetLayer of [1, 2, 3, 4]) {
      // 推进到目标层稳态；路上第一场普通战斗停下先测
      let drive = await cdp.evalJson(`window.__PL.runDrive({ targetLayer: ${targetLayer}, stopAtBattle: ${battleMeasured < 1} })`, 330000);
      log(`推进到第 ${targetLayer} 层:`, JSON.stringify(drive).slice(0, 400));
      runTrace.events.push({ at: `drive-L${targetLayer}`, stoppedAt: drive.stoppedAt, steps: drive.steps, ok: drive.ok, driveEvents: drive.events });

      // 路上停下的普通战斗：先测后打
      if (drive.stoppedAt === 'battle' && battleMeasured < 1) {
        const b = drive.battle;
        await sampleScene(cdp, 'battle-normal', {
          page: '普通战斗·战场静止（不出牌）',
          foes: b?.foes, hand: b?.hand, turn: b?.turn,
          run: drive.run && { layer: drive.run.layer, class: drive.run.class, characterId: drive.run.characterId, hp: drive.run.hp, maxHp: drive.run.maxHp },
        });
        battleMeasured++;
        runTrace.battleNormal = 1;
        drive = await cdp.evalJson(`window.__PL.runDrive({ targetLayer: ${targetLayer}, stopAtBattle: false })`, 330000);
        log(`续推进到第 ${targetLayer} 层:`, JSON.stringify({ stoppedAt: drive.stoppedAt, steps: drive.steps, ok: drive.ok, events: drive.events, run: drive.run && { layer: drive.run.layer, node: drive.run.node, state: drive.run.state } }).slice(0, 600));
      }

      if (drive.stoppedAt !== 'map-idle' || !drive.run) {
        log(`第 ${targetLayer} 层未达稳态，跳过该层测量`);
        continue;
      }
      const run = drive.run;
      runTrace.lastRun = run;
      await ensureVisible(cdp);
      await sampleScene(cdp, `map-layer${targetLayer}-idle`, {
        page: `地图第 ${targetLayer} 层·稳态（事件驱动静态帧）`,
        run: { layer: run.layer, node: run.node, class: run.class, characterId: run.characterId, hp: run.hp, maxHp: run.maxHp },
      });
      await sampleScene(cdp, `map-layer${targetLayer}-pan`, {
        page: `地图第 ${targetLayer} 层·受控平移（正弦扰动机位）`,
        run: { layer: targetLayer },
      }, { mode: 'pan' });
      measuredLayers.add(targetLayer);
      runTrace.layersMeasured = [...measuredLayers];
    }

    // —— BOSS 战（第 4 层首脑格：编组确认后测，再打完；死亡则重开一局再试，最多 3 次）——
    let bossAttempts = 0;
    while (!bossMeasured && bossAttempts < 3) {
      bossAttempts++;
      if (bossAttempts > 1 || !measuredLayers.has(4)) {
        // 重开一局并推进到第 4 层（层数采样只做一次，重开只走路）
        const walk = await cdp.evalJson(`window.__PL.runDrive({ targetLayer: 4, stopAtBattle: false })`, 330000);
        log(`BOSS 第 ${bossAttempts} 次尝试·推进:`, JSON.stringify({ stoppedAt: walk.stoppedAt, ok: walk.ok, events: walk.events }).slice(0, 300));
        runTrace.events.push({ at: `boss-walk-${bossAttempts}`, stoppedAt: walk.stoppedAt, ok: walk.ok });
        if (walk.ok === false && walk.stoppedAt !== 'map-idle') continue;
      }
      const drive = await cdp.evalJson(`window.__PL.driveBoss()`, 330000);
      log('BOSS 推进:', JSON.stringify({ stoppedAt: drive.stoppedAt, steps: drive.steps, ok: drive.ok, events: drive.events }).slice(0, 400));
      runTrace.events.push({ at: `boss-drive-${bossAttempts}`, drive: { stoppedAt: drive.stoppedAt, steps: drive.steps, ok: drive.ok, events: drive.events } });
      if (drive.stoppedAt === 'boss-battle' && drive.battle && !drive.battle.deckSel) {
        await ensureVisible(cdp);
        await sampleScene(cdp, 'battle-boss', {
          page: 'BOSS 战·战场静止（首脑，不出牌）',
          foes: drive.battle.foes, hand: drive.battle.hand, turn: drive.battle.turn,
          run: drive.run && { layer: drive.run.layer, class: drive.run.class, characterId: drive.run.characterId, hp: drive.run.hp, maxHp: drive.run.maxHp },
        });
        bossMeasured = true;
        runTrace.boss = true;
        const fight = await cdp.evalJson(`(async () => { window.SDT.Agent.setTurbo(true); const r = await window.__PL.fightWithGreedy(window.SDT.Agent); window.SDT.Agent.setTurbo(false); return r; })()`, 200000);
        log('BOSS 战斗结束:', JSON.stringify(fight));
        runTrace.events.push({ at: 'boss-fight', fight });
      } else {
        log(`!! 第 ${bossAttempts} 次未能停在 BOSS 战场稳态:`, JSON.stringify(drive.stoppedAt));
      }
    }

    log(`对局段完成：层数 [${[...measuredLayers]}]；普通战斗 ${battleMeasured} 场；BOSS ${bossMeasured ? 1 : 0}`);
    runTrace.layersMeasured = [...measuredLayers];
    runTrace.battleNormal = battleMeasured;
    runTrace.boss = bossMeasured;
  }
  fs.writeFileSync(path.join(OUT_DIR, 'run-trace.json'), JSON.stringify(runTrace, null, 2));

  // —— 落盘（每次采样后增量写，见 writeSummary；此处补 run-trace 与最终摘要输出） ——
  fs.writeFileSync(path.join(OUT_DIR, 'run-trace.json'), JSON.stringify(runTrace, null, 2));
  writeSummary();
  log('原始数据 + 汇总已写入:', OUT_DIR);
  const summary = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'summary.json'), 'utf8')).scenarios;
  console.log('\n=== 账本摘要（每场景三轮中位） ===');
  for (const s of summary) {
    console.log(`${s.scenario.padEnd(22)} rAF中位 ${String(s.rafMedianMs).padStart(6)} p95 ${String(s.rafP95Ms).padStart(6)} | draw×${String(s.drawCalls).padStart(4)} 中位 ${String(s.drawMedianMs).padStart(5)} p95 ${String(s.drawP95Ms).padStart(5)} | LT ${String(s.longTasks).padStart(3)} | 堆 ${s.heapUsedMiB}MiB`);
  }
}

const WATCHDOG_MIN = Number(argOf('max-minutes', '45'));
const watchdog = setTimeout(() => {
  console.error(`[perf-ledger] 看门狗触发（${WATCHDOG_MIN} 分钟）：写出当前已采数据并退出`);
  try { writeSummary(); } catch {}
  cleanup(2);
}, WATCHDOG_MIN * 60000);
watchdog.unref?.();
function cleanup(code) {
  try { killEdgeTree(); } catch {}
  try { edgeProc?.kill(); } catch {}
  if (serverProc && !argFlag('keep-server')) { try { serverProc.kill(); } catch {} }
  process.exit(code);
}
process.on('unhandledRejection', err => {
  console.error('[perf-ledger] 未处理拒绝（继续运行）:', err?.message || err);
});
process.on('uncaughtException', err => {
  console.error('[perf-ledger] 未捕获异常:', err?.message || err);
  try { writeSummary(); } catch {}
  cleanup(1);
});

main().then(() => {
  cleanup(0);
}).catch(err => {
  console.error('[perf-ledger] 失败:', err?.message || err);
  try { writeSummary(); } catch {}
  cleanup(1);
});
