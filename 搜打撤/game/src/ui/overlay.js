/* ui.overlay.js —— #overlay 弹窗容器：开层/关层、Esc 与取消语义探测、房间视图、
 * 帮助弹层主题、焦点陷阱与背景 inert（09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的 el/_acts 等状态。
 */
// T4 全界面开合成对动画（2026-10-04 D9-T4）：纯副作用 import——模块向 document.head
// 注入 css/motion-transitions.css <link>（恒在 winter.css 等静态样式之后生效）
import './motion-transitions.js';
import { captureOverlayReturnState, createOverlayReturn, restoreOverlayReturnState } from './overlay-return-state.js';
import { clearExpeditionPanel, renderExpeditionPanel } from '../run/expedition.view.js';
import { getOverlayRuntimeTracePanel, syncRuntimeTracePanel } from '../core/runtime-trace-panel.local.js';

/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;

const OVERLAY_FOCUS_SELECTOR =
  'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
  'select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], details > summary:first-of-type, ' +
  '[tabindex]:not([tabindex="-1"])';

export const overlayMethods = {
  helpTopics: {},  // pageId -> { title, html, before?, back }（? 帮助弹层主题，页面渲染时注册）
  _overlayReturnFocus: null,
  _overlayInerted: [],

  // ---------- ? 帮助弹层：页面说明文字统一收进二级界面 ----------
  // 页面渲染时 registerHelp(id, {title, html, before?, back})，并在页头放 helpBtn(id)；
  // 默认保留滚动与帮助入口焦点；back 负责原页面重建和领域有效性检查。
  // 可选 before() 捕获额外页面状态，交给 back(state)；旧返回动作不能跨页面复用。
  registerHelp(id, def) { this.helpTopics[id] = def; },
  helpBtn(id) {
    if (id === 'bag') return '<button class="bag-guide-trigger bag-icbtn" data-act="openHelp" data-page="bag" aria-label="背包使用指南" title="背包使用指南"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 4h6l2 2 2-2h6v15h-6l-2 2-2-2H4Z"/><path d="M12 6v15M7 8h2M7 12h2M15 8h2M15 12h2"/></svg></button>';
    // 2026-09-07 留言：全角"？ "字形墨迹不居中，换 SVG 问号保证几何居中
    return `<button class="help-btn" data-act="openHelp" data-page="${id}" title="查看说明"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8.1 9a3.9 3.9 0 1 1 6.05 3.27c-1.25.83-2.15 1.55-2.15 3.03v.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="19.7" r="1.35" fill="currentColor"/></svg></button>`;
  },
  showHelp(page) {
    const t = this.helpTopics[page];
    if (!t) return;
    const focusTarget = [.../** @type {NodeListOf<HTMLElement>} */ (this.el.ovBody.querySelectorAll('[data-act="openHelp"]'))].find(element => element.dataset.page === page);
    const presentation = captureOverlayReturnState(this.el.overlay, focusTarget);
    const returnState = typeof t.before === 'function' ? t.before() : undefined;
    this.showOverlay(`[[icon:question]] ${t.title}`, `
      <div class="help-body${page === 'bag' ? ' bag-guide' : ''}">${page === 'bag' ? '<header class="bag-guide-heading"><h2>收纳与押运</h2></header>' : ''}${t.html}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="helpBack" data-cancel="true">↩ 返回</button></div>`, true);
    this.act('helpBack', createOverlayReturn({
      revision: this._overlayRevision, getRevision: () => this._overlayRevision,
      isOpen: () => !this.el.overlay.hidden && !this.el.overlay.classList.contains('closing'),
      back: typeof t.back === 'function' ? () => t.back(returnState) : undefined,
      restore: () => restoreOverlayReturnState(this.el.overlay, presentation),
    }));
  },

  beginRoom() {
    this._roomActive = true;
    this.el.overlay.classList.add('room-view');
  },

  endRoom() {
    this._roomActive = false;
    // 奖励页的聚焦可滚动 overflow:hidden 的游戏视口；回地图时恢复HUD原点。
    const viewport = this.el.viewport || document.getElementById('viewport');
    if (viewport) { viewport.scrollTop = 0; viewport.scrollLeft = 0; }
    this.el.overlay.classList.remove('room-view');
    const card = this.el.ovBody && this.el.ovBody.parentElement;
    if (card) card.classList.remove('room');
  },

  showOverlay(title, bodyHtml, mode, options = {}) {
    const revision = this._overlayRevision = (this._overlayRevision || 0) + 1;
    this._cancelPageBg?.();
    this.hideTooltip?.();
    /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'))?._closeCardZoom?.(true);
    if (options.battleBody && !options.battleBody()) return;
    // 失败/清空类标题用红色语义
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    this._finishHide = null;
    const wasOpen = !this.el.overlay.hidden;
    const refreshHub = wasOpen && mode === 'page' &&
      !!/** @type {HTMLElement} */ (this.el.ovBody.querySelector('#hubMain')) && bodyHtml.includes('id="hubMain"');
    if (!wasOpen) {
      const active = document.activeElement;
      this._overlayReturnFocus = active && active !== document.body ? active : null;
    }
    this.el.overlay.classList.remove('closing');
    this.el.overlay.setAttribute('role', 'dialog');
    this.el.overlay.setAttribute('aria-modal', 'true');
    this.el.overlay.setAttribute('aria-labelledby', 'ovTitle');
    this.el.ovTitle.classList.toggle('bad', /失败|清空|删除|倒下/.test(title));
    this.el.ovTitle.innerHTML = SDT.Icons.rich(title);
    // 2026-09-06 #17：战利品结算页 = 战斗胜利动画（1.4s 强调入场）
    const victoryCard = this.el.ovBody.parentElement;
    victoryCard?.classList.remove('fx-victory');
    if (victoryCard && /搜刮！/.test(title)) { victoryCard.classList.remove('fx-victory'); void victoryCard.offsetWidth; victoryCard.classList.add('fx-victory'); }
    // Internal battle path replaces only secondary siblings, never the live scene.
    const content = options.battleBody ? options.battleBody(SDT.Icons.rich(bodyHtml)) : this.el.ovBody;
    if (!content) return;
    if (!options.battleBody) content.innerHTML = SDT.Icons.rich(bodyHtml);
    // 广播当前弹层模式：战斗序列帧层据此做白名单（只有 battle 模式可见，2026-09-13 留言）
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
    if (options.battleBody && !options.battleBody()) return;
    // 主循环每帧读此标志判断“战斗页是否盖在画布上”；battle-stage 只会经这里进
    // overlay（ovBody 无其他写入点），按内容缓存一次，免去每帧全子树 querySelector
    this._hasBattleStage = !!options.battleBody || bodyHtml.includes('battle-stage');
    const card = this.el.ovBody.parentElement;
    card.classList.toggle('wide', mode === true || mode === 'wide' || mode === 'chest' || mode === 'discover');
    card.classList.toggle('chest', mode === 'chest');   // 战利品/开箱浮层专属类（2026-09-09 重做放大）
    card.classList.toggle('discover', mode === 'discover');   // 发现浮层（2026-09-09 留言 #12：虚化背景而非纯黑）
    card.classList.toggle('battle', mode === 'battle' || !!options.battleBody);
    card.classList.toggle('bag-modal', mode === 'bag');
    card.classList.toggle('bag-page', mode === 'bagpage');
    card.classList.toggle('page', mode === 'page');
    card.classList.toggle('scene', mode === 'scene');
    // 宝箱浮层悬在原画面上：即使处于房间结算流也不吃全屏 room 样式
    card.classList.toggle('room', this._roomActive && mode !== 'page' && mode !== 'bag' && mode !== 'bagpage' && mode !== 'chest' && mode !== 'discover');
    // 战斗弹窗也按房间页处理：主循环据此冻结棋盘渲染/暂停壁纸解码，
    // 并关掉 #overlay 的大面积 backdrop blur（非房间路径开战时的卡顿源）
    // 宝箱/发现浮层例外：不吃 room-view，保留暗纱+blur 衬托悬浮面板
    this.el.overlay.classList.toggle('room-view', mode === 'battle' || (this._roomActive && mode !== 'chest' && mode !== 'discover'));
    this.el.overlay.classList.toggle('bag-full', mode === 'bagpage');
    this.el.overlay.classList.toggle('opaque', mode === 'page' || mode === 'bagpage');
    // 发现/选卡浮层（discover/chest，2026-09-15）：背景一律半透明暗纱 + 全屏虚化，
    // 不再吃 room-view 的整屏不透明灰（样式见 winter.css「发现/选卡浮层统一重做」块）
    this.el.overlay.classList.toggle('pick-veil', mode === 'discover' || mode === 'chest');
    // 撤离失败页（2026-09-13 留言：UI 重做 + 背景透明）：标记在 overlay 上，
    // 让该页脱离 room-view 的整屏不透明底，改走半透明暗纱 + 玻璃面板
    this.el.overlay.classList.toggle('fx-doom', mode === 'doom');
    // 玻璃确认浮层（2026-09-19 留言 #25「丢弃卡牌？」等小确认页背景透明）：
    // 同 fx-doom 的暗纱透底，面板走中性色调玻璃卡
    this.el.overlay.classList.toggle('fx-glass', mode === 'glass');
    // 已打开状态下且弹窗模式变化（场景→战斗→结算等）时重播滑入动画；
    // 战斗内反复 render（同模式）不重播，避免每出一张卡就闪一次
    // 2026-09-12 留言 #33：page 页之间的返回/前进导航也重播入场动画（battle/bag 等高频重绘模式除外）
    card.classList.toggle('hub-refresh', refreshHub);
    if (!document.body.classList.contains('interface-motion') && wasOpen && !refreshHub && (this._lastMode !== mode || mode === 'page')) {
      card.classList.remove('swap');
      void card.offsetWidth;
      card.classList.add('swap');
    }
    else if (refreshHub || document.body.classList.contains('interface-motion')) card.classList.remove('swap');
    const prevMode = this._lastMode;
    this._lastMode = mode;
    this.el.overlay.hidden = false;
    clearExpeditionPanel(this.el.overlay.ownerDocument);
    this._isolateOverlayBackground();
    // 全屏覆盖型页面（卡牌库/整备整页/战斗房间/宝箱）：被盖住的主页动画一律暂停
    // （2026-09-07 老板：动画不出现在画面中就暂停，回到页面再恢复）。
    // 实测卡牌库打开时标题雪花+余烬继续跑，帧率被拖到 10fps。
    // 半透明弹窗（背包/事件/场景）底下画面可见，不置位。
    document.body.classList.toggle('page-covered',
      !!options.battleBody || this.el.overlay.classList.contains('opaque') ||
      this.el.overlay.classList.contains('room-view') ||
      mode === 'chest');
    // 替代 winter.css 的 body:has(#overlay.opaque) 选择器：:has 会在 overlay 子树
    // 每次重建时放大整页样式失效范围，body 类只触发一次单类切换
    document.body.classList.toggle('page-opaque', this.el.overlay.classList.contains('opaque'));
    // 取消入口的可见性检查会读取样式；先完成背景隔离和页面模式写入，避免读写交错。
    // 右上角 × 显隐：只有能被取消类入口安全关闭的浮层才显示（必选流程/战斗页自动隐藏）。
    // 卡牌库整页头部自带关闭钮（photo-studio v3 的 pg-close），全局 × 与它并排重复
    // （2026-09-20 老板：卡牌库有两个退出键）——该页隐藏全局 ×，Esc 仍走页内钮关闭
    // 背包页同理（2026-10-15 老板：退出键复用 archive-back 放左上，多余的退出键删除）
    if (this.el.ovCloseX) this.el.ovCloseX.hidden = !this._canCancelOverlay() || !!/** @type {HTMLElement} */ (content.querySelector('.card-library-page, .shop-market, .shop-exchange, .reward-replica, .event-scene, .bag-view'));
    // page 全屏页自带 CSS 入场动画（.card.page 的 pgIn），WAAPI 再叠一层会与
    // CSS 动画互相覆盖造成过渡期跳帧——这里只跑 CSS 那套。
    // bagpage 背包页同理（2026-09-19 留言 #3：展开动画走 .card.bag-page 的 bagIn）
    // T4（2026-10-04）：战斗快档弹层（发现/选卡、战斗设置、墓地）与确认小窗档
    // （玻璃确认 .glass-panel、离开对局卡 leaveSave——附录 B 档3 fade+scale(.98) .22s）
    // 走纯 CSS（motion-transitions.css），WAAPI（y18px）仅标准弹层。
    // 主控 10-04 复核处置：glass 模式整体按确认小窗档（hub 材料/仓库确认窗
    // 同为 mode'glass' 而 markup 无 .glass-panel 锚点，按模式判定防漏）。
    if (!document.body.classList.contains('interface-motion') && (!wasOpen || prevMode !== mode) && SDT.Motion && mode !== 'page' && mode !== 'bagpage' && mode !== 'glass' &&
        !(mode === 'discover' || /** @type {HTMLElement} */ ((options.battleBody ? content : card).querySelector('.bt-settings, .bt-gy-list, .glass-panel, [data-act="leaveSave"]')))) SDT.Motion.overlayIn(card);
    // 开窗音效判定与文末场景音取景共用这一次查询（两者间无 DOM 增删，结果一致）
    const soundScene = /** @type {HTMLElement} */ (content.querySelector('.node-pg, .flow-transition'));
    // 只在弹窗真正打开/切换模式时播开窗音效——战斗内反复 render 不刷音效
    if (!wasOpen || prevMode !== mode) {
      if (!soundScene) SDT.Sound.sfx('open');
    }
    // 同模式换页也会替换聚焦节点；在新页内已有主动焦点时保留它，
    // 显式首焦点仍优先，关闭或较新页面则取消本次延后聚焦。
    requestAnimationFrame(() => {
      if (this.el.overlay.hidden || this._overlayRevision !== revision) return;
      const explicitFocus = options.initialFocus || /** @type {HTMLElement} */ (content.querySelector('[data-initial-focus]'));
      if (!explicitFocus && this.el.overlay.contains(document.activeElement) && !document.activeElement.closest('[inert]')) return;
      const target = this._resolveOverlayInitialFocus(explicitFocus);
      if (target) target.focus({ preventScroll: true });
      else this.el.overlay.focus({ preventScroll: true });
    });
    // U1（2026-09-19 交互走查）：整页节点/场景壳的背景大图首次打开才发请求，
    // 解码期间页面近乎纯黑、无任何反馈。这里读出 data-asset-key 元素的背景 URL，
    // 未就绪时挂 bg-loading 类（CSS 显示「正在进入…」微提示），图片到齐后自动摘除。
    this._checkPageBg(content);
    const soundTone = soundScene && [...soundScene.classList].find(name => name.startsWith('sc-'));
    SDT.Sound.scene?.(soundScene?.dataset.musicScene || (soundTone ? soundTone.slice(3) : null), soundScene?.dataset.assetKey || '', { mode });
  },

  // U1：整页背景就绪检测。_bgReady 缓存已确认加载过的 URL，重复打开零开销。
  _bgReady: null,
  _checkPageBg(root = this.el.ovBody) {
    this._cancelPageBg?.();
    this._pageBgReady = Promise.resolve();
    const host = /** @type {HTMLElement} */ (root.querySelector('[data-asset-key]'));
    if (!host) return;
    // Photo IMG loading is owned by the card-art queue, not a CSS background.
    if (host.tagName === 'IMG' && host.closest('.photo-studio-v3')) return;
    // Icons.img 的位图内容由 src 加载，不是页面 CSS 背景。其他 IMG 仍按原逻辑检查。
    if (host.matches('img.ic[data-asset-key^="icon-"]')) return;
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(host).backgroundImage || '');
    if (!m) return;
    const url = m[1];
    if (this._bgReady && this._bgReady.has(url)) return;
    if (!this._bgReady) this._bgReady = new Set();
    const probe = new Image();
    let resolveReady;
    this._pageBgReady = new Promise((/** @type {(value?: void) => void} */ resolve) => { resolveReady = resolve; });
    let active = true;
    let timeout;
    const cancel = () => {
      resolveReady(false);
      active = false;
      clearTimeout(timeout);
      probe.onload = null;
      probe.onerror = null;
      host.classList.remove('bg-loading');
      host.removeAttribute('aria-busy');
      if (this._cancelPageBg === cancel) this._cancelPageBg = null;
    };
    const finish = success => {
      if (!active) return;
      if (success) this._bgReady.add(url);
      resolveReady(success);
      cancel();
    };
    probe.onload = () => {
      if (typeof probe.decode === 'function') probe.decode().then(() => finish(true), () => finish(false));
      else finish(true);
    };
    // 错误和超时不缓存为成功；离场后迟到的加载不会更改下一页。
    probe.onerror = () => finish(false);
    this._cancelPageBg = cancel;
    host.classList.add('bg-loading');
    host.setAttribute('aria-busy', 'true');
    timeout = setTimeout(() => finish(false), 8000);
    probe.src = url;
    if (probe.complete && probe.naturalWidth > 0) probe.onload(new Event("load"));
  },

  // 背包关闭回调（game.bag bindBagMixins 晚绑定注册，避免 ui→bag 静态成环）：
  // Esc/遮罩关背包必须走 closeBackpack 的状态复位，直接 hideOverlay 会把 game.state 卡死在 modal
  _bagCloseHook: null,

  hideOverlay(opts) {
    const immediate = !!(opts && opts.immediate);
    // 已关闭或正在淡出时，不重复广播关闭、撤销页面任务或推进返回令牌。
    if (!this._hideTimer && this.el.overlay.hidden) return;
    if (this._hideTimer) {
      if (immediate) {
        clearTimeout(this._hideTimer);
        this._finishHide();
      }
      return;
    }
    this._overlayRevision = (this._overlayRevision || 0) + 1;
    this._cancelPageBg?.();
    this.hideTooltip?.();
    /** @type {import('./ui.dom.types.js').CardZoomElement} */ (document.getElementById('cardZoom'))?._closeCardZoom?.(true);
    document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
    this._lastMode = null;
    this._acts = {};
    this._inputHandler = null;
    this._hoverHandler = null;
    SDT.Sound.sfx('close');
    SDT.Sound.scene?.(null);
    const card = this.el.ovBody.parentElement;
    // 不透明整屏页淡出：boss 留言 #52 要求所有界面退出都有过渡动画（200ms 淡出+下移）；
    // room-view（战斗/房间页）例外保持瞬隐——留言 #33 实测整屏淡出每帧全屏重合成是
    // 「继续」卡顿来源，性能口径优先（overlays.css 有同步注释）。
    // T4（2026-10-04）：战斗/房间态轻弹层（战斗设置/墓地、玻璃确认）例外不瞬隐——
    // 留 160ms 给卡片层播反向动画（motion-transitions.css 只动卡片，
    // 容器不播整屏淡出，留言 #33 的整屏重合成口径保持），到点同步收场。
    // immediate（exitToTitle 收口）同样走同步：跳转不允许留任何异步尾巴
    const btFastClose = !immediate && this.el.overlay.classList.contains('room-view') &&
      !!/** @type {HTMLElement} */ (card.querySelector?.('.bt-settings, .bt-gy-list, .glass-panel'));
    const instant = immediate || document.body.classList.contains('reduce-motion') ||
      (this.el.overlay.classList.contains('room-view') && !btFastClose);
    const finish = () => {
      this._hideTimer = null;
      this._finishHide = null;
      document.body.classList.remove('page-covered');
      document.body.classList.remove('page-opaque');
      card.classList.remove('wide');
      card.classList.remove('battle');
      card.classList.remove('bag-modal');
      card.classList.remove('bag-page');
      card.classList.remove('page');
      card.classList.remove('scene');
      card.classList.remove('swap');
      card.classList.remove('room');
      card.classList.remove('chest', 'discover', 'fx-victory', 'hub-refresh');
      this.el.overlay.classList.remove('closing');
      this.el.overlay.classList.remove('opaque');
      this.el.overlay.classList.remove('bag-full');
      this.el.overlay.classList.remove('fx-doom');
      this.el.overlay.classList.remove('fx-glass');
      this.el.overlay.classList.remove('pick-veil', 'room-view');
      this.el.overlay.hidden = true;
      this._restoreOverlayBackground();
      if (SDT.game) renderExpeditionPanel(document.getElementById('routePanel'), SDT.game, name => SDT.Icons.img(name));
      // 隐藏不等于释放：卡牌库一次可生成 5k+ DOM 节点与数百张 <img>。关闭后若仍留在
      // ovBody，会长期占用 JS/DOM/图片资源，反复开关虽不线性叠加但峰值永不回落。
      // showOverlay 每次都会完整重建内容，因此关闭动画完成后可以安全清空。
      this.el.ovBody.replaceChildren();
      this._hasBattleStage = false;
      // 关闭不透明页面后，Canvas 从低频巡检态立即醒来补一帧，避免最多 250ms 的回图延迟。
      SDT.RenderScheduler?.invalidate?.();
      let returnFocus = this._overlayReturnFocus;
      this._overlayReturnFocus = null;
      // 工具已随开层卸载，回地图后把焦点交给同一动作的新按钮。
      if (returnFocus?.dataset?.expeditionTool && !returnFocus.isConnected) {
        const returnTool = returnFocus.dataset.expeditionTool;
        returnFocus = [...document.querySelectorAll('[data-expedition-tool]')].find(element =>
          /** @type {HTMLElement} */ (element).dataset.expeditionTool === returnTool);
      }
      if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[inert]') && !returnFocus.hidden) {
        returnFocus.focus({ preventScroll: true });
      }
    };
    if (instant) { finish(); return; }
    this.el.overlay.classList.add('closing');
    // 等淡出动画播完再真正隐藏并还原布局类，避免淡出期间跳版；
    // 期间 hidden 仍为 false，输入拦截逻辑不受影响
    this._finishHide = finish;
    // 公共编排提供实际退出时长；未安装公共编排时沿用原生窗口。
    // 原生普通窗口保留225ms裕量（对 boot.test.js:256 固定等 230ms
    // 留出容错，避免同到期零裕量竞态；opaque 卡片 0.24s 尾段 15ms 在容器已透明后，
    // 截断不可辨）
    this._hideTimer = setTimeout(finish, this._motionExitDuration ?? (btFastClose ? 160 : 225));
  },

  // Esc 关闭当前浮层（2026-09-09 老板：浮层要能按 Esc 关）。
  // 返回 true 表示已处理。战斗页与结算类页面（没有取消按钮可代点）一律不关，
  // 避免把必须做出选择的流程（撤离失败 / 宝箱强选 / BOSS 编组）跳过。
  closeTopOverlayByEsc() {
    if (this.el.overlay.hidden) return false;
    const mode = this._lastMode;
    if (mode === 'battle') {
      // 战斗结束残留页（09-26 agent 死锁修复）：finish() 不清 ovBody，战斗格无掉落
      // 浮层时无「下一浮层覆盖」清理，战斗 DOM + overlay 开着卡死 agent（noop 死等
      // wait-limit）。battleActive 已 false = 「Esc 不退战斗」语义失效，直接关恢复地图；
      // 战斗进行中保持原语义（Esc 只清瞄准，不退战斗）
      const battleStillOn = (() => {
        try { return !!window.SDT?.game?.battleActive; } catch { return true; }
      })();
      if (!battleStillOn) { this.hideOverlay(); return true; }
      return false;
    }
    // 优先模拟页面上的「取消语义」按钮：宝箱「跳过」、环间门「留下」、商店「离开」等。
    // 图标关闭钮（背包 × / 卡池 ×）文本为空，按 data-act 与 aria-label/title 兜底匹配
    const cancelBtn = this._findCancelBtn();
    if (cancelBtn) { cancelBtn.click(); return true; }
    // 背包这类只有信息没有按钮的浮层：走 bag 侧注册的关闭回调（closeBackpack 唯一收口，
    // 复位 game.state）；钩子未注册时（启动早期）退回直接关
    if (mode === 'bag' || mode === 'bagpage') { if (this._bagCloseHook) this._bagCloseHook(); else this.hideOverlay(); return true; }
    return false;
  },

  // 面板内「取消语义」按钮探测（Esc / 右上角 × / 遮罩点击共用）
  _findCancelBtn() {
    const styles = new Map();
    const buttons = [.../** @type {NodeListOf<HTMLButtonElement>} */ (this.el.ovBody.querySelectorAll('button'))]
      .filter(b => b.dataset.cancel !== 'false')
      // Card rules can contain 返回/离开; inspection or selection is never an inferred cancel.
      .filter(b => b.dataset.cancel === 'true' || !b.matches('.reward-card, .event-choice-card, .bt-card'));
    return buttons.find(b => b.dataset.cancel === 'true' && isAvailableOverlayFocusTarget(b, styles)) || buttons.find(b => (
        /跳过|留下|返回|取消|关闭|离开/.test(b.textContent || '') ||
        /^(closeBag|closeCardPage|closeDesigner|pg-close)$/.test(b.dataset.act || '') ||
        /关闭|返回/.test(b.getAttribute('aria-label') || '') || /关闭|返回/.test(b.getAttribute('title') || '')) && isAvailableOverlayFocusTarget(b, styles));
  },

  // 当前浮层是否可通过取消类入口关闭（决定右上角 × 的显隐）
  _canCancelOverlay() {
    if (this.el.overlay.hidden || this._lastMode === 'battle') return false;
    if (this._findCancelBtn()) return true;
    const m = this._lastMode;
    return m === 'bag' || m === 'bagpage';
  },

  _overlayFocusable() {
    const styles = new Map();
    const root = this.el.ovBody || this.el.overlay;
    const focusables = [...root.querySelectorAll(OVERLAY_FOCUS_SELECTOR)];
    const panel = getOverlayRuntimeTracePanel(this.el.overlay);
    if (panel && !root.contains(panel)) focusables.push(...panel.querySelectorAll(OVERLAY_FOCUS_SELECTOR));
    return focusables.filter((el) => isAvailableOverlayFocusTarget(el, styles) && !(el.hasAttribute('tabindex') && el.tabIndex < 0));
  },

  _resolveOverlayInitialFocus(initialFocus) {
    const root = this.el.ovBody || this.el.overlay;
    let target = null;
    if (initialFocus && initialFocus.nodeType === 1 && root.contains(initialFocus)) target = initialFocus;
    if (!target && typeof initialFocus === 'string') {
      try { target = root.querySelector(initialFocus); } catch { target = null; }
    }
    // HTML 中的 data-initial-focus 是调用方无需接触 DOM 引用的安全显式入口。
    if (!target) target = /** @type {HTMLElement} */ (root.querySelector('[data-initial-focus]'));
    if (target && !target.matches('button, input, select, textarea, a[href], [tabindex], [contenteditable="true"], details > summary:first-of-type')) target = null;
    if (target && !isAvailableOverlayFocusTarget(target)) target = null;
    if (target) return target;
    // 首焦点只需要一个有效目标；先按语义筛候选，再读可见性，避免为整页表单
    // 的每个输入都计算样式。缓存只活在本次调用，Tab/下一次解析仍读取当前 DOM。
    const styles = new Map();
    const candidates = [...root.querySelectorAll(OVERLAY_FOCUS_SELECTOR)]
      .filter(el => !(el.hasAttribute('tabindex') && el.tabIndex < 0));
    const preferred = candidates.find(el => {
      const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.dataset.act || ''}`;
      return /取消|返回|关闭|继续|放回|保留|不删除|不清空|留下/.test(text)
        && isAvailableOverlayFocusTarget(el, styles);
    });
    return preferred || candidates.find(el => isAvailableOverlayFocusTarget(el, styles)) || null;
  },

  _trapOverlayFocus(e) {
    const focusables = this._overlayFocusable();
    if (!focusables.length) {
      e.preventDefault();
      this.el.overlay.focus({ preventScroll: true });
      return;
    }
    const active = document.activeElement;
    const index = focusables.indexOf(active);
    if (e.shiftKey) {
      if (index <= 0) { e.preventDefault(); focusables[focusables.length - 1].focus({ preventScroll: true }); }
    } else if (index < 0 || index === focusables.length - 1) {
      e.preventDefault(); focusables[0].focus({ preventScroll: true });
    }
  },

  _isolateOverlayBackground() {
    // The registered opt-in controls stay inside the modal, not exempt siblings.
    syncRuntimeTracePanel(this.el.overlay);
    if (this._overlayInerted.length) return;
    let node = this.el.overlay;
    while (node && node.parentElement) {
      for (const sibling of node.parentElement.children) {
        if (sibling === node || sibling.hasAttribute('inert')) continue;
        // 右键建议层设计为叠加在任意界面（含 overlay）之上的常驻交互层，
        // 被 inert 后确认/取消/输入框在弹层页面（战斗/基地等）全部点不动
        if (sibling.id === 'sugLayer') continue;
        sibling.setAttribute('inert', '');
        this._overlayInerted.push(sibling);
      }
      node = node.parentElement;
    }
  },

  _restoreOverlayBackground() {
    for (const el of this._overlayInerted.splice(0)) el.removeAttribute('inert');
    syncRuntimeTracePanel(this.el.overlay);
  },
};

// Keep sequential focus and explicit initial focus inside the active dialog surface.
// Native :disabled preserves the first-legend exception of disabled fieldsets.
function isAvailableOverlayFocusTarget(element, styles = new Map()) {
  if (element.matches(':disabled, input[type="hidden"]') ||
      element.closest('[hidden], [aria-hidden="true"], [inert]')) return false;
  const styleOf = node => {
    if (!styles.has(node)) styles.set(node, getComputedStyle(node));
    return styles.get(node);
  };
  // Visibility is inherited but can be explicitly restored by a descendant.
  if (['hidden', 'collapse'].includes(styleOf(element).visibility)) return false;
  for (let node = element; node; node = node.parentElement) {
    if (styleOf(node).display === 'none') return false;
    // A closed disclosure exposes only its first direct summary, even when a
    // nested details is open. The details element itself remains visible.
    if (node !== element && node.matches('details:not([open])')) {
      const summary = /** @type {HTMLElement} */ (node.querySelector(':scope > summary'));
      if (!summary?.contains(element)) return false;
    }
  }
  return true;
}

