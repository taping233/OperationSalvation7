/* 实页截图验收（照相馆性能专项配套）：开页 → 顶部截图 → 滚到底 → 底部截图。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/snap.mjs
 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '../../..');
const PORT = Number(process.env.SNAP_PORT || 5330);
const BASE_URL = `http://localhost:${PORT}/`;
const CDP_PORT = 5355;
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
const log = (...a) => console.log('[snap]', ...a);
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
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SCRIPT_DIR, file), Buffer.from(r.data, 'base64'));
  log('截图:', file);
}
try {
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-snap-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--hide-scrollbars', BASE_URL], { stdio: 'ignore' });
  let page = null;
  for (let i = 0; i < 80 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('ws 失败')); });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  await send('Page.enable');
  for (let i = 0; i < 300; i++) { if ((await evalSoft(`window.SDT?.game?.state || null`)) === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  await evalJson(`(async () => { const m = await import('/src/hub/game.cardslib.js'); m.openCardLibrary(); await new Promise(r => setTimeout(r, 1200)); return true; })()`);
  await shot('snap-top.png');
  await evalJson(`(async () => { const g = document.getElementById('libGrid'); for (let i = 0; i < 100; i++) { g.scrollTop = g.scrollHeight; await new Promise(r => setTimeout(r, 40)); if (!g.querySelector('.lib-mount-sentinel')) break; } await new Promise(r => setTimeout(r, 800)); return g.querySelectorAll('.lib-cardwrap').length; })()`);
  await shot('snap-bottom.png');
  log('完成');
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { ws?.close(); } catch {}
  killTree(edgeProc);
  setTimeout(() => process.exit(0), 300);
}
