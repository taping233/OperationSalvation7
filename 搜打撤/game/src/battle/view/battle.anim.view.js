/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：牌局动画（离场克隆飞行 / 回合横幅 / 幸存者归位 / 手牌区显隐）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { rect as uiRect } from '../../ui/ui-scale.js';
import { queueCardAction } from './battle.action-timing.js';
import { schedulePresentationMs } from '../runtime/battle.clock.js';
import { showBattleCardResults } from './battle.card-results.js';
import { showBattleEffectFeedback } from './battle.effect-feedback.js';
import { showTurnFeedback } from './battle.turn-feedback.js';
import { quietFeedback } from '../../ui/feedback-theme.js';
import { emitBattleArt, emitBattleTrail } from './battle.fx-art.js';
  // ---------- 牌局动画（2026-09-09）：离场克隆飞行 / 新牌飞入 / 幸存者归位 / 手牌区显隐 ----------
  // 渲染是整块重建，跨渲染的位移全部走 WAAPI：离场牌在 overlay 常驻层放克隆体飞行，
  // 入场/归位用 composite:'add' 加法合成——不破坏槽位自身的扇形 transform。
  function captureBattleView() {
    const ov = UI.el.overlay;
    if (!ov || ov.hidden) return null;
    const handEl = /** @type {BattleElement} */ (ov.querySelector('.sts-hand'));
    if (!handEl) return null;
    const ovR = uiRect(ov);   // 布局口径：rect 存档供飞行动画消费
    const stage = /** @type {BattleElement} */ (handEl.closest('.battle-stage'));
    const cards = {};
    /** @type {NodeListOf<BattleElement>} */ (handEl.querySelectorAll('.bt-card[data-uid]')).forEach(el => {
      const r = uiRect(el);
      cards[el.dataset.uid] = {
        html: el.outerHTML,
        name: ((/** @type {BattleElement} */ (el.querySelector('.hsc-name')) || {}).textContent || '').trim(),
        rect: { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height },
      };
    });
    const rectOf = (sel) => {
      const el = ov.querySelector(sel);
      if (!el) return null;
      const r = uiRect(el);
      return { left: r.left - ovR.left, top: r.top - ovR.top, width: r.width, height: r.height };
    };
    const energyEl = stage ? /** @type {BattleElement} */ (stage.querySelector('.sts-energy b')) : null;
    return {
      cards,
      phase: stage ? stage.dataset.phase : null,
      energy: energyEl ? parseInt(energyEl.textContent, 10) : null,
      drawPile: rectOf('.sts-hud-l .bt-pile'),
    };
  }
  // 离场去处：指向敌人/自己 → 单位立绘中心；常规打出/倾倒 → 弃牌堆徽标；注能牺牲品 → 原地碎化上飘
  function exitSinkFor(ev, rect, body, ovR) {
    const centerOf = (el) => {
      const r = uiRect(el);
      return { x: r.left - ovR.left + r.width / 2, y: r.top - ovR.top + r.height / 2 };
    };
    if (ev.kind === 'play') {
      if (ev.side === 'enemy' && ev.target != null) {
        const foe = body.querySelector(`.sts-foe[data-eidx="${ev.target}"] .sts-figure`);
        if (foe) return { ...centerOf(foe), scale: 0.42, dur: 400, fade: 0.08 };
      }
      if (ev.side === 'self') {
        const me = /** @type {BattleElement} */ (body.querySelector('#btSelf .sts-figure'));
        if (me) return { ...centerOf(me), scale: 0.42, dur: 400, fade: 0.08 };
      }
      const disc = /** @type {BattleElement} */ (document.querySelector('.sts-hud-r .bt-pile'));
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    if (ev.kind === 'dump') {
      const disc = /** @type {BattleElement} */ (document.querySelector('.sts-hud-r .bt-pile'));
      if (disc) return { ...centerOf(disc), scale: 0.3, dur: 380, fade: 0.25 };
    }
    return { x: rect.left + rect.width / 2, y: rect.top - 80, scale: 0.5, dur: 460, fade: 0, burn: true };
  }
  // WAAPI 防冻保护：遮挡/后台 webview 里文档时间线可能被冻结（currentTime 恒 0），
  // 动画会永远停在第一帧（例如把手牌钉在敌方阶段的 0.08 透明度）——起跑失败就取消，
  // 让声明式 CSS 的两端状态兜底。健康环境下 currentTime 正常推进，永不触发。
  function animateSafe(el, keyframes, options) {
    if (!el.animate) return null;
    const anim = el.animate(keyframes, options);
    const delay = (options && options.delay) || 0;
    // 兜底窗口须覆盖正常播完的时间（duration 可能 > 300，如回合升回 380ms），
    // 否则正常播放中的动画会被当成「没按时启动」误杀（09-12 实机）
    const dur = (options && options.duration) || 0;
    schedulePresentationMs(() => {
      if (anim.playState === 'running' && (anim.currentTime == null || anim.currentTime < delay + 30)) {
        try { anim.cancel(); } catch { /* 已被移除的元素上取消会抛，忽略 */ }
      }
    }, delay + Math.max(300, dur + 200));
    return anim;
  }
  // 手牌区沉/升动画追踪（09-12 实机 bug：下沉动画 fill:forwards 在常驻节点上永续保持，
  // 升回动画无 fill、播完效果消失，沉下终态随即复活＝「你的回合」手牌升上来又沉回去）。
  // 同刻至多一对动画：创建新动画前先 cancel 旧的；升回也用 forwards 保持终态（=CSS 默认位）。
  // 反馈1021·12（偶发「卡牌区在下方没升上来并且虚化」）：prevView 只在本渲染带有出牌事件时
  // 才采样（battle.view.js takeCardAnims→captureBattleView），敌→玩家那一帧常常没有事件 →
  // 既不建升回动画、也不 cancel 旧的下沉动画，fill:forwards 就把常驻手牌层永久钉在
  // translateY(72%)/opacity .08（data-phase 已回 player，声明式 CSS 抢不回 WAAPI 构造层）。
  // 修复：本模块自己记住这组动画朝向的相位终态，采样缺席时用它补出相位差——该升就升；
  // 拿不到任何相位信息且终态与当前阶段不符时 cancel，交回声明式 CSS（两端态就是目标态）。
  let handPhaseAnims = [];
  let handPhaseTarget = null;
  function cancelHandPhaseAnims() {
    handPhaseAnims.forEach(a => { try { a.cancel(); } catch { /* 已结束动画 cancel 不抛 */ } });
    handPhaseAnims = [];
    handPhaseTarget = null;
  }
  function animateBattleTransition(prev, body, events = [], extraFlightMs = 0) {
    let flightMs = extraFlightMs;
    const handEl = /** @type {BattleElement} */ (body.querySelector('.sts-hand'));
    const stage = /** @type {BattleElement} */ (body.querySelector('.battle-stage'));
    showBattleCardResults(stage, events);
    showBattleEffectFeedback(stage, events, prev);
    showTurnFeedback(stage, events);
    // —— 手牌区随回合显隐：玩家→敌人 下沉退场；敌人→玩家 升回 ——
    // 回合标题由真实事件单独驱动；手牌位移仍沿阶段差分。
    const quiet = quietFeedback();
    if (quiet) cancelHandPhaseAnims();
    if (handEl && stage && handEl.animate) {
      const ph = stage.dataset.phase;
      const prevPhase = prev && prev.phase != null ? prev.phase : handPhaseTarget;
      // 只有 data-phase="enemy" 会由声明式 CSS 下沉，其余相位手牌基位＝升起；
      // 因此动画只在「下沉↔基位」这一维发生翻转时才需要，targeting/胜利等相位与 player 同基位。
      const sinkNow = ph === 'enemy';
      if (!quiet && prevPhase != null && sinkNow !== (prevPhase === 'enemy')) {
        cancelHandPhaseAnims();
        if (sinkNow) {
          handPhaseAnims.push(animateSafe(handEl,
            [{ transform: 'translateY(0)', opacity: 1 }, { transform: 'translateY(72%)', opacity: 0.08 }],
            { duration: 300, easing: 'ease-in', fill: 'forwards' }));
        } else {
          handPhaseAnims.push(animateSafe(handEl,
            [{ transform: 'translateY(72%)', opacity: 0.08 }, { transform: 'translateY(0)', opacity: 1 }],
            { duration: 380, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'forwards' }));
        }
        handPhaseTarget = ph;
      } else if (handPhaseAnims.length && ((handPhaseTarget === 'enemy') !== sinkNow)) {
        // 相位没有可判定的翻转（prev 缺席且无历史终态），或终态与当前阶段的沉/升维度不符：
        // 陈旧动画不能继续按 fill:forwards 覆盖声明式 CSS。
        cancelHandPhaseAnims();
      }
    }
    // —— 能量变化脉冲（花费/回复都闪一下）——
    if (stage && prev && prev.energy != null) {
      const energyEl = /** @type {BattleElement} */ (stage.querySelector('.sts-energy b'));
      const now = energyEl ? parseInt(energyEl.textContent, 10) : NaN;
      const orb = /** @type {BattleElement} */ (stage.querySelector('.sts-energy'));
      if (!isNaN(now) && now !== prev.energy && orb) {
        SDT.Sound.sfx(now > prev.energy ? 'energyUp' : 'energyDown');
        if (!quiet && orb.animate && !events.some(event => ['player-turn-start', 'extra-turn-start'].includes(event.kind))) {
          emitBattleArt(stage, 'pulse', { anchor: orb, size: 120, duration: 380 });
        }
      }
    }
    if (!handEl || !events.length) return { flightMs };
    const ov = UI.el.overlay;
    const ovR = uiRect(ov);   // 布局口径：飞卡定位/目标换算
    const played = new Set(), drawn = new Set();
    events.forEach(ev => {
      if (ev.kind === 'draw') drawn.add(ev.uid);
      else if (['play', 'dump', 'burn'].includes(ev.kind)) played.add(ev.uid);
    });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    if (events.some(ev => ev.kind === 'burn')) SDT.Sound.sfx('burn');   // 同帧多张消耗卡合并为一次燃烧提示
    // Acquisition and random-cast faces use the independent feedback queue.
    // —— 出牌队列演出（批次F，STS2 NCardPlayQueue）：同一渲染帧打出多张时，克隆体先飞到
    //    手牌区上方的队列位横排站定（按结算次序错开入场），停顿一拍再依次飞向去处——
    //    单张仍直飞（保留原上弓弧线手感）。原卡节点由手牌常驻层差分移除，飞行由克隆体接管 ——
    const playedEvs = events.filter(ev => ['play', 'dump', 'burn'].includes(ev.kind) && played.has(ev.uid));
    const queueIdx = new Map();
    playedEvs.forEach(ev => { if (ev.kind === 'play') queueIdx.set(ev.uid, queueIdx.size); });
    const queueN = queueIdx.size;
    playedEvs.forEach(ev => {
      // The real damage windup owns the actor action; card flights never restart it.
      // Non-damaging cards keep their original action after this render's cues are known.
      if (ev.kind === 'play') queueCardAction(body, ev.type === '法术' ? 'cast' : ev.type === '武术' ? 'atk' : null);
      const old = prev && (prev.cards[ev.uid] || Object.values(prev.cards).find(c => c.name === ev.name));
      if (!old) return;
      const sink = exitSinkFor(ev, old.rect, body, ovR);
      const from = { x: old.rect.left + old.rect.width / 2, y: old.rect.top + old.rect.height / 2 };
      if (!quiet && sink.burn) emitBattleArt(stage, 'death', { at: from, size: 130, duration: sink.dur });
      else if (!quiet) emitBattleTrail(stage, from, { x: sink.x, y: sink.y }, { duration: sink.dur, size: 100 });
      const clone = document.createElement('div');
      clone.className = 'sts-cardfly';
      clone.style.cssText = `left:${old.rect.left}px;top:${old.rect.top}px;width:${old.rect.width}px;height:${old.rect.height}px`;
      clone.innerHTML = old.html;
      ov.appendChild(clone);
      const cx0 = old.rect.left + old.rect.width / 2, cy0 = old.rect.top + old.rect.height / 2;
      const q = queueIdx.get(ev.uid);
      if (queueN > 1 && q != null) {
        // 两段式：队列位 = 手牌上方中央横排（卡宽+18px 间距）；入场 300ms 错开 150ms/张，
        // 站定 260ms 后继续飞去处——观感上卡牌按次序「过一遍」而非同时爆开
        const qw = Math.min(120, old.rect.width);
        const step = qw + 18;
        const qx = ovR.width / 2 + (q - (queueN - 1) / 2) * step - cx0;
        const qy = ovR.height * 0.58 - cy0;
        const enter = 300, gap = 150, hold = 260;
        clone.animate([
          { transform: 'translate(0,0) scale(1)', opacity: 1 },
          { transform: `translate(${qx}px,${qy}px) scale(0.88)`, opacity: 1 },
        ], { duration: enter, delay: q * gap, easing: 'cubic-bezier(.2,.8,.3,1)', fill: 'both' });
        const dx2 = sink.x - (ovR.width / 2 + (q - (queueN - 1) / 2) * step);
        const dy2 = sink.y - ovR.height * 0.58;
        const t2 = enter + q * gap + hold;
        const fly2 = clone.animate([
          { transform: `translate(${qx}px,${qy}px) scale(0.88)`, opacity: 1 },
          { transform: `translate(${qx + dx2}px,${qy + dy2}px) scale(${sink.scale})`, opacity: sink.fade },
        ], { duration: sink.dur, delay: t2, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
        fly2.onfinish = () => clone.remove();
        schedulePresentationMs(() => clone.remove(), t2 + sink.dur + 300);   // 兜底清理
        flightMs = Math.max(flightMs, t2 + sink.dur);
        return;
      }
      const dx = sink.x - cx0;
      const dy = sink.y - cy0;
      const bow = -Math.min(130, Math.hypot(dx, dy) * 0.28);   // 弓背朝上
      const fly = clone.animate([
        { transform: 'translate(0px,0px) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.5}px,${dy * 0.5 + bow}px) scale(${((1 + sink.scale) / 2).toFixed(2)})`, opacity: 0.96, offset: 0.55 },
        { transform: `translate(${dx}px,${dy}px) scale(${sink.scale})`, opacity: sink.fade },
      ], { duration: sink.dur, easing: 'cubic-bezier(.45,.05,.55,.95)', fill: 'forwards' });
      fly.onfinish = () => clone.remove();
      schedulePresentationMs(() => clone.remove(), sink.dur + 300);   // 兜底清理
      flightMs = Math.max(flightMs, sink.dur);
    });
    // 新牌飞入 / 幸存者归位已改在手牌常驻层的差分更新里做（updateHand）——
    // 常驻节点不销毁，位移直接从旧目标值补间到新目标值，不再依赖重建前取样。
    return { flightMs };
  }

export { captureBattleView, animateSafe, animateBattleTransition };
