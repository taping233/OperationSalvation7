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
import { emitBattleArt } from './battle.fx-art.js';
import { animateCardConsumption } from './battle.card-consumption-fx.js';
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
      battleToken: stage?._battleToken,
      phase: stage ? stage.dataset.phase : null,
      energy: energyEl ? parseInt(energyEl.textContent, 10) : null,
      drawPile: rectOf('.sts-hud-l .bt-pile'),
    };
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
    // Calling on every render also releases an older battle token's presentation.
    if (!handEl || !events.length) {
      animateCardConsumption(stage);
      return { flightMs };
    }
    const played = new Set(), drawn = new Set();
    const currentEvents = events.filter(ev => ev.battleToken == null || ev.battleToken === stage?._battleToken);
    currentEvents.forEach(ev => {
      if (ev.kind === 'draw') drawn.add(ev.uid);
      else if (['play', 'dump', 'burn'].includes(ev.kind)) played.add(ev.uid);
    });
    drawn.forEach(u => played.delete(u));   // 打出又回手（不朽斩）：同帧两事件抵消不演
    if (currentEvents.some(ev => ev.kind === 'burn')) SDT.Sound.sfx('burn');   // 同帧多张消耗卡合并为一次燃烧提示
    // Acquisition/random casts keep their feedback queue. Only captured real UIDs
    // dissolve into the consumed pile; virtual cards cannot borrow a namesake face.
    const playedEvs = currentEvents.filter(ev => ['play', 'dump', 'burn'].includes(ev.kind) && played.has(ev.uid));
    playedEvs.forEach(ev => {
      // The real damage windup owns the actor action; card flights never restart it.
      // Non-damaging cards keep their original action after this render's cues are known.
      if (ev.kind === 'play') queueCardAction(body, ev.type === '法术' ? 'cast' : ev.type === '武术' ? 'atk' : null);
    });
    flightMs = Math.max(flightMs, animateCardConsumption(stage, playedEvs.map(ev => ({
      ev, old: prev?.cards?.[ev.uid],
    })), { quiet, battleToken: prev?.battleToken }));
    // 新牌飞入 / 幸存者归位已改在手牌常驻层的差分更新里做（updateHand）——
    // 常驻节点不销毁，位移直接从旧目标值补间到新目标值，不再依赖重建前取样。
    return { flightMs };
  }

export { captureBattleView, animateSafe, animateBattleTransition };
