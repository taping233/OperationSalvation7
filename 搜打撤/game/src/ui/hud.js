/* ui.hud.js —— HUD 常驻区：顶栏回合/经济/血条/背包浮动键刷新、日志面板、tooltip 空转桩
 * （09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的 el 与各 _last* 缓存。
 */
import { storeSet } from '../core/storage.js';
import { renderExpeditionPanel } from '../run/expedition.view.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const $ = (id) => document.getElementById(id);

export const hudMethods = {
  refresh(game) {
    renderExpeditionPanel($('routePanel'), game, name => SDT.Icons.img(name));
    // 格子结算链回到 idle，才真正退出房间页；战斗→宝箱等中间切页不会闪回地图。
    if (game.state === 'idle' && this._roomActive) this.endRoom();
    const layer = game.curLayer ? game.curLayer() : null;
    // 顶部居中环层横幅：仅在换层时触碰 DOM
    if (this._lastBannerLayer !== layer) {
      this._lastBannerLayer = layer;
      this.el.layerZh.textContent = layer ? layer.name : '—';
      this.el.layerEn.textContent = layer && layer.nameEn ? layer.nameEn : '';
      // 换层演出：横幅重播一次滑入（一次性动画走合成器；reduce-motion 由 CSS 豁免）
      const banner = this.el.layerZh.closest('#layerBanner');
      if (banner) {
        banner.classList.remove('lb-swap');
        void banner.offsetWidth;
        banner.classList.add('lb-swap');
      }
    }
    const turn = game.turn - 1;
    if (this._lastTurn !== turn) {
      this._lastTurn = turn;
      this.el.statTurn.textContent = turn;
    }
    const valTotal = game.inventory.reduce((a, b) => a + b.value * (b.count || 1), 0);
    if (this._lastValue !== valTotal) {
      this.el.statValue.textContent = valTotal.toLocaleString();
      if (this._lastValue != null) this.popNum(this.el.statValue);
      this._lastValue = valTotal;
    }

    // 人物：血条 + 经济 + 背包格数
    const pct = Math.max(0, game.hp / game.maxHp);
    const hpKey = `${game.hp}/${game.maxHp}`;
    if (this._lastHpKey !== hpKey) {
      this._lastHpKey = hpKey;
      this.el.hpBar.style.width = (pct * 100).toFixed(1) + '%';
      this.el.hpBar.style.background = pct > 0.5 ? 'linear-gradient(90deg,#2f6f9f,#55a4d6)'
        : pct > 0.25 ? 'linear-gradient(90deg,#b08238,#d4a44e)' : 'linear-gradient(90deg,#b8453a,#d97a52)';
      this.el.hpBarWrap.classList.toggle('low', pct <= 0.25 && game.hp > 0);
      this.el.hpText.innerHTML = `${game.hp}<span class="hp-rest">/${game.maxHp}</span>`;
    }
    if (this._lastCoins !== game.coins) {
      this.el.charCoins.textContent = game.coins;
      if (this._lastCoins != null) this.popNum(this.el.charCoins);
      this._lastCoins = game.coins;
    }
    if (this._lastAtk !== game.atk) {
      this.el.charAtk.textContent = game.atk;
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
    while (this.el.log.children.length > 60) this.el.log.lastChild.remove();
  },

  clearLog() {
    if (!this.el.log) return;
    this.el.log.innerHTML = '';
    // U10：清空后回折叠态（U10 空态收起，避免开局左下大块空面板）
    if (this.el.logPanel) {
      this.el.logPanel.classList.add('collapsed');
      storeSet('sdt-log-collapsed', '1');
    }
  },

  showTooltip(clientX, clientY, title, lines) {
    // 2026-09-19 留言 #7：任意界面鼠标停留都不再弹解释框——入口保留但整体空转，
    // 地图节点/顶栏/手牌等调用点零改动，#tooltip 元素永不显示
    void clientX; void clientY; void title; void lines;
  },

  hideTooltip() { this.el.tooltip.hidden = true; },
};
