// @ts-check
/* ui.hud.js —— HUD 常驻区：顶栏回合/经济/血条/背包浮动键刷新、日志面板、tooltip 空转桩
 * （09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的 el 与各 _last* 缓存。
 */
import { storeSet } from '../core/storage.js';
import { renderExpeditionPanel } from '../run/expedition.view.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
/** window.SDT 门面的 hud 消费切面：仅声明本文件触达的成员（整体形状由 main.js 装配保证）。
 * @typedef {object} SdtHudSurface
 * @property {{img: (name: string) => string, rich: (html: string) => string}} Icons
 * @property {{classAvatarArt: (cls: string) => string}} [Art]
 */
const SDT = /** @type {SdtHudSurface} */ (/** @type {any} */ (window).SDT);
/** 页面内 getElementById 快捷式。
 * @type {(id: string) => (HTMLElement|null)}
 */
const $ = (id) => document.getElementById(id);

/** refresh 消费的对局运行态切面（game.js 投影；可选性按本文件既有守卫声明）。
 * @typedef {object} HudGameView
 * @property {string} state
 * @property {number} turn
 * @property {number} hp
 * @property {number} maxHp
 * @property {number} coins
 * @property {number} atk
 * @property {(string|undefined)} myClass
 * @property {(boolean|undefined)} runActive
 * @property {Array<{value: number, count?: number}>} inventory
 * @property {(() => ({name: string, nameEn?: string}|null))} [curLayer]  当前层切片（无层为 null）
 * @property {(() => number)} [usedSlots]  背包已占格数（缺省回落 inventory.length）
 * @property {(() => number)} [bagCap]  背包容量（缺省回落 map.rules.bagSize）
 * @property {{rules: {bagSize: number}}} map
 */

/** hudMethods 装配进 UI 壳后的 this 切面：el 由 ui.js 注入；_last* 与 _roomActive 为
 * 跨帧脏检查缓存（首帧惰性写入）；endRoom/popNum 来自同壳其他方法包
 * （overlay.js endRoom / cinematics.js popNum，见现文件同批 ui 域装配）。
 * @typedef {object} HudThis
 * @property {{layerZh: HTMLElement, layerEn: HTMLElement, statTurn: HTMLElement, statValue: HTMLElement, hpBar: HTMLElement, hpBarWrap: HTMLElement, hpText: HTMLElement, charCoins: HTMLElement, charAtk: HTMLElement, heroAva: HTMLElement, bagCountFloat: (HTMLElement|null), bagBtnFloat: (HTMLElement|null), log: (HTMLElement|null), logPanel: (HTMLElement|null), tooltip: HTMLElement}} el
 * @property {(string|null|undefined)} _lastMode
 * @property {boolean} _roomActive
 * @property {({name: string, nameEn?: string}|null|undefined)} _lastBannerLayer
 * @property {(number|undefined)} _lastTurn
 * @property {(number|null|undefined)} _lastValue
 * @property {(string|null|undefined)} _lastHpKey
 * @property {(number|null|undefined)} _lastCoins
 * @property {(number|null|undefined)} _lastAtk
 * @property {(string|undefined)} _lastHeroCls
 * @property {(string|undefined)} _lastBagKey
 * @property {(() => void)} endRoom
 * @property {((el: (HTMLElement|null)) => void)} popNum
 */

export const hudMethods = {
  /** @param {HudGameView} game @this {HudThis} */
  refresh(game) {
    // 战斗渲染末尾也会走 UI.refresh：battle 模式下路线面板被整页盖住，直接跳过
    // （F8 补充；_lastMode==='battle' 的可靠性同 overlay.js 对 page-covered 的既有判断）
    if (this._lastMode !== 'battle') renderExpeditionPanel($('routePanel'), game, /** @type {(name: string) => string} */ (name => SDT.Icons.img(name)));
    // 格子结算链回到 idle，才真正退出房间页；战斗→宝箱等中间切页不会闪回地图。
    if (game.state === 'idle' && this._roomActive) this.endRoom();
    const layer = game.curLayer ? game.curLayer() : null;
    // 顶部居中环层横幅：仅在换层时触碰 DOM
    if (this._lastBannerLayer !== layer) {
      this._lastBannerLayer = layer;
      this.el.layerZh.textContent = layer ? layer.name : '—';
      this.el.layerEn.textContent = layer && layer.nameEn ? layer.nameEn : '';
      // 换层演出：横幅重播一次滑入（一次性动画走合成器；reduce-motion 由 CSS 豁免）
      const banner = /** @type {(HTMLElement|null)} */ (this.el.layerZh.closest('#layerBanner'));
      if (banner) {
        banner.classList.remove('lb-swap');
        void banner.offsetWidth;
        banner.classList.add('lb-swap');
      }
    }
    const turn = game.turn - 1;
    if (this._lastTurn !== turn) {
      this._lastTurn = turn;
      // textContent 直写数字由 DOM 强转字符串（行为不变），类型层断言放行
      this.el.statTurn.textContent = /** @type {any} */ (turn);
    }
    const valTotal = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    if (this._lastValue !== valTotal) {
      this.el.statValue.textContent = valTotal.toLocaleString();
      if (this._lastValue != null) this.popNum(this.el.statValue);
      this._lastValue = valTotal;
    }

    // 人物：血条 + 经济 + 背包格数
    // U18：负血不外显——数据层保留真实值（含 hpKey 缓存键），展示层统一 max(0,hp)
    const dispHp = Math.max(0, game.hp);
    const pct = Math.max(0, game.hp / game.maxHp);
    const hpKey = `${game.hp}/${game.maxHp}`;
    if (this._lastHpKey !== hpKey) {
      const firstHpSet = this._lastHpKey == null;   // 首帧直贴：进场不从 0% 播过渡（口径同战斗血条 instant）
      this._lastHpKey = hpKey;
      if (firstHpSet) { this.el.hpBar.style.transition = 'none'; }
      this.el.hpBar.style.width = (pct * 100).toFixed(1) + '%';
      if (firstHpSet) { void this.el.hpBar.offsetWidth; this.el.hpBar.style.transition = ''; }
      this.el.hpBar.style.background = pct > 0.5 ? 'linear-gradient(90deg,#2f6f9f,#55a4d6)'
        : pct > 0.25 ? 'linear-gradient(90deg,#b08238,#d4a44e)' : 'linear-gradient(90deg,#b8453a,#d97a52)';
      this.el.hpBarWrap.classList.toggle('low', pct <= 0.25 && game.hp > 0);
      this.el.hpText.innerHTML = `${dispHp}<span class="hp-rest">/${game.maxHp}</span>`;
    }
    if (this._lastCoins !== game.coins) {
      this.el.charCoins.textContent = /** @type {any} */ (game.coins);
      if (this._lastCoins != null) this.popNum(this.el.charCoins);
      this._lastCoins = game.coins;
    }
    if (this._lastAtk !== game.atk) {
      this.el.charAtk.textContent = /** @type {any} */ (game.atk);
      if (this._lastAtk != null) this.popNum(this.el.charAtk);
      this._lastAtk = game.atk;
    }
    // 头像与职业（选职业后同步；头像使用职业立绘）
    const cls = game.myClass || '';
    if (this._lastHeroCls !== cls) {
      this._lastHeroCls = cls;
      this.el.heroAva.innerHTML = (cls && SDT.Art) ? SDT.Art.classAvatarArt(cls) : '旅';
    }
    // 物资 + 卡牌混占背包格；安全格 / 消耗口袋见背包弹窗，容量由基地决定
    const used = game.usedSlots ? game.usedSlots() : game.inventory.length;
    const cap = game.bagCap ? game.bagCap() : game.map.rules.bagSize;
    const bagKey = `${used}/${cap}`;
    if (this._lastBagKey !== bagKey) {
      this._lastBagKey = bagKey;
      // 底栏背包按钮已删（2026-09-19）：入口收敛到全局浮动键，满载警示也移到浮动键上
      if (this.el.bagCountFloat) this.el.bagCountFloat.textContent = bagKey;
      if (this.el.bagBtnFloat) this.el.bagBtnFloat.classList.toggle('bag-full', used >= cap);
    }
    // #27 全局浮动背包键：对局中（且已选角色）任何界面显示；标题/基地/整备/选人时隐藏
    if (this.el.bagBtnFloat) {
      this.el.bagBtnFloat.hidden = !(game.runActive && game.myClass);
    }
  },

  /** @param {string} msg @param {string} [cls] @this {HudThis} */
  log(msg, cls) {
    if (!this.el.log) return;   // 日志面板已从前台移除，仅保留内部记录入口
    const div = document.createElement('div');
    div.className = 'log-line' + (cls ? ' ' + cls : '');
    const t = new Date();
    const hh = String(t.getHours()).padStart(2, '0'), mm = String(t.getMinutes()).padStart(2, '0'), ss = String(t.getSeconds()).padStart(2, '0');
    div.title = `${hh}:${mm}:${ss}`;   // 时间戳收进悬浮提示，减少视觉拥挤
    div.innerHTML = SDT.Icons.rich(msg);
    // U10（2026-09-19 走查）：空面板只占位不干活——首条日志进来时自动展开
    if (this.el.logPanel && this.el.log.children.length === 0) {
      this.el.logPanel.classList.remove('collapsed');
      storeSet('sdt-log-collapsed', '0');
    }
    this.el.log.prepend(div);
    while (this.el.log.children.length > 60) /** @type {ChildNode} */ (this.el.log.lastChild).remove();
  },

  /** @this {HudThis} */
  clearLog() {
    if (!this.el.log) return;
    this.el.log.innerHTML = '';
    // U10：清空后回折叠态（U10 空态收起，避免开局左下大块空面板）
    if (this.el.logPanel) {
      this.el.logPanel.classList.add('collapsed');
      storeSet('sdt-log-collapsed', '1');
    }
  },

  /** 空转桩；参数类型按既有调用点契约声明（battle.layers.js:303、game.boot.js:240/331/355/377）。
   * @param {number} clientX @param {number} clientY @param {string} title @param {string[]} lines @this {HudThis}
   */
  showTooltip(clientX, clientY, title, lines) {
    // 2026-09-19 留言 #7：任意界面鼠标停留都不再弹解释框——入口保留但整体空转，
    // 地图节点/顶栏/手牌等调用点零改动，#tooltip 元素永不显示
    void clientX; void clientY; void title; void lines;
  },

  /** @this {HudThis} */
  hideTooltip() { this.el.tooltip.hidden = true; },
};

/* W1-02（2026-09-27 R2）：全局浮动背包键反 inert 守卫。
 * overlay.js `_isolateOverlayBackground`（冻结件，禁改）开任意弹层时会给
 * #viewport 下 #overlay 的全部兄弟层挂 inert（排除名单仅 #sugLayer），
 * #bagBtnFloat 正是兄弟层 → 战斗/商店/事件等弹层里按钮可见但被移出命中测试
 * （elementFromPoint 跳过 inert 子树，W1-02 评审实锤）。
 * 冻结件加不了排除名单 → 在此挂观察器对冲：inert 一出现立即解除。
 * 时序坑（实测）：isolate 发生在弹层开启瞬间，此刻按钮尚未被 refresh 显示
 * （hidden=true），若带「可见才解除」守卫会漏掉这次 inert 并残留——而按钮
 * hidden 时解除 inert 无任何副作用（不可点不可焦），故无条件对冲最稳。
 * 设计口径=index.html:170「对局中任何界面都可打开背包」；标题/基地等
 * 非对局态按钮本就 hidden，不受影响。main.js 为 ESM defer 链，模块执行时
 * DOM 已解析，直接挂（term-tips 同款）。 */
const bagBtnEl = document.getElementById('bagBtnFloat');
if (bagBtnEl) {
  /* W1-02 第二刀：层叠补偿。战斗走 room-view 模式——overlays.css:356 把
   * #overlay 提为 fixed z-100（普通弹层 z-20），浮键 winter.css:1585 的 z-30
   * 被「战斗背包」整层盖住（解除 inert 仍打不到，实测 elementFromPoint 复核）。
   * battle.css 已冻、index.html 是 R1 热点 → 按主代理批的「调用侧行内制式」
   * 在此抬到 101：高于 room-view 100，语义仍是「对局中任何界面都可用」。 */
  bagBtnEl.style.zIndex = '101';
  new MutationObserver(() => {
    if (bagBtnEl.inert) bagBtnEl.inert = false;
  }).observe(bagBtnEl, { attributes: true, attributeFilter: ['inert'] });
}
