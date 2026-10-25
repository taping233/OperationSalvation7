import { mountCollectionView, collectionItemHTML, collectionWorkspaceHTML } from '../ui/collection-view.js';
import { animateBaseRefresh } from './base-motion-v4.js';
import { esc, escAttr } from '../core/shared.js';
import { cardBrowserHTML } from '../ui/card-browser.js';
import { bindCardNavigation } from './hub.presentation.js';
import { decorateInventoryZoom } from '../ui/inventory-zoom.js';
import '../../css/base-collection-v4.css';

const browse = {slot:null,query:'',type:'',selectedId:''};
let rendered;
function ownedReader(base,cards) {
  let catalog,stash;
  const rows = new Map();
  return id => {
    if (rows.has(id)) return rows.get(id);
    const records = base.data.collection || {};
    if (!Object.hasOwn(records,id)) return null;
    const record = records[id];if (!record) return null;
    if (!catalog) {
      catalog = new Map(cards.all().map(card => [card.id,card]));
      stash = new Map((base.data.stash || []).map(stack => [stack.card.id,stack.card]));
    }
    const card = catalog.get(id) || stash.get(id);
    const row = {id,card,name:card?.name || record.name || id};rows.set(id,row);return row;
  };
}
const synchronize = base => { if (browse.slot !== base.slot) Object.assign(browse,{slot:base.slot,query:'',type:'',selectedId:''}); };
const detailHTML = (row, cards) => row ? `<div class="collection-v12-display">${row.card ? cards.cardHTML(row.card, 'sm') : '<span class="collection-legacy">旧收藏档案</span>'}</div><div class="collection-v12-info"><h3>${esc(row.name)}</h3>${row.card ? `<dl><div><dt>类型</dt><dd>${esc(row.card.type || '卡牌')}</dd></div><div><dt>稀有度</dt><dd>${esc(row.card.rarity || '—')}</dd></div></dl><button type="button" class="mini-btn base-command" data-act="collectionV12Zoom" data-id="${escAttr(row.id)}">详情 →</button>` : '<p>旧收藏档案</p>'}</div>` : '';

export function collectionCardsHTML(base, cards) {
  synchronize(base);
  const read = ownedReader(base,cards);
  const owned = Object.keys(base.data.collection || {}).map(read).filter(Boolean);
  rendered = {base,cards,rows:new Map(owned.map(row => [row.id,row]))};
  const types = [...new Set(owned.map(row => row.card?.type).filter(Boolean))];
  const selected = owned.find(row => row.id === browse.selectedId) || owned[0];
  browse.selectedId = selected?.id || '';
  return collectionWorkspaceHTML('owned',{className:'collection-cards-v4 collection-v12',attrs:{'data-empty':!owned.length},
    tools:`<div class="collection-browse-tools collection-toolbar"${owned.length ? '' : ' hidden'}><input data-collection-query aria-label="搜索收藏卡牌" placeholder="搜索收藏卡牌" value="${escAttr(browse.query)}"><select data-collection-type aria-label="筛选收藏卡牌类型"><option value="">全部类型</option>${types.map(value => `<option value="${escAttr(value)}"${value === browse.type ? ' selected' : ''}>${esc(value)}</option>`).join('')}</select><span data-collection-count>${owned.length} 张已收藏</span></div>`,
    detail:`<section class="collection-v12-stage collection-detail" aria-live="polite">${detailHTML(selected,cards)}</section>`,
    list:cardBrowserHTML('collection-owned','已收藏卡牌',owned.map(row => collectionItemHTML(row.id,row.name,{
      className:'collection-card',artClass:'collection-card-art',selected:row.id === browse.selectedId,ariaLabel:`选择${row.name}`,
      attrs:{'data-search':row.name,'data-type':row.card?.type || ''},
    })).join(''),{rows:1}),
    empty:`<div class="collection-empty"${owned.length ? ' hidden' : ''}><h3>${owned.length ? '没有匹配的收藏卡牌' : '尚未收藏卡牌'}</h3>${owned.length ? '' : '<p>在仓库收藏卡牌。</p>'}<button class="mini-btn base-command" data-act="${owned.length ? 'collectionReset' : 'hubTab'}" data-tab="stash" data-view="cards">${owned.length ? '显示全部收藏' : '前往仓库 →'}</button></div>`,
  });
}

export function bindCollectionCards({ root, base, cards, ui }) {
  const content = root.querySelector('.collection-cards-v4');
  if (!content) return;
  const browser = content.querySelector('[data-card-browser]'), slotId = base.slot;
  let initial = rendered?.base === base && rendered.cards === cards ? rendered.rows : null;
  const view = mountCollectionView({root:content,browser,state:browse,selection:'selectedId',
    current:() => content.isConnected && root.contains(content) && base.slot === slotId,
    beforeRefresh:() => initial ? id => initial.get(id) : ownedReader(base,cards),
    resolve:(id,operation) => (operation || ownedReader(base,cards))(id),keyOf:row => row.id,
    matches:button => (!browse.query.trim() || button.dataset.search.toLowerCase().includes(browse.query.trim().toLowerCase())) && (!browse.type || button.dataset.type === browse.type),
    detail:{selector:'.collection-v12-stage',html:row => detailHTML(row,cards),
      enterGroups:['.collection-v12-display','.collection-v12-info']},motion:animateBaseRefresh,
    results:({items,visible}) => {
      content.querySelector('[data-collection-count]').textContent = browse.query.trim() || browse.type
        ? `匹配 ${visible.length} / 已收藏 ${items.length}` : `${items.length} 张已收藏`;
      content.querySelector('.collection-empty').hidden = visible.length > 0;
      content.dataset.empty = String(!visible.length);
    },
    prepareArt:(items,operation) => {
      const read = operation || (initial ? id => initial.get(id) : ownedReader(base,cards));
      return item => {const row = read(item.dataset.browserKey);return row?.card ? cards.cardHTML(row.card,'sm') : '<span class="collection-legacy">旧收藏档案</span>';};
    },
    onPage:() => animateBaseRefresh(browser.querySelector('.card-browser-track')),
    controls:[['[data-collection-query]','query'],['[data-collection-type]','type']],
  });
  initial = null;rendered = null;
  ui.act('collectionV12Zoom',data => {
    if (!view.current()) return;
    const card = ownedReader(base,cards)(data.id)?.card;
    if (!card) return;
    ui.showCardZoom(card,{presentation:'inventory',from:content.querySelector('[data-act="collectionV12Zoom"]')});
    decorateInventoryZoom(card);
  });
  ui.act('collectionReset',view.reset);
  bindCardNavigation(browser.querySelector('.card-browser-track'),'[data-browser-key]',{activate:false});
}
