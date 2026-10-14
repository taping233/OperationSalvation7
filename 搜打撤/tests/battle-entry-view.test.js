import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: vi.fn(() => Promise.resolve(false)), hide: vi.fn(), cacheStats: () => ({}),
  play: vi.fn(), setPaused: vi.fn(), presentDeath: vi.fn(), isLiveBattleFigure: () => false,
}));
const frames = await import('../game/src/battle/view/battle.frames.js');

const overlay = document.createElement('div'); overlay.id = 'overlay'; overlay.hidden = true;
overlay.innerHTML = '<h2 id="ovTitle"></h2><div id="ovBody"></div>'; document.body.appendChild(overlay);
const body = overlay.querySelector('#ovBody'), actions = new Map();
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: { overlay, ovBody: body, ovTitle: overlay.querySelector('#ovTitle') }, _lastMode: null,
  showOverlay(title, html, mode) {
    body.innerHTML = rich(html); overlay.hidden = false; this._lastMode = mode;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: mode }));
  },
  hideOverlay() { overlay.hidden = true; document.dispatchEvent(new CustomEvent('sdt-overlay-close')); },
  hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act(name, fn) { actions.set(name, fn); },
};
window.SDT = {
  UI, Icons: { img: () => '', rich, TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  Art: { has: () => false, monsterArt: () => '', classArt: () => '', cutoutFigures() {}, decodeIn() {}, warm() {}, collectCardAssets: () => [] },
  Meta: { track() {} }, Motion: { reduceMotion: () => true },
  MAP: { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1 }, items: {} },
};
const imageDescriptors = Object.fromEntries(['complete', 'naturalWidth'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name)]));
Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 200 });

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');

let rafQueue = [];
const originalRaf = window.requestAnimationFrame;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const stage = () => body.querySelector('.battle-stage');
function frame() {
  const callback = rafQueue.shift();
  if (!callback) throw new Error('Expected a queued battle render');
  callback(performance.now());
}
function start() {
  const game = {
    ownedCards: [], inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'entry-foe', name: '入场回归靶子', hp: 50, atk: 1 }], { isBoss: false }); frame();
}
beforeEach(() => {
  vi.clearAllMocks(); frames.attach.mockResolvedValue(false); rafQueue = [];
  window.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length; };
});
afterEach(() => {
  clearFeedback(); BattleSession.commands.flee(); UI.hideOverlay(); actions.clear(); rafQueue = [];
  window.requestAnimationFrame = originalRaf;
});
afterAll(() => {
  for (const [name, descriptor] of Object.entries(imageDescriptors)) Object.defineProperty(HTMLImageElement.prototype, name, descriptor);
});

it('preserves simplified entry through a live rerender and a reconstructed modal return without retrying frames or scenery', async () => {
  start(); await flush();
  expect(stage().dataset.battleEntry).toBe('waiting'); expect(frames.attach).toHaveBeenCalledTimes(1);
  overlay.querySelector('.battle-entry-curtain button').click();
  const firstStage = stage(), token = firstStage._battleToken, note = firstStage.querySelector('.battle-entry-note');
  expect(firstStage.dataset.battleEntry).toBe('degraded'); expect(frames.hide).toHaveBeenCalledTimes(1);
  BattleSession.commands.setPendingHint('entry-rerender'); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(stage().querySelector('.battle-entry-note')).toBe(note);
  expect(frames.attach).toHaveBeenCalledTimes(1); expect(overlay.querySelector('.battle-scene-world')).toBeNull();
  BattleSession.commands.openGrave(); frame(); await flush(); expect(stage()).toBeNull();
  BattleSession.commands.closeGrave(); frame(); await flush();
  expect(stage()).not.toBe(firstStage); expect(stage()._battleToken).toBe(token);
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).not.toBe(true);
  expect(stage().querySelectorAll('.battle-entry-note')).toHaveLength(1);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  expect(overlay.querySelector('.battle-scene-world')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(1);
  start(); await flush();
  expect(stage()._battleToken).not.toBe(token); expect(stage().dataset.battleEntry).toBe('waiting');
  expect(stage().querySelector('.battle-entry-note')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(2);
});

it('retains completed ready entry on modal return while rebuilding the full presentation', async () => {
  frames.attach.mockResolvedValue(true); start(); await flush();
  const firstStage = stage(), token = firstStage._battleToken;
  expect(firstStage.dataset.battleEntry).toBe('ready'); expect(frames.attach).toHaveBeenCalledTimes(1);
  BattleSession.commands.openGrave(); frame(); await flush();
  BattleSession.commands.closeGrave(); frame(); await flush();
  expect(stage()).not.toBe(firstStage); expect(stage()._battleToken).toBe(token);
  expect(stage().dataset.battleEntry).toBe('ready'); expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  expect(frames.attach).toHaveBeenCalledTimes(2); expect(overlay.querySelector('.battle-scene-world')).not.toBeNull();
});
