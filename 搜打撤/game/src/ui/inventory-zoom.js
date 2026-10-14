import { esc } from '../core/shared.js';
import { descRich } from '../cards/cards.view.js';
import '../../css/inventory-zoom.css';

export function decorateInventoryZoom(card, { description = card.desc || '' } = {}) {
  const zoom = document.getElementById('cardZoom');
  if (!zoom || zoom.querySelector('.inventory-zoom-info')) return;
  zoom.classList.add('inventory-zoom');
  zoom.setAttribute('aria-label', `${card.name}卡牌详情`);
  const acts = window.SDT.UI?._acts || {};
  const names = new Set(['stashCollectToggle', 'stashCollectOne', 'stashCollectAll', ...[...zoom.querySelectorAll('.cz-foot [data-act]')].map(button => button.dataset.act)]);
  zoom._inventoryActions = Object.fromEntries([...names].map(name => [name, acts[name]]).filter(([, handler]) => typeof handler === 'function'));
  const info = document.createElement('article');
  info.className = 'inventory-zoom-info';
  info.innerHTML = `<header><h2>${esc(card.name)}</h2><small>${esc(card.type || '')} · ${esc(card.rarity || '')}</small></header><section class="inventory-zoom-effect"><h3>卡牌效果</h3><div class="inventory-zoom-rules card-rules-copy">${descRich(description, card.id)}</div></section>`;
  zoom.querySelector('.cz-card')?.insertAdjacentElement('afterend', info);
  const close = zoom.querySelector('.cz-close');
  if (close) info.prepend(close);
  const footer = zoom.querySelector('.cz-foot');
  if (footer) info.append(footer);
}
