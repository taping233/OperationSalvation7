import '../../css/reward-completion-receipt.css';
import { showSettledCardFeedback } from './card-result-feedback.js';
import { REWARD_DESTINATION } from './reward-state.js';

// Caller supplies only cards already granted successfully. This never grants or retries.
/** @param {HTMLElement} stage @param {{id?: string, name?: string}[]} cards @param {{mode?: string, token?: unknown, sceneSelector?: string}} [options] */
export function showRewardCardFeedback(stage, cards, { mode = 'chest', token, sceneSelector = '.reward-replica,.cqo-overview' } = {}) {
  if (!cards?.length) return;
  const groups = new Map();
  for (const card of cards) {
    if (!card?.name) continue;
    const key = card.id || card.name;
    const item = groups.get(key);
    if (item) item.count++;
    else groups.set(key, { kind:REWARD_DESTINATION, name:card.name, card:{ ...card }, count:1 });
  }
  showSettledCardFeedback(stage, [...groups.values()], { mode, token, sceneSelector, rewardSource: true });
}

// Non-modal acknowledgment after a completed reward queue has returned control.
// It never grants, delays continuation, or captures input.
let receipt = null, receiptTimer = null;
export function clearRewardCompletionReceipt() {
  clearTimeout(receiptTimer); receiptTimer = null;
  receipt?.remove(); receipt = null;
}
export function showRewardCompletionReceipt(cards) {
  clearRewardCompletionReceipt();
  const names = cards?.map(card => card?.name).filter(Boolean);
  if (!names?.length) return;
  receipt = document.createElement('aside');
  receipt.className = 'reward-completion-receipt';
  receipt.setAttribute('role', 'status'); receipt.setAttribute('aria-live', 'polite');
  receipt.textContent = `${names.join('、')} · 已入背包`;
  document.body.append(receipt);
  receiptTimer = setTimeout(clearRewardCompletionReceipt, 1800);
}
document.addEventListener('sdt-overlay-mode', clearRewardCompletionReceipt);
if (import.meta.hot) import.meta.hot.dispose(() => {
  clearRewardCompletionReceipt();
  document.removeEventListener('sdt-overlay-mode', clearRewardCompletionReceipt);
});
