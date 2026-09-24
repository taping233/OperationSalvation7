/* ui.cinematics.js —— 卡牌演出与屏幕过渡：数值弹跳、传说特写、卡牌奖励演出队列、
 * 顶层屏幕（标题页/告别屏/留言信箱）进出时序（09-25 自 ui.js 拆出，方法包由 ui.js 组装）。
 * 方法均以 UI.method() 形式调用，内部一律走 this 访问壳上的状态。
 */
import { esc } from '../core/shared.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;

export const cinematicsMethods = {
  // 数值变化时弹跳一下（retrigger 动画）
  popNum(el) {
    if (!el) return;
    if (SDT.Motion) { SDT.Motion.pop(el); return; }
    el.classList.remove('popnum');
    void el.offsetWidth;
    el.classList.add('popnum');
  },

  // 传说卡获得特写（2026-09-07 留言：获得传说物品没有提示和界面）：
  // 全屏暗幕 + 金色光柱 + 大卡面揭晓，点击任意处或 2.8s 后自动收场。
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
      <span class="lg-hint">点击任意处继续</span>`;
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
  _cardGetQueue: [],
  _cardGetShowing: false,
  showCardReward(card, reason) {
    if (!card) return;
    this._cardGetQueue.push({ card, reason });
    if (this._cardGetShowing) return;
    this._cardGetShowing = true;
    const showNext = () => {
      const next = this._cardGetQueue.shift();
      if (!next) { this._cardGetShowing = false; return; }
      const legendary = next.card.rarity === '传说';
      const el = document.createElement('div');
      el.id = 'cardGet';
      el.innerHTML = `<div class="lg-beam${legendary ? '' : ' lg-beam-plain'}" aria-hidden="true"></div>
        <span class="lg-kicker">${legendary ? 'LEGENDARY · 传说' : 'REWARD · 获得卡牌'}</span>
        <div class="lg-card">${SDT.Cards.cardHTML(next.card, 'lg')}</div>
        <b class="lg-name">${next.card.name}</b>
        ${next.reason ? `<span class="lg-reason">${esc(next.reason)}</span>` : ''}
        <span class="lg-hint">点击任意处继续</span>`;
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
  showScreen(el) {
    if (!el) return;
    el._scrToken = (el._scrToken || 0) + 1;   // 作废进行中的隐藏计时
    el._scrHiding = false;
    el.classList.remove('scr-out');
    el.style.pointerEvents = '';
    el.hidden = false;
  },

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
    setTimeout(() => {
      el.style.pointerEvents = '';
      el._scrHiding = false;
      if (el._scrToken !== token) return;   // 期间被 showScreen 重新拉起
      el.classList.remove('scr-out');
      el.hidden = true;
      if (after) after();
    }, 240);
  },
};
