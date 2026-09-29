/* 真人滚动口径探针（照相馆性能专项二期）：
 * 之前账本口径=程序化线性 scrollTop（无鼠标事件），老板真人体感仍卡。
 * 本探针补真实交互口径：滚轮式步进滚动 + 鼠标悬停网格（合成 mousemove/mouseover，
 * 触发真实 hover CSS 与 UI._hoverHandler→setLibSelection→预览重建链），有头窗口。
 * 变体：--mouse 1/0 隔离 hover 链路贡献；--headless 对照无头。
 * 采样：rAF 间隔 / LoAF（含 renderTime/styleLayout 细分与脚本归因）/ 预览重建计数（MutationObserver）。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/human-scroll-probe.mjs --base-url http://localhost:8138/ --mouse 1
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const argOf = (name, fb) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fb; };
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = argOf('base-url', 'http://localhost:8138/');
const CDP_PORT = Number(argOf('cdp-port', '5347'));
const DURATION = Number(argOf('duration', '10000'));
const USE_MOUSE = argOf('mouse', '1') === '1';
const HEADED = !argv.includes('--headless');
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[human-scroll]', ...a);
let edgeProc = null, ws = null, seq = 0; const pending = new Map();
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
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
    if (r.exceptionDetails) throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || '').slice(0, 300));
    return r.result.value;
  })();
  let timer = null;
  try { return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval 超时')), timeoutMs); })]); }
  finally { clearTimeout(timer); }
}
async function evalSoft(e) { try { return await evalJson(e, 8000); } catch { return null; } }

// 安装采样器：rAF gaps + LoAF 细分 + 预览重建计数
const INSTALL = `(async () => {
  const P = { gaps: [], loaf: [], lt: [], previewRebuilds: 0 };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.loaf.push({
    d: +e.duration.toFixed(1),
    render: +(e.renderTime ? e.renderTime - e.startTime : 0).toFixed(1),
    styleLayout: +(e.styleLayoutStart ? e.startTime + e.duration - e.styleLayoutStart : 0).toFixed(1),
    scripts: (e.scripts||[]).map(s => (s.invoker||'?') + ':' + s.duration.toFixed(0)).slice(0,3),
  }))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.lt.push(+e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: false }); } catch {}
  const pv = document.getElementById('libPreview');
  if (pv && typeof MutationObserver === 'function') {
    new MutationObserver(muts => { P.previewRebuilds += muts.filter(m => m.type === 'childList' && m.addedNodes.length).length; })
      .observe(pv, { childList: true });
  }
  window.__hs = P;
  // 悬停音静音（测量环境）
  return { pvFound: !!pv };
})()`;

// 滚轮式步进 + 可选鼠标 hover 合成（在网格中心附近的卡格上移动）
const DRIVE = `(async () => {
  const P = window.__hs;
  const grid = document.getElementById('libGrid');
  const rect = grid.getBoundingClientRect();
  const mx = rect.left + rect.width * 0.35, my = rect.top + rect.height * 0.5;
  const t0 = performance.now();
  let prev = performance.now(), steps = 0;
  const fire = type => grid.dispatchEvent(new MouseEvent(type, { bubbles: true, clientX: mx, clientY: my }));
  while (performance.now() - t0 < ${DURATION}) {
    const now = performance.now();
    P.gaps.push(now - prev); prev = now;
    grid.scrollTop += 60; steps++;
    if (${USE_MOUSE}) { fire('mouseover'); fire('mousemove'); }
    await new Promise(r => setTimeout(r, 16));
  }
  return { steps, mounted: grid.querySelectorAll('.lib-cardwrap').length, scrollTop: grid.scrollTop };
})()`;

const COLLECT = `(() => {
  const P = window.__hs;
  const g = [...P.gaps].sort((a,b)=>a-b);
  const med = g.length ? +g[Math.floor(g.length/2)].toFixed(1) : null;
  const p95 = g.length ? +g[Math.max(0, Math.ceil(g.length*0.95)-1)].toFixed(1) : null;
  const top = [...P.loaf].sort((a,b)=>b.d-a.d).slice(0,5);
  return {
    frames: g.length, med, p95,
    loafCount: P.loaf.length, loafMax: P.loaf.length ? Math.max(...P.loaf.map(l=>l.d)) : 0,
    ltCount: P.lt.length, ltMax: P.lt.length ? Math.max(...P.lt) : 0,
    previewRebuilds: P.previewRebuilds,
    topLoafs: top,
  };
})()`;

try {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, [
    ...(HEADED ? [] : ['--headless=new']),
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-hs-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', BASE_URL,
  ], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  await send('Page.enable');
  await send('Page.bringToFront').catch(() => {});   // 有头窗口被遮挡会饿死 IO/rAF，置前再测
  for (let i = 0; i < 300; i++) { if ((await evalSoft(`window.SDT?.game?.state || null`)) === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  await evalJson(`(async () => { const m = await import('/src/hub/game.cardslib.js'); m.openCardLibrary(); await new Promise(r => setTimeout(r, 800)); return true; })()`);
  log(`口径：${HEADED ? '有头' : '无头'} · 鼠标hover=${USE_MOUSE ? '开' : '关'} · ${DURATION}ms 滚轮步进`);
  await evalJson(INSTALL);
  const drive = await evalJson(DRIVE, DURATION + 30000);
  const out = await evalJson(COLLECT);
  log('驱动:', JSON.stringify(drive));
  log('结果:', JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(SCRIPT_DIR, `human-scroll-${HEADED ? 'headed' : 'headless'}-mouse${USE_MOUSE ? 1 : 0}.json`), JSON.stringify(out, null, 2));
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc);
  setTimeout(() => process.exit(0), 300);
}
