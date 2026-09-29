/* 滚动栅格化成本 A/B 探针（照相馆性能专项配套）：
 * 同一滚动负载下逐层开关昂贵绘制层，定位每帧新露出条带的栅格化大头。
 * 变体：base / nofilter(去 img 滤镜) / noshadow(去相纸落影) / nooverlay(去纸纹+反光罩层)
 *       / noimg(不画缩略图，地板) / alllayer(整瓦片 own-layer 化)
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/scroll-ab-probe.mjs
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '../../..');
const WT = REPO;
const PORT = 5336;
const BASE_URL = `http://localhost:${PORT}/`;
const CDP_PORT = 5337;
const DURATION = 6000;
const ROUNDS = 2;
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[ab-probe]', ...a);

let serverProc = null, edgeProc = null, cdp = null;
async function reachable(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; } }
async function ensureServer() {
  if (await reachable(BASE_URL)) return;
  const viteBin = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  const cfg = path.join(TMP, 'vite.config.ab.mjs');
  const wtFileUrl = pathToFileURL(path.join(WT, 'vite.config.js')).href;
  fs.writeFileSync(cfg, `import base from ${JSON.stringify(wtFileUrl)};\nexport default { ...base, cacheDir: ${JSON.stringify(path.join(TMP, 'vite-cache').replace(/\\/g, '/'))} };\n`);
  serverProc = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(PORT), '--strictPort'], { cwd: WT });
  const errs = [];
  serverProc.stderr?.on('data', d => errs.push(String(d)));
  serverProc.on('exit', code => log('dev server 退出 code=' + code, errs.join('').slice(-400)));
  for (let i = 0; i < 100; i++) { if (await reachable(BASE_URL)) { log('dev server 就绪'); return; } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('dev server 启动失败');
}
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
// 清掉上一轮残留：占 CDP 端口的进程 + 绑定本探针临时档案的 Edge
function killStale() {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 30000 });
    for (const line of out.split('\n')) {
      if (line.includes(`:${CDP_PORT} `) && /LISTENING/i.test(line)) {
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid) { log('清理占用 CDP 口的残留 pid=' + pid); try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
      }
    }
  } catch {}
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-ab-*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', timeout: 30000 });
  } catch {}
}

class Cdp {
  constructor() { this.seq = 0; this.pending = new Map(); this.ws = null; }
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
    if (!page) throw new Error('Edge CDP 不可达');
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws 失败')); });
    this.ws.onerror = () => log('!! ws 错误');
    this.ws.onclose = () => log('!! ws 关闭');
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
  async evalJson(expression, timeoutMs = 60000) {
    const work = (async () => {
      const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 400));
      return r.result.value;
    })();
    let timer = null;
    try { return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval 超时')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  }
  async evalSoft(e) { try { return await this.evalJson(e, 5000); } catch { return null; } }
}

// 页面内：预滚全程（触发全部挂载），确保各变体挂载成本不混入采样
const PREP = `(async () => {
  const m = await import('/src/hub/game.cardslib.js');
  m.openCardLibrary();
  await new Promise(r => setTimeout(r, 500));
  const grid = document.getElementById('libGrid');
  if (!grid) return { error: 'no grid' };
  for (let i = 0; i < 120; i++) {
    grid.scrollTop = grid.scrollHeight;
    await new Promise(r => setTimeout(r, 50));
    if (!grid.querySelector('.lib-mount-sentinel')) break;
  }
  grid.scrollTop = 0;
  await new Promise(r => setTimeout(r, 400));
  return { items: grid.querySelectorAll('.lib-item').length, ready: true };
})()`;

const RUN_VARIANT = `(async () => {
  const grid = document.getElementById('libGrid');
  // —— 变体开关（CDP 注入的覆盖样式） ——
  document.getElementById('__abStyle')?.remove();
  const css = __AB_CSS;
  if (css) {
    const s = document.createElement('style');
    s.id = '__abStyle';
    s.textContent = css;
    document.head.appendChild(s);
  }
  await new Promise(r => setTimeout(r, 300));
  const gaps = [];
  let previous = performance.now();
  const t0 = previous;
  const maxScroll = () => grid.scrollHeight - grid.clientHeight;
  await new Promise(done => {
    const finish = extra => { if (finished) return; finished = true; done(extra); };
    let finished = false;
    const tick = now => {
      grid.scrollTop = ((now - t0) / ${DURATION}) * maxScroll();
      gaps.push(now - previous);
      previous = now;
      if (now - t0 < ${DURATION}) requestAnimationFrame(tick);
      else finish(null);
    };
    requestAnimationFrame(tick);
    setTimeout(() => finish({ forcedTimeout: true, frames: gaps.length, elapsed: +(performance.now() - t0).toFixed(0) }), 30000);
  });
  document.getElementById('__abStyle')?.remove();
  const sorted = [...gaps].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)];
  return { med: +med.toFixed(1), p95: +p95.toFixed(1), frames: gaps.length };
})()`;

const VARIANTS = [
  ['base', ''],
  ['nofilter', 'body #libGrid .studio-photo-art img{filter:none!important;}'],
  ['noshadow', 'body #libGrid .studio-photo-paper{box-shadow:none!important;} body #libGrid .studio-photo-art{box-shadow:none!important;}'],
  ['nooverlay', 'body #libGrid .studio-photo-art::before,body #libGrid .studio-photo-art::after,body #libGrid .studio-photo-paper::before,body #libGrid .studio-photo-paper::after{display:none!important;}'],
  ['noimg', 'body #libGrid .studio-photo-art img{display:none!important;}'],
  ['alllayer', 'body #libGrid .lib-item{will-change:transform;}'],
];

try {
  killStale();
  await ensureServer();
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-ab-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--hide-scrollbars', BASE_URL], { stdio: 'ignore' });
  cdp = new Cdp();
  await cdp.connect();
  for (let i = 0; i < 300; i++) {
    const s = await cdp.evalSoft(`window.SDT?.game?.state || null`);
    if (s === 'title') break;
    await new Promise(r => setTimeout(r, 300));
  }
  const prep = await cdp.evalJson(PREP);
  log('预滚完成:', JSON.stringify(prep));
  const results = {};
  const watchdog = setTimeout(() => { log('!! 看门狗超时（300s）强退'); fs.writeFileSync(path.join(SCRIPT_DIR, 'scroll-ab.json'), JSON.stringify(results, null, 2)); process.exit(2); }, 300_000);
  for (const [name, css] of VARIANTS) {
    const rounds = [];
    try {
      for (let r = 0; r < ROUNDS; r++) {
        const out = await cdp.evalJson(RUN_VARIANT.replace('__AB_CSS', JSON.stringify(css)));
        rounds.push(out);
        await cdp.evalJson(`document.getElementById('libGrid').scrollTop = 0; new Promise(r2 => setTimeout(r2, 500)).then(() => true)`);
      }
    } catch (e) { log(`变体 ${name} 失败: ${String(e.message).slice(0, 200)}`); }
    if (!rounds.length) { results[name] = { error: true }; continue; }
    const med = rounds.map(x => x.med).sort((a, b) => a - b)[Math.floor(rounds.length / 2)];
    results[name] = { median: med, rounds };
    log(`${name.padEnd(9)} rAF中位 ${med}ms  逐轮 ${rounds.map(x => x.med).join('/')}  p95 ${rounds[rounds.length - 1].p95}`);
    fs.writeFileSync(path.join(SCRIPT_DIR, 'scroll-ab.json'), JSON.stringify(results, null, 2));
  }
  clearTimeout(watchdog);
  fs.writeFileSync(path.join(SCRIPT_DIR, 'scroll-ab.json'), JSON.stringify(results, null, 2));
  log('已写入 scroll-ab.json');
} catch (e) {
  log('!! 探针失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { cdp?.ws?.close(); } catch {}
  killTree(edgeProc); killTree(serverProc);
  setTimeout(() => process.exit(0), 300);   // 给 stderr/stdout 留刷写时间，防静默吞错
}
