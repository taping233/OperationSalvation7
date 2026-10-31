import '../../css/room-rewards.css';
import '../../css/room-footer.css';
import { esc, escAttr } from '../core/shared.js';
import { syncViewElement } from './view-children-sync.js';
/** @typedef {{ total?: number, pending?: number, received?: number, choiceCount?: number, choicePending?: boolean, choiceName?: string, bonusPending?: number }} RewardModeProgress */

export function rewardExitHTML(act, label = '继续探索', extraClass = '') {
  return `<button type="button" class="reward-exit ${escAttr(extraClass)}" data-act="${escAttr(act)}"><span class="reward-exit-icon" aria-hidden="true">[[icon:exit]]</span><span>${esc(label)}</span></button>`;
}

// Cards contain their own names and rules. This frame adds only acquisition actions.
export function rewardSceneHTML({ title, source = '', countLabel = '', rule = '', cards, actions, footer = '', coins = '', warning = '', details = '', className = 'reward-v14', count = 0, compact = false, claimMode = '', progress = /** @type {RewardModeProgress} */ ({}) }) {
  const mode = claimMode === 'one' || claimMode === 'all' ? claimMode : '';
  const choiceState = progress.choicePending ? 'pending' : progress.choiceName ? 'selected' : 'forfeited';
  const heading = mode === 'one' && progress.choicePending ? '选择 1 张' : title;
  const description = [countLabel, rule, mode === 'one' && progress.choicePending ? '其余候选将放弃' : ''].filter(Boolean).join(' · ');
  const headHTML = `<header class="reward-head"${description ? ` aria-description="${escAttr(description)}"` : ''}><div><h3>${esc(heading)}</h3>${source ? `<span class="reward-source">${esc(source)}</span>` : ''}${!mode && rule ? `<p class="reward-rule">${esc(rule)}</p>` : ''}</div></header>`;
  const mainHTML = `<div class="reward-main"><div class="reward-stage loot-scroll"><div class="reward-objects"${mode === 'one' ? ' role="group" aria-label="互斥候选与独立附赠"' : mode === 'all' ? ' role="list" aria-label="可逐张收下的战利品"' : ''}>${coins}${cards}</div>${warning}${details}</div></div>`;
  const footHTML = `${footer || actions ? `<footer class="reward-foot room-footer"><div class="reward-footer-info">${footer}</div><aside class="loot-actions room-footer-actions" aria-label="奖励操作">${actions}</aside></footer>` : ''}`;
  return `<section class="${escAttr(className)}${compact ? ' reward-compact' : ''} reward-replica room-reward${className.includes('reward-standalone-picker') ? ' ui-design-system' : ''}" data-reward-count="${count}"${mode ? ` data-reward-mode="${mode}"${mode === 'one' ? ` data-reward-choice-state="${choiceState}"` : ''}` : ''}>${headHTML + mainHTML + footHTML}</section>`;
}

// A receipt changes card state, not its artwork. Keep the live cards and scroll
// containers connected while updating their controls and the surrounding facts.
export function patchRewardScene(host, html) {
  const current = /** @type {HTMLElement} */ (host?.querySelector('.reward-v14'));
  if (!current) return false;
  const template = document.createElement('template');
  template.innerHTML = html;
  const next = /** @type {HTMLElement} */ (template.content.querySelector('.reward-v14'));
  if (!next || !!/** @type {HTMLElement} */ (host.querySelector('.cqo-frame')) !== !!/** @type {HTMLElement} */ (template.content.querySelector('.cqo-frame'))) return false;
  const objects = /** @type {HTMLElement} */ (current.querySelector('.reward-objects'));
  const incoming = /** @type {HTMLElement} */ (next.querySelector('.reward-objects'));
  if (!objects || !incoming) return false;
  syncViewElement(current, next, {
    key(element) {
      if (element.hasAttribute('data-reward-index')) return `reward:${element.getAttribute('data-reward-index')}:${element.getAttribute('data-reward-card')}`;
      if (element.hasAttribute('data-reward-group')) return `group:${element.getAttribute('data-reward-group')}`;
      if (element.matches('.reward-card')) return 'reward-card';
      // Capacity can change the action while this remains the same card's claim control.
      if (element.matches('.reward-claim')) {
        const unit = element.closest('[data-reward-index][data-reward-card]');
        if (unit) return `claim:${unit.getAttribute('data-reward-index')}:${unit.getAttribute('data-reward-card')}`;
      }
      return null;
    },
    // The card face has no capacity controls; those are siblings updated above.
    preserveNode: (card, fresh) => card.matches('.reward-card') && fresh.matches('.reward-card'),
    // Animation owners add these attributes outside the reward renderer.
    preserveAttribute: (current, next, name) => !next.hasAttribute(name)
      && (name === 'style' || name.startsWith('data-ui') || name.startsWith('data-surface')),
  });
  const background = /** @type {HTMLElement} */ (host.querySelector('.cqo-background'));
  const nextBackground = /** @type {HTMLElement} */ (template.content.querySelector('.cqo-background'));
  if (background && nextBackground && background.innerHTML !== nextBackground.innerHTML) background.innerHTML = nextBackground.innerHTML;
  return true;
}

export function restoreRewardActionFocus(host, focus, {
  claimActions = ['chestTake1', 'chestPick', 'chestMakeRoom'],
  returnActions = ['chestContinue', 'chestClosePicker'],
} = {}) {
  if (!focus) return;
  const buttons = [.../** @type {NodeListOf<HTMLElement>} */ (host.querySelectorAll('[data-act]:not(:disabled)'))];
  const same = buttons.find(button => button.dataset.act === focus.action && button.dataset.i === focus.index);
  const claims = buttons.filter(button => claimActions.includes(button.dataset.act));
  const next = claims.find(button => Number(button.dataset.i) > Number(focus.index)) || claims[0];
  const fallback = focus.action === 'chestStay' ? buttons.find(button => button.dataset.act === 'chestSkip')
    : claimActions.includes(focus.action) || focus.action === 'chestCoins' ? next : null;
  const target = same || fallback || returnActions.map(action => buttons.find(button => button.dataset.act === action)).find(Boolean);
  target?.focus({ preventScroll:true });
  if (!target) return;
  // Reveal only inside the reward's own scrollports, including the long horizontal row.
  for (const scroll of [target.closest('.reward-objects'), target.closest('.loot-scroll')]) {
    if (!scroll) continue;
    const view = scroll.getBoundingClientRect(), rect = target.getBoundingClientRect();
    if (!view.width || !view.height) continue;
    if (scroll.scrollWidth > scroll.clientWidth) {
      const delta = rect.right > view.right ? rect.right - view.right : rect.left < view.left ? rect.left - view.left : 0;
      scroll.scrollLeft += delta * scroll.clientWidth / view.width;
    }
    if (scroll.scrollHeight > scroll.clientHeight) {
      const delta = rect.bottom > view.bottom ? rect.bottom - view.bottom : rect.top < view.top ? rect.top - view.top : 0;
      scroll.scrollTop += delta * scroll.clientHeight / view.height;
    }
  }
}

// Both the card face and its zoom use this exact action; no business callbacks live here.
export function rewardClaimHTML({ index, cardName = '卡牌', state = 'pending', choice = false, fits = true, disabled = false, zoom = false, claimMode = '', bonus = false, label: actionLabel = '', selected = /** @type {boolean | null} */ (null), actions = /** @type {{pick?: string, take?: string, organize?: string}} */ ({}) }) {
  const explicitMode = claimMode === 'one' || claimMode === 'all';
  const mode = choice ? 'one' : 'all';
  if (state !== 'pending') return explicitMode
    ? `<span class="reward-unit-state reward-state-${mode} is-${state}" role="status"><span class="reward-claim-mark" aria-hidden="true">${state === 'received' ? '✓' : '×'}</span><span>${state === 'received' ? choice ? '已入背包' : '已收下' : '已放弃'}</span></span>`
    : `<span class="reward-unit-state">${state === 'received' ? choice ? '已选择' : '已收下' : '已放弃'}</span>`;
  const action = fits ? choice ? actions.pick || 'chestPick' : actions.take || 'chestTake1' : actions.organize || 'chestMakeRoom';
  const label = fits ? actionLabel || (choice ? '选择' : '收下') : '整理背包';
  const accessibleLabel = fits && explicitMode && bonus ? '收下附赠' : label;
  const warning = zoom && choice ? `<p class="reward-choice-warning">${explicitMode ? '选定后，其余基础候选将放弃。' : '其余选项将放弃'}</p>` : '';
  return `${warning}<button type="button" class="${zoom ? 'ov-btn ok' : 'reward-claim'}${explicitMode ? ` reward-claim-${mode}` : ''}" data-act="${escAttr(action)}" data-i="${escAttr(index)}" data-cancel="false" aria-label="${escAttr(`${accessibleLabel}：${cardName || '卡牌'}`)}"${typeof selected === 'boolean' ? ` aria-pressed="${selected}"` : ''}${explicitMode && choice && fits ? ' aria-description="其余候选将永久放弃"' : ''}${disabled ? ' disabled' : ''}>${esc(label)}</button>`;
}

// Cancel returns to the owning reward surface; it never means forfeiting rewards.
export function rewardReturnHTML({ action, organize = false, className = '', arrow = false }) {
  return `<button type="button"${className ? ` class="${escAttr(className)}"` : ''} data-${organize ? 'organize' : 'act'}="${escAttr(action)}" data-cancel="true">${arrow ? '<span aria-hidden="true">←</span> ' : ''}返回奖励</button>`;
}

// Shared acquisition tile: the face owns its name/rules; one button owns receipt.
export function rewardCardUnitHTML({ card, face, index, readAction, action = '', className = '', category = '', rarity = '', listItem = false, selected = /** @type {boolean | null} */ (null) }) {
  return `<article class="reward-unit ${escAttr(className)}${selected === true ? ' is-selected' : ''}" data-reward-index="${index}" data-reward-card="${escAttr(card.id || card.name)}" data-reward-rarity="${escAttr(rarity || card.rarity || '')}"${typeof selected === 'boolean' ? ` data-reward-selected="${selected}"` : ''}${category ? ` data-reward-category="${escAttr(category)}"` : ''}${listItem ? ' role="listitem"' : ''}><button type="button" class="reward-card" data-act="${escAttr(readAction)}" data-i="${index}" aria-label="放大查看${escAttr(card.name || '卡牌')}">${face}</button>${action}</article>`;
}
