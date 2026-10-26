/* 选角叶页面：仅由 class-choice 轻门面在用户请求时装载，共用 session / Base 单例。 */
import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
import { esc, escAttr } from '../core/shared.js';
import { MAP, game, getActiveSlot, exitToTitle, saveGame } from './game.session.js';
import { slamSkillFor } from '../battle/bag/battle.slam-skill.js';
import { createEntrySupply } from './node-reward-state.js';
import { createCharacterViewMotion } from '../ui/character-view-motion.js';
import { linkedBackHTML } from '../ui/home-linked-interactions.js';
import { captureOverlayReturnState, restoreOverlayReturnState } from '../ui/overlay-return-state.js';
import { Sfx } from '../hub/game.cardslib.js';
import { captureBattleContext, ensureBattleReady } from '../battle/battle-loader.js';
import { preloadAllNodeShellBgs, showRunTransition } from './game.run.scenes.js';
import { syncViewChildren } from '../ui/view-children-sync.js';
import { saveRunCheckpoint } from '../core/run-checkpoint.js';
import { createOperationNotice } from '../ui/operation-notice.js';
import { holdHubOperationControls } from '../hub/hub.presentation.js';

// 选人页机制简介（2026-09-12 留言：按各职业卡池真实机制写，键 = characters.js 的 id）
const CLASS_STORY = {
  wu: '擅长物理攻击，可以潜行，精通流血与连击。',
  changwuyu: '以法术伤害为核心，精通用火球与诅咒压制敌人。',
  baita: '精通奥术法术，擅长发现新法术与召唤帮手。',
  heixiang: '正面硬扛的战士，擅长叠护甲与施加流血。',
  xingyue: '擅长治疗与圣盾，用圣光法术守护自己。',
};
export function openClassChoice(options = {}) {
  const SDT = window.SDT;
  const UI = SDT.UI;
  const characterMotion = createCharacterViewMotion({ isCurrent:() => visible() });
  const choiceContext = captureBattleContext(game, getActiveSlot);
  const originalClass = game.myClass;
  let choiceRoot = null;
  const current = () => choiceContext() && game.myClass === originalClass && (!options.isCurrent || options.isCurrent());
  const choiceVisible = () => choiceRoot?.isConnected && !document.getElementById('overlay')?.hidden &&
    !document.getElementById('overlay')?.classList.contains('closing') &&
    document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page') === choiceRoot;
  const visible = () => current() && choiceVisible();
  const act = (name, handler) => UI.act(name, data => {
    if (!visible() || name !== 'pickClass' && (confirmationStarted || confirmationPending || selectionPending)) return false;
    return handler(data);
  });
  const onCancel = typeof options.onCancel === 'function' ? options.onCancel : null;
  const onSelect = typeof options.onSelect === 'function' ? options.onSelect : null;
  const confirmLabel = onSelect ? '下一步：选择卡牌' : '出发';
  const beforeConfirm = typeof options.beforeConfirm === 'function' ? options.beforeConfirm : null;
  preloadAllNodeShellBgs();   // 只补首轮高频节点；其余场景在确认路线时按目标格预取
  // 玩家停留选角页时后台准备战斗域；不占标题首屏预算，又能让首场遭遇直接进入。
  const warmBattleRuntime = () => visible() && ensureBattleReady().catch(error => console.warn('[battle-loader] 选角页后台预取失败', error));
  if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(warmBattleRuntime, { priority: 'background' }).catch(() => {});
  else if (typeof requestIdleCallback === 'function') requestIdleCallback(warmBattleRuntime, { timeout: 3000 });
  else setTimeout(warmBattleRuntime, 500);
  const picks = CHARACTERS.map(c => c.rulesetId).filter(cl => SDT.Cards.classPool(cl).length);
  if (!picks.length) return false;
  game.state = 'modal';
  // 只把合法的已有角色作为初始选择；没有旧选择时同步选中第一名角色，
  // 避免舞台已经显示角色但提交值仍为空（预览与实际状态分离的误导）。
  const previous = characterFor(options.initialCharacter || game.characterId || game.myClass);
  let sel = previous && picks.includes(previous.rulesetId) ? previous.rulesetId : picks[0];
  let confirmationStarted = false;
  let confirmationPending = false;
  let selectionPending = false;
  let entryPresented = false;
  let confirmation = null;
  let departurePending = null;
  let selectionGeneration = 0;
  const confirmationNotice = createOperationNotice();
  let view = 'select'; // 'select' 主选角页 | 'pool' 二级卡池页
  const poolCount = cl => SDT.Cards.classPool(cl).length;
  // 主选角页（2026-09-06 留言重做，排版参考杀戮尖塔 2 选人界面）：
  // 选中角色大幅立绘居右撑满，左侧信息面板（名字/职业/熟练度），
  // 底部全角色头像条，左下角红色返回键、右下角大确认键；卡池收进二级页
  const render = (local = false, direction = 1) => {
    if (view === 'pool') return renderPool();
    const displaySel = sel || picks[0];
    const story = characterFor(displaySel);
    const lv = displaySel ? SDT.Meta.classLv(displaySel) : 0;
    // 熟练度进度（真实存档数据）：xp / 升级所需，满级显示 MAX
    const xp = displaySel ? SDT.Meta.classXP(displaySel) : 0;
    const maxed = !!displaySel && lv >= SDT.Meta.LEVEL_MAX;
    const need = maxed ? 0 : (lv ? SDT.Meta.xpForNext(lv) : 0);
    const clsPct = maxed ? 100 : need ? Math.min(100, Math.round(xp / need * 100)) : 0;
    const mechanisms = {
      wu: ['物理进攻', '潜行 · 流血 · 连击'],
      changwuyu: ['法术压制', '火球 · 诅咒'],
      baita: ['奥术施法', '发现法术 · 召唤'],
      heixiang: ['正面防线', '护甲 · 流血'],
      xingyue: ['治疗护持', '治疗 · 圣盾 · 圣光'],
    };
    const mechanism = mechanisms[story?.id];
    const skill = slamSkillFor(displaySel);
    const petHp = SDT.Base?.carriedPet?.()?.effect?.maxHp || 0;
    const hp = Number.isFinite(MAP.rules.playerMaxHp) ? MAP.rules.playerMaxHp + petHp + Math.max(0, lv - 1) : '—';
    const roster = picks.map(cl => ({ cl, c: characterFor(cl) }));
    const content = `
      <div class="pg cls2-page roster-reference" data-base-departure="${!!onCancel}">
        ${onSelect ? '<nav class="camp-steps" aria-label="出征步骤"><button data-act="cls2Quit">01 模式</button><b aria-current="step">02 人物</b><button data-act="pickClass">03 整备</button></nav>' : ''}
        <div class="cls2-stage">
          ${displaySel ? `<div class="cls2-fullart" data-character="${escAttr(story?.id || '')}" data-skin="${escAttr(SDT.Art.getSkin?.(displaySel) || 'default')}"><div class="roster-art-surface">${SDT.Art.classFullArt(displaySel)}</div></div>` : ''}
          <aside class="cls2-panel" style="--cls-color:${story ? story.color : '#69aec2'}" data-wm="${escAttr(story ? story.id : '')}">
            ${story ? `
              <div class="cls2-nameline">
                <h2 class="cls2-name">${esc(story.name)}</h2>
              </div>
              <section class="cls2-mechanism"><p class="cls2-stats">生命上限 <b>${hp}</b> · 基础攻击 <b>${MAP.rules.playerAtk ?? '—'}</b></p><b>${esc(mechanism?.[0] || story.rulesetId)}</b><p>${esc(mechanism?.[1] || '查看完整人物卡池')}</p><p class="cls2-skill"><b>${esc(skill.name)}</b> · 每回合一次<br>${esc(skill.hint)}</p></section>
              <details class="cls2-growth"><summary>熟练成长 · Lv.${lv}</summary><div class="cls2-level">
                <div class="cls2-level-num"><i>LV</i>${lv}</div>
                <div class="cls2-level-meta">
                  <div class="cls2-xpbar"><span style="width:${clsPct}%"></span></div>
                  <div class="cls2-xptext">${maxed ? '熟练度已满级 MAX' : `${xp} / ${need} XP`}</div>
                  <div class="cls2-perk">[[icon:medal]] 出征加成 ${esc(SDT.Meta.perkText(lv))}</div>
                </div>
              </div>
              </details>
              ${!mechanism ? `<p class="cls2-story">${esc(CLASS_STORY[story.id] || '确认后以此人物进入远征，熟练度加成与职业卡将在确认时生效。')}</p>` : ''}
              ${(SDT.Art.listSkins ? SDT.Art.listSkins(displaySel) : []).length ? `
                <div class="cls2-skins-wrap">
                  <div class="cls2-sub">皮肤 </div>
                  <div class="cls2-skins">
                    ${[{ id:'default', name:'标准' }, ...SDT.Art.listSkins(displaySel)].map(s => `
                      <button class="cls2-skin-btn${SDT.Art.getSkin(displaySel) === s.id ? ' sel' : ''}" data-act="clsSkin" data-cls="${escAttr(displaySel)}" data-skin="${escAttr(s.id)}" aria-pressed="${SDT.Art.getSkin(displaySel) === s.id}" title="${escAttr(s.name)}"><span class="cls2-skin-preview"><img src="${escAttr(SDT.Art.skinUrl(displaySel, s.id))}" alt="" loading="lazy" decoding="async"></span><span class="cls2-skin-label">${esc(s.name)}</span></button>`).join('')}
                  </div>
                </div>` : ''}
              <button class="ov-btn cls2-pool-btn" data-act="clsPool" ${sel ? '' : 'disabled'}>[[icon:card-library]] 完整人物卡池（${poolCount(displaySel)} 张）</button>`
            : '<p class="cls2-hint">[[icon:medal]]<br>选择人物</p>'}
          </aside>
        </div>
        <div class="cls2-strip">${roster.map(({ cl, c }) => `
          <button class="cls2-face${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="${escAttr(c.name)}" aria-pressed="${cl === sel ? 'true' : 'false'}">
            ${SDT.Art.classAvatarArt ? SDT.Art.classAvatarArt(cl) : SDT.Art.classArt(cl, true)}<b>${esc(c.name)}</b>
          </button>`).join('')}</div>
        ${linkedBackHTML('cls2Quit', onSelect ? '返回基地' : onCancel ? '返回出发整备' : '返回标题界面', '', 'button', { cancel:true })}
        ${confirmationNotice.html({ keepEmpty:true })}
        <button class="cls2-confirm" data-act="pickClass" ${sel ? '' : 'disabled'} title="${sel ? confirmLabel : '请先选择角色'}" aria-label="${sel ? confirmLabel : '请先选择角色'}"><span>${sel ? confirmLabel : '选择角色后出发'}</span><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`;
    const mounted = local && document.querySelector('#overlay .cls2-page');
    if (mounted) {
      const template = document.createElement('template');
      template.innerHTML = SDT.Icons?.rich ? SDT.Icons.rich(content) : content;
      for (const selector of ['.cls2-fullart', '.cls2-panel']) {
        const current = mounted.querySelector(selector);
        const next = template.content.querySelector(selector);
        if (current && next) {
          if (selector === '.cls2-fullart') characterMotion.swapPortrait(current, next, direction);
          else current.replaceWith(next);
        }
      }
      mounted.querySelectorAll('.cls2-face').forEach(button => {
        const selected = /** @type {HTMLElement} */ (button).dataset.cls === sel;
        button.classList.toggle('sel', selected);
        button.setAttribute('aria-pressed', String(selected));
      });
      characterMotion.preview(mounted.querySelector('.cls2-panel'));
    } else {
      UI.showOverlay('', content, 'page');
      choiceRoot = document.querySelector('#overlay .cls2-page');
      characterMotion.enter();
    }
  };
  // 二级页：角色卡冬日档案索引，保留实际卡面、左侧详情预览、分页与点击放大。
  let poolPage = 0;
  let poolFilter = 'all';
  let poolBrowse = null;
  const rememberPoolBrowse = () => {
    if (view !== 'pool' || !choiceRoot?.matches('.cls-pool-page')) return;
    const index = Number(choiceRoot.querySelector('#poolPreview')?.getAttribute('data-card-index'));
    poolBrowse = { role:sel, page:poolPage, filter:poolFilter,
      selectedId:choiceRoot.querySelector('#poolPreview')?.getAttribute('data-card-id') || SDT.Cards.classPool(sel)[index]?.id,
      presentation:captureOverlayReturnState(choiceRoot),
    };
  };
  const POOL_PAGE_MAX = 10;
  // 尾页均衡（2026-09-20 P0）：固定 10 会切出 10+4/10+7 的孤页——size = ceil(总数 / ceil(总数/10))，
  // 14 张→7+7、17 张→9+8，两页行数接近满格
  const poolPageSize = (pool) => {
    const total = pool.length;
    const totalPages = Math.max(1, Math.ceil(total / POOL_PAGE_MAX));
    return Math.max(1, Math.ceil(total / totalPages));
  };
  // 分页条（2026-09-12 留言 #9/#10：原挂网格末尾会溢出浅色区压进深色底，且被页脚盖住点不了；
  // 现由页脚承载，与「返回选角/确认」同排，renderPoolGrid 翻页时同步刷新）
  const filteredPool = (pool = SDT.Cards.classPool(sel)) => pool
    .map((card, index) => ({ card, index }))
    .filter(({ card }) => poolFilter === 'all' || (card.type || '未分类') === poolFilter);
  const poolFilterHTML = (pool = SDT.Cards.classPool(sel)) => {
    const types = [...new Set(pool.map(card => card.type || '未分类'))];
    const items = [{ key: 'all', label: '全部档案', count: pool.length }, ...types.map(type => ({
      key: type, label: type, count: pool.filter(card => (card.type || '未分类') === type).length,
    }))];
    return items.map(({ key, label, count }) => `<button class="pool-filter${poolFilter === key ? ' active' : ''}" data-target-id="pool-filter-${escAttr(key)}" data-act="poolFilter" data-filter="${escAttr(key)}" aria-pressed="${poolFilter === key ? 'true' : 'false'}"><span>${esc(label)}</span><b>${count}</b></button>`).join('');
  };
  const poolPagerHTML = () => {
    const pool = filteredPool();
    const totalPages = Math.max(1, Math.ceil(pool.length / poolPageSize(pool)));
    return `
      <button class="hs-btn sm" data-act="poolPrev"${poolPage <= 0 || totalPages <= 1 ? ' disabled' : ''}>‹ 上一页</button>
      <span class="pool-pageinfo">第 <b class="pool-page-now">${poolPage + 1}</b> / ${totalPages} 页 · 匹配 ${pool.length} 张</span>
      <button class="hs-btn sm" data-act="poolNext"${poolPage >= totalPages - 1 || totalPages <= 1 ? ' disabled' : ''}>下一页 ›</button>`;
  };
  // 描述默认同字号；实际超出固定描述区时才逐步缩字，不省略牌效。
  const fitPoolDescriptions = () => requestAnimationFrame(() => {
    if (!visible()) return;
    document.querySelectorAll('.cls-pool-page .hsc-desc, body:has(.cls-pool-page) #cardZoom:not(.cz-photo) .hsc-desc').forEach(desc => {
      const text = desc.querySelector('span');
      if (!text || !desc.clientHeight) return;
      /** @type {HTMLElement} */ (desc).style.removeProperty('--pool-desc-size');
      let size = parseFloat(getComputedStyle(desc).fontSize);
      while (text.scrollHeight > desc.clientHeight && size > 4) {
        size = Math.max(4, size - .25);
        /** @type {HTMLElement} */ (desc).style.setProperty('--pool-desc-size', `${size}px`);
      }
    });
  });
  const poolPreviewHTML = (c) => {
    if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">选择卡牌查看</p>';
    return SDT.Cards.cardHTML(c, 'lg');
  };
  const poolGridHTML = () => {
    const pool = filteredPool();
    const size = poolPageSize(pool);
    const totalPages = Math.max(1, Math.ceil(pool.length / size));
    if (poolPage >= totalPages) poolPage = totalPages - 1;
    const cards = pool.slice(poolPage * size, (poolPage + 1) * size);
    if (!cards.length) return '<div class="pool-grid pool-grid-empty" id="poolGrid"><p>当前档案暂无卡牌</p></div>';
    return `<div class="pool-grid" id="poolGrid">${cards.map(({ card: c, index }, i) => {
      const ro = SDT.Cards.rarityOf(c);   // 衍生牌全量扫卡库，单卡只调一次
      return `<div class="pool-cell" data-card-id="${escAttr(c.id || `${sel}:${index}`)}"><span class="pool-rarity-tag${ro === '棱彩' ? ' prism' : ''}">${esc(ro)}</span><button class="lib-cardwrap pool-card-button${i === 0 ? ' selected' : ''}" data-act="poolZoom" data-i="${index}" aria-label="查看 ${escAttr(c.name)} 详情">${SDT.Cards.cardHTML(c)}</button></div>`;
    }).join('')}</div>`;
  };
  // 预解码下一页插画（翻页零解码等待，同卡牌库 warmNextLibPage）
  const warmNextPoolPage = () => {
    const warm = window.SDT?.Art?.warm;
    if (!warm) return;
    const pool = filteredPool().map(({ card }) => card);
    const size = poolPageSize(pool);
    const urls = [];
    for (const c of pool.slice((poolPage + 1) * size, (poolPage + 2) * size)) {
      const m = /src="([^"]+)"/.exec((window.SDT.Art.cardIcon && SDT.Art.cardIcon(c)) || '');
      if (m) urls.push(m[1]);
    }
    warm(urls);
  };
  // 翻页/重进只重绘卡格区与页脚分页状态（整页 showOverlay 会重置预览栏）
  const poolFragment = html => {
    const template = document.createElement('template');
    template.innerHTML = SDT.Icons?.rich ? SDT.Icons.rich(html) : html;
    return template.content;
  };
  const markPoolPreview = index => {
    choiceRoot?.querySelectorAll('.pool-card-button').forEach(button => {
      const selected = Number(button.dataset.i) === index;
      button.classList.toggle('selected', selected);
      if (selected) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
    });
  };
  const paintPoolPreview = entry => {
    const preview = choiceRoot?.querySelector('#poolPreview');
    if (!preview) return;
    syncViewChildren(preview, poolFragment(poolPreviewHTML(entry?.card)));
    preview.setAttribute('data-card-index', String(entry?.index ?? -1));
    preview.setAttribute('data-card-id', entry?.card?.id || '');
    markPoolPreview(entry?.index ?? -1);
  };
  const renderPoolGrid = () => {
    const preview = choiceRoot?.querySelector('#poolPreview');
    const selectedId = preview?.getAttribute('data-card-id') || (SDT.Cards.classPool(sel) || [])[Number(preview?.getAttribute('data-card-index'))]?.id;
    const grid = document.getElementById('poolGrid');
    if (grid) {
      const next = /** @type {HTMLElement} */ (poolFragment(poolGridHTML()).firstElementChild);
      grid.className = next.className;
      syncViewChildren(grid, next);
    }
    const filters = document.getElementById('poolFilters');
    if (filters) syncViewChildren(filters, poolFragment(poolFilterHTML()));
    const pagerEl = document.getElementById('poolPager');
    if (pagerEl) syncViewChildren(pagerEl, poolFragment(poolPagerHTML()));
    const pool = filteredPool();
    const pageCards = pool.slice(poolPage * poolPageSize(pool), (poolPage + 1) * poolPageSize(pool));
    const selected = pageCards.find(entry => entry.card.id === selectedId) || pageCards[0];
    paintPoolPreview(selected);
    if (preview && selected?.card.id !== selectedId) characterMotion.preview(preview);
    const count = document.getElementById('poolResultCount');
    if (count) count.textContent = String(pool.length);
    bindPoolFocusPreview();
    warmNextPoolPage();
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(document.querySelector('.cls-pool-page'));   // 翻页新卡显式解码，防合成黑窗
  };
  const renderPool = () => {
    const saved = poolBrowse?.role === sel ? poolBrowse : null;
    poolPage = saved?.page || 0;
    poolFilter = saved?.filter || 'all';
    const pool = SDT.Cards.classPool(sel);
    const filtered = filteredPool();
    poolPage = Math.min(poolPage, Math.max(0, Math.ceil(filtered.length / poolPageSize(filtered)) - 1));
    const pageCards = filtered.slice(poolPage * poolPageSize(filtered), (poolPage + 1) * poolPageSize(filtered));
    const previewCard = pageCards.find(entry => entry.card.id === saved?.selectedId)?.card || pageCards[0]?.card;
    const previewIndex = previewCard ? pool.findIndex(card => card.id === previewCard.id) : -1;
    const story = characterFor(sel);
    UI.showOverlay('', `
      <div class="pg cls-pool-page" data-base-departure="${!!onCancel}" style="--cls-color:${story ? story.color : '#69aec2'}">
        <header class="pg-head">
          ${linkedBackHTML('clsBack', '返回选人', 'pool-back', 'button', { text:'返回', cancel:true })}
          <div class="pool-archive-title"><h2>角色卡池</h2></div>
          <div class="pool-head-stats"><span class="pool-head-caption">${esc(characterName(sel))}</span><span class="pool-head-badge"><b>${pool.length}</b><small>张</small></span></div>
        </header>
        <div class="pool-main">
          <aside class="pool-side">
            <div class="pv-head">
              <b class="pv-name">卡牌详情</b>
            </div>
            <div class="pv-body" id="poolPreview" data-card-index="${previewIndex}" data-card-id="${escAttr(previewCard?.id || '')}" aria-live="polite">${poolPreviewHTML(previewCard)}</div>
          </aside>
          <section class="pool-catalog" aria-label="角色卡档案">
            <div class="pool-catalog-head"><div><b>分类索引</b></div><div class="pool-result-summary">当前档案 <strong id="poolResultCount">${filtered.length}</strong> 张</div></div>
            <nav class="pool-filters" id="poolFilters" aria-label="按卡牌类型筛选">${poolFilterHTML(pool)}</nav>
            ${poolGridHTML()}
          </section>
        </div>
        <footer class="cls-foot cls-foot-pool">
          <div class="pool-pager" id="poolPager">${poolPagerHTML()}</div>
          <button class="ov-btn ok" data-act="pickClass">${confirmLabel}</button>
        </footer>
      </div>`, 'page');
    choiceRoot = document.querySelector('#overlay .cls-pool-page');
    markPoolPreview(previewIndex);
    characterMotion.enter();
    bindPoolFocusPreview();
    if (saved) restoreOverlayReturnState(choiceRoot, saved.presentation);
    warmNextPoolPage();
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(document.querySelector('.cls-pool-page'));   // 首屏卡面显式解码，防 IAB 合成黑窗（同战斗手牌修法）
  };
  const showPoolPreview = (el, tick = false) => {
    const i = Number(el?.dataset?.i);
    const c = (SDT.Cards.classPool(sel) || [])[i];
    const pv = document.getElementById('poolPreview');
    if (!c || !pv) return;
    if (el.classList.contains('selected') && pv.dataset.cardIndex === String(i)) return;
    paintPoolPreview({ card:c, index:i });
    fitPoolDescriptions();
    characterMotion.preview(pv);
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(pv);   // 侧栏 lg 大图变体显式解码，防 IAB 合成黑窗（网格小卡已解码不代表大尺寸变体可用，2026-09-20 走查实锤）
    if (tick) Sfx.tick();
  };
  const bindPoolFocusPreview = () => {
    fitPoolDescriptions();
    const grid = document.getElementById('poolGrid');
    if (!grid || grid.dataset.previewBound) return;
    grid.dataset.previewBound = '1';
    grid.addEventListener('pointerleave', () => {
      poolHoverAnchor = null;
      if (poolPreviewTimer) clearTimeout(poolPreviewTimer);
      poolPreviewTimer = null;
    });
    grid.addEventListener('focusin', (e) => {
      const card = /** @type {Element} */ (e.target).closest && /** @type {Element} */ (e.target).closest('[data-act="poolZoom"]');
      if (card) showPoolPreview(card);
    });
  };
  // 悬停大图预览（炉石式，同卡牌库）：mouseover 因子元素冒泡重复触发，90ms 去抖
  let poolPreviewTimer = null;
  let poolHoverAnchor = null;
  UI._hoverHandler = (e) => {
    const w = /** @type {Element} */ (e.target).closest ? /** @type {Element} */ (e.target).closest('#poolGrid [data-act="poolZoom"]') : null;
    if (!visible() || w === poolHoverAnchor) return;
    poolHoverAnchor = w;
    if (poolPreviewTimer) clearTimeout(poolPreviewTimer);
    poolPreviewTimer = null;
    if (!w) return;   // 移出卡面：保留当前预览不动，取消尚未执行的切换。
    const i = Number(/** @type {HTMLElement} */ (w).dataset.i);
    poolPreviewTimer = setTimeout(() => {
      poolPreviewTimer = null;
      const c = (SDT.Cards.classPool(sel) || [])[i];
      if (c && visible() && w.isConnected && poolHoverAnchor === w) showPoolPreview(w, true);
    }, 90);
  };
  act('poolZoom', (d) => {
    const list = sel ? SDT.Cards.classPool(sel) : [];
    const c = list[Number(d.i)];
    if (c) {
      UI.showCardZoom(c);
      fitPoolDescriptions();
    }
  });
  act('poolPrev', () => { if (poolPage > 0) { poolPage--; renderPoolGrid(); } });
  act('poolNext', () => {
    const filtered = filteredPool();
    const totalPages = Math.ceil(filtered.length / poolPageSize(filtered));
    if (poolPage < totalPages - 1) { poolPage++; renderPoolGrid(); }
  });
  act('poolFilter', (d) => {
    if (d.filter === poolFilter) return;
    poolFilter = d.filter || 'all';
    poolPage = 0;
    renderPoolGrid();
  });
  act('selClass', (d) => {
    if (!picks.includes(d.cls) || confirmationStarted) return;
    characterMotion.cancelPage();
    if (d.cls === sel) return;
    const direction = picks.indexOf(d.cls) >= picks.indexOf(sel) ? 1 : -1;
    poolBrowse = null;
    sel = d.cls;
    selectionGeneration++;
    SDT.Sound.sfx('characterSelect');
    render(true, direction);
  });
  act('clsPool', () => {
    if (!sel) return;
    return characterMotion.page(() => {
      view = 'pool';
      Sfx.tick();
      render();
    });
  });
  act('clsBack', () => {
    rememberPoolBrowse();
    return characterMotion.page(() => {
      view = 'select';
      Sfx.tick();
      render();
    });
  });
  act('clsSkin', (d) => {   // 皮肤切换（2026-09-19）：只换选人页大立绘，会话内记忆不入存档
    if (SDT.Art.getSkin(d.cls) === d.skin) return;
    SDT.Art.setSkin(d.cls, d.skin);
    const portrait = document.querySelector('#overlay .cls2-fullart');
    const next = portrait?.cloneNode(true);
    if (next) {
      /** @type {HTMLElement} */ (next).innerHTML = `<div class="roster-art-surface">${SDT.Art.classFullArt(d.cls)}</div>`;
      /** @type {HTMLElement} */ (next).dataset.skin = d.skin;
      /** @type {HTMLElement} */ (next).dataset.character = characterFor(d.cls)?.id || '';
    }
    characterMotion.swapPortrait(portrait, next);
    document.querySelectorAll(`.cls2-skin-btn[data-cls="${d.cls}"]`)
      .forEach(b => { const active = /** @type {HTMLElement} */ (b).dataset.skin === d.skin; b.classList.toggle('sel', active); b.setAttribute('aria-pressed', String(active)); });
    Sfx.tick();
  });
  act('cls2Quit', () => {   // 基地选角按入口回流；独立进入时回标题
    if (onCancel) { onCancel(); return; }
    // 迭代评审 09-20 客户端岗：setTimeout(240) 时序补丁退役——exitToTitle 现在自带
    // immediate 同步关层，淡出窗口竞态在 ui.js 层根治
    exitToTitle();
  });
  const confirmClass = async (cl, generation = selectionGeneration) => {
    if (confirmationPending || entryPresented) return false;
    if (generation !== selectionGeneration || cl !== sel) return false;
    if (confirmation ? !ownsConfirmationPage() : departurePending ? !ownsPendingDeparturePage() : !current()) return false;
    if (!confirmation && !departurePending && (onSelect ? options.isConfirmationCurrent && !options.isConfirmationCurrent() : !visible())) return false;
    const confirmationSlot = getActiveSlot();
    confirmationPending = true;
    try {
      if (!confirmation) {
        const confirmationBase = SDT.Base;
        if (departurePending) {
          const pending = departurePending;
          const release = holdHubOperationControls(pending.page.root?.querySelectorAll('[data-act="retryClassConfirmation"]') || []);
          let published;
          try {
            confirmationNotice.set('正在打开地图…');
            published = await pending.handle.retry();
          } finally { release(); }
          if (!ownsPendingDeparturePage()) return false;
          if (published !== true) { showPendingDepartureRetry(); return false; }
          confirmationNotice.clear();
        } else if (beforeConfirm) {
          const page = captureConfirmationPage();
          const baseSlot = confirmationBase?.slot;
          const baseGeneration = confirmationBase?._selectionGeneration;
          const result = await beforeConfirm();
          if (result?.status === 'departure-pending' && result.committed === true &&
            typeof result.retry === 'function' && typeof result.isCurrent === 'function') {
            departurePending = { handle:result, cl, generation, slot:confirmationSlot, base:confirmationBase,
              baseSlot, baseGeneration, page };
            confirmationStarted = true;
            if (ownsPendingDeparturePage()) showPendingDepartureRetry();
            return false;
          }
          if (result === false) return false;
        }
        // Deferred beforeConfirm owns newRun; its completed run is never created again on retry.
        if (getActiveSlot() !== confirmationSlot || SDT.Base !== confirmationBase || generation !== selectionGeneration || cl !== sel) return false;
        if (departurePending ? !ownsPendingDeparturePage() :
          (options.isCurrent && !options.isCurrent()) || (onSelect ? options.isConfirmationCurrent && !options.isConfirmationCurrent() : !visible())) return false;
        confirmation = { cl, current:captureBattleContext(game, getActiveSlot), base:confirmationBase,
          slot:confirmationSlot, baseSlot:confirmationBase?.slot, baseGeneration:confirmationBase?._selectionGeneration,
          generation, departureHandle:departurePending?.handle, page:captureConfirmationPage(), prepared:false, saved:false, transitioned:false };
      }
      if (!confirmation.prepared) {
        // 恢复句柄已完成基地教学处理；这里只承担普通入口的教学标记。
        if (!confirmation.departureHandle && !SDT.Base?.data?.ammoTaught) {
          const marked = await saveRunCheckpoint(() => SDT.Base?.markAmmoTaught?.());
          if (!ownsConfirmationPage() || (onSelect && options.isConfirmationCurrent && !options.isConfirmationCurrent())) return false;
          if (!marked && confirmationSlot != null) UI.log('[[icon:cross]] 教学标记尚未保存，请重试保存', 'warn');
        }
        const card = SDT.Cards.randomClassCard(cl);
        // 开局两张职业卡只抽取一次，保存失败后沿用同一份入城补给。
        let card2 = SDT.Cards.randomClassCard(cl);
        for (let i = 0; i < 8 && card2 && card && card2.id === card.id; i++) card2 = SDT.Cards.randomClassCard(cl);
        const supply = createEntrySupply(game, [card, card2]);
        const lv = SDT.Meta.classLv(cl);
        const bonus = lv > 1 ? (lv - 1) * 1 : 0;
        game.myClass = cl;
        game.characterId = characterFor(cl).id;
        game.classCard = null;
        game.maxHp += bonus; game.hp += bonus;
        game.entrySupply = supply;
        confirmation.prepared = true;
        confirmationStarted = true;
        UI.log(`[[icon:medal]] 本局角色：<b>${esc(characterName(cl))}</b>`, 'ok');
        // 熟练度加成：每级（Lv.1 起）生命上限 +1（2026-09-09 需求 #5），立即生效
        if (lv > 1) {
          UI.log(`[[icon:medal]] ${esc(characterName(cl))} 熟练度 <b>Lv.${lv}</b>：生命上限 +${bonus}（${game.maxHp}）`, 'ok');
        }
      }
      if (!confirmation.saved) {
        const saved = await saveRunCheckpoint(saveGame);
        if (!ownsConfirmationPage()) return false;
        if (!saved) { showConfirmationRetry('人物与初始职业卡已保留，出征进度尚未保存；请重试保存后出发。'); return false; }
        confirmation.saved = true;
      }
      if (!confirmation.transitioned) {
        // 2026-09-07 留言：选人进局要有过渡动画——复用节点过场（大门场景 + 角色名揭晓）；
        // 启程文案按人物区分（对应各自 tag 的语气）
        const START_LINES = {
          wu: '刀锋出鞘，踏雪先行',
          changwuyu: '契约既成，答案待启',
          baita: '口袋里的星图，亮了',
          heixiang: '最后一道防线，就位',
          xingyue: '灯已点亮，照归途',
        };
        const startLine = START_LINES[characterFor(cl).id] || '整备完毕，探索开始';
        const transition = showRunTransition({
          tone: 'door', asset: 'scene-door-bg', eyebrow: 'EXPEDITION START',
          title: characterName(cl), detail: startLine, duration: 1600,
          prepare: () => SDT.Renderer?.warm?.(),
          presentation: 'city-cut',
          scene: 'departure',
        });
        confirmation.page = captureConfirmationPage();
        const completed = await transition;
        if (!confirmation.current() || !transition.isCurrent() || !confirmationOwnerCurrent()) return false;
        if (completed === false) {
          if (ownsConfirmationPage()) showConfirmationRetry('出发演出尚未完成，人物与初始职业卡已保留，请继续出发。');
          return false;
        }
        // 成功过场只关闭自己的那一层；resolve 后新打开的页面仍属于新入口。
        const page = confirmation.page;
        if (UI.el?.ovBody !== page.body || UI.el?.overlay !== page.overlay || !page.overlay?.hidden || page.body?.firstElementChild ||
          (Number.isFinite(page.revision) && UI._overlayRevision !== page.revision + 1)) return false;
        confirmation.transitioned = true;
        confirmation.page = captureConfirmationPage();
      }
      // 地图在最终保存完成后开放；存档不持久化临时页面状态。
      game.state = 'modal';
      const saved = await saveRunCheckpoint(saveGame);
      if (!ownsConfirmationPage()) return false;
      if (!saved) { showConfirmationRetry('出征已准备完成，进度尚未保存；请重试保存后继续探索。'); return false; }
      entryPresented = true;
      confirmationNotice.clear();
      UI.hideOverlay();
      game.state = 'idle';
      UI.refresh(game);
      return true;
    } catch (error) {
      console.warn('[选角] 确认未完成，保留当前进度。', error);
      if (confirmation && ownsConfirmationPage()) showConfirmationRetry('出发尚未完成，已完成的人物与补给进度保留，请重试。');
      else if (departurePending && ownsPendingDeparturePage()) showPendingDepartureRetry();
      else if (!confirmation && visible()) confirmationNotice.set('人物确认尚未完成，当前选择已保留，请重试。', 'warn');
      return false;
    } finally { confirmationPending = false; }
  };
  const captureConfirmationPage = () => ({ body:UI.el?.ovBody, overlay:UI.el?.overlay,
    root:UI.el?.ovBody?.firstElementChild, hidden:UI.el?.overlay?.hidden, revision:UI._overlayRevision });
  const ownsPage = page => !!page && UI.el?.ovBody === page.body && UI.el?.overlay === page.overlay &&
    page.body?.firstElementChild === page.root && page.overlay?.hidden === page.hidden && UI._overlayRevision === page.revision &&
    !page.overlay?.classList.contains('closing');
  const ownsPendingDeparturePage = () => {
    const pending = departurePending;
    return !!pending && pending.handle.isCurrent() && pending.generation === selectionGeneration && pending.cl === sel &&
      getActiveSlot() === pending.slot && SDT.Base === pending.base && SDT.Base?.slot === pending.baseSlot &&
      SDT.Base?._selectionGeneration === pending.baseGeneration && ownsPage(pending.page);
  };
  const showPendingDepartureRetry = () => {
    if (!ownsPendingDeparturePage()) return;
    game.state = 'modal';
    confirmationNotice.set('远征已保存，地图尚未打开；请继续同一次出征。', 'warn');
    UI.showOverlay('', `<div class="pg"><h2>继续出征</h2>${confirmationNotice.html()}<button class="ov-btn ok" data-act="retryClassConfirmation">重试打开地图</button></div>`, 'page');
    departurePending.page = captureConfirmationPage();
    UI.act('retryClassConfirmation', () => ownsPendingDeparturePage() && confirmClass(departurePending.cl, departurePending.generation));
    try { UI.refresh(game); }
    catch (error) { console.warn('[选角] 地图刷新未完成，保留继续出征页面。', error); }
  };
  const confirmationOwnerCurrent = () => !!confirmation && confirmation.generation === selectionGeneration && confirmation.cl === sel &&
    getActiveSlot() === confirmation.slot && SDT.Base === confirmation.base && SDT.Base?.slot === confirmation.baseSlot &&
    SDT.Base?._selectionGeneration === confirmation.baseGeneration &&
    (confirmation.departureHandle ? confirmation.departureHandle.isCurrent() : !options.isCurrent || options.isCurrent());
  const ownsConfirmationPage = () => {
    const page = confirmation?.page;
    return !!page && confirmation.current() && confirmationOwnerCurrent() && ownsPage(page);
  };
  const showConfirmationRetry = message => {
    if (!ownsConfirmationPage()) return;
    game.state = 'modal';
    confirmationNotice.set(message, 'warn');
    UI.showOverlay('', `<div class="pg"><h2>继续出发</h2>${confirmationNotice.html()}<button class="ov-btn ok" data-act="retryClassConfirmation">${confirmation.transitioned ? '重试保存并继续探索' : '重试保存并出发'}</button></div>`, 'page');
    confirmation.page = captureConfirmationPage();
    UI.act('retryClassConfirmation', () => ownsConfirmationPage() && confirmClass(confirmation.cl, confirmation.generation));
    try { UI.refresh(game); }
    catch (error) { console.warn('[选角] 地图刷新未完成，保留出发重试页面。', error); }
  };
  act('pickClass', async () => {
    if (!sel || characterMotion.busy || selectionPending || confirmationPending || confirmationStarted) return false;
    const cl = sel;
    const generation = ++selectionGeneration;
    if (onSelect) {
      selectionPending = true;
      confirmationNotice.clear();
      try {
        const result = await onSelect(cl, () => confirmClass(cl, generation));
        if (result === false && visible()) confirmationNotice.set('整备页面尚未打开，当前人物选择已保留，请重试。', 'warn');
        return result !== false;
      } catch (error) {
        console.warn('[选角] 整备入口未完成。', error);
        if (visible()) confirmationNotice.set('整备页面尚未打开，当前人物选择已保留，请重试。', 'warn');
        return false;
      } finally { selectionPending = false; }
    }
    return confirmClass(cl, generation);
  });
  render();
  return true;
}
