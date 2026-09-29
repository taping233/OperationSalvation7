/* IO 挂载失灵行为级排查（照相馆二期临时调试）：开页 → 滚动 → 数壳/卡面 → 独立 IO 对照 */
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
const BASE_URL = process.env.DBG_URL || 'http://localhost:8137/';
const CDP_PORT = 5351;
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const proc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-dbg-' + Date.now())}`, '--no-first-run', '--window-size=1920,1080', '--hide-scrollbars', BASE_URL], { stdio: 'ignore' });
const log = (...a) => console.log('[io-debug]', ...a);
let seq = 0; const pending = new Map();
try {
  let page = null;
  for (let i = 0; i < 60 && !page; i++) {
    try { const r = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`); if (r.ok) { page = (await r.json()).find(t => t.type === 'page' && t.url.startsWith('http')); } } catch {}
    if (!page) await new Promise(r => setTimeout(r, 250));
  }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, msg => msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)); ws.send(JSON.stringify({ id, method, params })); });
  const evalJson = async (expression, timeoutMs = 25000) => {
    const r = await Promise.race([
      send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }),
      new Promise((_, rej) => setTimeout(() => rej(new Error('eval-timeout')), timeoutMs)),
    ]);
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'page error');
    return r.result.value;
  };
  for (let i = 0; i < 200; i++) { const s = await evalJson('window.SDT?.game?.state || null').catch(() => null); if (s === 'title') break; await new Promise(r => setTimeout(r, 300)); }
  log('boot:', await evalJson('window.SDT?.game?.state'), ' IO可用:', await evalJson('typeof IntersectionObserver'));
  const out = await evalJson(`(async () => {
    const m = await import('/src/hub/game.cardslib.js');
    m.openCardLibrary();
    await new Promise(r => setTimeout(r, 800));
    const grid = document.getElementById('libGrid');
    const out = { open: !!grid, shells: grid.querySelectorAll('.lib-item.lib-ph').length, mounted: grid.querySelectorAll('.lib-cardwrap').length, items: grid.querySelectorAll('.lib-item').length };
    grid.scrollTop = 3000;
    await new Promise(r => setTimeout(r, 600));
    out.afterScroll1 = { mounted: grid.querySelectorAll('.lib-cardwrap').length, shells: grid.querySelectorAll('.lib-item.lib-ph').length, scrollTop: Math.round(grid.scrollTop) };
    grid.scrollTop = 12000;
    await new Promise(r => setTimeout(r, 600));
    out.afterScroll2 = { mounted: grid.querySelectorAll('.lib-cardwrap').length, scrollTop: Math.round(grid.scrollTop) };
    out.ioWorks = await new Promise(res => {
      const el = grid.querySelector('.lib-item.lib-ph');
      if (!el) return res('no-shell');
      const io = new IntersectionObserver(es => { res('callback:' + es.map(e => e.isIntersecting).join(',')); io.disconnect(); }, { root: grid, rootMargin: '100% 0px' });
      io.observe(el);
      setTimeout(() => res('io-no-callback'), 1500);
    });
    return out;
  })()`);
  log('结果:', JSON.stringify(out));
} catch (e) {
  log('!! 失败:', String(e && e.message || e).slice(0, 300));
} finally {
  try { execFileSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {}
  setTimeout(() => process.exit(0), 300);
}
