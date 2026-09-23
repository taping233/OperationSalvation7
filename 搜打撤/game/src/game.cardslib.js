/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { descRich } from './cards.view.js';
import { game } from './game.session.js';
import { characterName } from './characters.js';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote, exportNotes } from './card-photo-notes.js';
import { photoMountFor } from './photo-studio-presentation.js';

const navigation = {
  closeBase: () => {},
  renderHub: () => {},
  resetDeployPick: () => {},
};

function configureCardNavigation(hooks) {
  Object.assign(navigation, hooks || {});
}
  const RARITIES = SDT.Cards.RARITIES;
  const TYPES = SDT.Cards.TYPES;
  const TYPE_ICON = SDT.Cards.TYPE_ICON;
  const DMG_TYPES = SDT.Cards.DMG_TYPES;
  let editingCard = null;        // 制作坊正在编辑的原卡（null = 新建）
  let designerReturnLib = false; // 关闭制作坊时是否回到卡牌库
  let cardPageOpen = false;      // 卡牌大页面打开中（Esc / 点击背景可关闭）
  let cardPagePrevState = null;  // 打开库/制作坊前的游戏状态（从标题界面打开时关回 'title'）
  let lastSavedId = null;        // 刚保存的卡，库中高亮
  let libCards = [];             // 库页面缓存（悬停预览用）
  let libFilter = { tab: '全部', rar: '全部', cls: '全部', q: '', sort: 'rarity' };
  let libSelectedId = null;     // 照相馆选片台当前陈列卡
  let libEditMode = false;      // 开发者工具与日常浏览分离，避免每张卡常驻危险操作
  let draft = null;              // 制作坊草稿
  const CARD_DESIGNER_WRITES_ENABLED = false;

  // 开发模式 ?photoFps=1：采样 DOM 页的 rAF 间隔，不使用被遮挡画布的 FPS 统计。
  const photoFpsEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('photoFps');
  let photoFpsProbe = null;
  let photoFpsSettledTimer = null;
  function stopPhotoFpsProbe() {
    if (!photoFpsProbe) return;
    cancelAnimationFrame(photoFpsProbe.frame);
    photoFpsProbe.observer?.disconnect();
    photoFpsProbe.frameObserver?.disconnect();
    photoFpsProbe = null;
  }
  function samplePhotoFps(label, duration = 2500, requireOpen = true) {
    if (!photoFpsEnabled) return;
    stopPhotoFpsProbe();
    const started = performance.now();
    let previous = started;
    const gaps = [];
    const slowFrames = [];
    const longTasks = [];
    const longAnimationFrames = [];
    const observer = typeof PerformanceObserver === 'function'
      ? new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)))
      : null;
    try { observer?.observe({ type: 'longtask', buffered: false }); } catch (_) {}
    const frameObserver = typeof PerformanceObserver === 'function'
      ? new PerformanceObserver(list => list.getEntries().forEach(entry => longAnimationFrames.push({
        duration: +entry.duration.toFixed(1),
        renderMs: +(entry.duration - (entry.renderStart - entry.startTime)).toFixed(1),
        layoutMs: +(entry.duration - (entry.styleAndLayoutStart - entry.startTime)).toFixed(1),
        scripts: entry.scripts?.slice(0, 2).map(script => [script.invoker, +script.duration.toFixed(1)]),
      })))
      : null;
    try { frameObserver?.observe({ type: 'long-animation-frame', buffered: false }); } catch (_) {}
    const probe = { frame: 0, observer, frameObserver };
    photoFpsProbe = probe;
    const tick = now => {
      if (photoFpsProbe !== probe || (requireOpen && !cardPageOpen)) return;
      const gap = now - previous;
      gaps.push(gap);
      if (gap > 20) slowFrames.push([+(now - started).toFixed(0), +gap.toFixed(1)]);
      previous = now;
      if (now - started < duration) { probe.frame = requestAnimationFrame(tick); return; }
      const sorted = [...gaps].sort((a, b) => a - b);
      console.info('[photo-fps]', JSON.stringify({
        label,
        fps: +(gaps.length * 1000 / (now - started)).toFixed(1),
        frameP95: +sorted[Math.floor(sorted.length * .95)].toFixed(1),
        frameMax: +sorted[sorted.length - 1].toFixed(1),
        over8ms: gaps.filter(gap => gap > 8.33).length,
        over20ms: gaps.filter(gap => gap > 20).length,
        longTasks: longTasks.length,
        longTaskMax: +Math.max(0, ...longTasks).toFixed(1),
        longAnimationFrames: longAnimationFrames.slice(0, 8),
        slowFrames,
        frames: gaps.length,
        visible: document.visibilityState,
      }));
      stopPhotoFpsProbe();
    };
    probe.frame = requestAnimationFrame(tick);
  }


  // 音效统一走 SDT.Sound（sound.js：程序化音效 + 生成式背景乐）；保留别名兼容旧调用
  const Sfx = {
    tick() { SDT.Sound.sfx('hover'); },
    ding() { SDT.Sound.sfx('ding'); },
  };

// 机制词条定义已抽到 mech-sentences.js（纯模块，供制作坊与效果元测试共用）
import { MECH_GROUPS, MECH_ALL } from './mech-sentences.js';

  // 描述里追加 / 递增次数 / 整句移除一条机制句式，返回新描述
  function mechToggle(desc, item) {
    if (!item.sen.test(desc)) {
      const phrase = item.tpl(1);
      return desc.trim() ? desc.replace(/\s*$/, '') + (/[。；;]$/.test(desc.trim()) ? '' : '；') + phrase : phrase;
    }
    const m = desc.match(item.cnt);
    const n = m ? +(m[1] || 1) : 1;
    if (item.max > 1 && n < item.max) return desc.replace(item.sen, item.tpl(n + 1));
    // 已到上限或不可叠加 → 整句移除，并清掉开头残留的分隔符
    return desc.replace(item.sen, '').replace(/^[；;\s]+/, '').trim();
  }

  // 卡面渲染（已迁至 SDT.Cards.cardHTML，卡牌库/商店/背包/战斗共用）
  const cardHTML = (c, cls, opts) => SDT.Cards.cardHTML(c, cls, opts);

  // ======== 卡牌收藏页（照相馆） ========
  // 固定分页限制每次创建的卡格与图片数量，筛选和切页只重绘当前页。
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

  // 卡面小图开关（2026-09-13 老板反馈「卡牌库很卡」）：库页网格与悬停预览里的插画区
  // 最大只到 215×165 CSS px，原图 896 宽等于 4 倍以上过采样，245 张全量解码要 918MB，
  // 滚动时解码缓存反复驱逐重解码。改取 448 宽缩略图（assets/thumbs，见 art.js cardIcon）。
  // 放大看卡面（libInspect → showCardZoom）不传 low，仍是原图。
  const LIB_ART = { low: true };
  // 每页四列两行，控制照片节点、阴影层和待解码缩略图的数量。
  const LIB_PAGE_SIZE = 8;
  let libPageIndex = 0;
  let libSearchTimer = null;

  // 照片陈列差异按卡牌稳定 id 生成：同一张卡每次打开保持同一磨损与落影，
  // 不用原生随机函数，避免筛选/重绘时整面墙不断跳位。
  function photoUnit(seed, salt) {
    let hash = (2166136261 ^ salt) >>> 0;
    const text = String(seed || 'card');
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash / 0xffffffff;
  }

  function photoStyle(card, index) {
    const seed = card.id || card.name || index;
    const between = (salt, min, max) => min + photoUnit(seed, salt) * (max - min);
    // 落影角度/虚实随卡不同，按卡牌 id 稳定生成，筛选重绘不跳位。
    // （悬挂微倾/3D 侧倾 2026-09-23 拍板删除：网格不齐损害清晰度）
    return [
      `--i:${index}`,
      `--photo-shadow-x:${between(23, -3, 3).toFixed(1)}px`,
      `--photo-shadow-y:${between(37, 14, 22).toFixed(1)}px`,
      `--photo-shadow-blur:${between(41, 24, 34).toFixed(1)}px`,
    ].join(';');
  }

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

  // 馆内藏品编号：按卡牌稳定 id 哈希成两位数，同一张卡每次进馆都是同一个号（批次四）
  function photoNo(id) {
    let h = 7;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return 10 + h % 90;
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

  function libGridContentsHTML(all = libFiltered(), pageIndex = libPageIndex) {
    if (!all.length) {
      const filtered = libCards.length > 0 &&
        (libFilter.tab !== '全部' || libFilter.rar !== '全部' || libFilter.cls !== '全部' || libFilter.q.trim() !== '');
      return `<div class="clib-empty"><div class="clib-empty-icon">[[icon:archive]]</div>
        <p>${libCards.length ? '没有符合条件的照片' : (game.devMode ? '收藏还是空的，进入编辑模式后可制作新卡' : '当前没有可展示的照片')}</p>
        ${filtered ? '<button class="hs-btn sm" data-act="libClearFilter">重置筛选</button>' : ''}</div>`;
    }
    const start = pageIndex * LIB_PAGE_SIZE;
    return all.slice(start, start + LIB_PAGE_SIZE)
      .map((card, offset) => photoTileHTML(card, start + offset, offset)).join('');
  }

  function libPageControlsHTML(all = libFiltered()) {
    const pageCount = Math.max(1, Math.ceil(all.length / LIB_PAGE_SIZE));
    const page = Math.min(libPageIndex + 1, pageCount);
    return `<nav class="pv-nav studio-page-nav" id="libPageControls" aria-label="照片分页"${pageCount <= 1 ? ' hidden' : ''}>
      <button type="button" class="pv-navbtn" data-act="libPagePrev"${page <= 1 ? ' disabled' : ''}>‹ 上一页</button>
      <span class="pv-pos" aria-live="polite">第 ${page} / ${pageCount} 页 · 共 ${all.length} 张</span>
      <button type="button" class="pv-navbtn" data-act="libPageNext"${page >= pageCount ? ' disabled' : ''}>下一页 ›</button>
    </nav>`;
  }

  function libGridHTML() {
    const all = libFiltered();
    return `<div class="lib-grid${all.length ? '' : ' is-empty'}" id="libGrid">${libGridContentsHTML(all)}</div>${libPageControlsHTML(all)}`;
  }

  let libCardById = new Map();
  let libCardNodeById = new Map();
  // 当前页外最多保留相邻两页的节点（合计最多 24 张缩略图）。筛选与重新开库即清空。
  const libPageCache = new Map();
  let libPageCacheFilterKey = '';
  let libRenderedPageIndex = null;
  let libPageWarmTask = null;
  let libPageWarmGeneration = 0;

  function cancelLibPageWarm() {
    libPageWarmGeneration++;
    if (libPageWarmTask != null) {
      if (typeof cancelIdleCallback === 'function') cancelIdleCallback(libPageWarmTask);
      else clearTimeout(libPageWarmTask);
      libPageWarmTask = null;
    }
  }

  function warmNextLibPage(all) {
    const nextPage = libPageIndex + 1;
    if (nextPage * LIB_PAGE_SIZE >= all.length || libPageCache.has(nextPage)) return;
    const generation = libPageWarmGeneration;
    const run = () => {
      libPageWarmTask = null;
      if (generation !== libPageWarmGeneration || !cardPageOpen) return;
      const template = document.createElement('template');
      template.innerHTML = libGridContentsHTML(all, nextPage);
      const fragment = template.content;
      for (const image of fragment.querySelectorAll('.studio-photo-art img')) {
        decodeLibImage(image);
        image.dataset.libWarm = '1';
      }
      libPageCache.set(nextPage, fragment);
      while (libPageCache.size > 2) libPageCache.delete(libPageCache.keys().next().value);
    };
    libPageWarmTask = typeof requestIdleCallback === 'function'
      ? requestIdleCallback(run, { timeout: 1000 })
      : setTimeout(run, 50);
  }

  function switchLibPage(page, all = libFiltered()) {
    const pageCount = Math.max(1, Math.ceil(all.length / LIB_PAGE_SIZE));
    const next = Math.max(0, Math.min(pageCount - 1, page));
    if (next === libPageIndex) return;
    const pageDirection = next > libPageIndex ? 'next' : 'previous';
    libPageIndex = next;
    clearTimeout(photoFpsSettledTimer);
    samplePhotoFps('page');
    renderLibGrid({ keepPage: true, pageDirection });
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

  // 卡面缩略图预解码：启动时的全量预热清单补的是 assets/ 原图，库页显示的是
  // assets/thumbs/ 缩略图，不补这一步首轮滚动就得边滚边解码（实测首轮滚动
  // 32~35fps → 44~45fps，>50ms 长帧减半）。解码在解码线程，不占主线程。
  let libArtObserver = null;
  let libArtRoot = null;
  function decodeLibImage(image) {
    image.loading = 'eager';
    if (!image.getAttribute('src') && image.dataset.libSrc) {
      image.src = image.dataset.libSrc;
      delete image.dataset.libSrc;
    }
    try { image.decode?.()?.catch?.(() => {}); } catch (_) {}
  }

  function warmLibArt() {
    const grid = document.getElementById('libGrid');
    if (!grid) return;
  // 当前页创建后观察近屏缩略图；网格根节点变化时重建 observer。
    if (libArtRoot !== grid) {
      libArtObserver?.disconnect();
      libArtObserver = null;
      libArtRoot = grid;
    }
    const images = [...grid.querySelectorAll('.studio-photo-art img[data-lib-src]:not([data-lib-warm]), .studio-photo-art img[src]:not([data-lib-warm])')];
    images.forEach(image => { image.dataset.libWarm = '1'; });
    // 图片先保留 data-lib-src；只有接近视口才赋 src 并异步解码，避免原生 lazy 提前加载整批。
    if (typeof IntersectionObserver !== 'function') {
      images.forEach(decodeLibImage);
    } else {
      if (!libArtObserver) {
        libArtObserver = new IntersectionObserver(entries => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            decodeLibImage(entry.target);
            libArtObserver?.unobserve(entry.target);
          }
        }, { root: grid, rootMargin: '55% 0px' });
      }
      images.forEach(image => libArtObserver.observe(image));
    }
    document.querySelectorAll('#libPreview img[src]').forEach(decodeLibImage);
  }

  // 筛选后只重绘卡格区（整页 showOverlay 会重置搜索焦点、重挂全部事件）
  // opts.keepPage：翻看导航跨页时保留目标页（当前页卡格滚动仍回到顶部）
  function renderLibGrid(opts) {
    cancelLibPageWarm();
    const keepPage = !!(opts && opts.keepPage);
    const filterKey = JSON.stringify([libFilter.tab, libFilter.rar, libFilter.cls, libFilter.q, libFilter.sort]);
    if (!keepPage || filterKey !== libPageCacheFilterKey) {
      libPageCache.clear();
      libRenderedPageIndex = null;
      libPageCacheFilterKey = filterKey;
    }
    const filtered = libFiltered();
    const n = filtered.length;
    if (!keepPage) libPageIndex = 0;
    libPageIndex = Math.min(libPageIndex, Math.max(0, Math.ceil(n / LIB_PAGE_SIZE) - 1));
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
    const controls = document.getElementById('libPageControls');
    if (controls) controls.outerHTML = libPageControlsHTML(filtered);
    const grid = document.getElementById('libGrid');
    if (grid) {
      grid.classList.toggle('lib-page-next', opts?.pageDirection === 'next');
      grid.classList.toggle('lib-page-previous', opts?.pageDirection === 'previous');
      grid.classList.toggle('is-empty', !filtered.length);
      libArtObserver?.disconnect();
      libArtObserver = null;
      libArtRoot = null;
      if (keepPage && libRenderedPageIndex != null && libRenderedPageIndex !== libPageIndex && grid.childNodes.length) {
        const fragment = document.createDocumentFragment();
        for (const image of grid.querySelectorAll('.studio-photo-art img')) delete image.dataset.libWarm;
        while (grid.firstChild) fragment.appendChild(grid.firstChild);
        libPageCache.delete(libRenderedPageIndex);
        libPageCache.set(libRenderedPageIndex, fragment);
        while (libPageCache.size > 2) libPageCache.delete(libPageCache.keys().next().value);
      }
      const cachedPage = keepPage ? libPageCache.get(libPageIndex) : null;
      if (cachedPage) {
        libPageCache.delete(libPageIndex);
        grid.replaceChildren(cachedPage);
      } else {
        grid.innerHTML = libGridContentsHTML(filtered);
      }
      libRenderedPageIndex = libPageIndex;
      bindLibGridNavigation();
    }
    const active = document.getElementById('libActiveFilters');
    if (active) active.innerHTML = libActiveFiltersHTML();
    setLibSelection(nextSelectedId);
    warmLibArt();
    warmNextLibPage(filtered);
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
    cancelLibPageWarm();
    libPageCache.clear();
    libPageCacheFilterKey = '';
    libRenderedPageIndex = null;
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
    libPageIndex = 0;
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
              <path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
              <path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
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
    libPageCacheFilterKey = JSON.stringify([libFilter.tab, libFilter.rar, libFilter.cls, libFilter.q, libFilter.sort]);
    libRenderedPageIndex = libPageIndex;
    bindLibGridNavigation();
    warmLibArt();
    warmNextLibPage(libFiltered());
    // 注意：lastPreviewId 在下方悬停处理段声明（函数内 let），此处不可提前赋值——
    // 昨晚"悬停去重"改动曾在此赋值触发 TDZ ReferenceError，导致后续全部 UI.act
    // 注册被跳过，卡牌库整页按钮（含右上关闭钮）无响应（老板留言：退出点不动）。
    UI.act('closeCardPage', closeLibPage);
    UI.act('newCard', () => { if (CARD_DESIGNER_WRITES_ENABLED) openCardDesigner(null); });
    UI.act('libPagePrev', () => switchLibPage(libPageIndex - 1));
    UI.act('libPageNext', () => switchLibPage(libPageIndex + 1));
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
    clearTimeout(photoFpsSettledTimer);
    samplePhotoFps('open', 1500);
    if (photoFpsEnabled) photoFpsSettledTimer = setTimeout(() => {
      if (cardPageOpen) samplePhotoFps('settled-idle', 3500);
    }, 1800);
  }

  function closeLibPage() {
    cardPageOpen = false;
    clearTimeout(photoFpsSettledTimer);
    stopPhotoFpsProbe();
    cancelLibPageWarm();
    clearTimeout(libSearchTimer);
    libSearchTimer = null;
    libArtObserver?.disconnect();
    libArtObserver = null;
    libArtRoot = null;
    libPageIndex = 0;
    libCardNodeById.clear();
    libPageCache.clear();
    libRenderedPageIndex = null;
    document.body.classList.remove('cardlib-open');
    UI.hideOverlay();
    game.state = cardPagePrevState || 'idle';   // 从标题界面打开则回到标题，其余维持原 'idle' 行为
    cardPagePrevState = null;
    UI.refresh(game);
    samplePhotoFps('title', 3500, false);
  }

  // ======== 卡牌制作坊 ========
  function openCardDesigner(card) {
    if (!CARD_DESIGNER_WRITES_ENABLED) { openCardLibrary(); return; }
    if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
    if (game.state !== 'modal') cardPagePrevState = game.state;   // 同 openCardLibrary：记录来源
    game.state = 'modal';
    // 当前顶层正是卡牌库页面 → 关闭制作坊时回到库
    designerReturnLib = cardPageOpen && !!document.getElementById('libGrid');
    cardPageOpen = true;
    editingCard = card || null;
    draft = {
      id: card ? card.id : null,
      name: card ? card.name : '',
      cost: card ? card.cost : 1,
      rarity: card ? card.rarity : '古朴',
      type: card ? card.type : '武术',
      dmg: card ? Math.max(0, +card.dmg || 0) : 0,
      // 伤害类型词条：已标注优先，其次按描述推导，新建默认攻击（法术类型切换时补默认）
      dmgType: card
        ? (SDT.Cards.DMG_TYPE_META[card.dmgType] ? card.dmgType
          : (SDT.Cards.deriveDmgType(card) || 'fixed'))
        : 'attack',
      // 抽卡 / 注能词条：已标注优先，其次按描述回填，新建默认 0
      draw: card ? Math.max(0, +(card.draw || 0) || SDT.Cards.deriveDraw(card) || 0) : 0,
      infuse: card ? Math.max(0, +(card.infuse || 0) || SDT.Cards.deriveInfuse(card) || 0) : 0,
      heal: card ? Math.max(0, +(card.heal || 0) || SDT.Cards.deriveHeal(card) || 0) : 0,
      armor: card ? Math.max(0, +(card.armor || 0) || SDT.Cards.deriveArmor(card) || 0) : 0,
      desc: card ? (card.desc || '') : '',
      value: card ? Math.max(0, +card.value || 0) : 0,
      // 出售资格：默认不可出售；编辑旧卡时按 isSellable 回显（含「可出售」备注推导）
      sellable: card ? SDT.Cards.isSellable(card) : false,
      // 身份字段原样保留：制作坊表单不编辑它们，但保存时必须带回，
      // 否则 upsert 整卡替换会丢 cls/hero（能力卡专属立绘与 heroOf 依赖）
      cls: card ? (card.cls || '') : '',
      hero: card ? !!card.hero : false,
      tokenOf: card ? (card.tokenOf || undefined) : undefined,
      unrandom: card ? !!card.unrandom : false,
      // 2026-09-19 留言 #29：馆方记录（与卡面效果描述分开的一段正式档案文本）
      note: card ? (card.note || '') : '',
    };
    renderDesigner();
  }

  // 机制词条按钮组（on 态 + 次数角标实时反映描述内容）
  function mechChipsHTML() {
    return MECH_GROUPS.map(g => `
      <div class="mech-group">
        <div class="mech-group-name">${g.name}</div>
        <div class="mech-chips">${g.items.map(it => {
          const on = it.sen.test(draft.desc);
          const m = on ? draft.desc.match(it.cnt) : null;
          const n = m ? +(m[1] || 1) : 0;
          return `<button type="button" class="mech-chip${on ? ' on' : ''}" data-act="mech" data-k="${it.k}" title="${escAttr(it.tpl(Math.max(1, n)))}（点击${on ? (it.max > 1 && n < it.max ? '叠加次数' : '移除') : '写入描述'}）">${SDT.Icons.img(it.icon)}${it.label}${n > 1 ? `<em>${n}</em>` : ''}</button>`;
        }).join('')}</div>
      </div>`).join('');
  }

  // 机制词条改动后：同步描述框 / 字数 / 按钮态 / 卡面预览
  function mechSyncUI() {
    const ta = document.getElementById('cardDesc');
    if (ta) ta.value = draft.desc;
    const cnt = document.getElementById('descCount');
    if (cnt) cnt.textContent = `${draft.desc.length}/100`;
    const wrap = document.getElementById('mechChips');
    if (wrap) wrap.innerHTML = mechChipsHTML();
    updateDesignerPreview();
  }

  function renderDesigner() {
    const isDmgType = DMG_TYPES.includes(draft.type);
    UI.showOverlay('', `
      <div class="pg cdes">
        <button class="pg-close" data-act="closeDesigner" title="${designerReturnLib ? '返回照相馆（Esc）' : '关闭（Esc）'}">[[icon:cross]]</button>
        <header class="pg-head">
          <h2>[[icon:cards]] 卡牌制作坊</h2>
          <span class="pg-spacer"></span>
          ${designerReturnLib ? '<button class="hs-btn" data-act="closeDesigner">← 返回照相馆</button>' : ''}
          <button class="hs-btn gold" data-act="saveCard">[[icon:save]] ${editingCard ? '保存修改' : '保存卡牌'}</button>
        </header>
        <div class="cdes-main">
          <div class="cdes-stage" id="cdesStage">
            <div id="cardTilt"><div id="cardPreview"></div></div>
            <p class="stage-hint">[[icon:mouse]] 移动鼠标可以转动卡牌</p>
          </div>
          <div class="cdes-form">
            <div class="cdes-sec"><span>基础设定</span></div>
            <div class="cdes-row"><label>卡牌名称</label>
              <input id="cardName" type="text" maxlength="12" value="${escAttr(draft.name)}" placeholder="起个名字（≤12 字）"></div>
            <div class="cdes-row"><label>类型 <span class="row-tip">决定卡牌边框与图腾</span></label>
              <div class="seg type-seg">${TYPES.map(t =>
                `<button data-act="pickType" data-t="${t}" class="${draft.type === t ? 'on' : ''}">${SDT.Icons.img(SDT.Cards.TYPE_ART[t] || 'question')}${t}</button>`).join('')}</div></div>
            <div class="cdes-duo">
              <div class="cdes-row"><label>费用</label>
                <div class="seg">${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.cost === v ? ' on' : ''}" data-act="pickCost" data-v="${v}">${v}</button>`).join('')}</div></div>
              <div class="cdes-row"><label>稀有度 <span class="row-tip">边框光效 · 商店价格</span></label>
                <div class="seg">${RARITIES.map((r, i) =>
                  `<button class="rar-dot rv${i}${draft.rarity === r ? ' on' : ''}" data-act="pickRar" data-r="${r}"><i></i>${r}</button>`).join('')}</div></div>
            </div>
            <div class="cdes-sec"><span>战斗词条</span></div>
            <div class="cdes-row" id="rowDmg" ${isDmgType ? '' : 'hidden'}><label>伤害词条 <span class="row-tip">武术 / 法术专属 · 四类伤害体系（design.md §3）</span></label>
              <div class="seg dmgtype-seg">${SDT.Cards.DMG_TYPE_ORDER.map(dt => {
                const m = SDT.Cards.DMG_TYPE_META[dt];
                return `<button data-act="pickDmgType" data-dt="${dt}" class="${draft.dmgType === dt ? 'on' : ''}" title="${escAttr(m.tip)}"><i>${m.icon}</i>${m.name}</button>`;
              }).join('')}</div>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="dmgAdj" data-v="-1" title="减少">−</button>
                <input id="cardDmg" type="number" min="0" max="99" value="${draft.dmg}">
                <button class="hs-btn round" data-act="dmgAdj" data-v="1" title="增加">＋</button>
                <span class="dmg-hint">显示为卡牌左下角的<span class="dmg-num">红色伤害宝石</span></span>
              </div></div>
            <div class="cdes-row"><label>抽卡 <span class="row-tip">BOSS 战从牌库抽 N 张 · 普通战斗改为获得 N 张初始攻击</span></label>
              <div class="dmg-ctl">
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.draw === v ? ' on' : ''}" data-act="pickDraw" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint">0 = 无该词条</span>
              </div></div>
            <div class="cdes-row"><label>注能 <span class="row-tip">打出前需先选择 N 张手牌消耗</span></label>
              <div class="dmg-ctl">
                ${[0, 1, 2, 3, 4, 5].map(v =>
                  `<button class="cost-gem${draft.infuse === v ? ' on' : ''}" data-act="pickInfuse" data-v="${v}">${v}</button>`).join('')}
                <span class="dmg-hint">0 = 无该词条；有注能时卡面类型行下方会显示角标</span>
              </div></div>
            <div class="cdes-row"><label>回复 / 护甲 <span class="row-tip">简单词条 · 战斗中拖到自己身上打出；禁疗会阻止回复</span></label>
              <div class="dmg-ctl">
                <span class="dmg-hint" style="margin-right:4px">[[icon:heart]] 回复</span>
                <input id="cardHeal" type="number" min="0" max="99" value="${draft.heal}">
                <span class="dmg-hint" style="margin:0 4px 0 14px">[[icon:plate]] 护甲</span>
                <input id="cardArmor" type="number" min="0" max="99" value="${draft.armor}">
                <span class="dmg-hint">0 = 无该词条；可与描述中的其他效果组合</span>
              </div></div>
            <div class="cdes-sec"><span>机制词条</span><em>点击写入规范句式 · 战斗中自动实装</em></div>
            <div class="cdes-row" id="mechChips">${mechChipsHTML()}</div>
            <p class="dmg-hint" style="margin:-6px 0 22px">[[icon:lantern]] 再点一次叠加次数，到上限后再点移除；句式与战斗结算（battle.core 词条解析）一一对应，也可在描述里手写其他效果。</p>
            <div class="cdes-sec"><span>描述与经济</span></div>
            <div class="cdes-row"><label>效果描述 <span class="row-tip">可选</span><span class="pg-spacer"></span><span class="desc-count" id="descCount">${draft.desc.length}/100</span></label>
              <textarea id="cardDesc" rows="4" maxlength="100" placeholder="点上方机制词条自动生成，或手写描述。">${esc(draft.desc)}</textarea></div>
            <div class="cdes-row" id="rowValue"><label>币值 [[icon:coin]] <span class="row-tip">卡牌右下角金色角标 · 商店收购参考价</span></label>
              <div class="dmg-ctl">
                <button class="hs-btn round" data-act="valAdj" data-v="-1" title="减少">−</button>
                <input id="cardValue" type="number" min="0" max="99" value="${draft.value}">
                <button class="hs-btn round" data-act="valAdj" data-v="1" title="增加">＋</button>
                <label class="sellable-tgl" title="所有卡牌默认不可出售，勾选后才能在商店卖掉"><input type="checkbox" id="cardSellable" ${draft.sellable ? 'checked' : ''}> 可出售</label>
                <span class="dmg-hint">0 = 不显示角标；勾「可出售」才能卖给商店</span>
              </div></div>
            <div class="cdes-row"><label>备注描述 <span class="row-tip">可选 · 点卡放大时展示</span></label>
              <textarea id="cardNote" rows="2" maxlength="200" placeholder="写给自己的备注：使用心得、combo 提示、来源纪念……（与效果描述分开，不影响战斗）">${esc(draft.note)}</textarea></div>
            <p class="dmg-hint">[[icon:lantern]] 保存后可在商店刷出、在战斗中实装；数据保存在本浏览器。</p>
          </div>
        </div>
      </div>`, 'page');
    updateDesignerPreview();
    bindDesignerTilt();
    UI._inputHandler = (e) => {
      if (e.target.id === 'cardName') draft.name = e.target.value;
      else if (e.target.id === 'cardDesc') {
        draft.desc = e.target.value;
        const cnt = document.getElementById('descCount');
        if (cnt) cnt.textContent = `${draft.desc.length}/100`;
        // 手动改动描述后同步机制按钮态（不重写 textarea，保持光标）
        const wrap = document.getElementById('mechChips');
        if (wrap) wrap.innerHTML = mechChipsHTML();
      }
      else if (e.target.id === 'cardDmg') draft.dmg = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardHeal') draft.heal = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardArmor') draft.armor = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardValue') draft.value = Math.max(0, Math.min(99, Math.floor(+e.target.value || 0)));
      else if (e.target.id === 'cardSellable') { draft.sellable = e.target.checked; return; }
      else if (e.target.id === 'cardNote') { draft.note = e.target.value; return; }
      else return;
      updateDesignerPreview();
    };
    UI.act('mech', (d) => {
      const item = MECH_ALL.find(it => it.k === d.k);
      if (!item) return;
      draft.desc = mechToggle(draft.desc, item);
      if (draft.desc.length > 100) { UI.log('描述超过 100 字上限，最后一条词条放不下了', 'warn'); mechSyncUI(); return; }
      Sfx.tick();
      mechSyncUI();
    });
    UI.act('closeDesigner', closeDesigner);
    UI.act('pickType', (d) => {
      draft.type = d.t;
      if (!DMG_TYPES.includes(d.t)) draft.dmg = 0;
      else if (!SDT.Cards.DMG_TYPE_META[draft.dmgType]) draft.dmgType = d.t === '法术' ? 'spell' : 'attack';
      Sfx.tick(); syncDesignerForm();
    });
    UI.act('pickDmgType', (d) => { draft.dmgType = d.dt; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickCost', (d) => { draft.cost = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickDraw', (d) => { draft.draw = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickInfuse', (d) => { draft.infuse = +d.v; Sfx.tick(); syncDesignerForm(); });
    UI.act('pickRar', (d) => { draft.rarity = d.r; Sfx.tick(); syncDesignerForm(); });
    UI.act('dmgAdj', (d) => { draft.dmg = Math.max(0, Math.min(99, draft.dmg + (+d.v))); syncDesignerForm(); });
    UI.act('valAdj', (d) => { draft.value = Math.max(0, Math.min(99, draft.value + (+d.v))); syncDesignerForm(); });
    UI.act('saveCard', saveDraftCard);
  }

  function syncDesignerForm() {
    document.querySelectorAll('#ovBody .type-seg [data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === draft.type));
    document.querySelectorAll('#ovBody [data-act="pickDmgType"]').forEach(b => b.classList.toggle('on', b.dataset.dt === draft.dmgType));
    document.querySelectorAll('#ovBody [data-act="pickCost"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.cost));
    document.querySelectorAll('#ovBody [data-act="pickDraw"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.draw));
    document.querySelectorAll('#ovBody [data-act="pickInfuse"]').forEach(b => b.classList.toggle('on', +b.dataset.v === draft.infuse));
    document.querySelectorAll('#ovBody [data-act="pickRar"]').forEach(b => b.classList.toggle('on', b.dataset.r === draft.rarity));
    const row = document.getElementById('rowDmg');
    if (row) row.hidden = !DMG_TYPES.includes(draft.type);
    const dmgInput = document.getElementById('cardDmg');
    if (dmgInput) dmgInput.value = draft.dmg;
    const healInput = document.getElementById('cardHeal');
    if (healInput) healInput.value = draft.heal;
    const armorInput = document.getElementById('cardArmor');
    if (armorInput) armorInput.value = draft.armor;
    const valRow = document.getElementById('rowValue');
    if (valRow) valRow.hidden = false;
    const valInput = document.getElementById('cardValue');
    if (valInput) valInput.value = draft.value;
    updateDesignerPreview();
  }

  function updateDesignerPreview() {
    const el = document.getElementById('cardPreview');
    if (!el) return;
    el.innerHTML = cardHTML({ ...draft, name: draft.name.trim(), _preview: true }, 'xl');
  }

  function bindDesignerTilt() {
    // 老板留言 #50：预览卡倾斜动画已关闭，保留空函数避免调用点报错
  }

  function saveDraftCard() {
    if (!CARD_DESIGNER_WRITES_ENABLED) return;
    if (!draft.name.trim()) { UI.log('卡牌名称不能为空', 'warn'); return; }
    const wasEditing = !!editingCard;
    const card = SDT.Cards.upsert({
      id: draft.id || undefined,
      name: draft.name.trim(),
      cost: draft.cost,
      rarity: draft.rarity,
      type: draft.type,
      dmg: DMG_TYPES.includes(draft.type) ? draft.dmg : 0,
      dmgType: DMG_TYPES.includes(draft.type) && draft.dmg > 0 ? draft.dmgType : undefined,
      draw: draft.draw > 0 ? draft.draw : undefined,      // 抽卡词条（0 = 不带词条）
      infuse: draft.infuse > 0 ? draft.infuse : undefined, // 注能词条（0 = 不带词条）
      heal: draft.heal > 0 ? draft.heal : undefined,       // 回复词条（0 = 不带词条）
      armor: draft.armor > 0 ? draft.armor : undefined,    // 护甲词条（0 = 不带词条）
      desc: draft.desc.trim(),
      value: draft.value,
      sellable: draft.sellable === true,  // 显式记录出售资格（缺省 false = 默认不可出售）
    });
    if (draft.cls) card.cls = draft.cls;         // 身份字段回写（见 openCardDesigner 草稿注释）
    if (draft.hero) card.hero = true;
    if (draft.tokenOf) card.tokenOf = draft.tokenOf;
    if (draft.unrandom) card.unrandom = true;
    // #29 备注描述：有内容写入、清空则摘除字段。upsert 内部已 saveAll，
    // 这些 upsert 之后的字段补写必须再显式落盘一次，否则关页面即丢
    if (draft.note.trim()) card.note = draft.note.trim();
    else delete card.note;
    SDT.Cards.saveAll(SDT.Cards.all());
    lastSavedId = card.id;
    Sfx.ding();
    UI.log(`[[icon:cards]] 卡牌【<b>${esc(card.name)}</b>】已${wasEditing ? '更新' : '收入照相馆'}`, 'ok');
    if (designerReturnLib) renderCardLibrary();
    else closeLibPage();
  }

  function closeDesigner() {
    if (designerReturnLib) renderCardLibrary();
    else closeLibPage();
  }

  // Esc / 点击页面外深色背景 → 关闭大页面（制作坊先回库 / 基地 / 出征整备回基地）
  function closeCardPageTop() {
    if (document.getElementById('cdesStage')) closeDesigner();
    else if (document.getElementById('depMain')) { navigation.resetDeployPick(); navigation.renderHub(); }
    else if (document.getElementById('hubMain')) navigation.closeBase();
    else closeLibPage();
  }

  function showCardsExportOverlay() {
    cardPageOpen = false;
    const json = JSON.stringify({ game: 'sdt', format: 'cards', version: 2, cards: SDT.Cards.all() }, null, 2);
    UI.showOverlay('[[icon:upload]] 导出卡牌', `
      <p class="ov-note">把下面的 JSON 发给开发者/AI，即可把卡牌接入战斗系统。</p>
      <textarea id="ovExport" class="ov-textarea" readonly>${esc(json)}</textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="copyCards">复制到剪贴板</button>
        <button class="ov-btn" data-act="downloadCards">下载文件</button>
        <button class="ov-btn" data-act="backLib">← 返回照相馆</button>
      </div>`);
    UI.act('copyCards', async () => {
      try { await navigator.clipboard.writeText(json); UI.log('卡牌 JSON 已复制', 'ok'); }
      catch (e) { UI.log('复制失败，请手动全选复制', 'warn'); }
    });
    UI.act('downloadCards', () => {
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'sdt-cards.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    UI.act('backLib', () => openCardLibrary());
  }

  function showCardsImportOverlay() {
    if (!CARD_DESIGNER_WRITES_ENABLED) { openCardLibrary(); return; }
    cardPageOpen = false;
    UI.showOverlay('[[icon:download]] 导入卡牌', `
      <p class="ov-note">粘贴卡牌 JSON（按 id 合并覆盖）。</p>
      <textarea id="ovImport" class="ov-textarea" placeholder='{"game":"sdt","cards":[…]}'></textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doImportCards">导入</button>
        <button class="ov-btn" data-act="backLib2">取消</button>
      </div>`);
    UI.act('doImportCards', () => {
      if (!CARD_DESIGNER_WRITES_ENABLED) return;
      const ta = document.getElementById('ovImport');
      try {
        const parsed = JSON.parse(ta.value);
        const cards = Array.isArray(parsed) ? parsed : parsed.cards;
        if (!Array.isArray(cards)) throw new Error('缺少 cards 数组');
        for (const c of cards) {
          if (!c.name) continue;
          SDT.Cards.upsert({
            id: c.id, name: String(c.name).slice(0, 12),
            cost: [0, 1, 2, 3, 4, 5].includes(+c.cost) ? +c.cost : 1,
            rarity: RARITIES.includes(c.rarity) ? c.rarity : '古朴',
            type: TYPES.includes(c.type) ? c.type : '武术',
            dmg: Math.max(0, Math.min(99, +c.dmg || 0)),
            dmgType: SDT.Cards.DMG_TYPE_META[c.dmgType] ? c.dmgType : undefined,
            draw: Math.max(0, Math.min(99, +c.draw || 0)) || undefined,
            infuse: Math.max(0, Math.min(99, +c.infuse || 0)) || undefined,
            heal: Math.max(0, Math.min(99, +c.heal || 0)) || undefined,
            armor: Math.max(0, Math.min(99, +c.armor || 0)) || undefined,
            desc: String(c.desc || '').slice(0, 100),
            value: Math.max(0, Math.min(99, +c.value || 0)),
            sellable: typeof c.sellable === 'boolean' ? c.sellable : undefined,
          });
        }
        UI.log('卡牌导入完成', 'ok');
        openCardLibrary();
      } catch (err) { UI.log('导入失败：' + err.message, 'warn'); }
    });
    UI.act('backLib2', () => openCardLibrary());
  }

  // ---------- 输入 ----------

export { Sfx, cardHTML, cardPageOpen, closeCardPageTop, configureCardNavigation, openCardDesigner, openCardLibrary };
const _set_cardPageOpen = (v) => { cardPageOpen = v; };
export { _set_cardPageOpen };
