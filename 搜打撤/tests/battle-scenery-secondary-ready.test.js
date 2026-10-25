import { battleViewMocks } from './helpers/environment-fixtures.js';
import { afterAll, afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  attach: vi.fn(() => Promise.resolve(false)), hide: vi.fn(), cacheStats: () => ({}),
  play: vi.fn(), setPaused: vi.fn(), presentDeath: vi.fn(), isLiveBattleFigure: () => false, actionImpactRemaining: () => null,
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
  UI, ...battleViewMocks(rich, true, 2, 8, 5, 5),
};
const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
const imageDescriptors = Object.fromEntries(['complete', 'naturalWidth', 'decode'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name)]));
Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 200 });

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
await import('../game/src/battle/view/battle.view.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');

let rafQueue = [];
const originalRaf = window.requestAnimationFrame;
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const stage = () => body.querySelector('.battle-stage');
const scenery = () => [overlay.querySelector('.battle-scene-world'), overlay.querySelector('.battle-scene-foreground')];
function expectPaintedScenery() {
  const [world, front] = scenery();
  expect(world?.hidden).toBe(false); expect(front?.hidden).toBe(false);
  expect([...world.querySelectorAll('.battle-scene-layer')].map(image => image.className)).toEqual([
    'battle-scene-layer scene-far', 'battle-scene-layer scene-ground',
  ]);
  expect(stage().classList.contains('has-painted-scenery')).toBe(true);
  return [world, front];
}
function frame() {
  const callback = rafQueue.shift();
  if (!callback) throw new Error('Expected a queued battle render');
  callback(performance.now());
}
function start(ownedCards = [], { layerIdx = 0, isBoss = false } = {}) {
  const game = {
    ownedCards, inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0, layerIdx,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'entry-foe', name: '入场回归靶子', hp: 50, atk: 1 }], { isBoss, directBossStart:isBoss }); frame();
  return game;
}
beforeEach(() => {
  vi.clearAllMocks(); frames.attach.mockResolvedValue(false); rafQueue = [];
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => ({ playState: 'finished', currentTime: 9999, finished: Promise.resolve(), cancel() {} })) });
  Object.defineProperty(HTMLImageElement.prototype, 'decode', { configurable: true, value: vi.fn(() => Promise.resolve()) });
  window.requestAnimationFrame = callback => { rafQueue.push(callback); return rafQueue.length; };
});
afterEach(async () => {
  clearFeedback(); BattleSession.commands.flee(); UI.hideOverlay(); actions.clear();
  while (rafQueue.length) frame();
  await flush(); rafQueue = [];
  window.requestAnimationFrame = originalRaf;
  vi.restoreAllMocks(); vi.useRealTimers();
});
afterAll(() => {
  if (animateDescriptor) Object.defineProperty(Element.prototype, 'animate', animateDescriptor);
  else delete Element.prototype.animate;
  for (const [name, descriptor] of Object.entries(imageDescriptors)) {
    if (descriptor) Object.defineProperty(HTMLImageElement.prototype, name, descriptor);
    else delete HTMLImageElement.prototype[name];
  }
});



it.each([false, true])('handles delayed scenery under a restarted infusion panel (decode failure: %s)', async fail => {
  frames.attach.mockResolvedValue(true);
  start(); await flush();
  const oldStage = stage();
  const background = deferred();
  const failure = new Error('real scene decode failure');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  HTMLImageElement.prototype.decode.mockImplementation(function () {
    return background.promise.then(() => { if (fail && this.classList.contains('scene-ground')) throw failure; });
  });
  const storm = Cards.all().find(card => card.id === 'tt3sp-bloodstorm');
  start([{ uid: 'delayed-storm', card: storm }, ...[1, 2].map(index => ({ uid: `delayed-fuel-${index}`, card: Cards.SHA }))]);
  await flush();
  const currentStage = stage(), pendingScenery = scenery();
  expect(currentStage).not.toBe(oldStage);
  expect(pendingScenery.every(image => image.hidden)).toBe(true);
  BattleSession.commands.beginInfusion('delayed-storm');
  while (rafQueue.length) { frame(); await flush(); }
  expect(BattleSession.getSnapshot().infusing).toBeTruthy();
  expect(body.querySelector('[data-infusion-workspace]')).not.toBeNull();
  expect(stage()).toBe(currentStage);
  expect(UI._lastMode).toBe('battle');
  background.resolve(); await flush();
  if (fail) {
    expect(pendingScenery.every(image => image.hidden)).toBe(true);
    expect(currentStage.dataset.battleEntry).toBe('waiting');
    expect(overlay.querySelector('.battle-entry-status').textContent).toContain('部分画面资源加载失败');
    expect(warning).toHaveBeenCalledWith('[battle:scenery] painted layer unavailable', failure);
  } else {
    expect(expectPaintedScenery()).toEqual(pendingScenery);
    expect(currentStage.dataset.battleEntry).toBe('ready');
    expect(overlay.querySelector('.battle-entry-status')).toBeNull();
    expect(warning).not.toHaveBeenCalled();
  }
});


it('does not revive departed scenery when its decode finishes under a newer panel', async () => {
  frames.attach.mockResolvedValue(true);
  const background = deferred();
  HTMLImageElement.prototype.decode.mockReturnValue(background.promise);
  start(); await flush();
  const oldStage = stage(), oldScenery = scenery();
  HTMLImageElement.prototype.decode.mockResolvedValue();
  const storm = Cards.all().find(card => card.id === 'tt3sp-bloodstorm');
  start([{ uid: 'new-storm', card: storm }]); await flush();
  BattleSession.commands.beginInfusion('new-storm');
  while (rafQueue.length) { frame(); await flush(); }
  const currentStage = stage(), currentScenery = expectPaintedScenery();
  expect(currentStage._battleToken).not.toBe(oldStage._battleToken);
  background.resolve(); await flush();
  expect(expectPaintedScenery()).toEqual(currentScenery);
  expect(oldScenery.every(image => !image.isConnected && image.hidden)).toBe(true);
  expect(currentStage.dataset.battleEntry).toBe('ready');
  expect(overlay.querySelector('.battle-entry-status')).toBeNull();
});
