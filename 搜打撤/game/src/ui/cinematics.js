// @ts-check
/* ui.cinematics.js —— 卡牌演出与屏幕过渡：数值弹跳、传说特写、卡牌奖励演出队列、
 * 顶层屏幕（标题页/告别屏/留言信箱）进出时序（09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的状态。
 */
import { esc } from '../core/shared.js';
import { rewardRarity, hasRareReveal } from './rarity-reveal.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
/** window.SDT 门面的 cinematics 消费切面：仅声明本文件触达的成员（整体形状由 main.js 装配保证）。
 * @typedef {object} SdtCinematicsSurface
 * @property {{pop: (el: HTMLElement) => void, reduceMotion: () => boolean}} [Motion]
 * @property {{cardHTML: (card: *, cls?: string) => string, rarityOf?: (card: *) => string}} Cards
 * @property {{sfx: (name: string) => void}} Sound
 * @property {{runActive: boolean, battleActive?: boolean, discoveredPairs?: Set<unknown>}} [game]
 * @property {{slot?: number|string}} [Base]
 */
const SDT = /** @type {SdtCinematicsSurface} */ (/** @type {any} */ (window).SDT);

/** @type {WeakMap<HTMLElement, ReturnType<typeof setTimeout>>} */
const screenHideTimers = new WeakMap();
/** @param {HTMLElement} el */
function cancelScreenHide(el) {
  const timer = screenHideTimers.get(el);
  if (timer !== undefined) clearTimeout(timer);
  screenHideTimers.delete(el);
}

/** @typedef {{runActive: boolean, slot: number|string|undefined, runToken: Set<unknown>|undefined}} RewardContext */
/** @returns {RewardContext} */
function rewardContext() {
  return { runActive: !!SDT.game?.runActive, slot: SDT.Base?.slot, runToken: SDT.game?.discoveredPairs };
}
/** @param {RewardContext} a @param {RewardContext} b */
function sameRewardContext(a, b) {
  return a.runActive === b.runActive && a.slot === b.slot && a.runToken === b.runToken;
}

export const cinematicsMethods = {
  // 数值变化时弹跳一下（retrigger 动画）
  /** @param {(HTMLElement|null)} el */
  popNum(el) {
    if (!el) return;
    if (SDT.Motion) { SDT.Motion.pop(el); return; }
    el.classList.remove('popnum');
    void el.offsetWidth;
    el.classList.add('popnum');
  },

  // 传说卡获得特写（2026-09-07 留言：获得传说物品没有提示和界面）：
  // 全屏暗幕 + 金色光柱 + 大卡面揭晓，点击任意处或 2.8s 后自动收场。
  /** @param {*} card */
  showLegendGet(card) {
    if (!card) return;
    const old = document.getElementById('legendGet');
    if (old) old.remove();
    const el = document.createElement('div');
    el.id = 'legendGet';
    el.innerHTML = `<div class="lg-beam" aria-hidden="true"></div>
      <span class="lg-kicker">LEGENDARY · 传说</span>
      <div class="lg-card">${SDT.Cards.cardHTML(card, 'lg')}</div>
      <b class="lg-name">${card.name}</b>
      <span class="lg-hint">收起</span>`;
    const close = () => { el.classList.add('lg-out'); setTimeout(() => el.remove(), 420); };
    el.addEventListener('click', close, { once: true });
    document.body.appendChild(el);
    SDT.Sound.sfx('legend');
    setTimeout(() => { if (el.isConnected) close(); }, 2800);
  },

  // 卡牌获得奖励演出（2026-09-13 老板：事件发卡要有奖励动画，不能静默进背包）：
  // 与传说特写同壳（#cardGet 复用 #legendGet 的样式与动画），传说卡保留金色光柱与
  // legend 音效，其余卡为中性演出 + gain 音效。多张连发走队列逐张播放。
  // reason：可选的获得原因文字（2026-09-20 老板——发牌点要说明为什么给这张牌）
  /** @type {Array<{card: *, reason: (string|undefined), context: RewardContext}>} */
  _cardGetQueue: [],
  _cardGetShowing: false,
  /** @param {*} card @param {string} [reason] */
  showCardReward(card, reason) {
    if (!card) return;
    // 对局归属快照（2026-09-28 代码线）：演出队列自驱与场景解耦，多张连发时玩家
    // 中途「回主菜单/回基地」会让剩余卡盖在新界面上并吞掉首次点击。入队记快照，
    // 出队按档位和内存对局身份校验；newRun/loadGame 都重建 discoveredPairs。
    const context = rewardContext();
    this._cardGetQueue.push({ card, reason, context });
    if (this._cardGetShowing) return;
    this._cardGetShowing = true;
    const showNext = () => {
      // 测试环境拆除后定时器仍触发（发卡队列 close 后 100ms 续棒定时器）：document 已删时安全短路；浏览器内不可达，行为逐字不变。
      if (typeof document === "undefined") return;
      const next = this._cardGetQueue.shift();
      if (!next) { this._cardGetShowing = false; return; }
      const current = rewardContext();
      if (!sameRewardContext(current, next.context)) {
        // 逐条校验（复核建议）：只丢与旧局绑定的条目；队列里若还有归属当前局的
        // 合法卡（后续 showCardReward 追加），继续播放而不是整队丢弃
        this._cardGetQueue = this._cardGetQueue.filter(e => sameRewardContext(e.context, current));
        if (this._cardGetQueue.length) { showNext(); return; }
        this._cardGetShowing = false;
        return;
      }
      const rarity = rewardRarity(next.card);
      const legendary = rarity === '传说';
      const combat = !!SDT.game?.battleActive && !!/** @type {import("./ui.dom.types.js").UIElement} */ (document.querySelector('#overlay .battle-stage, #overlay .battle-decision'));
      const el = document.createElement('div');
      el.id = 'cardGet';
      el.dataset.combat = combat ? 'true' : 'false';
      el.dataset.rarity = rarity || '';
      el.dataset.rareReveal = String(hasRareReveal(rarity));
      if (combat) { el.setAttribute('role', 'status'); el.setAttribute('aria-label', `获得${rarity || ''}卡牌：${next.card.name}`); }
      el.innerHTML = `<div class="lg-beam${legendary ? '' : ' lg-beam-plain'}" aria-hidden="true"></div>
        <span class="lg-kicker">${combat ? `${esc(rarity || '')}获得` : hasRareReveal(rarity) ? `${esc(rarity)} · 获得卡牌` : 'REWARD · 获得卡牌'}</span>
        <div class="lg-card">${SDT.Cards.cardHTML(next.card, 'lg')}</div>
        ${combat ? '' : `<b class="lg-name">${esc(next.card.name)}</b>`}
        ${next.reason ? `<span class="lg-reason">${esc(next.reason)}</span>` : ''}
        <span class="lg-hint">收起</span>`;
      let closed = false;
      const close = () => {
        if (closed || !el.isConnected) return;
        closed = true;
        el.classList.add('lg-out');
        setTimeout(() => el.remove(), 420);
        setTimeout(showNext, 100);
      };
      el.addEventListener('click', close, { once: true });
      document.body.appendChild(el);
      SDT.Sound.sfx(legendary ? 'legend' : 'gain');
      setTimeout(close, legendary ? 2800 : 2200);
    };
    showNext();
  },

  // ---------- 顶层屏幕进出（标题页/告别屏/留言信箱这类 hidden 直切元素） ----------
  // boss 留言 #52（所有界面退出都有过渡动画）延伸到屏幕级：入场动画由 CSS 在
  // display:none→显示时自动重播，这里只负责退场类与隐藏时机；reduce-motion 瞬时完成。
  /** @param {(HTMLElement & {_scrToken?: number, _scrHiding?: boolean}|null)} el */
  showScreen(el) {
    if (!el) return;
    cancelScreenHide(el);
    el._scrToken = (el._scrToken || 0) + 1;   // 作废进行中的隐藏计时
    el._scrHiding = false;
    el.classList.remove('scr-out');
    el.style.pointerEvents = '';
    el.hidden = false;
  },

  /** @param {(HTMLElement & {_scrToken?: number, _scrHiding?: boolean}|null)} el @param {(() => void)} [after] */
  hideScreen(el, after) {
    if (!el) return;
    if (el.hidden) { if (after) after(); return; }
    if (el._scrHiding) return;   // 淡出中防重入
    el._scrHiding = true;
    el._scrToken = (el._scrToken || 0) + 1;
    const token = el._scrToken;
    if (SDT.Motion && SDT.Motion.reduceMotion()) {
      el._scrHiding = false;
      el.hidden = true;
      if (after) after();
      return;
    }
    el.classList.add('scr-out');
    el.style.pointerEvents = 'none';   // 淡出窗口内拦截点击，防连点重入
    screenHideTimers.set(el, setTimeout(() => {
      if (el._scrToken !== token) return;   // 期间被 showScreen 重新拉起，不能清除新退场锁
      screenHideTimers.delete(el);
      el.style.pointerEvents = '';
      el._scrHiding = false;
      el.classList.remove('scr-out');
      el.hidden = true;
      if (after) after();
    }, 240));
  },
};
