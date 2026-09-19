/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
import { esc } from './shared.js';
import { escAttr } from './shared.js';
import { game } from './game.session.js';
import { characterName } from './characters.js';
import { PHOTO_NOTE_PLACEHOLDER, photoNoteFor, savePhotoNote } from './card-photo-notes.js';

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
  // 视觉仍是连续照片墙，不拆成分页页面；DOM 以 48 张为一批渐进追加，避免打开时
  // 同步创建整库卡牌结构。用户滚到陈列末尾时会自动接上下一批。
  function openCardLibrary() {
    if (game.state !== 'idle' && game.state !== 'modal' && game.state !== 'title') return;
    if (game.state !== 'modal') cardPagePrevState = game.state;   // 记录来源（idle/title），关闭时还原
    game.state = 'modal';
    renderCardLibrary();
  }

  // 过滤+排序结果缓存（用空间换时间）：筛选条件与卡库规模不变时直接复用，
  // 翻页/重绘不再重复全量 sort。renderCardLibrary 重新取 libCards 时失效。
  let _libFilteredCache = null, _libFilteredKey = '';
  function libFiltered() {
    const key = `${libFilter.tab}|${libFilter.rar}|${libFilter.cls}|${libFilter.q}|${libFilter.sort}|${libCards.length}`;
    if (_libFilteredCache && key === _libFilteredKey) return _libFilteredCache;
    const q = libFilter.q.trim().toLowerCase();
    _libFilteredCache = libCards.filter(c =>
      (libFilter.tab === '全部' || c.type === libFilter.tab) &&
      // 稀有度按有效稀有度筛选（2026-09-04 定版：棱彩已实装进卡牌库——能力卡与其衍生牌 rarityOf 推导为「棱彩」，可经下拉筛选）
      (libFilter.rar === '全部' || SDT.Cards.rarityOf(c) === libFilter.rar) &&
      (libFilter.cls === '全部' || (libFilter.cls === '通用' ? !c.cls : c.cls === libFilter.cls)) &&
      (!q || (c.name || '').toLowerCase().includes(q) || (c.desc || '').toLowerCase().includes(q))
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
  // 桌面每行六张，一批四行；既保留连续照片墙，也避免首开同时解码过多缩略图。
  const LIB_BATCH_SIZE = 24;
  let libVisibleCount = LIB_BATCH_SIZE;
  let libPageObserver = null;
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
    // 影廊版实体感：每张卡带收窄的悬挂微倾与轻 3D 侧倾（幅度比旧版减半），落影
    // 角度/虚实随卡不同；差异按卡牌 id 稳定生成，筛选重绘不跳位。
    return [
      `--i:${index}`,
      `--photo-tilt:${between(11, -.15, .15).toFixed(2)}deg`,
      `--photo-shadow-x:${between(23, -3, 3).toFixed(1)}px`,
      `--photo-shadow-y:${between(37, 14, 22).toFixed(1)}px`,
      `--photo-shadow-blur:${between(41, 24, 34).toFixed(1)}px`,
      `--photo-lean-x:${between(89, -.3, .3).toFixed(2)}deg`,
      `--photo-lean-y:${between(97, -.3, .3).toFixed(2)}deg`,
    ].join(';');
  }

  function libPreviewHTML(c) {
    if (!c) return '<div class="studio-preview-empty"><div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">没有符合条件的卡牌<br>调整筛选后重新陈列</p></div>';
    const dmgTxt = DMG_TYPES.includes(c.type) ? `<br>伤害词条：<b class="dmg-num">${c.dmg || 0}</b>${c.dmgType ? ' · ' + (SDT.Cards.DMG_TYPE_META[c.dmgType] || {}).name : ''}` : '';
    const drawN = +(c.draw || 0) || SDT.Cards.deriveDraw(c);
    const infN = +(c.infuse || 0) || SDT.Cards.deriveInfuse(c);
    const healN = +(c.heal || 0) || SDT.Cards.deriveHeal(c);
    const armorN = +(c.armor || 0) || SDT.Cards.deriveArmor(c);
    const kw = [drawN ? `抽卡 ${drawN}` : '', infN ? `注能(${infN})` : '',
      healN ? `回复 ${healN}` : '', armorN ? `护甲 ${armorN}` : ''].filter(Boolean).join(' · ');
    const kwTxt = kw ? `<br>效果词条：<b>${kw}</b>` : '';
    const actions = game.devMode && libEditMode ? `<div class="studio-edit-actions">
      <button class="hs-btn" data-act="editCard" data-id="${escAttr(c.id)}">编辑卡牌</button>
      <button class="hs-btn danger" data-act="delCard" data-id="${escAttr(c.id)}">删除</button>
    </div>` : '';
    return `<div class="studio-preview-frame">${cardHTML(c, 'lg', LIB_ART)}</div>
      <div class="studio-preview-copy"><h3>${esc(c.name)}</h3>
      <p class="pv-hint">${esc(c.type)} · ${esc(SDT.Cards.rarityOf(c))}${dmgTxt}${kwTxt}</p>
      <button class="studio-zoom" data-act="libInspect" data-card="${escAttr(c.id)}">查看大图与背签</button>${actions}</div>`;
  }

  function libActiveFiltersHTML() {
    const filters = [
      libFilter.tab !== '全部' ? ['tab', libFilter.tab] : null,
      libFilter.rar !== '全部' ? ['rar', libFilter.rar] : null,
      libFilter.cls !== '全部' ? ['cls', libFilter.cls === '通用' ? '通用' : characterName(libFilter.cls)] : null,
      libFilter.q.trim() ? ['q', `“${libFilter.q.trim()}”`] : null,
    ].filter(Boolean);
    if (!filters.length) return '';
    return `<span>当前筛选</span>${filters.map(([key, label]) => `<button data-act="libRemoveFilter" data-filter="${key}" title="移除筛选：${escAttr(label)}">${esc(label)} ×</button>`).join('')}`;
  }

  function photoTileHTML(c, index) {
    const rarity = SDT.Cards.rarityOf(c);
    const rarityIndex = Math.max(0, RARITIES.indexOf(rarity));
    const art = (SDT.Art && SDT.Art.cardIcon && SDT.Art.cardIcon(c, LIB_ART)) ||
      SDT.Icons.img(SDT.Cards.TYPE_ART[c.type] || 'question');
    const cost = c.cost == null ? 0 : c.cost;
    return `<div class="lib-item${c.id === lastSavedId ? ' saved' : ''}${c.id === libSelectedId ? ' selected' : ''}" data-i="${index}" style="${photoStyle(c, index)}">
      <button type="button" class="lib-cardwrap studio-photo rv${rarityIndex}" data-act="libInspect" data-card="${escAttr(c.id)}" aria-label="查看照片：${escAttr(c.name || '未命名卡牌')}" aria-current="${c.id === libSelectedId ? 'true' : 'false'}" title="查看大图与照片背签">
        <span class="studio-photo-paper">
          <span class="studio-photo-art">${art}</span>
          <span class="studio-photo-cost" aria-label="费用 ${escAttr(cost)}">${esc(cost)}</span>
          <span class="studio-photo-caption"><b>${esc(c.name || '未命名卡牌')}</b><small class="studio-photo-marks"><span class="photo-type-mark">${esc(c.type || '?')}</span><span class="photo-rarity-mark">${esc(rarity)}</span></small></span>
        </span>
      </button>
    </div>`;
  }

  function libGridContentsHTML(all = libFiltered()) {
    if (!all.length) {
      const filtered = libCards.length > 0 &&
        (libFilter.tab !== '全部' || libFilter.rar !== '全部' || libFilter.cls !== '全部' || libFilter.q.trim() !== '');
      return `<div class="clib-empty"><div class="clib-empty-icon">[[icon:archive]]</div>
        <p>${libCards.length ? '没有符合筛选条件的卡牌' : (game.devMode ? '收藏还是空的，点右上角「＋ 制作新卡」开始设计' : '当前没有可展示的卡牌')}</p>
        ${filtered ? '<button class="hs-btn sm" data-act="libClearFilter">清除筛选条件</button>' : ''}</div>`;
    }
    const visible = all.slice(0, libVisibleCount);
    const remaining = all.length - visible.length;
    return visible.map(photoTileHTML).join('') + (remaining > 0
      ? `<button type="button" class="studio-load-more" data-act="libLoadMore">继续陈列 <b>${Math.min(LIB_BATCH_SIZE, remaining)}</b> 张</button>`
      : '');
  }

  function libGridHTML() {
    const all = libFiltered();
    return `<div class="lib-grid${all.length ? '' : ' is-empty'}" id="libGrid">${libGridContentsHTML(all)}</div>`;
  }

  let libCardById = new Map();
  let libCardNodeById = new Map();
  function setLibSelection(id, playSound = false) {
    const card = libCardById.get(id) || null;
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
    if (preview) {
      preview.innerHTML = libPreviewHTML(card);
      preview.classList.toggle('has-preview', !!card);
    }
    if (playSound && card) Sfx.tick();
  }

  // 滚动静默窗（滚动期间禁 hover 预览，见 renderCardLibrary 的 mouseover 段）：
  // renderLibGrid 会整块换掉 #libGrid 节点，监听器必须跟着新节点重绑，否则第一次
  // 改筛选条件后滚动静默就永久失效，滚动中重新出现 hover 预览重建风暴。
  let libScrollTimer = null;
  function bindLibGridScroll() {
    const grid = document.getElementById('libGrid');
    if (!grid) return;
    libCardNodeById = new Map([...grid.querySelectorAll('.lib-cardwrap[data-card]')]
      .map(node => [node.dataset.card, node]));
    if (grid.dataset.bound === '1') return;
    grid.dataset.bound = '1';
    grid.addEventListener('scroll', () => {
      grid.classList.add('scrolling');
      if (libScrollTimer) clearTimeout(libScrollTimer);
      libScrollTimer = setTimeout(() => grid.classList.remove('scrolling'), 160);
    }, { passive: true });
    grid.addEventListener('focusin', (e) => {
      const card = e.target.closest && e.target.closest('.lib-cardwrap[data-card]');
      if (card) setLibSelection(card.dataset.card);
    });
    grid.addEventListener('keydown', (e) => {
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
      const cards = [...grid.querySelectorAll('.lib-cardwrap[data-card]')];
      const current = e.target.closest && e.target.closest('.lib-cardwrap[data-card]');
      const index = cards.indexOf(current);
      if (index < 0) return;
      const cols = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(' ').length);
      const delta = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' ? -cols : cols;
      const next = cards[index + delta];
      if (next) { e.preventDefault(); next.focus(); }
    });
  }

  // 卡面缩略图预解码：启动时的全量预热清单补的是 assets/ 原图，库页显示的是
  // assets/thumbs/ 缩略图，不补这一步首轮滚动就得边滚边解码（实测首轮滚动
  // 32~35fps → 44~45fps，>50ms 长帧减半）。解码在解码线程，不占主线程。
  let libArtObserver = null;
  let libArtRoot = null;
  function decodeLibImage(image) {
    image.loading = 'eager';
    try { image.decode?.()?.catch?.(() => {}); } catch (_) {}
  }

  function warmLibArt() {
    const grid = document.getElementById('libGrid');
    if (!grid) return;
    // 同一个网格渐进追加时复用 observer；只有整页重建、根节点变化才重新创建。
    if (libArtRoot !== grid) {
      libArtObserver?.disconnect();
      libArtObserver = null;
      libArtRoot = grid;
    }
    const images = [...grid.querySelectorAll('.studio-photo-art img[src]:not([data-lib-warm])')];
    images.forEach(image => { image.dataset.libWarm = '1'; });
    // 旧逻辑会把整页 245 张图全部改成 eager 并解码，直接抵消 loading=lazy。
    // 现在只提前准备视口上下约两屏；滚动接近时再异步解码，峰值内存随可见卡数走。
    if (typeof IntersectionObserver !== 'function') {
      images.slice(0, 18).forEach(decodeLibImage);
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

  function bindLibPagination() {
    libPageObserver?.disconnect();
    libPageObserver = null;
    const grid = document.getElementById('libGrid');
    const more = grid?.querySelector('.studio-load-more');
    if (!grid || !more || typeof IntersectionObserver !== 'function') return;
    libPageObserver = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) loadMoreLibCards();
    }, { root: grid, rootMargin: '70% 0px' });
    libPageObserver.observe(more);
  }

  function loadMoreLibCards() {
    const all = libFiltered();
    if (libVisibleCount >= all.length) return;
    const grid = document.getElementById('libGrid');
    if (!grid) return;
    const start = libVisibleCount;
    libVisibleCount = Math.min(all.length, start + LIB_BATCH_SIZE);
    const more = grid.querySelector('.studio-load-more');
    const added = all.slice(start, libVisibleCount)
      .map((card, offset) => photoTileHTML(card, start + offset)).join('');
    if (more) more.insertAdjacentHTML('beforebegin', added);
    else grid.insertAdjacentHTML('beforeend', added);
    const remaining = all.length - libVisibleCount;
    if (more) {
      if (remaining > 0) more.innerHTML = `继续陈列 <b>${Math.min(LIB_BATCH_SIZE, remaining)}</b> 张`;
      else more.remove();
    }
    bindLibGridScroll();
    warmLibArt();
    bindLibPagination();
  }

  // 筛选后只重绘卡格区（整页 showOverlay 会重置搜索焦点、重挂全部事件）
  function renderLibGrid() {
    const filtered = libFiltered();
    const n = filtered.length;
    libVisibleCount = LIB_BATCH_SIZE;
    if (!filtered.some(c => c.id === libSelectedId)) libSelectedId = filtered[0]?.id || null;
    const resultCount = document.getElementById('libResultCount');
    if (resultCount) {
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
      grid.innerHTML = libGridContentsHTML(filtered);
      grid.scrollTop = 0;
      bindLibGridScroll();
    }
    const active = document.getElementById('libActiveFilters');
    if (active) active.innerHTML = libActiveFiltersHTML();
    setLibSelection(libSelectedId);
    warmLibArt();
    bindLibPagination();
  }

  // 侧栏筛选控件同步到当前 libFilter（局部重绘时不重建侧栏，得手动回写控件状态）
  function syncLibFilterUI() {
    const q = document.getElementById('cardSearch'); if (q) q.value = libFilter.q;
    const rar = document.getElementById('libRar'); if (rar) rar.value = libFilter.rar;
    const cls = document.getElementById('libCls'); if (cls) cls.value = libFilter.cls;
    const sort = document.getElementById('libSort'); if (sort) sort.value = libFilter.sort;
    document.querySelectorAll('.clib-tabs .type-tab').forEach(b => b.classList.toggle('on', b.dataset.t === libFilter.tab));
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
    cardPageOpen = true;
    // 牌库页去动画开关（2026-09-08 老板拍板）：期间禁全部动画/过渡/流光/hover 特效，
    // CSS 侧规则见 cards.css 的 body.cardlib-open 段
    document.body.classList.add('cardlib-open');
    // 员工通行证A是碎片合成材料（特殊收藏品），不进卡牌库（2026-09-16 留言「在卡牌库中删除员工通行证a」）
    libCards = SDT.Cards.all().filter(c => c.id !== 'tt-token-color');
    libCardById = new Map(libCards.map(card => [card.id, card]));
    // 库内容刷新即失效筛选缓存：防止卡牌增删/改卡后命中旧缓存
    // （旧缓存键只含 libCards.length，同张数的内容变化会读到陈旧列表）
    _libFilteredCache = null;
    _libFilteredKey = '';
    libVisibleCount = LIB_BATCH_SIZE;
    const counts = {};
    libCards.forEach(c => { counts[c.type] = (counts[c.type] || 0) + 1; });
    const tabs = ['全部'].concat(TYPES).map(t =>
      `<button class="type-tab${libFilter.tab === t ? ' on' : ''}" data-act="libTab" data-t="${t}">
        <i>${SDT.Icons.img(t === '全部' ? 'archive' : (SDT.Cards.TYPE_ART[t] || 'question'))}</i>${t}<em>${t === '全部' ? libCards.length : (counts[t] || 0)}</em>
      </button>`).join('');
    const editorTools = game.devMode ? `<button class="hs-btn studio-edit-toggle${libEditMode ? ' on' : ''}" data-act="libEditMode" aria-pressed="${libEditMode}">${libEditMode ? '退出编辑' : '编辑模式'}</button>${libEditMode ? '<button class="hs-btn gold" data-act="newCard">＋ 制作新卡</button><button class="hs-btn" data-act="exportCards">[[icon:upload]] 导出</button><button class="hs-btn" data-act="importCards">[[icon:download]] 导入</button>' : ''}` : '';
    const first = libFiltered()[0] || null;
    if (!libSelectedId || !libFiltered().some(c => c.id === libSelectedId)) libSelectedId = first?.id || null;
    const selectedPreview = libCards.find(c => c.id === libSelectedId) || first;
    UI.showOverlay('', `
      <div class="pg card-library-page photo-studio-v3${libEditMode ? ' edit-mode' : ''}">
        <header class="pg-head library-head">
          <div class="library-title"><span class="library-kicker">WINTER PHOTO STUDIO // 07</span><h2>[[icon:cards]] 照相馆</h2></div>
          <span class="clib-count"><small>馆藏</small><b>${libCards.length}</b><i></i><small>当前陈列</small><b id="libResultCount">${libFiltered().length}</b></span>
          <button class="pg-close" data-act="closeCardPage" title="关闭（Esc）">[[icon:cross]]</button>
          <div class="library-tools"><label class="studio-search"><input id="cardSearch" class="clib-search" aria-label="搜索卡牌" placeholder="搜索卡名或效果…" value="${escAttr(libFilter.q)}"></label><select id="libSort" class="pg-select" title="排序"><option value="rarity"${libFilter.sort === 'rarity' ? ' selected' : ''}>按稀有度陈列</option><option value="cost"${libFilter.sort === 'cost' ? ' selected' : ''}>按费用排序</option><option value="name"${libFilter.sort === 'name' ? ' selected' : ''}>按名称排序</option></select>${editorTools}</div>
        </header>
        <section class="studio-filterbar" aria-label="卡牌类型筛选">
          <div class="clib-tabs">${tabs}</div>
          <details class="library-advanced"${libFilter.rar !== '全部' || libFilter.cls !== '全部' ? ' open' : ''}><summary>高级筛选</summary><div><select id="libRar" class="pg-select library-select" title="按稀有度筛选"><option value="全部">全部稀有度</option>${RARITIES.map(r => `<option value="${r}"${libFilter.rar === r ? ' selected' : ''}>${r}</option>`).join('')}</select><select id="libCls" class="pg-select library-select" title="按职业筛选"><option value="全部">全部人物</option><option value="通用"${libFilter.cls === '通用' ? ' selected' : ''}>通用</option>${[...new Set(libCards.map(c => c.cls).filter(Boolean))].sort().map(c => `<option value="${escAttr(c)}"${libFilter.cls === c ? ' selected' : ''}>${esc(characterName(c))}</option>`).join('')}</select></div></details>
          <button class="studio-clear" data-act="libClearFilter">清空筛选</button>
        </section>
        <div class="studio-active-filters" id="libActiveFilters">${libActiveFiltersHTML()}</div>
        <div class="clib-main">
          ${libGridHTML()}
          <aside class="library-inspector" aria-label="选中卡牌详情"><div class="studio-inspector-head"><b>选片台</b></div><div class="library-preview${selectedPreview ? ' has-preview' : ''}" id="libPreview" aria-live="polite">${libPreviewHTML(selectedPreview)}</div></aside>
        </div>
      </div>`, 'page');
    lastSavedId = null;
    warmLibArt();
    // 注意：lastPreviewId 在下方悬停处理段声明（函数内 let），此处不可提前赋值——
    // 昨晚"悬停去重"改动曾在此赋值触发 TDZ ReferenceError，导致后续全部 UI.act
    // 注册被跳过，卡牌库整页按钮（含右上关闭钮）无响应（老板留言：退出点不动）。
    UI.act('closeCardPage', closeLibPage);
    UI.act('newCard', () => openCardDesigner(null));
    UI.act('libLoadMore', loadMoreLibCards);
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
    UI.act('editCard', (d) => {
      const card = SDT.Cards.all().find(c => c.id === (d.card || d.id));
      if (card) openCardDesigner(card);
    });
    UI.act('libInspect', (d) => {
      const card = libCards.find(c => c.id === d.card);
      // from=被点的卡面元素：特写从原位放大（FLIP），而非中央淡入
      if (card) UI.showCardZoom(card, {
        from: document.querySelector(`#libGrid .lib-cardwrap[data-card="${d.card}"]`),
        note: photoNoteFor(card),
        noteLabel: '照片背签',
        noteEditable: true,
        notePlaceholder: PHOTO_NOTE_PLACEHOLDER,
        onNoteSave: value => savePhotoNote(card, value),
      });
    });
    UI.act('delCard', (d) => {
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
    UI.act('importCards', () => showCardsImportOverlay());
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
    // 2026-09-07 留言（滑动依然有点卡）：滚动期间整段禁掉 hover——Chromium 滚动
    // 会重算 hover 目标触发 mouseover 风暴（含卡面 :hover 缩放的层级切换），
    // 给网格挂 .scrolling 类，滚动静默 160ms 后恢复。
    let lastPreviewId = null;
    let previewTimer = null;
    bindLibGridScroll();
    UI._hoverHandler = (e) => {
      // 取活的 #libGrid：改筛选会整块换掉节点，闭包里捕获的旧节点永远是「没在滚」，
      // 滚动静默窗会失效（旧写法遗留）
      const liveGrid = document.getElementById('libGrid');
      if (liveGrid && liveGrid.classList.contains('scrolling')) return;
      const w = e.target.closest ? e.target.closest('[data-card]') : null;
      const id = w ? w.dataset.card : null;
      if (id === lastPreviewId) return;
      lastPreviewId = id;
      if (previewTimer) clearTimeout(previewTimer);
      if (!id) return;   // 移出卡面：保留当前预览不动
      previewTimer = setTimeout(() => {
        previewTimer = null;
        const card = libCards.find(c => c.id === id);
        if (card) setLibSelection(card.id, true);
      }, 90);
    };
    const page = document.querySelector('.card-library-page');
    if (page) page.addEventListener('keydown', (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(e.target.tagName)) return;
      e.preventDefault(); document.getElementById('cardSearch')?.focus();
    });
    UI.refresh(game);
  }

  function closeLibPage() {
    cardPageOpen = false;
    clearTimeout(libSearchTimer);
    libSearchTimer = null;
    libArtObserver?.disconnect();
    libArtObserver = null;
    libArtRoot = null;
    libPageObserver?.disconnect();
    libPageObserver = null;
    libCardNodeById.clear();
    document.body.classList.remove('cardlib-open');
    UI.hideOverlay();
    game.state = cardPagePrevState || 'idle';   // 从标题界面打开则回到标题，其余维持原 'idle' 行为
    cardPagePrevState = null;
    UI.refresh(game);
  }

  // ======== 卡牌制作坊 ========
  function openCardDesigner(card) {
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
    cardPageOpen = false;
    UI.showOverlay('[[icon:download]] 导入卡牌', `
      <p class="ov-note">粘贴卡牌 JSON（按 id 合并覆盖）。</p>
      <textarea id="ovImport" class="ov-textarea" placeholder='{"game":"sdt","cards":[…]}'></textarea>
      <div class="ov-btns">
        <button class="ov-btn ok" data-act="doImportCards">导入</button>
        <button class="ov-btn" data-act="backLib2">取消</button>
      </div>`);
    UI.act('doImportCards', () => {
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
