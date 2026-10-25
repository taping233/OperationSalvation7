import { overlayElements, eventCardMocks, bindEventRoot, eventMapMocks, eventMapActions, eventUiMocks, eventCapacityPorts } from './helpers/environment-fixtures.js';
import { flushEventActions } from './helpers/event-dice-async.js';
import { rollEventDice } from './helpers/event-dice-async.js';
import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], saveFailure:null, uid: 0, slot: null, narrative: async () => null, random: () => 0.9 }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  ...eventMapMocks(H), newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => {
    if (H.saveFailure === 'throw') throw new Error('isolated resource save failure');
    if (H.saveFailure === 'false') return false;
    H.saves.push(JSON.parse(JSON.stringify(H.game))); return true;
  },
  scaledEnemy: a => a, getActiveSlot: () => H.slot, ...eventMapActions(H),
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let flow, altar, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { ...eventCardMocks(H) };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, ...eventUiMocks(() => UI),
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  altar = await import('../game/src/run/game.run.altar.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { ...overlayElements() };
  bindEventRoot(() => UI); setBagReturnHook(null);
  bagSlots.organizeReward = options => openRewardCapacityOrganizer({ ...options, UI,
    ...eventCapacityPorts(H, options),
  });
  bagSlots.showBackpack = () => UI.showOverlay('背包', '<main>背包</main>', 'page');
  H.saves = []; H.saveFailure = null; H.uid = 0; H.slot = null; H.random = () => 0.9; H.narrative = async () => null;
  Object.assign(H.game, { seed: 7, state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 18, fragments: 0,
    altarActivated:false, altarRewardPending:false, altarItemSacrificed:false, nodeRewards:{}, entrySupply:null,
    discoveredPairs: new Set(), layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'event' } }] }],
    canReceiveCard: () => true, heal: n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
    grantCard: (card, opts) => scenes.grantEventCard(card, opts), bagCap:() => 9, usedSlots:() => H.game.ownedCards.length,
  });
});
afterEach(() => { UI.hideOverlay({ immediate: true }); vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

async function openEvent(id, rewards = []) {
  H.cards = [{ id, name: '生命周期事件', type: '事件' }, ...rewards];
  const opening = flow.runEventDeck(); await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
}
async function returnFromBag() { UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) await hook(); else H.game.state = 'idle'; await flushEventActions(); }
const potionCards = [1, 2, 3].map(i => ({ id: `p${i}`, name: `药水${i}`, type: '道具', rarity: '古朴' }));

describe('物资格保存失败回执与记录身份', () => {
  const openResourceCheckpoint = async () => {
    H.random = () => 0;
    H.cards = [1,2].map(i => ({ id:`resource-checkpoint-${i}`, name:`检查点物资${i}`, type:'资源', rarity:'古朴' }));
    H.game.layerData[0].logical[1].def.type = 'resource';
    await flow.reenterCell(); await flushEventActions();
  };
  it.each(['false','throw'])('保存%s时已领取不重发，退出保留页面，恢复后原位保存再离开', async failure => {
    H.saveFailure = failure; await openResourceCheckpoint();
    const take = UI._acts.resTake;
    let taking; expect(() => { taking = take({i:'0'}); }).not.toThrow();
    await taking; await flushEventActions();
    expect(H.game.ownedCards).toHaveLength(1); expect(H.game.nodeRewards['0,1'].taken).toBe(0);
    expect(UI.el.ovBody.textContent).toContain('尚未保存成功');
    expect(await UI._acts.resSkip()).toBe(false); await flushEventActions(); expect(H.game.state).toBe('modal');
    expect(UI.el.overlay.hidden).toBe(false);
    H.saveFailure = null; await UI._acts.resRetrySave(); await flushEventActions();
    expect(H.saves.at(-1).nodeRewards['0,1'].taken).toBe(0);
    expect(H.saves.at(-1).ownedCards).toHaveLength(1);
    expect(await UI._acts.resSkip()).toBe(true); await flushEventActions(); expect(H.game.state).toBe('idle');
    await take({i:'0'}); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(1);
  });
  it('同坐标资源记录替换后，旧页回调不能领取替换记录的候选', async () => {
    await openResourceCheckpoint(); const take = UI._acts.resTake;
    H.game.nodeRewards['0,1'] = { ...H.game.nodeRewards['0,1'] };
    await take({i:'0'}); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.nodeRewards['0,1'].taken).toBeNull();
  });
});

it('动力锤委托与领锤互斥，委托随已消费节点保存且旧按钮不重复接受', async () => {
  const hammer={id:'cmtn0xt0zr7',name:'闪金之锤',type:'装备',rarity:'传说'};
  await openEvent('tt6-goldhammer',[hammer]);
  const choose=UI._acts.evtChoice;choose({i:'1'});choose({i:'0'});choose({i:'1'});
  expect(H.game.nodeRewards['0,1'].commission).toEqual({status:'pending'});
  expect(H.game.ownedCards).toHaveLength(0);
  expect(H.game.visited['0,1']).toBe(1);
  expect(H.saves.at(-1).nodeRewards['0,1'].commission).toEqual({status:'pending'});
});

it('救护站随机招式不同时治疗；投骰后固定待领奖，重复确认不重复发牌', async () => {
  const moves=[{id:'move',name:'防身术',type:'武术',rarity:'古朴'}];
  await openEvent('tt6-relief',moves);await UI._acts.evtChoice({i:'1'}); await flushEventActions();
  expect(H.game.hp).toBe(1);expect(H.game.ownedCards).toHaveLength(0);
  await rollEventDice(UI);
  expect(window.SDT.Chests.serialize(H.game).current.cards.map(c=>c.id)).toEqual(['move']);
  await UI._acts.chestTake();await flushEventActions();await UI._acts.chestTake(); await flushEventActions();
  expect(H.game.hp).toBe(1);expect(H.game.ownedCards.map(o=>o.card.id)).toEqual(['move']);
});

describe('事件等待与回调生命周期审计', () => {
  it.each(['new-run', 'new-page'])('叙事等待期间 %s 后旧结果不覆盖当前页面', async change => {
    let resolveNarrative;
    H.narrative = () => new Promise(resolve => resolveNarrative = resolve);
    H.cards = [{ id: 'tt6-mystery', name: '旧事件', type: '事件' }];
    const pending = flow.runEventDeck(); await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(resolveNarrative).toBeTypeOf('function');
    if (change === 'new-run') { H.game.discoveredPairs = new Set(); H.game.layerData = [...H.game.layerData]; }
    UI.showOverlay('当前页面', '<main id="new-page">当前内容</main>', 'page');
    resolveNarrative(null);
    await pending;
    expect(document.getElementById('new-page')?.textContent).toBe('当前内容');
    expect(UI._acts.evtChoice).toBeUndefined();
  });
  it.each(['new-run', 'new-page', 'reenter'])('已渲染事件 %s 后旧选择不能消费节点或奖励', async change => {
    await openEvent('tt6-mystery');
    const oldChoice = UI._acts.evtChoice;
    if (change === 'new-run') H.game.discoveredPairs = new Set();
    if (change === 'new-page') UI.showOverlay('其他页面', '<main>其他内容</main>', 'page');
    if (change === 'reenter') await openEvent('tt6-mystery');
    oldChoice({ i: '0' });
    expect(H.game.coins).toBe(18);
    expect(H.game.fragments || 0).toBe(0);
    expect(H.game.visited).toEqual({});
    if (change === 'reenter') { await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI); expect(H.game.coins).toBe(21); }
  });
  it('背包返回恢复一级事件，当前选择执行一次', async () => {
    await openEvent('tt6-mystery');
    const old = UI._acts.evtChoice;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
    old({ i: '0' });
    expect(H.game.coins).toBe(18);
    const current = UI._acts.evtChoice; current({ i: '0' }); await rollEventDice(UI); current({ i: '0' });
    expect(H.game.coins).toBe(21); expect(H.game.fragments).toBe(0);
  });
  it.each(['new-run', 'new-page', 'bag-return'])('二级药摊 %s 后旧选卡回调不能领卡', async change => {
    await openEvent('ev19-potions', potionCards); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
    const old = UI._acts.eventCardPick;
    if (change === 'new-run') H.game.discoveredPairs = new Set();
    UI.showOverlay('其他页面', '<main>其他内容</main>', 'page');
    if (change === 'bag-return') await returnFromBag();
    old({ i: '0' });
    expect(H.game.ownedCards).toHaveLength(0);
    if (change === 'bag-return') { await UI._acts.eventCardPick({ i: '0' }); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(1); }
  });
  it('重编背包返回保留已选卡，旧启动回调不再二次转换', async () => {
    const moves = [1, 2, 3, 4].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
    H.game.ownedCards = moves.slice(0, 2).map((card, i) => ({ uid: `owned${i}`, card }));
    await openEvent('ev19-recode', moves); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
    await UI._acts.eventRecodePick({ i: '0' }); await flushEventActions(); await UI._acts.eventRecodePick({ i: '1' }); await flushEventActions();
    const oldGo = UI._acts.eventRecodeGo;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
    expect(UI.el.ovBody.querySelectorAll('.picked')).toHaveLength(2);
    oldGo(); expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['m1', 'm2']);
    const currentGo = UI._acts.eventRecodeGo; currentGo(); await rollEventDice(UI);
    const after = H.game.ownedCards.map(o => o.card.id); currentGo();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(after);
  });
  it('黑市背包返回保留四次失败后的保底次数，旧回调不扣币', async () => {
    const rewards = [{ id: 'e1', name: '装备', type: '装备', rarity: '古朴' }, ...[1, 2].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }))];
    await openEvent('ev19-gamble', rewards); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
    H.random = () => 0.1;
    for (let i = 0; i < 4; i++) { await UI._acts.eventGambleTry(); await flushEventActions(); await rollEventDice(UI); }
    expect(H.game.coins).toBe(6);
    const oldTry = UI._acts.eventGambleTry;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
    expect(UI.el.ovBody.textContent).toContain('已尝试 4/5');
    await oldTry(); await flushEventActions(); expect(H.game.coins).toBe(6);
    await UI._acts.eventGambleTry(); await flushEventActions(); await rollEventDice(UI); expect(H.game.coins).toBe(3); expect(H.game.ownedCards).toHaveLength(0);
    expect(window.SDT.Chests.serialize(H.game).current.cards).toHaveLength(3);
    await UI._acts.chestTake(); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(3);
  });
  it('合法的迟到叙事仍可显示，多选事件由真实点击确认后结算一次', async () => {
    let resolveNarrative;
    H.narrative = () => new Promise(resolve => resolveNarrative = resolve);
    H.cards = [{ id: 'tt6-airdrop', name: '补给', type: '事件' }];
    const pending = flow.runEventDeck(); await vi.dynamicImportSettled(); await vi.advanceTimersByTimeAsync(1500);
    resolveNarrative(null); await pending;
    UI.el.ovBody.querySelector('[data-act="evtChoice"][data-i="2"]').click(); await flushEventActions();
    expect(H.game.hp).toBe(1);
    UI.el.ovBody.querySelector('.event-choice-clear').click(); await flushEventActions();
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(true);
    UI.el.ovBody.querySelector('[data-act="evtChoice"][data-i="2"]').click(); await flushEventActions();
    const confirm = UI.el.ovBody.querySelector('.event-choice-confirm'); confirm.click(); await flushEventActions(); confirm.click(); await flushEventActions();
    expect(H.game.hp).toBe(7); expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({ '0,1': 1 });
  });
  it('自定义单项事件正常领取后回待机，旧回调不能消费下一节点', async () => {
    await openEvent('custom-event'); const complete = UI._acts.evtNext; await complete(); await flushEventActions();
    expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({ '0,1': 1 });
    H.game.trackPos = 2; H.game.state = 'modal'; await complete(); await flushEventActions();
    expect(H.game.visited).toEqual({ '0,1': 1 });
  });
  it.each(['ev19-recode', 'ev19-gamble'])('%s 中途放弃后旧恢复hook与动作不能复活奖励', async id => {
    const rewards = [{ id: 'e1', name: '装备', type: '装备', rarity: '古朴' }, ...[1, 2, 3].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }))];
    H.game.ownedCards = rewards.slice(1, 3).map((card, i) => ({ uid: `u${i}`, card }));
    await openEvent(id, rewards); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
    const restore = takeBagReturnHook();
    const leave = UI._acts[id === 'ev19-recode' ? 'eventRecodeLeave' : 'eventGambleLeave'];
    const oldAction = UI._acts[id === 'ev19-recode' ? 'eventRecodePick' : 'eventGambleTry'];
    await leave(); await flushEventActions(); const coins = H.game.coins; const owned = H.game.ownedCards.map(o => o.card.id);
    await restore(); await flushEventActions(); await oldAction({ i: '0' }); await flushEventActions();
    expect(H.game.state).toBe('idle'); expect(H.game.coins).toBe(coins); expect(H.game.ownedCards.map(o => o.card.id)).toEqual(owned);
    expect(UI.el.overlay.hidden).toBe(true); expect(takeBagReturnHook()).toBeNull();
  });
  it('二级奖励旧恢复hook在同槽新局不会覆盖新页', async () => {
    await openEvent('ev19-potions', potionCards); await UI._acts.evtChoice({ i: '0' }); await flushEventActions(); await rollEventDice(UI);
    const restore = takeBagReturnHook(); H.game.discoveredPairs = new Set();
    UI.showOverlay('新局页面', '<main id="new-run-page">新局</main>', 'page'); await restore(); await flushEventActions();
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局');
  });
  it('祭坛正常弃三张后，首份激活保存即保留待领标记；奖励页刷新可再进', async () => {
    H.game.ownedCards = [1, 2, 3].map(i => ({ uid: `a${i}`, card: { id: `c${i}`, name: `供品${i}`, type: '武术' } }));
    await altar.openAltarRitual(); await flushEventActions(); await UI._acts.altarOn3(); await flushEventActions();
    for (const uid of ['a1', 'a2', 'a3']) await UI._acts.sacPick({ uid }); await flushEventActions();
    await UI._acts.sacConfirm(); await flushEventActions();
    expect(H.saves.find(s => s.altarActivated)).toMatchObject({ altarActivated: true, altarRewardPending: true });
    Object.assign(H.game, H.saves.at(-1)); await altar.openAltarRitual(); await flushEventActions();
    expect(UI.el.ovBody.querySelector('[data-act="altarRewardLoot"]')).not.toBeNull();
  });
  it('祭坛回赠离开后可重进领取一次，旧领取回调不再发奖', async () => {
    H.cards = [{ id: 'legend', name: '传说', rarity: '传说', type: '法术' }, { id: 'equip', name: '装备', rarity: '古朴', type: '装备' }];
    H.game.altarActivated = true; H.game.altarRewardPending = true;
    await altar.openAltarRitual(); await flushEventActions(); const old = UI._acts.altarRewardLoot; await UI._acts.altarRewardLeave(); await flushEventActions();
    await altar.openAltarRitual(); await flushEventActions(); old(); expect(H.game.ownedCards).toHaveLength(0);
    const current = UI._acts.altarRewardLoot; current(); current();
    expect(H.game.ownedCards).toHaveLength(0);
    const take = UI._acts.chestTake; await take(); await flushEventActions(); await take(); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(2);
    expect(H.game.altarRewardPending).toBe(false); expect(H.saves.at(-1).altarRewardPending).toBe(false);
  });
  it('献祭取消后的旧确认不能激活或扣牌，不足数量的确认也不能通过', async () => {
    H.game.ownedCards = [1, 2, 3].map(i => ({ uid: `a${i}`, card: { id: `c${i}`, name: `供品${i}`, type: '武术' } }));
    await altar.openAltarRitual(); await flushEventActions(); await UI._acts.altarOn3(); await flushEventActions(); const old = UI._acts.sacConfirm;
    await UI._acts.sacConfirm(); await flushEventActions(); expect(H.game.ownedCards).toHaveLength(3); expect(H.game.altarActivated).toBe(false);
    await UI._acts.sacCancel(); await flushEventActions(); old(); expect(H.game.ownedCards).toHaveLength(3); expect(H.game.altarActivated).toBe(false);
  });
  it('祭坛碎片兑换同槽新局后的旧回调不能扣碎片或发旧奖励', async () => {
    H.cards = [{ id: 'hero', name: '能力卡', rarity: '职业', type: '能力卡' }]; H.game.fragments = 2;
    await altar.openAltarRitual(); await flushEventActions(); const old = UI._acts.altarFragHero; H.game.discoveredPairs = new Set(); old();
    expect(H.game.fragments).toBe(2); expect(H.game.ownedCards).toHaveLength(0); expect(H.game.altarActivated).toBe(false);
  });
  it('复原背包返回共用剩余次数与完成状态，旧回调不能额外恢复', async () => {
    H.game.usedPocket = [{ card: { id: 'restore', name: '复原样本', type: '武术' }, count: 3 }];
    const done = vi.fn(); scenes.openPocketRestore(1, done); const old = UI._acts.restoreOne;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
    old({ name: '复原样本' }); expect(H.game.ownedCards).toHaveLength(0);
    const current = UI._acts.restoreOne; current({ name: '复原样本' }); old({ name: '复原样本' }); current({ name: '复原样本' });
    expect(H.game.ownedCards).toHaveLength(1); expect(H.game.usedPocket[0].count).toBe(2); expect(done).toHaveBeenCalledTimes(1);
  });
  it('F02 满包动力锤保留固定奖励，重载后可整理重试且不重复发卡', async () => {
    const hammer = { id:'cmtn0xt0zr7', name:'闪金之锤', rarity:'传说', type:'装备' };
    H.game.canReceiveCard = () => false;
    await openEvent('tt6-goldhammer', [hammer]);
    await UI._acts.evtChoice({ i:'0' }); await flushEventActions(); await rollEventDice(UI);
    const saved = window.SDT.Chests.serialize(H.game);
    expect(saved.current.cards.map(c => c.id)).toEqual([hammer.id]);
    await UI._acts.chestTake1({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards).toHaveLength(0);
    expect(window.SDT.Chests.serialize(H.game).current.taken).toEqual([]);
    H.game.canReceiveCard = () => true;
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(saved)));
    const take = UI._acts.chestTake1; await take({ i:'0' }); await flushEventActions(); await take({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual([hammer.id]);
    expect(UI.el.ovBody.querySelectorAll('.reward-unit.got')).toHaveLength(1);
    await UI._acts.chestContinue(); await flushEventActions();
    await vi.advanceTimersByTimeAsync(400);
    expect(H.game.state).toBe('idle');
    expect(UI.el.overlay.hidden).toBe(true);
  });
  it.each([false, true])('F40 配送无人机满包木材不发碎片，货币选项互斥幂等（满包=%s）', async full => {
    H.game.canReceiveCard = () => !full;
    await openEvent('tt6-systemsupply', [{ id:'tt-wood', name:'木材', type:'资源', rarity:'古朴' }]);
    const choose = UI._acts.evtChoice;
    choose({ i:'0' });
    if (full) {
      expect(H.game.fragments).toBe(0);
      expect(H.game.visited).toEqual({});
      expect(UI.el.ovBody.textContent).toContain('待领取：木材');
      UI.el.ovBody.querySelector('[data-organize=return]').click(); await flushEventActions();
      expect(H.game.ownedCards).toHaveLength(0);
      const retry=UI._acts.evtChoice; retry({ i:'1' }); retry({ i:'1' }); choose({ i:'0' });
      expect(H.game.coins).toBe(20);
    } else {
      choose({ i:'0' }); choose({ i:'1' });
      expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['tt-wood']);
      expect(H.game.coins).toBe(18);
    }
    expect(H.game.fragments).toBe(1);
    expect(H.game.visited).toEqual({ '0,1':1 });
    expect(H.saves.at(-1)).toMatchObject({ fragments:1, coins:full ? 20 : 18 });
  });
  it('无人机原地腾位后领取木材与碎片一次，旧整理按钮不能重复', async () => {
    const wood={id:'tt-wood',name:'木材',type:'资源',rarity:'古朴'};
    H.game.ownedCards=[{uid:'old',card:{id:'old',name:'旧物资',type:'资源'}}];
    H.game.canReceiveCard=()=>H.game.ownedCards.filter(o=>!o.safe).length<1;
    await openEvent('tt6-systemsupply',[wood]);
    UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="0"]').click(); await flushEventActions();
    UI.el.ovBody.querySelector('.event-choice-confirm').click(); await flushEventActions();
    expect(H.game.fragments).toBe(0); expect(H.game.visited).toEqual({});
    UI.el.ovBody.querySelector('[data-organize=safe]').click(); await flushEventActions();
    const claim=UI.el.ovBody.querySelector('[data-organize=claim]'); claim.click(); await flushEventActions(); claim.click(); await flushEventActions();
    expect(H.game.ownedCards.map(o=>o.card.id)).toEqual(['old','tt-wood']);
    expect(H.game.fragments).toBe(1); expect(H.game.coins).toBe(18);
    expect(H.game.visited).toEqual({'0,1':1});
  });
  it('无人机完整背包往返恢复已选木材，旧页和旧整理回调无效', async () => {
    H.game.canReceiveCard=()=>false;
    await openEvent('tt6-systemsupply',[{id:'tt-wood',name:'木材',type:'资源'}]);
    const old=UI._acts.evtChoice; old({i:'0'});
    const stale=UI.el.ovBody.querySelector('[data-organize=return]');
    UI.el.ovBody.querySelector('[data-organize=bag]').click(); await flushEventActions(); await returnFromBag();
    expect(UI.el.ovBody.querySelector('[data-i="0"]').getAttribute('aria-pressed')).toBe('true');
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(false);
    const root=UI.el.ovBody.firstElementChild; stale.click(); await flushEventActions(); old({i:'1'});
    expect(UI.el.ovBody.firstElementChild).toBe(root); expect(H.game.fragments).toBe(0);
    H.game.canReceiveCard=()=>true;
    UI.el.ovBody.querySelector('.event-choice-confirm').click(); await flushEventActions();
    expect(H.game.fragments).toBe(1); expect(H.game.ownedCards).toHaveLength(1);
  });
  it('无人机实际领取拒绝不发碎片不消费节点，保选择且可改选货币', async () => {
    let checks=0; H.game.canReceiveCard=()=>++checks<3;
    await openEvent('tt6-systemsupply',[{id:'tt-wood',name:'木材',type:'资源'}]);
    await UI._acts.evtChoice({i:'0'}); await flushEventActions(); await rollEventDice(UI); await rollEventDice(UI);
    expect(H.game.fragments).toBe(0); expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.visited).toEqual({});
    expect(UI.el.ovBody.textContent).toContain('奖励与选择已保留');
    expect(UI.el.ovBody.querySelector('[data-i="0"]').getAttribute('aria-pressed')).toBe('true');
    await UI._acts.evtChoice({i:'1'}); await flushEventActions();
    expect(H.game.fragments).toBe(1); expect(H.game.coins).toBe(20);
  });
  it('无人机返回后改选货币或取消选择，普通背包往返保最新阅读状态', async () => {
    H.game.canReceiveCard=()=>false;
    await openEvent('tt6-systemsupply',[{id:'tt-wood',name:'木材',type:'资源'}]);
    await UI._acts.evtChoice({i:'0'}); await flushEventActions(); await rollEventDice(UI); await rollEventDice(UI); UI.el.ovBody.querySelector('[data-organize=return]').click(); await flushEventActions();
    UI.el.ovBody.querySelector('[data-i="1"]').click(); await flushEventActions(); await UI._acts.evtBag(); await flushEventActions(); await returnFromBag();
    expect(UI.el.ovBody.querySelector('[data-i="1"]').getAttribute('aria-pressed')).toBe('true');
    UI.el.ovBody.querySelector('.event-choice-clear').click(); await flushEventActions(); await UI._acts.evtBag(); await flushEventActions(); await returnFromBag();
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(true);
    expect(H.game.fragments).toBe(0); expect(H.game.visited).toEqual({});
  });
  it('无人机新局后旧整理页不能领取木材与碎片', async () => {
    H.game.canReceiveCard=()=>false;
    await openEvent('tt6-systemsupply',[{id:'tt-wood',name:'木材',type:'资源'}]);
    await UI._acts.evtChoice({i:'0'}); await flushEventActions(); await rollEventDice(UI); await rollEventDice(UI);
    const back=UI.el.ovBody.querySelector('[data-organize=return]');
    H.game.discoveredPairs=new Set(); H.game.canReceiveCard=()=>true;
    back.click(); await flushEventActions();
    expect(H.game.fragments).toBe(0); expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.visited).toEqual({});
  });
  it('F01 祭坛固定候选刷新不重掷，已领卡刷新后不重复发奖', async () => {
    H.cards = [{ id:'legend', name:'传说', rarity:'传说', type:'法术' }, { id:'equip', name:'装备', rarity:'古朴', type:'装备' }];
    H.game.altarActivated = true; H.game.altarRewardPending = true;
    await altar.openAltarRitual(); await flushEventActions(); await UI._acts.altarRewardLoot(); await flushEventActions();
    const saved = window.SDT.Chests.serialize(H.game);
    expect(saved.current.source).toContain('祭坛');
    H.random = () => 0.2;
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(saved)));
    expect(window.SDT.Chests.serialize(H.game).current.cards).toEqual(saved.current.cards);
    await UI._acts.chestTake1({ i:'0' }); await flushEventActions();
    const after = window.SDT.Chests.serialize(H.game);
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(after)));
    await UI._acts.chestTake1({ i:'0' }); await flushEventActions(); await UI._acts.chestTake1({ i:'1' }); await flushEventActions();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['legend', 'equip']);
    await UI._acts.chestContinue(); await flushEventActions();
    expect(H.game.state).toBe('idle');
    H.random = () => 0.9;
  });
  it.each([
    ['normal', 0.59, 0.99, '古朴', 11],
    ['normal', 0.61, 0.01, '稀有', 0],
    ['normal', 0.61, 0.49, '稀有', 1],
    ['normal', 0.61, 0.99, '稀有', 3],
    ['normal', 0.89, 0.99, '史诗', 1],
    ['normal', 0.98, 0.01, '传说', 0],
    ['elite', 0.58, 0.01, '稀有', 0],
  ])('物资格 %s：档位骰 %s、档内骰 %s 抽到 %s 第 %s 张，重进不重抽', async (mode, rarityRoll, cardRoll, rarity, index) => {
    const oldWeights = window.SDT.Cards.DROP_WEIGHTS, oldMode = H.game.mode;
    const byRarity = Object.fromEntries([['古朴', 12], ['稀有', 4], ['史诗', 2], ['传说', 2]].map(([tier, count]) =>
      [tier, Array.from({ length:count }, (_, i) => ({ id:`${tier}-${i}`, name:`${tier}资源${i}`, type:'资源', rarity:tier }))]));
    try {
      window.SDT.Cards.DROP_WEIGHTS = { 古朴:60, 稀有:28, 史诗:9, 传说:3 };
      H.game.mode = mode; H.cards = Object.values(byRarity).flat();
      H.game.layerData[0].logical[1].def.type = 'resource';
      H.random = vi.fn().mockReturnValueOnce(rarityRoll).mockReturnValueOnce(cardRoll).mockReturnValue(0.1);
      await flow.reenterCell(); await flushEventActions();
      const record = H.game.nodeRewards['0,1'];
      expect(record.cardIds[0]).toBe(byRarity[rarity][index].id);
      expect(new Set(record.cardIds).size).toBe(2);
      expect(H.random).toHaveBeenCalledTimes(4);
      const cardIds = [...record.cardIds];
      await UI._acts.resSkip(); await flushEventActions(); await flow.reenterCell(); await flushEventActions();
      expect(H.game.nodeRewards['0,1'].cardIds).toEqual(cardIds);
      expect(H.random).toHaveBeenCalledTimes(4);
    } finally {
      window.SDT.Cards.DROP_WEIGHTS = oldWeights; H.game.mode = oldMode; H.random = () => 0.9;
    }
  });
  it('物资格空档位不参与抽取，同名资源版本仍只出现一次', async () => {
    const oldWeights = window.SDT.Cards.DROP_WEIGHTS;
    try {
      window.SDT.Cards.DROP_WEIGHTS = { 古朴:60, 稀有:28, 史诗:9, 传说:3 };
      H.cards = [
        { id:'legend-a', name:'传说资源甲', type:'资源', rarity:'传说' },
        { id:'legend-a-v2', name:'传说资源甲', type:'资源', rarity:'传说' },
        { id:'legend-b', name:'传说资源乙', type:'资源', rarity:'传说' },
      ];
      H.random = () => 0.1; H.game.layerData[0].logical[1].def.type = 'resource';
      await flow.reenterCell(); await flushEventActions();
      expect(H.game.nodeRewards['0,1'].cardIds).toEqual(['legend-a', 'legend-b']);
    } finally { window.SDT.Cards.DROP_WEIGHTS = oldWeights; H.random = () => 0.9; }
  });
  it('F15/F41 物资格满包显示整理，领取成功留结果页再继续', async () => {
    H.cards = [{ id:'wood', name:'木材', type:'资源', rarity:'古朴' }, { id:'key', name:'钥匙', type:'资源', rarity:'古朴' }];
    H.game.layerData[0].logical[1].def.type = 'resource';
    H.game.canReceiveCard = () => false;
    await flow.reenterCell(); await flushEventActions();
    expect(UI.el.ovBody.textContent).toContain('当前放不下');
    expect(UI.el.ovBody.querySelector('.reward-head h3').textContent).toBe('选择一份物资');
    expect(UI.el.ovBody.querySelector('[data-act="resTake"]')).toBeNull();
    H.game.canReceiveCard = () => true;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); await returnFromBag();
    const take = UI._acts.resTake; await take({ i:'0' }); await flushEventActions(); await take({ i:'0' }); await flushEventActions();
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.game.state).toBe('modal');
    expect(UI.el.ovBody.textContent).toContain('物资已领取');
    expect(UI.el.ovBody.querySelector('[data-act="resTake"]')).toBeNull();
    await UI._acts.resSkip(); await flushEventActions();
    expect(H.game.state).toBe('idle');
  });
  it('资源稀有卡与火堆额外卡复用获得演出，重开不重播', async () => {
    const card = {id:'rare-wood',name:'稀有木材',type:'资源',rarity:'稀有'};
    H.cards = [card, {id:'wood',name:'木材',type:'资源',rarity:'古朴'}];
    H.game.layerData[0].logical[1].def.type = 'resource';
    await flow.reenterCell(); await flushEventActions(); await UI._acts.resTake({i:'0'}); await flushEventActions();
    expect(document.querySelector('.bt-card-reveal-caption').textContent).toContain('已入背包');
    await UI._acts.resSkip(); await flushEventActions(); await flow.reenterCell(); await flushEventActions();
    expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();
    H.game.nodeRewards = {}; H.game.visited = {};
    const original = window.SDT.Cards.randomClassCard;
    window.SDT.Cards.randomClassCard = () => card;
    try {
      await altar.openFireRest(); await flushEventActions(); await UI._acts.fireHeal(); await flushEventActions(); await UI._acts.fireRestore(); await flushEventActions();
      expect(document.querySelector('.bt-card-reveal-caption').textContent).toBe('稀有 · 已入背包');
      const count = H.game.ownedCards.length;
      vi.advanceTimersByTime(10000);
      await altar.openFireRest(); await flushEventActions();
      expect(document.querySelector('.bt-card-reveal')).toBeNull();
      expect(H.game.ownedCards).toHaveLength(count);
    } finally { window.SDT.Cards.randomClassCard = original; }
  });
  it('入城补给满包反馈不被特写遮住，整理返回不重放介绍页', async () => {
    H.cards = [{ id:'wood', name:'木材', type:'资源', rarity:'古朴' }];
    H.game.entrySupply = {version:1, layerIdx:0, trackPos:1, cardIds:['wood'], taken:[]};
    H.game.canReceiveCard = () => false;
    await altar.openEntrySupply(); await flushEventActions();
    const zoom = document.createElement('div'); zoom.id = 'cardZoom';
    zoom._closeCardZoom = vi.fn(() => zoom.remove()); document.body.append(zoom);
    await UI._acts.entrySupplyTake({i:'0'}); await flushEventActions();
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(UI.el.ovBody.textContent).toContain('仍保留在入口');
    for (let n=0;n<2;n++) {
      await UI._acts.entrySupplyBag(); await flushEventActions(); await returnFromBag();
      expect(UI.el.ovBody.querySelector('.entry-supply-strips')).not.toBeNull();
      expect(UI.el.ovBody.querySelector('[data-act="clsEntryReveal"]')).toBeNull();
      expect(H.game.entrySupply.taken).toEqual([]);
    }
  });
  it('物资格特写的整理按钮一次进入背包，返回仍是原候选', async () => {
    H.cards = [{ id:'wood', name:'木材', type:'资源', rarity:'古朴' }, { id:'key', name:'钥匙', type:'资源', rarity:'古朴' }];
    H.game.layerData[0].logical[1].def.type = 'resource';
    H.game.canReceiveCard = () => false;
    await flow.reenterCell(); await flushEventActions();
    const ids = [...H.game.nodeRewards['0,1'].cardIds];
    const zoom = document.createElement('div'); zoom.id = 'cardZoom';
    zoom._closeCardZoom = vi.fn(() => zoom.remove()); document.body.append(zoom);
    bagSlots.showBackpack = vi.fn(() => {
      expect(document.getElementById('cardZoom')).toBeNull();
      UI.showOverlay('背包', '<main>背包</main>', 'page');
    });
    await UI._acts.resBag(); await flushEventActions();
    expect(zoom._closeCardZoom).toHaveBeenCalledWith(true);
    expect(bagSlots.showBackpack).toHaveBeenCalledTimes(1);
    await returnFromBag();
    expect(H.game.nodeRewards['0,1'].cardIds).toEqual(ids);
    expect(H.game.ownedCards).toHaveLength(0);
    expect(UI.el.ovBody.querySelector('.resource-reward-scene')).not.toBeNull();
  });
  it('F35 闸门确认前可返回当前层，旧进入动作不会换层', async () => {
    await altar.openDoorModal({ pair:'p1', toLayer:1, arriveAt:0 }, {}); await flushEventActions();
    const enter = UI._acts.goDoor;
    expect(UI.el.ovBody.textContent).toContain('确认前可返回当前层检查遗漏');
    expect(UI.el.ovBody.querySelector('[data-act="doorBag"]')).not.toBeNull();
    await UI._acts.doorBack(); await flushEventActions(); enter();
    expect(H.game.layerIdx).toBe(0);
    expect(H.game.state).toBe('idle');
    expect(takeBagReturnHook()).toBeNull();
  });
  it('F06 三选一明确永久放弃，其余候选刷新后仍不可领取', async () => {
    H.cards = [1, 2, 3].map(i => ({ id:`pick${i}`, name:`候选${i}`, type:'法术', rarity:'古朴' }));
    window.SDT.MAP.chestKinds.medium = { name:'中型宝箱', pickFrom:3 };
    await scenes.openFixedRewardsOnCell(H.cards, '测试三选一'); await flushEventActions();
    const saved = window.SDT.Chests.serialize(H.game);
    saved.queue[0].kind = saved.current.kind = 'medium';
    saved.current.claimMode = 'one'; saved.current.choiceCount = 3;
    saved.queue[0].reward = saved.current;
    expect(scenes.resumeChestsOnCell(saved)).toBe(true);
    expect(UI.el.ovBody.querySelector('.reward-head').getAttribute('aria-description')).toContain('其余候选将放弃');
    await UI._acts.chestPick({ i:'1' }); await flushEventActions();
    const after = window.SDT.Chests.serialize(H.game);
    expect(after.current.taken).toEqual([1]);
    expect(after.current.lost).toEqual([0, 2]);
    scenes.resumeChestsOnCell(after);
    expect(UI.el.ovBody.querySelectorAll('.reward-unit.dropped')).toHaveLength(2);
    expect(UI.el.ovBody.querySelectorAll('.reward-unit.got')).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('[data-act="chestPick"]')).toBeNull();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['pick2']);
  });
  it('F42 奖励提示精简后，点击与自动收起均有效', async () => {
    const { cinematicsMethods } = await import('../game/src/ui/cinematics.js');
    const cinema = { ...cinematicsMethods, _cardGetQueue:[], _cardGetShowing:false };
    const card = { id:'reward', name:'奖励', type:'法术', rarity:'古朴' };
    cinema.showCardReward(card);
    expect(document.querySelector('#cardGet .lg-hint').textContent).toBe('收起');
    document.getElementById('cardGet').click(); await flushEventActions();
    await vi.advanceTimersByTimeAsync(500);
    expect(document.getElementById('cardGet')).toBeNull();
    cinema.showLegendGet({ ...card, rarity:'传说' });
    expect(document.querySelector('#legendGet .lg-hint').textContent).toBe('收起');
    await vi.advanceTimersByTimeAsync(3300);
    expect(document.getElementById('legendGet')).toBeNull();
  });
  it('B01 首脑战先展示现行牌库与抽牌规则，返回保留挑战', async () => {
    H.game.altarActivated = true;
    await altar.openBossGate(); await flushEventActions();
    expect(UI.el.ovBody.textContent).toContain('选择 15 张招式、装备或能力卡，不足时全部编入');
    expect(UI.el.ovBody.textContent).toContain('5 张初始攻击');
    expect(UI.el.ovBody.textContent).toContain('起手抽 5 张，每回合抽 1 张，手牌上限 8 张');
    await UI._acts.bossGateBack(); await flushEventActions();
    expect(H.game.state).toBe('idle');
    expect(H.game.visited).toEqual({});
  });
  it('复原离页/同槽新局后的动作与恢复hook不能操作新局', async () => {
    H.game.usedPocket = [{ card: { id: 'restore', name: '复原样本', type: '武术' }, count: 3 }];
    scenes.openPocketRestore(1, vi.fn()); const old = UI._acts.restoreOne; const restore = takeBagReturnHook();
    H.game.discoveredPairs = new Set(); UI.showOverlay('新局', '<main id="new-run-page">新局</main>', 'page');
    await restore(); await flushEventActions(); old({ name: '复原样本' }); expect(H.game.ownedCards).toHaveLength(0);
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局');
  });
});

describe('资源奖励公共领取体验', () => {
  async function openResource() {
    H.game.nodeChestRewards = {};
    H.cards = [{ id:'wood', name:'木材', type:'资源', rarity:'古朴' }, { id:'key', name:'钥匙', type:'资源', rarity:'古朴' }];
    H.game.layerData[0].logical[1].def.type = 'resource';
    await flow.reenterCell(); await flushEventActions();
  }
  it('成功领取保留卡面、滚动容器与位置，只发一份并把焦点交给继续探索', async () => {
    const show = vi.spyOn(UI, 'showOverlay');
    await openResource();
    const body = UI.el.ovBody, scene = body.querySelector('.resource-reward-scene');
    const cards = [...body.querySelectorAll('.reward-card')];
    const row = body.querySelector('.reward-objects'), stage = body.querySelector('.loot-scroll');
    row.scrollLeft = 72; stage.scrollTop = 44;
    body.querySelector('[data-act="resTake"]').focus();
    const take = UI._acts.resTake;
    await take({i:'0'}); await flushEventActions(); await take({i:'0'}); await flushEventActions(); await take({i:'1'}); await flushEventActions();
    expect(show).toHaveBeenCalledTimes(1);
    expect(body.querySelector('.resource-reward-scene')).toBe(scene);
    expect([...body.querySelectorAll('.reward-card')]).toEqual(cards);
    expect(body.querySelector('.reward-objects')).toBe(row); expect(row.scrollLeft).toBe(72);
    expect(body.querySelector('.loot-scroll')).toBe(stage); expect(stage.scrollTop).toBe(44);
    expect(body.querySelectorAll('.reward-unit.got')).toHaveLength(1);
    expect(body.querySelectorAll('.reward-unit.dropped')).toHaveLength(1);
    expect(document.activeElement.dataset.act).toBe('resSkip');
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.saves.at(-1).nodeRewards['0,1'].taken).toBe(0);
  });
  it('整理返回使用原候选，不重抽，旧页面回调不可在背包页领取', async () => {
    const random = H.random; H.random = vi.fn(() => 0.9);
    try {
      await openResource(); const record = H.game.nodeRewards['0,1'];
      const take = UI._acts.resTake;
      await UI._acts.resBag(); await flushEventActions(); await take({i:'0'}); await flushEventActions();
      expect(H.game.ownedCards).toHaveLength(0);
      await returnFromBag();
      expect(H.game.nodeRewards['0,1']).toBe(record);
      expect(H.random).toHaveBeenCalledTimes(4);
      expect([...UI.el.ovBody.querySelectorAll('[data-reward-card]')].map(e => e.dataset.rewardCard)).toEqual(record.cardIds);
      expect(document.querySelector('.bt-card-feedback-layer')).toBeNull();
    } finally { H.random = random; }
  });
  it('详情复用择一提示和动作映射，满包只整理，已领取不再提供领取按钮', async () => {
    UI.showCardZoom = vi.fn();
    await openResource(); await UI._acts.resRead({i:'0'}); await flushEventActions();
    const name = UI.showCardZoom.mock.lastCall[0].name;
    expect(UI.el.ovBody.querySelector('[data-act="resTake"][data-i="0"]').getAttribute('aria-label')).toBe(`选择：${name}`);
    const footer = document.createElement('div');
    footer.innerHTML = UI.showCardZoom.mock.lastCall[1].footer;
    expect(footer.querySelector('button').getAttribute('aria-label')).toBe(`选择：${name}`);
    let options = UI.showCardZoom.mock.lastCall[1];
    expect(options.footer).toContain('其余选项将放弃');
    expect(options.footer).toContain('data-act="resTake"');
    expect(options.from).toBe(UI.el.ovBody.querySelector('[data-act="resRead"]'));
    H.game.canReceiveCard = () => false; await UI._acts.resRead({i:'0'}); await flushEventActions();
    options = UI.showCardZoom.mock.lastCall[1];
    expect(options.footer).toContain('其余选项将放弃');
    expect(options.footer).toContain('data-act="resBag"');
    footer.innerHTML = options.footer;
    expect(footer.querySelector('button').getAttribute('aria-label')).toBe(`整理背包：${name}`);
    expect(options.footer).not.toContain('data-act="resTake"');
    H.game.canReceiveCard = () => true; await UI._acts.resTake({i:'0'}); await flushEventActions(); await UI._acts.resRead({i:'1'}); await flushEventActions();
    expect(UI.showCardZoom.mock.lastCall[1].footer).toBe('');
  });
  it('容量实际拒收不触发飞入，成功后才从稳定卡面飞到背包，重复点击不重播', async () => {
    vi.spyOn(window.SDT.Cards, 'cardHTML').mockImplementation(card => `<div class="hs-card">${card.name}</div>`);
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const left = this.matches?.('[data-card-receive-anchor]') ? 450 : 20;
      return { left, top:20, width:100, height:120, right:left + 100, bottom:140 };
    });
    // Keep the visual flight pending independently of the newly asynchronous save.
    const motion = await import('../game/src/ui/target-motion.js');
    vi.spyOn(motion, 'retargetVisual').mockImplementation(() => ({ finished:new Promise(() => {}), stop() {} }));
    await openResource(); H.game.canReceiveCard = () => false;
    await UI._acts.resTake({i:'0'}); await flushEventActions();
    expect(H.game.nodeRewards['0,1'].taken).toBeNull();
    expect(document.querySelector('.reward-acquisition-card,.bt-card-reveal')).toBeNull();
    H.game.canReceiveCard = () => true; await UI._acts.resTake({i:'0'}); await flushEventActions();
    expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('[data-card-receive-anchor="bag"]')).not.toBeNull();
    await UI._acts.resTake({i:'0'}); await flushEventActions();
    expect(document.querySelectorAll('.reward-acquisition-card')).toHaveLength(1);
    expect(H.game.ownedCards).toHaveLength(1);
  });
  it('减弱动效仍给出真实领取回执，不播放飞入', async () => {
    document.body.classList.add('reduce-motion');
    try {
      await openResource(); await UI._acts.resTake({i:'0'}); await flushEventActions();
      expect(document.querySelector('.reward-acquisition-card')).toBeNull();
      expect(UI.el.ovBody.querySelectorAll('.reward-unit.got')).toHaveLength(1);
      expect(document.querySelector('.bt-card-reveal-caption').textContent).toContain('已入背包');
      expect(H.game.ownedCards).toHaveLength(1);
    } finally { document.body.classList.remove('reduce-motion'); }
  });
});
