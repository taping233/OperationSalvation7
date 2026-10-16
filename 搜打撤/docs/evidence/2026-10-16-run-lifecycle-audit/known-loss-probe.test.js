import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ game: {}, cards: [], saves: [], uid: 0, slot: null, narrative: async () => null, random: () => 0.9 }));
vi.mock('../../../game/src/core/random.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, Random: { ...actual.Random, random: (...args) => H.random(...args) } };
});
vi.mock('../../../game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal:10, fireClassCardChance:1, bossDeckSize:15, starterSha:5, battleStartDraw:5, battleTurnDraw:1, battleHandMax:8 }, items:{ rations:{ count:1 } }, monsters:{}, altar:{ bosses:[] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => H.slot, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../../../game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../../../game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../../../game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../../../game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../../../game/src/home/story.commands.js', () => ({ storyCommands: { inspect: () => ({ ok: true, value: { kind: 'complete' } }) } }));
vi.mock('../../../game/src/home/narrative.js', () => ({ eventNarrative: (...args) => H.narrative(...args), lastLampNarrative: async () => null }));

let flow, scenes, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { game: H.game, Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: { bagCap:() => 9 },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' } } },
    Cards: { DROP_WEIGHTS:{ 古朴:1 }, all: () => H.cards, classPool: () => H.cards.filter(c => c.type === '能力卡'), sellPrice:() => 1, isRandomObtainable: () => true, cardHTML: c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../../../game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, _acts: {}, _baseActs: {}, _roomActive: true, el: {},
    act: (name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../../../game/src/hub/bag-return-hook.js'));
  flow = await import('../../../game/src/run/game.run.flow.js');
  scenes = await import('../../../game/src/run/game.run.scenes.js');
  await import('../../../game/src/run/chests.js');
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

// These assertions document current loss behavior; they are audit probes, not acceptance criteria.
describe('未修复奖励丢失审查探针', () => {
  it('满包黑市命中仍收费、消费节点、关闭且零卡入包，无待领记录', async () => {
    H.game.canReceiveCard = () => false;
    H.random = () => 0;
    const prizes = [{ id:'e1', name:'装备', type:'装备', rarity:'古朴' }, ...[1,2].map(i => ({ id:`m${i}`, name:`招式${i}`, type:'武术', rarity:'古朴' }))];
    await openEvent('ev19-gamble', prizes); UI._acts.evtChoice({ i:'0' });
    expect(UI.el.ovBody.querySelector('[data-act="eventGambleTry"]')).not.toBeNull();
    UI.el.ovBody.querySelector('[data-act="eventGambleTry"]').click();
    await vi.advanceTimersByTimeAsync(400);
    expect(H.game.coins).toBe(15);
    expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.visited).toEqual({ '0,1':1 });
    expect(H.game.nodeRewards).toEqual({});
    expect(window.SDT.Chests.serialize(H.game)).toBeNull();
    expect(H.game.state).toBe('idle');
    expect(UI.el.overlay.hidden).toBe(true);
  });

  it.each(['wood','rations','key'])('旧型%s节点满包领取后仍消费且没有卡或未领奖励记录', async kind => {
    H.game.canReceiveCard = () => false;
    H.cards = [{ id:`tt-${kind}`, name:kind, type:'资源', rarity:'古朴' }];
    H.game.layerData[0].logical[1].def.type = kind;
    flow.reenterCell();
    await vi.advanceTimersByTimeAsync(1000);
    UI.el.ovBody.querySelector('[data-act="pickupGo"]').click();
    await vi.advanceTimersByTimeAsync(400);
    expect(H.game.ownedCards).toHaveLength(0);
    expect(H.game.visited).toEqual({ '0,1':1 });
    expect(H.game.nodeRewards).toEqual({});
    expect(H.game.state).toBe('idle');
  });
});
