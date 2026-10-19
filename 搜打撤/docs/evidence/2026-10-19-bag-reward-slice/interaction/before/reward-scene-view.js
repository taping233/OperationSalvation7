import { esc, escAttr } from '../core/shared.js';
import { rewardCardStatus } from './reward-state.js';

export function rewardExitHTML(act, label = '继续探索', extraClass = '') {
  return `<button type="button" class="reward-exit ${escAttr(extraClass)}" data-act="${escAttr(act)}"><span class="reward-exit-icon" aria-hidden="true">[[icon:exit]]</span><span>${esc(label)}</span></button>`;
}

// Cards contain their own names and rules. This frame adds only acquisition actions.
export function rewardSceneHTML({ title, source = '', countLabel = '', rule = '', cards, actions, footer = '', coins = '', warning = '', details = '', className = 'reward-v14', count = 0 }) {
  return `<section class="${escAttr(className)} reward-replica" data-reward-count="${count}">
    <header class="reward-head"><div>${source ? `<span class="reward-source">${esc(source)}</span>` : ''}<h3>${esc(title)}</h3>${countLabel ? `<p class="reward-count">${esc(countLabel)}</p>` : ''}${rule ? `<p class="reward-rule">${esc(rule)}</p>` : ''}</div></header>
    <div class="reward-main"><div class="reward-stage loot-scroll"><div class="reward-objects">${coins}${cards}</div>${warning}${details}</div><aside class="loot-actions" aria-label="奖励操作">${actions}</aside></div>
    ${footer ? `<footer class="reward-foot">${footer}</footer>` : ''}
  </section>`;
}

// Both the card face and its zoom use this exact action; no business callbacks live here.
export function rewardClaimHTML({ index, state = 'pending', choice = false, fits = true, disabled = false, zoom = false }) {
  if (state !== 'pending') return `<span class="reward-unit-state">${rewardCardStatus(state, choice)}</span>`;
  const action = fits ? choice ? 'chestPick' : 'chestTake1' : 'chestMakeRoom';
  const label = fits ? choice ? '选择这张' : '收下' : '腾位置领取';
  return `${zoom && choice ? '<p class="reward-choice-warning">选择后，其余基础卡永久放弃；附赠仍可领取。</p>' : ''}<button type="button" class="${zoom ? 'ov-btn ok' : 'reward-claim'}" data-act="${action}" data-i="${escAttr(index)}" data-cancel="false"${disabled ? ' disabled' : ''}>${label}</button>`;
}

// Cancel returns to the owning reward surface; it never means forfeiting rewards.
export function rewardReturnHTML({ action, organize = false, className = '', arrow = false }) {
  return `<button type="button"${className ? ` class="${escAttr(className)}"` : ''} data-${organize ? 'organize' : 'act'}="${escAttr(action)}" data-cancel="true">${arrow ? '<span aria-hidden="true">←</span> ' : ''}返回奖励</button>`;
}
