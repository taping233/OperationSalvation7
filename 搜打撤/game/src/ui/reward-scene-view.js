import { esc, escAttr } from '../core/shared.js';

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
