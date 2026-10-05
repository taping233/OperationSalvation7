/* ============================================================

 * game.run.altar.js —— 祭坛/层间门/BOSS 门/火堆/职业选择/撤离整理（架构批次 4）
 *
 * 由 game.run.js 拆出。层位中间（L1）：依赖 game.run.scenes.js，反向不被其依赖；
 * FLOW（game.run.flow.js）依赖本文件。
 * ============================================================ */
import { CHARACTERS, characterFor, characterName } from '../core/characters.js';
import { esc, escAttr } from '../core/shared.js';
import { MAP, MODES, bagCap, curLayer, enterLayer, exitToTitle, game, getActiveSlot, newUid, saveGame, scaledEnemy, usedSlots } from './game.session.js';
import { buildExtractionReceipt, createExtractionCommands, validatePendingExtraction } from '../hub/extraction.commands.js';
import { openBaseHub } from '../hub/game.hub.js';

// 选人页机制简介（2026-09-12 留言：按各职业卡池真实机制写，键 = characters.js 的 id）
const CLASS_STORY = {
  wu: '擅长物理攻击，可以潜行，精通流血与连击。',
  changwuyu: '以法术伤害为核心，精通用火球与诅咒压制敌人。',
  baita: '精通奥术法术，擅长发现新法术与召唤帮手。',
  heixiang: '正面硬扛的战士，擅长叠护甲与施加流血。',
  xingyue: '擅长治疗与圣盾，用圣光法术守护自己。',
};
import { Sfx, _set_cardPageOpen } from '../hub/game.cardslib.js';
import { Random, SeededRandomService } from '../core/random.js';
import { captureBattleContext, ensureBattleReady, startBattle } from '../battle/battle-loader.js';
import { FIRE_RESTORABLE, consumeCurrentCell, finishInstant, grantEventCard, nodeOpt, nodeShell, openPocketRestore, openShop, preloadAllNodeShellBgs, showRunTransition } from './game.run.scenes.js';
import { RunStorage } from '../hub/game.storage.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot } from '../hub/recovery.commands.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
const extractionCommands = createExtractionCommands({
  getActiveSlot, runStore: RunStorage, baseApi: SDT.Base,
  recovery: { commitBaseAndRun, readSettlementReceipt, recoverSlot }, game,
  random: () => Random.random('pocket'), characterFor,
  makePocketStream(snapshot) {
    const stream = new SeededRandomService(snapshot?.seed ?? Random.seed);
    stream.restore(snapshot || { seed: Random.seed });
    return { random: () => stream.random('pocket'), snapshot: () => stream.snapshot() };
  },
  restoreRandom(snapshot) { if (snapshot) Random.restore(snapshot); },
  addXpToProgress: SDT.Meta.addXpToProgress,
  xpMultiplier: () => MODES[game.mode]?.xpMul || 1,
});

export function openFireRest() {
  SDT.Sound.scene?.('fire', 'scene-fire-bg');
  // 复原/发卡只在同一节点的首次进入结算（09-30 深审 WORLD-002）：任何仍可达的重入路径
  // （未写 visited 就再触发本节点）不得重复回复生命/掷职业卡/重复复原
  const cellKey = `${game.layerIdx},${game.trackPos}`;
  if (game._fireRestKey !== cellKey) {
    game._fireRestKey = cellKey;
    game.heal(MAP.rules.fireHeal);
    UI.log(`[[icon:fire]] <b>进入火堆</b>：自动回复 <b>${MAP.rules.fireHeal}</b> 点生命`, 'ok');
    // 2026-09-06 留言：火堆界面的音效删掉（原 levelup 提示音）
    // 2026-09-20 老板：火堆只发本职业卡（randomClassCard 须传 game.myClass，不传会全职业混抽）；
    //   获得演出带原因文字（营火余烬翻出），不再只靠侧边日志
    if (Random.random('card') < MAP.rules.fireClassCardChance) {
      const campCard = SDT.Cards.randomClassCard(game.myClass);
      if (campCard) {
        UI.log('[[icon:wood]] 营火余烬里翻出了一张先行者掉落的本职业卡！', 'loot');
        grantEventCard(campCard, { reason: '营火余烬里翻出的先行者遗落卡 · 本职业限定' });
      }
    }
    // 2026-10-02 老板：火堆不再开全列表选牌页——从消耗口袋可复原池随机发现两张并自动复原
    //（过滤口径沿用 FIRE_RESTORABLE；池不足两张全复原，空池给提示；背包满不复原，同复原页口径）
    const found = [];
    for (let i = 0; i < 2; i++) {
      const pool = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card));
      if (!pool.length) break;
      if (usedSlots() >= bagCap()) { SDT.Sound.sfx('deny'); UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn'); break; }
      const p = pool[Math.floor(Random.random('pocket') * pool.length)];
      p.count--;
      if (p.count <= 0) game.usedPocket.splice(game.usedPocket.indexOf(p), 1);
      game.ownedCards.push({ uid: newUid(), card: { ...p.card } });
      found.push(p.card);
    }
    if (found.length) {
      UI.log(`[[icon:wood]] 火堆余烬里翻出了 ${found.map(c => `【<b>${esc(c.name)}</b>】`).join('、')}，已复原回背包`, 'loot');
      for (const c of found) UI.showCardReward(c, '火堆余烬里翻出的消耗卡 · 自动复原');
    } else if (!game.usedPocket.some(p => FIRE_RESTORABLE(p.card))) {
      const blockedN = game.usedPocket.length;
      UI.log(`[[icon:fire]] 火堆静悄悄——消耗口袋里没有可复原的卡牌${blockedN ? `（另有 ${blockedN} 张道具/装备不可在此复原）` : ''}`, 'dim');
    }
  }
  game._fireRestKey = null;
  consumeCurrentCell();
  game.state = 'idle';
  saveGame();
  UI.refresh(game);
}

// 消耗口袋复原选牌（picks = 最多复原张数；done = 结束回调）
// 2026-09-09 老板实测：原文字行在整屏场景壳上看不清、也不显示卡面——改为真卡面网格，点卡即复原
// 需求 #12：消耗的装备不能在火堆复原（与道具一样）——列表里直接滤掉，不可选
export function openClassChoice(options = {}) {
  const onCancel = typeof options.onCancel === 'function' ? options.onCancel : null;
  const beforeConfirm = typeof options.beforeConfirm === 'function' ? options.beforeConfirm : null;
  preloadAllNodeShellBgs();   // 只补首轮高频节点；其余场景在确认路线时按目标格预取
  // 玩家停留选角页时后台准备战斗域；不占标题首屏预算，又能让首场遭遇直接进入。
  const warmBattleRuntime = () => ensureBattleReady().catch(error => console.warn('[battle-loader] 选角页后台预取失败', error));
  if (globalThis.scheduler?.postTask) globalThis.scheduler.postTask(warmBattleRuntime, { priority: 'background' }).catch(() => {});
  else if (typeof requestIdleCallback === 'function') requestIdleCallback(warmBattleRuntime, { timeout: 3000 });
  else setTimeout(warmBattleRuntime, 500);
  if (SDT.Art && SDT.Art.warmClassRoster) SDT.Art.warmClassRoster();   // 头像条/大立绘五张 4K 图预热，防露底色（2026-09-19 走查 B8）
  const picks = CHARACTERS.map(c => c.rulesetId).filter(cl => SDT.Cards.classPool(cl).length);
  if (!picks.length) return;
  game.state = 'modal';
  // 只把合法的已有角色作为初始选择；没有旧选择时同步选中第一名角色，
  // 避免舞台已经显示角色但提交值仍为空（预览与实际状态分离的误导）。
  const previous = characterFor(game.characterId || game.myClass);
  let sel = previous && picks.includes(previous.rulesetId) ? previous.rulesetId : picks[0];
  let view = 'select'; // 'select' 主选角页 | 'pool' 二级卡池页
  const poolCount = cl => SDT.Cards.classPool(cl).length;
  // 主选角页（2026-09-06 留言重做，排版参考杀戮尖塔 2 选人界面）：
  // 选中角色大幅立绘居右撑满，左侧信息面板（名字/职业/熟练度），
  // 底部全角色头像条，左下角红色返回键、右下角大确认键；卡池收进二级页
  const render = () => {
    if (view === 'pool') return renderPool();
    const displaySel = sel || picks[0];
    const story = characterFor(displaySel);
    const lv = displaySel ? SDT.Meta.classLv(displaySel) : 0;
    // 熟练度进度（真实存档数据）：xp / 升级所需，满级显示 MAX
    const xp = displaySel ? SDT.Meta.classXP(displaySel) : 0;
    const maxed = !!displaySel && lv >= SDT.Meta.LEVEL_MAX;
    const need = maxed ? 0 : (lv ? SDT.Meta.xpForNext(lv) : 0);
    const clsPct = maxed ? 100 : need ? Math.min(100, Math.round(xp / need * 100)) : 0;
    const roster = picks.map(cl => ({ cl, c: characterFor(cl) }));
    UI.showOverlay('', `
      <div class="pg cls2-page">
        <div class="cls2-stage">
          ${displaySel ? `<div class="cls2-fullart">${SDT.Art.classFullArt(displaySel)}</div>` : ''}
          <aside class="cls2-panel" style="--cls-color:${story ? story.color : '#69aec2'}" data-wm="${escAttr(story ? story.id : '')}">
            ${story ? `
              <div class="cls2-eyebrow">WINTER EXPEDITION · CLASS SELECT</div>
              <div class="cls2-nameline">
                <h2 class="cls2-name">${esc(story.name)}</h2>
              </div>
              <div class="cls2-chips">
                <span class="cls2-chip cls2-chip-role">${esc(story.rulesetId)}</span>
                <span class="cls2-chip${sel ? ' cls2-chip-live' : ''}">${sel ? '本局人物' : '预览'}</span>
              </div>
              <div class="cls2-level">
                <div class="cls2-level-num"><i>LV</i>${lv}</div>
                <div class="cls2-level-meta">
                  <div class="cls2-xpbar"><span style="width:${clsPct}%"></span></div>
                  <div class="cls2-xptext">${maxed ? '熟练度已满级 MAX' : `${xp} / ${need} XP`}</div>
                  <div class="cls2-perk">[[icon:medal]] 出征加成 ${esc(SDT.Meta.perkText(lv))}</div>
                </div>
              </div>
              <div class="cls2-palette" title="人物配色">
                <i style="background:${story.hair}"></i><i style="background:${story.skin}"></i><i style="background:${story.outfit}"></i><i style="background:${story.color}"></i>
              </div>
              <dl class="cls2-stats">
                <div><dt>专属卡池</dt><dd>${poolCount(displaySel)}<i>张</i></dd></div>
                <div><dt>熟练加成</dt><dd>+${lv - 1}<i>生命</i></dd></div>
              </dl>
              <p class="cls2-story">${esc(CLASS_STORY[characterFor(displaySel)?.id] || '确认后以此人物进入远征，熟练度加成与职业卡将在确认时生效。')}</p>
              ${(SDT.Art.listSkins ? SDT.Art.listSkins(displaySel) : []).length ? `
                <div class="cls2-skins-wrap">
                  <div class="cls2-sub">皮肤 <i>SKINS</i></div>
                  <div class="cls2-skins">
                    <button class="cls2-skin-btn${SDT.Art.getSkin(displaySel) === 'default' ? ' sel' : ''}" data-act="clsSkin" data-cls="${escAttr(displaySel)}" data-skin="default">标准</button>
                    ${SDT.Art.listSkins(displaySel).map(s => `
                      <button class="cls2-skin-btn${SDT.Art.getSkin(displaySel) === s.id ? ' sel' : ''}" data-act="clsSkin" data-cls="${escAttr(displaySel)}" data-skin="${escAttr(s.id)}" title="${escAttr(s.name)}">${esc(s.name)}</button>`).join('')}
                  </div>
                </div>` : ''}
              <button class="ov-btn cls2-pool-btn" data-act="clsPool" ${sel ? '' : 'disabled'}>[[icon:cards]] 查看角色卡池（${poolCount(displaySel)} 张）</button>`
            : '<p class="cls2-hint">[[icon:medal]]<br>从下方选择一名角色</p>'}
          </aside>
        </div>
        <div class="cls2-strip">${roster.map(({ cl, c }) => `
          <button class="cls2-face${cl === sel ? ' sel' : ''}" data-act="selClass" data-cls="${escAttr(cl)}" title="${escAttr(c.name)}" aria-pressed="${cl === sel ? 'true' : 'false'}">
            ${SDT.Art.classArt(cl, true)}<b>${esc(c.name)}</b>
          </button>`).join('')}</div>
        <button class="cls2-back" data-act="cls2Quit" title="${onCancel ? '返回出发整备' : '返回标题界面'}"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 5.5 4 12l6.5 6.5M4.6 12H20" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button class="cls2-confirm" data-act="pickClass" ${sel ? '' : 'disabled'} title="${sel ? '出发' : '请先选择角色'}" aria-label="${sel ? '出发' : '请先选择角色'}"><span>${sel ? '出发' : '选择角色后出发'}</span><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 12.5 10 18 19.5 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
      </div>`, 'page');
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
  const poolPreviewHTML = (c) => {
    if (!c) return '<div class="pv-empty">[[icon:cards]]</div><p class="pv-hint">选择右侧卡牌<br>这里会显示档案预览</p>';
    const dmgRow = SDT.Cards.DMG_TYPES.includes(c.type) ? `<div class="pv-row"><span>伤害词条</span><b class="dmg-num">${c.dmg || 0}</b></div>` : '';
    return `${SDT.Cards.cardHTML(c, 'lg')}<div class="pv-meta">
      <div class="pv-row"><span>类型</span><b>${esc(c.type)}</b></div>
      <div class="pv-row"><span>稀有度</span><b>${esc(SDT.Cards.rarityOf(c))}</b></div>
      ${dmgRow}
    </div><p class="pv-hint">点击卡面可放大查看</p>`;
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
      return `<div class="pool-cell"><span class="pool-rarity-tag${ro === '棱彩' ? ' prism' : ''}">${esc(ro)}</span><button class="lib-cardwrap pool-card-button${i === 0 ? ' selected' : ''}" data-act="poolZoom" data-i="${index}" title="点击放大查看" aria-label="查看 ${escAttr(c.name)} 详情">${SDT.Cards.cardHTML(c)}</button></div>`;
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
      <div class="pg cls-pool-page" style="--cls-color:${story ? story.color : '#69aec2'}">
        <header class="pg-head">
          <div class="pool-archive-title"><span class="section-kicker">ROLE ARCHIVE // ${esc(characterName(sel))}</span><h2>[[icon:cards]] 角色卡池档案</h2></div>
          <div class="pool-head-stats"><span class="pool-head-badge"><b>${pool.length}</b><small>CARDS</small></span><span class="pool-head-caption">冬日档案 · ${esc(characterName(sel))}</span></div>
        </header>
        <div class="pool-main">
          <aside class="pool-side">
            <div class="pv-head">
              <span class="pv-kicker">CHARACTER ARCHIVE</span>
              <b class="pv-name">${esc(characterName(sel))}</b>
            </div>
            <div class="pv-body" id="poolPreview" aria-live="polite">${poolPreviewHTML(pool[0])}</div>
            <p class="pv-rule">[[icon:medal]] 确认选择「${esc(characterName(sel))}」后，将从 ${pool.length} 张人物卡中随机获得 1 张角色卡，并与 5 张「初始攻击」一起带入背包。</p>
          </aside>
          <section class="pool-catalog" aria-label="角色卡档案">
            <div class="pool-catalog-head"><div><span class="pool-catalog-kicker">COLLECTION INDEX</span><b>分类索引</b></div><div class="pool-result-summary">当前档案 <strong id="poolResultCount">${pool.length}</strong> 张</div></div>
            <nav class="pool-filters" id="poolFilters" aria-label="按卡牌类型筛选">${poolFilterHTML(pool)}</nav>
            ${poolGridHTML()}
          </section>
        </div>
        <footer class="cls-foot cls-foot-pool">
          <div class="pool-pager" id="poolPager">${poolPagerHTML()}</div>
          <button class="ov-btn" data-act="clsBack">[[icon:medal]] 返回选角</button>
          <button class="ov-btn ok" data-act="pickClass">出发</button>
        </footer>
      </div>`, 'page');
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
    if (SDT.Art && SDT.Art.decodeIn) SDT.Art.decodeIn(pv);   // 侧栏 lg 大图变体显式解码，防 IAB 合成黑窗（网格小卡已解码不代表大尺寸变体可用，2026-09-20 走查实锤）
    if (tick) Sfx.tick();
  };
  const bindPoolFocusPreview = () => {
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
    if (!w) return;   // 移出卡面：保留当前预览不动
    const i = Number(w.dataset.i);
    if (poolPreviewTimer) clearTimeout(poolPreviewTimer);
    poolPreviewTimer = setTimeout(() => {
      poolPreviewTimer = null;
      const c = (SDT.Cards.classPool(sel) || [])[i];
      if (c) showPoolPreview(w, true);
    }, 90);
  };
  UI.act('poolZoom', (d) => {
    const list = sel ? SDT.Cards.classPool(sel) : [];
    const c = list[Number(d.i)];
    if (c) UI.showCardZoom(c);
  });
  UI.act('poolPrev', () => { if (poolPage > 0) { poolPage--; renderPoolGrid(); } });
  UI.act('poolNext', () => {
    const filtered = filteredPool();
    const totalPages = Math.ceil(filtered.length / poolPageSize(filtered));
    if (poolPage < totalPages - 1) { poolPage++; renderPoolGrid(); }
  });
  UI.act('poolFilter', (d) => {
    if (d.filter === poolFilter) return;
    poolFilter = d.filter || 'all';
    poolPage = 0;
    renderPoolGrid();
  });
  UI.act('selClass', (d) => {
    if (d.cls === sel) return;
    sel = d.cls;
    SDT.Sound.sfx('characterSelect');
    render();
  });
  UI.act('clsPool', () => {
    if (!sel) return;
    view = 'pool';
    Sfx.tick();
    render();
  });
  UI.act('clsBack', () => {
    view = 'select';
    Sfx.tick();
    render();
  });
  UI.act('clsSkin', (d) => {   // 皮肤切换（2026-09-19）：只换选人页大立绘，会话内记忆不入存档
    SDT.Art.setSkin(d.cls, d.skin);
    const url = SDT.Art.skinUrl(d.cls, d.skin);
    document.querySelectorAll('.cls2-fullart img.art-figure, .cls2-fullart img.art-figure-back')
      .forEach(im => {
        im.src = url;
        im.classList.remove('skin-swap');
        void im.offsetWidth;   // 强制重排：连续切换也能重放过渡
        im.classList.add('skin-swap');
        // 注意：动画结束后保留 skin-swap 类——若摘除会回落到 cls2ArtIn 入场动画造成二次闪烁
      });
    document.querySelectorAll(`.cls2-skin-btn[data-cls="${d.cls}"]`)
      .forEach(b => b.classList.toggle('sel', b.dataset.skin === d.skin));
    Sfx.tick();
  });
  UI.act('cls2Quit', () => {   // 出发整备进来的选角页回整备；独立进入时仍回标题
    if (onCancel) { onCancel(); return; }
    // 迭代评审 09-20 客户端岗：setTimeout(240) 时序补丁退役——exitToTitle 现在自带
    // immediate 同步关层，淡出窗口竞态在 ui.js 层根治
    exitToTitle();
  });
  UI.act('pickClass', () => {
    if (!sel) return;
    const cl = sel;
    if (beforeConfirm && beforeConfirm() === false) return;
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
    if (card) {
      game.classCard = { ...card };
      game.ownedCards.push({ uid: newUid(), card: game.classCard, brought: 1 });
      UI.log(`[[icon:archive]] 获得角色卡【<b>${esc(card.name)}</b>】（${esc(characterName(cl))}）`, 'loot');
      if (card2 && card2.id !== card.id) {
        game.ownedCards.push({ uid: newUid(), card: { ...card2 }, brought: 1 });
        UI.log(`[[icon:archive]] 获得角色卡【<b>${esc(card2.name)}</b>】（${esc(characterName(cl))}）·第 2 张职业卡已入包`, 'loot');
      }
    }
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
    // 2026-09-19 留言 #16：开局发放的两张职业卡改走专门「启程 event」页——不再只靠
    // 日志静默入包，先展示卡面（获取并离开），再接启程过渡动画
    const grantedCards = [card, ...(card2 && card2.id !== card.id ? [card2] : [])].filter(Boolean);
    const currentContext = captureBattleContext(game, getActiveSlot);
    const transition = showRunTransition({
      tone: 'door', asset: 'scene-door-bg', eyebrow: 'EXPEDITION START',
      title: characterName(cl), detail: startLine, duration: 1600,
    });
    transition.then(completed => {
      if (completed === false || !transition.isCurrent() || !currentContext()) return;
      game.state = 'modal';
      nodeShell({
        tone: 'event', icon: '[[icon:medal]]', title: `${characterName(cl)} · 启程补给`,
        sub: `从${esc(characterName(cl))}的专属卡池抽得了 <b>${grantedCards.length}</b> 张职业卡——与 5 张【初始攻击】一起放入背包`,
        body: `<div class="bt-hand cls-grant-hand">${grantedCards.map(c => SDT.Cards.cardHTML(c)).join('')}</div>
          <p class="ov-note">职业卡带出对局后留在仓库（不占消耗口袋）；本局内打出后与其他卡同规则结算。</p>`,
        foot: `<button class="ov-btn ok cls-grant-go" data-act="clsGrantGo"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 获取并离开</button>`,
      });
      UI.act('clsGrantGo', () => {
        if (!transition.isCurrent() || !currentContext()) return;
        UI.hideOverlay();
        game.state = 'idle';
        saveGame();
        UI.refresh(game);
      });
    });
  });
  render();
}

export function openDoorModal(door, cellDef) {
  game.state = 'modal';
  game.discoveredPairs.add(door.pair);
  const target = game.layerData[door.toLayer] || { name: `第${door.toLayer + 1}层` };
  // 2026-09-09 需求 #13：只能在第三层（紧急撤离点）与第四层（终局撤离点）撤离——
  // 环间门不再提供撤离选项，只能向深处走
  nodeShell({
    tone: 'door', icon: '[[icon:door]]', title: '环间门',
    sub: `这道隔离闸门连通 <b>${target.name}</b>——闸门只向深处放行，不能停留`,
    body:
      nodeOpt('goDoor', `${door.reverse ? '返回' : '进入'}${target.name}`, '穿过闸门，前往另一环', 'ok') +
      (cellDef && cellDef.type === 'shop' ? nodeOpt('doorShop', '逛商队', '闸门旁的拾荒商队还在营业') : ''),
  });
  UI.act('goDoor', () => {
    UI.hideOverlay();
    UI.log(`穿过隔离闸门 → <b>${target.name}</b>`, 'sys');
    // 穿门换层走镜头补间（2026-09-27 二轮动效）：壁纸交叉溶解 + 相机滑入新环，不再硬切
    enterLayer(door.toLayer, door.arriveAt, { glideCam: true });
    SDT.Sound.sfx('layerEnter');
  });
  UI.act('doorShop', () => openShop('door:' + door.pair));
  UI.refresh(game);
}

// ---------- 第四层终局：祭坛格（弃3激活选奖励）→ 首脑格 → 终局撤离点 ----------
// 祭坛：弃掉背包 3 张牌激活后二选一奖励；集齐 2 枚员工通行证A碎片可不走弃牌直接换能力卡。
// 激活（或兑换）成功才算触发过本格；离开未激活可再来。首脑格必须先激活祭坛。
export function openAltarRitual(def) {
  game.state = 'modal';
  // 需求（2026-09-13 老板）：祭坛的选项和奖励只能选一次——激活后不再重复展示弃3/碎片等
  // 激活选项：奖励未领取时重进直接进回赠面板；奖励已领取则本格视为完全消耗
  if (game.altarActivated && game.altarRewardPending) { openAltarReward(); return; }
  if (game.altarActivated) {
    UI.log('[[icon:crystal]] 这座祭坛的仪式已经完成，没有什么可做的了', 'sys');
    finishInstant();
    return;
  }
  const frags = game.fragments || 0;
  // 碎片不足时不再隐藏选项，改为禁用态并说明原因（2026-09-10 撤离测试：玩家不知道选项为何消失）
  const fragOpt = frags >= 2
    ? nodeOpt('altarFragHero', `献上 2 枚员工通行证A碎片（不弃牌）`, `获得 1 张本职业随机能力卡（现有碎片 ${frags}）`, 'ok')
    : nodeOpt('altarFragLocked', '献上 2 枚员工通行证A碎片（不弃牌）', `碎片不足（现有 ${frags}/2）——集齐 2 枚后可在任意祭坛直接兑换能力卡`, '', 'disabled title="员工通行证A碎片不足，无法兑换"');
  nodeShell({
    tone: 'altar', icon: '[[icon:crystal]]', title: '污染祭坛',
    sub: '弃掉背包中 3 张卡牌激活祭坛，任选一项奖励' +
      (frags >= 2 ? '；也可以不弃牌，直接献上 2 枚员工通行证A碎片换取能力卡' : ''),
    body:
      nodeOpt('altarOn3', '弃 3 张 · 激活祭坛', '激活后二选一：① 复原 3 张消耗卡 + 回复 10 血；② 随机获取 1 张传说卡和 1 张装备卡', 'ok') +
      fragOpt +
      (game.altarItemSacrificed
        ? nodeOpt('altarItemUsed', '献祭道具 · 已用过', '这座祭坛的道具献祭已受理过一次，不再 repeat——换其他方式激活，或直接离开', '', 'disabled title="道具献祭每座祭坛限一次"')
        : game.ownedCards.some(o => o.card.type === '道具')
          ? nodeOpt('altarItemRestore', '献祭道具 · 复原卡牌', '献祭 1 张道具卡，从消耗口袋复原 2 张卡牌（每座祭坛限一次）')
          : nodeOpt('altarItemNoItem', '献祭道具 · 复原卡牌', '背包里没有道具卡——先弄到一张道具卡，再回来献祭复原', '', 'disabled title="背包里没有道具卡"')) +
      nodeOpt('altarLeave', '离开', '祭坛保持沉睡——回到当前格子，稍后再来'),
  });
  const markActivated = () => {
    SDT.Sound.sfx('altarActivate');
    game.altarActivated = true;
    game.visited = game.visited || {};
    game.visited[game.layerIdx + ',' + game.trackPos] = 1;   // 激活成功才消耗本格
  };
  // 献祭道具复原（2026-09-10 需求）：1 张道具卡 → 从消耗口袋复原 2 张；
  // 每座祭坛限一次（2026-09-19 老板定版：真加一次性锁，标记随存档持久化）
  UI.act('altarItemRestore', () => {
    if (game.altarItemSacrificed) { UI.log('[[icon:crystal]] 这座祭坛的道具献祭已经受理过了', 'warn'); return; }
    if (!game.ownedCards.some(o => o.card.type === '道具')) { UI.log('[[icon:bag]] 背包里没有道具卡可供献祭', 'warn'); return; }
    const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
    if (!game.usedPocket.length || !restorableN) { UI.log('[[icon:bag]] 消耗口袋里没有可复原的卡牌——先去战斗吧', 'warn'); return; }
    openBagSacrifice(1, (chosen) => {
      game.altarItemSacrificed = true;   // 确认献祭才上锁；取消献祭不上锁
      SDT.Sound.sfx('altarOffer');
      UI.log(`[[icon:crystal]] 献上道具【<b>${esc(chosen[0].card.name)}</b>】——从消耗口袋复原卡牌（本祭坛的道具献祭已用完）`, 'loot');
      saveGame();
      // 祭坛道具路径的复原页跟祭坛身份，不落默认「营火休整」（同 openAltarReward 口径）
      openPocketRestore(Math.min(2, restorableN), () => { saveGame(); openAltarRitual(def); }, {
        tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 复原',
      });
    }, () => openAltarRitual(def), '道具');
  });
  UI.act('altarOn3', () => {
    if (game.ownedCards.length < 3) { UI.log('[[icon:bag]] 背包卡牌不足 3 张，无法激活祭坛', 'warn'); return; }
    openBagSacrifice(3, (chosen) => {
      markActivated();
      UI.log(`[[icon:crystal]] 献上 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}——<b>祭坛苏醒了</b>，请选择一项奖励`, 'loot');
      saveGame();
      openAltarReward();
    }, () => openAltarRitual(def));
  });
  UI.act('altarFragHero', () => {
    // 2026-09-10 留言 #30：职业缺失/英雄池为空时此前只写一条侧边日志就 return——
    // 玩家点了按钮界面毫无变化，看起来像「碎片无法激活」。改为弹窗明示，碎片原样保留。
    const pool = game.myClass ? SDT.Cards.classPool(game.myClass).filter(c => c.type === '能力卡') : [];
    if (!pool.length) {
      nodeShell({
        tone: 'altar', icon: '[[icon:crystal]]', title: '碎片兑换 · 暂不可用',
        sub: `${game.myClass ? '【' + esc(game.myClass) + '】职业目前没有可兑换的能力卡' : '还没有选定职业'}——员工通行证A碎片已原样保留（现有 ${(game.fragments || 0)} 枚）`,
        body: nodeOpt('altarFragBack', '返回祭坛', '换个方式激活，或留着碎片以后再兑'),
      });
      UI.act('altarFragBack', () => openAltarRitual(def));
      UI.refresh(game);
      return;
    }
    const card = pool[Math.floor(Random.random('loot') * pool.length)];
    // 先发牌、后扣碎片：背包满时发卡会被拒收（现场播报），不能白扣 2 枚碎片
    if (!grantEventCard(card)) return;
    game.fragments = (game.fragments || 0) - 2;
    markActivated();
    UI.log(`[[icon:gem]] 献上 2 枚员工通行证A碎片（剩 ${game.fragments}）——获得本职业能力卡【<b>${esc(card.name)}</b>】；<b>祭坛苏醒了</b>`, 'loot');
    saveGame();
    finishInstant();
  });
  UI.act('altarLeave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); UI.refresh(game); });
  UI.refresh(game);
}

// 激活后的奖励二选一（弃 3 张已支付）。奖励只能领取一次：进入即置待领标记，
// 领取消耗标记；离开保留标记——回到本格可直接再进本面板（见 openAltarRitual / resolveCell）
function openAltarReward() {
  SDT.Sound.sfx('altarReward');
  game.state = 'modal';
  game.altarRewardPending = true;
  // 2026-09-10 留言 #33：消耗口袋没有可复原卡牌（或全是不可复原的道具/装备）时，
  // 选项①要如实标注——否则选了它只会看到空列表，感觉「无法复原」
  const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
  const restoreOpt = restorableN
    ? nodeOpt('altarRewardRestore', '① 复原 3 张消耗卡 + 回复 10 血', `从消耗口袋挑选卡牌复原回背包（现有 ${restorableN} 张可复原${restorableN < 3 ? '，不足 3 张时全复原' : ''}），并回复 10 点生命`, 'ok')
    : nodeOpt('altarRewardRestoreOff', '① 复原 3 张消耗卡 + 回复 10 血', '消耗口袋里没有可复原的卡牌（道具/装备类消耗不可复原）——此项不可选', '', 'disabled title="消耗口袋里没有可复原的卡牌，请选奖励②"');
  nodeShell({
    tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 二选一',
    sub: '祭坛已苏醒——选择你要的奖励（只能选一次；离开后回到本格可再选）',
    body:
      restoreOpt +
      nodeOpt('altarRewardLoot', '② 传说卡 + 装备卡', '随机获取 1 张传说卡和 1 张装备卡') +
      nodeOpt('altarRewardLeave', '离开 · 稍后再选', '祭坛保持苏醒——奖励保留，回到本格可再选（奖励只能领取一次）'),
  });
  UI.act('altarRewardRestore', async () => {
    game.altarRewardPending = false;   // 领取即消耗：奖励只能选一次
    const before = game.hp;
    game.heal(10);
    UI.log(`[[icon:heart]] 祭坛回赠：回复 <b>${Math.max(0, game.hp - before)}</b> 点生命（${game.hp}/${game.maxHp}）`, 'heal');
    UI.hideOverlay();
    openPocketRestore(3, () => { saveGame(); finishInstant(); }, {
      tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 复原',
    });
  });
  UI.act('altarRewardLoot', () => {
    game.altarRewardPending = false;   // 领取即消耗：奖励只能选一次
    const legend = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
    const equips = SDT.Cards.all().filter(c => c.type === '装备' && SDT.Cards.isRandomObtainable(c));
    const legendPick = legend.length ? legend[Math.floor(Random.random('loot') * legend.length)] : null;
    if (legendPick) grantEventCard(legendPick);
    // 同一奖励内不得重复（2026-09-13 老板口径）：传说装备卡（不朽神剑/混沌之眼等）同时
    // 属于两个池，两池各自随机时会把同一张牌发两次；装备池里排掉已发的那张再抽
    const restEquips = equips.filter(c => !legendPick || (c.id !== legendPick.id && c.name !== legendPick.name));
    if (restEquips.length) grantEventCard(restEquips[Math.floor(Random.random('loot') * restEquips.length)]);
    UI.log('[[icon:crystal]] 祭坛回赠：随机获得 1 张<b>传说卡</b>和 1 张<b>装备卡</b>（见背包）', 'loot');
    saveGame();
    finishInstant();
  });
  UI.act('altarRewardLeave', () => { UI.hideOverlay(); finishInstant(); });
  UI.refresh(game);
}

// 首脑格：必须先激活祭坛；三首脑任选其一挑战，胜利后终局撤离点放行
export function openBossGate() {
  game.state = 'modal';
  if (!game.altarActivated) {
    nodeShell({
      tone: 'altar', icon: '[[icon:skull]]', title: '首脑巢穴 · 封印中',
      sub: '三位首脑被污染祭坛的辐射护盾庇护——先激活祭坛（弃 3 张卡牌），再来挑战',
      body: nodeOpt('bossBounce', '离开', '首脑格不消耗——先去激活祭坛，随时回来挑战', 'ok'),
    });
    UI.act('bossBounce', () => {
      UI.hideOverlay();
      // 首脑格未激活祭坛时不置 visited（见 resolveCell 的 ritualPending），原地离开即可；
      // 此前按「数组下标-1」回退，2000 种子里 28.2% 的落点与首脑格不相邻（等于穿墙传送）
      game.state = 'idle';
      saveGame();
      UI.refresh(game);
    });
    UI.refresh(game);
    return;
  }
  // 2026-09-09 玩法定版：三首脑（5-50 / 4-45 / 8-48）随机一个坐镇，进入本格即告知，
  // 让玩家在编组牌库前就知道要面对谁（编组界面也会再次显示首脑与词缀）。
  // 2026-09-13 老板拍板：首脑每层 roll 一次存全层（game.bossPlan，进层重置/读档恢复）——
  // 层内重进 boss 格不再换人，面板/编组/实战三处口径恒一致。
  if (game.bossPlan == null) {
    game.bossPlan = Math.floor(Random.random('boss') * MAP.altar.bosses.length);
  }
  const bossIdx = game.bossPlan % MAP.altar.bosses.length;
  const b = MAP.altar.bosses[bossIdx];
  const aff = b.affix ? MAP.altar.bosses[bossIdx].affixDesc : '';
  nodeShell({
    tone: 'altar', icon: '[[icon:demon]]', title: '首脑巢穴 · 决战',
    sub: `本层首脑：<b>${esc(b.name)}（${b.atk}-${b.hp}）</b>${aff ? ` · 词缀【${esc(b.affixName)}】${esc(aff)}` : ''}——胜利后终局撤离点放行`,
    body:
      nodeOpt('fightBoss', '编组牌库，迎战首脑', '从背包选 15 张招式/装备/能力卡，附加 5 张初始攻击（混沌之眼可多带 5 张）', 'ok') +
      nodeOpt('bossLeave', '暂不挑战', '留在当前格子（本格不消耗，可再来）'),
  });
  UI.act('fightBoss', async () => {
    UI.hideOverlay();
    const bossFoe = scaledEnemy(b);
    bossFoe.boss = true;   // 首脑死亡立即结束战斗（2026-09-16 留言 #25）
    await startBattle(game, bossFoe, { isBoss: true, name: b.name });
  });
  UI.act('bossLeave', () => { UI.hideOverlay(); game.state = 'idle'; saveGame(); UI.refresh(game); });
  UI.refresh(game);
}

// 背包献祭选卡器（2026-09-06 #26）：从背包选 n 张卡，确认后消耗并回调
// onCancel：取消时的回流（缺省回祭坛面板）
function openBagSacrifice(n, done, onCancel, filterType) {
  game.state = 'modal';
  const sel = new Set();
  const back = onCancel || (() => openAltarRitual(curLayer()?.logical?.[game.trackPos]?.def));
  const eligible = filterType ? game.ownedCards.filter(o => o.card.type === filterType) : game.ownedCards;
  const render = () => {
    // 2026-09-10 留言 #31/#32：原文字行看不清也看不到卡面——改为真卡面网格（口径同火堆复原），
    // 点卡选中/取消，选中卡挂黄铜图钉角标
    const rows = eligible.map(o => `
      <div class="bt-card sac-card${sel.has(o.uid) ? ' sel' : ''}" data-act="sacPick" data-uid="${escAttr(o.uid)}"
        title="${escAttr(`${o.card.name}${o.card.cost != null ? ` · ${o.card.cost} 费` : ''}——${o.card.desc || '点击选中/取消'}`)}">
        ${SDT.Cards.cardHTML(o.card, 'sm')}
        ${o.card.cost != null ? `<span class="bt-sac-cost">${o.card.cost} 费</span>` : ''}
      </div>`).join('');
    UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌', `
      <p class="ov-note">选择 <b>${n}</b> 张${filterType ? `<b>${escAttr(filterType)}</b>卡` : '卡牌'}献祭（已选 <b>${sel.size}</b>）</p>
      <div class="bt-hand sac-hand">${rows || '<p class="ov-empty">背包里没有符合条件的卡牌</p>'}</div>
      <div class="scene-ops">
        <button class="ov-btn ok" data-act="sacConfirm" ${sel.size !== n ? 'disabled' : ''}>[[icon:crystal]] 确认献祭</button>
        <button class="ov-btn" data-act="sacCancel">[[icon:exit]] 取消</button>
      </div>`, 'discover');
  };
  UI.act('sacPick', (d) => {
    const o = eligible.find(x => x.uid === d.uid);
    if (!o) return;
    if (sel.has(o.uid)) sel.delete(o.uid);
    else if (sel.size < n) sel.add(o.uid);
    Sfx.tick();
    render();
  });
  UI.act('sacCancel', () => { UI.hideOverlay(); back(); });
  UI.act('sacConfirm', () => {
    const chosen = eligible.filter(o => sel.has(o.uid));
    game.ownedCards = game.ownedCards.filter(o => !sel.has(o.uid));
    UI.hideOverlay();
    done(chosen);
  });
  render();
}

// 撤离点弹窗（四层定版：只能在第三层紧急撤离、第四层击败首脑后终局撤离）
//   第三层紧急撤离点：献祭 3 张卡牌后撤离；
//   第四层终局撤离点：击败首脑后无条件撤离（未击败则锁定）。
export function emergencyExitPaymentState(cardCount) {
  const available = Math.max(0, Number(cardCount) || 0);
  return { required: 3, available, canPay: available >= 3 };
}

export function openEmergencyModal() {
  game.state = 'modal';
  // 随身币不随撤离带回（Item 18 / 离局清零）——撤离面板显式提醒未花掉的币（2026-09-19 审计 D-2）
  const coinHint = game.coins > 0
    ? `<p class="ov-note">[[icon:coin]] 提醒：随身 <b class="gold">${game.coins}</b> 币不会带回基地——离开前记得回商店花掉。</p>`
    : '';
  const def = curLayer()?.logical?.[game.trackPos]?.def;
  const isEmergency = def && def.type === 'emergencyExit';
  if (isEmergency) {
    // 第三层 · 紧急撤离点（旧档在第 1/2/4 层生成的撤离点一律停用）
    if (game.layerIdx !== 2) {
      nodeShell({
        tone: 'exit', icon: '[[icon:lock]]', title: '停用的撤离点',
        sub: '撤离信标没有响应——只有第三层的紧急撤离点仍在工作',
        body: nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
      });
      UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
      UI.refresh(game);
      return;
    }
    const payment = emergencyExitPaymentState(game.ownedCards.length);
    nodeShell({
      tone: 'exit', icon: '[[icon:cross]]', title: '紧急撤离点',
      sub: '紧急信标过载——撤离前必须献祭 3 张卡牌作为代价',
      body:
        coinHint +
        nodeOpt('payExit', '紧急撤离（献祭 3 张卡牌）', payment.canPay
          ? '从背包选择 3 张卡牌献祭，带着剩余战利品返回基地'
          : `卡牌不足（现有 ${payment.available}/3）——至少需要 3 张卡牌`, payment.canPay ? 'ok' : '', payment.canPay ? '' : 'disabled title="至少需要 3 张卡牌"') +
        nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
    });
    UI.act('payExit', () => {
      if (!emergencyExitPaymentState(game.ownedCards.length).canPay) {
        UI.log('[[icon:cross]] 背包卡牌不足 3 张，无法支付紧急撤离的代价', 'warn');
        SDT.Sound.sfx('error');
        return;
      }
      UI.hideOverlay();
      openBagSacrifice(3, () => {
        UI.log('[[icon:crystal]] 献祭了 3 张卡牌——紧急信标充能完毕', 'sys');
        doExtract();
      }, () => openEmergencyModal());
    });
    UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
    UI.refresh(game);
    return;
  }
  // 第四层 · 终局撤离点：击败首脑后无条件撤离
  if (game.bossKilled) {
    nodeShell({
      tone: 'exit', icon: '[[icon:exit]]', title: '终局撤离点',
      sub: '污染核心的首脑已被击破——撤离信标无条件放行',
      body:
        coinHint +
        nodeOpt('payExit', '立即撤离', '带着全部战利品返回基地', 'ok') +
        nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
    });
  } else {
    nodeShell({
      tone: 'exit', icon: '[[icon:lock]]', title: '终局撤离点',
      sub: '撤离信标被污染核心压制——击败第四层的首脑后才能撤离',
      body: nodeOpt('stayHere', '继续深入', '留在地图上，继续选择相邻节点'),
    });
  }
  UI.act('payExit', () => {
    SDT.Sound.sfx('extractionConfirm');
    UI.log('启动撤离信标，准备返回基地', 'sys');
    UI.hideOverlay();
    doExtract();
  });
  UI.act('stayHere', () => { UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
  UI.refresh(game);
}

// 撤离成功 → 「整理入库」交互：把背包中的物品放回仓库（不入库的会丢失）。
// 「初始攻击」为初始牌不可入库；木材/口粮自动入库；消耗口袋逐张 1/3 概率保留（散失的不复原）。
let extractLeft = null;   // 待整理的卡牌堆 [{card, count}]（撤离整理页暂存）
let extractionStarting = false;
let extractViewRevision = 0;

export function resumeExtraction(pending) {
  const checked = validatePendingExtraction(pending);
  if (!checked.ok) return checked;
  game.pendingExtraction = pending;
  game.extractionPending = false;
  game.runActive = true;
  game.state = 'modal';
  extractLeft = pending.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
  renderExtractStash();
  return { ok: true };
}

export async function doExtract() {
  if (!game.runActive || game.pendingExtraction || extractionStarting) return false;
  // 撤离前先落盘（09-27 撤离保存失败修复）：saveGame 只在部分节点结算时触发——
  // 低血速通路线（跳宝箱、直奔撤离点）可全程零存档，begin 的 readCurrent 读到
  // 不存在的 RUN_KEY 报「版本或结构无效」→ extractRetry 重试页每按一次都重复失败，
  // 玩家被锁死在撤离页（agent 实测 V 底 8 局死锁）。撤离前写一次当前局面即消除
  saveGame();
  extractionStarting = true;
  const startedFromSlot = getActiveSlot();
  const initialIdentity = startedFromSlot ? RunStorage.readIdentity(startedFromSlot) : null;
  const pendingToken = game.extractionPending && typeof game.extractionPending === 'object'
    ? game.extractionPending : { slotId: startedFromSlot, runId: initialIdentity?.ok ? initialIdentity.value.runId : null };
  game.extractionPending = pendingToken;
  game.state = 'modal';
  try {
    const started = await extractionCommands.begin();
    if (game.extractionPending !== pendingToken || getActiveSlot() !== startedFromSlot) return false;
    if (!started.ok) {
      if (pendingToken.slotId !== startedFromSlot ||
          (pendingToken.runId && started.runId && pendingToken.runId !== started.runId)) return false;
      pendingToken.runId ||= started.runId || null;
      UI.log(`[[icon:cross]] 撤离整理尚未保存：${started.message || started.code}，可重试`, 'warn');
      showExtractionRetry();
      return false;
    }
    if (getActiveSlot() !== startedFromSlot) return false;
    if (pendingToken.slotId !== startedFromSlot || (pendingToken.runId && pendingToken.runId !== started.value.runId)) return false;
    if (startedFromSlot) {
      const identity = RunStorage.readIdentity(startedFromSlot);
      if (!identity.ok || identity.value.runId !== started.value.runId) return false;
    }
    game.extractionPending = false;
    game.pendingExtraction = started.value;
    game.runActive = true;
    SDT.Sound.sfx('extractionSuccess');
    SDT.Sound.music('title');
    const { totalPocketCount, lostPocketCount } = started.value;
    if (totalPocketCount > 0) {
      UI.log(`[[icon:pocket]] 撤离结算：消耗口袋 <b>${totalPocketCount}</b> 张只有 1/3 保留（带回 ${totalPocketCount - lostPocketCount} 张，散失 ${lostPocketCount} 张）`, 'sys');
    }
    extractLeft = started.value.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
    renderExtractStash();
    return true;
  } catch (error) {
    if (game.extractionPending !== pendingToken || getActiveSlot() !== startedFromSlot) return false;
    UI.log(`[[icon:cross]] 撤离整理保存遇到错误：${error?.message || error}，请重试`, 'warn');
    showExtractionRetry();
    return false;
  } finally {
    extractionStarting = false;
  }
}

function showExtractionRetry() {
  game.state = 'modal';
  // SYS-10 同款兜底说明（A5-EXRETRY-01）：doExtract 撤离前已 saveGame 落盘，退出重进安全
  UI.showOverlay('', '<div class="pg hub"><h2>撤离结算待恢复</h2><p>撤离已成功，整理快照尚未确认写入。请重试保存后继续。</p><p class="ov-note">[[icon:info]] 撤离前的局面已保存——若反复失败，可以退出游戏重新进入，会回到撤离前的位置，不会重复扣卡。</p><button class="ov-btn ok" data-act="extractRetry">重试撤离整理</button></div>', 'page');
  UI.act('extractRetry', () => { UI.hideOverlay(); doExtract(); });
}

function renderExtractStash() {
  const B = SDT.Base;
  const viewRevision = ++extractViewRevision;
  const viewSlot = getActiveSlot();
  const viewRunId = game.pendingExtraction?.runId;
  const stillThisView = (finished = false) => viewRevision === extractViewRevision && getActiveSlot() === viewSlot &&
    (game.pendingExtraction?.runId === viewRunId || (finished && !game.runActive && !game.pendingExtraction));
  const woodN = game.inventory.filter(i => i.name === '木材').reduce((a, b) => a + b.count, 0);
  const ratN = game.inventory.filter(i => i.name === '口粮').reduce((a, b) => a + b.count, 0);
  const shaN = game.ownedCards.filter(o => B.isSha(o.card)).length;
  const otherN = game.inventory.filter(i => i.name !== '木材' && i.name !== '口粮')
    .reduce((a, b) => a + b.count, 0);
  const room = B.stashRoom();
  // EXP-003（2026-09-29）：消耗口袋行如实展示 1/3 逐张结算结果（保留数/散失数来自撤离掷骰快照）
  const pocketPending = game.pendingExtraction;
  const pocketTotal = pocketPending && Number.isInteger(pocketPending.totalPocketCount) ? pocketPending.totalPocketCount : null;
  const pocketNote = pocketTotal == null
    ? '每张仅 1/3 概率带回（进基地口袋，钥匙可复原）'
    : (pocketTotal > 0
      ? `每张 1/3 概率保留 · 带回 ${pocketTotal - (pocketPending.lostPocketCount || 0)} 张（基地可复原）· 散失 ${pocketPending.lostPocketCount || 0} 张`
      : '本局没有消耗卡 · 每张仅 1/3 概率带回');
  // 2026-09-19 留言 #28：整理页重做——背包卡牌区从文字行改为点卡即入库的卡面网格
  // A5-EXSTASH-01：带入卡（o.brought，出发时已离库）未入库即永久损失，与局内获得区分表达
  const broughtByName = new Map();
  for (const o of game.ownedCards) {
    if (!o.brought) continue;
    broughtByName.set(o.card.name, (broughtByName.get(o.card.name) || 0) + 1);
  }
  const rows = `<div class="ext-cards">${extractLeft.map((s, i) => {
    const fits = s.count <= Math.max(0, room);
    const broughtN = broughtByName.get(s.card.name) || 0;
    const broughtTip = broughtN ? `；含出发带入 ${broughtN} 张——带入卡未入库即永久损失` : '';
    return `<div class="ext-card${fits ? '' : ' off'}" data-act="exStash" data-i="${i}" role="button" tabindex="0"
      aria-label="入库 ${escAttr(s.card.name)}${broughtN ? '（含带入卡）' : ''}" title="${fits ? '点击入库' : '仓库容量不足'}——【${escAttr(s.card.name)}】×${s.count}${broughtTip}">
      ${SDT.Cards.cardHTML(s.card, 'sm')}
      ${s.count > 1 ? `<span class="bt-count" title="同名卡牌 ${s.count} 张">×${s.count}</span>` : ''}
      ${broughtN ? `<span class="ext-brought" title="出发时带入 ${broughtN} 张——未入库将永久损失">带入 ×${broughtN}</span>` : ''}
      ${fits ? '' : '<span class="ext-noroom">容量不足</span>'}
    </div>`;
  }).join('') || '<p class="ov-empty" style="margin:6px 0 0">背包里没有可入库的卡牌。</p>'}</div>`;
  const shaRow = shaN
    ? `<div class="pk-row dep-row locked"><span>[[icon:cards]] [[icon:lock]] <b>初始攻击</b> ×${shaN}
        <span class="dim">· 初始牌不可入库（每局自动携带 ${MAP.rules.starterSha} 张）</span></span>
        <span class="dim">遗落</span></div>`
    : '';
  const totalLeft = extractLeft.reduce((a, b) => a + b.count, 0);
  game.state = 'done';
  _set_cardPageOpen(false);   // 整理页必须点「完成整理」结束（防止 Esc 绕过丢失提醒）
  UI.registerHelp('extract', {
    title: '整理入库说明',
    html: `
      <p class="help-item"><b>背包卡牌</b>点击「入库」放回仓库；仓库容量不足时无法入库，未入库的卡牌将在撤离中丢失。</p>
      <p class="help-item"><b>自动入库</b>木材/口粮自动入库（纯资源没有丢弃的意义）；消耗口袋逐张结算，每张仅 1/3 概率带回——保留的进基地口袋（用钥匙复原），未带回的散失；「初始攻击」不可入库（每局自动携带）。</p>
      <p class="help-item"><b>仓库容量</b>可在基地「升级」页用 [[icon:wood]] 木材×${MAP.rules.stashUpgradeWood} 扩建 +${MAP.rules.stashUpgradeSlots} 张；仓库里的卡牌下次出发时可以携带。</p>`,
    back: () => renderExtractStash(),
  });
  UI.showOverlay('', `
    <div class="pg hub result-pg" id="exMain">
      <header class="hub-head">
        <h2>[[icon:exit]] 撤离成功 · 整理入库</h2>
        ${UI.helpBtn('extract')}
        <span class="sub">把背包中的物品放回仓库——未入库的卡牌将在撤离中丢失</span>
        <span class="pg-spacer"></span>
        <span class="hub-res">
          <span class="res-chip">[[icon:archive]] 仓库容量 <b class="${room <= 0 ? 'fulled' : ''}">${B.stashUsed()}/${B.stashCap()}</b> 张</span>
          <span class="res-chip">[[icon:coin]] 随身币不带回（<b>${game.coins}</b> 币留在局中）</span>
        </span>
      </header>
      <div class="result-summary"><span class="result-kicker">EXTRACTION REPORT</span><b>战利品已回收，正在等待你的入库决定</b><span>容量 ${B.stashUsed()}/${B.stashCap()} · 未入库卡牌会在完成整理时丢失</span></div>
      <div class="dep-body result-columns">
        <section class="hub-card">
          <h3>[[icon:bag]] 背包卡牌 <span class="hub-card-tip">点击卡面放入仓库</span></h3>
          <div class="dep-list">${rows}${shaRow}</div>
        </section>
        <section class="hub-card">
          <h3>[[icon:archive]] 自动入库</h3>
          <div class="pk-row"><span>[[icon:wood]] 木材 ×<b>${woodN}</b></span><span class="dim">已入库（扩建背包/仓库用）</span></div>
          <div class="pk-row"><span>[[icon:bread]] 口粮 ×<b>${ratN}</b></span><span class="dim">已入库（升级安全格用）</span></div>
          ${otherN ? `<div class="pk-row"><span>[[icon:bag]] 其余物资 ×<b>${otherN}</b></span><span class="dim">未能带出 · 价值已计入本局得分</span></div>` : ''}
          <div class="pk-row"><span>[[icon:pocket]] 消耗口袋</span><span class="dim">${pocketNote}</span></div>
          ${extractLeft.length ? `<button class="ov-btn ok" data-act="exAll" ${room > 0 && totalLeft <= room ? '' : 'disabled'}
            style="width:100%">[[icon:archive]] 全部入库（${Math.min(totalLeft, room)}/${totalLeft} 张可入）</button>` : ''}
          <div class="dep-foot" style="margin-top:10px">
            <button class="ov-btn ok" data-act="exSmart" style="width:100%;margin-top:8px">[[icon:sparkles]] 智能整理（优先价值最高 · 上限仓库空格）</button>
            <button id="btnDeploy" data-act="exFinish">[[icon:check]] 完成整理${extractLeft.length ? `（${totalLeft} 张将丢失）` : ''}</button>
          </div>
        </section>
      </div>
    </div>`, 'page');
  UI.act('exStash', async (d) => {
    const s = extractLeft[+d.i];
    if (!s) return;
    const r = B.stashRoom();
    if (r <= 0) return;
    const take = Math.min(s.count, r);
    const saved = await extractionCommands.updateCards([{ name: s.card.name, count: take }], viewRunId, viewSlot);
    if (!stillThisView()) return;
    if (!saved.ok) { UI.log(`[[icon:cross]] 入库未保存：${saved.message || saved.code}，可重试`, 'warn'); return; }
    if (saved.unchanged) return;
    SDT.Sound.sfx('stashDeposit');
    UI.log(`[[icon:archive]] 【<b>${esc(s.card.name)}</b>】×${take} 已放入仓库`, 'loot');
    extractLeft = saved.value.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
    renderExtractStash();
  });
  UI.act('exAll', async () => {
    const selections = extractLeft.map(s => ({ name: s.card.name, count: s.count }));
    const saved = await extractionCommands.updateCards(selections, viewRunId, viewSlot);
    if (!stillThisView()) return;
    if (!saved.ok) { UI.log(`[[icon:cross]] 入库未保存：${saved.message || saved.code}，可重试`, 'warn'); return; }
    if (saved.count) { SDT.Sound.sfx('stashDeposit'); UI.log(`[[icon:archive]] 全部入库：<b>${saved.count}</b> 张已放入仓库（仓库余 ${B.stashRoom()} 格）`, 'loot'); }
    extractLeft = saved.value.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
    renderExtractStash();
  });
  // 智能整理（2026-09-16 留言 #27）：一键入库，数量在仓库空格内、优先价值最高的卡牌
  UI.act('exSmart', async () => {
    let room = B.stashRoom();
    const ordered = extractLeft.slice().sort((a, b) => SDT.Cards.sellPrice(b.card) - SDT.Cards.sellPrice(a.card));
    const selections = [];
    for (const s of ordered) {
      if (room <= 0) break;
      const take = Math.min(s.count, room);
      selections.push({ name: s.card.name, count: take });
      room -= take;
    }
    const saved = await extractionCommands.updateCards(selections, viewRunId, viewSlot);
    if (!stillThisView()) return;
    if (!saved.ok) { UI.log(`[[icon:cross]] 智能整理未保存：${saved.message || saved.code}，可重试`, 'warn'); return; }
    if (saved.count) { SDT.Sound.sfx('stashDeposit'); UI.log(`[[icon:archive]] 智能整理：按价值入库 <b>${saved.count}</b> 张（仓库余 ${B.stashRoom()} 格）`, 'loot'); }
    extractLeft = saved.value.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
    renderExtractStash();
  });
  UI.act('exFinish', async () => {
    // 2026-10-03 老板（SYS-02）：结算页改读「真实回执」——finish 返回值/事务收据 output 里的
    // 回执是唯一事实源；兜底只在无回执（旧路径/异常态）时用同一构造器从现场重算，不从 UI 反推。
    const pendingAtFinish = game.pendingExtraction;
    const saved = await extractionCommands.finish(viewRunId, viewSlot);
    if (!stillThisView(true)) return;
    if (!saved.ok) { UI.log(`[[icon:cross]] 整理完成未保存：${saved.message || saved.code}，可重试`, 'warn'); return; }
    const receipt = saved.receipt || saved.value?.output?.receipt ||
      buildExtractionReceipt({ game, pending: pendingAtFinish, isSha: B.isSha, xpMul: MODES[game.mode]?.xpMul || 1 });
    showExtractDone(receipt);
  });
}

// 整理完成 → 撤离结算（回基地 / 再出发）
// 2026-10-03 老板（SYS-02）：clear 突出「击破首脑+本局关键收获」短收束，extract 突出「保本返回」；
// 主体文案随结局区分，数字（行动/用时/净带回/散失/首探经验）一律读回执字段。
function showExtractDone(receipt) {
  const B = SDT.Base;
  const r = receipt && typeof receipt === 'object' ? receipt : {};
  const net = r.netTake || {};
  const loss = r.losses || {};
  game.extractionPending = false;
  extractLeft = null;
  // 跑局记录改读同一回执：结局/层/行动/时长以回执为准（SYS-02 唯一事实源）
  SDT.Agent?.recorder?.recordRun(r.outcome || (game.bossKilled ? 'clear' : 'extract'),
    { receipt, carriedCards: (game.ownedCards || []).map(o => ({ card: o.card, count: 1 })) });
  const s = Math.floor(Number(r.durationSec) || 0);
  const timeStr = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  const wasClear = r.outcome === 'clear';
  UI.log(`<b>[[icon:exit]] ${wasClear ? '首脑突破，撤离成功！' : '保本返回，撤离成功！'}</b>共 ${r.actions ?? 0} 次行动；` +
    `运回基地：木材×${net.wood ?? 0}、口粮×${net.rations ?? 0}，本局入库 ${net.cardsStashed ?? 0} 张（仓库现有 ${B.stashUsed()}/${B.stashCap()} 张）`, 'ok');
  // 本局关键收获 / 散失两行：clear 与 extract 共用数据源（回执），主体短收束按结局区分
  const gainRow = `<p class="result-line"><span class="ov-note">[[icon:sparkles]] 本局真实入库 <b>${net.cardsStashed ?? 0}</b> 张 · 口袋带回 <b>${net.pocketKept ?? 0}</b> 张 ·
    [[icon:wood]] 木材 ×<b>${net.wood ?? 0}</b> · [[icon:bread]] 口粮 ×<b>${net.rations ?? 0}</b> · [[icon:medal]] 首探经验 <b class="gold">+${r.firstExplore?.xp ?? 0}</b></span></p>`;
  const lossRow = (loss.lostCount || loss.pocketLost)
    ? `<p class="ov-note">[[icon:cross]] 散失：未入库 ${loss.lostCount || 0} 张${loss.lostNotable?.length ? `（${loss.lostNotable.map(c => `【${esc(c.name)}】×${c.count}`).join('、')}）` : ''} · 口袋散失 ${loss.pocketLost || 0} 张</p>`
    : '';
  nodeShell({
    tone: 'exit',
    icon: wasClear ? '[[icon:trophy]]' : '[[icon:home]]',
    title: wasClear ? '首脑突破 · 满载而归' : '保本返回 · 撤离成功',
    sub: `${wasClear ? '击破第四层首脑，从终局撤离点凯旋' : '见好就收，带着战利品安全返回基地'} ·
      用时 <b>${timeStr}</b> · 行动 <b>${r.actions ?? 0}</b> 次 · 抵达 <b>第 ${r.layersReached ?? '-'} 层</b> · 剩余生命 <b style="color:#7fdd9c">${game.hp}/${game.maxHp}</b> ·
      本局携带 <b class="gold">${r.runCoins ?? game.coins ?? 0} 币</b>（留在局中）`,
    body: `
      ${gainRow}${lossRow}
      <p class="result-line"><span class="ov-note">[[icon:home]] 已运回基地：[[icon:wood]] 木材 ×${net.wood ?? 0} · [[icon:bread]] 口粮 ×${net.rations ?? 0} · [[icon:archive]] 仓库总持有 <b>${B.stashUsed()}/${B.stashCap()}</b> 张（含往局） ·
        [[icon:sparkles]] 图鉴 <b>${Object.keys(B.data.collection).length}</b></span></p>
      <p class="ov-note">下次出发时可以从仓库选择卡牌携带；储备币 <b>${B.data.coins}</b> 币留在基地（不进局，用于孵蛋与基地建设）。</p>`,
    foot: `
      <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
      <button class="ov-btn ok" data-act="again">[[icon:runner]] 再出发</button>`,
  });
  UI.act('goBase', () => { UI.hideOverlay(); openBaseHub('deploy'); });
  UI.act('again', () => { UI.hideOverlay(); openBaseHub('deploy'); });
  UI.refresh(game);
}
