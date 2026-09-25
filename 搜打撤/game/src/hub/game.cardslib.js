/* 照相馆（卡牌收藏页）：筛选/窗口挂载网格/选片台/放大查看（拆分自原四合一 game.cardslib.js）。
 * 制作坊与导入导出 → game.cardslib.designer.js（工厂注入）；
 * 共享件（Sfx/cardHTML/navigation/写入口开关）→ game.cardslib.common.js；
 * 开发模式性能探针 → game.cardslib.photo-fps.js；缩略图预解码 → game.cardslib.art-warm.js；
 * 照片陈列道具（缩略图档位/稳定落影/藏品编号）→ game.cardslib.photo-props.js。
 * ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc, escAttr } from '../core/shared.js';
import { descRich } from '../cards/cards.view.js';
import { game } from '../run/game.session.js';
import { characterName } from '../core/characters.js';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote, exportNotes } from '../cards/card-photo-notes.js';
import { photoMountFor } from './photo-studio-presentation.js';
import { CARD_DESIGNER_WRITES_ENABLED, Sfx, cardHTML, navigation, configureCardNavigation } from './game.cardslib.common.js';
import {
  photoFpsEnabled, configurePhotoFps, stopPhotoFpsProbe, samplePhotoFps,
  clearPhotoFpsSettledTimer, scheduleSettledPhotoFps,
} from './game.cardslib.photo-fps.js';
import { warmLibArt, resetLibArtWarmup } from './game.cardslib.art-warm.js';
import { LIB_ART, photoStyle, photoNo } from './game.cardslib.photo-props.js';
import { createCardDesigner } from './game.cardslib.designer.js';

const RARITIES = SDT.Cards.RARITIES;
const TYPES = SDT.Cards.TYPES;
const DMG_TYPES = SDT.Cards.DMG_TYPES;
let cardPageOpen = false;      // 卡牌大页面打开中（Esc / 点击背景可关闭）
let cardPagePrevState = null;  // 打开库/制作坊前的游戏状态（从标题界面打开时关回 'title'）
let lastSavedId = null;        // 刚保存的卡，库中高亮
let libCards = [];             // 库页面缓存（悬停预览用）
let libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' };
let libSelectedId = null;     // 照相馆选片台当前陈列卡
let libEditMode = false;      // 开发者工具与日常浏览分离，避免每张卡常驻危险操作

// 切片装配：探针只读卡页开关；制作坊经工厂注入开关访问器与开/关页回调，壳↔切片零回环
configurePhotoFps({ isCardPageOpen: () => cardPageOpen });
const { openCardDesigner, closeDesigner, showCardsExportOverlay, showCardsImportOverlay } = createCardDesigner({
  getCardPageOpen: () => cardPageOpen,
  setCardPageOpen: (v) => { cardPageOpen = v; },
  setCardPagePrevState: (v) => { cardPagePrevState = v; },
  setLastSavedId: (v) => { lastSavedId = v; },
  openCardLibrary,
  renderCardLibrary,
  closeLibPage,
});

// ======== 卡牌收藏页（照相馆） ========
// 09-24 口头改回上下滚动浏览：全量渲染照片网格，纵向滚动查看，不再固定分页。
function openCardLibrary() {
  if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
  if (game.state !== 'modal') cardPagePrevState = game.state;   // 记录来源（idle/title），关闭时还原
  game.state = 'modal';
  renderCardLibrary();
}

// 过滤+排序结果缓存（用空间换时间）：筛选条件与卡库规模不变时直接复用，
// 翻页/重绘不再重复全量 sort。renderCardLibrary 重新取 libCards 时失效。
let _libFilteredCache = null, _libFilteredKey = '';
let _libSearchText = new WeakMap();
function libFiltered() {
  const key = `${libFilter.tab}|${libFilter.rar}|${libFilter.cls}|${libFilter.q}|${libFilter.sort}|${libCards.length}`;
  if (_libFilteredCache && key === _libFilteredKey) return _libFilteredCache;
  const q = libFilter.q.trim().toLowerCase();
  _libFilteredCache = libCards.filter(c =>
    (libFilter.tab === '全部' || c.type === libFilter.tab) &&
    // 稀有度按有效稀有度筛选（2026-09-04 定版：棱彩已实装进卡牌库——能力卡与其衍生牌 rarityOf 推导为「棱彩」，可经下拉筛选）
    (libFilter.rar === '全部' || SDT.Cards.rarityOf(c) === libFilter.rar) &&
    (libFilter.cls === '全部' || (libFilter.cls === '通用' ? !c.cls : c.cls === libFilter.cls)) &&
    (!q || (_libSearchText.get(c) || '').includes(q))
  ).sort((a, b) => {
    const nameCmp = String(a.name).localeCompare(b.name, 'zh');
    if (libFilter.sort === 'name') return nameCmp;
    if (libFilter.sort === 'cost') return (a.cost - b.cost) || nameCmp;
    return (RARITIES.indexOf(SDT.Cards.rarityOf(b)) - RARITIES.indexOf(SDT.Cards.rarityOf(a))) ||
      String(a.type).localeCompare(b.type, 'zh') || nameCmp;
  });
  _libFilteredKey = key;
  return _libFilteredCache;
}

// 每页四列两行：翻看/键盘定位按此把目标索引换算成页首张滚入视野（分页机制本身已移除）。
const LIB_PAGE_SIZE = 8;
let libSearchTimer = null;
// 窗口挂载（09-24 实测：全量渲染 271 张致打开主线程冻结 ~1.4s）：首屏只挂一批，
// 尾部哨兵接近视口再追加下一批，上下滚动浏览体验不变。
const LIB_MOUNT_BATCH = 24;
let libMountedCount = 0;
let libSentinelObserver = null;

function libPreviewHTML(c) {
  if (!c) return '<div class="studio-preview-empty"><div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">没有符合条件的卡牌<br>调整筛选后重新陈列</p></div>';
  const damage = +(c.dmg || 0);
  const showDamage = DMG_TYPES.includes(c.type) && (damage > 0 || (damage < 0 && c.dmgType === 'attack'));
  const dmgTxt = showDamage ? `${c.dmgType === 'attack' ? '攻击' : '伤害'}词条：<b class="dmg-num">${damage}</b>${c.dmgType ? ' · ' + (SDT.Cards.DMG_TYPE_META[c.dmgType] || {}).name : ''}` : '';
  const drawN = +(c.draw || 0) || SDT.Cards.deriveDraw(c);
  const infN = +(c.infuse || 0) || SDT.Cards.deriveInfuse(c);
  const healN = +(c.heal || 0) || SDT.Cards.deriveHeal(c);
  const armorN = +(c.armor || 0) || SDT.Cards.deriveArmor(c);
  const kw = [drawN ? `抽卡 ${drawN}` : '', infN ? `注能(${infN})` : '',
    healN ? `回复 ${healN}` : '', armorN ? `护甲 ${armorN}` : ''].filter(Boolean).join(' · ');
  const kwTxt = kw ? `效果词条：<b>${kw}</b>` : '';
  const actions = CARD_DESIGNER_WRITES_ENABLED && game.devMode && libEditMode ? `<div class="studio-edit-actions">
    <button class="hs-btn" data-act="editCard" data-id="${escAttr(c.id)}">编辑卡牌</button>
    <button class="hs-btn danger" data-act="delCard" data-id="${escAttr(c.id)}">删除</button>
  </div>` : '';
  // 选片台上陈列的是一张"放大照片"（相纸语言），不是战斗卡框——费用/类型/稀有度走文字行（09-23 拍板）
  const note = photoNoteFor(c);
  const cost = c.cost == null ? 0 : c.cost;
  const art = (SDT.Art && SDT.Art.cardIcon && SDT.Art.cardIcon(c, LIB_ART)) ||
    SDT.Icons.img(SDT.Cards.TYPE_ART[c.type] || 'question');
  const list = libFiltered();
  const idx = list.findIndex(x => x.id === c.id);
  const pos = idx >= 0 ? `${idx + 1} / ${list.length}` : '';
  const rarity = SDT.Cards.rarityOf(c);
  const rarityIndex = Math.max(0, RARITIES.indexOf(rarity));
  const mount = photoMountFor(rarity);
  return `<div class="studio-preview-frame"><span class="studio-photo-paper studio-preview-paper rv${rarityIndex}" data-photo-mount="${mount.kind}">
    <span class="studio-mount-mark" aria-hidden="true"></span>
    <span class="studio-photo-art">${art}</span>
    <span class="studio-photo-caption"><b data-studio-rarity="${escAttr(rarity)}">${esc(c.name || '未命名卡牌')}</b></span>
  </span></div>
    <div class="studio-preview-copy">
    <p class="pv-meta"><span class="pv-label">费用</span><b class="pv-cost">${cost}</b><span class="pv-chip">${esc(c.type === '能力卡' ? '能力' : c.type)}</span><span class="pv-chip" data-studio-rarity="${escAttr(rarity)}">${esc(rarity)}</span></p>
    ${(dmgTxt || kwTxt) ? `<p class="pv-terms">${[dmgTxt, kwTxt].filter(Boolean).join('<i></i>')}</p>` : ''}
    ${c.desc ? `<p class="pv-desc">${descRich(c.desc)}</p>` : ''}
    <p class="pv-no">藏品编号 № ${photoNo(c.id)}</p>
    ${note ? `<div class="pv-note"><b>备注</b>${esc(note)}</div>` : ''}
    <div class="pv-nav"><button type="button" class="pv-navbtn" data-act="libPrev"${idx <= 0 ? ' disabled' : ''}>‹ 上一片</button><span class="pv-pos">${pos}</span><button type="button" class="pv-navbtn" data-act="libNext"${idx < 0 || idx >= list.length - 1 ? ' disabled' : ''}>下一片 ›</button></div>
    <button class="studio-zoom" data-act="libInspect" data-photo-zoom-source data-card="${escAttr(c.id)}">查看大图与背签</button>${actions}</div>`;
}

function libActiveFiltersHTML() {
  const filters = [
    libFilter.tab !== '全部' ? ['tab', libFilter.tab === '能力卡' ? '能力' : libFilter.tab] : null,
    libFilter.rar !== '全部' ? ['rar', libFilter.rar] : null,
    libFilter.cls !== '全部' ? ['cls', libFilter.cls === '通用' ? '通用' : characterName(libFilter.cls)] : null,
    libFilter.q.trim() ? ['q', `“${libFilter.q.trim()}”`] : null,
  ].filter(Boolean);
  // 单条件不占独立行（09-23：页签高亮/搜索框已自表达），≥2 条件叠加才出 chip 行
  if (filters.length < 2) return '';
  return `<span>已选条件</span>${filters.map(([key, label]) => `<button type="button" data-act="libRemoveFilter" data-filter="${key}" aria-label="移除筛选：${escAttr(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('')}`;
}

function photoTileHTML(c, index, motionIndex = index) {
  const rarity = SDT.Cards.rarityOf(c);
  const rarityIndex = Math.max(0, RARITIES.indexOf(rarity));
  const mount = photoMountFor(rarity);
  const art = (SDT.Art && SDT.Art.cardIcon && SDT.Art.cardIcon(c, { ...LIB_ART, defer: true })) ||
    SDT.Icons.img(SDT.Cards.TYPE_ART[c.type] || 'question');
  return `<div class="lib-item${c.id === lastSavedId ? ' saved' : ''}${c.id === libSelectedId ? ' selected' : ''}" data-i="${index}" style="${photoStyle(c, motionIndex)}">
    <button type="button" class="lib-cardwrap studio-photo rv${rarityIndex}" data-act="libInspect" data-photo-zoom-source data-card="${escAttr(c.id)}" aria-label="查看照片：${escAttr(c.name || '未命名卡牌')}" aria-current="${c.id === libSelectedId ? 'true' : 'false'}" title="查看大图与照片背签">
      <span class="studio-photo-paper" data-photo-mount="${mount.kind}">
        <span class="studio-mount-mark" aria-hidden="true"></span>
        <span class="studio-photo-art">${art}</span>
        <span class="studio-photo-caption"><b data-studio-rarity="${escAttr(rarity)}">${esc(c.name || '未命名卡牌')}</b>${c.type ? `<small class="type-badge">${esc(c.type === '能力卡' ? '能力' : c.type)}</small>` : ''}</span>
      </span>
    </button>
  </div>`;
}

function libGridContentsHTML(all = libFiltered()) {
  if (!all.length) {
    const filtered = libCards.length > 0 &&
      (libFilter.tab !== '全部' || libFilter.rar !== '全部' || libFilter.cls !== '全部' || libFilter.q.trim() !== '');
    return `<div class="clib-empty"><div class="clib-empty-icon">[[icon:archive]]</div>
      <p>${libCards.length ? '没有符合条件的照片' : (game.devMode ? '收藏还是空的，进入编辑模式后可制作新卡' : '当前没有可展示的照片')}</p>
      ${filtered ? '<button class="hs-btn sm" data-act="libClearFilter">重置筛选</button>' : ''}</div>`;
  }
  // 09-24 改回上下滚动；同日晚补窗口挂载：只渲染已挂载前缀，尾部哨兵触发追加
  return all.slice(0, libMountedCount).map((card, offset) => photoTileHTML(card, offset, offset)).join('') +
    (libMountedCount < all.length ? '<div class="lib-mount-sentinel" aria-hidden="true"></div>' : '');
}

function libGridHTML() {
  const all = libFiltered();
  // 09-24 改回上下滚动：分页条已随分页机制一并移除（2026-09-25 休眠代码清理）
  return `<div class="lib-grid${all.length ? '' : ' is-empty'}" id="libGrid">${libGridContentsHTML(all)}</div>`;
}

let libCardById = new Map();
let libCardNodeById = new Map();

// ======== 窗口挂载：哨兵接近视口时追加下一批（09-24 打开冻结修复） ========
function stopLibSentinelObserver() {
  libSentinelObserver?.disconnect();
  libSentinelObserver = null;
}

function observeLibSentinel(grid) {
  stopLibSentinelObserver();
  const sentinel = grid.querySelector('.lib-mount-sentinel');
  if (!sentinel) return;
  if (typeof IntersectionObserver !== 'function') return; // 降级环境由 renderLibGrid 一次性全量挂载
  libSentinelObserver = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      libMountMore();
    }
  }, { root: grid, rootMargin: '100% 0px' });
  libSentinelObserver.observe(sentinel);
}

// 追加挂载下一批；返回是否还有剩余未挂
function libMountMore(all = libFiltered()) {
  const grid = document.getElementById('libGrid');
  if (!grid || libMountedCount >= all.length) return false;
  const prev = libMountedCount;
  libMountedCount = Math.min(all.length, libMountedCount + LIB_MOUNT_BATCH);
  const batch = all.slice(prev, libMountedCount)
    .map((card, i) => photoTileHTML(card, prev + i, prev + i)).join('');
  grid.querySelector('.lib-mount-sentinel')?.remove();
  grid.insertAdjacentHTML('beforeend', batch);
  if (libMountedCount < all.length) {
    grid.insertAdjacentHTML('beforeend', '<div class="lib-mount-sentinel" aria-hidden="true"></div>');
    observeLibSentinel(grid);
  }
  bindLibGridNavigation();
  warmLibArt();
  return libMountedCount < all.length;
}

// 键盘翻格 / 选片台翻看定位到未挂载区时，先补挂到目标索引
function ensureLibMountedIndex(all, index) {
  let guard = 0;
  while (libMountedCount <= index && libMountMore(all)) {
    if (++guard > 100) break;
  }
}

function switchLibPage(page, all = libFiltered()) {
  // 09-24 改回上下滚动：不切页，跨页定位（键盘方向键 / 选片台翻看）退化为把目标页首张滚入视野
  const targetIndex = Math.max(0, page) * LIB_PAGE_SIZE;
  const target = all[targetIndex];
  if (!target) return;
  if (!libCardNodeById.get(target.id)) ensureLibMountedIndex(all, targetIndex);
  libCardNodeById.get(target.id)?.scrollIntoView({ block: 'nearest' });
}

function setLibSelection(id, playSound = false) {
  const card = libCardById.get(id) || null;
  const selectionChanged = libSelectedId !== (card ? card.id : null);
  libSelectedId = card ? card.id : null;
  const previousItem = document.querySelector('#libGrid .lib-item.selected');
  const previousCard = document.querySelector('#libGrid .lib-cardwrap[aria-current="true"]');
  previousItem?.classList.remove('selected');
  previousCard?.setAttribute('aria-current', 'false');
  const selected = card ? libCardNodeById.get(card.id) : null;
  if (selected) {
    selected.setAttribute('aria-current', 'true');
    selected.closest('.lib-item')?.classList.add('selected');
  }
  // 未挂载区的选中卡不在选中时同步补挂（09-25 实测：筛选后选中深位卡再清筛选，
  // 这里一次补挂数批可达数百 ms 且随收藏量增长）。翻看/键盘定位走 switchLibPage
  // 预挂目标页；网格后续补挂时 photoTileHTML 按 libSelectedId 自动带上选中态。
  const preview = document.getElementById('libPreview');
  if (preview && selectionChanged) {
    preview.innerHTML = libPreviewHTML(card);
    preview.classList.toggle('has-preview', !!card);
  }
  if (playSound && card) Sfx.tick();
}

function bindLibGridNavigation() {
  const grid = document.getElementById('libGrid');
  if (!grid) return;
  libCardNodeById = new Map([...grid.querySelectorAll('.lib-cardwrap[data-card]')]
    .map(node => [node.dataset.card, node]));
  if (grid.dataset.bound === '1') return;
  grid.dataset.bound = '1';
  grid.addEventListener('focusin', (e) => {
    const card = e.target.closest && e.target.closest('.lib-cardwrap[data-card]');
    if (card) setLibSelection(card.dataset.card);
  });
  grid.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const current = e.target.closest && e.target.closest('.lib-cardwrap[data-card]');
    const item = current?.closest('.lib-item');
    const index = Number(item?.dataset.i);
    if (!current || !Number.isInteger(index)) return;
    const all = libFiltered();
    const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length || 4);
    const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -cols : cols;
    const targetIndex = index + delta;
    if (targetIndex >= 0 && targetIndex < all.length) {
      e.preventDefault();
      switchLibPage(Math.floor(targetIndex / LIB_PAGE_SIZE), all);
      requestAnimationFrame(() => libCardNodeById.get(all[targetIndex].id)?.focus());
    }
  });
}

// 筛选后只重绘卡格区（整页 showOverlay 会重置搜索焦点、重挂全部事件）
function renderLibGrid() {
  stopLibSentinelObserver();
  const filtered = libFiltered();
  const n = filtered.length;
  const nextSelectedId = filtered.some(c => c.id === libSelectedId)
    ? libSelectedId : (filtered[0]?.id || null);
  const resultCount = document.getElementById('libResultCount');
  if (resultCount) {
    // 全量时隐藏「陈列」组（09-23 计数语义：馆藏=总量，陈列只在筛选分家后有意义）
    const showWrap = resultCount.closest('.lib-show');
    if (showWrap) showWrap.hidden = (n === libCards.length);
    // 数量真的变了才播脉冲（重绘时数字没变就别闪）
    const changed = resultCount.textContent !== String(n);
    resultCount.textContent = n;
      if (changed) {
      resultCount.classList.remove('bump');
      void resultCount.offsetWidth;
      resultCount.classList.add('bump');
    }
  }
  const grid = document.getElementById('libGrid');
  if (grid) {
    grid.classList.toggle('is-empty', !filtered.length);
    resetLibArtWarmup();
    // 窗口挂载：重置为首批；无 IntersectionObserver 的环境（jsdom 测试）一次性全量
    libMountedCount = typeof IntersectionObserver === 'function'
      ? Math.min(LIB_MOUNT_BATCH, filtered.length)
      : filtered.length;
    grid.innerHTML = libGridContentsHTML(filtered);
    // 上下滚动模式（09-24）：筛选重绘后回顶，否则沿用旧滚动位置会从半截行开始看
    grid.scrollTop = 0;
    bindLibGridNavigation();
    if (libMountedCount < filtered.length) observeLibSentinel(grid);
  }
  const active = document.getElementById('libActiveFilters');
  if (active) active.innerHTML = libActiveFiltersHTML();
  setLibSelection(nextSelectedId);
  warmLibArt();
}

// 侧栏筛选控件同步到当前 libFilter（局部重绘时不重建侧栏，得手动回写控件状态）
function syncLibFilterUI() {
  const q = document.getElementById('cardSearch'); if (q) q.value = libFilter.q;
  const rar = document.getElementById('libRar'); if (rar) rar.value = libFilter.rar;
  const cls = document.getElementById('libCls'); if (cls) cls.value = libFilter.cls;
  const sort = document.getElementById('libSort'); if (sort) sort.value = libFilter.sort;
  document.querySelectorAll('.clib-tabs .type-tab').forEach(b => {
    const active = b.dataset.t === libFilter.tab;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', String(active));
  });
}

// ======== 卡牌库彩蛋（2026-09-13 留言：多加一些动画和彩蛋） ========
let libTitleClicks = 0, libTitleTimer = null;
// 彩蛋 1：连点「卡牌档案馆」标题三次 → 全库卡面波浪翻牌（只翻首屏 24 张，避免百张 3D 变换掉帧）
// 1800ms = 末位卡延迟 23*34ms + 单张 .8s，动画跑完再摘类
function libWaveEgg() {
  const grid = document.getElementById('libGrid');
  if (!grid || grid.classList.contains('lib-wave')) return;
  grid.classList.add('lib-wave');
  SDT.Sound.sfx('legend');
  UI.log('[[icon:cards]] 照相馆的灯闪了一下：「愿每一张定格，都是命运偏心的瞬间。」', 'ok');
  setTimeout(() => grid.classList.remove('lib-wave'), 1800);
}
// 彩蛋 2：稀有度筛到「棱彩」→ 全息卡面依次过一道幻彩扫光（2300ms 同上口径）
function libHoloEgg() {
  const grid = document.getElementById('libGrid');
  if (!grid || grid.classList.contains('lib-holo')) return;
  grid.classList.add('lib-holo');
  SDT.Sound.sfx('reveal');
  setTimeout(() => grid.classList.remove('lib-holo'), 2300);
}

function renderCardLibrary() {
  const photoOpenStarted = photoFpsEnabled ? performance.now() : 0;
  cardPageOpen = true;
  // 牌库页去动画开关（2026-09-08 老板拍板）：期间禁全部动画/过渡/流光/hover 特效，
  // CSS 侧规则见 cards.css 的 body.cardlib-open 段
  document.body.classList.add('cardlib-open');
  // 员工通行证A是碎片合成材料（特殊收藏品），不进卡牌库（2026-09-16 留言「在卡牌库中删除员工通行证a」）
  libCards = SDT.Cards.all().filter(c => c.id !== 'tt-token-color');
  _libSearchText = new WeakMap(libCards.map(c => [c, `${c.name || ''}\n${c.desc || ''}`.toLowerCase()]));
  libCardById = new Map(libCards.map(card => [card.id, card]));
  // 库内容刷新即失效筛选缓存：防止卡牌增删/改卡后命中旧缓存
  // （旧缓存键只含 libCards.length，同张数的内容变化会读到陈旧列表）
  _libFilteredCache = null;
  _libFilteredKey = '';
  // 窗口挂载计数要在 showOverlay 拼网格 HTML 前重置（libGridHTML 直接读它切片）
  stopLibSentinelObserver();
  libMountedCount = typeof IntersectionObserver === 'function'
    ? Math.min(LIB_MOUNT_BATCH, libFiltered().length)
    : libFiltered().length;
  const counts = {};
  libCards.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
  const tabs = ['全部'].concat(TYPES).map(t =>
    `<button type="button" class="type-tab${libFilter.tab === t ? ' on' : ''}" data-act="libTab" data-t="${t}" aria-pressed="${libFilter.tab === t}">
    ${t === '能力卡' ? '能力' : t}<em>${t === '全部' ? libCards.length : (counts[t] || 0)}</em>
    </button>`).join('');
  const editorTools = game.devMode ? `<button class="hs-btn studio-edit-toggle${libEditMode ? ' on' : ''}" data-act="libEditMode" aria-pressed="${libEditMode}">${libEditMode ? '收起工具' : '导出工具'}</button>${libEditMode ? `<button class="hs-btn" data-act="exportCards">[[icon:upload]] 导出</button>${CARD_DESIGNER_WRITES_ENABLED ? '<button class="hs-btn gold" data-act="newCard">＋ 制作新卡</button><button class="hs-btn" data-act="importCards">[[icon:download]] 导入</button>' : ''}` : ''}` : '';
  const first = libFiltered()[0] || null;
  if (!libSelectedId || !libFiltered().some(c => c.id === libSelectedId)) libSelectedId = first?.id || null;
  const selectedPreview = libCards.find(c => c.id === libSelectedId) || first;
  UI.showOverlay('', `
    <div class="pg card-library-page photo-studio-v3 studio-index-layout${libEditMode ? ' edit-mode' : ''}">
      <div class="ak-tl studio-exit-anchor">
        <button class="ak-sq ak-exit studio-exit" data-act="closeCardPage" title="退出照相馆（Esc）" aria-label="关闭照相馆">
          <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
            <rect x="12.5" y="4.5" width="8.5" height="15" rx="1.6" fill="none" stroke="currentColor" stroke-width="2.2"/>
            <path d="M3.5 12h9M3.5 12l4-4M3.5 12l4 4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
      <header class="pg-head library-head">
        <span class="clib-count"><small>馆藏</small><b>${libCards.length}</b><small>张</small></span>
        <div class="library-tools">${libEditMode ? '<button class="hs-btn" data-act="exportNotes" aria-label="导出全部照片备注">[[icon:download]] 导出备注</button>' : ''}${editorTools}</div>
      </header>
      <div class="clib-main">
        <section class="studio-catalog" aria-label="馆藏照片">
          <section class="studio-filterbar" aria-label="卡牌类型筛选">
            <div class="studio-index-heading"><span>馆藏索引</span><span class="lib-show"${libFiltered().length === libCards.length ? ' hidden' : ''}>找到 <b id="libResultCount">${libFiltered().length}</b> 张照片</span><button type="button" class="studio-clear" data-act="libClearFilter">重置筛选</button></div>
            <div class="clib-tabs">${tabs}</div>
            <div class="studio-search-row">
              <label class="studio-field studio-query"><span class="studio-field-label">查找照片</span><span class="studio-search"><input id="cardSearch" class="clib-search" aria-label="搜索卡牌" placeholder="输入卡名或效果" value="${escAttr(libFilter.q)}"></span></label>
              <label class="studio-field"><span class="studio-field-label">稀有度</span><span class="studio-select-shell"><select id="libRar" class="pg-select library-select" aria-label="按稀有度筛选"><option value="全部">不限稀有度</option>${RARITIES.map(r => `<option value="${r}"${libFilter.rar === r ? ' selected' : ''}>${r}</option>`).join('')}</select></span></label>
              <label class="studio-field"><span class="studio-field-label">所属人物</span><span class="studio-select-shell"><select id="libCls" class="pg-select library-select" aria-label="按人物筛选"><option value="全部">不限人物</option><option value="通用"${libFilter.cls === '通用' ? ' selected' : ''}>通用</option>${[...new Set(libCards.map(c => c.cls).filter(c => c && c !== '通用'))].sort().map(c => `<option value="${escAttr(c)}"${libFilter.cls === c ? ' selected' : ''}>${esc(characterName(c))}</option>`).join('')}</select></span></label>
              <label class="studio-field"><span class="studio-field-label">排列方式</span><span class="studio-select-shell"><select id="libSort" class="pg-select" aria-label="照片排序"><option value="rarity"${libFilter.sort === 'rarity' ? ' selected' : ''}>稀有度</option><option value="cost"${libFilter.sort === 'cost' ? ' selected' : ''}>费用</option><option value="name"${libFilter.sort === 'name' ? ' selected' : ''}>名称</option></select></span></label>
            </div>
            <div class="studio-active-filters" id="libActiveFilters">${libActiveFiltersHTML()}</div>
          </section>
          ${libGridHTML()}
        </section>
        <aside class="library-inspector" aria-label="选中卡牌详情"><div class="studio-inspector-head"><b>选片台</b></div><div class="library-preview${selectedPreview ? ' has-preview' : ''}" id="libPreview" aria-live="polite">${libPreviewHTML(selectedPreview)}</div></aside>
      </div>
    </div>`, 'page');
  lastSavedId = null;
  // 整页重建的网格同样走窗口挂载：还有剩余就挂上哨兵观察
  const libGrid = document.getElementById('libGrid');
  if (libGrid && libMountedCount < libFiltered().length) observeLibSentinel(libGrid);
  bindLibGridNavigation();
  warmLibArt();
  // 注意：lastPreviewId 在下方悬停处理段声明（函数内 let），此处不可提前赋值——
  // 昨晚"悬停去重"改动曾在此赋值触发 TDZ ReferenceError，导致后续全部 UI.act
  // 注册被跳过，卡牌库整页按钮（含右上关闭钮）无响应（老板留言：退出点不动）。
  UI.act('closeCardPage', closeLibPage);
  UI.act('newCard', () => { if (CARD_DESIGNER_WRITES_ENABLED) openCardDesigner(null); });
  // 切页签/清筛选只重绘卡格区：整页 renderCardLibrary() 会重建 245 张卡面的 HTML
  // （实测主线程阻塞 ~100ms）并重挂全部事件，而这两处改动只影响卡格与页签高亮
  UI.act('libTab', (d) => { libFilter.tab = d.t; syncLibFilterUI(); renderLibGrid(); });
  UI.act('libClearFilter', () => { libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' }; syncLibFilterUI(); renderLibGrid(); });
  UI.act('libRemoveFilter', (d) => {
    if (d.filter === 'tab') libFilter.tab = '全部';
    else if (d.filter === 'rar') libFilter.rar = '全部';
    else if (d.filter === 'cls') libFilter.cls = '全部';
    else if (d.filter === 'q') libFilter.q = '';
    syncLibFilterUI(); renderLibGrid();
  });
  UI.act('libEditMode', () => { libEditMode = !libEditMode; renderCardLibrary(); });
  // 选片台翻看（09-23：上一片/下一片，在当前筛选集内走，带音效）
  const navStep = (delta) => {
    const list = libFiltered();
    const i = list.findIndex(c => c.id === libSelectedId);
    if (i < 0 || !list.length) return;
    const j = Math.max(0, Math.min(list.length - 1, i + delta));
    if (j === i) return;
    switchLibPage(Math.floor(j / LIB_PAGE_SIZE), list);
    setLibSelection(list[j].id, true);
  };
  UI.act('libPrev', () => navStep(-1));
  UI.act('libNext', () => navStep(1));
  UI.act('editCard', (d) => {
    if (!CARD_DESIGNER_WRITES_ENABLED) return;
    const card = SDT.Cards.all().find(c => c.id === (d.card || d.id));
    if (card) openCardDesigner(card);
  });
  UI.act('libInspect', (d, trigger) => {
    const card = libCards.find(c => c.id === d.card);
    // 快门声+白闪是照相馆的「取照片」仪式（sfx('shutter')，静音/音效开关由 Sound 统一把关）
    SDT.Sound.sfx('shutter');
    if (card) {
      const active = trigger?.matches?.('[data-photo-zoom-source]')
        ? trigger
        : (document.activeElement?.matches?.(`[data-photo-zoom-source][data-card="${d.card}"]`) ? document.activeElement : null);
      const from = active?.classList.contains('studio-zoom') && libSelectedId === card.id
        ? document.querySelector('.photo-studio-v3 .studio-preview-paper')
        : (active?.querySelector('.studio-photo-paper') || document.querySelector(`#libGrid .lib-cardwrap[data-card="${d.card}"] .studio-photo-paper`));
      // 同步墙上选中态/选片台内容，不重建网格、不重置筛选或滚动位置。
      if (libSelectedId !== card.id) setLibSelection(card.id);
      const returnFocus = active?.classList.contains('studio-zoom') && !active.isConnected
        ? document.querySelector('.photo-studio-v3 .studio-zoom')
        : active;
      UI.showCardZoom(card, {
        from,
        returnFocus,
        presentation: 'photo',
        photoNumber: photoNo(card.id),
        note: photoNoteFor(card),
        noteLabel: '备注',
        noteEditable: true,
        notePlaceholder: PHOTO_NOTE_PLACEHOLDER,
        onNoteSave: value => {
          const saved = savePhotoNote(card, value);
          if (libSelectedId === card.id) {
            const preview = document.getElementById('libPreview');
            const oldNote = preview?.querySelector('.pv-note');
            const note = photoNoteFor(card);
            const noteHTML = note ? `<div class="pv-note"><b>备注</b>${esc(note)}</div>` : '';
            if (oldNote) oldNote.outerHTML = noteHTML;
            else if (noteHTML) preview?.querySelector('.pv-nav')?.insertAdjacentHTML('beforebegin', noteHTML);
          }
          return saved;
        },
      });
    }
  });
  UI.act('delCard', (d) => {
    if (!CARD_DESIGNER_WRITES_ENABLED) return;
    const btn = [...document.querySelectorAll('.card-library-page [data-act="delCard"][data-id]')].find(el => el.dataset.id === d.id);
    if (btn && !btn.dataset.confirm) {
      btn.dataset.confirm = '1'; btn.textContent = '确认删除？'; btn.classList.add('arm');
      setTimeout(() => {
        if (btn.isConnected) { delete btn.dataset.confirm; btn.textContent = '删除'; btn.classList.remove('arm'); }
      }, 2600);
      return;
    }
    const card = libCards.find(c => c.id === d.id);
    SDT.Cards.remove(d.id);
    Sfx.tick();
    UI.log(`[[icon:trash]] 已删除卡牌【<b>${esc(card ? card.name : '')}</b>】`, 'warn');
    renderCardLibrary();
  });
  UI.act('exportCards', () => showCardsExportOverlay());
  UI.act('importCards', () => { if (CARD_DESIGNER_WRITES_ENABLED) showCardsImportOverlay(); });
  // 备注同步闭环（2026-09-20 老板定版）：导出 底稿+手写 合并的完整 card-notes.json，
  // 老板整文件回填 data/ 提交即完成"改的东西进数据库"
  UI.act('exportNotes', () => {
    const blob = new Blob([exportNotes()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'card-notes.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    UI.log('[[icon:download]] 备注已导出为 card-notes.json，回填 data/ 即同步进数据库', 'ok');
  });
  // 彩蛋 1 的触发点：标题连点三次（1.6s 内）
  const titleEl = document.querySelector('.card-library-page .library-title');
  if (titleEl) titleEl.addEventListener('click', () => {
    libTitleClicks++;
    if (libTitleTimer) clearTimeout(libTitleTimer);
    libTitleTimer = setTimeout(() => { libTitleClicks = 0; }, 1600);
    if (libTitleClicks >= 3) {
      libTitleClicks = 0;
      clearTimeout(libTitleTimer);
      libWaveEgg();
    }
  });
  // 搜索 / 稀有度筛选：只重绘卡格，保持输入焦点
  UI._inputHandler = (e) => {
    let prism = false;   // 彩蛋 2 的触发条件：筛到「棱彩」
    if (e.target.id === 'cardSearch') {
      libFilter.q = e.target.value;
      clearTimeout(libSearchTimer);
      libSearchTimer = setTimeout(renderLibGrid, 120);
      return;
    }
    else if (e.target.id === 'libRar') { libFilter.rar = e.target.value; prism = e.target.value === '棱彩'; }
    else if (e.target.id === 'libCls') { libFilter.cls = e.target.value; }
    else if (e.target.id === 'libSort') { libFilter.sort = e.target.value; }
    else return;
    renderLibGrid();
    if (prism) libHoloEgg();
  };
  // 悬停大图预览（炉石式）。mouseover 会因子元素冒泡重复触发：
  // 记住上一张预览的卡，扫过同一张卡时不再整页重建预览 DOM / 重复播悬停音；
  // 2026-09-06 留言（库页滑动很卡）：预览大图的解码/重建在主线程，滚动扫过时
  // 再加 90ms 去抖——只有停留的卡才真正重建，滚动风暴中预览零重建。
  let lastPreviewId = null;
  let previewTimer = null;
  bindLibGridNavigation();
  UI._hoverHandler = (e) => {
    const w = e.target.closest ? e.target.closest('[data-card]') : null;
    const id = w ? w.dataset.card : null;
    if (id === lastPreviewId) return;
    lastPreviewId = id;
    if (previewTimer) clearTimeout(previewTimer);
    if (!id) return;   // 移出卡面：保留当前预览不动
    previewTimer = setTimeout(() => {
      previewTimer = null;
      const card = libCardById.get(id);
      if (card) setLibSelection(card.id, true);
    }, 90);
  };
  const page = document.querySelector('.card-library-page');
  if (page) page.addEventListener('keydown', (e) => {
    if (e.key !== '/' || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
    e.preventDefault(); document.getElementById('cardSearch')?.focus();
  });
  UI.refresh(game);
  if (photoFpsEnabled) console.info('[photo-fps]', JSON.stringify({
    label: 'render-sync',
    ms: +(performance.now() - photoOpenStarted).toFixed(1),
    photos: document.querySelectorAll('#libGrid .lib-item').length,
  }));
  clearPhotoFpsSettledTimer();
  samplePhotoFps('open', 1500);
  scheduleSettledPhotoFps();
}

function closeLibPage() {
  cardPageOpen = false;
  clearPhotoFpsSettledTimer();
  stopPhotoFpsProbe();
  clearTimeout(libSearchTimer);
  libSearchTimer = null;
  resetLibArtWarmup();
  libCardNodeById.clear();
  UI.hideOverlay();
  // 摘 cardlib-open 必须等淡出（210ms）结束：提前摘会让 #overlay * 的禁动画规则
  // 集体解除、未关闭的几百张卡同时重播入场动画（09-23 留言「退出照相馆莫名闪烁」根因）；
  // 期间若重新打开照相馆（cardPageOpen 翻真）则跳过，避免摘掉新会话的类
  setTimeout(() => { if (!cardPageOpen) document.body.classList.remove('cardlib-open'); }, 240);
  game.state = cardPagePrevState || 'idle';   // 从标题界面打开则回到标题，其余维持原 'idle' 行为
  cardPagePrevState = null;
  UI.refresh(game);
  samplePhotoFps('title', 3500, false);
}

// Esc / 点击页面外深色背景 → 关闭大页面（制作坊先回库 / 基地 / 出征整备回基地）
function closeCardPageTop() {
  if (document.getElementById('cdesStage')) closeDesigner();
  else if (document.getElementById('depMain')) { navigation.resetDeployPick(); navigation.renderHub(); }
  else if (document.getElementById('hubMain')) navigation.closeBase();
  else closeLibPage();
}

// ---------- 导出面（与拆分前逐名一致，调用方零改动） ----------

export { Sfx, cardHTML, cardPageOpen, closeCardPageTop, configureCardNavigation, openCardDesigner, openCardLibrary };
const _set_cardPageOpen = (v) => { cardPageOpen = v; };
export { _set_cardPageOpen };
