import { esc, escAttr } from '../core/shared.js';

export function rewardExitHTML(act, label = '继续探索', extraClass = '') {
  return `<button type="button" class="reward-exit ${escAttr(extraClass)}" data-act="${escAttr(act)}"><span class="reward-exit-icon" aria-hidden="true">[[icon:exit]]</span><span>${esc(label)}</span></button>`;
}

// Cards contain their own names and rules. This frame adds only acquisition actions.
export function rewardSceneHTML({ title, source = '', countLabel = '', rule = '', cards, actions, footer = '', coins = '', warning = '', details = '', className = 'reward-v14', count = 0, compact = false }) {
  return `<section class="${escAttr(className)}${compact ? ' reward-compact' : ''} reward-replica${className.includes('reward-standalone-picker') ? ' ui-design-system' : ''}" data-reward-count="${count}">
    <header class="reward-head"><div>${source ? `<span class="reward-source">${esc(source)}</span>` : ''}<h3>${esc(title)}</h3>${countLabel ? `<p class="reward-count">${esc(countLabel)}</p>` : ''}${rule ? `<p class="reward-rule">${esc(rule)}</p>` : ''}</div></header>
    <div class="reward-main"><div class="reward-stage loot-scroll"><div class="reward-objects">${coins}${cards}</div>${warning}${details}</div></div>
    ${footer || actions ? `<footer class="reward-foot"><div class="reward-footer-info">${footer}</div><aside class="loot-actions" aria-label="奖励操作">${actions}</aside></footer>` : ''}
  </section>`;
}

// A receipt changes card state, not its artwork. Keep the live cards and scroll
// containers connected while updating their controls and the surrounding facts.
export function patchRewardScene(host, html) {
  const current = host?.querySelector('.reward-v14');
  if (!current) return false;
  const template = document.createElement('template');
  template.innerHTML = html;
  const next = template.content.querySelector('.reward-v14');
  if (!next || !!host.querySelector('.cqo-frame') !== !!template.content.querySelector('.cqo-frame')) return false;
  const objects = current.querySelector('.reward-objects');
  const incoming = next.querySelector('.reward-objects');
  if (!objects || !incoming) return false;
  const key = unit => unit.dataset.rewardIndex == null ? 'coins' : `${unit.dataset.rewardIndex}:${unit.dataset.rewardCard}`;
  const existing = new Map([...objects.children].map(unit => [key(unit), unit]));
  const units = [...incoming.children].map(fresh => {
    const unit = existing.get(key(fresh)), card = unit?.querySelector('.reward-card');
    if (!card || !fresh.querySelector('.reward-card')) return fresh;
    unit.className = fresh.className;
    unit.dataset.rewardRarity = fresh.dataset.rewardRarity;
    let previous = card;
    for (const child of [...fresh.children].filter(child => !child.matches('.reward-card'))) {
      const old = previous.nextElementSibling;
      if (old?.outerHTML === child.outerHTML) previous = old;
      else { if (old) old.replaceWith(child); else unit.append(child); previous = child; }
    }
    while (previous.nextElementSibling) previous.nextElementSibling.remove();
    return unit;
  });
  for (const [index, unit] of units.entries()) {
    if (objects.children[index] !== unit) objects.insertBefore(unit, objects.children[index] || null);
  }
  while (objects.children.length > units.length) objects.lastElementChild.remove();
  const stage = current.querySelector('.reward-stage'), nextStage = next.querySelector('.reward-stage');
  const tail = [...stage.children].filter(child => child !== objects);
  const nextTail = [...nextStage.children].filter(child => child !== incoming);
  for (const [index, fresh] of nextTail.entries()) {
    const old = tail[index];
    // Keep an expanded outcome disclosure when its contents have not changed.
    if (old?.tagName === fresh.tagName && old.className === fresh.className && old.innerHTML === fresh.innerHTML) continue;
    if (old) old.replaceWith(fresh); else stage.append(fresh);
  }
  tail.slice(nextTail.length).forEach(child => child.remove());
  current.className = next.className;
  current.dataset.rewardCount = next.dataset.rewardCount;
  for (const selector of ['.reward-head', '.loot-actions', '.reward-foot']) {
    const old = current.querySelector(selector), fresh = next.querySelector(selector);
    if (old && fresh && old.innerHTML !== fresh.innerHTML) old.innerHTML = fresh.innerHTML;
    else if (old && !fresh) old.remove();
    else if (!old && fresh) current.append(fresh);
  }
  const background = host.querySelector('.cqo-background');
  const nextBackground = template.content.querySelector('.cqo-background');
  if (background && nextBackground && background.innerHTML !== nextBackground.innerHTML) background.innerHTML = nextBackground.innerHTML;
  return true;
}

export function restoreRewardActionFocus(host, focus) {
  if (!focus) return;
  const buttons = [...host.querySelectorAll('[data-act]:not(:disabled)')];
  const same = buttons.find(button => button.dataset.act === focus.action && button.dataset.i === focus.index);
  const claims = buttons.filter(button => ['chestTake1', 'chestPick', 'chestMakeRoom'].includes(button.dataset.act));
  const next = claims.find(button => Number(button.dataset.i) > Number(focus.index)) || claims[0];
  const fallback = focus.action === 'chestStay' ? buttons.find(button => button.dataset.act === 'chestSkip')
    : ['chestTake1', 'chestPick', 'chestMakeRoom', 'chestCoins'].includes(focus.action) ? next : null;
  const target = same || fallback || buttons.find(button => ['chestContinue', 'chestClosePicker'].includes(button.dataset.act));
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
export function rewardClaimHTML({ index, state = 'pending', choice = false, fits = true, disabled = false, zoom = false, actions = {} }) {
  if (state !== 'pending') return `<span class="reward-unit-state">${state === 'received' ? choice ? '已选择' : '已收下' : '已放弃'}</span>`;
  const action = fits ? choice ? actions.pick || 'chestPick' : actions.take || 'chestTake1' : actions.organize || 'chestMakeRoom';
  const label = fits ? choice ? '选择这张' : '收下' : '整理背包';
  return `${zoom && choice ? '<p class="reward-choice-warning">其余选项将放弃</p>' : ''}<button type="button" class="${zoom ? 'ov-btn ok' : 'reward-claim'}" data-act="${escAttr(action)}" data-i="${escAttr(index)}" data-cancel="false"${disabled ? ' disabled' : ''}>${label}</button>`;
}

// Cancel returns to the owning reward surface; it never means forfeiting rewards.
export function rewardReturnHTML({ action, organize = false, className = '', arrow = false }) {
  return `<button type="button"${className ? ` class="${escAttr(className)}"` : ''} data-${organize ? 'organize' : 'act'}="${escAttr(action)}" data-cancel="true">${arrow ? '<span aria-hidden="true">←</span> ' : ''}返回奖励</button>`;
}
