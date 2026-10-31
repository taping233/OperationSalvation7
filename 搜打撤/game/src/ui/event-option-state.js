import { esc, escAttr } from '../core/shared.js';
import '../../css/event-option-state.css';

// Read-only admission: only an explicitly declared entry cost can block entry.
// Confirmation costs and capacity warnings still allow inspecting or organizing.
export function eventOptionState(choice, game) {
  const notes = [];
  let state = 'ready';
  let disabled = false, reason = '', coinShort = false;
  const healthCost = choice.healthCost;
  if (Number.isFinite(healthCost) && healthCost > 0 && Number.isFinite(game.hp)) {
    const remaining = game.hp - healthCost;
    state = remaining <= 0 ? 'lethal' : 'cost';
    notes.push(remaining <= 0 ? `会致死：当前 ${game.hp} 生命，失去 ${healthCost} 点生命` : `失去 ${healthCost} 点生命后剩余 ${remaining}`);
  }
  const coinCost = choice.coinCost;
  if (Number.isFinite(coinCost) && coinCost > 0 && Number.isFinite(game.coins)) {
    if (game.coins < coinCost) {
      if (state !== 'lethal') state = 'limited';
      coinShort = true;
      const shortage = `金币不足：还差 ${coinCost - game.coins} 币（当前 ${game.coins}）`;
      notes.push(shortage);
      if (choice.costTiming === 'entry') { disabled = true; reason = shortage; }
    } else notes.push(`支付 ${coinCost} 币后剩余 ${game.coins - coinCost}`);
  }
  if (choice.capacityCard && typeof choice.canRun === 'function') {
    const fits = choice.canRun();
    if (!fits && state !== 'lethal') state = 'limited';
    notes.push(fits ? '背包可容纳本次奖励' : '当前背包装不下，选择后可整理背包');
  }
  const stateLabel = disabled || state === 'limited' && coinShort ? '金币不足'
    : { ready:'可选择', cost:'有代价', limited:'需整理', lethal:'致命风险' }[state];
  return { state, note: notes.join('；'), disabled, reason, stateLabel };
}

export function eventOptionHTML(choice, index, game) {
  const { state, note, disabled, reason, stateLabel } = eventOptionState(choice, game);
  // Keep one detail span so the existing selection summary includes the live warning.
  const detail = [choice.detail, note].filter(Boolean).join('；');
  return `<button type="button" class="evt-opt ${escAttr(choice.tone || '')}" data-act="evtChoice" data-i="${index}" data-option-state="${state}"${disabled ? ` disabled aria-disabled="true" title="${escAttr(reason)}"` : ''}><span class="evt-opt-index" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><span class="evt-opt-copy"><b>${esc(choice.label)}</b>${detail ? `<span class="evt-opt-detail">${esc(detail)}</span>` : ''}</span><span class="evt-opt-state">${stateLabel}</span></button>`;
}
