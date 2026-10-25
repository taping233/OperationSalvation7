// Presentation only: achievement predicates and reward claims stay in Meta/Base.
import { achievementMedalHTML, pickAchievementMedalStyle } from './achievement-medals.js';
import { createAchievementMotion } from './achievement-motion.js';
import { linkedBackHTML } from './home-linked-interactions.js';
import { collectionHeaderHTML, collectionToolbarHTML } from './collection-chrome.js';
import { transitionRegion, cancelRegionTransition } from './region-transition.js';
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[char]));
const CATEGORIES = [
  { id: 'all', name: '全部奖章', color: '#a2aaa8' },
  { id: 'journey', name: '远征奖章', color: '#b2a66d', ids: ['firstExtract', 'extract3', 'rich30'] },
  { id: 'battle', name: '战斗奖章', color: '#c18e75', ids: ['kill10', 'firstBoss', 'allBoss', 'unlimitedEnergy', 'weaponMaster', 'excuseMe'] },
  { id: 'growth', name: '成长奖章', color: '#94b1ae', ids: ['bagMax', 'safeMax', 'class3', 'petHatch1', 'petHatch3', 'petMax', 'petAll'] },
  { id: 'collection', name: '典藏奖章', color: '#b5a0b6', ids: ['stash20', 'collectGold', 'collectLegend', 'collect5', 'runeFan', 'beautifulVase'] },
  { id: 'research', name: '研究奖章', color: '#a4b7cd', ids: ['savior', 'labScore1', 'labScore2', 'labScore3'] },
];
export function achievementGalleryHTML({ achievements, base, slot, isUnlocked, backs, cards, random = Math.random }) {
  const medalStyle = pickAchievementMedalStyle(random);
  const entries = achievements.map((achievement, index) => ({
    ...achievement, number: String(index + 1).padStart(2, '0'),
    category: CATEGORIES.find(category => category.ids?.includes(achievement.id)) || CATEGORIES[1],
    unlocked: !!base && isUnlocked(achievement, base),
    claimed: !!base?.achClaimed?.[achievement.id],
  }));
  const done = entries.filter(entry => entry.unlocked).length;
  const pending = entries.filter(entry => entry.unlocked && !entry.claimed).length;
  const claimed = entries.filter(entry => entry.claimed).length;
  const percentage = entries.length ? Math.round(done / entries.length * 100) : 0;
  const cardNames = new Map(cards.map(card => [card.id, card.name]));
  const backNames = new Map(backs.map(back => [back.id, back.name]));
  const tiles = entries.map(entry => {
    const rewards = [
      entry.reward?.wood ? `木材 ×${entry.reward.wood}` : '',
      entry.reward?.rations ? `口粮 ×${entry.reward.rations}` : '',
      entry.reward?.keys ? `钥匙 ×${entry.reward.keys}` : '',
      entry.reward?.card ? cardNames.get(entry.reward.card) || '稀有卡牌' : '',
      entry.back ? `卡背 · ${backNames.get(entry.back) || entry.back}` : '',
    ].filter(Boolean).join(' / ') || '远征纪念';
    const state = entry.claimed ? 'claimed' : entry.unlocked ? 'unlocked' : 'locked';
    const label = entry.claimed ? '已领取' : entry.unlocked ? '已获得 · 待领取' : '未获得';
    return `<button type="button" class="ag-medal ag-${state}" aria-pressed="false" data-gallery-item data-medal-id="${esc(entry.id)}" data-number="${entry.number}" data-rewards="${esc(rewards)}" data-category="${entry.category.id}" data-unlocked="${entry.unlocked}" data-search="${esc(entry.name + ' ' + entry.desc)}" aria-label="${esc(entry.name)}，${label}，查看详情">
      <span class="ag-emblem">${achievementMedalHTML(entry.id, 'tile', medalStyle)}</span>
      <span class="ag-medal-copy"><span class="ag-item-heading"><strong>${esc(entry.name)}</strong><span class="ag-state"><i>${entry.unlocked ? '✓' : '◇'}</i>${label}</span></span>
      <span class="ag-description">${esc(entry.desc)}</span>
      <span class="ag-item-footer">${entry.category.name}</span></span>
    </button>`;
  }).join('');
  const categories = `<nav class="ag-categories" aria-label="奖章分类">${CATEGORIES.map(category => `<button type="button" data-gallery-category="${category.id}" aria-pressed="${category.id === 'all'}">${category.name}<small>${category.id === 'all' ? entries.length : entries.filter(entry => entry.category.id === category.id).length}</small></button>`).join('')}</nav>`;
  const summary = `<div class="ag-summary"><span class="ag-total">已获得 <strong>${done}</strong><span>/ ${entries.length}</span></span><div class="ag-progress" role="progressbar" aria-label="成就收集进度" aria-valuemin="0" aria-valuemax="${entries.length}" aria-valuenow="${done}"><span style="width:${percentage}%"></span><i class="ag-cabinet-glint" aria-hidden="true"></i></div><span class="ag-archive">${slot ? `档案 ${String(slot).padStart(2,'0')}` : '尚无远征档案'}</span></div>`;
  const filters = `<nav class="ag-filters" aria-label="获得状态"><button type="button" data-gallery-filter="all" aria-pressed="true">全部</button><button type="button" data-gallery-filter="unlocked" aria-pressed="false">已获得</button><button type="button" data-gallery-filter="locked" aria-pressed="false">未获得</button><button type="button" data-gallery-filter="pending" aria-pressed="false">待领取 <b>${pending}</b></button><button type="button" data-gallery-filter="claimed" aria-pressed="false">已领取 <b>${claimed}</b></button></nav>`;
  const actions = `<details class="ag-display-menu"><summary>展柜灯光</summary><div class="ag-display-options"><button type="button" data-gallery-ambient aria-pressed="true">微光 · 开</button><button type="button" data-gallery-polish>擦亮展柜</button></div></details>`;
  return `<section class="achievement-gallery" aria-label="成就陈列室" data-medal-style="${medalStyle}">
    ${collectionHeaderHTML({title:'成就陈列室',back:linkedBackHTML('achBack','返回','ag-back'),navigation:categories,summary,actions,className:'ag-header'})}
    <div class="ag-tools">${collectionToolbarHTML({search:'<label class="ag-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="搜索成就" placeholder="搜索奖章或获得条件" autocomplete="off"/></label>',filters,results:`<span class="ag-result-count" aria-live="polite">${entries.length} 枚奖章</span><nav class="ag-view" aria-label="陈列方式"><button type="button" data-gallery-view="list" aria-pressed="true">列表</button><button type="button" data-gallery-view="grid" aria-pressed="false">网格</button></nav>`,className:'ag-list-heading',label:'成就搜索与筛选'})}</div>
    <div class="ag-body">
      <main class="ag-content"><div class="ag-scroll"><div class="ag-grid" data-view="list">${tiles}</div><div class="ag-empty" hidden><h3>暂无符合条件的奖章</h3><p class="ag-empty-copy">试试其他分类或搜索词。</p><button type="button" data-gallery-reset>查看全部奖章</button></div></div></main>
      <aside class="ag-inspector" aria-label="奖章浏览详情"><div class="ag-detail-empty"><span aria-hidden="true">◇</span><h3>选择一枚奖章</h3><p>查看获得方式与奖励，可连续切换比较。</p></div><section class="ag-detail" hidden role="region" aria-label="奖章详情"><div class="ag-detail-toolbar"><button type="button" data-gallery-prev aria-label="上一枚奖章">←</button><button type="button" data-gallery-next aria-label="下一枚奖章">→</button><button type="button" class="ag-detail-close" data-gallery-dismiss data-cancel="true" aria-label="收起奖章详情">收起详情</button></div><div class="ag-detail-content"></div></section></aside>
    </div>
  </section>`;
}
// Detail content is built only for the selected medal, not for every tile at entry.
function achievementDetailHTML(tile, style) {
  const claimed = tile.classList.contains('ag-claimed');
  const unlocked = tile.dataset.unlocked === 'true';
  const category = CATEGORIES.find(item => item.id === tile.dataset.category) || CATEGORIES[1];
  const label = claimed ? '已领取' : unlocked ? '已获得 · 待领取' : '未获得';
  return `<span class="ag-detail-art">${achievementMedalHTML(tile.dataset.medalId, 'detail', style)}</span><span class="ag-detail-copy"><span class="ag-detail-category">${category.name} / NO. ${esc(tile.dataset.number)}</span><h3>${esc(/** @type {HTMLElement} */ (tile.querySelector('.ag-item-heading strong')).textContent)}</h3><span class="ag-state"><i>${unlocked ? '✓' : '◇'}</i>${label}</span><p class="ag-detail-condition"><b>获得方式</b><span>${esc(/** @type {HTMLElement} */ (tile.querySelector('.ag-description')).textContent)}</span></p><p class="ag-detail-reward"><b>达成奖励</b><span>${esc(tile.dataset.rewards)}</span></p><p class="ag-detail-note">${claimed ? '奖励已记入该档位的基地档案。' : unlocked ? '请进入该档位的基地领取奖励。' : '完成以上条件后，即可解锁这枚奖章。'}</p></span>`;
}
export function bindAchievementGallery(root, { deferEntry = false } = {}) {
  if (!root) return { closeDetail: () => false };
  const input = /** @type {HTMLInputElement} */ (root.querySelector('input'));
  const tiles = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-item]'))];
  const filters = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-filter]'))];
  const categories = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-category]'))];
  const detail = /** @type {HTMLElement} */ (root.querySelector('.ag-detail'));
  const detailEmpty = /** @type {HTMLElement} */ (root.querySelector('.ag-detail-empty'));
  const detailContent = /** @type {HTMLElement} */ (root.querySelector('.ag-detail-content'));
  const motion = createAchievementMotion(root);
  let cancelEntryWait = () => {};
  let selected = 'all', category = 'all', openedTile = null;
  let polishAnimation = null;
  const visibleTiles = () => tiles.filter(tile => !tile.hidden);
  const syncDetailNavigation = () => {
    const visible = visibleTiles(), index = visible.indexOf(openedTile);
    /** @type {HTMLButtonElement} */ (root.querySelector('[data-gallery-prev]')).disabled = index <= 0;
    /** @type {HTMLButtonElement} */ (root.querySelector('[data-gallery-next]')).disabled = index < 0 || index >= visible.length - 1;
  };
  const closeDetail = ({restoreFocus = true} = {}) => {
    if (detail.hidden) return false;
    cancelRegionTransition(detailContent);
    motion.closeDetail(() => { detail.hidden = true; detailEmpty.hidden = false; });
    tiles.forEach(tile => tile.setAttribute('aria-pressed','false'));
    if (restoreFocus && openedTile?.isConnected && !openedTile.hidden) openedTile.focus({preventScroll:true});
    return true;
  };
  const selectDetail = button => {
    cancelEntryWait();
    const changed = detailContent.dataset.medalId !== button.dataset.medalId;
    const initial = detail.hidden;
    cancelRegionTransition(detailContent);
    openedTile = button;
    detail.hidden = false; detailEmpty.hidden = true;
    tiles.forEach(tile => tile.setAttribute('aria-pressed', String(tile === button)));
    if (changed) {
      const html = achievementDetailHTML(button, root.dataset.medalStyle);
      const commit = () => { detailContent.innerHTML = html; detailContent.dataset.medalId = button.dataset.medalId; };
      if (initial) commit();
      else void transitionRegion(detailContent, commit, {direction:0,isCurrent:() => root.isConnected && !detail.hidden && openedTile === button});
    }
    motion.openDetail(button);
    syncDetailNavigation();
  };
  const refresh = (reason = 'search') => {
    cancelEntryWait();
    const anchor = motion.captureAnchor();
    const query = input.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const tile of tiles) {
      const matchesState = selected === 'all' || selected === 'pending' && tile.classList.contains('ag-unlocked') || selected === 'claimed' && tile.classList.contains('ag-claimed') || selected === 'unlocked' && tile.dataset.unlocked === 'true' || selected === 'locked' && tile.dataset.unlocked !== 'true';
      tile.hidden = !matchesState || (category !== 'all' && tile.dataset.category !== category) || !tile.dataset.search.toLocaleLowerCase().includes(query);
      if (!tile.hidden) visible++;
    }
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryFilter === selected)));
    categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryCategory === category)));
    /** @type {HTMLElement} */ (root.querySelector('.ag-empty')).hidden = visible > 0;
    /** @type {HTMLElement} */ (root.querySelector('.ag-empty')).dataset.emptyState = selected === 'unlocked' && !query ? 'earned' : 'filtered';
    /** @type {HTMLElement} */ (root.querySelector('.ag-empty-copy')).textContent = selected === 'unlocked' && !query
      ? '尚未获得奖章。' : selected === 'pending' ? '当前范围没有待领取奖励。' : selected === 'claimed' ? '当前范围没有已领取的奖章。' : '试试其他分类、名称或获得条件。';
    /** @type {HTMLElement} */ (root.querySelector('.ag-result-count')).textContent = `${visible} 枚奖章`;
    if (reason === 'category' || reason === 'reset') /** @type {HTMLElement} */ (root.querySelector('.ag-scroll')).scrollTop = 0;
    else motion.restoreAnchor(anchor);
    if (openedTile?.hidden) closeDetail({restoreFocus:false});
    syncDetailNavigation();
    motion.revealList(reason);
  };
  input.addEventListener('input', () => refresh('search'));
  detail.addEventListener('keydown', event => {
    // The shared overlay capture route uses the visible cancel button. Standalone
    // galleries retain the same top-detail Escape behavior without that host.
    if (event.key === 'Escape') {
      if (event.isComposing || event.keyCode === 229) return;
      if (!detail.hidden) {
        event.preventDefault(); event.stopPropagation();
        if (!event.repeat) closeDetail();
      }
      return;
    }
  });
  root.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
    if (event.target.closest('[data-gallery-dismiss]')) { closeDetail(); return; }
    const button = event.target.closest('button');
    if (!button) return;
    if (button.hasAttribute('data-gallery-ambient')) {
      const off = root.classList.toggle('ag-ambient-off');
      button.setAttribute('aria-pressed', String(!off));
      button.textContent = off ? '微光 · 关' : '微光 · 开';
      return;
    }
    if (button.hasAttribute('data-gallery-polish')) {
      if (document.body.classList.contains('reduce-motion') || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
      const glint = /** @type {HTMLElement} */ (root.querySelector('.ag-cabinet-glint'));
      polishAnimation?.cancel();
      polishAnimation = glint?.animate?.([
        { opacity: 0, transform: 'translateX(-110%)' },
        { opacity: 1, transform: 'translateX(0)', offset: .45 },
        { opacity: 0, transform: 'translateX(110%)' },
      ], { duration: 1100, easing: 'ease-in-out' });
      return;
    }
    if (button.dataset.galleryFilter && selected !== button.dataset.galleryFilter) {
      selected = button.dataset.galleryFilter;
      refresh('filter');
    }
    if (button.dataset.galleryCategory && category !== button.dataset.galleryCategory) {
      category = button.dataset.galleryCategory;
      refresh('category');
    }
    if (button.dataset.galleryView) {
      const grid = /** @type {HTMLElement} */ (root.querySelector('.ag-grid'));
      if (grid.dataset.view === button.dataset.galleryView) return;
      const anchor = motion.captureAnchor();
      grid.dataset.view = button.dataset.galleryView;
      /** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll('[data-gallery-view]')).forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      motion.restoreAnchor(anchor);
      motion.revealList('layout');
    }
    if (button.hasAttribute('data-gallery-reset')) { selected = 'all'; category = 'all'; input.value = ''; refresh('reset'); input.focus(); }
    if (button.hasAttribute('data-gallery-prev') || button.hasAttribute('data-gallery-next')) {
      const visible = visibleTiles(), index = visible.indexOf(openedTile);
      const next = visible[index + (button.hasAttribute('data-gallery-prev') ? -1 : 1)];
      if (next) { selectDetail(next); next.scrollIntoView?.({block:'nearest'}); }
    }
    if (button.hasAttribute('data-gallery-item')) selectDetail(button);
  });
  if (!deferEntry) motion.enterGallery();
  else {
    // The caller installs its cut in this same turn. Watch its removal so both
    // cold and warm entry keep medal animations until the page is uncovered.
    const overlay = root.closest('#overlay');
    let entryCancelled = false;
    root.dataset.galleryEntry = 'waiting';
    const observer = new MutationObserver(enterWhenVisible);
    cancelEntryWait = () => { entryCancelled = true; observer.disconnect(); delete root.dataset.galleryEntry; };
    function enterWhenVisible() {
      if (entryCancelled) return;
      if (!root.isConnected || overlay?.hidden || overlay?.classList.contains('closing') || overlay?.hasAttribute('data-ui-closing')) {
        cancelEntryWait(); return;
      }
      if (document.querySelector('.page-loading') || overlay?.querySelector('.camp-entry-cut')) return;
      cancelEntryWait();
      motion.enterGallery();
    }
    observer.observe(document.body, { childList:true });
    if (overlay) {
      observer.observe(overlay, { childList:true, subtree:true, attributes:true, attributeFilter:['hidden','class','data-ui-closing'] });
      if (overlay.parentElement) observer.observe(overlay.parentElement, { childList:true });
    }
    queueMicrotask(enterWhenVisible);
  }
  return { closeDetail };
}
