// @vitest-environment jsdom
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

// Exercise the real session, renderer and overlay lifecycle, not GPU/image timing.
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: vi.fn(() => Promise.resolve(true)), hide: vi.fn(), cacheStats: () => ({}),
  play: vi.fn(), setPaused: vi.fn(), presentDeath: vi.fn(), isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
}));
window.SDT = {
  Icons: { img: () => '', rich: value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, ''), TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true, overlayIn() {} },
  MAP: { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
const { UI } = await import('../game/src/ui/ui.js');
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const piles = await import('../game/src/battle/runtime/battle.runtime.piles.js');
await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const originalRaf = window.requestAnimationFrame;
const descriptors = Object.fromEntries(['complete', 'naturalWidth', 'decode'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name)]));
const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
let rafQueue = [];
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
async function drain() {
  for (let i = 0; i < 30; i++) {
    const callback = rafQueue.shift();
    if (callback) callback(performance.now());
    await flush();
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  document.body.innerHTML = '<main id="viewport"><div id="heroAva"></div><div id="overlay" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  UI._acts = {}; UI._overlayInerted = []; UI._roomActive = false; UI.init();
  // HUD/log sinks are unrelated to the overlay lifecycle under test.
  vi.spyOn(UI, 'refresh').mockImplementation(() => {});
  vi.spyOn(UI, 'log').mockImplementation(() => {});
  Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
  Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 200 });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: () => Promise.resolve() });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: () => ({ playState: 'finished', currentTime: 9999, finished: Promise.resolve(), cancel() {} }) });
  rafQueue = [];
  window.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length; };
});
afterEach(async () => {
  clearFeedback(); BattleSession.commands.flee(); UI.hideOverlay(); await drain();
  UI._cancelPageBg?.(); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks();
  window.requestAnimationFrame = originalRaf; rafQueue = []; document.body.replaceChildren();
});
afterAll(() => {
  if (animateDescriptor) Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  else delete Element.prototype.animate;
  for (const [name, descriptor] of Object.entries(descriptors)) {
    if (descriptor) Object.defineProperty(HTMLImageElement.prototype, name, descriptor);
    else delete HTMLImageElement.prototype[name];
  }
});

async function runAttack(openRules) {
  Random.reseed(7351);
  const game = {
    ownedCards: [{ uid: 'rules-attack', card: Cards.SHA }], inventory: [],
    hp: 35, maxHp: 35, atk: 4, spellPower: 0, coins: 0, layerIdx: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'rules-foe', name: '规则结算靶', hp: 50, atk: 1 }], { isBoss: false });
  await drain();
  const scene = UI.el.ovBody.querySelector('.battle-stage');
  expect(scene.dataset.battleEntry).toBe('ready');
  const token = scene._battleToken;
  const mutations = [];
  const observer = new MutationObserver(records => mutations.push(...records));
  observer.observe(UI.el.ovBody, { childList: true, subtree: true });
  BattleSession.commands.beginCardInteraction('rules-attack', 0);
  expect(BattleSession.getSnapshot().busy).toBe(true);
  if (openRules) {
    UI._acts.btBossRules({});
    expect(UI.el.ovBody.querySelector('[data-decision-kind="rules"]')).not.toBeNull();
    expect(scene.hasAttribute('inert')).toBe(true);
    expect(scene.getAttribute('aria-hidden')).toBe('true');
    expect(BattleSession.getSnapshot().busy).toBe(true);
    // Opening Rules is UI-only: no explicit Return/Escape or engine pause follows.
  }
  await drain();
  const state = BattleSession.getSnapshot();
  expect(state.busy).toBe(false);
  expect(UI.el.ovBody.querySelector('.battle-secondary-layer')).toBeNull();
  expect(UI.el.ovBody.querySelector('.battle-stage')).toBe(scene);
  expect(scene._battleToken).toBe(token);
  expect(scene.isConnected).toBe(true);
  expect(scene.hasAttribute('inert')).toBe(false);
  expect(scene.hasAttribute('aria-hidden')).toBe(false);
  const removed = [...mutations, ...observer.takeRecords()].flatMap(record => [...record.removedNodes]);
  observer.disconnect();
  expect(removed.some(node => node === scene || node.contains?.(scene))).toBe(false);
  const outcome = { hp: game.hp, energy: state.energy, hand: [...state.hand], consumed: [...piles.consumed], played: [...piles.played],
    foes: state.foes.map(foe => ({ hp: foe.hp, alive: foe.hp > 0 })), phase: state.phase, busy: state.busy,
    rng: Random.snapshot().streams.gameplay };
  BattleSession.commands.flee(); await drain(); UI.hideOverlay();
  return outcome;
}

it('documents existing Rules dismissal on a later settlement render without changing the attack outcome', async () => {
  const control = await runAttack(false);
  const withRules = await runAttack(true);
  expect(withRules).toEqual(control);
  expect(withRules).toMatchObject({ hp: 35, energy: 1, consumed: [], played: ['rules-attack'], hand: [], foes: [{ hp: 46, alive: true }], phase: 'player', busy: false });
});
