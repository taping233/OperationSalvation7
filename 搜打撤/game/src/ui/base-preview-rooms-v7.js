import { cardBrowserHTML } from './card-browser.js';
import { warehouseCategoriesV7HTML } from '../hub/hub.warehouse-categories-v7.js';
import { CHARACTERS, characterFor } from '../core/characters.js';
import { esc } from '../core/shared.js';

export const previewCards = [
  { name:'长剑', file:'equip-tt3-longsword.webp', group:'battle', count:3 },
  { name:'冰刺', file:'spell-tt3-ice-spike.webp', group:'battle', count:2 },
  { name:'三连射', file:'martial-tt3-double-shot.webp', group:'battle', count:4 },
  { name:'血箭', file:'martial-tt3-blood-arrow.webp', group:'battle', count:2 },
  { name:'满月形态', file:'spell-tt3-nature-form.webp', group:'growth', count:1 },
];
export const previewCardImage = card => new URL(`../../assets/cards/${card.file}`, import.meta.url).href;
const portrait = (id, kind) => new URL(`../../assets/portraits/${kind}/${id}.webp`, import.meta.url).href;
const art = card => `<img src="${previewCardImage(card)}" alt="${card.name}" draggable="false">`;
function cardItems(cards, collection = false) {
  return cards.map(card => `<button type="button" class="${collection ? 'collection-card' : 'stash-cell'}" data-browser-key="${card.name}" data-preview-card="${card.name}"><span class="${collection ? 'collection-card-art' : 'warehouse-card-art'}">${art(card)}</span><span class="stash-card-caption"><b>${card.name}</b>${collection ? '' : `<strong class="stack-count">×${card.count}</strong>`}</span></button>`).join('');
}
export function warehousePreviewV7HTML({ group = '', query = '' } = {}) {
  const cards = previewCards.filter(card => (!group || card.group === group) && (!query || card.name.includes(query)));
  return `<div class="warehouse-v3 warehouse-v2"><header class="camp-section-head"><h2>后勤仓库</h2><div class="warehouse-header-actions"><button class="base-link" data-act="hubTab" data-tab="shop">交易所 ↗</button><span class="camp-page-stat">12 / 50 格</span></div></header>${warehouseCategoriesV7HTML(group)}<div class="warehouse-purpose" hidden></div><div class="warehouse-toolbar"><input data-preview-search placeholder="搜索卡牌" aria-label="搜索示例卡牌" value="${esc(query)}"><span>${cards.length} 种</span></div>${cardBrowserHTML('design-warehouse-v7', '示例仓库卡牌', cardItems(cards), { rows:cards.length <= 6 ? 1 : 2 })}<div class="warehouse-no-results"${cards.length ? ' hidden' : ''}><h3>没有匹配的卡牌</h3></div></div>`;
}
export function tradePreviewV7HTML({ selected = '长剑', mode = 'buy' } = {}) {
  const card = previewCards.find(item => item.name === selected) || previewCards[0];
  return `<div class="trade-v5"><header class="trade-v5-heading"><h2>交易所</h2><span class="trade-v5-wallet">示例储备 <b>2400</b></span></header><nav class="trade-v5-modes"><button class="base-link ${mode === 'buy' ? 'on' : ''}" data-preview-trade-mode="buy">购入</button><button class="base-link ${mode === 'sell' ? 'on' : ''}" data-preview-trade-mode="sell">出售</button></nav><div class="trade-v5-workspace"><section class="trade-v5-list">${previewCards.map((item, index) => `<button type="button" class="trade-v5-item ${item.name === card.name ? 'on' : ''}" data-preview-trade="${item.name}"><span class="trade-v5-item-art">${art(item)}</span><b>${item.name}</b><span class="trade-v5-item-stock">示例持有 ×${item.count}</span><strong>${(index + 1) * 80} 币</strong></button>`).join('')}</section><article class="trade-v5-desk"><header class="trade-v5-desk-heading"><span>${mode === 'buy' ? '购入' : '出售'}</span><h3>${card.name}</h3></header><div class="trade-v5-art">${art(card)}</div><div class="trade-v5-balance"><span>持有</span><b>×${card.count}</b></div><div class="trade-v5-checkout"><button class="base-command base-command-primary" data-preview-card="${card.name}">查看卡牌 <span>↗</span></button></div></article></div></div>`;
}
export function personnelPreviewV7HTML(id = 'wu') {
  const person = characterFor(id) || CHARACTERS[0];
  return `<div class="personnel-v2"><header class="camp-section-head"><h2>角色</h2></header><div class="person-stage"><nav class="person-roster">${CHARACTERS.map(item => `<button class="person-face ${item.id === person.id ? 'on' : ''}" data-preview-person="${item.id}"><img class="person-face-art" src="${portrait(item.id, 'avatars')}" alt=""><b>${item.name}</b><small>${item.rulesetId}</small></button>`).join('')}</nav><figure class="person-hero"><img src="${portrait(person.id, 'full')}" alt="${person.name}"><figcaption><h3>${person.name}</h3><span>${person.rulesetId}</span></figcaption></figure><article class="person-details"><div class="person-growth-summary"><span>人物档案</span><h3>${person.name}</h3><span class="person-level">Lv.1</span></div><h4>${person.rulesetId}</h4><div class="person-utilities"><button data-act="hubTab" data-tab="stash">查看培养卡牌 ↗</button><button data-act="hubTab" data-tab="ach">查看收藏 ↗</button></div></article></div></div>`;
}
export function collectionPreviewV7HTML() {
  return `<div class="hub-archive-v3"><header class="av3-header"><h2>收藏室</h2><span class="camp-page-stat">示例藏品 ${previewCards.length}</span></header><div class="av3-collection-sample">${cardBrowserHTML('design-collection-v7', '示例收藏卡牌', cardItems(previewCards, true))}</div></div>`;
}
export function cardPreviewV7HTML(name) {
  const card = previewCards.find(item => item.name === name) || previewCards[0];
  return `<section class="base-preview-card-page"><button class="base-link" data-preview-back>← 返回上一页</button><figure>${art(card)}</figure><article><span>卡牌档案</span><h2>${card.name}</h2><button class="base-command" data-preview-back>返回浏览 ↗</button></article></section>`;
}
