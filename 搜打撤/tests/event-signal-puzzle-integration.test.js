import { bagSlots } from '../game/src/hub/game.bag.bridge.js';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
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
  bagSlots.organizeReward = options => openRewardCapacityOrganizer({ ...options, UI,
    readStacks:() => H.game.ownedCards.filter(o => !o.safe).map(o => ({card:o.card,uids:[o.uid],count:1})),
    canReceive:() => H.game.canReceiveCard(options.card), capacity:() => '背包 9/9 格',
    moveToSafe:stack => { H.game.ownedCards.find(o => o.uid === stack.uids[0]).safe=true; return true; },
    discardOne:() => false,
  });
  bagSlots.showBackpack = () => UI.showOverlay('背包', '<main>背包</main>', 'page');
  H.random = vi.fn(() => 0.9);
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
  const opening = flow.runEventDeck(); await vi.dynamicImportSettled();
  await vi.advanceTimersByTimeAsync(1000);
  await opening;
}
function returnFromBag() { UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) hook(); else H.game.state = 'idle'; }
const wood = { id:'tt-wood', name:'木材', type:'资源', rarity:'古朴' };
const snapshot = () => JSON.parse(JSON.stringify(H.game));
function openScreen() {
  const panel = UI.el.ovBody.querySelector('.event-signal-puzzle');
  panel.querySelector('summary').click();
  return panel;
}
function connectScreen(panel) {
  const tiles = [...panel.querySelectorAll('[data-signal-tile]')];
  // Traverse all orientations deliberately; completion still uses actual ports, never attempt count.
  for (let a = 0; a < 4 && panel.dataset.signalConnected !== 'true'; a++) {
    for (let b = 0; b < 4 && panel.dataset.signalConnected !== 'true'; b++) tiles[1].click();
    if (panel.dataset.signalConnected !== 'true') tiles[0].click();
  }
  expect(panel.dataset.signalConnected).toBe('true');
}

describe('真实无人机事件接入：纯UI与业务边界', () => {
  it('只有无人机首屏挂载，原两项奖励与确认流程不变', async () => {
    await openEvent('tt6-systemsupply', [wood]);
    expect(UI.el.ovBody.querySelectorAll('.event-signal-puzzle')).toHaveLength(1);
    expect(UI.el.ovBody.querySelector('.event-signal-puzzle').open).toBe(false);
    expect([...UI.el.ovBody.querySelectorAll('.evt-opt b')].map(el => el.textContent)).toEqual(['碎片与木材', '碎片与货币']);
    expect(UI.el.ovBody.querySelectorAll('.evt-opt')).toHaveLength(2);
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(true);
    UI._acts.eventExit(); await openEvent('tt6-mystery');
    expect(UI.el.ovBody.querySelector('.event-signal-puzzle')).toBeNull();
  });

  it.each(['skip', 'solved', 'unfinished'])('%s后领取结果完全相同，小游戏过程不改业务/RNG/保存次数', async mode => {
    await openEvent('tt6-systemsupply', [wood]);
    const before = snapshot(), randomBefore = H.random.mock.calls.length, savesBefore = H.saves.length;
    if (mode !== 'skip') {
      const panel = openScreen();
      if (mode === 'solved') connectScreen(panel);
      else panel.querySelector('[data-signal-tile]').click();
      expect(snapshot()).toEqual(before);
      expect(H.random).toHaveBeenCalledTimes(randomBefore); expect(H.saves).toHaveLength(savesBefore);
    }
    const oldChoice = UI._acts.evtChoice;
    UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="0"]').click();
    UI.el.ovBody.querySelector('.event-choice-confirm').click();
    expect(H.game.ownedCards.map(o => o.card.id)).toEqual(['tt-wood']);
    expect(H.game.fragments).toBe(1); expect(H.game.coins).toBe(18); expect(H.game.hp).toBe(1);
    expect(H.game.visited).toEqual({ '0,1':1 });
    const after = snapshot(); oldChoice({ i:'0' }); oldChoice({ i:'1' });
    expect(snapshot()).toEqual(after); expect(H.random).toHaveBeenCalledTimes(randomBefore);
  });

  it('打开/收起和Escape不会吞掉或执行原选择，原退出始终可用', async () => {
    await openEvent('tt6-systemsupply', [wood]);
    UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="1"]').click();
    const panel = openScreen(); const tile = panel.querySelector('[data-signal-tile]');
    tile.focus(); tile.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true }));
    expect(panel.open).toBe(false);
    expect(UI.el.ovBody.querySelector('.evt-opt.is-selected').dataset.i).toBe('1');
    expect(UI.el.ovBody.querySelector('.event-choice-confirm').disabled).toBe(false);
    expect(H.game.fragments).toBe(0);
    panel.querySelector('summary').click(); UI._acts.evtReturn(); await vi.advanceTimersByTimeAsync(400);
    expect(H.game.state).toBe('idle'); expect(UI.el.overlay.hidden).toBe(true); expect(H.game.visited).toEqual({});
  });

  it('普通背包往返保留未解线路和奖励选择，旧控件不影响新页', async () => {
    await openEvent('tt6-systemsupply', [wood]);
    UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="1"]').click();
    const panel = openScreen(), old = panel.querySelector('[data-signal-tile="0"]'); old.click();
    const turns = [...panel.querySelectorAll('[data-signal-tile]')].map(el => el.dataset.rotation);
    UI._acts.evtBag(); returnFromBag();
    const next = UI.el.ovBody.querySelector('.event-signal-puzzle');
    expect(next).not.toBe(panel); expect(next.open).toBe(true);
    expect([...next.querySelectorAll('[data-signal-tile]')].map(el => el.dataset.rotation)).toEqual(turns);
    expect(UI.el.ovBody.querySelector('.evt-opt.is-selected').dataset.i).toBe('1');
    old.click(); expect([...next.querySelectorAll('[data-signal-tile]')].map(el => el.dataset.rotation)).toEqual(turns);
    UI.el.ovBody.querySelector('.event-choice-confirm').click();
    expect(H.game.fragments).toBe(1); expect(H.game.coins).toBe(20); expect(H.game.ownedCards).toEqual([]);
  });

  it('满包整理返回保留完成展示，原互斥奖励仍幂等领取', async () => {
    H.game.canReceiveCard = () => false;
    await openEvent('tt6-systemsupply', [wood]);
    expect(UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="0"]').dataset.optionState).toBe('limited');
    expect(UI.el.ovBody.textContent).toContain('选择后可整理背包');
    const panel = openScreen(); connectScreen(panel);
    UI._acts.evtChoice({ i:'0' });
    expect(UI.el.ovBody.textContent).toContain('待领取：木材');
    expect(H.game.fragments).toBe(0); expect(H.game.visited).toEqual({});
    H.game.canReceiveCard = () => true;
    UI.el.ovBody.querySelector('[data-organize=return]').click();
    expect(UI.el.ovBody.querySelector('[data-act=evtChoice][data-i="0"]').dataset.optionState).toBe('ready');
    expect(UI.el.ovBody.textContent).toContain('背包可容纳本次奖励');
    const next = UI.el.ovBody.querySelector('.event-signal-puzzle');
    expect(next.dataset.signalConnected).toBe('true'); expect(next.classList.contains('signal-just-connected')).toBe(false);
    UI._acts.evtChoice({ i:'1' });
    expect(H.game.fragments).toBe(1); expect(H.game.coins).toBe(20); expect(H.game.ownedCards).toEqual([]);
  });
});
