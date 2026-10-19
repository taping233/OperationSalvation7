/* 背包 v2 玻璃界面 · 纯渲染切片（2026-10-15 WF-bag-redesign-1015 实装，绝区零方向老板拍板）。
   只拼 HTML 字符串：不含流程、动作注册与存取；数据组装与 act 注册在壳 game.bag.js。
   架构约束（tests/bag-architecture.test.js）：切片不得 import 壳，互调只经桥。 */
import SDT from '../core/sdt-facade.js';
import { esc, escAttr } from '../core/shared.js';
import '../../css/bag-design-system.css';
import { bagUseLocation } from './game.bag.rules.js';
import '../../css/feedback-1018.css';

const RARITY_TINT = { '古朴': '#9fb0ba', '职业': '#5fcf94', '衍生': '#8ba0b8', '稀有': '#57a8f0', '史诗': '#b184e8', '传说': '#f0ac4e', '棱彩': '#ef86bd', '初始': '#8ba0b8' };
const TYPE_GLYPH = {
  '武术': '<path d="M14 3l7 7-9 9-3.5.9.9-3.5 9-9Z"/><path d="M13 6.5 17.5 11M5 19l2-2"/>',
  '法术': '<path d="M12 2l2.2 6.2L20 10l-5.8 1.8L12 18l-2.2-6.2L4 10l5.8-1.8L12 2Z"/><path d="M18.5 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"/>',
  '生物': '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M5 19c0-3 1.6-5 4-5s4 2 4 5M13.5 14.6c2.8-.4 5.5 1.2 5.5 4.4"/>',
  '装备': '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3"/>',
  '资源': '<path d="M12 3l7 4v10l-7 4-7-4V7l7-4Z"/><path d="M12 12l7-4M12 12 5 8M12 12v9"/>',
  '道具': '<path d="M12 2l6 7-6 13L6 9l6-7Z"/><path d="M6 9h12"/>',
  '能力卡': '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z"/>',
  '事件': '<path d="M7 3h10v4l-4 5 4 5v4H7v-4l4-5-4-5V3Z"/>',
};
const SUPPLY_ICONS = {
  '木材': '<ellipse cx="6" cy="12" rx="3" ry="6"/><path d="M6 6h12c1.7 0 3 2.7 3 6s-1.3 6-3 6H6"/><path d="M6 9c1.7 0 3 1.3 3 3s-1.3 3-3 3"/>',
  '口粮': '<rect x="5" y="7" width="14" height="12" rx="2"/><path d="M5 11h14M8 7V5h8v2M8 15.5h3"/>',
  '神秘钥匙': '<circle cx="8" cy="8" r="4"/><path d="M11 11l9 9M17 17l2.5-2.5M14.5 14.5 17 12"/>',
};
const RAIL_ICONS = {
  bag: '<path d="M5 8h14l-1.2 12H6.2L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
  safe: '<path d="M12 3l7 3v5c0 4.4-3 8.4-7 10-4-1.6-7-5.6-7-10V6l7-3Z"/><path d="M12 8v6M9 11h6"/>',
  pocket: '<path d="M6 4h12v6a6 6 0 0 1-12 0V4Z"/><path d="M9 20h6M12 16v4"/>',
  sort: '<path d="M4 7h10M4 12h7M4 17h4M17 4v14m0 0 3.5-3.5M17 18l-3.5-3.5"/>',
  tidy: '<path d="M5 4h4v4H5zM15 4h4v4h-4zM5 16h4v4H5zM15 16h4v4h-4zM9 6h6M7 9v7M7 16h8M16 9v7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
};

function svgIcon(paths, color) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}
export function rarityOf(card) {
  return (card && (SDT.Cards.rarityOf ? SDT.Cards.rarityOf(card) : card.rarity)) || '';
}
function stackIcon(name, type, supply) {
  if (supply) return SUPPLY_ICONS[name] || TYPE_GLYPH['资源'];
  return TYPE_GLYPH[type] || TYPE_GLYPH['资源'];
}
export function tileHTML(t, resourceCards = null) {
  const rc = t.supply ? '#aebfc9' : (RARITY_TINT[t.rarity] || '#9fb0ba');
  const select = t.supply ? '' : ` role="button" aria-label="查看${escAttr(t.name)}，${t.count}张${t.zone === 'pocket' ? '，已消耗' : ''}" data-act="inspectStack" data-name="${escAttr(t.name)}" data-safe="${t.safe ? 1 : 0}"${t.zone === 'pocket' ? ' data-pocket="1"' : ''}`;
  const identity = Array.isArray(t.uids) ? ` data-pane-key="${escAttr(JSON.stringify(t.uids))}"` : '';
  const stack = t.supply ? ` data-supply="${escAttr(t.name)}"` : ` data-stack="${escAttr(t.name)}"`;
  const spent = t.zone === 'pocket' ? ' spent' : '';
  const state = t.zone === 'safe' ? '押运' : t.zone === 'pocket' ? (['道具', '装备'].includes(t.type) ? '火堆不可复原' : '火堆可复原') : (t.type === '道具' ? (t.useStatus?.badge || { map: '可用', battle: '战斗使用' }[bagUseLocation(t.card)] || '查看用法') : '');
  if (t.card) {
    // 真实卡面（2026-10-15 老板反馈：格子接入现行卡面样式）；卡面自带名称与费用，
    // 点击开基地同款 inventory-zoom 看卡操作台
    return `<div class="bag-tile bag-slot card-face${spent}"${stack}${select}${identity} tabindex="0"
      style="--tint:${rc}1c;--glow:${rc}30"
      title="${escAttr(t.name)}${t.count > 1 ? ` ×${t.count}` : ''}">
      ${SDT.Cards.cardHTML(t.card, '', { hideCost: false }).replace(/\s+tabindex="0"/g, '')}
      ${state ? `<span class="bag-tstate"${t.useStatus?.reason ? ` title="${escAttr(t.useStatus.reason)}"` : ''}>${esc(state)}</span>` : ''}
      ${t.count > 1 ? `<span class="bag-tct">×${t.count}</span>` : ''}
    </div>`;
  }
  // 物资（木材/口粮/钥匙等）：按名字接同款资源卡面（老板反馈「也有卡牌样式可接入」），
  // 精确同名优先，尾部匹配兜底（神秘钥匙→一把钥匙）；无候选回退图标格。
  // 物资不可开操作台（点击无动作），价值看 tooltip。
  const lib = Array.isArray(resourceCards) ? resourceCards : (window.SDT.Cards.all?.() || []).filter(c => c.type === '资源');
  const supplyCard = lib.find(c => c.name === t.name)
    || lib.find(c => [...c.name].filter(ch => t.name.includes(ch)).length >= 2);
  if (supplyCard) {
    return `<div class="bag-tile bag-slot card-face${spent}" data-supply="${escAttr(t.name)}" tabindex="0"
      style="--tint:${rc}1c;--glow:${rc}30"
      title="${escAttr(t.name)}${t.count > 1 ? ` ×${t.count}` : ''} · ${t.tier || 'C'} 级物资 · 价值 ${(t.value || 0) * (t.count || 1)}">
      ${SDT.Cards.cardHTML({ ...supplyCard, value:Number(t.value) || 0 }, '', { hideCost: false })}
      ${state ? `<span class="bag-tstate"${t.useStatus?.reason ? ` title="${escAttr(t.useStatus.reason)}"` : ''}>${esc(state)}</span>` : ''}
      ${t.count > 1 ? `<span class="bag-tct">×${t.count}</span>` : ''}
    </div>`;
  }
  return `<div class="bag-tile bag-slot${spent}"${stack} tabindex="0"
      style="--tint:rgba(174,191,201,.09);--glow:rgba(174,191,201,.18)"
      title="${escAttr(t.name)}${t.count > 1 ? ` ×${t.count}` : ''} · ${t.tier || 'C'} 级物资 · 价值 ${(t.value || 0) * (t.count || 1)}">
      <span class="bag-tico">${svgIcon(stackIcon(t.name, t.type, true), rc)}</span>
      <span class="bag-tnm">${esc(t.name)}</span>
      ${state ? `<span class="bag-tstate"${t.useStatus?.reason ? ` title="${escAttr(t.useStatus.reason)}"` : ''}>${esc(state)}</span>` : ''}
      ${t.count > 1 ? `<span class="bag-tct">×${t.count}</span>` : ''}
    </div>`;
}

/* 整页：m = { bagZone, bagFilter, bagSortKey, cap, baseCap, total, safeUsedN, sCap, pkN, used, coins, fragments, tiles } */
export function pageHTML(m) {  const zoneNames = { bag: '随身背包', safe: '安全格', pocket: '消耗区' };
  // Share only within this render so catalog edits are visible on the next visit.
  const resourceCards = m.tiles.some(tile => !tile.card) ? (window.SDT.Cards.all?.() || []).filter(card => card.type === '资源') : [];
  const railBtn = (z, badge) => `
      <button class="bag-rz${m.bagZone === z ? ' on' : ''}" data-act="bagZone" data-zone="${z}" title="${zoneNames[z]}" aria-label="${zoneNames[z]}，${z === 'pocket' ? `${m.pkN} 张` : z === 'safe' ? `${m.safeUsedN}/${m.sCap} 格` : `${m.used}/${m.cap} 格`}" aria-pressed="${m.bagZone === z}">
        ${svgIcon(RAIL_ICONS[z], 'currentColor')}<span class="bag-rlabel">${z === 'bag' ? '背包' : zoneNames[z]}</span><span class="bag-bdg">${badge}</span>
      </button>`;
  const pills = [['all', '全部'], ['move', '招式'], ['装备', '装备'], ['道具', '道具'], ['资源', '资源']]
    .map(([f, label]) => `<button class="bag-pill${m.bagFilter === f ? ' on' : ''}" data-act="bagFilter" data-f="${f}" aria-pressed="${m.bagFilter === f}">${label}</button>`).join('');
  const ext = Math.max(0, m.cap - m.baseCap);
  const zoneUsed = m.bagZone === 'safe' ? m.safeUsedN : m.bagZone === 'pocket' ? m.pkN : m.used;
  const zoneCap = m.bagZone === 'safe' ? m.sCap : m.bagZone === 'pocket' ? null : m.cap;
  const pct = zoneCap == null ? 0 : Math.min(100, Math.round(zoneUsed / Math.max(1, zoneCap) * 100));
  const cardCount = m.bagZone === 'pocket' ? m.pkN : m.bagZone === 'safe' ? (m.safeCardN ?? m.tiles.reduce((n, t) => n + t.count, 0)) : (m.bagCardN ?? m.tiles.filter(t => !t.supply).reduce((n, t) => n + t.count, 0));
  const head = `
      <header class="bag-head2">
        <div class="bag-title"><h2>${zoneNames[m.bagZone]} ${window.SDT.UI.helpBtn('bag')}</h2></div>
        <div class="bag-capchip" aria-label="${zoneCap == null ? '消耗区卡牌数量' : '占格与卡牌张数'}">
          <span class="bag-capk">${zoneCap == null ? '卡牌' : '占格'}</span><span class="bag-capbar"><i style="width:${pct}%"></i></span>
          <b>${zoneUsed}</b><small>${zoneCap == null ? ' 张 · 不限容量' : `/${zoneCap} 格`}${m.bagZone === 'bag' && ext ? ` · ${m.capacityText ? esc(m.capacityText) : `扩展+${ext}`}` : ''}${m.bagZone === 'bag' && ext ? ` · 盒内 ${m.pearlStoredN || 0}/${ext} 张（不占格）` : ''}</small>
          ${zoneCap == null ? '' : `<span class="bag-count-summary">卡牌 <strong>${cardCount}</strong> 张${m.bagZone === 'bag' && m.supplyN ? ` · 散装物资 ${m.supplyN} 件` : ''}</span>`}
        </div>
      </header>`;
  const tools = m.bagZone === 'bag' ? `
      <div class="bag-tools">
        ${pills}<span class="bag-tgap"></span>
        <button class="bag-icbtn ui-control-icon" data-act="bagSortCycle" aria-label="切换背包排序" title="排序：稀有度 ⇄ 种类（当前${m.bagSortKey === 'rarity' ? '稀有度' : '种类'}）">${svgIcon(RAIL_ICONS.sort, 'currentColor')}</button>
        <button class="bag-icbtn gold ui-control-icon" data-act="bagTidy" aria-label="按稀有度整理背包" title="一键整理（按稀有度）">${svgIcon(RAIL_ICONS.tidy, 'currentColor')}</button>
      </div>` : '';
  const board = `
      <div class="bag-board">
        ${m.receipt ? `<p class="bag-receipt" role="status">${esc(m.receipt)}</p>` : ''}
        <div class="bag-grid" data-zone="${m.bagZone}">${m.tiles.map(tile => tileHTML(tile, resourceCards)).join('')}</div>
        ${m.tiles.length ? '' : `<p class="bag-empty2">${m.bagZone === 'bag' && m.bagFilter !== 'all' ? '该分类没有卡牌或物资。<button class="bag-pill" data-act="bagFilter" data-f="all">显示全部</button>' : `（${zoneNames[m.bagZone]}是空的）`}</p>`}
      </div>`;
  const exit = `<button class="archive-back" data-act="closeBag" title="关闭背包（B）" aria-label="关闭背包">
        <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
          <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M4 12h10M4 12l4-4M4 12l4 4"
                fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;
  return `<div class="bag-view bag-v2 ui-design-system bag-art-v3">
      <img class="bag-bg" src="assets/scenes/map-nodes/map-atmosphere-is7-1012.webp" alt="" aria-hidden="true">
      <div class="bag-shell">
        <nav class="bag-rail">
          ${exit}
          ${railBtn('bag', m.used)}
          ${railBtn('safe', `${m.safeUsedN}/${m.sCap}`)}
          ${railBtn('pocket', m.pkN)}
        </nav>
        <section class="bag-col">${head}${tools}${board}</section>
      </div>
    </div>`;
}
