/* 照相馆「打开耗时」专项探针（照相馆性能专项 docs/PHOTOLIB-PERF-TASK-2026-09-29.md 配套工具）。
 * 口径：dev server（Vite DEV）+ ?photoFps=1；标题态开门（openCardLibrary 对 title 放行）。
 * 每轮量：门面动态 import（仅冷启第一轮含）→ openCardLibrary() 同步段 → 双 rAF 首帧 → 打开窗口 LoAF/LT。
 * 另收游戏自带 [photo-fps] render-sync 控制台输出作交叉验证。
 * 用法（仓库 搜打撤/ 下）：
 *   node docs/evidence/photolib-perf-task-2026-09-29/open-probe.mjs --rounds 5 --out open-baseline.json
 *   可选 --base-url http://localhost:5332 复用已在跑 server；--port/--cdp-port/--headed
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const argOf = (name, fb) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fb; };
const argFlag = name => argv.includes('--' + name);

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '../../..');            // 搜打撤/
const WT = argOf('wt', REPO);
const PORT = Number(argOf('port', '5332'));
const BASE_URL = argOf('base-url', `http://localhost:${PORT}/`);
const CDP_PORT = Number(argOf('cdp-port', '5333'));
const ROUNDS = Number(argOf('rounds', '5'));
const OUT = path.resolve(SCRIPT_DIR, argOf('out', 'open-baseline.json'));
const EDGE_CANDIDATES = [
  argOf('edge', ''),
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
].filter(Boolean);
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
const RUN_TAG = `${process.pid}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
const UDD = path.join(TMP, 'edge-profile-' + RUN_TAG);
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[open-probe]', ...a);

let serverProc = null, edgeProc = null;
async function reachable(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; }
}
async function ensureServer() {
  if (await reachable(BASE_URL)) { log('复用已在跑 dev server:', BASE_URL); return; }
  const viteBin = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  const cacheDir = path.join(TMP, 'vite-cache').replace(/\\/g, '/');
  const cfg = path.join(TMP, 'vite.config.mjs');
  const wtFileUrl = pathToFileURL(path.join(WT, 'vite.config.js')).href;
  fs.writeFileSync(cfg, `import base from ${JSON.stringify(wtFileUrl)};\nexport default { ...base, cacheDir: ${JSON.stringify(cacheDir)} };\n`);
  log('自起 dev server:', WT);
  serverProc = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(PORT), '--strictPort'], { cwd: WT, stdio: 'ignore' });
  serverProc.on('exit', code => { log('dev server 进程退出 code=' + code); if (!serverProc.__ok) serverProc.__fail = true; });
  for (let i = 0; i < 100; i++) { if (await reachable(BASE_URL)) { log('dev server 就绪'); return; } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('dev server 启动失败（端口 ' + PORT + '）');
}
function killCdpPortHolder() {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 30000 });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(`:${CDP_PORT} `) && /LISTENING/i.test(line)) {
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid) pids.add(pid);
      }
    }
    for (const pid of pids) { try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
  } catch {}
}
function killTree(proc) { if (!proc?.pid) return; try { execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }

class Cdp {
  constructor() { this.seq = 0; this.pending = new Map(); this.events = []; this.ws = null; }
  async connect() {
    let page = null;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
        if (r.ok) {
          const list = await r.json();
          page = list.find(t => t.type === 'page' && (t.url === 'about:blank' || t.url.startsWith('http://localhost'))) || list.find(t => t.type === 'page');
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
      else if (msg.method) this.events.push(msg);
    };
  }
  send(method, params = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.pending.set(id, msg => msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result));
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  async evalJson(expression, timeoutMs = 45000) {
    const work = (async () => {
      const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 500));
      return r.result.value;
    })();
    let timer = null;
    try {
      return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('页面执行超时: ' + expression.slice(0, 120))), timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }
  async evalSoft(expression, timeoutMs = 45000) {
    try { return await this.evalJson(expression, timeoutMs); } catch { return null; }
  }
  async waitBoot() {
    for (let i = 0; i < 300; i++) {
      const s = await this.evalSoft(`window.SDT?.game?.state || null`, 5000);
      if (s === 'title') return true;
      await new Promise(r => setTimeout(r, 300));
    }
    throw new Error('boot 未就绪（180s 内未到 title）');
  }
}
const median = arr => { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(2); };

// 页面内：装观察器（每轮开关一次）
const INSTALL = `(() => {
  const P = { loafs: [], lts: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.loafs.push({ d: +e.duration.toFixed(1), scripts: (e.scripts||[]).slice(0,3).map(s => [s.invoker, +s.duration.toFixed(1)]) }))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.lts.push(+e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: false }); } catch {}
  window.__openProbe = P; return true;
})()`;
// 页面内：开门计时（冷启第一轮含门面动态 import）
const OPEN = `(async () => {
  const P = window.__openProbe;
  const t0 = performance.now();
  const m = await import('/src/hub/game.cardslib.js');
  const importMs = +(performance.now() - t0).toFixed(1);
  const o0 = performance.now();
  m.openCardLibrary();
  const syncMs = +(performance.now() - o0).toFixed(1);
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const firstFrameMs = +(performance.now() - o0).toFixed(1);
  return { importMs, syncMs, firstFrameMs, items: document.querySelectorAll('#libGrid .lib-item').length, state: window.SDT?.game?.state };
})()`;
// 页面内：收观察器 + 关门
const COLLECT_CLOSE = `(async () => {
  const P = window.__openProbe;
  await new Promise(r => setTimeout(r, 500));
  const out = { loafs: P.loafs, lts: P.lts };
  const m = await import('/src/hub/game.cardslib.js');
  m.closeCardPageTop?.();
  await new Promise(r => setTimeout(r, 600));
  out.stateAfterClose = window.SDT?.game?.state;
  out.cardlibOpenClass = document.body.classList.contains('cardlib-open');
  return out;
})()`;

const results = [];
try {
  await ensureServer();
  killCdpPortHolder();
  const edge = EDGE_CANDIDATES.find(p => fs.existsSync(p));
  if (!edge) throw new Error('找不到 Edge（msedge.exe）');
  edgeProc = spawn(edge, [
    ...(argFlag('headed') ? [] : ['--headless=new']),
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${UDD}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1920,1080', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    `${BASE_URL.replace(/\/$/, '')}/?photoFps=1`,
  ], { stdio: 'ignore' });
  const cdp = new Cdp();
  await cdp.connect();
  await cdp.send('Runtime.enable');
  await cdp.waitBoot();
  log('boot 就绪（title），开始', ROUNDS, '轮');
  for (let i = 1; i <= ROUNDS; i++) {
    await cdp.evalJson(INSTALL);
    const open = await cdp.evalJson(OPEN);
    const cc = await cdp.evalJson(COLLECT_CLOSE);
    // 游戏自带探针的 render-sync（本轮窗口内的 console 输出）
    const photoFpsLogs = cdp.events
      .filter(e => e.method === 'Runtime.consoleAPICalled' && e.params.type === 'info')
      .map(e => e.params.args.map(a => a.value ?? '').join(''))
      .filter(t => t.includes('[photo-fps]')).slice(-2);
    const round = { round: i, cold: i === 1, ...open, loafCount: cc.loafs.length, loafMax: cc.loafs.length ? +Math.max(...cc.loafs.map(l => l.d)).toFixed(1) : 0, loafScripts: cc.loafs.flatMap(l => l.scripts).sort((a, b) => b[1] - a[1]).slice(0, 3), ltCount: cc.lts.length, stateAfterClose: cc.stateAfterClose, cardlibOpenClass: cc.cardlibOpenClass, photoFpsLogs };
    results.push(round);
    log(`轮${i}${round.cold ? '(冷启)' : '(热重开)'}: import ${open.importMs}ms · open同步 ${open.syncMs}ms · 双rAF首帧 ${open.firstFrameMs}ms · LoAF ${round.loafCount}个/最大${round.loafMax}ms · LT ${round.ltCount} · 关闭后 state=${cc.stateAfterClose} 残留类=${cc.cardlibOpenClass}`);
    cdp.events.length = 0;
  }
  const warm = results.filter(r => !r.cold);
  const summary = {
    capturedAt: new Date().toISOString(),
    baseUrl: BASE_URL, rounds: ROUNDS,
    cold: results[0] || null,
    warmMedian: { syncMs: median(warm.map(r => r.syncMs)), firstFrameMs: median(warm.map(r => r.firstFrameMs)) },
    warmLoafCountMax: warm.length ? Math.max(...warm.map(r => r.loafCount)) : null,
  };
  fs.writeFileSync(OUT, JSON.stringify({ summary, rounds: results }, null, 2));
  log('摘要:', JSON.stringify(summary));
  log('已写入:', OUT);
} finally {
  killTree(edgeProc); killTree(serverProc);
}
