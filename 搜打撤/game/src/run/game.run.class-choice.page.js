/* 选角叶页面：仅由 class-choice 轻门面在用户请求时装载，共用 session / Base 单例。 */
import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
import { esc, escAttr } from '../core/shared.js';
import { MAP, game, getActiveSlot, exitToTitle, saveGame } from './game.session.js';
import { slamSkillFor } from '../battle/bag/battle.slam-skill.js';
import { createEntrySupply } from './node-reward-state.js';
import { createCharacterViewMotion } from '../ui/character-view-motion.js';
import { Sfx } from '../hub/game.cardslib.js';
import { captureBattleContext, ensureBattleReady } from '../battle/battle-loader.js';
import { preloadAllNodeShellBgs, showRunTransition } from './game.run.scenes.js';

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
  const characterMotion = createCharacterViewMotion();
  const choiceContext = captureBattleContext(game, getActiveSlot);
  const originalClass = game.myClass;
  let choiceRoot = null;
  const current = () => choiceContext() && game.myClass === originalClass && (!options.isCurrent || options.isCurrent());
  const visible = () => current() && choiceRoot?.isConnected && !document.getElementById('overlay')?.hidden &&
    !document.getElementById('overlay')?.classList.contains('closing') &&
    document.querySelector('#overlay .cls2-page, #overlay .cls-pool-page') === choiceRoot;
  const act = (name, handler) => UI.act(name, data => { if (visible()) return handler(data); });
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
  let entryPresented = false;
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
              <div class="cls2-chips">
                ${sel ? '<span class="cls2-chip cls2-chip-live">当前选择</span>' : ''}
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
              </details><details class="cls2-growth cls2-supply-rules"${SDT.Base?.data?.ammoTaught ? '' : ' open'}><summary>用过的牌去哪了？</summary><p>所有用过的牌都进入<b>消耗区</b>，复原后可以再用。</p><p>复原方法在背包查看；首脑战规则在入场前说明。</p></details>
              ${!mechanism ? `<p class="cls2-story">${esc(CLASS_STORY[story.id] || '确认后以此人物进入远征，熟练度加成与职业卡将在确认时生效。')}</p>` : ''}
              ${(SDT.Art.listSkins ? SDT.Art.listSkins(displaySel) : []).length ? `
                <div class="cls2-skins-wrap">
                  <div class="cls2-sub">皮肤 <i>SKINS</i></div>
                  <div class="cls2-skins">
                    ${[{ id:'default', name:'标准' }, ...SDT.Art.listSkins(displaySel)].map(s => `
                      <button class="cls2-skin-btn${SDT.Art.getSkin(displaySel) === s.id ? ' sel' : ''}" data-act="clsSkin" data-cls="${escAttr(displaySel)}" data-skin="${escAttr(s.id)}" aria-pressed="${SDT.Art.getSkin(displaySel) === s.id}" title="${escAttr(s.name)}"><span class="cls2-skin-preview"><img src="${escAttr(SDT.Art.skinUrl(displaySel, s.id))}" alt="" loading="lazy" decoding="async"></span><span class="cls2-skin-label">${esc(s.name)}</span></button>`).join('')}
                  </div>
                </div>` : ''}
              <button class="ov-btn cls2-pool-btn" data-act="clsPool" ${sel ? '' : 'disabled'}>[[icon:cards]] 完整人物卡池（${poolCount(displaySel)} 张）</button>`
            : '<p class="cls2-hint">[[icon:medal]]<br>从下方选择一名角色</p>'}
          </aside>
        </div>
        <div class="cls2-strip">${roster.map(({ cl, c }) => `
          <button class="cls2-face${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="${escAttr(c.name)}" aria-pressed="${cl === sel ? 'true' : 'false'}">
            ${SDT.Art.classAvatarArt ? SDT.Art.classAvatarArt(cl) : SDT.Art.classArt(cl, true)}<b>${esc(c.name)}</b>
          </button>`).join('')}</div>
        <button class="archive-back" data-act="cls2Quit" title="${onSelect ? '返回基地' : onCancel ? '返回出发整备' : '返回标题界面'}" aria-label="${onSelect ? '返回基地' : onCancel ? '返回出发整备' : '返回标题界面'}"><svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="M9 4h9a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 18 20H9" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M4 12h10M4 12l4-4M4 12l4 4" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
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
        const selected = button.dataset.cls === sel;
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
    return items.map(({ key, label, count }) => `<button class="pool-filter${poolFilter === key ? ' active' : ''}" data-act="poolFilter" data-filter="${escAttr(key)}" aria-pressed="${poolFilter === key ? 'true' : 'false'}"><span>${esc(label)}</span><b>${count}</b></button>`).join('');
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
      desc.style.removeProperty('--pool-desc-size');
      let size = parseFloat(getComputedStyle(desc).fontSize);
      while (text.scrollHeight > desc.clientHeight && size > 4) {
        size = Math.max(4, size - .25);
        desc.style.setProperty('--pool-desc-size', `${size}px`);
      }
    });
  });
  const poolPreviewHTML = (c) => {
    if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">选择右侧卡牌<br>这里会显示档案预览</p>';
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
      return `<div class="pool-cell"><span class="pool-rarity-tag${ro === '棱彩' ? ' prism' : ''}">${esc(ro)}</span><button class="lib-cardwrap pool-card-button${i === 0 ? ' selected' : ''}" data-act="poolZoom" data-i="${index}" aria-label="查看 ${escAttr(c.name)} 详情">${SDT.Cards.cardHTML(c)}</button></div>`;
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
  const renderPoolGrid = () => {
    const grid = document.getElementById('poolGrid');
    if (grid) grid.outerHTML = poolGridHTML();
    const filters = document.getElementById('poolFilters');
    if (filters) filters.innerHTML = poolFilterHTML();
    const pagerEl = document.getElementById('poolPager');
    if (pagerEl) pagerEl.innerHTML = poolPagerHTML();
    const pool = filteredPool();
    const first = pool[poolPage * poolPageSize(pool)];
    const preview = document.getElementById('poolPreview');
    if (first && preview) {
      preview.innerHTML = poolPreviewHTML(first.card);
      preview.dataset.cardIndex = String(first.index);
      characterMotion.preview(preview);
    }
    const count = document.getElementById('poolResultCount');
    if (count) count.textContent = String(pool.length);
    bindPoolFocusPreview();
    warmNextPoolPage();
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(document.querySelector('.cls-pool-page'));   // 翻页新卡显式解码，防合成黑窗
  };
  const renderPool = () => {
    poolPage = 0;
    poolFilter = 'all';
    const pool = SDT.Cards.classPool(sel);
    const story = characterFor(sel);
    UI.showOverlay('', `
      <div class="pg cls-pool-page" data-base-departure="${!!onCancel}" style="--cls-color:${story ? story.color : '#69aec2'}">
        <header class="pg-head">
          <button class="pool-back" data-act="clsBack" aria-label="返回选人"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5.5 4 12l6.5 6.5M4.6 12H20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg><span>返回</span></button>
          <div class="pool-archive-title"><h2>角色卡池</h2></div>
          <div class="pool-head-stats"><span class="pool-head-caption">${esc(characterName(sel))}</span><span class="pool-head-badge"><b>${pool.length}</b><small>张</small></span></div>
        </header>
        <div class="pool-main">
          <aside class="pool-side">
            <div class="pv-head">
              <b class="pv-name">卡牌详情</b>
            </div>
            <div class="pv-body" id="poolPreview" aria-live="polite">${poolPreviewHTML(pool[0])}</div>
          </aside>
          <section class="pool-catalog" aria-label="角色卡档案">
            <div class="pool-catalog-head"><div><span class="pool-catalog-kicker">COLLECTION INDEX</span><b>分类索引</b></div><div class="pool-result-summary">当前档案 <strong id="poolResultCount">${pool.length}</strong> 张</div></div>
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
    characterMotion.enter();
    bindPoolFocusPreview();
    warmNextPoolPage();
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(document.querySelector('.cls-pool-page'));   // 首屏卡面显式解码，防 IAB 合成黑窗（同战斗手牌修法）
  };
  const showPoolPreview = (el, tick = false) => {
    const i = Number(el?.dataset?.i);
    const c = (SDT.Cards.classPool(sel) || [])[i];
    const pv = document.getElementById('poolPreview');
    if (!c || !pv) return;
    document.querySelectorAll('#poolGrid .pool-card-button.selected').forEach(node => node.classList.remove('selected'));
    el.classList.add('selected');
    pv.innerHTML = poolPreviewHTML(c);
    pv.dataset.cardIndex = String(i);
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
    grid.addEventListener('focusin', (e) => {
      const card = e.target.closest && e.target.closest('[data-act="poolZoom"]');
      if (card) showPoolPreview(card);
    });
  };
  // 悬停大图预览（炉石式，同卡牌库）：mouseover 因子元素冒泡重复触发，90ms 去抖
  let poolPreviewTimer = null;
  UI._hoverHandler = (e) => {
    const w = e.target.closest ? e.target.closest('#poolGrid [data-act="poolZoom"]') : null;
    if (!w || !visible()) return;   // 移出卡面：保留当前预览不动
    const i = Number(w.dataset.i);
    if (poolPreviewTimer) clearTimeout(poolPreviewTimer);
    poolPreviewTimer = setTimeout(() => {
      poolPreviewTimer = null;
      const c = (SDT.Cards.classPool(sel) || [])[i];
      if (c && visible() && w.isConnected) showPoolPreview(w, true);
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
    if (d.cls === sel || !picks.includes(d.cls) || confirmationStarted || characterMotion.busy) return;
    const direction = picks.indexOf(d.cls) >= picks.indexOf(sel) ? 1 : -1;
    sel = d.cls;
    SDT.Sound.sfx('characterSelect');
    render(true, direction);
  });
  act('clsPool', () => {
    if (!sel) return;
    characterMotion.page(() => {
      view = 'pool';
      Sfx.tick();
      render();
    });
  });
  act('clsBack', () => {
    characterMotion.page(() => {
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
      next.innerHTML = `<div class="roster-art-surface">${SDT.Art.classFullArt(d.cls)}</div>`;
      next.dataset.skin = d.skin;
      next.dataset.character = characterFor(d.cls)?.id || '';
    }
    characterMotion.swapPortrait(portrait, next);
    document.querySelectorAll(`.cls2-skin-btn[data-cls="${d.cls}"]`)
      .forEach(b => { const active = b.dataset.skin === d.skin; b.classList.toggle('sel', active); b.setAttribute('aria-pressed', String(active)); });
    Sfx.tick();
  });
  act('cls2Quit', () => {   // 基地选角按入口回流；独立进入时回标题
    if (onCancel) { onCancel(); return; }
    // 迭代评审 09-20 客户端岗：setTimeout(240) 时序补丁退役——exitToTitle 现在自带
    // immediate 同步关层，淡出窗口竞态在 ui.js 层根治
    exitToTitle();
  });
  const confirmClass = cl => {
    if (confirmationStarted || !current()) return false;
    if (onSelect ? options.isConfirmationCurrent && !options.isConfirmationCurrent() : !visible()) return false;
    if (beforeConfirm && beforeConfirm() === false) return false;
    confirmationStarted = true;
    if (!SDT.Base?.data?.ammoTaught) SDT.Base?.markAmmoTaught?.();
    game.myClass = cl;
    game.characterId = characterFor(cl).id;
    game.classCard = null;
    const card = SDT.Cards.randomClassCard(cl);
    // 2026-09-06：开局获得 2 张本职业卡牌（原 1 张），尽量不重复
    let card2 = SDT.Cards.randomClassCard(cl);
    for (let i = 0; i < 8 && card2 && card && card2.id === card.id; i++) card2 = SDT.Cards.randomClassCard(cl);
    UI.hideOverlay();
    UI.log(`[[icon:medal]] 本局角色：<b>${esc(characterName(cl))}</b>`, 'ok');
    // 熟练度加成：每级（Lv.1 起）生命上限 +1（2026-09-09 需求 #5），立即生效
    const lv = SDT.Meta.classLv(cl);
    if (lv > 1) {
      const bonus = (lv - 1) * 1;
      game.maxHp += bonus; game.hp += bonus;
      UI.log(`[[icon:medal]] ${esc(characterName(cl))} 熟练度 <b>Lv.${lv}</b>：生命上限 +${bonus}（${game.maxHp}）`, 'ok');
    }
    game.entrySupply = createEntrySupply(game, [card, card2]);
    saveGame();   // Freeze the pending cards before the departure transition.
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
    const currentContext = captureBattleContext(game, getActiveSlot);
    const transition = showRunTransition({
      tone: 'door', asset: 'scene-door-bg', eyebrow: 'EXPEDITION START',
      title: characterName(cl), detail: startLine, duration: 1600,
      prepare: () => SDT.Renderer?.warm?.(),
      presentation: 'city-cut',
    });
    return transition.then(completed => {
      if (entryPresented || completed === false || !transition.isCurrent() || !currentContext()) return false;
      entryPresented = true;
      UI.hideOverlay();
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
      return true;
    });
  };
  act('pickClass', () => {
    if (!sel || characterMotion.busy) return;
    const cl = sel;
    if (onSelect) { onSelect(cl, () => confirmClass(cl)); return; }
    confirmClass(cl);
  });
  render();
  return true;
}
