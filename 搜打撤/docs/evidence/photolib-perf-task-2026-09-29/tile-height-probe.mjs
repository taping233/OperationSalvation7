/* 瓦片高度分布探针（照相馆性能专项配套）：滚完全程后统计 .lib-item 真实高度分布，
 * 判断「CVA 占位喂实测行高」能否做到零增长（高度统一→喂单一值；两档→喂众数）。
 * 用法：node docs/evidence/photolib-perf-task-2026-09-29/tile-height-probe.mjs
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
const WT = argOf('wt', REPO);
const PORT = Number(argOf('port', '5334'));
const BASE_URL = argOf('base-url', `http://localhost:${PORT}/`);
const CDP_PORT = Number(argOf('cdp-port', '5335'));
const TMP = path.join(os.tmpdir(), 'photolib-open-probe');
fs.mkdirSync(TMP, { recursive: true });
const log = (...a) => console.log('[height-probe]', ...a);

let serverProc = null, edgeProc = null;
async function reachable(url) { try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; } catch { return false; } }
async function ensureServer() {
  if (await reachable(BASE_URL)) { log('复用 dev server'); return; }
  const viteBin = path.join(REPO, 'node_modules', 'vite', 'bin', 'vite.js');
  const cfg = path.join(TMP, 'vite.config.height.mjs');
  const wtFileUrl = pathToFileURL(path.join(WT, 'vite.config.js')).href;
  fs.writeFileSync(cfg, `import base from ${JSON.stringify(wtFileUrl)};\nexport default { ...base, cacheDir: ${JSON.stringify(path.join(TMP, 'vite-cache').replace(/\\/g, '/'))} };\n`);
  serverProc = spawn(process.execPath, [viteBin, '--config', cfg, '--port', String(PORT), '--strictPort'], { cwd: WT });
  const errChunks = [];
  serverProc.stderr?.on('data', d => errChunks.push(String(d)));
  serverProc.stdout?.on('data', () => {});
  serverProc.on('exit', code => log('dev server 进程退出 code=' + code, errChunks.join('').slice(-600)));
  for (let i = 0; i < 100; i++) { if (await reachable(BASE_URL)) { log('dev server 就绪'); return; } await new Promise(r => setTimeout(r, 300)); }
  throw new Error('dev server 启动失败');
}
function killTree(p) { if (!p?.pid) return; try { execFileSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {} }

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
  async evalJson(expression, timeoutMs = 45000) {
    const work = (async () => {
      const r = await this.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error('页面执行失败: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text || '').slice(0, 400));
      return r.result.value;
    })();
    let timer = null;
    try { return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('eval 超时')), timeoutMs); })]); }
    finally { clearTimeout(timer); }
  }
  async evalSoft(expression) { try { return await this.evalJson(expression); } catch { return null; } }
}

const MEASURE = `(async () => {
  const m = await import('/src/hub/game.cardslib.js');
  m.openCardLibrary();
  await new Promise(r => setTimeout(r, 400));
  const grid = document.getElementById('libGrid');
  if (!grid) return { error: 'no grid' };
  const firstTile = grid.querySelector('.lib-item');
  const farTile = grid.querySelectorAll('.lib-item')[40] || null;
  const diag = {
    varOnGrid: grid.style.getPropertyValue('--lib-tile-h') || null,
    firstTileH: firstTile?.offsetHeight ?? null,
    farTileComputedCIS: farTile ? getComputedStyle(farTile).containIntrinsicSize : null,
    mounted: grid.querySelectorAll('.lib-cardwrap').length,
  };
  for (let i = 0; i < 80; i++) {
    grid.scrollTop = grid.scrollHeight;
    await new Promise(r => setTimeout(r, 60));
    if (!grid.querySelector('.lib-mount-sentinel')) break;
  }
  await new Promise(r => setTimeout(r, 200));
  const items = [...grid.querySelectorAll('.lib-item')];
  const heights = items.map(n => n.offsetHeight);
  const hist = {};
  heights.forEach(h => hist[h] = (hist[h] || 0) + 1);
  const captionHeights = [...new Set(items.map(n => n.querySelector('.studio-photo-caption')?.offsetHeight || 0))].sort((a, b) => a - b);
  const tops = [...new Set(items.slice(0, 12).map(n => n.offsetTop))].sort((a, b) => a - b);
  const cols = items.filter(n => n.offsetTop === tops[0]).length;
  const row2 = items.find(n => n.offsetTop === tops[1]);
  return {
    diag,
    items: items.length,
    gridW: grid.clientWidth, gridH: grid.clientHeight,
    cols, rowHeight: row2 ? row2.offsetTop - items[0].offsetTop : null,
    heightMin: Math.min(...heights), heightMax: Math.max(...heights),
    hist, captionHeights,
    scrollHeight: grid.scrollHeight,
  };
})()`;

try {
  // 看门狗：4 分钟跑不完就强退（此前曾因 vite 静默死亡卡在等 boot）
  const watchdog = setTimeout(() => { log('!! 看门狗超时（240s），强退'); process.exit(2); }, 240_000);
  watchdog.unref?.();
  await ensureServer();
  const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  edgeProc = spawn(edge, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${path.join(TMP, 'edge-h-' + Date.now())}`,
    '--no-first-run', '--no-default-browser-check', '--window-size=1920,1080', '--hide-scrollbars', BASE_URL], { stdio: 'ignore' });
  const cdp = new Cdp();
  await cdp.connect();
  for (let i = 0; i < 300; i++) {
    const s = await cdp.evalSoft(`window.SDT?.game?.state || null`);
    if (s === 'title') break;
    await new Promise(r => setTimeout(r, 300));
  }
  const out = await cdp.evalJson(MEASURE);
  log('结果:', JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(SCRIPT_DIR, 'tile-heights.json'), JSON.stringify(out, null, 2));
} finally {
  killTree(edgeProc); killTree(serverProc);
}
