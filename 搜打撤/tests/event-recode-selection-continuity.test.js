import { rollEventDice } from './helpers/event-dice.js';
import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';

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
  await import('../game/src/run/game.run.altar.js');
  scenes = await import('../game/src/run/game.run.scenes.js');
  await import('../game/src/run/chests.js');
});
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI.el.ovBody.addEventListener('click', event => { const button = event.target.closest('[data-act]'); if (button) UI._acts[button.dataset.act]?.(button.dataset); });
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; UI._roomActive = true; setBagReturnHook(null);
  bagSlots.organizeReward = options => openRewardCapacityOrganizer({ ...options, UI,
    readStacks:() => H.game.ownedCards.filter(o => !o.safe).map(o => ({card:o.card,uids:[o.uid],count:1})),
    canReceive:() => H.game.canReceiveCard(options.card), capacity:() => '背包 9/9 格',
    moveToSafe:stack => { H.game.ownedCards.find(o => o.uid === stack.uids[0]).safe=true; return true; },
    discardOne:() => false,
  });
  bagSlots.showBackpack = () => UI.showOverlay('背包', '<main>背包</main>', 'page');
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

it('重编连续选取取消保留候选节点、焦点和滚动，只更新选择与提交状态', async () => {
  const moves = [1, 2, 3, 4].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
  H.game.ownedCards = moves.map((card, i) => ({ uid: `owned${i}`, card }));
  await openEvent('ev19-recode', moves); UI._acts.evtChoice({ i: '0' }); rollEventDice(UI);
  const root = UI.el.ovBody.querySelector('.event-scene');
  const list = UI.el.ovBody.querySelector('.event-choice-hand');
  const buttons = [...list.querySelectorAll('[data-act="eventRecodePick"]')];
  const go = UI.el.ovBody.querySelector('[data-act="eventRecodeGo"]');
  const show = vi.spyOn(UI, 'showOverlay');
  list.scrollTop = 140; buttons[0].focus();
  UI._acts.eventRecodePick({ i: '0' });
  expect(UI.el.ovBody.querySelector('.event-scene')).toBe(root);
  expect(document.activeElement).toBe(buttons[0]); expect(list.scrollTop).toBe(140);
  expect(buttons[0].getAttribute('aria-pressed')).toBe('true'); expect(go.disabled).toBe(true);
  UI._acts.eventRecodePick({ i: '1' });
  expect(go.disabled).toBe(false); expect(root.textContent).toContain('2/2');
  UI._acts.eventRecodePick({ i: '2' });
  expect(buttons[2].getAttribute('aria-pressed')).toBe('false');
  UI._acts.eventRecodePick({ i: '0' });
  expect(buttons[0].getAttribute('aria-pressed')).toBe('false'); expect(go.disabled).toBe(true);
  expect(root.textContent).toContain('1/2'); expect(show).not.toHaveBeenCalled();
  expect([...list.querySelectorAll('[data-act="eventRecodePick"]')]).toEqual(buttons);
});

it('离开再返回才重建候选，并保留选择且拒绝旧页面动作', async () => {
  const moves = [1, 2, 3].map(i => ({ id: `m${i}`, name: `招式${i}`, type: '武术', rarity: '古朴' }));
  H.game.ownedCards = moves.map((card, i) => ({ uid: `owned${i}`, card }));
  await openEvent('ev19-recode', moves); UI._acts.evtChoice({ i: '0' }); rollEventDice(UI);
  const first = UI.el.ovBody.querySelector('[data-act="eventRecodePick"]');
  UI._acts.eventRecodePick({ i: '0' }); const oldPick = UI._acts.eventRecodePick;
  UI.showOverlay('背包', '<main>背包</main>', 'page'); returnFromBag();
  expect(UI.el.ovBody.querySelector('[data-act="eventRecodePick"]')).not.toBe(first);
  expect(UI.el.ovBody.querySelectorAll('.picked')).toHaveLength(1);
  oldPick({ i: '1' }); expect(UI.el.ovBody.querySelectorAll('.picked')).toHaveLength(1);
  UI._acts.eventRecodePick({ i: '1' }); expect(UI.el.ovBody.querySelectorAll('.picked')).toHaveLength(2);
  UI._acts.eventRecodeGo(); rollEventDice(UI);
  expect(UI.el.ovBody.querySelector('[data-event-recode-result]')).not.toBeNull();
  expect(first.isConnected).toBe(false);
});
