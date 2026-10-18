// @ts-check
/* ui.hud.js —— HUD 常驻区：顶栏回合/经济/血条/背包浮动键刷新、日志面板、tooltip 空转桩
 * （09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的 el 与各 _last* 缓存。
 */
import { updateMapHealthHud } from './map-health-hud.js';
import { storeGet } from '../core/storage.js';
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
 * @property {{layerZh: HTMLElement, layerEn: HTMLElement, statTurn: HTMLElement, statValue: HTMLElement, hpBar: HTMLElement, hpBarWrap: HTMLElement, hpText: HTMLElement, charCoins: HTMLElement, charAtk: HTMLElement, heroAva: HTMLElement, log: (HTMLElement|null), logPanel: (HTMLElement|null), tooltip: HTMLElement}} el
 * @property {(string|null|undefined)} _lastMode
 * @property {boolean} _roomActive
 * @property {({name: string, nameEn?: string}|null|undefined)} _lastBannerLayer
 * @property {(number|undefined)} _lastTurn
 * @property {(number|null|undefined)} _lastValue
 * @property {(string|null|undefined)} _lastHpKey
 * @property {(number|null|undefined)} _lastCoins
 * @property {(number|null|undefined)} _lastAtk
 * @property {(string|undefined)} _lastHeroCls
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
    const firstHpSet = this._lastHpKey == null;
    if (this._lastHpKey !== hpKey) {
      // 首帧直贴：进场不从 0% 播过渡（口径同战斗血条 instant）
      this._lastHpKey = hpKey;
      if (firstHpSet) { this.el.hpBar.style.transition = 'none'; }
      this.el.hpBar.style.width = (pct * 100).toFixed(1) + '%';
      if (firstHpSet) { void this.el.hpBar.offsetWidth; this.el.hpBar.style.transition = ''; }
      this.el.hpBar.style.background = pct > 0.5 ? 'linear-gradient(90deg,#2f6f9f,#55a4d6)'
        : pct > 0.25 ? 'linear-gradient(90deg,#b08238,#d4a44e)' : 'linear-gradient(90deg,#b8453a,#d97a52)';
      this.el.hpBarWrap.classList.toggle('low', pct <= 0.25 && game.hp > 0);
      this.el.hpText.innerHTML = `${dispHp}<span class="hp-rest">/${game.maxHp}</span>`;
    }
    updateMapHealthHud(this.el.hpText.closest('#hpHud'), {
      hp: game.hp, maxHp: game.maxHp, instant: firstHpSet,
      active: game.runActive !== false && this._lastMode !== 'battle'
        && !document.body.matches('.lobby, .scene-battle-3d'),
    });
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
    // 背包容量角标随全局浮动背包键一并移除（2026-10-15 老板：删旧背包按钮，背包页自带退出键）
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
    // 首条日志遵循玩家显式开关；没有偏好时收起历史，不抢地图焦点。
    if (this.el.logPanel && this.el.log.children.length === 0) {
      this.el.logPanel.classList.toggle('collapsed', storeGet('sdt-log-collapsed') !== '0');
    }
    this.el.log.prepend(div);
    while (this.el.log.children.length > 60) /** @type {ChildNode} */ (this.el.log.lastChild).remove();
  },

  /** @this {HudThis} */
  clearLog() {
    if (!this.el.log) return;
    this.el.log.innerHTML = '';
    // 清空内容也沿用显式开关，不覆盖持久偏好。
    if (this.el.logPanel) {
      this.el.logPanel.classList.toggle('collapsed', storeGet('sdt-log-collapsed') !== '0');
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
  hideTooltip() { if (this.el.tooltip) this.el.tooltip.hidden = true; },
};
