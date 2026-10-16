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

let flow, altar, scenes, UI, takeBagReturnHook, setBagReturnHook;
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
  altar = await import('../game/src/run/game.run.altar.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
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

describe('事件等待与回调生命周期审计', () => {
  it.each(['new-run', 'new-page'])('叙事等待期间 %s 后旧结果不覆盖当前页面', async change => {
    let resolveNarrative;
    H.narrative = () => new Promise(resolve => resolveNarrative = resolve);
    H.cards = [{ id: 'tt6-mystery', name: '旧事件', type: '事件' }];
    const pending = flow.runEventDeck();
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
    if (change === 'reenter') { UI._acts.evtChoice({ i: '0' }); expect(H.game.coins).toBe(20); }
  });
  it('背包返回恢复一级事件，当前选择执行一次', async () => {
    await openEvent('tt6-mystery');
    const old = UI._acts.evtChoice;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
    old({ i: '0' });
    expect(H.game.coins).toBe(18);
    const current = UI._acts.evtChoice; current({ i: '0' }); current({ i: '0' });
    expect(H.game.coins).toBe(20); expect(H.game.fragments).toBe(1);
  });
  it.each(['new-run', 'new-page', 'bag-return'])('二级药摊 %s 后旧选卡回调不能领卡', async change => {
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i: '0' });
    const old = UI._acts.eventCardPick;
    if (change === 'new-run') H.game.discoveredPairs = new Set();
    UI.showOverlay('其他页面', '<main>其他内容</main>', 'page');
    if (change === 'bag-return') returnFromBag();
    old({ i: '0' });
    expect(H.game.ownedCards).toHaveLength(0);
    if (change === 'bag-return') { UI._acts.eventCardPick({ i: '0' }); expect(H.game.ownedCards).toHaveLength(1); }
  });
  it('重编背包返回保留已选卡，旧启动回调不再二次转换', async () => {
    const moves = [1, 2, 3, 4].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
    H.game.ownedCards = moves.slice(0, 2).map((card, i) => ({ uid: `owned${i}`, card }));
    await openEvent('ev19-recode', moves); UI._acts.evtChoice({ i: '0' });
    UI._acts.eventRecodePick({ i: '0' }); UI._acts.eventRecodePick({ i: '1' });
    const oldGo = UI._acts.eventRecodeGo;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
    expect(UI.el.ovBody.querySelectorAll('.picked')).toHaveLength(2);
    oldGo(); expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['m1', 'm2']);
    const currentGo = UI._acts.eventRecodeGo; currentGo();
    const after = H.game.ownedCards.map(o => o.card.id); currentGo();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(after);
  });
  it('黑市背包返回保留四次失败后的保底次数，旧回调不扣币', async () => {
    const rewards = [{ id: 'e1', name: '装备', type: '装备', rarity: '古朴' }, ...[1, 2].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }))];
    await openEvent('ev19-gamble', rewards); UI._acts.evtChoice({ i: '0' });
    for (let i = 0; i < 4; i++) UI._acts.eventGambleTry();
    expect(H.game.coins).toBe(6);
    const oldTry = UI._acts.eventGambleTry;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
    expect(UI.el.ovBody.textContent).toContain('已尝试 4/5');
    oldTry(); expect(H.game.coins).toBe(6);
    UI._acts.eventGambleTry(); expect(H.game.coins).toBe(3); expect(H.game.ownedCards).toHaveLength(0);
    expect(window.SDT.Chests.serialize(H.game).current.cards).toHaveLength(3);
    UI._acts.chestTake(); expect(H.game.ownedCards).toHaveLength(3);
  });
  it('合法的迟到叙事仍可显示，多选事件由真实点击确认后结算一次', async () => {
    let resolveNarrative;
    H.narrative = () => new Promise(resolve => resolveNarrative = resolve);
    H.cards = [{ id: 'tt6-airdrop', name: '补给', type: '事件' }];
    const pending = flow.runEventDeck(); await vi.advanceTimersByTimeAsync(1500);
    resolveNarrative(null); await pending;
    UI.el.ovBody.querySelector('[data-act="evtChoice"][data-i="2"]').click();
    expect(H.game.hp).toBe(1);
    UI.el.ovBody.querySelector('.event-choice-clear').click();
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(true);
    UI.el.ovBody.querySelector('[data-act="evtChoice"][data-i="2"]').click();
    const confirm = UI.el.ovBody.querySelector('.event-choice-confirm'); confirm.click(); confirm.click();
    expect(H.game.hp).toBe(7); expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({ '0,1': 1 });
  });
  it('自定义单项事件正常领取后回待机，旧回调不能消费下一节点', async () => {
    await openEvent('custom-event'); const complete = UI._acts.evtNext; complete();
    expect(H.game.state).toBe('idle'); expect(H.game.visited).toEqual({ '0,1': 1 });
    H.game.trackPos = 2; H.game.state = 'modal'; complete();
    expect(H.game.visited).toEqual({ '0,1': 1 });
  });
  it.each(['ev19-recode', 'ev19-gamble'])('%s 中途放弃后旧恢复hook与动作不能复活奖励', async id => {
    const rewards = [{ id: 'e1', name: '装备', type: '装备', rarity: '古朴' }, ...[1, 2, 3].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }))];
    H.game.ownedCards = rewards.slice(1, 3).map((card, i) => ({ uid: `u${i}`, card }));
    await openEvent(id, rewards); UI._acts.evtChoice({ i: '0' });
    const restore = takeBagReturnHook();
    const leave = UI._acts[id === 'ev19-recode' ? 'eventRecodeLeave' : 'eventGambleLeave'];
    const oldAction = UI._acts[id === 'ev19-recode' ? 'eventRecodePick' : 'eventGambleTry'];
    leave(); const coins = H.game.coins; const owned = H.game.ownedCards.map(o => o.card.id);
    restore(); oldAction({ i: '0' });
    expect(H.game.state).toBe('idle'); expect(H.game.coins).toBe(coins); expect(H.game.ownedCards.map(o => o.card.id)).toEqual(owned);
    expect(UI.el.overlay.hidden).toBe(true); expect(takeBagReturnHook()).toBeNull();
  });
  it('二级奖励旧恢复hook在同槽新局不会覆盖新页', async () => {
    await openEvent('ev19-potions', potionCards); UI._acts.evtChoice({ i: '0' });
    const restore = takeBagReturnHook(); H.game.discoveredPairs = new Set();
    UI.showOverlay('新局页面', '<main id="new-run-page">新局</main>', 'page'); restore();
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局');
  });
  it('祭坛正常弃三张后，首份激活保存即保留待领标记；奖励页刷新可再进', () => {
    H.game.ownedCards = [1, 2, 3].map(i => ({ uid: `a${i}`, card: { id: `c${i}`, name: `供品${i}`, type: '武术' } }));
    altar.openAltarRitual(); UI._acts.altarOn3();
    for (const uid of ['a1', 'a2', 'a3']) UI._acts.sacPick({ uid });
    UI._acts.sacConfirm();
    expect(H.saves.find(s => s.altarActivated)).toMatchObject({ altarActivated: true, altarRewardPending: true });
    Object.assign(H.game, H.saves.at(-1)); altar.openAltarRitual();
    expect(UI.el.ovBody.querySelector('[data-act="altarRewardLoot"]')).not.toBeNull();
  });
  it('祭坛回赠离开后可重进领取一次，旧领取回调不再发奖', () => {
    H.cards = [{ id: 'legend', name: '传说', rarity: '传说', type: '法术' }, { id: 'equip', name: '装备', rarity: '古朴', type: '装备' }];
    H.game.altarActivated = true; H.game.altarRewardPending = true;
    altar.openAltarRitual(); const old = UI._acts.altarRewardLoot; UI._acts.altarRewardLeave();
    altar.openAltarRitual(); old(); expect(H.game.ownedCards).toHaveLength(0);
    const current = UI._acts.altarRewardLoot; current(); current();
    expect(H.game.ownedCards).toHaveLength(0);
    const take = UI._acts.chestTake; take(); take(); expect(H.game.ownedCards).toHaveLength(2);
    expect(H.game.altarRewardPending).toBe(false); expect(H.saves.at(-1).altarRewardPending).toBe(false);
  });
  it('献祭取消后的旧确认不能激活或扣牌，不足数量的确认也不能通过', () => {
    H.game.ownedCards = [1, 2, 3].map(i => ({ uid: `a${i}`, card: { id: `c${i}`, name: `供品${i}`, type: '武术' } }));
    altar.openAltarRitual(); UI._acts.altarOn3(); const old = UI._acts.sacConfirm;
    UI._acts.sacConfirm(); expect(H.game.ownedCards).toHaveLength(3); expect(H.game.altarActivated).toBe(false);
    UI._acts.sacCancel(); old(); expect(H.game.ownedCards).toHaveLength(3); expect(H.game.altarActivated).toBe(false);
  });
  it('祭坛碎片兑换同槽新局后的旧回调不能扣碎片或发旧奖励', () => {
    H.cards = [{ id: 'hero', name: '能力卡', rarity: '职业', type: '能力卡' }]; H.game.fragments = 2;
    altar.openAltarRitual(); const old = UI._acts.altarFragHero; H.game.discoveredPairs = new Set(); old();
    expect(H.game.fragments).toBe(2); expect(H.game.ownedCards).toHaveLength(0); expect(H.game.altarActivated).toBe(false);
  });
  it('复原背包返回共用剩余次数与完成状态，旧回调不能额外恢复', () => {
    H.game.usedPocket = [{ card: { id: 'restore', name: '复原样本', type: '武术' }, count: 3 }];
    const done = vi.fn(); scenes.openPocketRestore(1, done); const old = UI._acts.restoreOne;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
    old({ name: '复原样本' }); expect(H.game.ownedCards).toHaveLength(0);
    const current = UI._acts.restoreOne; current({ name: '复原样本' }); old({ name: '复原样本' }); current({ name: '复原样本' });
    expect(H.game.ownedCards).toHaveLength(1); expect(H.game.usedPocket[0].count).toBe(2); expect(done).toHaveBeenCalledTimes(1);
  });
  it('F02 满包动力锤保留固定奖励，重载后可整理重试且不重复发卡', async () => {
    const hammer = { id:'cmtn0xt0zr7', name:'闪金之锤', rarity:'传说', type:'装备' };
    H.game.canReceiveCard = () => false;
    await openEvent('tt6-goldhammer', [hammer]);
    UI._acts.evtChoice({ i:'0' });
    const saved = window.SDT.Chests.serialize(H.game);
    expect(saved.current.cards.map(c => c.id)).toEqual([hammer.id]);
    UI._acts.chestTake1({ i:'0' });
    expect(H.game.ownedCards).toHaveLength(0);
    expect(window.SDT.Chests.serialize(H.game).current.taken).toEqual([]);
    H.game.canReceiveCard = () => true;
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(saved)));
    const take = UI._acts.chestTake1; take({ i:'0' }); take({ i:'0' });
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual([hammer.id]);
    expect(UI.el.ovBody.textContent).toContain('1 张已入背包');
    UI._acts.chestContinue();
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
      expect(UI.el.ovBody.textContent).toContain('碎片和本次选择已保留');
      expect(H.game.ownedCards).toHaveLength(0);
      choose({ i:'1' }); choose({ i:'1' }); choose({ i:'0' });
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
  it('F01 祭坛固定候选刷新不重掷，已领卡刷新后不重复发奖', () => {
    H.cards = [{ id:'legend', name:'传说', rarity:'传说', type:'法术' }, { id:'equip', name:'装备', rarity:'古朴', type:'装备' }];
    H.game.altarActivated = true; H.game.altarRewardPending = true;
    altar.openAltarRitual(); UI._acts.altarRewardLoot();
    const saved = window.SDT.Chests.serialize(H.game);
    expect(saved.current.source).toContain('祭坛');
    H.random = () => 0.2;
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(saved)));
    expect(window.SDT.Chests.serialize(H.game).current.cards).toEqual(saved.current.cards);
    UI._acts.chestTake1({ i:'0' });
    const after = window.SDT.Chests.serialize(H.game);
    scenes.resumeChestsOnCell(JSON.parse(JSON.stringify(after)));
    UI._acts.chestTake1({ i:'0' }); UI._acts.chestTake1({ i:'1' });
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['legend', 'equip']);
    UI._acts.chestContinue();
    expect(H.game.state).toBe('idle');
    H.random = () => 0.9;
  });
  it('F15/F41 物资格满包显示整理，领取成功留结果页再继续', () => {
    H.cards = [{ id:'wood', name:'木材', type:'资源', rarity:'古朴' }, { id:'key', name:'钥匙', type:'资源', rarity:'古朴' }];
    H.game.layerData[0].logical[1].def.type = 'resource';
    H.game.canReceiveCard = () => false;
    flow.reenterCell();
    expect(UI.el.ovBody.textContent).toContain('当前放不下');
    expect(UI.el.ovBody.querySelector('[data-act="resTake"]')).toBeNull();
    H.game.canReceiveCard = () => true;
    UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
    const take = UI._acts.resTake; take({ i:'0' }); take({ i:'0' });
    expect(H.game.ownedCards).toHaveLength(1);
    expect(H.game.state).toBe('modal');
    expect(UI.el.ovBody.textContent).toContain('领取完成');
    expect(UI.el.ovBody.querySelector('[data-act="resTake"]')).toBeNull();
    UI._acts.resSkip();
    expect(H.game.state).toBe('idle');
  });
  it('F35 闸门确认前可返回当前层，旧进入动作不会换层', () => {
    altar.openDoorModal({ pair:'p1', toLayer:1, arriveAt:0 }, {});
    const enter = UI._acts.goDoor;
    expect(UI.el.ovBody.textContent).toContain('确认前可返回当前层检查遗漏');
    expect(UI.el.ovBody.querySelector('[data-act="doorBag"]')).not.toBeNull();
    UI._acts.doorBack(); enter();
    expect(H.game.layerIdx).toBe(0);
    expect(H.game.state).toBe('idle');
    expect(takeBagReturnHook()).toBeNull();
  });
  it('F06 三选一明确永久放弃，其余候选刷新后仍不可领取', () => {
    H.cards = [1, 2, 3].map(i => ({ id:`pick${i}`, name:`候选${i}`, type:'法术', rarity:'古朴' }));
    window.SDT.MAP.chestKinds.medium = { name:'中型宝箱', pickFrom:3 };
    scenes.openFixedRewardsOnCell(H.cards, '测试三选一');
    const saved = window.SDT.Chests.serialize(H.game);
    saved.queue[0].kind = saved.current.kind = 'medium';
    scenes.resumeChestsOnCell(saved);
    expect(UI.el.ovBody.textContent).toContain('其余卡牌永久放弃，无法找回');
    UI._acts.chestPick({ i:'1' });
    const after = window.SDT.Chests.serialize(H.game);
    expect(after.current.taken).toEqual([1]);
    expect(after.current.lost).toEqual([0, 2]);
    scenes.resumeChestsOnCell(after);
    expect(UI.el.ovBody.textContent).toContain('2 张已永久放弃');
    expect(UI.el.ovBody.querySelector('[data-act="chestPick"]')).toBeNull();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['pick2']);
  });
  it('F42 奖励提示同时说明点击与自动收起，两种关闭均有效', async () => {
    const { cinematicsMethods } = await import('../game/src/ui/cinematics.js');
    const cinema = { ...cinematicsMethods, _cardGetQueue:[], _cardGetShowing:false };
    const card = { id:'reward', name:'奖励', type:'法术', rarity:'古朴' };
    cinema.showCardReward(card);
    expect(document.querySelector('#cardGet .lg-hint').textContent).toBe('点击收起 · 稍后自动收起');
    document.getElementById('cardGet').click();
    await vi.advanceTimersByTimeAsync(500);
    expect(document.getElementById('cardGet')).toBeNull();
    cinema.showLegendGet({ ...card, rarity:'传说' });
    expect(document.querySelector('#legendGet .lg-hint').textContent).toBe('点击收起 · 稍后自动收起');
    await vi.advanceTimersByTimeAsync(3300);
    expect(document.getElementById('legendGet')).toBeNull();
  });
  it('B01 首脑战先展示现行牌库与抽牌规则，返回保留挑战', () => {
    H.game.altarActivated = true;
    altar.openBossGate();
    expect(UI.el.ovBody.textContent).toContain('最多 15 张');
    expect(UI.el.ovBody.textContent).toContain('5 张初始攻击');
    expect(UI.el.ovBody.textContent).toContain('起手抽 5 张，每回合抽 1 张，手牌上限 8 张');
    UI._acts.bossGateBack();
    expect(H.game.state).toBe('idle');
    expect(H.game.visited).toEqual({});
  });
  it('复原离页/同槽新局后的动作与恢复hook不能操作新局', () => {
    H.game.usedPocket = [{ card: { id: 'restore', name: '复原样本', type: '武术' }, count: 3 }];
    scenes.openPocketRestore(1, vi.fn()); const old = UI._acts.restoreOne; const restore = takeBagReturnHook();
    H.game.discoveredPairs = new Set(); UI.showOverlay('新局', '<main id="new-run-page">新局</main>', 'page');
    restore(); old({ name: '复原样本' }); expect(H.game.ownedCards).toHaveLength(0);
    expect(document.getElementById('new-run-page')?.textContent).toBe('新局');
  });
});
