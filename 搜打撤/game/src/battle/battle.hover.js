/* 由 battle.view.js 拆出（2026-09-22 六文件重构批5）：指向悬停效果预览（layers 与 aim 共用，故独立成片）。
 * 逐字搬迁；本片不 import 壳（壳→片单向）；viewApi 反取已改 battle.core 具名直引。 */
const SDT = window.SDT;
import { esc } from '../core/shared.js';
import { cardRuleHint, previewAction } from './battle.preview.js';
import { getSnapshot, Combat, getPreviewContext } from './battle.core.js';
  // ---------- 指向悬停效果预览（松手前暗示打出结果；card = 指向中的卡） ----------
  function showFoePreview(el, idx, uid, card, interactionMode) {
    // 气泡每次都用同一时刻的当前快照/上下文重算，避免拖拽缓存与新 core 状态混用。
    const existing = el.querySelector('.bt-fpreview');
    const previousMode = existing && existing.dataset.previewMode;
    if (existing) existing.remove();
    const snapshot = getSnapshot();
    const foe = snapshot.foes[idx];
    const useCard = card || (snapshot.pendingTarget && snapshot.pendingTarget.card) || null;
    if (!foe || foe.dead || !useCard) return;
    const context = getPreviewContext(uid || (snapshot.pendingTarget && snapshot.pendingTarget.uid), idx);
    if (!context) return;
    const result = previewAction({ snapshot, action: { kind: 'play-card', uid: uid || snapshot.pendingTarget?.uid, targetIndex: idx }, cardContext: context });
    let main, sub;
    if (!result.legal || !result.damage) {
      main = '[[icon:question]] 伤害预览：无法精算';
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
      main = `[[icon:${defeated.length ? 'skull' : 'bolt'}]] 精确伤害：<b>${d.total}</b> 点${Combat.TYPE_NAME[d.type]} ${segments}${killSummary}`;
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
    div.innerHTML = `<b>${main}</b><span>${esc(sub)}</span><span class="bt-fpreview-tip">—— ${interactionMode === 'click' ? '点击该敌人打出' : '松手打出'} ——</span>`;
    el.appendChild(div);
    if (interactionMode !== 'click' && previousMode !== interactionMode) SDT.Sound.sfx('hover');
  }
  function clearFoePreview(el) {
    const p = el.querySelector('.bt-fpreview');
    if (p) p.remove();
  }

export { showFoePreview, clearFoePreview };
