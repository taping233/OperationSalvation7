import { rollEventDice } from './helpers/event-dice.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
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
  bagSlots.organizeReward = options => openRewardCapacityOrganizer({ ...options, UI,
    readStacks:()=>[],canReceive:()=>H.game.canReceiveCard(options.card),capacity:()=> '测试容量',
    moveToSafe:()=>false,discardOne:()=>false });
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
  UI.showCardZoom = vi.fn((card, options) => {
    document.getElementById('cardZoom')?._closeCardZoom?.(true);
    const zoom = document.createElement('div'); zoom.id = 'cardZoom';
    zoom.innerHTML = `<button class="cz-close">关闭</button><p>${card.desc || card.name}</p><div class="cz-foot">${options.footer}</div>`;
    zoom._closeCardZoom = () => zoom.remove();
    zoom.addEventListener('click', event => {
      if (event.target.closest('.cz-close')) { zoom._closeCardZoom(); return; }
      const button = event.target.closest('[data-act]');
      if (button) UI._acts[button.dataset.act]?.(button.dataset);
    });
    document.body.appendChild(zoom);
  });
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
  it.each([false, true])('卡面只阅读，关闭不领；明确领取仅发一张（详情领取=%s）', async fromDetail => {
    await openEvent('ev19-potions', potionCards);
    expect(UI.el.ovBody.querySelector('[data-act="evtChoice"] span').textContent).toContain('投骰');
    UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    const record = H.game.nodeRewards['0,1'];
    const before = JSON.stringify(record);
    const read = UI.el.ovBody.querySelector('[data-act="eventCardRead"]'); read.click();
    expect(UI.showCardZoom).toHaveBeenCalledOnce();
    expect(H.game.ownedCards).toHaveLength(0); expect(JSON.stringify(record)).toBe(before);
    document.querySelector('#cardZoom .cz-close').click();
    expect(H.game.ownedCards).toHaveLength(0); expect(record.taken).toBeNull();
    if (fromDetail) read.click();
    const pick = fromDetail ? document.querySelector('#cardZoom [data-act="eventCardPick"]') : UI.el.ovBody.querySelector('[data-act="eventCardPick"]');
    const saved = UI._acts.eventCardPick, data = { ...pick.dataset }; pick.click(); saved(data);
    expect(H.game.ownedCards).toHaveLength(1); expect(record.taken).toBe(0);
    expect(document.getElementById('cardZoom')).toBeNull(); expect(H.game.state).toBe('idle');
  });

  it('真实卡牌引用往返重建详情后，满包领取仍关闭当前自有特写并解除 inert', async () => {
    const realUI = (await import('../game/src/ui/ui.js')).UI;
    window.SDT.UI = UI;
    UI.showCardZoom = realUI.showCardZoom;
    H.game.canReceiveCard = () => false;
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    expect(UI.el.ovBody.textContent).toContain('暂离可保留候选，领取后其余放弃。');
    UI.el.ovBody.querySelector('[data-act="eventCardRead"]').click();
    const initial = document.getElementById('cardZoom');
    const reference = document.createElement('button'); reference.dataset.cardReference = 'p2';
    initial.querySelector('.cz-card').append(reference); reference.click();
    const child = document.getElementById('cardZoom');
    expect(child).not.toBe(initial); expect(child.querySelector('[data-act="eventCardPick"]')).toBeNull();
    child.querySelector('.cz-reference-back').click();
    const restored = document.getElementById('cardZoom');
    expect(restored).not.toBe(initial); expect(restored).not.toBe(child);
    expect(UI.el.overlay.inert).toBe(true);
    restored.querySelector('[data-act="eventCardPick"]').click();
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(UI.el.overlay.inert).toBe(false);
    expect(UI.el.ovBody.querySelector('.reward-capacity-organizer')).not.toBeNull();
    expect(H.game.nodeRewards['0,1'].taken).toBeNull(); expect(H.game.ownedCards).toHaveLength(0);
  });

  it('详情领取满包时关闭详情露出错误，候选不丢并可整理后重试', async () => {
    H.game.canReceiveCard = () => false;
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    const record = H.game.nodeRewards['0,1'], ids = [...record.cardIds];
    UI.el.ovBody.querySelector('[data-act="eventCardRead"]').click();
    document.querySelector('#cardZoom [data-act="eventCardPick"]').click();
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(UI.el.ovBody.querySelector('.reward-capacity-organizer')).not.toBeNull();
    expect(record.taken).toBeNull(); expect(record.cardIds).toEqual(ids); expect(H.game.ownedCards).toHaveLength(0);
    H.game.canReceiveCard = () => true;
    UI.el.ovBody.querySelector('[data-organize="return"]').click();
    UI.el.ovBody.querySelector('[data-act="eventCardPick"]').click();
    expect(H.game.ownedCards).toHaveLength(1);
  });

  it('取消当前选择页时不关闭没有本视图归属的其他详情', async () => {
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    UI.el.ovBody.querySelector('[data-act="eventCardRead"]').click();
    UI.showCardZoom(potionCards[1], { footer:'<button data-act="unrelated">其他详情</button>' });
    const unrelated = document.getElementById('cardZoom');
    // bag 切换用独立回调桩，隔离全局 overlay 自身的清理职责。
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const previous = bagSlots.showBackpack; bagSlots.showBackpack = vi.fn();
    try { UI._acts.eventCardBag(); expect(document.getElementById('cardZoom')).toBe(unrelated); }
    finally { bagSlots.showBackpack = previous; unrelated._closeCardZoom(); }
  });

  it('同节点返回重开后，旧详情数据和旧领取回调都不能领取当前候选', async () => {
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    UI.el.ovBody.querySelector('[data-act="eventCardRead"]').click();
    const oldData = { ...document.querySelector('#cardZoom [data-act="eventCardPick"]').dataset };
    const oldPick = UI._acts.eventCardPick, oldRead = UI._acts.eventCardRead;
    UI._acts.eventCardReturn();
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(flow.resumeEventCardChoice()).toBe(true);
    oldPick(oldData); oldRead({ i:'0' }); UI._acts.eventCardPick(oldData);
    expect(H.game.ownedCards).toHaveLength(0); expect(document.getElementById('cardZoom')).toBeNull();
    expect(H.game.nodeRewards['0,1'].taken).toBeNull();
    UI.el.ovBody.querySelector('[data-act="eventCardRead"]').click();
    document.querySelector('#cardZoom [data-act="eventCardPick"]').click();
    expect(H.game.ownedCards).toHaveLength(1);
  });

  it('满包局部提示并有真实整理入口，返回仍是同一组候选，只能领取一次', async () => {
    H.game.canReceiveCard = () => false;
    await openEvent('ev19-potions', potionCards);
    UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    const pending = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    const old = UI._acts.eventCardPick;
    expect(H.game.visited).toEqual({ '0,1':1 });
    expect(UI.el.ovBody.querySelector('[data-event-capacity]').textContent).toContain('放不下');
    UI.el.ovBody.querySelector('[data-act="eventCardPick"]').click();
    expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.nodeRewards['0,1'].taken).toBeNull();
    expect(UI.el.ovBody.querySelector('.reward-capacity-organizer')).not.toBeNull();
    const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
    const openBag = vi.fn(() => UI.showOverlay('背包', '<main>背包</main>', 'page'));
    bagSlots.showBackpack = openBag;
    UI.el.ovBody.querySelector('[data-organize="bag"]').click();
    expect(openBag).toHaveBeenCalledTimes(1);
    H.game.canReceiveCard = () => true;
    returnFromBag();
    expect(document.activeElement.dataset.i).toBe('0');
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
    await openEvent(id, candidates); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    const record = JSON.parse(JSON.stringify(H.game.nodeRewards['0,1']));
    const coins = H.game.coins;
    H.random = vi.fn(() => 0.1);
    UI._acts.eventExit();
    expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({ '0,1':1 });
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
    await openEvent(id, candidates); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
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
    launch({ i:'0' }); rollEventDice(UI); launch({ i:'0' });
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
    UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
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
    await openEvent('ev19-gamble', prizes); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
    H.random = () => 0.99; const tryOnce = UI._acts.eventGambleTry; tryOnce(); rollEventDice(UI); tryOnce();
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
    await openEvent('ev19-gamble', prizes); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI); H.random = () => 0.99; UI._acts.eventGambleTry(); rollEventDice(UI);
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
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i:'0' }); rollEventDice(UI);
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


it('黑市入口不重复规则，首次投币前风险/价格/保底和放弃仍可见', async () => {
  const prizes=[{id:'market-e',name:'装备',type:'装备',rarity:'古朴'},...[1,2].map(i=>({id:`market-m${i}`,name:`招式${i}`,type:'武术',rarity:'古朴'}))];
  await openEvent('ev19-gamble',prizes);
  expect(UI.el.ovBody.querySelector('[data-act="evtChoice"] span').textContent).toContain('投骰');
  const coins=H.game.coins;
  UI._acts.evtChoice({i:'0'}); rollEventDice(UI); rollEventDice(UI);
  expect(H.game.coins).toBe(coins);
  const text=UI.el.ovBody.textContent;
  expect(text).toContain('3 币'); expect(text).toContain('50%'); expect(text).toContain('5 次任意点数都成功');
  expect(text).toContain('已尝试 0/5 次');
  expect(UI.el.ovBody.querySelector('[data-act="eventGambleTry"]').textContent).toContain('投入 3 币');
  expect(UI.el.ovBody.querySelector('[data-act="eventGambleLeave"]').textContent).toBe('放弃并离开');
  UI._acts.eventGambleLeave(); expect(H.game.coins).toBe(coins);
});


it.each([
  ['ev19-vital','接受强化急救'], ['ev19-pearlbox','取走珍珠匣'],
  ['ev19-fireballs','接收封装火种'], ['ev19-classchest','启封黑箱'],
  ['ev19-arrows','投骰打开弹药柜'],
])('纯收益入口仅正文保留完整规则，按钮不重复且打开未结算：%s', async (id, label) => {
  const card = dataSlice.EVENTS_0919.find(c => c.id === id);
  expect(card).toBeTruthy();
  H.cards = [card,
    {id:'tt2-pearlbox',name:'珍珠盒',type:'武术'}, {id:'tt3-fireball',name:'火球',type:'法术'},
    {id:'arrow1',name:'箭一',type:'武术'}, {id:'arrow2',name:'箭二',type:'法术'},
    {id:'class-arrow',name:'职业箭',type:'法术',cls:'法师',rarity:'职业'},
  ];
  const restored = vi.spyOn(window.SDT.Chests, 'restore').mockReturnValue(true);
  const opened = vi.spyOn(window.SDT.Chests, 'open').mockImplementation(() => {});
  const before = {hp:H.game.hp,maxHp:H.game.maxHp,coins:H.game.coins,cards:JSON.stringify(H.game.ownedCards)};
  const opening = flow.runEventDeck();
  await vi.advanceTimersByTimeAsync(1000); await opening;
  const button = UI.el.ovBody.querySelector('[data-act="evtChoice"]');
  expect(button.querySelector('b').textContent).toBe(label);
  expect(button.querySelector('span')).toBeNull();
  expect(UI.el.ovBody.textContent.split(card.desc)).toHaveLength(2);
  expect({hp:H.game.hp,maxHp:H.game.maxHp,coins:H.game.coins,cards:JSON.stringify(H.game.ownedCards)}).toEqual(before);
  expect(H.game.visited['0:1']).not.toBe(true);
  expect(UI.el.ovBody.querySelector('[data-act="evtBag"]')).not.toBeNull();
  expect(UI.el.ovBody.querySelector('[data-act="evtReturn"]')).not.toBeNull();
  expect(restored).not.toHaveBeenCalled(); expect(opened).not.toHaveBeenCalled();
  UI._acts.evtChoice({i:'0'}); rollEventDice(UI); rollEventDice(UI);
  if (id === 'ev19-vital') {
    expect(H.game.hp).toBe(before.hp + 3); expect(H.game.maxHp).toBe(before.maxHp + 3);
  } else if (id === 'ev19-classchest') {
    expect(opened.mock.calls[0][1]).toEqual([{kind:'medium',isClass:true}]);
  } else {
    const ids = restored.mock.calls[0][1].current.cards.map(c => c.id);
    expect(ids).toEqual(id === 'ev19-pearlbox' ? ['tt2-pearlbox'] : id === 'ev19-fireballs' ? ['tt3-fireball','tt3-fireball'] : ['arrow2','arrow1']);
  }
  expect(H.game.coins).toBe(before.coins);
});

it('故障重编入口正文保规则，接入选择页不转换不收费且仍显示完整限制', async () => {
  const narrative = await vi.importActual('../game/src/home/narrative.js');
  expect(narrative.KNOTS['ev19-recode']).toBeUndefined();
  expect(await narrative.eventNarrative('ev19-recode')).toBeNull();
  const card = dataSlice.EVENTS_0919.find(c => c.id === 'ev19-recode');
  const old = { id: 'old-spell', name: '旧法术', type: '法术', rarity: '稀有' };
  const next = { id: 'next-spell', name: '新法术', type: '法术', rarity: '稀有' };
  H.cards = [card, old, next];
  H.game.ownedCards = [{ uid: 'one', card: { ...old } }, { uid: 'two', card: { ...old } }];
  const snapshot = () => JSON.stringify({ cards: H.game.ownedCards, coins: H.game.coins, hp: H.game.hp });
  const before = snapshot();
  const opening = flow.runEventDeck();
  await vi.advanceTimersByTimeAsync(1000); await opening;
  const button = UI.el.ovBody.querySelector('[data-act="evtChoice"]');
  expect(button.querySelector('b').textContent).toBe('接入重编台');
  expect(button.querySelector('span').textContent).toContain('投骰');
  expect(UI.el.ovBody.textContent.split(card.desc)).toHaveLength(2);
  expect(card.desc).toBe('选择 2 张招式或装备卡，随机变为同稀有度、同类型的卡牌。');
  expect(snapshot()).toBe(before);
  UI._acts.evtChoice({ i: '0' }); rollEventDice(UI);
  expect(UI.el.ovBody.textContent).toContain('选择 2 张招式或装备卡，将其随机变为同稀有度、同类型的卡牌（0/2）');
  expect(UI.el.ovBody.querySelectorAll('[data-act="eventRecodePick"]')).toHaveLength(2);
  expect(UI.el.ovBody.querySelector('[data-act="eventRecodeGo"]').disabled).toBe(true);
  expect(UI.el.ovBody.querySelector('[data-act="eventRecodeLeave"]')).not.toBeNull();
  expect(snapshot()).toBe(before);
});

it.each(['ev19-potions','ev19-quartermaster'])('%s满包直接复用整理，返回保目标焦点、腾位后领取一次且不重付', async id => {
  const previous=bagSlots.organizeReward;
  let full=true;
  H.game.canReceiveCard=()=>!full;
  bagSlots.organizeReward=options=>openRewardCapacityOrganizer({...options,UI,
    readStacks:()=>full?[{card:{name:'夹具占位卡'},uids:['filler'],count:1}]:[],canReceive:()=>!full,capacity:()=>'',
    moveToSafe:()=>{full=false;return true;},discardOne:()=>false});
  try {
    await openEvent(id,potionCards.map(c=>({...c,type:id==='ev19-potions'?'道具':'装备'})));
    UI._acts.evtChoice({i:'0'}); rollEventDice(UI); rollEventDice(UI);
    const coins=H.game.coins,record=H.game.nodeRewards['0,1'],ids=[...record.cardIds];
    expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]').textContent).toBe('腾位置领取');
    UI._acts.eventCardPick({i:'1'});
    const old=document.querySelector('[data-organize="safe"]');
    expect(takeBagReturnHook()).toBeNull();
    document.querySelector('[data-organize="return"]').click();
    expect(document.activeElement.dataset.i).toBe('1');
    expect(record.taken).toBeNull();expect(record.cardIds).toEqual(ids);
    UI._acts.eventCardPick({i:'1'});old.click();expect(full).toBe(true);
    document.querySelector('[data-organize="safe"]').click();
    const claim=document.querySelector('[data-organize="claim"]');claim.click();claim.click();
    expect(record.taken).toBe(1);expect(H.game.ownedCards).toHaveLength(1);
    expect(H.game.coins).toBe(coins);expect(takeBagReturnHook()).toBeNull();
  } finally {bagSlots.organizeReward=previous;}
});

it('事件整理页乐观可收但原grant拒收，返回候选显示失败且保留已付款/选择', async()=>{
  const previous=bagSlots.organizeReward;
  bagSlots.organizeReward=options=>openRewardCapacityOrganizer({...options,UI,
    readStacks:()=>[],canReceive:()=>true,capacity:()=>'',moveToSafe:()=>false,discardOne:()=>false});
  try{
    H.game.canReceiveCard=()=>false;
    await openEvent('ev19-quartermaster',potionCards.map(c=>({...c,type:'装备'})));UI._acts.evtChoice({i:'0'}); rollEventDice(UI); rollEventDice(UI);
    const record=H.game.nodeRewards['0,1'],coins=H.game.coins;
    UI._acts.eventCardPick({i:'2'});document.querySelector('[data-organize="claim"]').click();
    expect(record.taken).toBeNull();expect(H.game.ownedCards).toHaveLength(0);expect(H.game.coins).toBe(coins);
    expect(document.querySelector('[data-event-capacity]').textContent).toContain('候选已保留');
    expect(document.activeElement.dataset.i).toBe('2');
  }finally{bagSlots.organizeReward=previous;}
});
