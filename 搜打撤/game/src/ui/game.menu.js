import { beginRuntimeStage, captureRuntimeStageContext, withRuntimeStageContext } from '../core/runtime-trace-stages.local.js';
import { beginPageEntryCancellation, cancelPendingPageEntries, releasePageEntryCancellation } from './page-entry-cancellation.js';
import { captureBattleContext, invalidateBattleContext } from '../battle/battle-loader.js';
import { storeGet, storeSet } from '../core/storage.js';
import { runPageLoading } from './page-loading.js';

let modulePromise = null;
let currentEntry = null;
export let menuPageLoading = false;

function loadMenuPagesModule() {
  if (!modulePromise) {
    const loading = import('./game.menu.pages.js');
    const retryable = loading.catch(error => {
      if (modulePromise === retryable) modulePromise = null;
      throw error;
    });
    modulePromise = retryable;
  }
  return modulePromise;
}

// Escape and other page entries cancel presentation, never execute a pending page action.
export function cancelPendingMenuPageOpen() {
  return currentEntry?.cancel() || false;
}

export function createGameMenuController(deps, { pageFactory = null, loadPages = loadMenuPagesModule } = {}) {
  const { SDT, UI, game, runtime, SLOT_COUNT, readSlot, saveSession, getActiveSlot = () => null, setActiveSlot } = deps;
  let pageController = null;
  const shell = { setLobby, showTitle, hideTitle, pickLatestSlot, fmtPlayTime, describeCurrentPage };
  const createPages = factory => pageController || (pageController = factory(deps, shell));
  const sameArgs = (first, second) => first.length === second.length && first.every((arg, i) => arg === second[i]);

  function enterMenuPage(method, args) {
    const traceContext = method === 'openSettings' ? captureRuntimeStageContext() : null;
    if (currentEntry?.owner === shell && currentEntry.method === method && sameArgs(currentEntry.args, args) && !currentEntry.ready) return currentEntry.promise;
    cancelPendingMenuPageOpen();
    cancelPendingPageEntries();
    // Explicit factory injection composes an already-materialized implementation; normal startup has none.
    if (pageFactory) createPages(pageFactory);
    if (pageController) return pageController[method](...args);
    const originBody = UI.el?.ovBody;
    const originRoot = originBody?.firstElementChild;
    const originOverlayHidden = UI.el?.overlay?.hidden;
    const originState = game.state;
    const originBase = SDT.Base;
    const originBaseSlot = originBase?.slot;
    const contextCurrent = captureBattleContext(game, getActiveSlot);
    const controller = new AbortController();
    const entry = { owner: shell, method, args, controller, ready: false, promise: null, cancel: null };
    const isCurrent = () => currentEntry === entry && !controller.signal.aborted && contextCurrent()
      && game.state === originState && SDT.Base === originBase && SDT.Base?.slot === originBaseSlot
      && UI.el?.ovBody === originBody && originBody?.firstElementChild === originRoot
      && UI.el?.overlay?.hidden === originOverlayHidden;
    entry.cancel = () => {
      if (currentEntry !== entry) return false;
      currentEntry = null;
      menuPageLoading = false;
      releasePageEntryCancellation('menu', cancelPendingMenuPageOpen);
      controller.abort();
      return !entry.ready;
    };
    currentEntry = entry;
    menuPageLoading = true;
    beginPageEntryCancellation('menu', cancelPendingMenuPageOpen);
    const loading = runPageLoading({
      title: '正在打开页面', detail: '正在准备菜单内容', signal: controller.signal,
      open: async () => {
        const finishModule = method === 'openSettings' ? beginRuntimeStage('settings-module-wait', traceContext) : () => {};
        let page;
        try { page = await loadPages(); } finally { finishModule(); }
        if (!isCurrent()) return false;
        const result = withRuntimeStageContext(traceContext, () => createPages(page.createGameMenuPages)[method](...args));
        entry.ready = true;
        menuPageLoading = false;
        return result;
      },
    });
    entry.promise = loading.catch(error => {
      if (isCurrent()) UI.log(`[[icon:cross]] 页面加载失败，请重试：${String(error?.message || error)}`, 'warn');
      return false;
    }).finally(() => {
      if (currentEntry === entry) {
        currentEntry = null;
        menuPageLoading = false;
        releasePageEntryCancellation('menu', cancelPendingMenuPageOpen);
      }
    });
    return entry.promise;
  }

  function startNewGame() { return enterMenuPage('startNewGame', []); }
  function openSettings() { return enterMenuPage('openSettings', []); }
  function openLeaveMenu() { return enterMenuPage('openLeaveMenu', []); }
  function openTitleGuide() { return enterMenuPage('openTitleGuide', []); }
  function openTitleAchievements() { return enterMenuPage('openTitleAchievements', []); }
  function openSuggestionInbox(fromTitle = false) { return enterMenuPage('openSuggestionInbox', [fromTitle]); }
  function openSuggestionBox(target, at, page) { return enterMenuPage('openSuggestionBox', [target, at, page]); }
  function openDataPageUi(fromSettings = false) { return enterMenuPage('openDataPageUi', [fromSettings]); }


  // 存储安全封装（迭代评审 09-20 G-P2）：隐私模式/配额满时裸调 localStorage 会抛异常，
  // 设置页曾直接死按钮。2026-09-28 代码线：本地逐字副本删除，改用 core/storage.js
  // 权威实现（会话能力仍走 deps 注入，此处只是通用工具）

  // ---------- 标题界面 ----------
  // lobby = 非对局界面（标题/退出屏/基地）：隐藏左侧栏，画面更聚焦
  function setLobby(on) {
    document.body.classList.toggle('lobby', !!on);
    runtime.resize();   // 视口宽度变了，画布需重新适配
  }

  function showTitle() {
    cancelPendingPageEntries();
    invalidateBattleContext(game);
    game.state = 'title';
    game.path = null;
    game.runActive = false;
    setActiveSlot(null);
    setLobby(true);
    UI.showScreen(document.getElementById('title'));
    // 告别屏若还亮着（网页版退出→返回）交叉淡出；本就隐藏时立即返回
    UI.hideScreen(document.getElementById('exitScr'));
    bindTitleExtras();
    renderTitleStats();
    SDT.Sound.music('title');
    maybeShowRmbHint();   // W1-11：右键留言一次性提示（首次到标题页展示）
    UI.refresh(game);
  }

  // W1-11：右键留言通道不可发现的补偿——首次进标题页弹一次性提示条。
  // 独立 body 层（不触 #overlay）；localStorage 打标只弹一次；存储异常静默跳过
  function maybeShowRmbHint() {
    try {
      if (storeGet('sdt-rmb-hint')) return;
      storeSet('sdt-rmb-hint', '1');
      const tip = document.createElement('div');
      tip.className = 'rmb-hint-toast';
      tip.textContent = '提示：任意界面点击右键，可以给制作者留言';
      document.body.appendChild(tip);
      setTimeout(() => tip.classList.add('out'), 5200);
      setTimeout(() => tip.remove(), 5900);
    } catch { /* localStorage 不可用就不提示 */ }
  }

  function hideTitle() { UI.hideScreen(document.getElementById('title')); }

  // ---------- AK 风格主页：标题页附加按钮与真实数据 ----------
  let titleExtrasBound = false;
  let titleExtrasBoundGlobal = false;
  function bindTitleExtras() {
    if (titleExtrasBound) return;
    titleExtrasBound = true;
    document.getElementById('mGuide')?.addEventListener('click', openTitleGuide);
    document.getElementById('mAch')?.addEventListener('click', openTitleAchievements);
    // W1-11：标题页留言信箱入口（fromTitle=true → 返回键回标题而非设置页）
    document.getElementById('mInbox')?.addEventListener('click', () => openSuggestionInbox(true));
    const mute = document.getElementById('btnTitleMute');
    if (mute) {
      const syncMute = () => mute.classList.toggle('muted', !!SDT.Sound.muted);
      mute.addEventListener('click', () => { SDT.Sound.setMuted(!SDT.Sound.muted); syncMute(); });
      syncMute();
    }
    // 标题页左上退出键：桌面版走 IPC 退出应用；浏览器版兜底 window.close()
    document.getElementById('btnTitleExit')?.addEventListener('click', () => {
      if (window.sdtDesktop?.isDesktop) window.sdtDesktop.quit();
      else window.close();
    });
    // 右键游戏任意界面 → 针对该位置打开写给 Friday 的建议（自动附上位置信息）
    // 绑定在 document 上一次全局生效；建议层是独立 DOM，叠加在 overlay 页面之上不破坏原界面。
    if (!titleExtrasBoundGlobal) {
      titleExtrasBoundGlobal = true;
      // 圆形入口（收藏图鉴/设置/成就）点击脉冲：:active 按压只在按住时可见，快click也要有可感知反馈
      document.getElementById('title')?.addEventListener('click', (e) => {
        const face = e.target.closest?.('.ak-circle');
        const ring = face?.querySelector('.c-ring');
        if (!ring) return;
        ring.classList.remove('ak-click');
        void ring.offsetWidth;
        ring.classList.add('ak-click');
      });
      // 2026-09-19 留言 #13：标题页可点击互动小动画——字标抖动/撤离次数弹跳/字牌闪金
      document.getElementById('title')?.addEventListener('click', (e) => {
        const play = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
        const wordmark = e.target.closest?.('.winter-wordmark');
        if (wordmark) { play(wordmark, 'wm-jolt'); SDT.Sound.sfx('hover'); return; }
        const sec = e.target.closest?.('.ak-sec');
        if (sec) { play(sec.querySelector('b') || sec, 'sec-pop'); SDT.Sound.sfx('gain'); return; }
        const word = e.target.closest?.('.ak-word');
        if (word) { play(word, 'word-glint'); return; }
        const kicker = e.target.closest?.('.title-kicker');
        if (kicker) { play(kicker, 'kick-blink'); return; }
      });
      document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('#sugLayer')) return;   // 建议层内部右键不重开
        e.preventDefault();
        const page = describeCurrentPage();
        const target = describeTitleTarget(e.target, page);
        const at = { x: Math.round(e.clientX / innerWidth * 100), y: Math.round(e.clientY / innerHeight * 100) };
        openSuggestionBox(target, at, page);
      });
    }
  }

  // 精确识别当前所在的页面/弹层（留言记录用）：
  // 全屏页按稳定容器（hubMain/depMain/卡牌库/制作坊/设置/选人），普通弹层用弹层标题，
  // 都没有再按 game.state 回退。返回 { id: 稳定标识, name: 中文页名 }。
  function describeCurrentPage() {
    const overlay = UI.el && UI.el.overlay;
    if (overlay && !overlay.hidden) {
      const body = UI.el.ovBody;
      const hub = body && body.querySelector('#hubMain');
      if (hub) {
        const tab = Array.from(hub.classList).find(c => c.startsWith('hub-'));
        const key = tab ? tab.slice(4) : '';
        const tabName = { deploy: '出发', stash: '仓库', shop: '商店', upgrade: '升级', classes: '人物', ach: '成就·收藏室' }[key] || key;
        return { id: 'hub-' + key, name: `基地 · ${tabName || '主页'}` };
      }
      if (body && body.querySelector('#depMain')) return { id: 'depMain', name: '出发整备' };
      if (body && body.querySelector('.sugin-page')) return { id: 'suginbox', name: '留言信箱' };
      if (body && body.querySelector('.clib-main')) return { id: 'cardlib', name: '卡牌库' };
      if (body && body.querySelector('.cdes-main')) return { id: 'cardforge', name: '制作坊' };
      if (body && body.querySelector('.settings-page')) return { id: 'settings', name: '设置页' };
      if (body && body.querySelector('.cls2-page')) return { id: 'classselect', name: '选人页' };
      const title = ((UI.el.ovTitle && UI.el.ovTitle.textContent) || '').trim();
      if (title) return { id: 'overlay:' + title, name: title };
      const modeName = { page: '全屏页', battle: '战斗弹层', bag: '背包弹层', bagpage: '背包页', chest: '宝箱浮层', scene: '场景弹层', wide: '宽幅弹层' }[UI._lastMode] || '弹层';
      return { id: 'mode:' + (UI._lastMode || ''), name: modeName };
    }
    // 设置→留言库→返回设置的旧状态恢复会留下 idle，但标题屏本身仍真实可见。
    // 页面识别以可见 DOM 为准，同时保留正常 state:title 的稳定 id。
    const title = document.getElementById('title');
    if (title && !title.hidden && !title._scrHiding) return { id: 'state:title', name: '标题页' };
    const stateName = { boot: '启动', title: '标题页', idle: '对局地图', moving: '对局移动中', modal: '弹层页面', done: '结算页', bossCleanup: 'BOSS 收尾' }[game.state] || game.state;
    return { id: 'state:' + (game.state || ''), name: stateName };
  }

  // 把右键命中的元素翻译成 Friday 可读的位置描述：
  // 优先取按钮文案/标题提示，画布单独说明，其次区域类名，再带上 DOM 路径。
  // 页面前缀由 describeCurrentPage 提供，精确到具体页面/弹层。
  function describeTitleTarget(el, page) {
    const where = page ? page.name : game.state;
    if (el && el.tagName === 'CANVAS') {
      return { name: `游戏画布（${where}）`, selector: 'canvas#' + (el.id || 'viewport') };
    }
    if (!el || el.id === 'title') return { name: `标题页整体`, selector: '#title' };
    const btn = el.closest('button');
    if (btn) {
      const label = btn.getAttribute('title') || btn.textContent.trim().replace(/\s+/g, ' ').slice(0, 20);
      return { name: `${where} · 按钮「${label}」`, selector: btn.id ? `#${btn.id}` : `button.${btn.className}` };
    }
    const zone = el.closest('[class]');
    const zoneName = { 'title-heading': '标题标题区', 'ak-hud': '主页 HUD 区', 'title-quote': '底部引言', 'title-bg': '背景图', 'ov-body': '弹层页面内容区', 'sidebar': '左侧边栏' }[zone?.className] || zone?.className;
    const path = [];
    let cur = el;
    while (cur && cur.id !== 'title' && cur !== document.body && path.length < 4) {
      path.unshift(cur.tagName.toLowerCase() + (cur.className ? '.' + String(cur.className).split(' ')[0] : '') + (cur.id ? '#' + cur.id : ''));
      cur = cur.parentElement;
    }
    return { name: `${where} · ${zoneName || '未命名区域'}`, selector: path.join(' > ') };
  }

  // 最近游玩的档位（按对局存档时间；无对局存档的基地档位排后）
  function pickLatestSlot() {
    let best = null;
    for (let i = 1; i <= SLOT_COUNT; i++) {
      // F1 兜底（2026-09-24）：单档读取异常（如基地档字段类型损坏）不阻塞最近档判定——
      // 标题页数据件与选档页共用本函数，一档抛错会连带卡死整页
      let run = null, base = null;
      try { run = readSlot(i); } catch { /* 坏档按空档处理 */ }
      try { base = SDT.Base.peek(i); } catch { /* 同上 */ }
      if (!run && !base) continue;
      const ts = +run?.savedAt || 0;
      if (!best || ts > best.ts) best = { slot: i, run, base, ts };
    }
    return best;
  }

  // 主页数据件：全部来自真实存档（最近档位的档案号 / 游玩时长 / 成就 / 收藏 / 撤离）
  function renderTitleStats() {
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const latest = pickLatestSlot();
    const base = latest?.base || null, run = latest?.run || null;
    const latestTotal = Math.max(base?.stats?.playSeconds || 0, run?.elapsed || 0);
    set('akSlotNo', latest ? `0${latest.slot}` : '--');
    set('akPlaytime', latest ? (latestTotal > 0 ? `游玩 ${fmtPlayTime(latestTotal)}` : '新档案 · 尚无对局') : '尚无档案');
    const tag = document.getElementById('akLastTag');
    if (tag) {
      if (run?.savedAt) {
        const d = new Date(run.savedAt);
        const p = (n) => String(n).padStart(2, '0');
        tag.textContent = `继续对局 · ${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
      } else tag.textContent = base ? '基地档案已建立' : '暂无档案 · 等待远征';
    }
    const achN = base ? SDT.Meta.ACHIEVEMENTS.filter(a => SDT.Meta.isUnlocked(a, base)).length : 0;
    set('akAchTag', `${achN}/${SDT.Meta.ACHIEVEMENTS.length}`);
    set('akCollect', String(Object.keys(base?.collection || {}).length));
    set('akExtracts', String(base?.stats?.extracts || 0));
    set('akVerHex', document.getElementById('gameVersion')?.textContent || 'v…');
  }

  // ---------- 存档档位选择 ----------
  // mode: 'start' = 开始/继续游戏（进入存档：有未完成对局直接续打，否则先进基地）
  //       'base'  = 从主菜单直达基地（该档有未完成对局时需先续打，不开放）
  function fmtPlayTime(seconds) {
    const sec = Math.max(0, Math.floor(+seconds || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h} 小时 ${String(m).padStart(2, '0')} 分` : `${m} 分钟`;
  }

  async function exitToTitle() {
    // 迭代评审 09-20 客户端岗：守卫收窄不删——仅战斗未收尾时直接 return（不做「同步收战斗
    // 再跳」：battle:end 异步续流会在标题页叠层）；触发点已全是脚本流（龙巢撤离/备战返回/选角退出），
    // 人工入口早已改走 openLeaveMenu。immediate 同步关层消除 210ms 淡出窗口竞态（龙巢撤离死锁根因），
    // 详见 ui.js hideOverlay——曾致撤离后卡巢穴图、可无限重刷 BOSS 奖励
    if (game.battleActive) return;
    const saved = await saveSession();
    if (!saved.ok) { UI.log(saved.message || '[[icon:cross]] 进度尚未保存，请重试', 'warn'); return false; }
    UI.hideOverlay({ immediate: true });
    showTitle();
  }

  async function quitGame() {
    cancelPendingPageEntries();
    const saved = await saveSession();
    if (!saved.ok) { UI.log(saved.message || '[[icon:cross]] 进度尚未保存，请重试', 'warn'); return false; }
    if (window.sdtDesktop && window.sdtDesktop.isDesktop) {
      window.sdtDesktop.quit(); // 桌面版：存档已保留，真正退出程序
      return;
    }
    UI.hideScreen(document.getElementById('title'));
    UI.showScreen(document.getElementById('exitScr'));
    // 网页版无法真正关闭程序：显示告别屏即可（存档已保留，可重新进入继续）
  }
  return Object.freeze({ setLobby, showTitle, startNewGame, exitToTitle, quitGame, openSettings, openLeaveMenu, openTitleGuide, openSuggestionInbox, openDataPageUi });
}
