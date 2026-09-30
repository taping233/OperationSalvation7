#!/usr/bin/env node
// ============================================================
// page-snapshot.mjs —— 实页计算样式快照 + A/B 对比（09-29 深夜验收分级班产物）
//
// 用途：CSS/样式类改动的前后对比验收。对固定页面集合抓关键元素计算样式白名单，
//       生成 JSON 基线；改后复跑与基线对比，输出差异报告（意外差异 → 退出码 1）。
//
// 用法（先起服，脚本只复用——本机 spawn 的 vite 会静默退场）：
//   cd 搜打撤 && npx vite --port 5334 --strictPort   （窗口1）
//   node scripts/page-snapshot.mjs --out docs/evidence/<任务>/snap-before          （窗口2）
//   node scripts/page-snapshot.mjs --out docs/evidence/<任务>/snap-after --compare docs/evidence/<任务>/snap-before
//
// 固化知识（全部 09-29 CSS 精修班实测验证，勿凭记忆改）：
//   - 页面驱动一律 Runtime.evaluate（IAB/CDP 下 Playwright locator 点击不可用）；
//   - 快捷键是 Alt+数字（quick-nav.js），合成 KeyboardEvent 需 altKey:true；
//   - 照相馆放大要点「已挂载瓦片」：.lib-item.lib-ph 是占位（271 张窗口化挂载约 256 占位）；
//   - 商店货随机 → .hs-card 按「卡名|类名」做身份配对，只比配上的卡；未配对算 inconclusive 不算失败；
//   - img[data-asset-key] 按 key 配对（HUD 图标列表两次加载顺序会变，按索引比必出假差异）；
//   - .lib-item 基线侧可能是占位瓦片（高度=contain-intrinsic-size+padding）、改后可能是实挂，
//     占位/实挂状态不同 → 高度差记 info 不记失败。
// 驱动方式：headless Edge + CDP（复用 perf-ledger-capture.mjs 已验证的模式）。
// 端口：dev 5334 / CDP 5335（perf 专用段 5330-5339 内，避开夜班 54xx）。
// ============================================================
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn, execFileSync } from 'node:child_process';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(SCRIPT_DIR, '..');
const argOf = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };

const PORT = Number(argOf('port', '5334'));
const CDP_PORT = Number(argOf('cdp-port', '5335'));
const BASE_URL = `http://localhost:${PORT}/`;
const PAGE_URL = BASE_URL + 'game/index.html';
const OUT_DIR = path.resolve(REPO, argOf('out', 'docs/evidence/page-snapshot-tmp'));
const COMPARE_DIR = argOf('compare', '') ? path.resolve(REPO, argOf('compare', '')) : null;
const WAIT_BOOT_MS = Number(argOf('wait-boot', '60000'));

const EDGE_CANDIDATES = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];
const TMP = path.join(os.tmpdir(), 'page-snapshot');
const RUN_TAG = `${process.pid}-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}`;
const UDD = path.join(TMP, 'edge-profile-' + RUN_TAG);
fs.mkdirSync(TMP, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const log = (...a) => console.log('[page-snapshot]', ...a);

// ---------- dev server（只复用不自拉：本机 spawn 的 vite 子进程会静默退场，见照相馆专项 serve-8138 守护的由来） ----------
async function reachable(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); return r.ok; }
  catch { return false; }
}
async function ensureServer() {
  const gameUrl = BASE_URL + 'game/index.html';
  if (await reachable(gameUrl)) { log('复用已在跑的 dev server:', BASE_URL); return; }
  console.error(`[page-snapshot] 没有可用的 dev server（${BASE_URL}）。
先手动起服再跑本脚本（本机环境 spawn 的 vite 会静默退场，脚本不代拉）：
  cd 搜打撤 && npx vite --port ${PORT} --strictPort
然后重跑，或用 --port 指向已起服端口。`);
  process.exit(1);
}

// ---------- Edge + CDP（同 perf-ledger-capture：档案匹配杀旧、树杀清理） ----------
let edgeProc = null;
function killStaleAutomationEdge() {
  try {
    execFileSync('powershell', ['-NoProfile', '-Command',
      'Get-CimInstance Win32_Process -Filter "Name=\'msedge.exe\'" | Where-Object { $_.CommandLine -like \'*page-snapshot*\' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }'], { stdio: 'ignore', timeout: 30000 });
  } catch {}
  try {
    const out = execFileSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 30000 });
    const pids = new Set();
    for (const line of out.split('\n')) {
      if (line.includes(`:${CDP_PORT} `) && /LISTENING/i.test(line)) {
        const pid = Number(line.trim().split(/\s+/).pop());
        if (pid) pids.add(pid);
      }
    }
    for (const pid of pids) {
      try { execFileSync('taskkill', ['/pid', String(pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {}
    }
  } catch {}
}
function killEdgeTree() {
  if (!edgeProc?.pid) return;
  try { execFileSync('taskkill', ['/pid', String(edgeProc.pid), '/T', '/F'], { stdio: 'ignore', timeout: 30000 }); } catch {}
}
function startEdge() {
  const edge = EDGE_CANDIDATES.find(p => fs.existsSync(p));
  if (!edge) throw new Error('找不到 Edge（msedge.exe）');
  killStaleAutomationEdge();
  edgeProc = spawn(edge, [
    '--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${UDD}`,
    '--no-first-run', '--no-default-browser-check', '--disable-features=Translate',
    '--window-size=1280,720', '--hide-scrollbars', '--autoplay-policy=no-user-gesture-required',
    'about:blank',
  ], { stdio: 'ignore' });
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
          // 严格选真实标签页：扩展页（chrome-extension://）也在 type:'page' 里，宽松匹配会抓错目标（09-29 实翻车）
          page = list.find(t => t.type === 'page' && t.url === 'about:blank')
            || list.find(t => t.type === 'page' && /^https?:\/\//.test(t.url))
            || null;
          if (page) break;
        }
      } catch {}
      await new Promise(r => setTimeout(r, 250));
    }
    if (!page) throw new Error('Edge CDP 不可达或无真实标签页: ' + CDP_PORT);
    this.ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = () => rej(new Error('ws 连接失败')); });
    this.ws.onmessage = ev => {
      const msg = JSON.parse(ev.data);
      if (msg.id && this.pending.has(msg.id)) { this.pending.get(msg.id)(msg); this.pending.delete(msg.id); }
    };
    this.targetId = page.id;
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
    try {
      return await Promise.race([work, new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('页面执行超时: ' + expression.slice(0, 100))), timeoutMs); })]);
    } finally { clearTimeout(timer); }
  }
  async navigate(url) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        await this.send('Page.navigate', { url });
        break;
      } catch (e) {
        if (attempt === 0) { await sleep(2000); continue; }  // vite 预热期瞬时拒连，重试一次
        throw e;
      }
    }
    for (let i = 0; i < 60; i++) {
      try { if (await this.evalJson('document.readyState')) { if ((await this.evalJson('document.readyState')) === 'complete') break; } } catch {}
      await new Promise(r => setTimeout(r, 250));
    }
  }
}

// ---------- 页面导航（固化的可行路径，勿改用 locator/cua） ----------
async function waitBoot(cdp) {
  const ok = await cdp.evalJson(`(async () => {
    for (let i = 0; i < ${Math.floor(WAIT_BOOT_MS / 1000)}; i++) {
      if (window.SDT && document.querySelector('#titleDev button')) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  })()`, WAIT_BOOT_MS + 15000);
  if (!ok) throw new Error('游戏 boot 超时（SDT/#titleDev 未就绪）');
}
const clickDevButton = name => `(() => {
  const b = [...document.querySelectorAll('#titleDev button')].find(x => x.textContent.trim() === ${JSON.stringify(name)});
  if (!b) throw new Error('dev 面板无按钮 ' + ${JSON.stringify(name)});
  b.click(); return true;
})()`;
const altKey = key => `(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, altKey: true, bubbles: true })); return true; })()`;
// 壳常驻页（照相馆）：瓦片高度随照片载入收敛（载入前=contain-intrinsic-size 占位高），必须等稳定再拍
const waitHeightsStable = (sel, capMs = 12000) => `((async () => {
  const els = () => [...document.querySelectorAll(${JSON.stringify(sel)})].slice(0, 8).map(e => e.getBoundingClientRect().height);
  let prev = els(); const t0 = Date.now();
  while (Date.now() - t0 < ${capMs}) {
    await new Promise(r => setTimeout(r, 600));
    const cur = els();
    if (cur.length === prev.length && cur.every((v, i) => Math.abs(v - prev[i]) < 0.5)) {
      await new Promise(r => setTimeout(r, 600));
      return 'stable';
    }
    prev = cur;
  }
  return 'unstable-cap';
})())`;

// ---------- 快照定义 ----------
const PROPS = ['display','position','order','z-index','width','height','min-height','aspect-ratio','padding','margin','border-top-width','border-top-color','border-top-left-radius','background-image','background-color','box-shadow','clip-path','color','font-weight','letter-spacing','text-shadow','content-visibility','contain-intrinsic-size','object-position','top','left','bottom'];
const HS_FAMILY = ['.hs-card','.hs-card .hsc-name','.hs-card .hsc-art','.hs-card .hsc-type','.hs-card .hsc-desc','.hs-card .hsc-cost','.hs-card .hsc-dmg','.hs-card .hsc-val','.hs-card .hsc-gem'];
const PAGES = {
  battle: {
    goto: async cdp => { await cdp.navigate(PAGE_URL + '?r=' + RUN_TAG); await waitBoot(cdp); await cdp.evalJson(clickDevButton('遭遇战')); await sleep(3500); },
    sels: [...HS_FAMILY, '.hs-card .hsc-desc .d-num','.hs-card .hsc-desc .d-kw','.hs-card .hsc-desc .d-term','.lib-item','img[data-asset-key]'],
  },
  shop: {
    goto: async cdp => { await cdp.navigate(PAGE_URL + '?r=' + RUN_TAG); await waitBoot(cdp); await cdp.evalJson(clickDevButton('商店')); await sleep(3000); },
    sels: [...HS_FAMILY, '.lib-item','img[data-asset-key]'],
  },
  'cardlib-grid': {
    goto: async cdp => { await cdp.navigate(PAGE_URL + '?r=' + RUN_TAG); await waitBoot(cdp); await cdp.evalJson(altKey('7')); await sleep(2500); await cdp.evalJson(waitHeightsStable('.photo-studio-v3 .lib-item')); },
    sels: ['.photo-studio-v3 .lib-item','.photo-studio-v3 .studio-photo-paper','.photo-studio-v3 .studio-preview-paper','.photo-studio-v3 .lib-tile','.lib-item','.hs-card'],
  },
  'cardlib-zoom': {
    goto: async cdp => {
      await cdp.navigate(PAGE_URL + '?r=' + RUN_TAG); await waitBoot(cdp);
      await cdp.evalJson(altKey('7')); await sleep(2500); await cdp.evalJson(waitHeightsStable('.photo-studio-v3 .lib-item'));
      const clicked = await cdp.evalJson(`(() => {
        const t = document.querySelector('.photo-studio-v3 .lib-item:not(.lib-ph) .studio-photo-paper')
               || document.querySelector('.photo-studio-v3 .lib-item:not(.lib-ph)');
        if (!t) return 'no-mounted-tile';
        t.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        return 'ok';
      })()`);
      if (clicked !== 'ok') throw new Error('zoom 打不开：' + clicked);
      await sleep(1800);
    },
    sels: ['#cardZoom','#cardZoom .cz-photo-paper','#cardZoom .cz-photo-main','#cardZoom .hs-card','#cardZoom .hsc-art','.studio-preview-paper'],
  },
};
const sleep = ms => new Promise(r => setTimeout(r, ms));

const snapJs = sels => `(() => {
  const props = ${JSON.stringify(PROPS)};
  const ident = (el, sel) => {
    if (el.dataset && el.dataset.assetKey) {
      // 同名 key 的图标可能出现在多个组件（出现顺序不稳定）——用父容器类名做结构定位
      const pcls = ((el.parentElement && el.parentElement.className) || '').toString().split(/\s+/)[0] || 'root';
      return 'img:' + el.dataset.assetKey + '@' + pcls;
    }
    const card = el.closest ? el.closest('.hs-card') : null;
    const cn = card ? (card.querySelector('.hsc-name')?.textContent || '').trim() : '';
    if (cn) {
      const cls0 = (el.className.toString().split(/\\s+/)[0] || 'x');
      const same = [...card.querySelectorAll(sel)].filter(e => e.closest('.hs-card') === card);
      return cn + '|' + cls0 + '|' + same.indexOf(el);
    }
    if (el.dataset && (el.dataset.card || el.dataset.uid || el.dataset.id)) return el.dataset.card || el.dataset.uid || el.dataset.id;
    return null;
  };
  const out = { bodyClass: document.body.className, sels: {} };
  for (const sel of ${JSON.stringify(sels)}) {
    out.sels[sel] = [...document.querySelectorAll(sel)].slice(0, 8).map(el => {
      const cs = getComputedStyle(el); const o = { identity: ident(el, sel), cls: el.className.toString().slice(0, 60), props: {} };
      for (const p of props) { const v = cs.getPropertyValue(p); if (v) o.props[p] = v; }
      return o;
    });
  }
  return JSON.stringify(out);
})()`;

async function capture(cdp) {
  const result = {};
  for (const [name, page] of Object.entries(PAGES)) {
    log('导航:', name);
    await page.goto(cdp);
    result[name] = JSON.parse(await cdp.evalJson(snapJs(page.sels)));
  }
  return result;
}

// ---------- diff（身份配对优先，索引兜底；占位/实挂状态差与未配对记 info） ----------
function diffSnapshots(a, b) {
  const failures = [], infos = [];
  const pages = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const pg of pages) {
    const A = a[pg], B = b[pg];
    if (!A || !B) { failures.push(`${pg}: 一侧缺整页快照`); continue; }
    const sels = new Set([...Object.keys(A.sels), ...Object.keys(B.sels)]);
    for (const sel of sels) {
      const ea = A.sels[sel] || [], eb = B.sels[sel] || [];
      const keyed = ea.every(e => e.identity) && eb.every(e => e.identity) && ea.length > 0 && eb.length === eb.filter(e => e.identity).length;
      if (keyed) {
        // 同名 key 可能有多个元素（如 icon-tools 在快速导航与 dev 面板各一个）——按 key 分桶后桶内按序配对
        const bucketA = new Map(), bucketB = new Map();
        for (const e of ea) { const k = e.identity; (bucketA.get(k) || bucketA.set(k, []).get(k)).push(e); }
        for (const e of eb) { const k = e.identity; (bucketB.get(k) || bucketB.set(k, []).get(k)).push(e); }
        let unmatched = 0;
        for (const [k, listB] of bucketB) {
          const listA = bucketA.get(k) || [];
          const n = Math.min(listA.length, listB.length);
          unmatched += listB.length - n;
          for (let i = 0; i < n; i++) {
            for (const p of new Set([...Object.keys(listA[i].props), ...Object.keys(listB[i].props)])) {
              if ((listA[i].props[p] || '') !== (listB[i].props[p] || '')) failures.push(`${pg} ${sel} [${k}#${i}] ${p}: ${listA[i].props[p]} -> ${listB[i].props[p]}`);
            }
          }
        }
        for (const [k, listA] of bucketA) if (!bucketB.has(k)) unmatched += listA.length;
        if (unmatched) infos.push(`${pg} ${sel}: ${unmatched} 个元素未配对（随机货/加载序，不算失败）`);
      } else {
        if (ea.length !== eb.length) { infos.push(`${pg} ${sel}: 元素数 ${ea.length} -> ${eb.length}（挂载数浮动，人工判断）`); continue; }
        for (let i = 0; i < ea.length; i++) {
          const phA = /\blib-ph\b/.test(ea[i].cls || ''), phB = /\blib-ph\b/.test(eb[i].cls || '');
          for (const p of new Set([...Object.keys(ea[i].props), ...Object.keys(eb[i].props)])) {
            const va = ea[i].props[p] || '', vb = eb[i].props[p] || '';
            if (va === vb) continue;
            if (phA !== phB) { infos.push(`${pg} ${sel}[${i}] ${p}: ${va} -> ${vb}（占位/实挂状态不同，info）`); }
            else failures.push(`${pg} ${sel}[${i}] ${p}: ${va} -> ${vb}`);
          }
        }
      }
    }
  }
  return { failures, infos };
}

// ---------- main ----------
const WATCHDOG_MIN = Number(argOf('watchdog-min', '8'));
const dieHard = (msg, code) => {
  try { fs.appendFileSync(path.join(OUT_DIR, 'diehard.log'), new Date().toISOString() + ' ' + msg + '\n'); } catch {}
  console.error('[page-snapshot][diehard]', msg);
  try { killEdgeTree(); } catch {}
  process.exit(code);
};
process.on('uncaughtException', e => dieHard('uncaughtException: ' + (e?.stack || e), 3));
process.on('unhandledRejection', e => dieHard('unhandledRejection: ' + (e?.stack || e), 3));
const watchdog = setTimeout(() => dieHard(`全局看门狗（${WATCHDOG_MIN}min）触发：流程挂死`, 2), WATCHDOG_MIN * 60 * 1000);
let cdp = null;
try {
  await ensureServer();
  startEdge();
  cdp = new Cdp();
  await cdp.connect();
  const fresh = await capture(cdp);
  for (const [name, snap] of Object.entries(fresh)) {
    fs.writeFileSync(path.join(OUT_DIR, name + '.json'), JSON.stringify(snap, null, 1));
  }
  log('快照写入:', OUT_DIR);
  if (COMPARE_DIR) {
    const base = {};
    for (const name of Object.keys(fresh)) {
      const f = path.join(COMPARE_DIR, name + '.json');
      base[name] = JSON.parse(fs.readFileSync(f, 'utf8'));
    }
    const { failures, infos } = diffSnapshots(base, fresh);
    console.log('\n===== A/B 对比报告 =====');
    infos.forEach(x => console.log('[info]   ', x));
    failures.forEach(x => console.log('[DIFF]   ', x));
    console.log(`===== 失败 ${failures.length} 处 / info ${infos.length} 处 =====`);
    process.exitCode = failures.length ? 1 : 0;
  }
} finally {
  clearTimeout(watchdog);
  try { cdp?.ws?.close(); } catch {}
  killEdgeTree();
}
// ws/子进程句柄会吊住事件循环——报告已出，确定性退出
process.exit(typeof process.exitCode === 'number' ? process.exitCode : 0);
