/* 照相馆（卡牌收藏页）：筛选/窗口挂载网格/选片台/放大查看（拆分自原四合一 game.cardslib.js）。
 * 制作坊与导入导出 → game.cardslib.designer.js（工厂注入）；
 * 共享件（Sfx/cardHTML/navigation/写入口开关）→ game.cardslib.common.js；
 * 开发模式性能探针 → game.cardslib.photo-fps.js；缩略图预解码 → game.cardslib.art-warm.js；
 * 照片陈列道具（缩略图档位/稳定落影/藏品编号）→ game.cardslib.photo-props.js。
 * ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

// DEV 诊断钩子（照相馆性能专项 09-29，与 ?photoFps 同款 DEV 门，生产构建零开销）：
// ?libPerfDiag=nofilter|noshadow|nooverlay|noimg|alllayer 注入对应覆盖样式，
// 供 perf-ledger-capture --base-url "...?libPerfDiag=X" 做同口径滚动栅格化分层 A/B。
if (import.meta.env.DEV) {
  const LIB_PERF_DIAG_CSS = {
    nofilter: '#libGrid .studio-photo-art img{filter:none!important;}',
    noshadow: '#libGrid .studio-photo-paper{box-shadow:none!important;}#libGrid .studio-photo-art{box-shadow:none!important;}',
    nooverlay: '#libGrid .studio-photo-art::before,#libGrid .studio-photo-art::after,#libGrid .studio-photo-paper::before,#libGrid .studio-photo-paper::after{display:none!important;}',
    noimg: '#libGrid .studio-photo-art img{display:none!important;}',
    alllayer: '#libGrid .lib-item{will-change:transform;}',
  };
  const diag = new URLSearchParams(location.search).get('libPerfDiag');
  const diagCss = diag && LIB_PERF_DIAG_CSS[diag];
  if (diagCss) {
    const style = document.createElement('style');
    style.dataset.libPerfDiag = diag;
    style.textContent = diagCss;
    document.head.appendChild(style);
  }
}

import { esc, escAttr } from '../core/shared.js';
import { descRich } from '../cards/cards.view.js';
import { createCardRenderContext } from '../cards/card-render-context.js';
import { game } from '../run/game.session.js';
import { characterName } from '../core/characters.js';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote, exportNotes } from '../cards/card-photo-notes.js';
import { photoMountFor } from './photo-studio-presentation.js';
import { CARD_DESIGNER_WRITES_ENABLED, Sfx, cardPageOpen, setCardPageOpen, configureCardPageClosers } from './game.cardslib.common.js';
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
let cardPagePrevState = null;  // 打开库/制作坊前的游戏状态（从标题界面打开时关回 'title'）
let lastSavedId = null;        // 刚保存的卡，库中高亮
let libCatalog = [];           // 此次照相馆数据刷新使用的浅数组快照
let libCards = [];             // 库页面缓存（悬停预览用）
let libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' };
let libSelectedId = null;     // 照相馆选片台当前陈列卡
let libEditMode = false;      // 开发者工具与日常浏览分离，避免每张卡常驻危险操作
let libRenderContext = null;

function refreshLibRenderContext(catalog) {
  libRenderContext = createCardRenderContext(catalog);
}

function libRarityOf(card) {
  return libRenderContext ? libRenderContext.rarityOf(card) : SDT.Cards.rarityOf(card);
}

// 切片装配：探针只读卡页开关；制作坊经工厂注入开关访问器与开/关页回调，壳↔切片零回环
configurePhotoFps({ isCardPageOpen: () => cardPageOpen });
const { openCardDesigner, closeDesigner, showCardsExportOverlay, showCardsImportOverlay } = createCardDesigner({
  getCardPageOpen: () => cardPageOpen,
  setCardPageOpen,
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
    (libFilter.rar === '全部' || libRarityOf(c) === libFilter.rar) &&
    (libFilter.cls === '全部' || (libFilter.cls === '通用' ? !c.cls : c.cls === libFilter.cls)) &&
    (!q || (_libSearchText.get(c) || '').includes(q))
  ).sort((a, b) => {
    const nameCmp = String(a.name).localeCompare(b.name, 'zh');
    if (libFilter.sort === 'name') return nameCmp;
    if (libFilter.sort === 'cost') return (a.cost - b.cost) || nameCmp;
    return (RARITIES.indexOf(libRarityOf(b)) - RARITIES.indexOf(libRarityOf(a))) ||
      String(a.type).localeCompare(b.type, 'zh') || nameCmp;
  });
  _libFilteredKey = key;
  return _libFilteredCache;
}

// 每页四列两行：翻看/键盘定位按此把目标索引换算成页首张滚入视野（分页机制本身已移除）。
const LIB_PAGE_SIZE = 8;
let libSearchTimer = null;
// 窗口化瓦片（09-29 二期·真实滚动口径归因）：占位壳常驻全量（滚动高度一次到位、
// 滚动条不跳），视口附近的壳由 IntersectionObserver 注入卡面、离窗卸载回收——
// DOM 与合成层数量有界（视口±2 屏，约几十张），不再随滚动/馆藏线性增长。
// 09-24 的「只挂不卸」版本在真实环境（Electron/核显/系统缩放）271 张全层化会打爆
// 层预算，合成器退化回逐帧重栅格化——账本无头满帧率但老板实机仍卡的根因。
const LIB_MOUNT_BATCH = 15;   // 首屏内联直挂数（视口内其余壳由 IO 首拍立即接管）
const libWindowed = typeof IntersectionObserver === 'function';
let libTileObserver = null;

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
  const rarity = libRarityOf(c);
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

// 卡面按钮（瓦片内层）：整瓦片 photoTileHTML 与壳注入 mountLibTile 共用
function photoTileInnerHTML(c) {
  const rarity = libRarityOf(c);
  const rarityIndex = Math.max(0, RARITIES.indexOf(rarity));
  const mount = photoMountFor(rarity);
  const art = (SDT.Art && SDT.Art.cardIcon && SDT.Art.cardIcon(c, { ...LIB_ART, defer: true })) ||
    SDT.Icons.img(SDT.Cards.TYPE_ART[c.type] || 'question');
  return `<button type="button" class="lib-cardwrap studio-photo rv${rarityIndex}" data-act="libInspect" data-photo-zoom-source data-card="${escAttr(c.id)}" aria-label="查看照片：${escAttr(c.name || '未命名卡牌')}" aria-current="${c.id === libSelectedId ? 'true' : 'false'}" title="查看大图与照片背签">
      <span class="studio-photo-paper" data-photo-mount="${mount.kind}">
        <span class="studio-mount-mark" aria-hidden="true"></span>
        <span class="studio-photo-art">${art}</span>
        <span class="studio-photo-caption"><b data-studio-rarity="${escAttr(rarity)}">${esc(c.name || '未命名卡牌')}</b>${c.type ? `<small class="type-badge">${esc(c.type === '能力卡' ? '能力' : c.type)}</small>` : ''}</span>
      </span>
    </button>`;
}

function photoTileHTML(c, index, motionIndex = index) {
  return `<div class="lib-item${c.id === lastSavedId ? ' saved' : ''}${c.id === libSelectedId ? ' selected' : ''}" data-i="${index}" style="${photoStyle(c, motionIndex)}">${photoTileInnerHTML(c)}</div>`;
}

// 占位壳：撑起与瓦片一致的格子（高度走 --lib-tile-h 实测值），内容由 IO 就近注入/卸出
function libShellHTML(c, index) {
  const state = `${c.id === lastSavedId ? ' saved' : ''}${c.id === libSelectedId ? ' selected' : ''}`;
  return `<div class="lib-item lib-ph${state}" data-i="${index}" data-card-id="${escAttr(c.id)}" style="${photoStyle(c, index)}"></div>`;
}

function libGridContentsHTML(all = libFiltered()) {
  if (!all.length) {
    const filtered = libCards.length > 0 &&
      (libFilter.tab !== '全部' || libFilter.rar !== '全部' || libFilter.cls !== '全部' || libFilter.q.trim() !== '');
    return `<div class="clib-empty"><div class="clib-empty-icon">[[icon:archive]]</div>
      <p>${libCards.length ? '没有符合条件的照片' : (game.devMode ? '收藏还是空的，进入编辑模式后可制作新卡' : '当前没有可展示的照片')}</p>
      ${filtered ? '<button class="hs-btn sm" data-act="libClearFilter">重置筛选</button>' : ''}</div>`;
  }
  // 09-29 二期：壳常驻 + IO 双向窗口化；无 IntersectionObserver 的降级环境（jsdom 测试）一次性全量
  if (!libWindowed) return all.map((card, offset) => photoTileHTML(card, offset, offset)).join('');
  const first = Math.min(LIB_MOUNT_BATCH, all.length);
  let html = '';
  for (let i = 0; i < all.length; i++) html += i < first ? photoTileHTML(all[i], i, i) : libShellHTML(all[i], i);
  return html;
}

function libGridHTML() {
  const all = libFiltered();
  // 09-24 改回上下滚动：分页条已随分页机制一并移除（2026-09-25 休眠代码清理）
  return `<div class="lib-grid${all.length ? '' : ' is-empty'}" id="libGrid">${libGridContentsHTML(all)}</div>`;
}

let libCardById = new Map();
let libCardNodeById = new Map();

// ======== 窗口化瓦片：壳常驻，IO 就近注入 / 离窗卸载（09-29 二期） ========
function stopLibTileObserver() {
  libTileObserver?.disconnect();
  libTileObserver = null;
}

function observeLibTiles(grid) {
  stopLibTileObserver();
  if (!grid || !libWindowed) return;
  libTileObserver = new IntersectionObserver(entries => {
    let mountedAny = false;
    for (const entry of entries) {
      if (entry.isIntersecting) mountedAny = mountLibTile(entry.target) || mountedAny;
      else unmountLibTile(entry.target);
    }
    if (mountedAny) warmLibArt();
  }, { root: grid, rootMargin: '100% 0px' });
  grid.querySelectorAll('.lib-item.lib-ph').forEach(shell => libTileObserver.observe(shell));
}

// 壳就近注入卡面；返回是否真的挂了
function mountLibTile(shell) {
  if (!shell || !shell.classList.contains('lib-ph')) return false;
  const card = libCardById.get(shell.dataset.cardId);
  if (!card) return false;
  shell.insertAdjacentHTML('beforeend', photoTileInnerHTML(card));
  shell.classList.remove('lib-ph');
  shell.classList.toggle('selected', card.id === libSelectedId);
  const wrap = shell.firstElementChild;
  if (wrap?.dataset?.card) libCardNodeById.set(wrap.dataset.card, wrap);
  return true;
}

// 离窗卸载回壳；焦点/选中/悬停/彩蛋进行中不卸
function unmountLibTile(shell) {
  if (!shell || shell.classList.contains('lib-ph')) return;
  const wrap = shell.firstElementChild;
  if (!wrap) return;
  if (shell.contains(document.activeElement) || wrap.getAttribute('aria-current') === 'true' ||
    shell.classList.contains('selected') || shell.matches(':hover')) return;
  const grid = shell.closest('.lib-grid');
  if (grid && (grid.classList.contains('lib-wave') || grid.classList.contains('lib-holo'))) return;
  shell.textContent = '';
  shell.classList.add('lib-ph');
  if (wrap.dataset.card && libCardNodeById.get(wrap.dataset.card) === wrap) libCardNodeById.delete(wrap.dataset.card);
}

// 聚焦/定位到未挂载区时同步挂单卡（键盘翻格、选片台翻看用），返回卡面节点
function ensureLibTileMounted(id) {
  const grid = document.getElementById('libGrid');
  const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
  const shell = grid?.querySelector(`.lib-item.lib-ph[data-card-id="${sel}"]`);
  if (shell) mountLibTile(shell);
  return libCardNodeById.get(id) || null;
}

// 整格区重建（renderCardLibrary / renderLibGrid 的 innerHTML）后旧节点全部作废，
// Map 推倒重建：倒序认领网格里已挂载的卡面（占位壳无卡面自动跳过；降级环境全量挂载即全认领）。
function claimMountedTiles(grid, count) {
  let el = grid.lastElementChild;
  for (let claimed = 0; el && claimed < count;) {
    if (el.classList.contains('lib-item')) {
      const wrap = el.firstElementChild;
      if (wrap?.dataset?.card) libCardNodeById.set(wrap.dataset.card, wrap);
      claimed++;
    }
    el = el.previousElementSibling;
  }
}

// 整格区重建（renderCardLibrary / renderLibGrid 的 innerHTML）后旧节点全部作废，
// Map 必须推倒重建；此时已挂载节点同样集中在尾部（降级环境为全部），认领逻辑复用。
function rebuildLibNodeMap(grid) {
  libCardNodeById = new Map();
  if (grid) claimMountedTiles(grid, Infinity);
}

// 09-29 滚动卡顿修复第二刀：把实测瓦片高喂给 .lib-item 的 contain-intrinsic-size 占位
// （expedition-library.css 改为 var(--lib-tile-h, 270px)）。占位与真实高度的差曾是
// content-visibility:auto 下「每行首次进相关区长个 ~50px、整轮滚动连续重排」的根因。
// 09-29 实测瓦片高度随列宽浮动但同一视宽下全距仅 ~4px（271 张 320~323px），量一张即够。
function syncLibTileIntrinsicSize(grid) {
  if (!grid) return;
  const tile = grid.querySelector('.lib-item .lib-cardwrap')?.parentElement;
  const h = tile?.offsetHeight || 0;
  if (h > 0) grid.style.setProperty('--lib-tile-h', `${h}px`);
}

// 跨页定位（键盘方向键 / 选片台翻看）：壳常驻后无需预挂，直接把目标壳滚入视野，
// IO 会就近挂载；无 IO 降级环境退化为按已挂节点定位。
function switchLibPage(page, all = libFiltered()) {
  const targetIndex = Math.max(0, page) * LIB_PAGE_SIZE;
  const target = all[targetIndex];
  if (!target) return;
  const grid = document.getElementById('libGrid');
  const sel = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(target.id) : target.id;
  const shell = grid?.querySelector(`.lib-item[data-card-id="${sel}"]`);
  if (shell) shell.scrollIntoView({ block: 'nearest' });
  else libCardNodeById.get(target.id)?.scrollIntoView({ block: 'nearest' });
}

let _prevSelectedWrap = null;  // 上一个选中卡面节点：换选 O(1) 清态，免全网格 querySelector（09-29 三期二刀）
function setLibSelection(id, playSound = false, refreshPreview = false) {
  const card = libCardById.get(id) || null;
  const selectionChanged = libSelectedId !== (card ? card.id : null);
  libSelectedId = card ? card.id : null;
  // 缓存节点可能已被整页/整格 innerHTML 重建作废，isConnected 兜底；
  // 重建后的新选中态由壳/瓦片模板自带，此处只负责「清上一个、亮下一个」
  const previousCard = _prevSelectedWrap?.isConnected ? _prevSelectedWrap : null;
  previousCard?.setAttribute('aria-current', 'false');
  previousCard?.closest('.lib-item')?.classList.remove('selected');
  const selected = card ? libCardNodeById.get(card.id) : null;
  if (selected) {
    selected.setAttribute('aria-current', 'true');
    selected.closest('.lib-item')?.classList.add('selected');
  }
  _prevSelectedWrap = selected || null;
  // 未挂载区（占位壳）的选中卡不在选中时同步补挂（09-25 实测：选中深位卡再清筛选，
  // 同步补挂可达数百 ms 且随收藏量增长）。翻看/键盘定位走 switchLibPage 滚壳就近挂载；
  // 壳注入卡面时按 libSelectedId 自动带上选中态，选中态在窗口化下依然无损。
  const preview = document.getElementById('libPreview');
  if (preview && (selectionChanged || refreshPreview)) {
    preview.innerHTML = libPreviewHTML(card);
    preview.classList.toggle('has-preview', !!card);
  }
  if (playSound && card) Sfx.tick();
}

function bindLibGridNavigation() {
  const grid = document.getElementById('libGrid');
  if (!grid) return;
  // Map 维护已拆给 claimMountedTiles / rebuildLibNodeMap（09-29）：这里只负责
  // 网格级事件委托（focusin / 方向键），dataset.bound 保证整页生命周期只绑一次。
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
      const targetWrap = ensureLibTileMounted(all[targetIndex].id);
      requestAnimationFrame(() => targetWrap?.focus());
    }
  });
}

// 筛选后只重绘卡格区（整页 showOverlay 会重置搜索焦点、重挂全部事件）
function renderLibGrid() {
  stopLibTileObserver();
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
    // （函数首行已 stopLibTileObserver，此处无重建语句，重复调用必为空操作——2026-10-02 审计 A 档删）
    grid.innerHTML = libGridContentsHTML(filtered);
    // 上下滚动模式（09-24）：筛选重绘后回顶，否则沿用旧滚动位置会从半截行开始看
    grid.scrollTop = 0;
    rebuildLibNodeMap(grid);
    bindLibGridNavigation();
    observeLibTiles(grid);
  }
  const active = document.getElementById('libActiveFilters');
  if (active) active.innerHTML = libActiveFiltersHTML();
  // 筛选/排序可能改变当前卡在馆藏中的位置，即使选中 ID 不变也需刷新选片台导航状态。
  setLibSelection(nextSelectedId, false, true);
  warmLibArt();
  syncLibTileIntrinsicSize(grid);
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
  setCardPageOpen(true);
  // 牌库页去动画开关（2026-09-08 老板拍板）：期间禁全部动画/过渡/流光/hover 特效，
  // CSS 侧规则见 cards.css 的 body.cardlib-open 段
  document.body.classList.add('cardlib-open');
  // 员工通行证A是碎片合成材料（特殊收藏品），不进卡牌库（2026-09-16 留言「在卡牌库中删除员工通行证a」）
  // Catalog membership/order and rarity lookups share one shallow snapshot for
  // this page refresh. Designer saves/imports reopen through this function.
  libCatalog = SDT.Cards.all().slice();
  refreshLibRenderContext(libCatalog);
  libCards = libCatalog.filter(c => c.id !== 'tt-token-color');
  _libSearchText = new WeakMap(libCards.map(c => [c, `${c.name || ''}\n${c.desc || ''}`.toLowerCase()]));
  libCardById = new Map(libCards.map(card => [card.id, card]));
  // 库内容刷新即失效筛选缓存：防止卡牌增删/改卡后命中旧缓存
  // （旧缓存键只含 libCards.length，同张数的内容变化会读到陈旧列表）
  _libFilteredCache = null;
  _libFilteredKey = '';
  // 上一页的窗口化观察器在 showOverlay 换网格前先停掉（新网格由 observeLibTiles 重挂）
  stopLibTileObserver();
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
  rebuildLibNodeMap(libGrid);
  observeLibTiles(libGrid);
  bindLibGridNavigation();
  warmLibArt();
  syncLibTileIntrinsicSize(libGrid);
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
  setCardPageOpen(false);
  clearPhotoFpsSettledTimer();
  stopPhotoFpsProbe();
  clearTimeout(libSearchTimer);
  libSearchTimer = null;
  stopLibTileObserver();
  resetLibArtWarmup();
  libRenderContext = null;
  libCatalog = [];
  libCardNodeById.clear();
  _prevSelectedWrap = null;
  UI.hideOverlay();
  // 摘 cardlib-open 必须等淡出（210ms）结束：提前摘会让 #overlay * 的禁动画规则
  // 集体解除、未关闭的几百张卡同时重播入场动画（09-23 留言「退出照相馆莫名闪烁」根因）；
  // 期间若重新打开照相馆（cardPageOpen 翻真）则跳过，避免摘掉新会话的类
  // 测试环境拆除后定时器仍触发（240ms 淡出摘类定时器无清理通道）：document 已删时安全短路；浏览器内不可达，行为逐字不变。
  setTimeout(() => { if (typeof document === "undefined") return; if (!cardPageOpen) document.body.classList.remove('cardlib-open'); }, 240);
  game.state = cardPagePrevState || 'idle';   // 从标题界面打开则回到标题，其余维持原 'idle' 行为
  cardPagePrevState = null;
  UI.refresh(game);
  samplePhotoFps('title', 3500, false);
}

configureCardPageClosers({ closeLibrary: closeLibPage, closeDesigner });

// ---------- 导出面（与拆分前逐名一致，调用方零改动） ----------

export { openCardDesigner, openCardLibrary };
