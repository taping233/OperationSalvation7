/* ui.overlay.js —— #overlay 弹窗容器：开层/关层、Esc 与取消语义探测、房间视图、
 * 帮助弹层主题、焦点陷阱与背景 inert（09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的 el/_acts 等状态。
 */
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;

export const overlayMethods = {
  helpTopics: {},  // pageId -> { title, html, back }（? 帮助弹层主题，页面渲染时注册）
  _overlayReturnFocus: null,
  _overlayInerted: [],

  // ---------- ? 帮助弹层：页面说明文字统一收进二级界面 ----------
  // 页面渲染时 registerHelp(id, {title, html, back})，并在页头放 helpBtn(id)；
  // 点 ? 打开帮助，点「返回」执行 back() 重绘原页面。
  registerHelp(id, def) { this.helpTopics[id] = def; },
  helpBtn(id) {
    // 2026-09-07 留言：全角"？ "字形墨迹不居中，换 SVG 问号保证几何居中
    return `<button class="help-btn" data-act="openHelp" data-page="${id}" title="查看说明"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M8.1 9a3.9 3.9 0 1 1 6.05 3.27c-1.25.83-2.15 1.55-2.15 3.03v.3" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"/><circle cx="12" cy="19.7" r="1.35" fill="currentColor"/></svg></button>`;
  },
  showHelp(page) {
    const t = this.helpTopics[page];
    if (!t) return;
    this.showOverlay(`[[icon:question]] ${t.title}`, `
      <div class="help-body">${t.html}</div>
      <div class="ov-btns"><button class="ov-btn ok" data-act="helpBack">↩ 返回</button></div>`, true);
    this.act('helpBack', () => { if (typeof t.back === 'function') t.back(); });
  },

  beginRoom() {
    this._roomActive = true;
    this.el.overlay.classList.add('room-view');
  },

  endRoom() {
    this._roomActive = false;
    this.el.overlay.classList.remove('room-view');
    const card = this.el.ovBody && this.el.ovBody.parentElement;
    if (card) card.classList.remove('room');
  },

  showOverlay(title, bodyHtml, mode, options = {}) {
    // 失败/清空类标题用红色语义
    if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
    const wasOpen = !this.el.overlay.hidden;
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
    if (victoryCard && /搜刮！/.test(title)) { victoryCard.classList.remove('fx-victory'); void victoryCard.offsetWidth; victoryCard.classList.add('fx-victory'); }
    this.el.ovBody.innerHTML = SDT.Icons.rich(bodyHtml);
    // 广播当前弹层模式：战斗序列帧层据此做白名单（只有 battle 模式可见，2026-09-13 留言）
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
    // 主循环每帧读此标志判断“战斗页是否盖在画布上”；battle-stage 只会经这里进
    // overlay（ovBody 无其他写入点），按内容缓存一次，免去每帧全子树 querySelector
    this._hasBattleStage = bodyHtml.includes('battle-stage');
    const card = this.el.ovBody.parentElement;
    card.classList.toggle('wide', mode === true || mode === 'wide' || mode === 'chest' || mode === 'discover');
    card.classList.toggle('chest', mode === 'chest');   // 战利品/开箱浮层专属类（2026-09-09 重做放大）
    card.classList.toggle('discover', mode === 'discover');   // 发现浮层（2026-09-09 留言 #12：虚化背景而非纯黑）
    card.classList.toggle('battle', mode === 'battle');
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
    if (wasOpen && (this._lastMode !== mode || mode === 'page')) {
      card.classList.remove('swap');
      void card.offsetWidth;
      card.classList.add('swap');
    }
    const prevMode = this._lastMode;
    this._lastMode = mode;
    this.el.overlay.hidden = false;
    // 右上角 × 显隐：只有能被取消类入口安全关闭的浮层才显示（必选流程/战斗页自动隐藏）。
    // 卡牌库整页头部自带关闭钮（photo-studio v3 的 pg-close），全局 × 与它并排重复
    // （2026-09-20 老板：卡牌库有两个退出键）——该页隐藏全局 ×，Esc 仍走页内钮关闭
    if (this.el.ovCloseX) this.el.ovCloseX.hidden = !this._canCancelOverlay() || !!this.el.ovBody.querySelector('.card-library-page');
    this._isolateOverlayBackground();
    // 全屏覆盖型页面（卡牌库/整备整页/战斗房间/宝箱）：被盖住的主页动画一律暂停
    // （2026-09-07 老板：动画不出现在画面中就暂停，回到页面再恢复）。
    // 实测卡牌库打开时标题雪花+余烬继续跑，帧率被拖到 10fps。
    // 半透明弹窗（背包/事件/场景）底下画面可见，不置位。
    document.body.classList.toggle('page-covered',
      this.el.overlay.classList.contains('opaque') ||
      this.el.overlay.classList.contains('room-view') ||
      mode === 'chest');
    // 替代 winter.css 的 body:has(#overlay.opaque) 选择器：:has 会在 overlay 子树
    // 每次重建时放大整页样式失效范围，body 类只触发一次单类切换
    document.body.classList.toggle('page-opaque', this.el.overlay.classList.contains('opaque'));
    // page 全屏页自带 CSS 入场动画（.card.page 的 pgIn），WAAPI 再叠一层会与
    // CSS 动画互相覆盖造成过渡期跳帧——这里只跑 CSS 那套。
    // bagpage 背包页同理（2026-09-19 留言 #3：展开动画走 .card.bag-page 的 bagIn）
    if ((!wasOpen || prevMode !== mode) && SDT.Motion && mode !== 'page' && mode !== 'bagpage') SDT.Motion.overlayIn(card);
    // 只在弹窗真正打开/切换模式时播开窗音效——战斗内反复 render 不刷音效
    if (!wasOpen || prevMode !== mode) {
      SDT.Sound.sfx('open');
      // 焦点导航（game-ui-ux）：显式首焦点优先；否则优先安全的取消/返回
      // 语义，避免确认页默认把不可逆动作放在 Enter 的第一击上。
      requestAnimationFrame(() => {
        if (this.el.overlay.hidden) return;
        const target = this._resolveOverlayInitialFocus(options.initialFocus);
        if (target) target.focus({ preventScroll: true });
        else this.el.overlay.focus({ preventScroll: true });
      });
    }
    // U1（2026-09-19 交互走查）：整页节点/场景壳的背景大图首次打开才发请求，
    // 解码期间页面近乎纯黑、无任何反馈。这里读出 data-asset-key 元素的背景 URL，
    // 未就绪时挂 bg-loading 类（CSS 显示「正在进入…」微提示），图片到齐后自动摘除。
    this._checkPageBg();
  },

  // U1：整页背景就绪检测。_bgReady 缓存已确认加载过的 URL，重复打开零开销。
  _bgReady: null,
  _checkPageBg() {
    const host = this.el.ovBody.querySelector('[data-asset-key]');
    if (!host) return;
    const m = /url\("?([^")]+)"?\)/.exec(getComputedStyle(host).backgroundImage || '');
    if (!m) return;
    const url = m[1];
    if (this._bgReady && this._bgReady.has(url)) return;
    if (!this._bgReady) this._bgReady = new Set();
    const probe = new Image();
    const done = () => {
      this._bgReady.add(url);
      // 页面可能在加载期间被换掉：只摘当前在台面上的 loading 类
      if (!this.el.overlay.hidden && this.el.ovBody.contains(host)) host.classList.remove('bg-loading');
    };
    probe.onload = done;
    if (probe.complete && probe.naturalWidth > 0) { done(); return; }
    host.classList.add('bg-loading');
    probe.src = url;
  },

  // 跳转代际令牌（迭代评审 09-20 QA 岗）：exitToTitle 的 immediate 关层即「跳转发生」；
  // 计划在跳转后迟到的 showOverlay 可自留 token 并用 layerValid() 自检，失败即放弃开层
  _jumpSeq: 0,
  layerToken() { return ++this._jumpSeq; },
  layerValid(t) { return t === this._jumpSeq; },
  // 背包关闭回调（game.bag bindBagMixins 晚绑定注册，避免 ui→bag 静态成环）：
  // Esc/遮罩关背包必须走 closeBackpack 的状态复位，直接 hideOverlay 会把 game.state 卡死在 modal
  _bagCloseHook: null,

  hideOverlay(opts) {
    const immediate = !!(opts && opts.immediate);
    // 已关闭且无挂起收尾：短路（迭代评审 09-20 客户端岗）——迟到的 transition/chest 收尾
    // 不再空跑 finish、重放 close 音
    if (!this._hideTimer && this.el.overlay.hidden) return;
    // 淡出中重复触发：普通调用忽略；immediate 调用清掉挂起收尾改为同步执行——
    // 消灭「210ms 淡出窗口内二次跳转/开层被旧 finish 撕掉」竞态（龙巢撤离死锁根因）
    if (this._hideTimer) {
      if (!immediate) return;
      clearTimeout(this._hideTimer);
      this._hideTimer = null;
    }
    this._lastMode = null;
    this._acts = {};
    this._inputHandler = null;
    this._hoverHandler = null;
    SDT.Sound.sfx('close');
    const card = this.el.ovBody.parentElement;
    // 不透明整屏页淡出：boss 留言 #52 要求所有界面退出都有过渡动画（200ms 淡出+下移）；
    // room-view（战斗/房间页）例外保持瞬隐——留言 #33 实测整屏淡出每帧全屏重合成是
    // 「继续」卡顿来源，性能口径优先（overlays.css 有同步注释）。
    // immediate（exitToTitle 收口）同样走同步：跳转不允许留任何异步尾巴
    const instant = immediate || this.el.overlay.classList.contains('room-view');
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
      this.el.overlay.classList.remove('closing');
      this.el.overlay.classList.remove('opaque');
      this.el.overlay.classList.remove('bag-full');
      this.el.overlay.classList.remove('fx-doom');
      this.el.overlay.classList.remove('fx-glass');
      this.el.overlay.hidden = true;
      this._restoreOverlayBackground();
      // 隐藏不等于释放：卡牌库一次可生成 5k+ DOM 节点与数百张 <img>。关闭后若仍留在
      // ovBody，会长期占用 JS/DOM/图片资源，反复开关虽不线性叠加但峰值永不回落。
      // showOverlay 每次都会完整重建内容，因此关闭动画完成后可以安全清空。
      this.el.ovBody.replaceChildren();
      this._hasBattleStage = false;
      // 关闭不透明页面后，Canvas 从低频巡检态立即醒来补一帧，避免最多 250ms 的回图延迟。
      SDT.RenderScheduler?.invalidate?.();
      const returnFocus = this._overlayReturnFocus;
      this._overlayReturnFocus = null;
      if (returnFocus && returnFocus.isConnected && !returnFocus.closest('[inert]') && !returnFocus.hidden) {
        returnFocus.focus({ preventScroll: true });
      }
    };
    if (instant) { finish(); return; }
    this.el.overlay.classList.add('closing');
    // 等淡出动画播完再真正隐藏并还原布局类，避免淡出期间跳版；
    // 期间 hidden 仍为 false，输入拦截逻辑不受影响
    this._finishHide = finish;
    this._hideTimer = setTimeout(finish, 210);
  },

  // Esc 关闭当前浮层（2026-09-09 老板：浮层要能按 Esc 关）。
  // 返回 true 表示已处理。战斗页与结算类页面（没有取消按钮可代点）一律不关，
  // 避免把必须做出选择的流程（撤离失败 / 宝箱强选 / BOSS 编组）跳过。
  closeTopOverlayByEsc() {
    if (this.el.overlay.hidden) return false;
    const mode = this._lastMode;
    if (mode === 'battle') return false;   // 战斗中 Esc 只清瞄准，不退战斗
    // 优先模拟页面上的「取消语义」按钮：宝箱「跳过」、环间门「留下」、商店「离开」等。
    // 图标关闭钮（背包 × / 卡池 ×）文本为空，按 data-act 与 aria-label/title 兜底匹配
    const cancelBtn = this._findCancelBtn();
    if (cancelBtn) { cancelBtn.click(); return true; }
    // 场景演出页（点击任意处继续）：走 sceneNext 通道
    if (this.el.ovBody.querySelector('[data-act="sceneNext"]')) { this.act('sceneNext'); return true; }
    // 背包这类只有信息没有按钮的浮层：走 bag 侧注册的关闭回调（closeBackpack 唯一收口，
    // 复位 game.state）；钩子未注册时（启动早期）退回直接关
    if (mode === 'bag' || mode === 'bagpage') { if (this._bagCloseHook) this._bagCloseHook(); else this.hideOverlay(); return true; }
    return false;
  },

  // 面板内「取消语义」按钮探测（Esc / 右上角 × / 遮罩点击共用）
  _findCancelBtn() {
    return [...this.el.ovBody.querySelectorAll('button')]
      .find(b => !b.disabled && !b.closest('[hidden], [aria-hidden="true"]') && (
        /跳过|留下|返回|取消|关闭|离开/.test(b.textContent || '') ||
        /^(closeBag|closeCardPage|closeDesigner|pg-close)$/.test(b.dataset.act || '') ||
        /关闭|返回/.test(b.getAttribute('aria-label') || '') || /关闭|返回/.test(b.getAttribute('title') || '')));
  },

  // 当前浮层是否可通过取消类入口关闭（决定右上角 × 的显隐）
  _canCancelOverlay() {
    if (this.el.overlay.hidden || this._lastMode === 'battle') return false;
    if (this._findCancelBtn()) return true;
    if (this.el.ovBody.querySelector('[data-act="sceneNext"]')) return false;   // 点击任意处继续，无需 ×
    const m = this._lastMode;
    return m === 'bag' || m === 'bagpage';
  },

  _overlayFocusable() {
    const root = this.el.ovBody || this.el.overlay;
    return [...root.querySelectorAll(
      'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), ' +
      'select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], ' +
      '[tabindex]:not([tabindex="-1"])'
    )].filter((el) => !el.closest('[hidden], [aria-hidden="true"]'));
  },

  _resolveOverlayInitialFocus(initialFocus) {
    const root = this.el.ovBody || this.el.overlay;
    let target = null;
    if (initialFocus && initialFocus.nodeType === 1 && root.contains(initialFocus)) target = initialFocus;
    if (!target && typeof initialFocus === 'string') {
      try { target = root.querySelector(initialFocus); } catch { target = null; }
    }
    // HTML 中的 data-initial-focus 是调用方无需接触 DOM 引用的安全显式入口。
    if (!target) target = root.querySelector('[data-initial-focus]');
    if (target && !target.matches('button, input, select, textarea, a[href], [tabindex], [contenteditable="true"]')) target = null;
    if (target && (target.disabled || target.closest('[hidden], [aria-hidden="true"]'))) target = null;
    const focusables = this._overlayFocusable();
    if (!target) {
      // 取消/保留/返回优先；同一规则覆盖「确认丢弃」「放弃对局」等危险弹窗。
      target = focusables.find((el) => {
        const text = `${el.textContent || ''} ${el.getAttribute('aria-label') || ''} ${el.title || ''} ${el.dataset.act || ''}`;
        return /取消|返回|关闭|继续|放回|保留|不删除|不清空|留下/.test(text);
      });
    }
    return target || focusables[0] || null;
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
  },
};
