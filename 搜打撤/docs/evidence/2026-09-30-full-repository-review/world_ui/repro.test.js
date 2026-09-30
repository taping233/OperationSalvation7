import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import { JSDOM } from 'jsdom';

const H = globalThis.__worldAudit = { game: {}, saves: [], cards: [], pages: [], uid: 0 };
vi.mock('../snapshot/game/src/run/game.session.js', () => ({
  game: H.game, MAP: { rules: { fireHeal: 10, fireClassCardChance: 1 }, monsters: {}, altar: { bosses: [] } }, MODES: {},
  bagCap: () => 9, usedSlots: () => 0, newUid: () => `u${++H.uid}`, pick: a => a[0],
  saveGame: () => { H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
  scaledEnemy: a => a, getActiveSlot: () => null, curLayer: () => H.game.layerData[H.game.layerIdx],
  cellCenter: () => ({}), markSeen() {}, modeCfg: () => ({}), gainCoins: n => H.game.coins += n,
  weighted: a => a[0], enterLayer() {}, exitToTitle() {},
}));
vi.mock('../snapshot/game/src/hub/game.cardslib.js', () => ({ Sfx: { tick() {}, ding() {} }, _set_cardPageOpen() {}, cardHTML: c => `<span>${c.name}</span>` }));
vi.mock('../snapshot/game/src/hub/game.hub.js', () => ({ openBaseHub() {} }));
vi.mock('../snapshot/game/src/battle/battle-loader.js', () => ({ startBattle() {}, ensureBattleReady: async () => {}, captureBattleContext: () => () => true }));
vi.mock('../snapshot/game/src/hub/extraction.commands.js', () => ({ createExtractionCommands: () => ({}), validatePendingExtraction: () => ({ ok: true }) }));
vi.mock('../snapshot/game/src/hub/recovery.commands.js', () => ({ commitBaseAndRun() {}, readSettlementReceipt() {}, recoverSlot() {} }));
vi.mock('../snapshot/game/src/home/story.commands.js', () => ({ storyCommands: {} }));
vi.mock('../snapshot/game/src/home/narrative.js', () => ({ eventNarrative: async () => null, lastLampNarrative: async () => null }));

let scenes, altar, flow, UI, takeBagReturnHook, setBagReturnHook;
beforeAll(async () => {
  window.SDT = { Icons: { rich: x => x }, Sound: { sfx() {} }, Meta: { track() {}, addXpToProgress() {} }, Base: {},
    Cards: { all: () => H.cards, isRandomObtainable: () => true, randomClassCard: () => H.cards[0], cardHTML: c => `<span>${c.name}</span>` } };
  const { overlayMethods } = await import('../snapshot/game/src/ui/overlay.js');
  UI = window.SDT.UI = { ...overlayMethods, _acts: {}, _baseActs: {}, _roomActive: true, el: {},
    act: (name, fn) => UI._acts[name] = fn, refresh() {}, log() {}, showCardReward() {}, _checkPageBg() {},
  };
  ({ takeBagReturnHook, setBagReturnHook } = await import('../snapshot/game/src/hub/bag-return-hook.js'));
  scenes = await import('../snapshot/game/src/run/game.run.scenes.js');
  altar = await import('../snapshot/game/src/run/game.run.altar.js');
  flow = await import('../snapshot/game/src/run/game.run.flow.js');
});
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el = { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') };
  UI._acts = {}; UI._overlayInerted = []; UI._lastMode = null; UI._hideTimer = null; setBagReturnHook(null);
  H.cards = [{ id: 'reward', name: '奖励牌', rarity: '职业', type: '武术' }]; H.saves = []; H.uid = 0;
  Object.assign(H.game, { state: 'idle', layerIdx: 0, trackPos: 1, hp: 1, maxHp: 35, visited: {}, ownedCards: [], usedPocket: [], myClass: '武', runActive: true, coins: 9,
    layerData: [{ logical: [{ def: { type: 'entrance' } }, { def: { type: 'fire' } }] }],
    canReceiveCard: () => true, heal: n => H.game.hp = Math.min(H.game.maxHp, H.game.hp + n),
  });
});
// Mirrors game.bag.js closeBackpack's non-chest branch, using the actual hideOverlay and actual return hook.
function closeCoveredBag() {
  UI.hideOverlay(); const hook = takeBagReturnHook(); if (hook) hook(); else H.game.state = 'idle';
}
describe('snapshot world/UI audit minimal reproductions', () => {
  it('boot-failure notice reappears after dismissal because clearInterval(this) receives Window', () => {
    vi.useFakeTimers();
    const html = fs.readFileSync('docs/evidence/2026-09-30-full-repository-review/snapshot/game/index.html', 'utf8');
    const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    const dom = new JSDOM('<body></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
    // Browser timer callbacks receive Window as `this`; route timers through fake time with that same binding.
    dom.window.setInterval = (cb, ms) => setInterval(() => cb.call(dom.window), ms);
    dom.window.clearInterval = id => clearInterval(id);
    dom.window.Date = Date;
    dom.window.eval(source);
    vi.advanceTimersByTime(12000);
    expect(dom.window.document.body.querySelector('button')).not.toBeNull();
    dom.window.document.body.querySelector('button').click();
    expect(dom.window.document.body.children).toHaveLength(0);
    vi.advanceTimersByTime(400);
    expect(dom.window.document.body.querySelector('button')).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.clearAllTimers(); vi.useRealTimers(); dom.window.close();
  });
  it('settings inbox receives the action dataset as fromTitle and returns to title', async () => {
    const { createGameMenuController } = await import('../snapshot/game/src/ui/game.menu.js');
    H.game.toggles = { index: false }; H.game.state = 'title';
    Object.assign(window.SDT.Sound, { musicVolume: 1, sfxVolume: 1 });
    const controller = createGameMenuController({ SDT: window.SDT, UI, game: H.game, runtime: { syncDevVisibility() {} }, esc: String });
    controller.openSettings();
    const open = UI.el.ovBody.querySelector('[data-act="openInbox"]');
    UI._acts.openInbox(open.dataset);
    expect(UI.el.ovBody.querySelector('[data-act="sugBack"]').title).toBe('返回（Esc）');
    UI._acts.sugBack();
    expect(H.game.state).toBe('title');
    expect(UI.el.ovBody.querySelector('[data-act="closeSettings"]')).toBeNull();
  });
  it('pickup page restored from bag has a visible but unregistered claim action', () => {
    scenes.openPickupPage('coin', '+1', () => { H.game.coins++; }, true);
    // Direct skipSearch already demonstrates the restore branch; then prove normal first opening registers it.
    expect(UI.el.ovBody.querySelector('[data-act="pickupGo"]')).not.toBeNull();
    expect(UI._acts.pickupGo).toBeUndefined();
    scenes.openPickupPage('coin', '+1', () => { H.game.coins++; });
    expect(UI._acts.pickupGo).toBeTypeOf('function');
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage');
    closeCoveredBag();
    expect(UI.el.ovBody.querySelector('[data-act="pickupGo"]')).not.toBeNull();
    expect(UI._acts.pickupGo).toBeUndefined();
  });
  it('fire rewards can be repeatedly granted by opening and closing a bag before finishing rest', () => {
    altar.openFireRest(); expect(H.game.hp).toBe(11); expect(H.game.ownedCards).toHaveLength(1);
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage'); closeCoveredBag();
    expect(H.game.state).toBe('idle'); expect(H.game.visited['0,1']).toBeUndefined();
    flow.reenterCell(); expect(H.game.hp).toBe(21); expect(H.game.ownedCards).toHaveLength(2);
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage'); closeCoveredBag();
    flow.reenterCell(); expect(H.game.hp).toBe(31); expect(H.game.ownedCards).toHaveLength(3);
    UI._acts.fireDone(); expect(H.game.visited['0,1']).toBe(1);
    expect(H.saves.at(-1).hp).toBe(31); expect(H.saves.at(-1).ownedCards).toHaveLength(3);
  });
  it('quartermaster consumes a node and payment before bag close discards the reward selection', async () => {
    H.cards = [{ id: 'ev19-quartermaster', type: '事件', name: '装备征用令' }, ...Array.from({ length: 3 }, (_, i) => ({ id: `equip${i}`, name: `装备${i}`, type: '装备', rarity: '古朴' }))];
    H.game.layerData[0].logical[1].def.type = 'event';
    await flow.runEventDeck(); UI._acts.evtChoice({ i: 0 });
    expect(H.game.coins).toBe(6); expect(H.game.visited['0,1']).toBe(1);
    expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]')).not.toBeNull();
    UI.showOverlay('背包', '<button data-act="closeBag">关闭</button>', 'bagpage'); closeCoveredBag();
    expect(H.game.state).toBe('idle'); expect(UI.el.overlay.hidden).toBe(true); expect(H.game.ownedCards).toHaveLength(0);
    flow.reenterCell(); expect(H.game.state).toBe('idle'); expect(UI.el.ovBody.querySelector('[data-act="eventCardPick"]')).toBeNull();
    expect(H.saves.at(-1).coins).toBe(6); expect(H.saves.at(-1).visited['0,1']).toBe(1);
  });
});
