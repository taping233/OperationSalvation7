import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], uid: 0, slot: null, narrative: async () => null, random: () => 0.9 }));
vi.mock('../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal:10, fireClassCardChance:1, bossDeckSize:15, starterSha:5, battleStartDraw:5, battleTurnDraw:1, battleHandMax:8 }, monsters:{}, altar:{ bosses:[] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => H.slot, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let flow, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { game: H.game, Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' } } },
    Cards: { DROP_WEIGHTS:{ 古朴:1 }, all: () => H.cards, classPool: () => H.cards.filter(c => c.type === '能力卡'), sellPrice:() => 1, isRandomObtainable: () => true, cardHTML: c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, _acts: {}, _baseActs: {}, _roomActive: true, el: {},
    act: (name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../game/src/hub/bag-return-hook.js'));
  flow = await import('../game/src/run/game.run.flow.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
  H.random = () => 0.9;
  H.saves = []; H.uid = 0; H.slot = null; H.narrative = async () => null;
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
  const opening = flow.runEventDeck();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
}
function returnFromBag() { UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) hook(); else H.game.state = 'idle'; }
const potionCards = [1, 2, 3].map(i => ({ id: `p${i}`, name: `药水${i}`, type: '道具', rarity: '古朴' }));

describe('药摊与装备征用的可恢复选择', () => {
  it('满包局部提示并有真实整理入口，返回仍是同一组候选，只能领取一次', async () => {
    H.game.canReceiveCard = () => false;
    await openEvent('ev19-potions', potionCards);
    UI._acts.evtChoice({ i:'0' });
    const pending = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    const old = UI._acts.eventCardPick;
    expect(H.game.visited).toEqual({});
    expect(UI.el.ovBody.querySelector('[data-event-capacity]').textContent).toContain('放不下');
    UI.el.ovBody.querySelector('[data-act="eventCardPick"]').click();
    expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.nodeRewards['0,1'].taken).toBeNull();
    expect(UI.el.ovBody.querySelector('[data-event-capacity]').textContent).toContain('候选已保留');
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const openBag = vi.fn(() => UI.showOverlay('背包', '<main>背包</main>', 'page'));
    bagSlots.showBackpack = openBag;
    UI.el.ovBody.querySelector('[data-act="eventCardBag"]').click();
    expect(openBag).toHaveBeenCalledTimes(1);
    H.game.canReceiveCard = () => true;
    returnFromBag();
    expect(H.game.nodeRewards['0,1'].cardIds).toEqual(pending.cardIds);
    old({ i:'0' }); expect(H.game.ownedCards).toHaveLength(0);
    const current = UI._acts.eventCardPick;
    current({ i:'0' }); current({ i:'1' });
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.game.nodeRewards['0,1'].taken).toBe(0);
    expect(H.game.visited).toEqual({ '0,1':1 });
    expect(takeBagReturnHook()).toBeNull();
    expect(flow.resumeEventCardChoice()).toBe(false);
    expect(H.saves.at(-1).ownedCards).toHaveLength(1);
  });

  it.each(['ev19-potions', 'ev19-quartermaster'])('%s 退出回地图保留未领记录，点原节点重进不重掷不再付款', async id => {
    const candidates = potionCards.map(c => ({ ...c, type:id === 'ev19-potions' ? '道具' : '装备' }));
    H.game.canReceiveCard = () => false;
    await openEvent(id, candidates); UI._acts.evtChoice({ i:'0' });
    const record = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    const coins = H.game.coins;
    H.random = vi.fn(() => 0.1);
    UI._acts.eventExit();
    expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({});
    expect(takeBagReturnHook()).toBeNull();
    await vi.advanceTimersByTimeAsync(400);
    expect(UI.el.overlay.hidden).toBe(true);
    expect(flow.reenterCell()).toBe(true);
    expect(H.game.state).toBe('modal');
    expect(H.game.nodeRewards['0,1']).toEqual(record);
    expect(H.game.coins).toBe(coins);
    expect(H.random).not.toHaveBeenCalled();
  });

  it.each(['ev19-potions', 'ev19-quartermaster'])('%s 正常保存后重载保留候选、付款和未领状态；成功重载不再领取', async id => {
    const candidates = potionCards.map(c => ({ ...c, type:id === 'ev19-potions' ? '道具' : '装备' }));
    await openEvent(id, candidates); UI._acts.evtChoice({ i:'0' });
    const snapshot = JSON.parse(JSON.stringify(H.saves.at(-1)));
    const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
    expect(validateRunSave(snapshot).ok).toBe(true);
    expect(snapshot.nodeRewards['0,1'].paidCoins).toBe(id === 'ev19-quartermaster' ? 3 : 0);
    const prior = UI._acts.eventCardPick;
    Object.assign(H.game, snapshot, { discoveredPairs:new Set() });
    UI.showOverlay('新装载', '<main>新装载</main>', 'page');
    H.random = vi.fn(() => 0);
    expect(flow.resumeEventCardChoice()).toBe(true);
    expect(H.game.coins).toBe(id === 'ev19-quartermaster' ? 15 : 18);
    expect(H.game.nodeRewards['0,1'].cardIds).toEqual(snapshot.nodeRewards['0,1'].cardIds);
    prior({ i:'0' }); expect(H.game.ownedCards).toHaveLength(0);
    const pick = UI._acts.eventCardPick; pick({ i:'1' }); pick({ i:'1' });
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.random).not.toHaveBeenCalled();
    Object.assign(H.game, JSON.parse(JSON.stringify(H.saves.at(-1))), { discoveredPairs:new Set() });
    expect(flow.resumeEventCardChoice()).toBe(false);
    expect(H.game.ownedCards).toHaveLength(1);
  });

  it('装备征用退出/背包反复往返只扣3币，未选择不占背包且付款与候选同次保存', async () => {
    await openEvent('ev19-quartermaster', potionCards.map(c => ({ ...c, type:'装备' })));
    const launch = UI._acts.evtChoice;
    launch({ i:'0' }); launch({ i:'0' });
    expect(H.game.coins).toBe(15);
    expect(H.game.ownedCards).toHaveLength(0);
    expect(H.saves.at(-1)).toMatchObject({ coins:15, nodeRewards:{ '0,1':{ taken:null, paidCoins:3 } } });
    for (let i = 0; i < 2; i++) {
      UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
      UI._acts.eventExit();
      await vi.advanceTimersByTimeAsync(400);
      flow.reenterCell();
    }
    expect(H.game.coins).toBe(15);
    UI._acts.eventCardPick({ i:'0' });
    expect(H.game.coins).toBe(15);
    expect(H.game.ownedCards).toHaveLength(1);
  });

  it.each([2, 3])('装备征用余额%s：不足不扣款，刚好支付后退出仍保留候选', async coins => {
    H.game.coins = coins;
    await openEvent('ev19-quartermaster', potionCards.map(c => ({ ...c, type:'装备' })));
    UI._acts.evtChoice({ i:'0' });
    expect(H.game.coins).toBe(coins < 3 ? coins : 0);
    if (coins < 3) {
      expect(H.game.nodeRewards['0,1']).toEqual({ version:1, type:'event', eventId:'ev19-quartermaster' });
      expect(H.game.visited).toEqual({});
    } else {
      UI._acts.eventExit();
      expect(H.game.nodeRewards['0,1'].taken).toBeNull();
      expect(H.game.coins).toBe(0);
    }
  });

  it('黑市满包命中只收费一次，三张待领持久化，刷新后收下不能重领或重掷', async () => {
    const prizes = [{ id:'e1', name:'装备', type:'装备', rarity:'古朴' }, ...[1,2].map(i => ({ id:`m${i}`, name:`招式${i}`, type:'武术', rarity:'古朴' }))];
    H.game.canReceiveCard = () => false; H.random = () => 0;
    await openEvent('ev19-gamble', prizes); UI._acts.evtChoice({ i:'0' });
    const tryOnce = UI._acts.eventGambleTry; tryOnce(); tryOnce();
    expect(H.game.coins).toBe(15); expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.state).toBe('modal');
    const saved = JSON.parse(JSON.stringify(window.SDT.Chests.serialize(H.game)));
    expect(saved.current.cards.map(c => c.id)).toEqual(['e1','m1','m2']);
    expect(saved.current.source).toBe('地下商场黑市');
    expect(saved.current.taken).toEqual([]);
    UI._acts.chestTake1({ i:'0' });
    expect(window.SDT.Chests.serialize(H.game).current.taken).toEqual([]);
    expect(UI.el.ovBody.textContent).toContain('整理背包');
    const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
    expect(validateRunSave({ ...H.game, chestReward:saved }).ok).toBe(true);
    H.random = vi.fn(() => 0.99);
    H.game.discoveredPairs = new Set();
    expect(scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(saved)))).toBe(true);
    expect(H.game.coins).toBe(15);
    expect(window.SDT.Chests.serialize(H.game).current.cards).toEqual(saved.current.cards);
    H.game.canReceiveCard = () => true;
    const take = UI._acts.chestTake; take(); take();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['e1','m1','m2']);
    const complete = JSON.parse(JSON.stringify(window.SDT.Chests.serialize(H.game)));
    expect(scenes.resumeChestsOnCell(complete)).toBe(true);
    UI._acts.chestTake();
    expect(H.game.ownedCards).toHaveLength(3);
    expect(H.random).not.toHaveBeenCalled();
    UI._acts.chestContinue();
    expect(H.game.state).toBe('idle');
  });

  it('黑市部分可收时保留剩余奖品，整理返回后只收未领取部分且不重复收费', async () => {
    const prizes = [{ id:'e1', name:'装备', type:'装备', rarity:'古朴' }, ...[1,2].map(i => ({ id:`m${i}`, name:`招式${i}`, type:'武术', rarity:'古朴' }))];
    H.game.coins = 3; H.random = () => 0;
    H.game.canReceiveCard = () => H.game.ownedCards.length < 1;
    await openEvent('ev19-gamble', prizes); UI._acts.evtChoice({ i:'0' }); UI._acts.eventGambleTry();
    UI._acts.chestTake();
    const saved = JSON.parse(JSON.stringify(window.SDT.Chests.serialize(H.game)));
    expect(H.game.coins).toBe(0); expect(H.game.ownedCards).toHaveLength(1);
    expect(saved.current.taken).toEqual([0]);
    expect(saved.current.lost).toEqual([]);
    H.game.canReceiveCard = () => true;
    scenes.resumeChestsOnCell(saved); UI._acts.chestTake(); UI._acts.chestTake();
    expect(H.game.coins).toBe(0);
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['e1','m1','m2']);
    UI._acts.chestContinue();
  });

  it('同槽新局或新页面接管后旧动作与背包恢复不能复活候选', async () => {
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' });
    const pick = UI._acts.eventCardPick, restore = takeBagReturnHook();
    H.game.discoveredPairs = new Set(); H.game.nodeRewards = {};
    UI.showOverlay('新局', '<main id="new-run-page">新局</main>', 'page');
    restore(); pick({ i:'0' });
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局');
    expect(H.game.ownedCards).toHaveLength(0);
  });

  it('非法候选或付款标记在存档预检被拒绝；旧存档无需新增字段', async () => {
    const { validateRunSave } = await import('../game/src/hub/run-save-validation.js');
    const valid = { version:1, type:'event-choice', eventId:'ev19-quartermaster', cardIds:['p1','p2'], paidCoins:3, taken:null };
    expect(validateRunSave({ nodeRewards:{ '0,1':valid } }).ok).toBe(true);
    for (const patch of [{ cardIds:['p1','p1'] }, { taken:2 }, { paidCoins:0 }, { eventId:'unknown' }]) {
      expect(validateRunSave({ nodeRewards:{ '0,1':{ ...valid, ...patch } } })).toMatchObject({ ok:false, preserveRun:true });
    }
    expect(validateRunSave({ hp:20 }).ok).toBe(true);
  });
});
