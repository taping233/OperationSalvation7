/* ============================================================

 * game.run.altar.js —— 祭坛/层间门/BOSS 门/火堆/职业选择/撤离整理（架构批次 4）
 *
 * 由 game.run.js 拆出。层位中间（L1）：依赖 game.run.scenes.js，反向不被其依赖；
 * FLOW（game.run.flow.js）依赖本文件。
 * ============================================================ */
import { BOSS_ALTAR_REQUIREMENT } from '../core/map-node-state.js';
import { characterFor, characterName } from '../core/characters.js';
import { installExpeditionFeedback } from '../ui/expedition-feedback.js';
import { openClassChoice as requestClassChoicePage } from './game.run.class-choice.js';
import { showRewardCardFeedback } from '../ui/reward-card-feedback.js';
import { altarRitualHTML, altarRewardHTML, entrySupplyIntroHTML } from '../ui/node-decision-view.js';
import { fireRestDecisionHTML } from '../ui/fire-rest-view.js';
import { rewardSceneHTML } from '../ui/reward-scene-view.js';
import { claimEntrySupply, entrySupplyAt, nodeActionBinding } from './node-reward-state.js';
import { beginNodeRestore, nodeRestoreAt } from './node-restore-state.js';
import { bagSlots } from '../hub/game.bag.bridge.js';
import { setBagReturnHook } from '../hub/bag-return-hook.js';
import { esc, escAttr } from '../core/shared.js';
import { MAP, MODES, bagCap, curLayer, enterLayer, game, getActiveSlot, newUid, saveGame, scaledEnemy, usedSlots } from './game.session.js';
import { buildExtractionReceipt, createExtractionCommands, extractionPocketOutcome, validatePendingExtraction } from '../hub/extraction.commands.js';
import { openBaseHub } from '../hub/game.hub.js';
import { extractionDoneHTML, extractionStashHTML } from '../ui/extraction-rewards-view.js';

import { Sfx, _set_cardPageOpen } from '../hub/game.cardslib.js';
import { Random, SeededRandomService } from '../core/random.js';
import { startBattle } from '../battle/battle-loader.js';
import { FIRE_RESTORABLE, consumeCurrentCell, enterNode, finishInstant, grantEventCard, nodeOpt, nodeShell, openFixedRewardsOnCell, openPocketRestore, openShop } from './game.run.scenes.js';
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
      body:`<div class="ui-design-system fire-result-layout">${restored.length || bonus ? `<div class="fire-result-cards">${[...restored, ...(bonus ? [bonus] : [])].map((card, i) => `<div><span class="fire-result-label">${i < restored.length ? '已复原' : '额外获得'}</span><button type="button" class="event-choice-card" data-act="fireResultCard" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card,'sm')}</button></div>`).join('')}</div>` : ''}<button type="button" class="ui-action ui-action-primary" data-act="fireDone">继续探索 <span aria-hidden="true">→</span></button></div>`,
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
    body:fireRestDecisionHTML({ heal:MAP.rules.fireHeal, chance:Math.round(MAP.rules.fireClassCardChance * 100),
      restorable:restorableN, fits, capacity:game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格` }),
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
  let claimNotice = '';
  const cards = () => supply.cardIds.map(id => SDT.Cards.all().find(card => card.id === id));
  const isCurrent = () => entrySupplyAt(game) === supply;
  const finish = () => { setBagReturnHook(null); UI.hideOverlay(); finishInstant(); };
  const showResult = () => {
    const complete = supply.taken.length === supply.cardIds.length;
    UI.showOverlay('', rewardSceneHTML({ className:`pg entry-reward-scene entry-supply-strips${complete ? ' reward-complete' : ''}`, title:'随行补给', source:characterName(game.myClass), rule:complete ? '' : '点卡面查看详情', count:supply.cardIds.length - supply.taken.length,
      cards:complete ? '<div class="entry-reward-complete"><span class="entry-complete-symbol" aria-hidden="true">[[icon:exit]]</span><p>补给已领齐</p><button type="button" class="entry-complete-confirm" data-act="clsEntryContinue"><span aria-hidden="true">✓</span> 继续探索</button></div>' : cards().map((card, i) => supply.taken.includes(i) ? '' : card ? `<article class="reward-unit"><button class="reward-card" data-act="clsEntryCard" data-i="${i}" aria-label="放大查看${escAttr(card.name)}">${SDT.Cards.cardHTML(card)}</button><div class="entry-reward-label">${esc(card.name)}</div><div class="entry-reward-amount"><span>×</span>1</div><button type="button" class="reward-claim" data-act="entrySupplyTake" data-i="${i}">收下</button></article>` : '<p class="reward-empty">该职业补给暂不可用</p>').join(''),
      actions:`<div class="entry-supply-status" role="status" aria-live="polite"><span>已领取</span><b>${supply.taken.length} / ${supply.cardIds.length}</b></div>`,
      footer:`<button class="reward-bag" data-act="entrySupplyBag">整理背包</button>${saveFailed ? '<p class="entry-save-warning" role="status">当前进度未保存，请查看存档错误提示。</p>' : ''}${complete ? '' : `<span class="reward-notice" role="status">${claimNotice || '领完补给后可继续探索；放不下时请先整理背包'}</span>`}`,
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
    if (!received.length) {
      claimNotice = '当前补给未领取，仍保留在入口。请整理背包后再试。';
      UI.log('[[icon:bag]] 当前补给未领取，请整理背包后再试', 'warn');
      showResult();
      return;
    }
    claimNotice = '';
    document.getElementById('cardZoom')?._closeCardZoom?.(true);
    if (supply.taken.length === supply.cardIds.length) consumeCurrentCell();
    saveFailed = saveGame() === false;
    UI.refresh(game);
    showResult();
    showRewardCardFeedback(UI.el?.ovBody, received, { mode:'page', token:supply, sceneSelector:'.entry-supply-strips' });
  };
  setBagReturnHook(() => { if (isCurrent()) openEntrySupply(); });
  if (supply.taken.length) { showResult(); return true; }
  nodeShell({ tone:'entry', asset:'scene-door-bg', icon:'', title:'入城补给',
    sub:'随行的职业补给已留在城门旁。',
    body:entrySupplyIntroHTML({ count:supply.cardIds.length, character:characterName(game.myClass), capacity:game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格` }),
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
  const shopOpen = () => cellDef?.type === 'shop' && !game.visited?.[`${game.layerIdx},${game.trackPos}`];
  // 2026-09-09 需求 #13：只能在第三层（紧急撤离点）与第四层（终局撤离点）撤离——
  // 环间门不再提供撤离选项，只能向深处走
  nodeShell({
    tone: 'door', icon: '[[icon:door]]', title: '层间闸门',
    sub: door.reverse ? '这条通路返回已探索的区域。' : '穿过闸门后进入下一层。确认前可返回当前层检查遗漏，或先整理背包。',
    body:
      nodeOpt('goDoor', `${door.reverse ? '返回' : '进入'}${target.name}`, '', 'ok') +
      (shopOpen() ? nodeOpt('doorShop', '逛商队', '闸门旁的拾荒商队还在营业') : ''),
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
    if (cellDef?.type === 'shop') consumeCurrentCell();
    setBagReturnHook(null);
    UI.hideOverlay();
    UI.log(`穿过隔离闸门 → <b>${target.name}</b>`, 'sys');
    // 穿门换层走镜头补间（2026-09-27 二轮动效）：壁纸交叉溶解 + 相机滑入新环，不再硬切
    enterLayer(door.toLayer, door.arriveAt, { glideCam: true });
    SDT.Sound.sfx('layerEnter');
  });
  UI.act('doorShop', () => { if (active() && !entering && shopOpen()) openShop('door:' + door.pair); });
  UI.refresh(game);
}

// ---------- 第四层终局：祭坛格（弃3激活选奖励）→ 首脑格 → 终局撤离点 ----------
// 祭坛：弃掉背包 3 张牌激活后二选一奖励；集齐 2 枚员工通行证A碎片可不走弃牌直接换能力卡。
// 激活（或兑换）成功才算触发过本格；离开未激活可再来。首脑格必须先激活祭坛。
export function resumeNodeRestore() {
  const record = nodeRestoreAt(game);
  if (!record) return false;
  const done = record.source === 'altar-offering' ? () => { saveGame(); openAltarRitual(); } : finishInstant;
  return openPocketRestore(record.total, done, {
    tone:'altar', icon:'[[icon:altar]]', title:'祭坛回赠 · 复原', restoreRecord:record,
  });
}

export function openAltarRitual(def) {
  if (resumeNodeRestore()) return;
  game.state = 'modal';
  // 需求（2026-09-13 老板）：祭坛的选项和奖励只能选一次——激活后不再重复展示弃3/碎片等
  // 激活选项：奖励未领取时重进直接进回赠面板；奖励已领取则本格视为完全消耗
  if (game.altarActivated && game.altarRewardPending) { openAltarReward(); return; }
  if (game.altarActivated) {
    UI.log('[[icon:altar]] 这座祭坛的仪式已经完成，没有什么可做的了', 'sys');
    finishInstant();
    return;
  }
  const frags = game.fragments || 0;
  nodeShell({
    tone: 'altar', icon: '[[icon:altar]]', title: '污染祭坛',
    sub: '沉睡的祭坛等待你的献礼。',
    body:altarRitualHTML({ fragments:frags, capacity:game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`,
      availableCards:sacrificeCards().length, hasItem:sacrificeCards('道具').length > 0,
      itemUsed:game.altarItemSacrificed, restorable:game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).reduce((sum, p) => sum + p.count, 0) }),
    foot:'<button class="ov-btn" data-act="altarBag">整理背包</button><button class="ov-btn" data-act="altarLeave">离开</button>',
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
    if (game.altarItemSacrificed) { UI.log('[[icon:altar]] 这座祭坛的道具献祭已经受理过了', 'warn'); return; }
    if (!sacrificeCards('道具').length) { UI.log('[[icon:bag]] 背包里没有道具卡可供献祭', 'warn'); return; }
    const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).reduce((sum, p) => sum + p.count, 0);
    if (!game.usedPocket.length || !restorableN) { UI.log('[[icon:bag]] 消耗区里没有可复原的卡牌——先去战斗吧', 'warn'); return; }
    openBagSacrifice(1, (chosen) => {
      game.altarItemSacrificed = true;   // 确认献祭才上锁；取消献祭不上锁
      beginNodeRestore(game, { source:'altar-offering', picks:Math.min(2, restorableN) });
      SDT.Sound.sfx('altarOffer');
      UI.log(`[[icon:altar]] 献上道具【<b>${esc(chosen[0].card.name)}</b>】——从消耗区复原卡牌（本祭坛的道具献祭已用完）`, 'loot');
      saveGame();
      // 祭坛道具路径的复原页跟祭坛身份，不落默认「营火休整」（同 openAltarReward 口径）
      resumeNodeRestore();
    }, () => openAltarRitual(def), '道具');
  });
  UI.act('altarOn3', () => {
    if (!active() || game.altarActivated) return;
    if (sacrificeCards().length < 3) { UI.log('[[icon:bag]] 背包卡牌不足 3 张，无法激活祭坛', 'warn'); return; }
    openBagSacrifice(3, (chosen) => {
      markActivated();
      game.altarRewardPending = true;
      UI.log(`[[icon:altar]] 献上 ${chosen.map(o => `【${esc(o.card.name)}】`).join('')}——<b>祭坛苏醒了</b>，请选择一项奖励`, 'loot');
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
        tone: 'altar', icon: '[[icon:altar]]', title: '碎片兑换 · 暂不可用',
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
  const restorableN = game.usedPocket.filter(p => FIRE_RESTORABLE(p.card)).reduce((sum, p) => sum + p.count, 0);
  nodeShell({
    tone: 'altar', icon: '[[icon:altar]]', title: '祭坛回赠 · 二选一',
    sub: '祭坛已苏醒。',
    body:altarRewardHTML({ capacity:game.bagCapacityText?.() || `${usedSlots()}/${bagCap()} 格`, restorable:restorableN }),
    foot:'<button class="ov-btn" data-act="altarRewardLeave">离开 · 稍后再选</button>',
  });
  const active = altarPageBinding('altarRewardLeave');
  UI.act('altarRewardRestore', async () => {
    if (!active() || !game.altarRewardPending || !restorableN) return;
    const record = beginNodeRestore(game, { source:'altar-reward', picks:Math.min(3, restorableN) });
    if (!record) return;
    game.altarRewardPending = false;   // 选择已锁定，未用完的次数由节点复原记录接管。
    UI.log(`[[icon:heart]] 祭坛回赠：回复 <b>${record.hpGain}</b> 点生命（${game.hp}/${game.maxHp}）`, 'heal');
    saveGame();
    UI.hideOverlay();
    resumeNodeRestore();
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
    nodeShell({ tone:'battle', asset:'scene-battle-bg', icon:'[[icon:skull]]', title:'祭坛未激活',
      sub:BOSS_ALTAR_REQUIREMENT,
      foot:'<button class="ov-btn" data-act="bossGateLockedBack" data-cancel="true">返回地图</button>',
    });
    const active = altarPageBinding('bossGateLockedBack');
    UI.act('bossGateLockedBack', () => {
      if (!active()) return;
      UI.hideOverlay(); finishInstant();
    });
    UI.refresh(game);
    return;
  }
  const rules = MAP.rules;
  nodeShell({ tone:'battle', asset:'scene-battle-bg', icon:'[[icon:skull]]', title:'首脑迎战',
    sub:`首脑战使用独立牌库：开战前整理并选择 ${rules.bossDeckSize} 张招式、装备或能力卡，不足时全部编入；另加入 ${rules.starterSha} 张初始攻击。背包其余卡牌不会消失。`,
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
    return enterNode('boss', () => {
      // 本层只抽取一次首脑；重进和读档沿用 bossPlan。
      if (game.bossPlan == null) game.bossPlan = Math.floor(Random.random('boss') * MAP.altar.bosses.length);
      const b = MAP.altar.bosses[game.bossPlan % MAP.altar.bosses.length];
      const bossFoe = scaledEnemy(b);
      bossFoe.boss = true;
      return startBattle(game, bossFoe, { isBoss:true, name:b.name });
    });
  });
  UI.refresh(game);
}

// 献祭只支付普通随身背包；安全格或容器内卡牌需先由玩家移回背包。
function canSacrificeCard(owned, filterType) {
  return !!owned?.card && !owned.safe && !owned.stored && !owned.pouchOf
    && (!filterType || owned.card.type === filterType);
}
function sacrificeCards(filterType) { return game.ownedCards.filter(owned => canSacrificeCard(owned, filterType)); }

// 背包献祭选卡器（2026-09-06 #26）：从背包选 n 张卡，确认后消耗并回调
// onCancel：取消时的回流（缺省回祭坛面板）
function openBagSacrifice(n, done, onCancel, filterType) {
  game.state = 'modal';
  const sel = new Set();
  const back = onCancel || (() => openAltarRitual(curLayer()?.logical?.[game.trackPos]?.def));
  let eligible = [];
  const slotId = getActiveSlot(), seed = game.seed, runToken = game.discoveredPairs, map = game.layerData;
  const layerIdx = game.layerIdx, trackPos = game.trackPos;
  const current = () => getActiveSlot() === slotId && game.seed === seed && game.discoveredPairs === runToken &&
    game.layerData === map && game.layerIdx === layerIdx && game.trackPos === trackPos;
  let finished = false;
  let hand = null;
  const render = () => {
    if (finished || !current()) return;
    const scrollTop = hand?.scrollTop ?? 0;
    game.state = 'modal';
    eligible = sacrificeCards(filterType);
    const allowed = new Set(eligible.map(owned => owned.uid));
    for (const uid of sel) if (!allowed.has(uid)) sel.delete(uid);
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
      <p class="ov-note">仅可献祭普通随身背包卡牌；安全格和容器内的卡牌需先移回背包。</p>
      <div class="bt-hand sac-hand">${rows || '<p class="ov-empty">背包里没有符合条件的卡牌</p>'}</div>
      <div class="scene-ops">
        <button class="ov-btn ok" data-act="sacConfirm" ${sel.size !== n ? 'disabled' : ''}>[[icon:crystal]] 确认献祭</button>
        <button class="ov-btn" data-act="sacCancel">[[icon:exit]] 取消</button>
      </div>`, 'discover');
    // 重绘会替换滚动容器；只延续本次选牌的位置，新会话从顶部开始。
    hand = UI.el?.ovBody?.querySelector('.sac-hand');
    if (hand) hand.scrollTop = scrollTop;
    const active = altarPageBinding('sacConfirm');
    UI.act('sacPick', (d) => {
      if (finished || !active()) return;
      const o = eligible.find(x => x.uid === d.uid);
      if (!o || !game.ownedCards.includes(o) || !canSacrificeCard(o, filterType)) return;
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
      const chosen = eligible.filter(o => sel.has(o.uid) && game.ownedCards.includes(o) && canSacrificeCard(o, filterType));
      if (chosen.length !== n) { render(); return; }
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
    const payment = emergencyExitPaymentState(sacrificeCards().length);
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
      if (!emergencyExitPaymentState(sacrificeCards().length).canPay) {
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
    const { totalPocketCount } = started.value;
    const pocket = extractionPocketOutcome(started.value, SDT.Base.isSha);
    if (totalPocketCount > 0) {
      UI.log(`[[icon:pocket]] 撤离结算：消耗区 <b>${totalPocketCount}</b> 张逐张以 1/3 概率结算；实际带回 ${pocket.keptCount} 张待复原，散失 ${pocket.lostCount} 张${pocket.ruleLost ? `（含初始攻击/职业卡 ${pocket.ruleLost} 张不可带回）` : ''}`, 'sys');
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

function extractionFinishSignature() {
  const pending = game.pendingExtraction;
  return JSON.stringify([getActiveSlot(), pending?.runId, pending?.requestSeq,
    pending?.remainingCards?.map(s => [s.card.id ?? null, s.card.name, s.count])]);
}

function renderExtractStash(notice = '', finishSignature = null) {
  const B = SDT.Base;
  const viewRevision = ++extractViewRevision;
  const viewSlot = getActiveSlot();
  const viewRunId = game.pendingExtraction?.runId;
  let surface = null, updating = false;
  const stillThisView = (finished = false) => viewRevision === extractViewRevision && getActiveSlot() === viewSlot && !UI.el?.overlay?.hidden &&
    (!surface || UI.el?.ovBody?.querySelector('#exMain') === surface) &&
    (game.pendingExtraction?.runId === viewRunId || (finished && !game.runActive && !game.pendingExtraction));
  const pending = game.pendingExtraction;
  const pocket = extractionPocketOutcome(pending, B.isSha);
  const receipt = buildExtractionReceipt({ game, pending, isSha: B.isSha, xpMul: MODES[game.mode]?.xpMul || 1 });
  const broughtByName = new Map();
  for (const o of game.ownedCards) {
    if (o.brought) broughtByName.set(o.card.name, (broughtByName.get(o.card.name) || 0) + 1);
  }
  const room = Math.max(0, B.stashRoom());
  const totalLeft = extractLeft.reduce((n, s) => n + s.count, 0);
  game.state = 'done';
  _set_cardPageOpen(false); // Esc cannot bypass the explicit finish-and-loss action.
  UI.registerHelp('extract', {
    title: '整理入库说明',
    html: `<p class="help-item"><b>背包卡牌</b>点击卡面查看详情，再点击下方「入库」；同叠按仓库剩余空位部分入库。未入库的卡牌（含出发带入卡）在完成整理时永久丢失。</p>
      <p class="help-item"><b>自动入库</b>木材/口粮已入库。消耗区逐张以 1/3 概率结算；初始攻击与职业卡不能带回基地，其余实际保留的卡进入基地消耗区，需用钥匙复原。</p>
      <p class="help-item"><b>按估值入库</b>按卡牌估值从高到低，同估值按背包原次序。估值不代表稀有度或实战强度，也不表示卡牌可以出售。入库立即保存，本页不能撤回或换选。</p>
      <p class="help-item"><b>仓库容量</b>可在基地「升级」页用 [[icon:wood]] 木材×${MAP.rules.stashUpgradeWood} 扩建 +${MAP.rules.stashUpgradeSlots} 张。入库选择会逐次保存，卡牌下次出发时可以携带。</p>`,
    back: () => renderExtractStash(),
  });
  UI.showOverlay('', extractionStashHTML({
    remainingCards: extractLeft, savedCards: receipt.savedCards, keptPocket: pocket.keptCards,
    pocketKept: pocket.keptCount, pocketLost: pocket.lostCount, pocketRuleLost: pocket.ruleLost,
    wood: receipt.netTake.wood, rations: receipt.netTake.rations,
    stashUsed: B.stashUsed(), stashCap: B.stashCap(), room, coins: game.coins,
    shaN: game.ownedCards.filter(o => B.isSha(o.card)).length, starterSha: MAP.rules.starterSha,
    otherN: game.inventory.filter(i => i.name !== '木材' && i.name !== '口粮').reduce((n, i) => n + i.count, 0),
    broughtByName, cardHTML: (card, size) => SDT.Cards.cardHTML(card, size),
    rarityOf: card => SDT.Cards.rarityOf?.(card) || card.rarity,
    help: UI.helpBtn('extract'), notice, confirmFinish: finishSignature !== null,
  }), 'page');
  surface = UI.el?.ovBody?.querySelector('#exMain') || null;
  if (finishSignature !== null) surface?.querySelector('[data-act=exCancelFinish]')?.focus();
  const inspect = stacks => d => {
    if (!stillThisView() || updating) return;
    const card = stacks[Number(d.i)]?.card;
    if (card) UI.showCardZoom?.(card, { hideNote: true, presentation: 'expedition' });
  };
  UI.act('exInspect', inspect(extractLeft));
  UI.act('exSavedInspect', inspect(receipt.savedCards));
  UI.act('exPocketInspect', inspect(pocket.keptCards));
  const setSaving = () => {
    updating = true;
    surface?.setAttribute('aria-busy', 'true');
    surface?.querySelectorAll('button[data-act]').forEach(b => { b.disabled = true; });
    const status = surface?.querySelector('.exr-notice');
    if (status) status.textContent = '正在保存入库选择…';
  };
  const saveCards = async (selections, label) => {
    if (!stillThisView() || updating || !selections.length) return;
    const scrollTop = surface?.querySelector('.exr-card-scroll')?.scrollTop || 0;
    setSaving();
    let saved;
    try { saved = await extractionCommands.updateCards(selections, viewRunId, viewSlot); }
    catch (error) { saved = { ok: false, message: error?.message || String(error) }; }
    if (!stillThisView()) return;
    if (!saved.ok) {
      UI.log(`[[icon:cross]] ${label}未保存：${saved.message || saved.code}，可重试`, 'warn');
      renderExtractStash('入库尚未保存，请重试；原选择仍保留。');
      return;
    }
    if (saved.count) {
      SDT.Sound.sfx('stashDeposit');
      UI.log(`[[icon:archive]] ${label}：<b>${saved.count}</b> 张已放入仓库（仓库余 ${B.stashRoom()} 格）`, 'loot');
    }
    extractLeft = saved.value.remainingCards.map(stack => ({ card: { ...stack.card }, count: stack.count }));
    renderExtractStash(saved.count ? `已入库 ${saved.count} 张，选择已保存。` : '仓库容量没有变化，请重新选择。');
    const scroller = UI.el?.ovBody?.querySelector('.exr-card-scroll');
    if (scroller) scroller.scrollTop = scrollTop;
  };
  UI.act('exStash', d => {
    if (!stillThisView() || updating) return;
    const s = extractLeft[Number(d.i)];
    const take = s ? Math.min(s.count, Math.max(0, B.stashRoom())) : 0;
    if (take) return saveCards([{ name: s.card.name, count: take }], `【${esc(s.card.name)}】入库`);
  });
  UI.act('exAll', () => {
    if (!stillThisView() || updating || totalLeft > B.stashRoom()) return;
    return saveCards(extractLeft.map(s => ({ name: s.card.name, count: s.count })), '全部入库');
  });
  // Same capacity and price ordering as before; visual rarity ordering never changes this selection.
  UI.act('exSmart', () => {
    if (!stillThisView() || updating) return;
    let left = B.stashRoom();
    const ordered = extractLeft.slice().sort((a, b) => SDT.Cards.sellPrice(b.card) - SDT.Cards.sellPrice(a.card));
    const selections = [];
    for (const s of ordered) {
      if (left <= 0) break;
      const take = Math.min(s.count, left);
      selections.push({ name: s.card.name, count: take });
      left -= take;
    }
    return saveCards(selections, '按估值入库');
  });
  const finish = async () => {
    if (!stillThisView() || updating) return;
    const pendingAtFinish = game.pendingExtraction;
    setSaving();
    let saved;
    try { saved = await extractionCommands.finish(viewRunId, viewSlot); }
    catch (error) { saved = { ok: false, message: error?.message || String(error) }; }
    if (!stillThisView(true)) return;
    if (!saved.ok) {
      UI.log(`[[icon:cross]] 整理完成未保存：${saved.message || saved.code}，可重试`, 'warn');
      renderExtractStash('完成整理尚未保存，请重试；已入库的卡牌仍保留。');
      return;
    }
    const finalReceipt = saved.receipt || saved.value?.output?.receipt ||
      buildExtractionReceipt({ game, pending: pendingAtFinish, isSha: B.isSha, xpMul: MODES[game.mode]?.xpMul || 1 });
    showExtractDone(finalReceipt);
  };
  UI.act('exFinish', () => {
    if (!stillThisView() || updating || finishSignature !== null) return;
    const remaining = game.pendingExtraction?.remainingCards || [];
    if (!remaining.length) return finish();
    extractLeft = remaining.map(s => ({ card: { ...s.card }, count: s.count }));
    renderExtractStash('', extractionFinishSignature());
  });
  UI.act('exCancelFinish', () => {
    if (!stillThisView() || updating || finishSignature === null) return;
    extractLeft = game.pendingExtraction.remainingCards.map(s => ({ card: { ...s.card }, count: s.count }));
    renderExtractStash();
  });
  UI.act('exConfirmFinish', () => {
    if (!stillThisView() || updating || finishSignature === null) return;
    if (finishSignature !== extractionFinishSignature()) {
      extractLeft = game.pendingExtraction.remainingCards.map(s => ({ card: { ...s.card }, count: s.count }));
      renderExtractStash('待入库卡牌已变化，请重新确认。');
      return;
    }
    return finish();
  });
}

// 整理完成 → 撤离结算 → 返回基地
// 2026-10-03 老板（SYS-02）：clear 突出「击破首脑+本局关键收获」短收束，extract 突出「安全撤离」；
// 主体文案随结局区分，数字（行动/用时/净带回/散失/首探经验）一律读回执字段。
function showExtractDone(receipt) {
  const B = SDT.Base;
  const r = receipt && typeof receipt === 'object' ? receipt : {};
  const net = r.netTake || {};
  game.extractionPending = false;
  extractLeft = null;
  // 跑局记录改读同一回执：结局/层/行动/时长以回执为准（SYS-02 唯一事实源）
  SDT.Agent?.recorder?.recordRun(r.outcome || (game.bossKilled ? 'clear' : 'extract'),
    { receipt, savedCards: Array.isArray(r.savedCards) ? r.savedCards : [] });
  const wasClear = r.outcome === 'clear';
  UI.log(`<b>[[icon:exit]] ${wasClear ? '首脑突破，撤离成功！' : '撤离成功！'}</b>共 ${r.actions ?? 0} 次行动；` +
    `运回基地：木材×${net.wood ?? 0}、口粮×${net.rations ?? 0}，本局入库 ${net.cardsStashed ?? 0} 张（仓库现有 ${B.stashUsed()}/${B.stashCap()} 张）`, 'ok');
  SDT.Sound.music('success');
  UI.showOverlay('', extractionDoneHTML({
    receipt: r, stashUsed: B.stashUsed(), stashCap: B.stashCap(),
    collectionCount: Object.keys(B.data.collection).length, baseCoins: B.data.coins,
    hp: game.hp, maxHp: game.maxHp, cardHTML: (card, size) => SDT.Cards.cardHTML(card, size),
    rarityOf: card => SDT.Cards.rarityOf?.(card) || card.rarity,
  }), 'page');
  const doneSurface = UI.el?.ovBody?.querySelector('#exDone');
  UI.act('exDoneInspect', d => {
    if (UI.el?.overlay?.hidden || (doneSurface && UI.el?.ovBody?.querySelector('#exDone') !== doneSurface)) return;
    const card = r.savedCards?.[Number(d.i)]?.card;
    if (card) UI.showCardZoom?.(card, { hideNote: true, presentation: 'expedition' });
  });
  UI.act('goBase', () => openBaseHub('deploy'));
  UI.refresh(game);
}
