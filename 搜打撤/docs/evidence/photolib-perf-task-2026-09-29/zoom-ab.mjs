/* 点击放大 A/B 探针（照相馆二期·点击卡顿归因）：开页 → 真实点击第 5 张照片放大 →
 * 采 2s LoAF/LT/帧间隔 → 关闭 → 注入「去毛玻璃」CSS 重复一轮 → 对比。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/zoom-ab.mjs --base-url http://localhost:8138/
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
const CDP_PORT = Number(argOf('cdp-port', '5357'));
const HEADED = !argv.includes('--headless');
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[zoom-ab]', ...a);
let edgeProc = null, ws = null, seq = 0; const pending = new Map();
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }
function send(method, params = {}) {
  const id = ++seq;
  return new Promise((resolve, reject) => {
    pending.set(id, msg => msg.error ? reject(new Error(method + ': ' + msg.error.message)) : resolve(msg.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
}
async function evalJson(expression, timeoutMs = 40000) {
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

const ROUND = `(async (NOBLUR) => {
  const grid = document.getElementById('libGrid');
  const target = grid.querySelectorAll('.lib-cardwrap')[4];
  if (!target) return { error: 'no tile' };
  // 安装观察器
  const P = { loaf: [], lt: [], gaps: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.loaf.push({ d: +e.duration.toFixed(1), render: +(e.renderTime ? e.renderTime - e.startTime : 0).toFixed(1) }))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.lt.push(+e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: false }); } catch {}
  let prev = performance.now();
  const raf = now => { P.gaps.push(now - prev); prev = now; if (now - rafT0 < 2000) requestAnimationFrame(raf); };
  const rafT0 = prev;
  requestAnimationFrame(raf);
  if (NOBLUR) {
    const s = document.createElement('style');
    s.id = '__zb'; s.textContent = '#cardZoom .n{backdrop-filter:none!important;} #cardZoom .cz-backdrop{backdrop-filter:none!important;}';
    document.head.appendChild(s);
  }
  await new Promise(r => setTimeout(r, 100));
  const clickT0 = performance.now();
  target.click();                       // 真实 libInspect 链路（含 FLIP/放大过渡）
  await new Promise(r => setTimeout(r, 2200));
  const opened = !!document.getElementById('cardZoom');
  const firstFrame = P.gaps.length ? Math.max(...P.gaps.slice(0, 8)) : null;
  const g = [...P.gaps].sort((a, b) => a - b);
  document.getElementById('__zb')?.remove();
  // 关闭放大
  document.getElementById('cardZoom')?.querySelector('.cz-backdrop')?.click();
  await new Promise(r => setTimeout(r, 700));
  return {
    opened,
    loafCount: P.loaf.length,
    loafMax: P.loaf.length ? Math.max(...P.loaf.map(l => l.d)) : 0,
    loafRenderMax: P.loaf.length ? Math.max(...P.loaf.map(l => l.render)) : 0,
    ltCount: P.lt.length, ltMax: P.lt.length ? Math.max(...P.lt) : 0,
    med: g.length ? +g[Math.floor(g.length / 2)].toFixed(1) : null,
    p95: g.length ? +g[Math.max(0, Math.ceil(g.length * 0.95) - 1)].toFixed(1) : null,
    worstEarlyFrame: firstFrame != null ? +firstFrame.toFixed(1) : null,
  };
})`;
try {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, [
    ...(HEADED ? [] : ['--headless=new']),
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-zoom-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', BASE_URL,
  ], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http://localhost')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  await send('Page.enable');
  if (HEADED) await send('Page.bringToFront').catch(() => {});
  for (let i = 0; i < 300; i++) { if ((await evalSoft(`window.SDT?.game?.state || null`)) === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  await evalJson(`(async () => { const m = await import('/src/hub/game.cardslib.js'); m.openCardLibrary(); await new Promise(r => setTimeout(r, 900)); return true; })()`);
  const results = {};
  for (const [name, noBlur] of [['with-blur', false], ['no-blur', true]]) {
    // 每轮用全新函数体（NOBLUR 注入）
    const out = await evalJson(`(${ROUND})(true)` === '' ? '' : `(${ROUND.toString().replace('(async (NOBLUR) => {', '(async () => {').replace(/NOBLUR/g, String(noBlur))})()`, 30000);
    results[name] = out;
    log(`${name.padEnd(9)} LoAF ${out.loafCount}个/最大${out.loafMax}ms(renderMax ${out.loafRenderMax}) LT ${out.ltCount}/${out.ltMax}ms 帧 med/p95 ${out.med}/${out.p95} 首段最差帧 ${out.worstEarlyFrame} opened=${out.opened}`);
  }
  fs.writeFileSync(path.join(SCRIPT_DIR, 'zoom-ab.json'), JSON.stringify(results, null, 1));
  log('已写 zoom-ab.json');
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc);
  setTimeout(() => process.exit(0), 300);
}
