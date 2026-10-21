/** @typedef {import("./battle.dom.types.js").BattleElement} BattleElement */
/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：指向悬停效果预览（layers 与 aim 共用，故独立成片）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
import { esc } from '../../core/shared.js';
import { cardRuleHint, previewAction } from './battle.preview.js';
import { commands, getSnapshot, Combat, getPreviewContext } from '../core/battle.core.js';
  // ---------- 指向悬停效果预览（松手前暗示打出结果；card = 指向中的卡） ----------
  function showFoePreview(el, idx, uid, card, interactionMode, hoverSnapshot = null, handRuleContext = null) {
    // 气泡每次都用同一时刻的当前快照/上下文重算，避免拖拽缓存与新 core 状态混用。
    if (interactionMode === 'click') {
      /** @type {NodeListOf<BattleElement>} */ (document.querySelectorAll('.bt-foe .bt-fpreview[data-preview-mode="click"]')).forEach(preview => {
        if (preview.parentElement !== el) preview.remove();
      });
    }
    const existing = /** @type {BattleElement} */ (el.querySelector('.bt-fpreview'));
    const previousMode = existing && existing.dataset.previewMode;
    if (existing) existing.remove();
    const snapshot = hoverSnapshot || getSnapshot();
    const foe = snapshot.foes[idx];
    const useCard = card || (snapshot.pendingTarget && snapshot.pendingTarget.card) || null;
    if (!foe || foe.dead || !useCard) return;
    const previewUid = uid || snapshot.pendingTarget?.uid;
    let context = getPreviewContext(previewUid, idx, handRuleContext);
    if (!context) return;
    // 仅普通手牌选靶复用真实提交检查；道具/技能/免费施放预览沿用自身上下文。
    const ordinaryHandTarget = previewUid != null
      && (interactionMode === 'click' || interactionMode === 'drag')
      && snapshot.hand?.some(entry => (typeof entry === 'object' ? entry?.uid : entry) === previewUid)
      && !context.isFreeCast && !snapshot.pendingItem && !snapshot.slamPending && !snapshot.dartPending;
    if (ordinaryHandTarget) {
      const availability = handRuleContext
        ? commands.getCardPlayAvailability(previewUid, idx, false, handRuleContext)
        : commands.getCardPlayAvailability(previewUid, idx);
      if (availability.status === 'rejected') context = {
        ...context, legal: false, illegalReason: availability.reason?.message || '当前无法打出这张牌',
      };
    }
    const result = previewAction({ snapshot, action: { kind: 'play-card', uid: uid || snapshot.pendingTarget?.uid, targetIndex: idx }, cardContext: context });
    let main, sub;
    if (result.legal && !result.damage && result.knownEffects?.length) {
      main = '[[icon:question]] 卡牌效果';
      sub = [`费${result.cost}`, `基础效果：${result.knownEffects.join('；')}`, ...result.unknownEffects].join(' · ');
    } else if (!result.legal || !result.damage) {
      main = result.legal ? '[[icon:question]] 伤害预览：无法精算' : '[[icon:cross]] 当前无法打出';
      const ruleHint = cardRuleHint(useCard, snapshot.mode);
      sub = [`费${result.cost}`, result.reasons.join(' · ') || '当前效果超出可证明范围', ruleHint].filter(Boolean).join(' · ');
    } else {
      const d = result.damage;
      const segments = d.hits.length > 1
        ? `（${d.hits.map((hit, i) => `${i + 1}段→${esc(snapshot.foes[d.targetIndexesByHit?.[i] ?? idx]?.name || '目标')} -${hit}`).join('；')}）`
        : '';
      const defeated = (d.defeatedTargetIndexes || []).map(index => snapshot.foes[index]?.name).filter(Boolean);
      const killSummary = defeated.length
        ? `，预计击败 ${defeated.length} 名：${[...new Set(defeated)].map(esc).join('、')}`
        : '';
      main = `[[icon:${defeated.length ? 'skull' : 'bolt'}]] 直接伤害：<b>${d.total}</b> 点${Combat.TYPE_NAME[d.type]} ${segments}${killSummary}`;
      const details = [`费${result.cost}`];
      if (d.blockedBy === 'aegis') details.push('元素庇幕完全减免');
      if (d.blockedBy === 'protected') details.push('存活护卫者庇护，伤害偏转');
      if (d.shieldBefore !== d.shieldAfter) details.push(`护盾 ${d.shieldBefore}→${d.shieldAfter}`);
      if (d.armorBefore !== d.armorAfter) details.push(`护甲 ${d.armorBefore}→${d.armorAfter}`);
      if (d.dodgeBefore !== d.dodgeAfter) details.push(`闪避 ${d.dodgeBefore}→${d.dodgeAfter}`);
      if (new Set(d.targetIndexesByHit || [idx]).size > 1) details.push('目标倒下后按战场顺序转向首个存活敌人');
      details.push(...d.notes);
      if (result.unknownEffects.length) details.push(...result.unknownEffects);
      sub = [...new Set(details)].join(' · ') || '无伤害修正';
    }
    const div = document.createElement('div');
    div.className = 'bt-fpreview';
    div.dataset.previewMode = interactionMode || 'drag';
    const tip = !result.legal ? '先解决出牌条件' : interactionMode === 'click' ? '点击该敌人打出' : '松手打出';
    div.innerHTML = `<b>${main}</b><span>${esc(sub)}</span><span class="bt-fpreview-tip">—— ${tip} ——</span>`;
    el.appendChild(div);
    if (result.legal && interactionMode !== 'click' && previousMode !== interactionMode) SDT.Sound.sfx('hover');
  }
  function clearFoePreview(el) {
    const p = /** @type {BattleElement} */ (el.querySelector('.bt-fpreview'));
    if (p) p.remove();
  }

  let thoughtBubbleTimer = 0;
  function showThoughtBubble(reason, persist = false) {
    const stage = /** @type {BattleElement} */ (document.querySelector('#overlay .battle-stage'));
    const speaker = stage && /** @type {BattleElement} */ (stage.querySelector('#btSelf'));
    if (!stage || !speaker || !reason) return;
    const current = /** @type {BattleElement} */ (speaker.querySelector('.bt-thought-bubble'));
    if (current?.dataset.reason === reason) {
      clearTimeout(thoughtBubbleTimer);
      thoughtBubbleTimer = persist ? 0 : setTimeout(clearThoughtBubble, 1500);
      return;
    }
    clearThoughtBubble();
    const bubble = document.createElement('div');
    bubble.className = 'bt-thought-bubble';
    bubble.dataset.reason = reason;
    bubble.textContent = reason;
    speaker.appendChild(bubble);
    thoughtBubbleTimer = persist ? 0 : setTimeout(clearThoughtBubble, 1500);
  }

  function clearThoughtBubble() {
    clearTimeout(thoughtBubbleTimer);
    thoughtBubbleTimer = 0;
    /** @type {NodeListOf<BattleElement>} */ (document.querySelectorAll('#overlay .bt-thought-bubble')).forEach(bubble => bubble.remove());
  }

export { showFoePreview, clearFoePreview, showThoughtBubble, clearThoughtBubble };
