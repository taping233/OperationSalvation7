/* CDP 真实输入 + Tracing 归因探针（照相馆性能专项二期）：
 * 有头窗口；用 Input.dispatchMouseEvent 派发真实 mouseWheel（合成器滚动）与 mousemove（真实 :hover），
 * 期间 Tracing 抓 devtools.timeline，聚合主线程事件类别耗时，定位滚动帧时间去向。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/trace-probe.mjs --base-url http://localhost:8138/
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
const CDP_PORT = Number(argOf('cdp-port', '5349'));
const SCROLL_MS = Number(argOf('duration', '8000'));
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[trace-probe]', ...a);
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

const events = [];
function onTracingEv(msg) { if (msg.params && msg.params.method === 'Tracing.dataCollected') events.push(...msg.params.value); }

try {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, [`--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-tr-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--autoplay-policy=no-user-gesture-required', BASE_URL], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else onTracingEv(m);
  };
  for (let i = 0; i < 300; i++) { if ((await evalSoft(`window.SDT?.game?.state || null`)) === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  await evalJson(`(async () => { const m = await import('/src/hub/game.cardslib.js'); m.openCardLibrary(); await new Promise(r => setTimeout(r, 800)); return true; })()`);
  // rAF 采样安装（Tracing 之外再留一份帧间隔证据）+ 预览重建计数
  await evalJson(`(() => {
    const P = { gaps: [], previewRebuilds: 0 }; window.__tr = P;
    let prev = 0;
    const tick = now => { if (prev) P.gaps.push(now - prev); prev = now; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const pv = document.getElementById('libPreview');
    if (pv) new MutationObserver(m => { P.previewRebuilds += m.filter(x => x.type === 'childList' && x.addedNodes.length).length; }).observe(pv, { childList: true });
    return true;
  })()`);

  await send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline.frame,v8.execute', options: 'bufferUsageReportingInterval=1000' }).catch(e => log('Tracing.start 失败:', e.message));
  log(`真实滚轮滚动 ${SCROLL_MS}ms（含真实鼠标 hover）…`);

  // 网格位置 → 鼠标先真实移过去（触发 :hover 与 mouseover 链）
  const gridBox = await evalJson(`(() => { const r = document.getElementById('libGrid').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; })()`);
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: Math.round(gridBox.x), y: Math.round(gridBox.y) });
  // 真实滚轮：每 100ms 一档 deltaY=340（一行高附近），交给合成器滚动
  const t0 = Date.now();
  while (Date.now() - t0 < SCROLL_MS) {
    await send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: Math.round(gridBox.x), y: Math.round(gridBox.y), deltaX: 0, deltaY: 340 });
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 800));
  const traceDone = new Promise(res => { pending.set(-1, res); });
  await send('Tracing.end');
  // Tracing.tracingComplete 事件兜底等待
  await Promise.race([traceDone, new Promise(r => setTimeout(r, 15000))]);

  // 聚合主线程事件
  const agg = {};
  for (const e of events) {
    if (!e.name || e.dur == null) continue;
    if (!['RunTask','FunctionCall','UpdateLayoutTree','Layout','PrePaint','UpdateLayerTree','Paint','Commit','HitTest','Rasterize','Layerize','DrawFrame','FireAnimationFrame','TimerFire','EventDispatch','RecalculateStyles','InvalidateLayout','ScheduleStyleRecalculation','AnimateInput','ThreadState::performIdleLazySweep','GCEvent','MajorGC','MinorGC'].includes(e.name)) continue;
    const k = e.name;
    agg[k] = agg[k] || { count: 0, totalMs: 0, maxMs: 0 };
    agg[k].count++; const ms = e.dur / 1000;
    agg[k].totalMs += ms; if (ms > agg[k].maxMs) agg[k].maxMs = ms;
  }
  const rows = Object.entries(agg).sort((a, b) => b[1].totalMs - a[1].totalMs);
  const tr = await evalJson(`(() => { const P = window.__tr; const g=[...P.gaps].sort((a,b)=>a-b); return { frames: g.length, med: g.length?+g[Math.floor(g.length/2)].toFixed(1):null, p95: g.length?+g[Math.max(0,Math.ceil(g.length*0.95)-1)].toFixed(1):null, max: g.length?+g[g.length-1].toFixed(1):null, previewRebuilds: P.previewRebuilds, mounted: document.querySelectorAll('#libGrid .lib-cardwrap').length }; })()`);
  log('rAF:', JSON.stringify(tr));
  log('timeline 主线程/帧聚合（totalMs 降序 top15）:');
  for (const [name, s] of rows.slice(0, 15)) log(`  ${name.padEnd(20)} total ${s.totalMs.toFixed(0).padStart(6)}ms  n=${String(s.count).padStart(5)}  max ${s.maxMs.toFixed(1)}ms`);
  fs.writeFileSync(path.join(SCRIPT_DIR, 'trace-agg.json'), JSON.stringify({ raf: tr, agg: Object.fromEntries(rows) }, null, 1));
  log('已写 trace-agg.json');
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc);
  setTimeout(() => process.exit(0), 300);
}
