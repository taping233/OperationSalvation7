// ============================================================
// iab-drive.mjs —— ZCode 内置浏览器（IAB）驱动搜打撤的起手式函数库
//
// 用途：任何会话要在 node_repl（mcp__node_repl__js）里实测游戏页面时，
//       一行 import 拿到全部已验证的驱动函数，免每次手写 bootstrap/试错。
//
// 用法（仅限 ZCode node_repl 环境，普通 node 没有 ZCODE_PLUGIN_ROOT）：
//   const D = await import(pathToFileURL('D:/素材/代号柒/搜打撤/scripts/iab-drive.mjs').href);
//   const { tab } = await D.openGame();                    // 复用/新建标签页 + 等游戏 boot
//   await D.clickDevButton(tab, '遭遇战');                  // dev 面板跳节点
//   await D.altKey(tab, '7');                              // Alt+7 开照相馆
//   const v = await D.evalRaw(tab, `1+1`);                 // evaluate（只返回原始值！）
//   await D.getTab(D, tabId)                               // 新 kernel 里恢复 tab
//
// 固化口径（09-29 实测验证，详见记忆 soudache-iab-verify-quirks）：
//   - 驱动一律 evaluate 合成事件（locator click 超时常态、cua 禁用）；
//   - 快捷键是 Alt+数字（quick-nav.js），合成 KeyboardEvent 需 altKey:true；
//   - boot 可超 60s：轮询 SDT + #titleDev 按钮就绪再动手；
//   - evaluate 只返回原始值（复杂对象得 {}，页面内先 JSON.stringify）。
//
// 归属：2026-10-01 起由 WF-acceptance-scenes 会话收编纳管（老板拍板，PENDING #21
// 同步销账）。验收首选 runScene()：一次调用跑完固定剧本并取回断言报告——
//   const { tab } = await D.openGame();
//   const report = await D.runScene(tab, 'battle');        // 报告 JSON（pass/断言/终态）
// 场景清单见 SDT.Agent.scenes.list() 与 docs/agent-protocol.md「验收剧本」节。
// ============================================================

const PLUGIN_ROOT = () => {
  const root = process.env.ZCODE_PLUGIN_ROOT ?? process.env.CLAUDE_PLUGIN_ROOT;
  if (!root) throw new Error('iab-drive 仅限 ZCode node_repl 环境使用（缺 ZCODE_PLUGIN_ROOT）');
  return root;
};

// 默认指向主线 Vite（npm run web，5200 幂等）；验收隔离副本时显式传 url 覆盖。
const GAME_URL_DEFAULT = 'http://localhost:5200/game/index.html';

/** 每次 js 调用（新 kernel）的第一个动作：setup + 选定 IAB。 */
export async function setup(url = GAME_URL_DEFAULT) {
  const { join } = await import('node:path');
  const { pathToFileURL } = await import('node:url');
  const clientUrl = pathToFileURL(join(PLUGIN_ROOT(), 'scripts', 'browser-client.mjs')).href;
  const { setupBrowserRuntime } = await import(clientUrl);
  await setupBrowserRuntime({ globals: globalThis });
  const browser = await globalThis.agent.browsers.getForUrl(url);
  return browser;
}

/** 等 boot：SDT 就绪 + dev 面板按钮出现（面板需开发者模式，见下 openGame 注）。 */
export async function waitBoot(tab, capMs = 60000) {
  return tab.playwright.evaluate(`(async () => {
    for (let i = 0; i < ${Math.floor(capMs / 1000)}; i++) {
      if (window.SDT && document.querySelector('#titleDev button')) return true;
      await new Promise(r => setTimeout(r, 1000));
    }
    return false;
  })()`, capMs + 15000);
}

/** 复用已有同站标签页，没有才新建；导航到游戏页并等 boot。返回 { browser, tab, reused }。 */
export async function openGame(url = GAME_URL_DEFAULT) {
  const browser = await setup(url);
  const tabs = await browser.tabs.list();
  let tab = null;
  const hit = tabs.find(t => (t.url || '').startsWith(url.split('/game/')[0]));
  if (hit) tab = await browser.tabs.get(hit.id);
  const reused = !!tab;
  if (!tab) {
    tab = await browser.tabs.new();
    await tab.goto(url);
    await tab.playwright.waitForLoadState({ state: 'domcontentloaded' });
  }
  const booted = await waitBoot(tab);
  if (!booted) throw new Error('游戏 boot 超时（SDT/#titleDev 未就绪；dev 面板需开发者模式 localStorage sdt-dev=1）');
  return { browser, tab, reused };
}

/** 新 kernel 里按 tab id 恢复（tabs.list → tabs.get 的封装；先用 D.listTabs(tabId 的 browser) 看列表）。 */
export async function getTab(browser, tabId) {
  return browser.tabs.get(tabId);
}

/** evaluate 执行表达式并 JSON.parse（页面内 stringify → 只回原始值口径）。 */
export async function evalRaw(tab, expression, timeoutMs = 45000) {
  const wrapped = `(async () => JSON.stringify((async () => (${expression}))()))()`;
  const r = await tab.playwright.evaluate(wrapped);
  return JSON.parse(r);
}

const clickJs = name => `(() => {
  const b = [...document.querySelectorAll('#titleDev button')].find(x => x.textContent.trim() === ${JSON.stringify(name)});
  if (!b) throw new Error('dev 面板无按钮 ' + ${JSON.stringify(name)});
  b.click(); return true;
})()`;

/** dev 面板跳节点（遭遇战/BOSS 战/商店/事件/小宝箱/中宝箱/大宝箱/火堆/祭坛）。 */
export async function clickDevButton(tab, name, settleMs = 3000) {
  await tab.playwright.evaluate(clickJs(name));
  await tab.playwright.waitForTimeout(settleMs);
  return true;
}

/** quick-nav 快捷键（Alt+数字/字母；7=照相馆 8=信箱 9=跑局数据 0=设置 1-6=基地页签）。 */
export async function altKey(tab, key, settleMs = 2500) {
  await tab.playwright.evaluate(`(() => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ${JSON.stringify(key)}, altKey: true, bubbles: true }));
    return true;
  })()`);
  await tab.playwright.waitForTimeout(settleMs);
  return true;
}

/** 按 CSS 选择器合成点击（MouseEvent，bubbles；对 click() 无效的按钮改用 D.pointerClick）。 */
export async function clickEl(tab, selector, settleMs = 800) {
  return tab.playwright.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'not-found';
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    return 'clicked';
  })()`).then(async r => { await tab.playwright.waitForTimeout(settleMs); return r; });
}

/** 完整 PointerEvent 序列点击（对 el.click() 无效的按钮，如存档层按钮；坐标=rect 中心）。 */
export async function pointerClick(tab, selector, settleMs = 800) {
  return tab.playwright.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return 'not-found';
    const r = el.getBoundingClientRect();
    const o = { clientX: r.x + r.width / 2, clientY: r.y + r.height / 2, bubbles: true, cancelable: true, pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0 };
    el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('click', o));
    return 'clicked';
  })()`).then(async r => { await tab.playwright.waitForTimeout(settleMs); return r; });
}

/** 计算样式快照（与 workflow-browser 证据导入同一白名单与身份口径；返回对象）。 */
export async function snap(tab, sels, opts = {}) {
  const props = opts.props || ['display','position','order','z-index','width','height','min-height','aspect-ratio','padding','margin','border-top-width','border-top-color','border-top-left-radius','background-image','background-color','box-shadow','clip-path','color','font-weight','letter-spacing','text-shadow','content-visibility','contain-intrinsic-size','object-position','top','left','bottom'];
  const per = opts.per || 3;
  return tab.playwright.evaluate(`(() => {
    const props = ${JSON.stringify(props)};
    const snap = (sel) => [...document.querySelectorAll(sel)].slice(0, ${per}).map(el => {
      const cs = getComputedStyle(el); const o = { cls: el.className.toString().slice(0, 60), props: {} };
      for (const p of props) { const v = cs.getPropertyValue(p); if (v) o.props[p] = v; }
      if (el.dataset && el.dataset.assetKey) o['data-asset-key'] = el.dataset.assetKey;
      return o;
    });
    const out = { bodyClass: document.body.className };
    for (const sel of ${JSON.stringify(sels)}) out[sel] = snap(sel);
    return JSON.stringify(out);
  })()`).then(s => JSON.parse(s));
}

/** 截图（必须配合 nodeRepl.emitImage 使用：emitImage(await D.shot(tab))）。 */
export async function shot(tab) {
  return tab.screenshot();
}

/** 场景清单（SDT.Agent.scenes.list()）。 */
export function scenesList(tab) {
  return evalRaw(tab, `window.SDT?.Agent?.scenes?.list() ?? []`);
}

/** 跑固定验收剧本并取回报告。IAB 的 evaluate 有 3s 级上限，所以走
 *  scenes.start（页面内后台跑）+ scenes.status 轮询（每 2s 一次，均在预算内）。
 *  IAB 页面可能 1-3 分钟自刷杀掉在跑场景：轮询识别 SDT 消失即如实返回
 *  PAGE_RELOADED（长场景传 options.turbo 提速降低撞刷概率）。
 *  scene 形如 'smoke'|'battle'|'extract'|'fullrun'…。 */
export async function runScene(tab, scene, options = {}) {
  const boot = await evalRaw(tab,
    `window.SDT.Agent.scenes.start(${JSON.stringify(scene)}, ${JSON.stringify({ turbo: !!options.turbo })})`);
  if (!boot.ok) return { ok: false, pass: false, ...boot };
  const pollMs = options.pollMs ?? 2000;
  const deadline = Date.now() + (options.timeoutMsMs ?? 600000);
  let ghost = 0;
  for (;;) {
    await tab.playwright.waitForTimeout(pollMs);
    let status = null;
    try {
      status = await evalRaw(tab, `window.SDT.Agent.scenes.status(${JSON.stringify(scene)})`);
      ghost = 0;
    } catch {
      // SDT 没了=页面自刷：连续几次仍不在就判定场景被杀，不无限等
      const alive = await evalRaw(tab, `!!window.SDT`).catch(() => false);
      if (!alive && ++ghost >= 3) {
        return { ok: false, pass: false, code: 'PAGE_RELOADED',
          message: '页面自刷杀掉了在跑场景；重新 openGame 后用 turbo 重跑' };
      }
      continue;
    }
    if (status.done) return status.report;
    if (Date.now() > deadline) {
      return { ok: false, pass: false, code: 'POLL_TIMEOUT', message: `轮询超时（场景可能仍在跑，可用 scenes.status 续查）` };
    }
  }
}
