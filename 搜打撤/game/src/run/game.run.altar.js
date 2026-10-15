/* ============================================================

 * game.run.altar.js —— 祭坛/层间门/BOSS 门/火堆/职业选择/撤离整理（架构批次 4）
 *
 * 由 game.run.js 拆出。层位中间（L1）：依赖 game.run.scenes.js，反向不被其依赖；
 * FLOW（game.run.flow.js）依赖本文件。
 * ============================================================ */
import { characterFor, characterName } from '../core/characters.js';
import { installExpeditionFeedback } from '../ui/expedition-feedback.js';
import { openClassChoice as requestClassChoicePage } from './game.run.class-choice.js';
import { rewardSceneHTML } from '../ui/reward-scene-view.js';
import { claimEntrySupply, entrySupplyAt, nodeActionBinding } from './node-reward-state.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { esc, escAttr } from '../core/shared.js';
import { MAP, MODES, bagCap, curLayer, enterLayer, game, getActiveSlot, newUid, saveGame, scaledEnemy, usedSlots } from './game.session.js';
import { buildExtractionReceipt, createExtractionCommands, validatePendingExtraction } from '../hub/extraction.commands.js';
import { openBaseHub } from '../hub/game.hub.js';

import { Sfx, _set_cardPageOpen } from '../hub/game.cardslib.js';
import { Random, SeededRandomService } from '../core/random.js';
import { startBattle } from '../battle/battle-loader.js';
import { FIRE_RESTORABLE, consumeCurrentCell, finishInstant, grantEventCard, nodeOpt, nodeShell, openFixedRewardsOnCell, openPocketRestore, openShop } from './game.run.scenes.js';
import { RunStorage } from '../hub/game.storage.js';
import { commitBaseAndRun, readSettlementReceipt, recoverSlot } from '../hub/recovery.commands.js';
/* ESM 垫片：window.SDT 命名空间的模块内引用（由 main.js 的加载顺序保证已存在） */
const SDT = window.SDT;
const UI = window.SDT.UI;
installExpeditionFeedback({
  isCurrentCell: key => game.runActive && key === `${game.layerIdx},${game.trackPos}`,
  cardHTML: card => SDT.Cards.cardHTML(card),
});
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

function altarPageBinding(act) {
  const active = nodeActionBinding(game, UI, act);
  const slotId = getActiveSlot();
  const surface = UI.el?.ovBody?.firstElementChild;
  return () => active() && getActiveSlot() === slotId && !UI.el?.overlay?.hidden &&
    (!surface || UI.el?.ovBody?.firstElementChild === surface);
}

export function openFireRest(after = finishInstant) {
  const cellKey = `${game.layerIdx},${game.trackPos}`;
  game.nodeRewards ||= {};
  game.state = 'modal';
  const leave = () => { setBagReturnHook(null); UI.hideOverlay(); after(false); };
  const result = () => {
    const record = game.nodeRewards[cellKey];
    const restored = record.restoredIds.map(id => SDT.Cards.all().find(card => card.id === id)).filter(Boolean);
    const bonus = record.bonusReceived && SDT.Cards.all().find(card => card.id === record.classCardId);
    nodeShell({ tone:'fire', asset:'scene-fire-bg', icon:'[[icon:fire]]', title:'休整完毕',
      sub:`生命回复 ${record.hpGain} 点 · ${record.hpAfter}/${game.maxHp}。${restored.length ? `已复原 ${restored.length} 张卡牌。` : '本次没有复原卡牌。'}${bonus ? `余烬中找到「${esc(bonus.name)}」。` : ''}`,
      body:`${restored.length || bonus ? `<div class="fire-result-cards">${[...restored, ...(bonus ? [bonus] : [])].map((card, i) => `<button type="button" class="event-choice-card" data-act="fireResultCard" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card,'sm')}</button>`).join('')}</div>` : ''}${nodeOpt('fireDone','继续探索','本处休整已经完成')}`,
    });
    const active = nodeActionBinding(game, UI, 'fireDone');
    UI.act('fireDone', () => { if (!active()) return; record.continued = true; setBagReturnHook(null); UI.hideOverlay(); after(true); });
    UI.act('fireResultCard', data => {
      if (!active()) return;
      const card = [...restored, ...(bonus ? [bonus] : [])][Number(data.i)];
      if (card) UI.showCardZoom(card, { hideNote:true, presentation:'expedition' });
    });
  };
  setBagReturnHook(() => openFireRest(after));
  if (game.nodeRewards[cellKey]?.type === 'fire') { result(); return; }
  const restorable = game.usedPocket.filter(item => FIRE_RESTORABLE(item.card));
  const restorableN = restorable.reduce((sum, item) => sum + item.count, 0);
  const fits = restorable.some(item => game.canReceiveCard ? game.canReceiveCard(item.card) : usedSlots() < bagCap());
  nodeShell({ tone:'fire', asset:'scene-fire-bg', icon:'[[icon:fire]]', title:'营火休整',
    sub:'风雪被隔在火光之外。你可以在这里整顿状态，再继续前行。',
    body:nodeOpt('fireRestGo','休整',`回复 ${MAP.rules.fireHeal} 点生命，随机复原至多 2 张可复原卡牌；${Math.round(MAP.rules.fireClassCardChance * 100)}% 概率获得本职业卡。`) +
      `<p class="reward-notice" role="status">消耗区有 ${restorableN} 张可复原卡牌，本次最多复原 ${Math.min(2, restorableN)} 张。背包 ${esc(game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`)}；${restorableN && !fits ? '当前可复原卡均放不下，将复原 0 张。' : '实际数量受卡牌叠放及剩余容量限制。'}休整后本处机会即消耗；放不下的消耗卡保留在消耗区，额外职业卡无法入包时不会获得。</p>`,
    foot:'<button class="ov-btn" data-act="fireBag">先整理背包</button><button class="ov-btn" data-act="fireLeave">离开火堆</button>',
  });
  const active = nodeActionBinding(game, UI, 'fireRestGo');
  let resolving = false;
  UI.act('fireBag', () => { if (active() && !resolving) bagSlots.showBackpack(); });
  UI.act('fireLeave', () => { if (active() && !resolving) leave(); });
  UI.act('fireRestGo', () => {
    if (!active() || resolving || game.nodeRewards[cellKey]?.type === 'fire') return;
    resolving = true;
    const hpBefore = game.hp;
    game.heal(MAP.rules.fireHeal);
    const hpGain = Math.max(0, game.hp - hpBefore);
    let classCardId = null, bonusReceived = false;
    if (Random.random('card') < MAP.rules.fireClassCardChance) {
      const card = SDT.Cards.randomClassCard(game.myClass);
      if (card) { classCardId = card.id; bonusReceived = !!grantEventCard(card, { silent:true }); }
    }
    const restoredIds = [];
    for (let i = 0; i < 2; i++) {
      const pool = game.usedPocket.filter(item => FIRE_RESTORABLE(item.card));
      if (!pool.length) break;
      const available = pool.filter(item => game.canReceiveCard ? game.canReceiveCard(item.card) : usedSlots() < bagCap());
      if (!available.length) { SDT.Sound.sfx('deny'); UI.log('[[icon:bag]] 背包已满或可用格不足，可复原卡牌保留在消耗区', 'warn'); break; }
      const item = available[Math.floor(Random.random('pocket') * available.length)];
      item.count--;
      if (item.count <= 0) game.usedPocket.splice(game.usedPocket.indexOf(item), 1);
      game.ownedCards.push({ uid:newUid(), card:{ ...item.card } });
      restoredIds.push(item.card.id);
    }
    game.nodeRewards[cellKey] = { version:1, type:'fire', hpBefore, hpAfter:game.hp, hpGain, restoredIds, classCardId, bonusReceived };
    consumeCurrentCell();
    saveGame();
    UI.log(`[[icon:fire]] 营火休整：回复 ${hpGain} 点生命，复原 ${restoredIds.length} 张卡牌`, 'ok');
    UI.refresh(game);
    result();
  });
}

export function openEntrySupply() {
  const supply = entrySupplyAt(game);
  if (!supply) return false;
  supply.entered = true;   // 记录打开状态；移动闸门仅在补给全部领取后解锁。
  game.state = 'modal';
  let saveFailed = saveGame() === false;
  const cards = () => supply.cardIds.map(id => SDT.Cards.all().find(card => card.id === id));
  const isCurrent = () => entrySupplyAt(game) === supply;
  const finish = () => { setBagReturnHook(null); UI.hideOverlay(); finishInstant(); };
  const showResult = () => {
    const complete = supply.taken.length === supply.cardIds.length;
    UI.showOverlay('', rewardSceneHTML({ className:`pg entry-reward-scene entry-supply-strips${complete ? ' reward-complete' : ''}`, title:'随行补给', source:characterName(game.myClass), count:supply.cardIds.length - supply.taken.length,
      cards:complete ? '<div class="entry-reward-complete"><span class="entry-complete-symbol" aria-hidden="true">[[icon:exit]]</span><p>已领取所有奖励</p><button type="button" class="entry-complete-confirm" data-act="clsEntryContinue" aria-label="继续探索">✓</button></div>' : cards().map((card, i) => supply.taken.includes(i) ? '' : card ? `<article class="reward-unit"><button class="reward-card" data-act="clsEntryCard" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card)}</button><div class="entry-reward-label">${esc(card.name)}</div><div class="entry-reward-amount"><span>×</span>1</div><button type="button" class="reward-claim" data-act="entrySupplyTake" data-i="${i}">收下</button></article>` : '<p class="reward-empty">该职业补给暂不可用</p>').join(''),
      actions:'',
      footer:`<button class="reward-bag" data-act="entrySupplyBag">整理背包</button>${saveFailed ? '<p class="entry-save-warning" role="status">当前进度未保存，请查看存档错误提示。</p>' : ''}${supply.taken.length < supply.cardIds.length ? '<span class="reward-notice">领完全部入城补给后才能前往其他地点；放不下时请先整理背包</span>' : ''}`,
    }), 'page');
    const active = nodeActionBinding(game, UI, complete ? 'clsEntryContinue' : 'entrySupplyBag');
    UI.act('clsEntryContinue', () => { if (isCurrent() && active() && supply.taken.length === supply.cardIds.length) finish(); });
    UI.act('clsEntryCard', data => {
      if (!isCurrent() || !active()) return;
      const index = Number(data.i), card = cards()[index];
      if (card) UI.showCardZoom(card, { hideNote:true, presentation:'expedition',
        footer:supply.taken.includes(index) ? '' : `<button class="ov-btn ok" data-act="entrySupplyTake" data-i="${index}">收下</button>` });
    });
    UI.act('entrySupplyTake', data => { if (isCurrent() && active()) take(Number(data.i)); });
    UI.act('entrySupplyBag', () => { if (isCurrent() && active()) bagSlots.showBackpack(); });
  };
  const take = (index = null) => {
    if (!Number.isInteger(index)) return;
    const received = claimEntrySupply(game, { findCard:id => SDT.Cards.all().find(card => card.id === id),
      canReceive:card => game.canReceiveCard ? game.canReceiveCard(card) : usedSlots() < bagCap(), newUid, index });
    if (!received.length) { UI.log('[[icon:bag]] 当前补给未领取，请整理背包后再试', 'warn'); return; }
    document.getElementById('cardZoom')?._closeCardZoom?.(true);
    if (supply.taken.length === supply.cardIds.length) consumeCurrentCell();
    saveFailed = saveGame() === false;
    UI.refresh(game);
    showResult();
  };
  setBagReturnHook(() => { if (isCurrent()) openEntrySupply(); });
  if (supply.taken.length) { showResult(); return true; }
  nodeShell({ tone:'entry', asset:'scene-door-bg', icon:'', title:'入城补给',
    sub:'随行的职业补给已留在城门旁。收下所需的卡牌，再踏入风雪。',
    body:nodeOpt('clsEntryReveal','查看职业补给',`可领取最多 ${supply.cardIds.length} 张${esc(characterName(game.myClass))}的职业卡，放不下的保留在入口。`),
    foot:saveFailed ? '<p class="entry-save-warning">当前进度未保存，请查看存档错误提示。</p>' : '',
  });
  const active = nodeActionBinding(game, UI, 'clsEntryReveal');
  UI.act('clsEntryReveal', () => { if (isCurrent() && active()) showResult(); });
  return true;
}
// 消耗区复原选牌（picks = 最多复原张数；done = 结束回调）
// 2026-09-09 老板实测：原文字行在整屏场景壳上看不清、也不显示卡面——改为真卡面网格，点卡即复原
// 需求 #12：消耗的装备不能在火堆复原（与道具一样）——列表里直接滤掉，不可选
export function openClassChoice(options = {}) { return requestClassChoicePage(options); }

export function openDoorModal(door, cellDef) {
  game.state = 'modal';
  game.discoveredPairs.add(door.pair);
  const target = game.layerData[door.toLayer] || { name: `第${door.toLayer + 1}层` };
  // 2026-09-09 需求 #13：只能在第三层（紧急撤离点）与第四层（终局撤离点）撤离——
  // 环间门不再提供撤离选项，只能向深处走
  nodeShell({
    tone: 'door', icon: '[[icon:door]]', title: '层间闸门',
    sub: door.reverse ? '这条通路返回已探索的区域。' : '穿过闸门后进入下一层。确认前可返回当前层检查遗漏，或先整理背包。',
    body:
      nodeOpt('goDoor', `${door.reverse ? '返回' : '进入'}${target.name}`, '', 'ok') +
      (cellDef && cellDef.type === 'shop' ? nodeOpt('doorShop', '逛商队', '闸门旁的拾荒商队还在营业') : ''),
    foot:'<button class="ov-btn" data-act="doorBag">整理背包</button><button class="ov-btn" data-act="doorBack">返回当前层</button>',
  });
  const active = altarPageBinding('goDoor');
  let entering = false;
  setBagReturnHook(() => openDoorModal(door, cellDef));
  UI.act('doorBag', () => { if (active() && !entering) bagSlots.showBackpack(); });
  UI.act('doorBack', () => { if (!active() || entering) return; setBagReturnHook(null); UI.hideOverlay(); finishInstant(); });
  UI.act('goDoor', () => {
    if (!active() || entering) return;
    entering = true;
    setBagReturnHook(null);
    UI.hideOverlay();
    UI.log(`穿过隔离闸门 → <b>${target.name}</b>`, 'sys');
    // 穿门换层走镜头补间（2026-09-27 二轮动效）：壁纸交叉溶解 + 相机滑入新环，不再硬切
    enterLayer(door.toLayer, door.arriveAt, { glideCam: true });
    SDT.Sound.sfx('layerEnter');
  });
  UI.act('doorShop', () => { if (active() && !entering) openShop('door:' + door.pair); });
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
    ? nodeOpt('altarFragHero', `献上 2 枚员工通行证A碎片（不弃牌）`, `获得 1 张本职业随机能力卡（现有碎片 ${frags}）；需能放下能力卡，背包 ${esc(game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`)}，放不下时不扣碎片`, 'ok')
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
          ? nodeOpt('altarItemRestore', '献祭道具 · 复原卡牌', '献祭 1 张道具卡，从消耗区复原 2 张卡牌（每座祭坛限一次）')
          : nodeOpt('altarItemNoItem', '献祭道具 · 复原卡牌', '背包里没有道具卡——先弄到一张道具卡，再回来献祭复原', '', 'disabled title="背包里没有道具卡"')) +
      nodeOpt('altarLeave', '离开', '祭坛保持沉睡——回到当前格子，稍后再来'),
    foot:'<button class="ov-btn" data-act="altarBag">整理背包</button>',
  });
  const markActivated = () => {
    SDT.Sound.sfx('altarActivate');
    game.altarActivated = true;
    game.visited = game.visited || {};
    game.visited[game.layerIdx + ',' + game.trackPos] = 1;   // 激活成功才消耗本格
  };
  const active = altarPageBinding('altarOn3');
  setBagReturnHook(() => openAltarRitual(def));
  UI.act('altarBag', () => { if (active()) bagSlots.showBackpack(); });
  // 献祭道具复原（2026-09-10 需求）：1 张道具卡 → 从消耗区复原 2 张；
  // 每座祭坛限一次（2026-09-19 老板定版：真加一次性锁，标记随存档持久化）
  UI.act('altarItemRestore', () => {
    if (!active() || game.altarActivated) return;
    if (game.altarItemSacrificed) { UI.log('[[icon:crystal]] 这座祭坛的道具献祭已经受理过了', 'warn'); return; }
    if (!game.ownedCards.some(o => o.card.type === '道具')) { UI.log('[[icon:bag]] 背包里没有道具卡可供献祭', 'warn'); return; }
    const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
    if (!game.usedPocket.length || !restorableN) { UI.log('[[icon:bag]] 消耗区里没有可复原的卡牌——先去战斗吧', 'warn'); return; }
    openBagSacrifice(1, (chosen) => {
      game.altarItemSacrificed = true;   // 确认献祭才上锁；取消献祭不上锁
      SDT.Sound.sfx('altarOffer');
      UI.log(`[[icon:crystal]] 献上道具【<b>${esc(chosen[0].card.name)}</b>】——从消耗区复原卡牌（本祭坛的道具献祭已用完）`, 'loot');
      saveGame();
      // 祭坛道具路径的复原页跟祭坛身份，不落默认「营火休整」（同 openAltarReward 口径）
      openPocketRestore(Math.min(2, restorableN), () => { saveGame(); openAltarRitual(def); }, {
        tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 复原',
      });
    }, () => openAltarRitual(def), '道具');
  });
  UI.act('altarOn3', () => {
    if (!active() || game.altarActivated) return;
    if (game.ownedCards.length < 3) { UI.log('[[icon:bag]] 背包卡牌不足 3 张，无法激活祭坛', 'warn'); return; }
    openBagSacrifice(3, (chosen) => {
      markActivated();
      game.altarRewardPending = true;
      UI.log(`[[icon:crystal]] 献上 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}——<b>祭坛苏醒了</b>，请选择一项奖励`, 'loot');
      saveGame();
      openAltarReward();
    }, () => openAltarRitual(def));
  });
  UI.act('altarFragHero', () => {
    if (!active() || game.altarActivated || (game.fragments || 0) < 2) return;
    // 2026-09-10 留言 #30：职业缺失/英雄池为空时此前只写一条侧边日志就 return——
    // 玩家点了按钮界面毫无变化，看起来像「碎片无法激活」。改为弹窗明示，碎片原样保留。
    const pool = game.myClass ? SDT.Cards.classPool(game.myClass).filter(c => c.type === '能力卡') : [];
    if (!pool.length) {
      nodeShell({
        tone: 'altar', icon: '[[icon:crystal]]', title: '碎片兑换 · 暂不可用',
        sub: `${game.myClass ? '【' + esc(game.myClass) + '】职业目前没有可兑换的能力卡' : '还没有选定职业'}——员工通行证A碎片已原样保留（现有 ${(game.fragments || 0)} 枚）`,
        body: nodeOpt('altarFragBack', '返回祭坛', '换个方式激活，或留着碎片以后再兑'),
      });
      const backActive = altarPageBinding('altarFragBack');
      UI.act('altarFragBack', () => { if (backActive()) openAltarRitual(def); });
      UI.refresh(game);
      return;
    }
    const card = pool[Math.floor(Random.random('loot') * pool.length)];
    // 先发牌、后扣碎片：背包满时发卡会被拒收（现场播报），不能白扣 2 枚碎片
    if (!grantEventCard(card)) {
      const button = UI.el?.ovBody?.querySelector('[data-act="altarFragHero"] span');
      if (button) button.textContent = '背包放不下能力卡，2 枚碎片已保留；请先整理背包再兑换。';
      return;
    }
    game.fragments = (game.fragments || 0) - 2;
    markActivated();
    UI.log(`[[icon:gem]] 献上 2 枚员工通行证A碎片（剩 ${game.fragments}）——获得本职业能力卡【<b>${esc(card.name)}</b>】；<b>祭坛苏醒了</b>`, 'loot');
    saveGame();
    UI.hideOverlay();
    finishInstant();
  });
  UI.act('altarLeave', () => { if (!active()) return; setBagReturnHook(null); UI.hideOverlay(); game.state = 'idle'; saveGame(); UI.refresh(game); });
  UI.refresh(game);
}

// 激活后的奖励二选一（弃 3 张已支付）。奖励只能领取一次：进入即置待领标记，
// 领取消耗标记；离开保留标记——回到本格可直接再进本面板（见 openAltarRitual / resolveCell）
function openAltarReward() {
  SDT.Sound.sfx('altarReward');
  game.state = 'modal';
  game.altarRewardPending = true;
  // 2026-09-10 留言 #33：消耗区没有可复原卡牌（或全是不可复原的道具/装备）时，
  // 选项①要如实标注——否则选了它只会看到空列表，感觉「无法复原」
  const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).length;
  const restoreOpt = restorableN
    ? nodeOpt('altarRewardRestore', '① 复原 3 张消耗卡 + 回复 10 血', `从消耗区挑选卡牌复原回背包（现有 ${restorableN} 张可复原${restorableN < 3 ? '，不足 3 张时全复原' : ''}），并回复 10 点生命`, 'ok')
    : nodeOpt('altarRewardRestoreOff', '① 复原 3 张消耗卡 + 回复 10 血', '消耗区里没有可复原的卡牌（道具/装备类消耗不可复原）——此项不可选', '', 'disabled title="消耗区里没有可复原的卡牌，请选奖励②"');
  nodeShell({
    tone: 'altar', icon: '[[icon:crystal]]', title: '祭坛回赠 · 二选一',
    sub: '祭坛已苏醒——选择你要的奖励（只能选一次；离开后回到本格可再选）',
    body:
      restoreOpt +
      nodeOpt('altarRewardLoot', '② 传说卡 + 装备卡', '随机获取 1 张传说卡和 1 张装备卡') +
      nodeOpt('altarRewardLeave', '离开 · 稍后再选', '祭坛保持苏醒——奖励保留，回到本格可再选（奖励只能领取一次）'),
  });
  const active = altarPageBinding('altarRewardLeave');
  UI.act('altarRewardRestore', async () => {
    if (!active() || !game.altarRewardPending || !restorableN) return;
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
    if (!active() || !game.altarRewardPending) return;
    const legend = SDT.Cards.all().filter(c => c.rarity === '传说' && SDT.Cards.isRandomObtainable(c));
    const equips = SDT.Cards.all().filter(c => c.type === '装备' && SDT.Cards.isRandomObtainable(c));
    const legendPick = legend.length ? legend[Math.floor(Random.random('loot') * legend.length)] : null;
    // 同一奖励内不得重复（2026-09-13 老板口径）：传说装备卡（不朽神剑/混沌之眼等）同时
    // 属于两个池，两池各自随机时会把同一张牌发两次；装备池里排掉已发的那张再抽
    const restEquips = equips.filter(c => !legendPick || (c.id !== legendPick.id && c.name !== legendPick.name));
    const equipPick = restEquips.length ? restEquips[Math.floor(Random.random('loot') * restEquips.length)] : null;
    game.altarRewardPending = false;   // 选择已确定，待领卡牌由持久化领奖页接管。
    openFixedRewardsOnCell([legendPick, equipPick], '祭坛回赠 · 传说卡与装备卡');
  });
  UI.act('altarRewardLeave', () => { if (!active()) return; setBagReturnHook(null); UI.hideOverlay(); finishInstant(); });
  UI.refresh(game);
}

// 首脑格：祭坛激活后直接挑战本层固定首脑，胜利后终局撤离点放行。
export function openBossGate() {
  game.state = 'modal';
  setBagReturnHook(null);
  UI.hideOverlay();
  if (!game.altarActivated) {
    UI.log('[[icon:skull]] 首脑巢穴仍被封印，先激活污染祭坛再来挑战', 'warn');
    game.state = 'idle';
    saveGame();
    UI.refresh(game);
    return;
  }
  const rules = MAP.rules;
  nodeShell({ tone:'battle', asset:'scene-battle-bg', icon:'[[icon:skull]]', title:'首脑迎战',
    sub:`首脑战使用独立牌库：从随身招式、装备和能力卡中自动编入最多 ${rules.bossDeckSize} 张，再加入 ${rules.starterSha} 张初始攻击。背包其余卡牌不会消失。`,
    body:nodeOpt('bossGateFight','继续迎战',`起手抽 ${rules.battleStartDraw} 张，每回合抽 ${rules.battleTurnDraw} 张，手牌上限 ${rules.battleHandMax} 张。请先检查随身卡牌。`, 'ok') +
      '<p class="reward-notice">先看敌方意图，高伤回合先用护盾、护甲或格挡减伤；对方有防护或元素庇幕时，如有破甲牌，可施加破甲再集中攻击。</p>',
    foot:'<button class="ov-btn" data-act="bossGateBag">整理背包</button><button class="ov-btn" data-act="bossGateBack">返回地图</button>',
  });
  const active = altarPageBinding('bossGateFight');
  let entering = false;
  setBagReturnHook(openBossGate);
  UI.act('bossGateBag', () => { if (active() && !entering) bagSlots.showBackpack(); });
  UI.act('bossGateBack', () => { if (!active() || entering) return; setBagReturnHook(null); UI.hideOverlay(); finishInstant(); });
  UI.act('bossGateFight', () => {
    if (!active() || entering) return;
    entering = true;
    setBagReturnHook(null);
    UI.hideOverlay();
    // 本层只抽取一次首脑；重进和读档沿用 bossPlan。
    if (game.bossPlan == null) game.bossPlan = Math.floor(Random.random('boss') * MAP.altar.bosses.length);
    const b = MAP.altar.bosses[game.bossPlan % MAP.altar.bosses.length];
    const bossFoe = scaledEnemy(b);
    bossFoe.boss = true;
    startBattle(game, bossFoe, { isBoss:true, name:b.name, directBossStart:true });
  });
  UI.refresh(game);
}

// 背包献祭选卡器（2026-09-06 #26）：从背包选 n 张卡，确认后消耗并回调
// onCancel：取消时的回流（缺省回祭坛面板）
function openBagSacrifice(n, done, onCancel, filterType) {
  game.state = 'modal';
  const sel = new Set();
  const back = onCancel || (() => openAltarRitual(curLayer()?.logical?.[game.trackPos]?.def));
  const eligible = filterType ? game.ownedCards.filter(o => o.card.type === filterType) : game.ownedCards;
  const slotId = getActiveSlot(), seed = game.seed, runToken = game.discoveredPairs, map = game.layerData;
  const layerIdx = game.layerIdx, trackPos = game.trackPos;
  const current = () => getActiveSlot() === slotId && game.seed === seed && game.discoveredPairs === runToken &&
    game.layerData === map && game.layerIdx === layerIdx && game.trackPos === trackPos;
  let finished = false;
  const render = () => {
    if (finished || !current()) return;
    game.state = 'modal';
    setBagReturnHook(render);
    // 2026-09-10 留言 #31/#32：原文字行看不清也看不到卡面——改为真卡面网格（口径同火堆复原），
    // 点卡选中/取消，选中卡挂黄铜图钉角标
    const rows = eligible.map(o => `
      <button type="button" class="bt-card sac-card${sel.has(o.uid) ? ' sel' : ''}" data-act="sacPick" data-uid="${escAttr(o.uid)}" aria-label="献祭候选：${escAttr(o.card.name)}" aria-pressed="${sel.has(o.uid)}"
        title="${escAttr(`${o.card.name}${o.card.cost != null ? ` · ${o.card.cost} 费` : ''}——${o.card.desc || '点击选中/取消'}`)}">
        ${SDT.Cards.cardHTML(o.card, 'sm')}
        ${o.card.cost != null ? `<span class="bt-sac-cost">${o.card.cost} 费</span>` : ''}
      </button>`).join('');
    UI.showOverlay('[[icon:crystal]] 选择要献祭的卡牌', `
      <p class="ov-note">选择 <b>${n}</b> 张${filterType ? `<b>${escAttr(filterType)}</b>卡` : '卡牌'}献祭（已选 <b>${sel.size}</b>）</p>
      <div class="bt-hand sac-hand">${rows || '<p class="ov-empty">背包里没有符合条件的卡牌</p>'}</div>
      <div class="scene-ops">
        <button class="ov-btn ok" data-act="sacConfirm" ${sel.size !== n ? 'disabled' : ''}>[[icon:crystal]] 确认献祭</button>
        <button class="ov-btn" data-act="sacCancel">[[icon:exit]] 取消</button>
      </div>`, 'discover');
    const active = altarPageBinding('sacConfirm');
    UI.act('sacPick', (d) => {
      if (finished || !active()) return;
      const o = eligible.find(x => x.uid === d.uid);
      if (!o) return;
      if (sel.has(o.uid)) sel.delete(o.uid);
      else if (sel.size < n) sel.add(o.uid);
      Sfx.tick();
      render();
      [...UI.el.ovBody.querySelectorAll('[data-act="sacPick"]')].find(button => button.dataset.uid === o.uid)?.focus({ preventScroll:true });
    });
    UI.act('sacCancel', () => {
      if (finished || !active()) return;
      finished = true; setBagReturnHook(null); UI.hideOverlay(); back();
    });
    UI.act('sacConfirm', () => {
      if (finished || !active()) return;
      const chosen = eligible.filter(o => sel.has(o.uid) && game.ownedCards.includes(o));
      if (chosen.length !== n) return;
      finished = true;
      setBagReturnHook(null);
      game.ownedCards = game.ownedCards.filter(o => !sel.has(o.uid));
      UI.hideOverlay();
      done(chosen);
    });
  };
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
      const active = altarPageBinding('stayHere');
      UI.act('stayHere', () => { if (!active()) return; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
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
    const active = altarPageBinding('stayHere');
    UI.act('payExit', () => {
      if (!active()) return;
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
    UI.act('stayHere', () => { if (!active()) return; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
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
  const active = altarPageBinding('stayHere');
  UI.act('payExit', () => {
    if (!active() || !game.bossKilled) return;
    SDT.Sound.sfx('extractionConfirm');
    UI.log('启动撤离信标，准备返回基地', 'sys');
    UI.hideOverlay();
    doExtract();
  });
  UI.act('stayHere', () => { if (!active()) return; UI.hideOverlay(); game.state = 'idle'; UI.refresh(game); });
  UI.refresh(game);
}

// 撤离成功 → 「整理入库」交互：把背包中的物品放回仓库（不入库的会丢失）。
// 「初始攻击」为初始牌不可入库；木材/口粮自动入库；消耗区逐张 1/3 概率保留（散失的不复原）。
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
  const startedFromSlot = getActiveSlot();
  const continuing = game.extractionPending && typeof game.extractionPending === 'object';
  // 撤离前先落盘（09-27 撤离保存失败修复）：saveGame 只在部分节点结算时触发——
  // 低血速通路线（跳宝箱、直奔撤离点）可全程零存档，begin 的 readCurrent 读到
  // 不存在的 RUN_KEY 报「版本或结构无效」→ extractRetry 重试页每按一次都重复失败，
  // 玩家被锁死在撤离页。首次预存失败不能拿旧快照与当前内存混合提交；
  // 已有 token 表示此前预存成功，事务重试须沿用它（此时 saveGame 会拒写）。
  if (!continuing) {
    const saved = saveGame();
    if (startedFromSlot && saved !== true) {
      UI.log('[[icon:cross]] 撤离前进度未保存，整理尚未开始；请检查存档错误并重试', 'warn');
      showExtractionRetry(false);
      return false;
    }
  }
  extractionStarting = true;
  const initialIdentity = startedFromSlot ? RunStorage.readIdentity(startedFromSlot) : null;
  const pendingToken = continuing
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
      UI.log(`[[icon:pocket]] 撤离结算：消耗区 <b>${totalPocketCount}</b> 张只有 1/3 保留（带回 ${totalPocketCount - lostPocketCount} 张，散失 ${lostPocketCount} 张）`, 'sys');
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

function showExtractionRetry(checkpointSaved = true) {
  game.state = 'modal';
  const message = checkpointSaved
    ? '<p>撤离已成功，整理快照尚未确认写入。请重试保存后继续。</p><p class="ov-note">[[icon:info]] 撤离前的局面已保存——若反复失败，可以退出游戏重新进入，会回到撤离前的位置，不会重复扣卡。</p>'
    : '<p>撤离前的进度未保存，整理尚未开始。请检查存储空间或档位冲突后重试。</p><p class="ov-note">[[icon:info]] 此时退出会回到上一次成功保存的位置。</p>';
  UI.showOverlay('', `<div class="pg hub"><h2>撤离结算待恢复</h2>${message}<button class="ov-btn ok" data-act="extractRetry">重试撤离整理</button></div>`, 'page');
  const active = altarPageBinding('extractRetry');
  UI.act('extractRetry', () => { if (!active()) return; UI.hideOverlay(); return doExtract(); });
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
  // EXP-003（2026-09-29）：消耗区行如实展示 1/3 逐张结算结果（保留数/散失数来自撤离掷骰快照）
  const pocketPending = game.pendingExtraction;
  const pocketTotal = pocketPending && Number.isInteger(pocketPending.totalPocketCount) ? pocketPending.totalPocketCount : null;
  const pocketNote = pocketTotal == null
    ? '每张仅 1/3 概率带回（进基地消耗区，钥匙可复原）'
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
      <p class="help-item"><b>自动入库</b>木材/口粮自动入库（纯资源没有丢弃的意义）；消耗区逐张结算，每张仅 1/3 概率带回——保留的进基地消耗区（用钥匙复原），未带回的散失；「初始攻击」不可入库（每局自动携带）。</p>
      <p class="help-item"><b>仓库容量</b>可在基地「升级」页用 [[icon:wood]] 木材×${MAP.rules.stashUpgradeWood} 扩建 +${MAP.rules.stashUpgradeSlots} 张；仓库里的卡牌下次出发时可以携带。</p>`,
    back: () => renderExtractStash(),
  });
  UI.showOverlay('', `
    <div class="pg hub result-pg" id="exMain" data-unclaimed-cards="${totalLeft}">
      <header class="hub-head">
        <h2>[[icon:exit]] 撤离成功 · 整理入库</h2>
        ${UI.helpBtn('extract')}
        <span class="pg-spacer"></span>
        <span class="hub-res">
          <span class="res-chip">[[icon:archive]] 仓库容量 <b class="${room <= 0 ? 'fulled' : ''}">${B.stashUsed()}/${B.stashCap()}</b> 张</span>
          <span class="res-chip">[[icon:coin]] 随身币不带回（<b>${game.coins}</b> 币留在局中）</span>
        </span>
      </header>
      <div class="result-summary"><span class="result-kicker">撤离回收</span><b>${totalLeft ? `还有 ${totalLeft} 张卡牌等待入库` : '卡牌整理完毕'}</b><span>${totalLeft ? '点击卡面逐项入库，或使用右侧整理操作。完成整理时，未入库卡牌将丢失。' : '确认完成整理，查看本次远征结算。'}</span></div>
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
          <div class="pk-row"><span>[[icon:pocket]] 消耗区</span><span class="dim">${pocketNote}</span></div>
          ${extractLeft.length ? `<button class="ov-btn ok" data-act="exAll" ${room > 0 && totalLeft <= room ? '' : 'disabled'}
            style="width:100%">[[icon:archive]] 全部入库（${Math.min(totalLeft, room)}/${totalLeft} 张可入）</button>` : ''}
          <div class="dep-foot" style="margin-top:10px">
            ${extractLeft.length ? '<button class="ov-btn ok" data-act="exSmart" style="width:100%;margin-top:8px">[[icon:sparkles]] 智能整理（优先价值最高 · 上限仓库空格）</button>' : ''}
            <button id="btnDeploy" data-act="exFinish">[[icon:check]] 完成整理${extractLeft.length ? `（${totalLeft} 张将丢失）` : ''}</button>
          </div>
        </section>
      </div>
    </div>`, 'page');
  UI.act('exStash', async (d) => {
    if (!stillThisView()) return;
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
    if (!stillThisView()) return;
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
    if (!stillThisView()) return;
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
    if (!stillThisView()) return;
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
  const gainRow = `<p class="result-line"><span class="ov-note">[[icon:sparkles]] 本局真实入库 <b>${net.cardsStashed ?? 0}</b> 张 · 消耗区带回 <b>${net.pocketKept ?? 0}</b> 张 ·
    [[icon:wood]] 木材 ×<b>${net.wood ?? 0}</b> · [[icon:bread]] 口粮 ×<b>${net.rations ?? 0}</b> · [[icon:medal]] 首探经验 <b class="gold">+${r.firstExplore?.xp ?? 0}</b></span></p>`;
  const lossRow = (loss.lostCount || loss.pocketLost)
    ? `<p class="ov-note">[[icon:cross]] 散失：未入库 ${loss.lostCount || 0} 张${loss.lostNotable?.length ? `（${loss.lostNotable.map(c => `【${esc(c.name)}】×${c.count}`).join('、')}）` : ''} · 消耗区散失 ${loss.pocketLost || 0} 张</p>`
    : '';
  nodeShell({
    tone: 'exit',
    music: 'success',
    icon: wasClear ? '[[icon:trophy]]' : '[[icon:home]]',
    title: wasClear ? '首脑突破 · 满载而归' : '保本返回 · 撤离成功',
    sub: `${wasClear ? '击破第四层首脑，从终局撤离点凯旋' : '见好就收，带着战利品安全返回基地'} ·
      用时 <b>${timeStr}</b> · 行动 <b>${r.actions ?? 0}</b> 次 · 抵达 <b>第 ${r.layersReached ?? '-'} 层</b> · 剩余生命 <b style="color:#7fdd9c">${game.hp}/${game.maxHp}</b> ·
      本局携带 <b class="gold">${r.runCoins ?? game.coins ?? 0} 币</b>（留在局中）`,
    body: `<div class="extraction-outcome">
      ${gainRow}${lossRow}
      <p class="result-line"><span class="ov-note">[[icon:archive]] 仓库总持有 <b>${B.stashUsed()}/${B.stashCap()}</b> 张（含往局） ·
        [[icon:sparkles]] 图鉴 <b>${Object.keys(B.data.collection).length}</b></span></p>
      <p class="ov-note">下次出发时可以从仓库选择卡牌携带；储备币 <b>${B.data.coins}</b> 币留在基地（不进局，用于孵蛋与基地建设）。</p></div>`,
    foot: `
      <button class="ov-btn" data-act="goBase">[[icon:home]] 回基地</button>
      <button class="ov-btn ok" data-act="again">[[icon:runner]] 再出发</button>`,
  });
  UI.act('goBase', () => openBaseHub('deploy'));
  UI.act('again', () => openBaseHub('deploy'));
  UI.refresh(game);
}
