/* 重入冻结归因实验（照相馆性能专项配套）：
 * 现象：关页后的第一次重开 first-frame 1.3~1.6s（LoAF ~1.5-2s，无脚本归因=纯样式/布局/绘制）。
 * 假设：closeLibPage 不清网格，271 张（层化）瓦片藏在隐藏弹层里，重开时整树替换/回收爆炸。
 * 方法：每轮 开→关→[可选处理]→重开，处理=关后立即清空 #overlay 子树；对比重开 first-frame。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/reopen-exp.mjs --base-url http://localhost:5330/?photoFps=1
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const argv = process.argv.slice(2);
const argOf = (name, fb) => { const i = argv.indexOf('--' + name); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fb; };
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '../../..');
const PORT = Number(argOf('port', '5330'));
const BASE_URL = argOf('base-url', `http://localhost:${PORT}/?photoFps=1`);
const CDP_PORT = Number(argOf('cdp-port', '5343'));
const ROUNDS = Number(argOf('rounds', '4'));
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[reopen-exp]', ...a);
let edgeProc = null;
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }

let seq = 0; const pending = new Map(); let ws = null;
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

// 安装 LoAF/LT 观察器
const INSTALL = `(() => {
  const P = { loafs: [], lts: [] };
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.loafs.push({ d: +e.duration.toFixed(1), n: (e.scripts||[]).length }))).observe({ type: 'long-animation-frame', buffered: false }); } catch {}
  try { new PerformanceObserver(l => l.getEntries().forEach(e => P.lts.push(+e.duration.toFixed(1)))).observe({ type: 'longtask', buffered: false }); } catch {}
  window.__exp = P; return true;
})()`;
// 开门（重开；门面已在模块表）
const OPEN = `(async () => {
  const o0 = performance.now();
  const m = await import('/src/hub/game.cardslib.js');
  m.openCardLibrary();
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  return { firstFrameMs: +(performance.now() - o0).toFixed(1), items: document.querySelectorAll('#libGrid .lib-cardwrap').length };
})()`;
// 关门 + 可选清空处理
const CLOSE_TREAT = `(async () => {
  const m = await import('/src/hub/game.cardslib.js');
  m.closeCardPageTop();
  await new Promise(r => setTimeout(r, 300));
  let cleared = false;
  if (__CLEAR__) {
    const page = document.querySelector('.card-library-page');
    if (page) { page.remove(); cleared = true; }
  }
  await new Promise(r => setTimeout(r, 400));
  const P = window.__exp;
  const out = { cleared, loafCount: P.loafs.length, loafMax: P.loafs.length ? Math.max(...P.loafs.map(l => l.d)) : 0 };
  P.loafs.length = 0; P.lts.length = 0;
  return out;
})()`.replace('__CLEAR__', String(process.env.EXP_CLEAR === '1'));
// 收本轮观察器（重开窗口内的）
const COLLECT = `(() => {
  const P = window.__exp;
  const out = { loafCount: P.loafs.length, loafMax: P.loafs.length ? Math.max(...P.loafs.map(l => l.d)) : 0, ltCount: P.lts.length };
  P.loafs.length = 0; P.lts.length = 0;
  return out;
})()`;

try {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-exp-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--hide-scrollbars', BASE_URL], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  for (let i = 0; i < 300; i++) { if ((await evalSoft(`window.SDT?.game?.state || null`)) === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  const clear = process.env.EXP_CLEAR === '1';
  log(`实验组：EXP_CLEAR=${clear ? '1（关后清空弹层子树）' : '0（对照）'}，${ROUNDS} 轮`);
  for (let i = 1; i <= ROUNDS; i++) {
    await evalJson(INSTALL);
    const open = await evalJson(OPEN);
    const cc = await evalJson(CLOSE_TREAT);
    const col = await evalJson(COLLECT);
    log(`轮${i}: 重开首帧 ${open.firstFrameMs}ms（挂载 ${open.items}）· 重开窗 LoAF ${col.loafCount}个/最大${col.loafMax}ms · LT ${col.ltCount} · 关后清理=${cc.cleared}`);
  }
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc);
  setTimeout(() => process.exit(0), 300);
}
