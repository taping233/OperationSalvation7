// Presentation only: achievement predicates and reward claims stay in Meta/Base.
import { achievementMedalHTML, pickAchievementMedalStyle } from './achievement-medals.js';
import { createAchievementMotion } from './achievement-motion.js';
import { linkedBackHTML } from './home-linked-interactions.js';
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
    return `<button type="button" class="ag-medal ag-${state}" data-gallery-item data-category="${entry.category.id}" data-unlocked="${entry.unlocked}" data-search="${esc(entry.name + ' ' + entry.desc)}" aria-label="${esc(entry.name)}，${label}，查看详情">
      <span class="ag-emblem">${achievementMedalHTML(entry.id, 'tile', medalStyle)}</span>
      <span class="ag-medal-copy"><span class="ag-item-heading"><strong>${esc(entry.name)}</strong><span class="ag-state"><i>${entry.unlocked ? '✓' : '◇'}</i>${label}</span></span>
      <span class="ag-description">${esc(entry.desc)}</span>
      <span class="ag-item-footer"><span>${entry.category.name} / NO. ${entry.number}</span><span>查看详情 ↗</span></span></span>
      <template class="ag-detail-source"><span class="ag-detail-art">${achievementMedalHTML(entry.id, 'detail', medalStyle)}</span><span class="ag-detail-copy"><span class="ag-detail-category">${entry.category.name} / NO. ${entry.number}</span><h3>${esc(entry.name)}</h3><span class="ag-state"><i>${entry.unlocked ? '✓' : '◇'}</i>${label}</span><p class="ag-detail-condition"><b>获得方式</b><span>${esc(entry.desc)}</span></p><p class="ag-detail-reward"><b>达成奖励</b><span>${esc(rewards)}</span></p><p class="ag-detail-note">${entry.claimed ? '奖励已记入该档位的基地档案。' : entry.unlocked ? '请进入该档位的基地领取奖励。' : '完成以上条件后，即可解锁这枚奖章。'}</p></span></template>
    </button>`;
  }).join('');
  return `<section class="achievement-gallery" aria-label="成就陈列室" data-medal-style="${medalStyle}">
    <header class="ag-header"><div class="ag-title-group">${linkedBackHTML('achBack', '返回', 'ag-back')}<div><span class="ag-kicker">WINTER / HONOURS</span><h2>成就陈列室</h2></div></div>
    <div class="ag-header-tools"><nav class="ag-filters" aria-label="获得状态"><button type="button" data-gallery-filter="all" aria-pressed="true">全部</button><button type="button" data-gallery-filter="unlocked" aria-pressed="false">已获得</button><button type="button" data-gallery-filter="locked" aria-pressed="false">未获得</button></nav><nav class="ag-view" aria-label="陈列方式"><button type="button" data-gallery-view="list" aria-pressed="true">☷ 分列</button><button type="button" data-gallery-view="grid" aria-pressed="false">▦ 集中</button></nav></div></header>
    <div class="ag-body">
      <aside class="ag-summary"><div class="ag-watermark" aria-hidden="true">${achievementMedalHTML('collectLegend', 'watermark', medalStyle)}<i class="ag-cabinet-glint"></i></div><div class="ag-ambient-specks" aria-hidden="true"><i></i><i></i><i></i></div><span class="ag-summary-label">总收集数</span><div class="ag-total"><strong>${done}</strong><span>/ ${entries.length}</span></div><div class="ag-progress" role="progressbar" aria-label="成就收集进度" aria-valuemin="0" aria-valuemax="${entries.length}" aria-valuenow="${done}"><span style="width:${percentage}%"></span></div><p class="ag-collection-rate">收集率 <b>${percentage}%</b></p><div class="ag-counts"><span><i class="ag-dot earned"></i>已获得<b>${done}</b></span><span><i class="ag-dot pending"></i>待领取<b>${pending}</b></span><span><i class="ag-dot claimed"></i>已领取<b>${claimed}</b></span></div><p class="ag-archive">${slot ? `档案 0${slot} · 最近游玩` : '尚无远征档案'}</p><details class="ag-display-menu"><summary>展柜灯光<span aria-hidden="true">⌄</span></summary><div class="ag-display-options"><button type="button" data-gallery-ambient aria-pressed="true">微光 · 开</button><button type="button" data-gallery-polish>擦亮展柜 ✦</button></div></details></aside>
      <main class="ag-content"><div class="ag-list-heading"><label class="ag-search"><span aria-hidden="true">⌕</span><input type="search" aria-label="搜索成就" placeholder="搜索奖章或获得条件" autocomplete="off"/></label><span class="ag-result-count" aria-live="polite">${entries.length} 枚奖章</span></div><div class="ag-scroll"><div class="ag-grid" data-view="list">${tiles}</div><div class="ag-empty" hidden><span aria-hidden="true">◇</span><h3>暂无符合条件的奖章</h3><p class="ag-empty-copy">试试其他分类或搜索词。</p><button type="button" data-gallery-reset>查看全部奖章</button></div></div></main>
      <nav class="ag-categories" aria-label="奖章分类">${CATEGORIES.map(category => `<button type="button" data-gallery-category="${category.id}" aria-pressed="${category.id === 'all'}">${category.name}<small>${category.id === 'all' ? entries.length : entries.filter(entry => entry.category.id === category.id).length}</small></button>`).join('')}</nav>
    </div>
    <div class="ag-detail-backdrop" hidden data-gallery-dismiss aria-hidden="true"></div>
    <section class="ag-detail" hidden role="dialog" aria-modal="true" aria-label="奖章详情" tabindex="-1"><div class="ag-detail-content"></div></section>
  </section>`;
}
export function bindAchievementGallery(root) {
  if (!root) return { closeDetail: () => false };
  const input = root.querySelector('input');
  const tiles = [...root.querySelectorAll('[data-gallery-item]')];
  const filters = [...root.querySelectorAll('[data-gallery-filter]')];
  const categories = [...root.querySelectorAll('[data-gallery-category]')];
  const detail = root.querySelector('.ag-detail');
  const backdrop = root.querySelector('.ag-detail-backdrop');
  const body = root.querySelector('.ag-body');
  const header = root.querySelector('.ag-header');
  const motion = createAchievementMotion(root);
  let selected = 'all', category = 'all', openedTile = null;
  let detailClosing = false;
  let polishAnimation = null;
  const closeDetail = () => {
    if (detail.hidden) return false;
    if (detailClosing) return true;
    detailClosing = true;
    motion.closeDetail(() => {
      detail.hidden = true; backdrop.hidden = true; body.inert = false;
      header.inert = false;
      detailClosing = false;
      if (openedTile?.isConnected && !openedTile.hidden) openedTile.focus({ preventScroll: true });
    });
    return true;
  };
  const refresh = (reason = 'search') => {
    const anchor = motion.captureAnchor();
    const query = input.value.trim().toLocaleLowerCase();
    let visible = 0;
    for (const tile of tiles) {
      const matchesState = selected === 'all' || (tile.dataset.unlocked === 'true') === (selected === 'unlocked');
      tile.hidden = !matchesState || (category !== 'all' && tile.dataset.category !== category) || !tile.dataset.search.toLocaleLowerCase().includes(query);
      if (!tile.hidden) visible++;
    }
    filters.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryFilter === selected)));
    categories.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.galleryCategory === category)));
    root.querySelector('.ag-empty').hidden = visible > 0;
    root.querySelector('.ag-empty').dataset.emptyState = selected === 'unlocked' && !query ? 'earned' : 'filtered';
    root.querySelector('.ag-empty-copy').textContent = selected === 'unlocked' && !query
      ? '尚未获得奖章。' : '试试其他分类、名称或获得条件。';
    root.querySelector('.ag-result-count').textContent = `${visible} 枚奖章`;
    if (reason === 'category' || reason === 'reset') root.querySelector('.ag-scroll').scrollTop = 0;
    else motion.restoreAnchor(anchor);
    motion.revealList(reason);
  };
  input.addEventListener('input', () => refresh('search'));
  detail.addEventListener('keydown', event => {
    if (event.key !== 'Tab') return;
    const controls = [...detail.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]')];
    if (!controls.length) { event.preventDefault(); detail.focus(); return; }
    const index = controls.indexOf(document.activeElement);
    const next = event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length;
    event.preventDefault();
    event.stopPropagation();
    controls[next].focus({ preventScroll: true });
  });
  root.addEventListener('click', event => {
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
      const glint = root.querySelector('.ag-cabinet-glint');
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
      const grid = root.querySelector('.ag-grid');
      if (grid.dataset.view === button.dataset.galleryView) return;
      const anchor = motion.captureAnchor();
      grid.dataset.view = button.dataset.galleryView;
      root.querySelectorAll('[data-gallery-view]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      motion.restoreAnchor(anchor);
      motion.revealList('layout');
    }
    if (button.hasAttribute('data-gallery-reset')) { selected = 'all'; category = 'all'; input.value = ''; refresh('reset'); input.focus(); }
    if (button.hasAttribute('data-gallery-item')) {
      openedTile = button;
      root.querySelector('.ag-detail-content').innerHTML = button.querySelector('.ag-detail-source').innerHTML;
      detail.hidden = false; backdrop.hidden = false; body.inert = true; detail.focus();
      header.inert = true;
      detailClosing = false;
      motion.openDetail(button);
    }
  });
  motion.enterGallery();
  return { closeDetail };
}
