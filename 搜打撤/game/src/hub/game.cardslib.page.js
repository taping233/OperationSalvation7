/* 照相馆（卡牌收藏页）：筛选/窗口挂载网格/选片台/放大查看（拆分自原四合一 game.cardslib.js）。
 * 制作坊与导入导出 → game.cardslib.designer.js（工厂注入）；
 * 共享件（Sfx/cardHTML/navigation/写入口开关）→ game.cardslib.common.js；
 * 开发模式性能探针 → game.cardslib.photo-fps.js；缩略图预解码 → game.cardslib.art-warm.js；
 * 照片陈列道具（缩略图档位/稳定落影/藏品编号）→ game.cardslib.photo-props.js。
 * ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { linkedBackHTML } from '../ui/home-linked-interactions.js';

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
import { createCardDescriptionRenderer, highlightSearchText } from '../cards/card-description-links.js';
import { displayCardDescription } from '../cards/card-description-text.js';
import { termKeyFor } from '../ui/term-tips.js';
import { DRAW_EXPLANATION, hasDrawExplanation } from '../cards/card-draw-explanation.js';
import { createCardRenderContext } from '../cards/card-render-context.js';
import { game } from '../run/game.session.js';
import { characterName } from '../core/characters.js';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote, exportNotes } from '../cards/card-photo-notes.js';
import { photoMountFor } from './photo-studio-presentation.js';
import { CARD_DESIGNER_WRITES_ENABLED, Sfx, cardPageOpen, setCardPageOpen, configureCardPageClosers, cancelPendingCardPageEntry } from './game.cardslib.common.js';
import {
  photoFpsEnabled, configurePhotoFps, stopPhotoFpsProbe, samplePhotoFps,
  clearPhotoFpsSettledTimer, scheduleSettledPhotoFps,
} from './game.cardslib.photo-fps.js';
import { warmLibArt, resetLibArtWarmup } from './game.cardslib.art-warm.js';
import { LIB_ART, photoStyle, photoNo } from './game.cardslib.photo-props.js';
import { createCardDesigner } from './game.cardslib.designer.js';
import { bindPhotoStudioControls, refreshPhotoStudioControls, closePhotoStudioControls } from './photo-studio-controls.js';
import { bindPhotoStudioTabMarker, updatePhotoStudioTabMarker } from './photo-studio-tabs.js';
import { createPhotoStudioBrowseHistory, createPhotoStudioMotion } from './photo-studio-navigation.js';
import '../../css/photo-studio-mounts.css';
import '../../css/photo-studio-unified.css';
import '../../css/photo-studio-room-effects.css';
import '../../css/photo-studio-zoom-motion.css';

const STUDIO_SHUTTER_ICON = '<svg class="studio-shutter" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m7.5 4.2 5 8.6m8-3.4h-10m6 10.4-5-8.6m-8 3.4h10"/></svg>';

const RARITIES = SDT.Cards.RARITIES;
const compareChinese = new Intl.Collator('zh').compare;
const TYPES = SDT.Cards.TYPES;
const DMG_TYPES = SDT.Cards.DMG_TYPES;
let cardPagePrevState = null;  // 打开库/制作坊前的游戏状态（从标题界面打开时关回 'title'）
let lastSavedId = null;        // 刚保存的卡，库中高亮
let libPreviewTimer = null;
let libHoveredId = null;
let libDescriptionRenderer = createCardDescriptionRenderer();
let libCatalog = [];           // 此次照相馆数据刷新使用的浅数组快照
let libCards = [];             // 库页面缓存（悬停预览用）
let libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' };
let libSelectedId = null;     // 照相馆选片台当前陈列卡
let libEditMode = false;      // 开发者工具与日常浏览分离，避免每张卡常驻危险操作
let libRenderContext = null;
const libBrowseHistory = createPhotoStudioBrowseHistory();
const libMotion = createPhotoStudioMotion();
let libRenderedFilter = null;
let libSearchComposing = false;
let libHoverBlockedUntil = 0;

function matchesLibFilters(card, includeTab, q) {
  return (!includeTab || libFilter.tab === '全部' || card.type === libFilter.tab) &&
    (libFilter.rar === '全部' || libRarityOf(card) === libFilter.rar) &&
    (libFilter.cls === '全部' || (libFilter.cls === '通用' ? !card.cls : card.cls === libFilter.cls)) &&
    (!q || (_libSearchText.get(card) || '').includes(q));
}

let libCategoryCache = null, libCategoryCacheCards = null, libCategoryCacheKey = '';
function libCategoryCounts() {
  const q = libFilter.q.trim().toLowerCase();
  const key = JSON.stringify([libFilter.rar, libFilter.cls, q]);
  if (libCategoryCacheCards === libCards && libCategoryCacheKey === key && libCategoryCache) return libCategoryCache;
  const counts = { 全部: 0 };
  for (const card of libCards) {
    if (!matchesLibFilters(card, false, q)) continue;
    counts.全部++;
    counts[card.type] = (counts[card.type] || 0) + 1;
  }
  libCategoryCacheCards = libCards;
  libCategoryCacheKey = key;
  return (libCategoryCache = counts);
}

function rememberLibBrowse() {
  const grid = document.getElementById('libGrid');
  if (!grid || !libRenderedFilter) return;
  const rect = grid.getBoundingClientRect();
  const scale = rect.height / grid.offsetHeight || 1;
  const anchor = [...grid.children].find(node => node.classList.contains('lib-item') && node.getBoundingClientRect().bottom > rect.top + 1);
  libBrowseHistory.remember(libRenderedFilter, {
    selectedId: libSelectedId,
    anchorId: anchor?.dataset.cardId || anchor?.querySelector('[data-card]')?.dataset.card || null,
    offset: anchor ? (anchor.getBoundingClientRect().top - rect.top) / scale : 0,
    scrollTop: grid.scrollTop,
  });
}

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
let libFilteredPositionById = new Map();
let _libSearchText = new WeakMap();
function libFiltered() {
  const key = `${libFilter.tab}|${libFilter.rar}|${libFilter.cls}|${libFilter.q}|${libFilter.sort}|${libCards.length}`;
  if (_libFilteredCache && key === _libFilteredKey) return _libFilteredCache;
  const q = libFilter.q.trim().toLowerCase();
  _libFilteredCache = libCards.filter(c => matchesLibFilters(c, true, q)).sort((a, b) => {
    if (libFilter.sort === 'name') return compareChinese(String(a.name), String(b.name));
    if (libFilter.sort === 'cost') return (a.cost - b.cost) || compareChinese(String(a.name), String(b.name));
    return (RARITIES.indexOf(libRarityOf(b)) - RARITIES.indexOf(libRarityOf(a))) ||
      compareChinese(String(a.type), String(b.type)) || compareChinese(String(a.name), String(b.name));
  });
  _libFilteredKey = key;
  libFilteredPositionById = new Map();
  for (let index = 0; index < _libFilteredCache.length; index++) {
    const id = _libFilteredCache[index].id;
    if (!libFilteredPositionById.has(id)) libFilteredPositionById.set(id, index);
  }
  return _libFilteredCache;
}

// 连续照片墙以照片 ID 定位；分类与筛选上下文独立保存浏览锚点。
let libSearchTimer = null;
// 窗口化瓦片（09-29 二期·真实滚动口径归因）：占位壳常驻全量（滚动高度一次到位、
// 滚动条不跳），视口附近的壳由 IntersectionObserver 注入卡面、离窗卸载回收——
// DOM 与合成层数量有界（视口±2 屏，约几十张），不再随滚动/馆藏线性增长。
// 09-24 的「只挂不卸」版本在真实环境（Electron/核显/系统缩放）271 张全层化会打爆
// 层预算，合成器退化回逐帧重栅格化——账本无头满帧率但老板实机仍卡的根因。
const LIB_MOUNT_BATCH = 15;   // 首屏内联直挂数（视口内其余壳由 IO 首拍立即接管）
const libWindowed = typeof IntersectionObserver === 'function';
let libTileObserver = null;
let libTileObserverGrid = null;
// 首窗壳数与余壳 idle 队列（10-04 拆帧）：打开/筛选重绘的点击帧只同步解析首窗
// （15 卡面 + 首窗壳，覆盖视口+100% 挂载窗口：1080p 全屏 ≈ 13 行×4 列 = 52），
// 剩余壳空闲档分批 append——271 壳一次 innerHTML 实测阻塞打开 53ms/切页签 22ms。
const LIB_SHELL_FIRST = 64;
const LIB_SHELL_BATCH = 60;
let _libShellQueue = [];
let _libShellScheduled = false;
let _libShellGeneration = 0;

function libDossierDescription(c, showDamage, damage) {
  let description = displayCardDescription(c.desc, c.id);
  // Remove only a matching leading damage shorthand; preserve all conditions and effects.
  const leading = description.match(/^([+-]?\d+(?:\.\d+)?)[ \t]*[′'][ \t]*[，,；;]?[ \t]*/);
  if (showDamage && leading && Number(leading[1]) === damage) description = description.slice(leading[0].length);
  const fullDamage = description.match(/^造成\s*(\d+)\s*点(?:法术|固定|真实)伤害[。；，]?\s*/);
  if (showDamage && fullDamage && Number(fullDamage[1]) === damage) description = description.slice(fullDamage[0].length);
  return libDescriptionRenderer.render(description, c.id, libFilter.q).replace(/(<b class="d-num">[^<]+<\/b>)([ \t]*(?:%|％|′|点|次|张|层|秒))/g,
    '<span class="studio-value">$1$2</span>');
}

function studioCategoryBadgeHTML(type) {
  const marks = {
    '全部': '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><rect x="14" y="14" width="6" height="6"/>',
    '武术': '<path d="M5 4l15 15M4 5l15 15M5 19L19 5M4 17l3 3M17 4l3 3"/>',
    '法术': '<path d="M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
    '生物': '<ellipse cx="12" cy="16" rx="5" ry="4"/><ellipse cx="5" cy="10" rx="2" ry="3"/><ellipse cx="10" cy="6" rx="2" ry="3"/><ellipse cx="16" cy="6" rx="2" ry="3"/><ellipse cx="20" cy="11" rx="2" ry="3"/>',
    '道具': '<path d="M9 3h6M10 3v5L5 18q-1 3 3 3h8q4 0 3-3L14 8V3M8 14h8"/>',
    '装备': '<path d="M12 3l8 4v6c0 4-4 7-8 9-4-2-8-5-8-9V7ZM12 7v10"/>',
    '事件': '<rect x="4" y="5" width="16" height="15"/><path d="M8 3v5M16 3v5M4 10h16M8 14h3M14 14h2"/>',
    '能力卡': '<path d="M13 2L5 13h6l-1 9 9-12h-6Z"/>',
    '资源': '<path d="M7 4h10l5 7-10 11L2 11ZM2 11h20M7 4l5 18 5-18"/>',
  };
  return '<span class="studio-tab-badge" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' + (marks[type] || marks['全部']) + '</svg></span>';
}

function libReferenceOptions(card) {
  return {
    presentation: 'photo', photoMotion: 'atelier', photoNumber: photoNo(card.id),
    note: photoNoteFor(card), noteLabel: '备注', noteEditable: false,
    descriptionRenderer: libDescriptionRenderer, descriptionQuery: libFilter.q,
    createReferenceOptions: libReferenceOptions,
  };
}

function libPreviewHTML(c) {
  if (!c) return `<div class="studio-preview-empty"><div class="pv-empty">${STUDIO_SHUTTER_ICON}</div><p class="pv-hint">暂无选片<br>请调整筛选或搜索条件</p></div>`;
  const damage = +(c.dmg || 0);
  const showDamage = DMG_TYPES.includes(c.type) && (damage > 0 || (damage < 0 && c.dmgType === 'attack'));
  const drawN = +(c.draw || 0) || SDT.Cards.deriveDraw(c);
  const infN = +(c.infuse || 0) || SDT.Cards.deriveInfuse(c);
  const healN = +(c.heal || 0) || SDT.Cards.deriveHeal(c);
  const armorN = +(c.armor || 0) || SDT.Cards.deriveArmor(c);
  const metrics = [
    showDamage ? [`${(SDT.Cards.DMG_TYPE_META[c.dmgType] || {}).name || ''}伤害`, damage] : null,
    drawN ? ['抽卡', drawN] : null, infN ? ['注能', infN] : null,
    healN ? ['回复', healN] : null, armorN ? ['护甲', armorN] : null,
  ].filter(Boolean);
  const actions = CARD_DESIGNER_WRITES_ENABLED && game.devMode && libEditMode ? `<div class="studio-edit-actions">
    <button class="hs-btn" data-act="editCard" data-id="${escAttr(c.id)}">编辑卡牌</button>
    <button class="hs-btn danger" data-act="delCard" data-id="${escAttr(c.id)}">删除</button>
  </div>` : '';
  // The dossier carries text; the photograph stays in the wall and the zoom view.
  const note = photoNoteFor(c);
  const cost = c.cost == null ? 0 : c.cost;
  const list = libFiltered();
  const idx = libFilteredPositionById.get(c.id) ?? -1;
  const pos = idx >= 0 ? `${idx + 1} / ${list.length}` : '';
  const rarity = libRarityOf(c);
  const description = libDossierDescription(c, showDamage, damage);
  return `    <div class="studio-preview-copy"><div class="studio-dossier-scroll">
    <header class="studio-dossier-title"><h3 class="studio-dossier-name">${highlightSearchText(c.name || '未命名卡牌', libFilter.q)}</h3></header>
    <p class="pv-meta studio-dossier-meta"><span class="studio-file-field"><b class="pv-chip">${esc(c.type === '能力卡' ? '能力' : c.type)}</b></span><span class="studio-file-field"><b class="pv-chip studio-rarity-stamp" data-studio-rarity="${escAttr(rarity)}" aria-label="藏品类别：${escAttr(rarity)}">${esc(rarity)}</b></span><span class="studio-file-field"><small class="pv-label">费用</small><b class="pv-cost">${cost}</b></span></p>
    ${metrics.length ? `<dl class="pv-terms studio-effect-metrics${metrics.length === 1 ? ' is-single' : ''}" aria-label="效果词条">${metrics.map(([label, value, detail]) => `<div><dt${termKeyFor(label) ? ` data-term="${termKeyFor(label)}"` : ''}>${highlightSearchText(label, libFilter.q)}</dt><dd><b>${highlightSearchText(String(value), libFilter.q)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</dd></div>`).join('')}</dl>` : ''}
    ${description ? `<p class="pv-desc">${description}</p>` : ''}
    ${hasDrawExplanation(c, drawN) ? `<p class="studio-draw-explanation">${esc(DRAW_EXPLANATION)}</p>` : ''}
    ${note ? `<div class="pv-note"><b>备注</b>${esc(note)}</div>` : ''}
    </div><div class="studio-preview-actions"><div class="studio-browse-controls"${list.length <= 1 ? ' hidden' : ''}><div class="pv-nav"><button type="button" class="pv-navbtn" data-act="libPrev" aria-label="上一片" title="上一片"${idx <= 0 ? ' disabled' : ''}><span aria-hidden="true">‹</span></button><button type="button" class="studio-locate" data-act="libLocate" aria-label="定位当前照片" title="定位当前照片"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="12" cy="12" r="6"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg></button><span class="pv-pos" aria-label="当前筛选结果中的第${idx + 1}张，共${list.length}张">${pos}</span><button type="button" class="pv-navbtn" data-act="libNext" aria-label="下一片" title="下一片"${idx < 0 || idx >= list.length - 1 ? ' disabled' : ''}><span aria-hidden="true">›</span></button></div></div>
    <button class="studio-zoom" data-act="libInspect" aria-label="查看大图与背签" data-photo-zoom-source data-card="${escAttr(c.id)}"><span>查看照片</span><i aria-hidden="true">${STUDIO_SHUTTER_ICON}</i></button>${actions}</div></div>`;
}

function libActiveFiltersHTML() {
  const filters = [
    libFilter.tab !== '全部' ? ['tab', libFilter.tab === '能力卡' ? '能力' : libFilter.tab] : null,
    libFilter.rar !== '全部' ? ['rar', libFilter.rar] : null,
    libFilter.cls !== '全部' ? ['cls', libFilter.cls === '通用' ? '通用' : characterName(libFilter.cls)] : null,
    libFilter.q.trim() ? ['q', `“${libFilter.q.trim()}”`] : null,
  ].filter(Boolean);
  // 分类已由页签表达；全局条件逐项可移除，空行由 CSS 隐藏。
  const visibleFilters = filters.filter(([key]) => key !== 'tab');
  if (!visibleFilters.length) return '';
  return `${visibleFilters.map(([key, label]) => `<button type="button" data-act="libRemoveFilter" data-filter="${key}" aria-label="移除筛选：${escAttr(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join('')}`;
}

// 卡面按钮（瓦片内层）：整瓦片 photoTileHTML 与壳注入 mountLibTile 共用
function libSearchPhotoHTML(html, card) {
  if (!libFilter.q.trim()) return html;
  const name = card.name || '未命名卡牌';
  return html.replace('<b>' + esc(name) + '</b>', '<b>' + highlightSearchText(name, libFilter.q) + '</b>');
}

function photoTileInnerHTML(c) {
  const cached = libTileHTMLByCard.get(c);
  if (cached) return libSearchPhotoHTML(c.id === libSelectedId ? cached.replace('aria-current="false"', 'aria-current="true"') : cached, c);
  const rarity = libRarityOf(c);
  const rarityIndex = Math.max(0, RARITIES.indexOf(rarity));
  const mount = photoMountFor(rarity);
  const art = (SDT.Art && SDT.Art.cardIcon && SDT.Art.cardIcon(c, { ...LIB_ART, defer: true })) ||
    SDT.Icons.img(SDT.Cards.TYPE_ART[c.type] || 'question');
  const html = `<button type="button" class="lib-cardwrap studio-photo rv${rarityIndex}" data-act="libInspect" data-photo-zoom-source data-card="${escAttr(c.id)}" aria-label="查看照片：${escAttr(c.name || '未命名卡牌')}，${escAttr(rarity)}" aria-current="false" title="${escAttr(c.name || '未命名卡牌')} · ${escAttr(rarity)} · 查看大图与背签">
      <span class="studio-photo-paper" data-photo-mount="${mount.kind}" data-rarity="${escAttr(rarity)}">
        <span class="studio-mount-mark" aria-hidden="true"></span>
        <span class="studio-photo-art">${art}</span>
        <span class="studio-photo-caption"><b>${esc(c.name || '未命名卡牌')}</b><span class="studio-photo-footer">${c.type ? `<small class="type-badge">${esc(c.type === '能力卡' ? '能力' : c.type)}</small>` : ''}<small class="studio-thumbnail-stamp" data-studio-rarity="${escAttr(rarity)}">${esc(rarity)}</small></span></span>
      </span>
    </button>`;
  libTileHTMLByCard.set(c, html);
  return libSearchPhotoHTML(c.id === libSelectedId ? html.replace('aria-current="false"', 'aria-current="true"') : html, c);
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
    return `<div class="clib-empty"><div class="clib-empty-icon">${STUDIO_SHUTTER_ICON}</div>
      <p>${libCards.length ? '没有符合条件的照片' : (game.devMode ? '收藏还是空的，进入编辑模式后可制作新卡' : '当前没有可展示的照片')}</p>
      ${filtered ? '<button class="hs-btn sm" data-act="libClearFilter">重置筛选</button>' : '<button class="hs-btn sm" data-act="closeCardPage">返回</button>'}</div>`;
  }
  // 09-29 二期：壳常驻 + IO 双向窗口化；无 IntersectionObserver 的降级环境（jsdom 测试）一次性全量
  if (!libWindowed) { _libShellQueue = []; return all.map((card, offset) => photoTileHTML(card, offset, offset)).join(''); }
  // 10-04 拆帧：点击帧只解析首窗（卡面 + 首窗壳），余壳进 idle 队列由 appendLibShellsIdle 分批补齐
  const first = Math.min(LIB_MOUNT_BATCH, all.length);
  const firstShells = first + LIB_SHELL_FIRST;
  let html = '';
  _libShellQueue = [];
  for (let i = 0; i < first; i++) html += photoTileHTML(all[i], i, i);
  for (let i = first; i < Math.min(firstShells, all.length); i++) html += libShellHTML(all[i], i);
  // 远端壳只排卡片引用和索引；HTML 模板与稳定样式延后到对应 rAF 批次生成。
  for (let i = firstShells; i < all.length; i++) _libShellQueue.push({ card: all[i], index: i });
  return html;
}

function libGridHTML() {
  const all = libFiltered();
  // 09-24 改回上下滚动：分页条已随分页机制一并移除（2026-09-25 休眠代码清理）
  return `<div class="lib-grid${all.length ? '' : ' is-empty'}" id="libGrid" role="tabpanel" aria-label="馆藏照片">${libGridContentsHTML(all)}</div>`;
}

let libCardById = new Map();
let libCardNodeById = new Map();
let libShellNodeById = new Map();
let libTileHTMLByCard = new WeakMap();

// ======== 窗口化瓦片：壳常驻，IO 就近注入 / 离窗卸载（09-29 二期） ========
function stopLibTileObserver() {
  libTileObserver?.disconnect();
  libTileObserver = null;
  libTileObserverGrid = null;
}

function observeLibTiles(grid, roots = null) {
  if (!grid || !libWindowed) return;
  if (libTileObserver && libTileObserverGrid !== grid) stopLibTileObserver();
  if (!libTileObserver) {
    const generation = _libShellGeneration;
    libTileObserver = new IntersectionObserver(entries => {
      if (generation !== _libShellGeneration || document.getElementById('libGrid') !== grid) return;
      const mountedRoots = [];
      for (const entry of entries) {
        if (entry.isIntersecting) {
          if (mountLibTile(entry.target)) mountedRoots.push(entry.target);
        } else unmountLibTile(entry.target);
      }
      if (mountedRoots.length) warmLibArt({ roots: mountedRoots, preview: false, nearViewport: true });
    }, { root: grid, rootMargin: '100% 0px' });
    libTileObserverGrid = grid;
  }
  const shells = roots || grid.querySelectorAll('.lib-item.lib-ph');
  for (const shell of shells) {
    if (shell?.isConnected && shell.closest('.lib-grid') === grid && shell.classList.contains('lib-ph')) {
      libShellNodeById.set(shell.dataset.cardId, shell);
      libTileObserver.observe(shell);
    }
  }
}

// 网格整段替换时废弃上一代 rAF；旧回调不得把旧队列追加到新网格。
function invalidateLibShellWork() {
  _libShellGeneration++;
  _libShellScheduled = false;
  _libShellQueue = [];
}

// 余壳分批补齐（10-04 拆帧）：rAF 链每帧一批（192 壳 ≈ 4 帧补完），页面可见时
// ~100ms 内滚动高度一次到位。不用 requestIdleCallback：面板遮挡/后台页 rIC 不触发，
// 壳会滞留首窗（实测 scrollH 停在 5290）；rAF 在页面不可见时同样不跑但用户也看不到，
// 恢复可见即续。每批 append 后重挂 IO 观察（幂等，新壳纳入挂载窗口）。
function appendLibShellsIdle() {
  if (!libWindowed || !_libShellQueue.length || _libShellScheduled) return;
  _libShellScheduled = true;
  const generation = _libShellGeneration;
  const step = () => {
    if (generation !== _libShellGeneration) return;
    _libShellScheduled = false;
    const grid = document.getElementById('libGrid');
    if (!grid || !_libShellQueue.length) return;
    const batch = _libShellQueue.splice(0, LIB_SHELL_BATCH);
    const previousLast = grid.lastElementChild;
    grid.insertAdjacentHTML('beforeend', batch.map(({ card, index }) => libShellHTML(card, index)).join(''));
    const roots = [];
    for (let shell = previousLast ? previousLast.nextElementSibling : grid.firstElementChild; shell; shell = shell.nextElementSibling) roots.push(shell);
    observeLibTiles(grid, roots);
    if (_libShellQueue.length) appendLibShellsIdle();
  };
  requestAnimationFrame(step);
}

// 定位只同步补至目标壳；滚动到底部时仍可无参补齐，避免落空。
function flushLibShellsNow(targetId = null) {
  if (!_libShellQueue.length) return;
  const grid = document.getElementById('libGrid');
  if (!grid) { _libShellQueue = []; return; }
  const previousLast = grid.lastElementChild;
  const targetIndex = targetId ? _libShellQueue.findIndex(({ card }) => card.id === targetId) : -1;
  if (targetId && targetIndex < 0) return;
  const batch = _libShellQueue.splice(0, targetId ? targetIndex + 1 : _libShellQueue.length);
  grid.insertAdjacentHTML('beforeend', batch.map(({ card, index }) => libShellHTML(card, index)).join(''));
  const roots = [];
  for (let shell = previousLast ? previousLast.nextElementSibling : grid.firstElementChild; shell; shell = shell.nextElementSibling) roots.push(shell);
  observeLibTiles(grid, roots);
}

// 壳就近注入卡面；返回是否真的挂了
function mountLibTile(shell) {  if (!shell || !shell.classList.contains('lib-ph')) return false;
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
  if (grid?.classList.contains('lib-holo')) return;
  shell.textContent = '';
  shell.classList.add('lib-ph');
  if (wrap.dataset.card && libCardNodeById.get(wrap.dataset.card) === wrap) libCardNodeById.delete(wrap.dataset.card);
}

// 聚焦/定位到未挂载区时同步挂单卡（键盘翻格、选片台翻看用），返回卡面节点
function ensureLibTileMounted(id) {
  const shell = libShellNodeById.get(id);
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
      const id = el.dataset.cardId || wrap?.dataset?.card;
      if (id) libShellNodeById.set(id, el);
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
  libShellNodeById = new Map();
  if (grid) claimMountedTiles(grid, Infinity);
}

// 09-29 滚动卡顿修复第二刀：把实测瓦片高喂给 .lib-item 的 contain-intrinsic-size 占位
// （photo-studio-unified.css 的 .lib-ph 使用 --lib-tile-h）。占位与真实高度的差曾是
// content-visibility:auto 下「每行首次进相关区长个 ~50px、整轮滚动连续重排」的根因。
// 09-29 实测瓦片高度随列宽浮动但同一视宽下全距仅 ~4px（271 张 320~323px），量一张即够。
function syncLibTileIntrinsicSize(grid) {
  if (!grid) return;
  const tile = grid.querySelector('.lib-item .lib-cardwrap')?.parentElement;
  const h = tile?.offsetHeight || 0;
  if (h > 0) grid.style.setProperty('--lib-tile-h', `${h}px`);
  syncStudioTabMarker();
}

// 照片定位（键盘方向键 / 选片台翻看）：直接把目标壳滚入视野，
// IO 会就近挂载；无 IO 降级环境退化为按已挂节点定位。
function locateLibPhoto(id, position = null) {
  if (!id) return;
  const grid = document.getElementById('libGrid');
  let shell = libShellNodeById.get(id);
  if (!shell && grid && _libShellQueue.length) {
    flushLibShellsNow(id);   // 只补至目标壳；其余壳继续按帧追加。
    shell = libShellNodeById.get(id);
  }
  const node = shell || libCardNodeById.get(id)?.closest('.lib-item');
  if (!node || !grid) return;
  libHoverBlockedUntil = Date.now() + 180;
  if (position) {
    const rect = grid.getBoundingClientRect();
    const scale = rect.height / grid.offsetHeight || 1;
    grid.scrollTop += (node.getBoundingClientRect().top - rect.top) / scale - position.offset;
  } else node.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  const mounted = ensureLibTileMounted(id);
  if (mounted) warmLibArt({ roots: [mounted.closest('.lib-item')], preview: false, nearViewport: true });
}

let _prevSelectedWrap = null;  // 上一个选中卡面节点：换选 O(1) 清态，免全网格 querySelector（09-29 三期二刀）
let releaseLibTabMarker = null;
let libFilterKeyController = null;
function replayStudioMotion(node, options = {}) {
  libMotion.play(node, options);
}
function syncStudioTabMarker() {
  updatePhotoStudioTabMarker(document.querySelector('.studio-unified .clib-tabs'));
}
function setLibSelection(id, playSound = false, refreshPreview = false, motion = { reason: 'hover' }) {
  const card = libCardById.get(id) || null;
  const previousId = libSelectedId;
  const selectionChanged = previousId !== (card ? card.id : null);
  libSelectedId = card ? card.id : null;
  if (!selectionChanged && !refreshPreview) {
    if (playSound && card) Sfx.tick();
    return;
  }
  // 缓存节点可能已被整页/整格 innerHTML 重建作废，isConnected 兜底；
  // 重建后的新选中态由壳/瓦片模板自带，此处只负责「清上一个、亮下一个」
  // Initial windowed mounting can register the selected tile after the first preview update.
  const previousCard = _prevSelectedWrap?.isConnected ? _prevSelectedWrap : libCardNodeById.get(previousId);
  previousCard?.setAttribute('aria-current', 'false');
  previousCard?.closest('.lib-item')?.classList.remove('selected');
  if (selectionChanged) {
    libShellNodeById.get(previousId)?.classList.remove('selected');
  }
  const selected = card ? libCardNodeById.get(card.id) : null;
  if (selected) {
    selected.setAttribute('aria-current', 'true');
    selected.closest('.lib-item')?.classList.add('selected');
  }
  _prevSelectedWrap = selected || null;
  // 预览变化本身不补挂远端壳；翻看/键盘定位走 locateLibPhoto 单卡挂载。
  // 壳注入卡面时按 libSelectedId 自动带上选中态，选中态在窗口化下依然无损。
  const preview = document.getElementById('libPreview');
  if (preview && (selectionChanged || refreshPreview)) {
    libMotion.cancelTree(preview);
    const dossier = preview.querySelector('.studio-preview-copy');
    const oldReading = preview.querySelector('.studio-dossier-scroll')?.scrollTop || 0;
    if (card && dossier) {
      // Keep the footer buttons connected while changing their content/state.
      const template = document.createElement('template');
      template.innerHTML = libPreviewHTML(card);
      dossier.querySelector('.studio-dossier-scroll').innerHTML = template.content.querySelector('.studio-dossier-scroll').innerHTML;
      const freshActions = template.content.querySelector('.studio-preview-actions');
      const actions = dossier.querySelector('.studio-preview-actions');
      actions.querySelector('.studio-browse-controls').hidden = freshActions.querySelector('.studio-browse-controls').hidden;
      for (const action of ['libPrev', 'libNext', 'libInspect']) {
        const existing = actions.querySelector(`[data-act="${action}"]`);
        const fresh = freshActions.querySelector(`[data-act="${action}"]`);
        existing.disabled = fresh.disabled;
        if (action === 'libInspect') existing.dataset.card = card.id;
      }
      const pos = actions.querySelector('.pv-pos');
      const freshPos = freshActions.querySelector('.pv-pos');
      pos.textContent = freshPos.textContent;
      pos.setAttribute('aria-label', freshPos.getAttribute('aria-label'));
      dossier.querySelector('.studio-dossier-scroll').scrollTop = selectionChanged ? 0 : oldReading;
    } else {
      preview.innerHTML = libPreviewHTML(card);
    }
    preview.classList.toggle('has-preview', !!card);
    if (selectionChanged) {
      if (motion.reason !== 'hover') {
        const reading = preview.querySelector('.studio-dossier-scroll');
        Array.from(reading?.children || []).forEach((section, index) => replayStudioMotion(section, { ...motion, surface: 'dossier', delay: 30 + Math.min(index, 3) * 25 }));
      }
    }
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
  // 拆帧兜底（10-04）：rAF 补壳链未跟上时（页面冻结恢复期/极端时序），拖到距当前
  // 底部 600px 内强制补齐，避免滚动条越拖越短的落空感；队列空时零成本短路。
  grid.addEventListener('scroll', () => {
    libHoverBlockedUntil = Date.now() + 140;
    clearTimeout(libPreviewTimer);
    libPreviewTimer = null;
    if (_libShellQueue.length && grid.scrollTop + grid.clientHeight > grid.scrollHeight - 600) flushLibShellsNow();
  }, { passive: true });
  grid.addEventListener('focusin', (e) => {
    const card = e.target.closest && e.target.closest('.lib-cardwrap[data-card]');
    if (card) setLibSelection(card.dataset.card);
  });
  grid.addEventListener('pointermove', e => {
    if ((e.movementX || e.movementY) && Date.now() >= libHoverBlockedUntil) UI._hoverHandler?.(e);
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
      locateLibPhoto(all[targetIndex].id);
      setLibSelection(all[targetIndex].id, false, false, {
        reason: 'step', direction: Math.sign(delta), axis: e.key === 'ArrowUp' || e.key === 'ArrowDown' ? 'y' : 'x',
      });
      const targetWrap = ensureLibTileMounted(all[targetIndex].id);
      requestAnimationFrame(() => targetWrap?.focus());
    }
  });
}

// 筛选后只重绘卡格区（整页 showOverlay 会重置搜索焦点、重挂全部事件）
function renderLibGrid({ reason = 'filter', direction = 0, reset = false } = {}) {
  if (!cardPageOpen) return;
  rememberLibBrowse();
  clearTimeout(libSearchTimer);
  libSearchTimer = null;
  if (libPreviewTimer) clearTimeout(libPreviewTimer);
  libPreviewTimer = null;
  libHoveredId = null;
  invalidateLibShellWork();
  stopLibTileObserver();
  document.querySelector('.studio-archive')?.classList.toggle('studio-single-type', libFilter.tab !== '全部');
  const filtered = libFiltered();
  const n = filtered.length;
  const restored = reason === 'tab' ? libBrowseHistory.restore(libFilter, filtered) : null;
  const nextSelectedId = reset ? filtered[0]?.id || null : restored?.selectedId ||
    (reason !== 'tab' && filtered.some(c => c.id === libSelectedId) ? libSelectedId : filtered[0]?.id || null);
  libHoverBlockedUntil = Date.now() + 240;
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
    libMotion.leaveGrid(grid, { reason, direction });
    grid.innerHTML = libGridContentsHTML(filtered);
    replayStudioMotion(grid, { reason, direction });
    // 上下滚动模式（09-24）：筛选重绘后回顶，否则沿用旧滚动位置会从半截行开始看
    grid.scrollTop = 0;
    rebuildLibNodeMap(grid);
    bindLibGridNavigation();
    observeLibTiles(grid);
    appendLibShellsIdle();
  }
  const active = document.getElementById('libActiveFilters');
  if (active) active.innerHTML = libActiveFiltersHTML();
  // 筛选/排序可能改变当前卡在馆藏中的位置，即使选中 ID 不变也需刷新选片台导航状态。
  setLibSelection(nextSelectedId, false, true, { reason, direction });
  if (grid) warmLibArt({ roots: [...grid.querySelectorAll('.lib-item:not(.lib-ph)')], preview: false });
  syncLibTileIntrinsicSize(grid);
  if (restored?.anchorId) locateLibPhoto(restored.anchorId, restored);
  else if (!reset && nextSelectedId) locateLibPhoto(nextSelectedId);
  libRenderedFilter = { ...libFilter };
  syncLibFilterUI();
}

// 侧栏筛选控件同步到当前 libFilter（局部重绘时不重建侧栏，得手动回写控件状态）
function syncLibFilterUI() {
  const q = document.getElementById('cardSearch'); if (q) q.value = libFilter.q;
  const rar = document.getElementById('libRar'); if (rar) rar.value = libFilter.rar;
  const cls = document.getElementById('libCls'); if (cls) cls.value = libFilter.cls;
  const sort = document.getElementById('libSort'); if (sort) sort.value = libFilter.sort;
  const counts = libCategoryCounts();
  document.querySelectorAll('.clib-tabs .type-tab').forEach(b => {
    const active = b.dataset.t === libFilter.tab;
    b.classList.toggle('on', active);
    b.setAttribute('aria-pressed', String(active));
    b.setAttribute('aria-selected', String(active));
    b.tabIndex = active ? 0 : -1;
    b.setAttribute('aria-label', `${b.dataset.t === '能力卡' ? '能力' : b.dataset.t}，${counts[b.dataset.t] || 0}张`);
    if (active) document.getElementById('libGrid')?.setAttribute('aria-labelledby', b.id);
  });
  const hasCondition = libFilter.tab !== '全部' || libFilter.rar !== '全部' || libFilter.cls !== '全部' || !!libFilter.q.trim() || libFilter.sort !== 'rarity';
  document.querySelectorAll('.studio-clear').forEach(button => { button.disabled = !hasCondition; });
  refreshPhotoStudioControls(document.querySelector('.studio-unified'));
  syncStudioTabMarker();
}

// 稀有度筛到「棱彩」时首窗扫光，定时摘除状态。
function libHoloEgg() {
  const grid = document.getElementById('libGrid');
  if (!grid || grid.classList.contains('lib-holo')) return;
  grid.classList.add('lib-holo');
  SDT.Sound.sfx('reveal');
  setTimeout(() => grid.classList.remove('lib-holo'), 2300);
}

function renderCardLibrary() {
  libFilterKeyController?.abort();
  libFilterKeyController = new AbortController();
  rememberLibBrowse();
  libMotion.cancelAll();
  clearTimeout(libSearchTimer);
  libSearchTimer = null;
  libSearchComposing = false;
  releaseLibTabMarker?.();
  releaseLibTabMarker = null;
  if (libPreviewTimer) clearTimeout(libPreviewTimer);
  libPreviewTimer = null;
  invalidateLibShellWork();
  const photoOpenStarted = photoFpsEnabled ? performance.now() : 0;
  setCardPageOpen(true);
  // 页面级作用域；馆内动效由 photo-studio-navigation.js 编排，不逐项驱动整库。
  document.body.classList.add('cardlib-open');
  // 员工通行证A是碎片合成材料（特殊收藏品），不进卡牌库（2026-09-16 留言「在卡牌库中删除员工通行证a」）
  // Catalog membership/order and rarity lookups share one shallow snapshot for
  // this page refresh. Designer saves/imports reopen through this function.
  libCatalog = SDT.Cards.all().slice();
  refreshLibRenderContext(libCatalog);
  libCards = libCatalog.filter(c => c.id !== 'tt-token-color');
  _libSearchText = new WeakMap(libCards.map(c => [c, `${c.name || ''}\n${c.desc || ''}\n${displayCardDescription(c.desc, c.id)}`.toLowerCase()]));
  libCardById = new Map(libCards.map(card => [card.id, card]));
  libDescriptionRenderer = createCardDescriptionRenderer(libCatalog);
  libTileHTMLByCard = new WeakMap();
  // 库内容刷新即失效筛选缓存：防止卡牌增删/改卡后命中旧缓存
  // （旧缓存键只含 libCards.length，同张数的内容变化会读到陈旧列表）
  _libFilteredCache = null;
  _libFilteredKey = '';
  // 上一页的窗口化观察器在 showOverlay 换网格前先停掉（新网格由 observeLibTiles 重挂）
  stopLibTileObserver();
  const counts = libCategoryCounts();
  const tabs = ['全部'].concat(TYPES).map((t, index) =>
    `<button type="button" id="libType${index}" role="tab" aria-label="${t === '能力卡' ? '能力' : t}，${counts[t] || 0}张" aria-controls="libGrid" aria-selected="${libFilter.tab === t}" tabindex="${libFilter.tab === t ? 0 : -1}" class="type-tab${libFilter.tab === t ? ' on' : ''}" data-act="libTab" data-t="${t}" aria-pressed="${libFilter.tab === t}">
    ${studioCategoryBadgeHTML(t)}${t === '能力卡' ? '能力' : t}
    </button>`).join('');
  const editorTools = game.devMode ? `<button class="hs-btn studio-edit-toggle${libEditMode ? ' on' : ''}" data-act="libEditMode" aria-pressed="${libEditMode}">${libEditMode ? '收起工具' : '导出工具'}</button>${libEditMode ? `<button class="hs-btn" data-act="exportCards">[[icon:upload]] 导出</button>${CARD_DESIGNER_WRITES_ENABLED ? '<button class="hs-btn gold" data-act="newCard">＋ 制作新卡</button><button class="hs-btn" data-act="importCards">[[icon:download]] 导入</button>' : ''}` : ''}` : '';
  const first = libFiltered()[0] || null;
  const restoredBrowse = libBrowseHistory.restore(libFilter, libFiltered());
  if (restoredBrowse) libSelectedId = restoredBrowse.selectedId;
  if (!libSelectedId || !libFiltered().some(c => c.id === libSelectedId)) libSelectedId = first?.id || null;
  const selectedPreview = libCardById.get(libSelectedId) || first;
  UI.showOverlay('', `
    <div class="pg card-library-page photo-studio-v3 studio-index-layout studio-unified studio-archive${libEditMode ? ' edit-mode' : ''}${libFilter.tab !== '全部' ? ' studio-single-type' : ''}">
      <div class="studio-exit-anchor">${linkedBackHTML('closeCardPage', '关闭照相馆', 'studio-exit')}</div>
      <header class="pg-head library-head">
        <div class="clib-tabs" role="tablist" aria-label="照片分类">${tabs}</div>
        <div class="library-tools"><div class="studio-head-summary"><h2>照相馆</h2><span class="studio-head-total" aria-label="馆藏 ${libCards.length} 张照片">馆藏 <b>${libCards.length}</b> 张照片</span></div>${libEditMode ? '<button class="hs-btn" data-act="exportNotes" aria-label="导出全部照片备注">[[icon:download]] 导出备注</button>' : ''}${editorTools}</div>
      </header>
      <div class="clib-main">
        <div class="studio-room-scene" aria-hidden="true">
          <i class="room-gantry"></i><i class="room-beam"></i><i class="room-beam second"></i>
          <div class="room-film"><i></i><i></i><i></i></div><i class="room-floor"></i>
          ${Array.from({ length: 12 }, (_, i) => `<i class="room-dust" style="--dust-x:${19 + (i * 13) % 57}%;--dust-y:${21 + (i * 19) % 62}%;--dust-duration:${18 + i % 7}s;--dust-delay:-${i * 2.3}s"></i>`).join('')}
        </div>
        <section class="studio-catalog" aria-label="馆藏照片">
          <section class="studio-filterbar" aria-label="照片搜索与筛选">
            <div class="studio-search-row"><label class="studio-field studio-query"><span class="studio-search"><input id="cardSearch" class="clib-search" aria-label="搜索卡牌" placeholder="名称、效果或关键词" value="${escAttr(libFilter.q)}"></span></label>
              <label class="studio-field studio-quick studio-quick-rarity"><span class="studio-select-shell"><select id="libRar" class="pg-select library-select" aria-label="按稀有度筛选"><option value="全部">不限稀有度</option>${RARITIES.map(r => `<option value="${r}"${libFilter.rar === r ? ' selected' : ''}>${r}</option>`).join('')}</select></span></label><label class="studio-field studio-quick studio-quick-sort"><span class="studio-select-shell"><select id="libSort" class="pg-select" aria-label="照片排序"><option value="rarity"${libFilter.sort === 'rarity' ? ' selected' : ''}>稀有度</option><option value="cost"${libFilter.sort === 'cost' ? ' selected' : ''}>费用</option><option value="name"${libFilter.sort === 'name' ? ' selected' : ''}>名称</option></select></span></label><label class="studio-field studio-quick studio-quick-person"><span class="studio-select-shell"><select id="libCls" class="pg-select library-select" aria-label="按人物筛选"><option value="全部">不限人物</option><option value="通用"${libFilter.cls === '通用' ? ' selected' : ''}>通用</option>${[...new Set(libCards.map(c => c.cls).filter(c => c && c !== '通用'))].sort().map(c => `<option value="${escAttr(c)}"${libFilter.cls === c ? ' selected' : ''}>${esc(characterName(c))}</option>`).join('')}</select></span></label>
              <div class="studio-index-heading"><span class="lib-show"${libFiltered().length === libCards.length ? ' hidden' : ''}><b id="libResultCount">${libFiltered().length}</b> 张</span><button type="button" class="studio-clear" data-act="libClearFilter">重置</button></div>
            </div><div class="studio-active-filters" id="libActiveFilters">${libActiveFiltersHTML()}</div>
          </section>
          ${libGridHTML()}
        </section>
        <aside class="library-inspector" aria-label="选中卡牌详情"><div class="library-preview${selectedPreview ? ' has-preview' : ''}" id="libPreview" aria-live="polite">${libPreviewHTML(selectedPreview)}</div></aside>
      </div>
    </div>`, 'page');
  lastSavedId = null;
  bindPhotoStudioControls(document.querySelector('.studio-unified'));
  releaseLibTabMarker = bindPhotoStudioTabMarker(document.querySelector('.studio-unified .clib-tabs'));
  // 整页重建的网格同样走窗口挂载：还有剩余就挂上哨兵观察
  const libGrid = document.getElementById('libGrid');
  rebuildLibNodeMap(libGrid);
  observeLibTiles(libGrid);
  appendLibShellsIdle();
  bindLibGridNavigation();
  if (libGrid) warmLibArt({ roots: [...libGrid.querySelectorAll('.lib-item:not(.lib-ph)')], preview: false });
  syncLibTileIntrinsicSize(libGrid);
  libRenderedFilter = { ...libFilter };
  syncLibFilterUI();
  if (restoredBrowse?.anchorId) locateLibPhoto(restoredBrowse.anchorId, restoredBrowse);
  // 注意：lastPreviewId 在下方悬停处理段声明（函数内 let），此处不可提前赋值——
  // 昨晚"悬停去重"改动曾在此赋值触发 TDZ ReferenceError，导致后续全部 UI.act
  // 注册被跳过，卡牌库整页按钮（含右上关闭钮）无响应（老板留言：退出点不动）。
  UI.act('closeCardPage', closeLibPage);
  UI.act('newCard', () => { if (CARD_DESIGNER_WRITES_ENABLED) openCardDesigner(null); });
  // 切页签/清筛选只重绘卡格区：整页 renderCardLibrary() 会重建 245 张卡面的 HTML
  // （实测主线程阻塞 ~100ms）并重挂全部事件，而这两处改动只影响卡格与页签高亮
  UI.act('libTab', (d) => {
    if (libFilter.tab === d.t) return;
    const categories = ['全部', ...TYPES];
    const direction = Math.sign(categories.indexOf(d.t) - categories.indexOf(libFilter.tab));
    libFilter.tab = d.t;
    renderLibGrid({ reason: 'tab', direction });
  });
  UI.act('libClearFilter', () => {
    libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' };
    renderLibGrid({ reset: true });
  });
  UI.act('libRemoveFilter', (d) => {
    if (d.filter === 'tab') libFilter.tab = '全部';
    else if (d.filter === 'rar') libFilter.rar = '全部';
    else if (d.filter === 'cls') libFilter.cls = '全部';
    else if (d.filter === 'q') libFilter.q = '';
    renderLibGrid();
  });
  UI.act('libEditMode', () => { libEditMode = !libEditMode; renderCardLibrary(); });
  // 选片台翻看（09-23：上一片/下一片，在当前筛选集内走，带音效）
  const navStep = (delta) => {
    libHoveredId = null;
    clearTimeout(libPreviewTimer);
    libPreviewTimer = null;
    if (libSearchTimer) renderLibGrid({ reason: 'search' });
    const list = libFiltered();
    const i = libFilteredPositionById.get(libSelectedId) ?? -1;
    if (i < 0 || !list.length) return;
    const j = Math.max(0, Math.min(list.length - 1, i + delta));
    if (j === i) return;
    locateLibPhoto(list[j].id);
    setLibSelection(list[j].id, true, false, { reason: 'step', direction: delta });
  };
  UI.act('libPrev', () => navStep(-1));
  UI.act('libNext', () => navStep(1));
  UI.act('libLocate', () => {
    libHoveredId = null; clearTimeout(libPreviewTimer); libPreviewTimer = null;
    if (libSelectedId) locateLibPhoto(libSelectedId);
  });
  UI.act('libCardReference', (data, trigger) => {
    const referenced = libDescriptionRenderer.getCard(data.cardReference);
    if (referenced) UI.showCardZoom(referenced, { ...libReferenceOptions(referenced), returnFocus: trigger });
  });
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
        ? libCardNodeById.get(card.id)?.querySelector('.studio-photo-paper')
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
        photoMotion: 'atelier',
        descriptionRenderer: libDescriptionRenderer, descriptionQuery: libFilter.q,
        createReferenceOptions: libReferenceOptions,
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
            else if (noteHTML) preview?.querySelector('.studio-dossier-scroll')?.insertAdjacentHTML('beforeend', noteHTML);
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
  // 搜索 / 稀有度筛选：只重绘卡格，保持输入焦点
  UI._inputHandler = (e) => {
    let prism = false;   // 彩蛋 2 的触发条件：筛到「棱彩」
    if (e.target.id === 'cardSearch') {
      libFilter.q = e.target.value;
      clearTimeout(libSearchTimer);
      libSearchTimer = null;
      if (!e.isComposing && !libSearchComposing) libSearchTimer = setTimeout(() => renderLibGrid({ reason: 'search' }), 120);
      return;
    }
    else if (e.target.id === 'libRar') { libFilter.rar = e.target.value; prism = e.target.value === '棱彩'; }
    else if (e.target.id === 'libCls') { libFilter.cls = e.target.value; }
    else if (e.target.id === 'libSort') { libFilter.sort = e.target.value; }
    else return;
    renderLibGrid({ reason: e.target.id === 'libSort' ? 'sort' : 'filter' });
    if (prism) libHoloEgg();
  };
  // 悬停大图预览（炉石式）。mouseover 会因子元素冒泡重复触发：
  // 记住上一张预览的卡，扫过同一张卡时不再整页重建预览 DOM / 重复播悬停音；
  // 2026-09-06 留言（库页滑动很卡）：预览大图的解码/重建在主线程，滚动扫过时
  // 再加 90ms 去抖——只有停留的卡才真正重建，滚动风暴中预览零重建。
  libHoveredId = null;
  bindLibGridNavigation();
  UI._hoverHandler = (e) => {
    if (Date.now() < libHoverBlockedUntil) return;
    const w = e.target.closest ? e.target.closest('[data-card]') : null;
    const id = w ? w.dataset.card : null;
    if (id === libHoveredId) return;
    libHoveredId = id;
    if (libPreviewTimer) clearTimeout(libPreviewTimer);
    libPreviewTimer = null;
    if (!id) return;   // 移出卡面：保留当前预览不动
    libPreviewTimer = setTimeout(() => {
      libPreviewTimer = null;
      const card = libCardById.get(id);
      if (card) setLibSelection(card.id, true);
    }, 90);
  };
  const page = document.querySelector('.card-library-page');
  const search = document.getElementById('cardSearch');
  search?.addEventListener('compositionstart', () => {
    libSearchComposing = true;
    clearTimeout(libSearchTimer);
    libSearchTimer = null;
  });
  search?.addEventListener('compositionend', () => {
    libSearchComposing = false;
    libFilter.q = search.value;
    clearTimeout(libSearchTimer);
    libSearchTimer = setTimeout(() => renderLibGrid({ reason: 'search' }), 120);
  });
  // Run before the host overlay's capture handler: Escape dismisses the innermost choice.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || e.isComposing || e.keyCode === 229 || document.getElementById('cardZoom')) return;
    const choice = page?.querySelector('.studio-choice[open]');
    if (!choice) return;
    e.preventDefault(); e.stopPropagation();
    if (choice) {
      closePhotoStudioControls();
      choice.querySelector('summary')?.focus({ preventScroll: true });
    }
  }, { capture: true, signal: libFilterKeyController.signal });
  if (page) page.addEventListener('keydown', (e) => {
    if (e.isComposing) { e.stopPropagation(); return; }
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

// Only visible prints participate in entry readiness. The timeout never blocks browsing
// on a missing asset, and abort/timeout removes every temporary image listener.
export async function preparePhotoStudioEntry(signal) {
  const grid = document.getElementById('libGrid');
  if (!grid || signal?.aborted) return;
  const bounds = grid.getBoundingClientRect();
  const images = Array.from(grid.querySelectorAll('.studio-photo-art img')).filter(image => {
    const rect = image.getBoundingClientRect();
    return rect.bottom > bounds.top && rect.top < bounds.bottom;
  });
  const cleanup = [];
  let finish;
  const timeout = new Promise(resolve => { finish = resolve; });
  const timer = setTimeout(finish, 220);
  const abort = () => finish();
  signal?.addEventListener('abort', abort, { once: true });
  try {
    const ready = images.map(image => {
      if (image.complete && image.naturalWidth) {
        try { return Promise.resolve(image.decode?.()).catch(() => {}); }
        catch { return undefined; }
      }
      return new Promise(resolve => {
        const done = () => resolve();
        image.addEventListener('load', done, { once: true });
        image.addEventListener('error', done, { once: true });
        cleanup.push(() => { image.removeEventListener('load', done); image.removeEventListener('error', done); });
      });
    });
    await Promise.race([Promise.allSettled(ready), timeout]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
    cleanup.forEach(release => release());
  }
}

function closeLibPage() {
  libFilterKeyController?.abort();
  libFilterKeyController = null;
  rememberLibBrowse();
  libMotion.cancelAll();
  libSearchComposing = false;
  cancelPendingCardPageEntry();
  closePhotoStudioControls();
  releaseLibTabMarker?.();
  releaseLibTabMarker = null;
  if (libPreviewTimer) clearTimeout(libPreviewTimer);
  libPreviewTimer = null;
  setCardPageOpen(false);
  clearPhotoFpsSettledTimer();
  stopPhotoFpsProbe();
  clearTimeout(libSearchTimer);
  libSearchTimer = null;
  stopLibTileObserver();
  resetLibArtWarmup();
  invalidateLibShellWork();   // 关页丢弃余壳队列（idle 批次不再向已拆除的网格补壳）
  libTileHTMLByCard = new WeakMap();   // 全局卡目录仍持有 key 对象，关闭时释放缓存模板字符串
  libRenderContext = null;
  libCatalog = [];
  libCards = [];
  libCardById.clear();
  _libSearchText = new WeakMap();
  _libFilteredCache = null;
  _libFilteredKey = '';
  libCategoryCache = null;
  libCategoryCacheCards = null;
  libCategoryCacheKey = '';
  libDescriptionRenderer = createCardDescriptionRenderer();
  libCardNodeById.clear();
  libShellNodeById.clear();
  libFilteredPositionById.clear();
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
