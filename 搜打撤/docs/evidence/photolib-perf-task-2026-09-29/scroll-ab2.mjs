/* 滚动栅格化 A/B 探针 v2（照相馆性能专项配套）：
 * - 变体 CSS 经 Page.addScriptToEvaluateOnNewDocument 在导航前注入，每个变体独立导航全新文档；
 * - 采样函数逐字复刻 scripts/perf-ledger-capture.mjs 的 sample(scroll)（含 setInterval 看门狗，
 *   rAF 停摆时以 degraded 放行，绝不挂死）；滚动负载同口径（6s 线性滚完全程）。
 * 变体：base / nofilter / noshadow / nooverlay / noimg / alllayer
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/scroll-ab2.mjs
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '../../..');
const PORT = 5338;
const BASE_URL = `http://localhost:${PORT}/`;
const CDP_PORT = 5339;
const DURATION = 6000;
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[ab2]', ...a);

let serverProc = null, edgeProc = null;
async function reachable(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; } }
async function ensureServer() {
  if (await reachable(BASE_URL)) { log('复用 dev server'); return; }
  const viteBin = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  const cfg = path.join(TMP, 'vite.config.ab2.mjs');
  const wtFileUrl = pathToFileURL(path.join(REPO, 'vite.config.js')).href;
  fs.writeFileSync(cfg, `import base from ${JSON.stringify(wtFileUrl)};\nexport default { ...base, cacheDir: ${JSON.stringify(path.join(TMP, 'vite-cache').replace(/\\/g, '/'))} };\n`);
  serverProc = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(PORT), '--strictPort'], { cwd: REPO });
  const errs = [];
  serverProc.stderr?.on('data', d => errs.push(String(d)));
  serverProc.on('exit', code => log('dev server 退出 code=' + code, errs.join('').slice(-300)));
  for (let i = 0; i < 100; i++) { if (await reachable(BASE_URL)) { log('dev server 就绪'); return; } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('dev server 启动失败');
}
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
function killStale() {
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 30000 });
    for (const line of out.split('\n')) {
      if (line.includes(`:${CDP_PORT} `) && /LISTENING/i.test(line)) {
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid) { log('清理残留 CDP 口 pid=' + pid); try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
      }
    }
  } catch {}
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      `Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like '*edge-ab2-*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`], { stdio: 'ignore', timeout: 30000 });
  } catch {}
}

let seq = 0; const pending = new Map();
let ws = null;
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, msg => msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJson(expression, timeoutMs = 60000) {
  const work = (async () => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 300));
    return r.result.value;
  })();
  let timer = null;
  try { return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval 超时: ' + expression.slice(0, 80))), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function evalSoft(e) { try { return await evalJson(e, 8000); } catch { return null; } }

// 采样函数：逐字复刻 perf-ledger-capture.mjs sample() 的 scroll 分支（含看门狗）
const SAMPLE = `(async () => {
  const grid = document.getElementById('libGrid');
  if (!grid) return { error: 'no grid' };
  const duration = ${DURATION};
  const gaps = [], loaf = [];
  try { new PerformanceObserver(l => l.getEntries().forEach(e => loaf.push(+e.duration.toFixed(1)))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  const t0 = performance.now();
  let prev = 0, stopped = false, degraded = false, tickError = null;
  const rafDone = new Promise(resolve => {
    const tick = now => {
      if (stopped) return;
      try {
        if (prev) gaps.push(now - prev);
        prev = now;
        grid.scrollTop = ((now - t0) / duration) * (grid.scrollHeight - grid.clientHeight);
        if (now - t0 < duration) { requestAnimationFrame(tick); return; }
      } catch (e) { tickError = String(e && e.message || e); }
      resolve();
    };
    requestAnimationFrame(tick);
    const wall = setInterval(() => {
      if (stopped || performance.now() - t0 >= duration + 12000) { clearInterval(wall); degraded = performance.now() - t0 >= duration + 10000; resolve(); }
    }, 500);
  });
  await rafDone;
  stopped = true;
  const sorted = [...gaps].sort((a, b) => a - b);
  return {
    degraded, tickError, frames: gaps.length,
    med: sorted.length ? +sorted[Math.floor(sorted.length / 2)].toFixed(1) : null,
    p95: sorted.length ? +sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)].toFixed(1) : null,
    loafCount: loaf.length, loafMax: loaf.length ? +Math.max(...loaf).toFixed(1) : 0,
    mounted: grid.querySelectorAll('.lib-cardwrap').length,
    scrollHeight: grid.scrollHeight,
  };
})()`;

const OPEN_PAGE = `(async () => {
  const m = await import('/src/hub/game.cardslib.js');
  m.openCardLibrary();
  await new Promise(r => setTimeout(r, 600));
  return { items: document.querySelectorAll('#libGrid .lib-item').length || 0, opened: !!document.querySelector('.card-library-page') };
})()`;

const VARIANTS = [
  ['base', ''],
  ['nofilter', '#libGrid .studio-photo-art img{filter:none!important;}'],
  ['noshadow', '#libGrid .studio-photo-paper{box-shadow:none!important;} #libGrid .studio-photo-art{box-shadow:none!important;}'],
  ['nooverlay', '#libGrid .studio-photo-art::before,#libGrid .studio-photo-art::after,#libGrid .studio-photo-paper::before,#libGrid .studio-photo-paper::after{display:none!important;}'],
  ['noimg', '#libGrid .studio-photo-art img{display:none!important;}'],
  ['alllayer', '#libGrid .lib-item{will-change:transform;}'],
];

const results = {};
try {
  killStale();
  await ensureServer();
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  if (!edge) throw new Error('找不到 Edge');
  edgeProc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-ab2-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--hide-scrollbars', 'about:blank'], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (r.ok) { const list = await r.json(); page = list.find(t => t.type === 'page'); }
    } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  if (!page) throw new Error('Edge CDP 不可达');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };

  const watchdog = setTimeout(() => { log('!! 看门狗（420s）强退'); fs.writeFileSync(path.join(SCRIPT_DIR, 'scroll-ab2.json'), JSON.stringify(results, null, 2)); process.exit(2); }, 420_000);

  for (const [name, css] of VARIANTS) {
    // 每个变体：导航前注册注入脚本 → 全新文档 → 开页 → 同口径采样
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: `(function(){var s=document.createElement('style');s.textContent=${JSON.stringify(css)};document.addEventListener('DOMContentLoaded',function(){document.head&&document.head.appendChild(s);});})();`,
    }).catch(() => null);
    await send('Page.navigate', { url: BASE_URL }).catch(e => log('导航失败:', e.message));
    let booted = false;
    for (let i = 0; i < 200; i++) {
      const s = await evalSoft(`window.SDT?.game?.state || null`);
      if (s === 'title') { booted = true; break; }
      await new Promise(r => setTimeout(r, 300));
    }
    if (!booted) { results[name] = { error: 'boot 超时' }; log(name, 'boot 超时'); continue; }
    const opened = await evalJson(OPEN_PAGE, 30000);
    if (!opened.opened) { results[name] = { error: '开页失败', opened }; log(name, '开页失败'); continue; }
    const out = await evalJson(SAMPLE, 40000);
    results[name] = out;
    log(`${name.padEnd(9)} rAF中位 ${out.med}ms  p95 ${out.p95}  帧数 ${out.frames}${out.degraded ? ' (degraded!)' : ''}  LoAF ${out.loafCount}/${out.loafMax}ms  挂载 ${out.mounted}`);
    fs.writeFileSync(path.join(SCRIPT_DIR, 'scroll-ab2.json'), JSON.stringify(results, null, 2));
  }
  clearTimeout(watchdog);
  log('全部变体完成');
} catch (e) {
  log('!! 探针失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc); killTree(serverProc);
  setTimeout(() => process.exit(0), 300);
}
