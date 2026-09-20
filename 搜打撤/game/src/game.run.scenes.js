/* ============================================================
 * game.run.scenes.js —— 局内场景壳、节点词汇与拾取/开箱页（架构批次 4）
 *
 * 由 game.run.js 拆出。层位最底（L0）：只依赖会话/数据/UI 模块，
 * 不依赖 altar / flow；ALTAR 与 FLOW 反向依赖本文件。
 * 内容：场景预加载与整页壳（nodeShell/nodeOpt/openScene/finishScene）、
 *       行军转场、即时节点落定、拾取页、战斗/宝箱格、事件发牌、火堆复原页。
 * 商店控制器也在此装配（openShop 唯一实例，供 ALTAR/FLOW 复用）。
 * ============================================================ */
import { esc, escAttr } from './shared.js';
import { MAP, bagCap, game, newUid, pick, saveGame, scaledEnemy, usedSlots } from './game.session.js';
import { tone } from './sound.js';
import { Sfx, _set_cardPageOpen, cardHTML } from './game.cardslib.js';
import { IMMEDIATE_SCENES, NODE_BG, PICKUP_BG, PRELOAD_SCENES, SCENES, SCENE_META } from './game.run.data.js';
import { Random } from './random.js';
import { createShopController } from './game.run.shop.js';
import { startBattle } from './battle-loader.js';
import { setBagReturnHook } from './bag-return-hook.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;

// ---------- 商店（全流程唯一实例：ALTAR 的层间门与 FLOW 的商店格都通过 import 复用） ----------
export const { openShop } = createShopController({
  UI,
  SDT,
  game,
  bagCap,
  cardHTML,
  newUid,
  saveGame,
  setCardPageOpen: _set_cardPageOpen,
  usedSlots,
});

export function cancelLegacyChainMove(reason = '即时事件不再自动跳转') {
  const steps = Math.max(0, Number(game.chainMove) || 0);
  if (!steps) return false;
  game.chainMove = 0;
  UI.log(`[[icon:map]] ${reason}（原计划前进 ${steps} 格）`, 'sys');
  return true;
}

// ---------- 落脚结算 ----------
// ---------- 场景演出（v0.10：不同格子进入不同场景，少量对话后开启内容） ----------
let scenePreload = null;
export function preloadScene(name) {
  if (!name || (scenePreload && scenePreload.name === name)) return;
  const img = new Image();
  img.decoding = 'async';
  img.src = name;
  scenePreload = { name, img };
  if (img.decode) img.decode().catch(() => {});
}
export function preloadCellScene(layer, idx) {
  if (!layer?.logical) return;
  const cell = layer.logical[idx];
  const cellType = cell && cell.def && cell.def.type;
  const door = (layer.doors || []).some(d => d.at === idx);
  const altar = (layer.altarEntrances || []).some(a => a.at === idx);
  const immediate = IMMEDIATE_SCENES.has(cellType);
  const type = immediate ? cellType : door ? 'door' : altar ? 'altar' : cellType;
  preloadScene(PRELOAD_SCENES[type]);
}
// 兼容旧调用：只预载最常见的即时节点，不再一次吞入全部事件背景。
// 其他房间由 preloadCellScene 在路线确认时按目标格预取。
const _preloaded = new Set();
export function preloadSceneList(urls) {
  urls.forEach(url => {
    if (!url || _preloaded.has(url)) return;
    _preloaded.add(url);
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    if (img.decode) img.decode().catch(() => {});
  });
}
export function preloadAllNodeShellBgs() {
  preloadSceneList(Array.from(IMMEDIATE_SCENES, key => PRELOAD_SCENES[key]).filter(Boolean));
}
let sceneState = null;

// ---------- 全屏节点页外壳：杀戮尖塔式——整屏场景背景图，标题与选项虚化在右侧毛玻璃面板 ----------
// o = { tone: 场景分色(sc-*), icon, title, sub, body, foot, asset: 背景图 asset-key（缺省按 tone 映射） }
export function nodeShell(o) {
  const bg = o.asset || NODE_BG[o.tone] || '';
  UI.showOverlay('', `
    <div class="pg node-pg sc-${o.tone}"${bg ? ` data-asset-key="${escAttr(bg)}"` : ''}>
      <div class="node-panel">
        <div class="node-kicker">FIELD ENCOUNTER <span>${String(game.layerIdx + 1).padStart(2, '0')} / 04</span></div>
        <header class="pg-head">
          <h2>${o.icon} ${o.title}</h2>
          ${o.sub ? `<span class="sub">${o.sub}</span>` : ''}
        </header>
        <div class="node-main"><div class="node-summary">${o.body}</div></div>
        ${o.foot ? `<footer class="node-foot">${o.foot}</footer>` : ''}
      </div>
    </div>`, 'page');
}
// 杀戮尖塔式选项条：主标题 + 后果说明（复用事件页 .evt-opt 样式）
export function nodeOpt(act, label, detail, tone = '', extra = '') {
  return `<button class="evt-opt ${tone}" data-act="${act}" ${extra}><b>${label}</b>${detail ? `<span>${detail}</span>` : ''}</button>`;
}

// 打开场景：对话展示 →（点击任意处继续）→ onDone 开启真正内容
// opts.foes = 遭遇敌人数组：战斗场景展示统一位图敌人立绘。
// opts.gain = 明确结算文案（如「+2 币」）：拾取类格子用大字告知玩家获得了什么
function openScene(kind, opts = {}) {
  const f = SCENES[kind];
  if (!f) { if (opts.onDone) opts.onDone(); return; }
  game.state = 'modal';
  Sfx.tick();
  SDT.Sound.sfx('scene');
  sceneState = { onDone: opts.onDone || null };
  const text = pick(f.lines).replace('{name}', opts.name || '不速之客');
  const artHTML = opts.foes && opts.foes.length
    ? `<div class="scene-foes">${opts.foes.map(foe =>
        `<div class="art scene-foe-art" data-foe-id="${escAttr(foe.id || foe.name)}" title="${escAttr(foe.name)}">${SDT.Art.monsterArt(foe.id)}</div>`).join('')}</div>`
    : `<div class="scene-art"><span>${f.icon}</span></div>`;
  const meta = opts.sceneMeta || SCENE_META[kind] || [kind, `scene-${kind}`, `scene-${kind}`];
  UI.showOverlay('', `
    <div class="scene sc-${f.tone} ${meta[1]}" data-act="sceneNext" data-scene-id="${escAttr(meta[0])}" data-asset-key="${escAttr(meta[2])}">
      <div class="scene-glow"></div>
      ${artHTML}
      <h2 class="scene-title">${f.title}</h2>
      ${opts.gain ? `<div class="scene-gain"><b>${opts.gain}</b></div>` : ''}
      <div class="scene-line"><p>${esc(text)}</p></div>
      <div class="scene-ops">${f.auto ? '' :
        `<button class="ov-btn ok" data-act="sceneGo">${opts.btn || f.btn || '继 续'}</button>`}</div>
      <p class="scene-hint">[[icon:sparkles]] 点击任意处继续 [[icon:sparkles]]</p>
    </div>`, 'scene');
  UI.act('sceneNext', () => finishScene());
  UI.act('sceneGo', () => finishScene());
  UI.refresh(game);
}
export function finishScene() {
  if (!sceneState) return;
  const cb = sceneState.onDone;
  sceneState = null;
  UI.hideOverlay();
  if (cb) cb();
}

// 节点与战斗结算之间的短过场：复用现有场景美术，不引入额外资源或阻塞式页面。
export function showRunTransition({ tone = 'battle', asset = 'scene-battle-bg', eyebrow = 'AREA ENTERED', title, detail = '', duration = 900 }) {
  // 结束时必须恢复状态：战斗/节点流程下游会自行改状态，但「继续对局」路径
  // 过渡后无人收拾，曾导致 game.state 卡死在 modal、侧栏按钮永久禁用
  const prevState = game.state;
  game.state = 'modal';
  return new Promise(resolve => {
    let done = false;
    let timer = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      UI.hideOverlay();
      // 战斗 modal 态（Battle.restore 置位）不得降级为 idle，否则战斗界面丢失且移动锁死
      game.state = (prevState === 'modal' && !game.battleActive) ? 'idle' : prevState;
      resolve();
    };
    UI.showOverlay('', `
      <div class="scene flow-transition sc-${escAttr(tone)}" data-asset-key="${escAttr(asset)}" data-act="flowContinue">
        <div class="flow-scan" aria-hidden="true"></div>
        <p class="flow-eyebrow">${esc(eyebrow)}</p>
        <h2 class="flow-title">${esc(title || '未知区域')}</h2>
        ${detail ? `<p class="flow-detail">${esc(detail)}</p>` : ''}
        <div class="flow-line" aria-hidden="true"><i></i></div>
        <p class="flow-hint">点击跳过</p>
      </div>`, 'scene');
    UI.act('flowContinue', finish);
    timer = setTimeout(finish, duration);
    UI.refresh(game);
  });
}

export function enterNode(kind, done) {
  const transitions = {
    battle: { tone: 'battle', asset: 'scene-battle-bg', eyebrow: 'HOSTILE CONTACT', title: '遭遇敌袭', detail: '武器解锁 · 准备接敌' },
    door: { tone: 'door', asset: 'scene-door-bg', eyebrow: 'GATE SIGNAL', title: '抵达大门', detail: '环层通路正在响应' },
    altar: { tone: 'altar', asset: 'scene-altar-bg', eyebrow: 'CONTAMINATION DETECTED', title: '污染核心', detail: '高危生命信号逼近' },
    emergencyExit: { tone: 'exit', asset: 'scene-extract-bg', eyebrow: 'EXTRACTION POINT', title: '紧急撤离点', detail: '撤离信标已经接通' },
    shop: { tone: 'shop', asset: 'scene-shop-bg', eyebrow: 'CARAVAN SIGNAL', title: '拾荒商队', detail: '交易频道已经开放' },
  };
  return showRunTransition(transitions[kind] || { title: '进入节点' }).then(done);
}

// 场景/即时效果结束后的收尾：事件连锁移动优先，否则回待机并存档
export function finishInstant() {
  if (game.chainMove) {
    cancelLegacyChainMove();
  }
  game.state = 'idle';
  saveGame();
  UI.refresh(game);
}

// 拾取页：杀戮尖塔式右栏——拾获叙事 + 大字收益 + 继续按钮
// 搜索物资（2026-09-09 老板 #3）：收获不再直接蹦出来——先演一段搜索（提灯扫过 + 进度条填充），
// 约 0.95s 后揭晓收获大字与「继续」按钮，给拾取一个过程感
const PICKUP_SEARCH_MS = 950;
export function openPickupPage(kind, gain, onDone) {
  const f = SCENES[kind];
  // 来源页恢复（迭代评审 09-20 C-P1）：背包盖开再关后重放本页——搜索动画与揭晓重来，
  // 但 onDone 只会经 pickupGo 触发一次，奖励不再因关背包被吞（此前发奖仅 pickupGo 一个入口）
  setBagReturnHook(() => openPickupPage(kind, gain, onDone));
  nodeShell({ tone: 'pickup', asset: PICKUP_BG[kind], icon: f.icon, title: f.title,
    sub: pick(f.lines),
    body: `<div class="pick-search">
        <span class="ps-lantern">[[icon:lantern]]</span>
        <span class="ps-ground"><i></i></span>
        <p class="ps-tip">正在搜索物资…</p>
      </div>` });
  SDT.Sound.sfx('pick');
  const main = UI.el.ovBody.querySelector('.node-main');
  setTimeout(() => {
    if (!main || !main.isConnected) return;   // 页面已被换掉/关掉就不再揭晓
    main.innerHTML = `<p class="gain-big">${gain}</p>
      <button class="evt-opt ok" data-act="pickupGo"><b>获取并离开</b></button>`;
    SDT.Sound.sfx('gain');
    const go = main.querySelector('[data-act="pickupGo"]');
    if (go) go.focus({ preventScroll: true });
  }, PICKUP_SEARCH_MS);
  UI.act('pickupGo', () => { setBagReturnHook(null); UI.hideOverlay(); onDone(); });
}

// ---------- 遭遇组建（设计者 2026-09-02 定版：按环层抽怪，1-3 只，越内层越强） ----------
export function buildEncounter(layerIdx) {
  const enc = MAP.encounters[layerIdx] || MAP.encounters[0];
  let pool, size;
  let strategy = enc.strategy || '';
  let risk = enc.risk || '中';   // 风险等级随层写在 encounters 表里
  // 2026-09-10 玩法定版：每层每种敌人有固定数量区间（一律落在 1~3 只，如 2-3 只），
  // 区间内每个数量等概率生成（MAP.rollCount）；巨兽「荒渊」按层概率刷出（第 3 层 3%、第 4 层 10%），固定单体。
  if (enc.elite && Random.random('enemy') < enc.elite.chance) {
    pool = enc.elite.pool; size = enc.elite.size; strategy = enc.elite.strategy || strategy; risk = '精英';
  } else {
    const entries = enc.entries || [];
    const ent = entries[Math.floor(Random.random('enemy') * entries.length)] || entries[0];
    pool = ent ? [ent.id] : [];
    size = ent ? ent.size : [1, 1];
  }
  const n = MAP.rollCount ? MAP.rollCount(size, () => Random.random('enemy')) : size[0] + Math.floor(Random.random('enemy') * (size[1] - size[0] + 1));
  const list = [];
  for (let i = 0; i < n; i++) {
    const tpl = MAP.monsters[pool[Math.floor(Random.random('enemy') * pool.length)]];
    list.push(scaledEnemy({ ...tpl }));
  }
  // 元数据不参与战斗结算，仅用于战前预告和战斗内提示；旧敌人对象仍保持原字段。
  list.risk = risk;
  list.strategy = strategy;
  return list;
}

export function openBlankSafePage() {
  game.state = 'modal';
  nodeShell({
    tone: 'safe', icon: '[[icon:check]]', title: '安全地带',
    sub: '空白的安全节点',
    body: `<div class="blank-safe-gain">
      <p class="gain-big">无事发生</p>
      <p class="ov-note">四周静悄悄的——这里没有埋伏，也没有拾获。整理一下背包，准备继续深入。</p>
    </div>`,
    foot: `<button class="ov-btn ok fire-done-btn" data-act="blankSafeDone"><svg class="svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>`,
  });
  UI.act('blankSafeDone', () => { UI.hideOverlay(); finishInstant(); });
}

// 战斗格 → 遭遇战（encounter 已在场景前组建好传入，保证场景与战斗一致）
export function openBattleCell(def, encounter) {
  game.state = 'modal';
  const list = encounter || buildEncounter(game.layerIdx);
  return startBattle(game, list, { isBoss: false, layer: game.layerIdx, name: list[0].name,
    risk: list.risk, strategy: list.strategy });
}

// 宝箱格 / 事件卡开真宝箱：开完回待机并存档（场景演出后由本函数自行收尾）
export function openChestsOnCell(chests, text, opts) {
  UI.log(`[[icon:archive]] ${text || '回收了' + SDT.Chests.dropText(chests)}`, 'loot');
  SDT.Chests.open(game, chests, () => {
    game.state = 'idle';
    saveGame();
    UI.refresh(game);
  });
}

// 即时效果（经场景演出后结算）；after = 效果完成后的续流回调
// 拾取类在场景里用大字标明结算（v0.22：明确告诉玩家发生了什么）
// opts.silent：跳过获得演出（宝箱/基地等调用方自带卡牌展示界面，2026-09-13）
export function grantEventCard(tpl, opts = {}) {
  if (!tpl) return false;
  const canReceive = game.canReceiveCard
    ? game.canReceiveCard(tpl)
    : (game.ownedCards.some(o => o.card.name === tpl.name) || game.canAcceptCard(tpl));
  if (!canReceive) {
    // 2026-09-09 老板 #12：收不下要当场给提示（音效+日志，口径同 addItem），不能只默默掉在原地
    SDT.Sound.sfx('deny');
    UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()} 格${tpl.type !== '资源' ? '，珍珠盒扩格只收资源卡' : ''}），【${esc(tpl.name)}】掉在了原地…`, 'warn');
    return false;
  }
  game.ownedCards.push({ uid: newUid(), card: { ...tpl } });
  UI.log(`[[icon:archive]] 获得卡牌【<b>${esc(tpl.name)}</b>】`, 'loot');
  // 2026-09-13 老板：发卡要有奖励动画，不能静默进背包——统一走获得演出
  //（传说卡保留金色光柱 + legend 音效，普通卡中性演出；多张连发自动排队逐张播）
  if (!opts.silent) UI.showCardReward(tpl);
  // 阿猫的礼物（2026-09-12 实装）：「发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌」
  // 地图侧没有能量概念，只结算附赠卡；战斗内触发走 battle.core fireCatGift（含能量）
  if (tpl.id === 'tt2-apollo') {
    const pool = SDT.Cards.all().filter(c => SDT.Cards.isRandomObtainable(c) && c.id !== 'tt2-apollo');
    if (pool.length) {
      const got = pool[Math.floor(Random.random('loot') * pool.length)];
      UI.log('[[icon:bolt]] <b>阿猫的礼物</b>：随机获取触发，附赠另 1 张随机卡牌', 'loot');
      grantEventCard(got);   // 池内已排除自身，无递归风险
    }
  }
  return true;
}
// ESM：循环导入下本模块体先于 game.session 执行，顶层读 game 会 TDZ，延迟到 boot 统一绑定
export const FIRE_RESTORABLE = (card) => card.type !== '道具' && card.type !== '装备';
// opts = { title, icon, tone, sub }：2026-09-19 留言 #21——复原页不再一律伪装成
// 「营火休整」（修鞋铺等事件里复原时跳成火堆页观感）；不传 opts 保持火堆口径
export function openPocketRestore(picks, done, opts = {}) {
  game.state = 'modal';
  let left = picks;
  const restorable = () => game.usedPocket.filter(p => FIRE_RESTORABLE(p.card));
  const render = () => {
    const list = restorable();
    const blockedN = game.usedPocket.length - list.length;
    const cardsHTML = list.length
      ? list.map(p => `
          <div class="bt-card fire-restore-card${left <= 0 ? ' off' : ''}" data-act="restoreOne" data-name="${escAttr(p.card.name)}"
            title="${escAttr(p.card.desc || p.card.name)}——点击复原一张回背包">
            ${SDT.Cards.cardHTML(p.card, 'sm')}
            ${p.count > 1 ? `<span class="bt-count" title="同名卡牌还剩 ${p.count} 张">×${p.count}</span>` : ''}
          </div>`).join('')
      : `<p class="ov-empty">（消耗口袋里没有可复原的卡牌${blockedN ? `——另有 ${blockedN} 张道具/装备不可在此复原` : ''}）</p>`;
    nodeShell({
      tone: opts.tone || 'fire', icon: opts.icon || '[[icon:fire]]', title: opts.title || '营火休整',
      sub: (opts.sub != null ? opts.sub : `还可从消耗口袋中复原 <b>${left}</b> 张（最多 ${picks} 张）· 点击卡牌复原`) +
        (blockedN ? ` · 道具/装备共 ${blockedN} 张不可复原` : ''),
      body: `<div class="bt-hand fire-restore-hand">${cardsHTML}</div>`,
      foot: `<button class="ov-btn ok fire-done-btn" data-act="fireDone"><svg class="ic svg-ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h13M12 5.5 18.5 12 12 18.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg> 继续旅程</button>`,
    });
  };
  const finish = () => { UI.hideOverlay(); if (done) done(); };
  UI.act('restoreOne', (d) => {
    const p = game.usedPocket.find(x => x.card.name === d.name && FIRE_RESTORABLE(x.card));
    if (!p || left <= 0) return;
    // 2026-09-06 #18：背包满时不能复原
    if (usedSlots() >= bagCap()) { UI.log(`[[icon:bag]] 背包已满（${usedSlots()}/${bagCap()}），无法复原`, 'warn'); SDT.Sound.sfx('deny'); return; }
    const card = p.card;
    p.count--;
    if (p.count <= 0) game.usedPocket.splice(game.usedPocket.indexOf(p), 1);
    game.ownedCards.push({ uid: newUid(), card: { ...card } });
    left--;
    UI.log(`[[icon:sparkles]] 【<b>${esc(card.name)}</b>】已复原，回到背包`, 'ok');
    if (left <= 0) finish(); else render();
  });
  UI.act('fireDone', finish);
  render();
}

// ---------- 角色选择（开局从全部角色中自由选 1，与 5 张初始攻击一起获得 1 张该角色随机卡） ----------
// 各角色的背景故事与出发任务（角色选择页展示）
