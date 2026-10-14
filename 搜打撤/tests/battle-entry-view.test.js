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
const animateDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
const imageDescriptors = Object.fromEntries(['complete', 'naturalWidth', 'decode'].map(name => [name, Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, name)]));
Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => true });
Object.defineProperty(HTMLImageElement.prototype, 'naturalWidth', { configurable: true, get: () => 200 });

await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { Random } = await import('../game/src/core/random.js');
const battlePiles = await import('../game/src/battle/runtime/battle.runtime.piles.js');
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
  expect(world?.querySelectorAll('.battle-scene-layer')).toHaveLength(3);
  expect(stage().classList.contains('has-painted-scenery')).toBe(true);
  return [world, front];
}
function frame() {
  const callback = rafQueue.shift();
  if (!callback) throw new Error('Expected a queued battle render');
  callback(performance.now());
}
function start(ownedCards = []) {
  const game = {
    ownedCards, inventory: [], hp: 50, maxHp: 50, atk: 4, spellPower: 0, coins: 0,
    myClass: null, characterId: null, state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(String(message)); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'entry-foe', name: '入场回归靶子', hp: 50, atk: 1 }], { isBoss: false }); frame();
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

it('preserves decoded winter scenery through simplified entry and rerenders, restoring it on modal return without retrying GPU frames', async () => {
  start(); await flush();
  expect(stage().dataset.battleEntry).toBe('waiting'); expect(frames.attach).toHaveBeenCalledTimes(1);
  const firstScenery = expectPaintedScenery();
  overlay.querySelector('.battle-entry-curtain button').click();
  const firstStage = stage(), token = firstStage._battleToken, note = firstStage.querySelector('.battle-entry-note');
  expect(firstStage.dataset.battleEntry).toBe('degraded'); expect(frames.hide).toHaveBeenCalledTimes(1);
  expect(expectPaintedScenery()).toEqual(firstScenery);
  const firstDecodeCount = HTMLImageElement.prototype.decode.mock.calls.length;
  BattleSession.commands.setPendingHint('entry-rerender'); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(stage().querySelector('.battle-entry-note')).toBe(note);
  expect(frames.attach).toHaveBeenCalledTimes(1); expect(expectPaintedScenery()).toEqual(firstScenery);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(firstDecodeCount);
  BattleSession.commands.openGrave(); frame(); await flush(); expect(stage()).toBeNull();
  expect(scenery()).toEqual([null, null]);
  BattleSession.commands.closeGrave(); frame(); await flush();
  expect(stage()).not.toBe(firstStage); expect(stage()._battleToken).toBe(token);
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).not.toBe(true);
  expect(stage().querySelectorAll('.battle-entry-note')).toHaveLength(1);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  const restoredScenery = expectPaintedScenery();
  expect(restoredScenery[0]).not.toBe(firstScenery[0]); expect(restoredScenery[1]).not.toBe(firstScenery[1]);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(firstDecodeCount + 4);
  expect(frames.attach).toHaveBeenCalledTimes(1);
  start(); await flush();
  expect(stage()._battleToken).not.toBe(token); expect(stage().dataset.battleEntry).toBe('waiting');
  expect(stage().querySelector('.battle-entry-note')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(2);
});

it('keeps truly failed winter scenery hidden and reports the failure while simplified combat remains available', async () => {
  const failedDecode = new Error('winter mid layer decode failed');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  HTMLImageElement.prototype.decode.mockImplementation(function () {
    return this.classList.contains('scene-mid') ? Promise.reject(failedDecode) : Promise.resolve();
  });
  start(); await flush();
  expect(stage().dataset.battleEntry).toBe('waiting');
  expect(overlay.querySelector('.battle-entry-curtain').textContent).toContain('部分战场资源加载失败');
  expect(warning).toHaveBeenCalledWith('[battle:scenery] painted layer unavailable', failedDecode);
  const failedScenery = scenery();
  expect(failedScenery.every(image => image.hidden)).toBe(true);
  expect(stage().classList.contains('has-painted-scenery')).toBe(false);
  overlay.querySelector('.battle-entry-curtain button').click();
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).toBe(false);
  expect(stage().querySelector('.battle-entry-note').textContent).toContain('简化显示');
  BattleSession.commands.setPendingHint('failed-scenery-rerender'); frame(); await flush();
  expect(scenery()).toEqual(failedScenery); expect(failedScenery.every(image => image.hidden)).toBe(true);
  expect(stage().classList.contains('has-painted-scenery')).toBe(false);
  expect(frames.attach).toHaveBeenCalledTimes(1);
});

it('allows late decoded scenery after an explicit timeout fallback without undoing the simplified choice', async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  const background = deferred();
  HTMLImageElement.prototype.decode.mockReturnValue(background.promise);
  start(); await flush();
  const pendingScenery = scenery();
  expect(pendingScenery.every(image => image.hidden)).toBe(true);
  await vi.advanceTimersByTimeAsync(8000);
  expect(stage().dataset.battleEntry).toBe('waiting');
  overlay.querySelector('.battle-entry-curtain button').click();
  const note = stage().querySelector('.battle-entry-note');
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).toBe(false);
  background.resolve(); await flush();
  expect(expectPaintedScenery()).toEqual(pendingScenery);
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().querySelector('.battle-entry-note')).toBe(note);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(1);
});

it('ignores a departed battle background decode when the next battle already owns its scenery', async () => {
  const background = deferred();
  HTMLImageElement.prototype.decode.mockReturnValue(background.promise);
  start(); await flush();
  const oldStage = stage(), oldScenery = scenery();
  HTMLImageElement.prototype.decode.mockResolvedValue();
  start(); await flush();
  const currentScenery = expectPaintedScenery();
  expect(stage()._battleToken).not.toBe(oldStage._battleToken);
  expect(oldScenery.every(image => !image.isConnected && image.hidden)).toBe(true);
  overlay.querySelector('.battle-entry-curtain button').click();
  background.resolve(); await flush();
  expect(expectPaintedScenery()).toEqual(currentScenery);
  expect(oldScenery.every(image => !image.isConnected && image.hidden)).toBe(true);
  expect(stage().dataset.battleEntry).toBe('degraded');
  expect(overlay.querySelectorAll('.battle-scene-world')).toHaveLength(1);
  expect(overlay.querySelectorAll('.battle-scene-foreground')).toHaveLength(1);
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

it.each(['ready', 'degraded'])('holds actual payment and all three hits until the returned stage is %s', async result => {
  frames.attach.mockResolvedValue(true);
  const grudge = Cards.all().find(card => card.id === 'tt7-thundergrudge');
  expect(grudge?.name).toBe('快意恩仇');
  start([{ uid: 'ready-payment-source', card: grudge }, ...[1, 2].map(index => ({ uid: `ready-payment-fuel-${index}`, card: Cards.SHA })), { uid: 'ready-extra-attack', card: Cards.SHA }]); await flush();
  const firstStage = stage(), token = firstStage._battleToken;
  BattleSession.commands.beginCardInteraction('ready-payment-source', 0); frame(); await flush();
  expect(stage()).toBeNull(); expect(body.textContent).toContain('支付代价');
  const fuel = BattleSession.getSnapshot().hand.filter(uid => uid !== 'ready-payment-source').slice(0, 2);
  BattleSession.commands.pickHandSelect(fuel[0]); frame(); await flush();
  const actor = deferred(); frames.attach.mockReturnValue(actor.promise);
  const randomBefore = Random.snapshot();
  BattleSession.commands.pickHandSelect(fuel[1]); await flush();
  const restored = stage(), waiting = BattleSession.getSnapshot();
  expect(restored).not.toBe(firstStage); expect(restored._battleToken).toBe(token);
  expect(restored.dataset.battleEntry).toBe('loading'); expect(restored.inert).toBe(true);
  expect(waiting).toMatchObject({ busy: true, phase: 'resolving', energy: 2 });
  expect(battlePiles.consumed).toEqual([]); expect(waiting.foes[0].hp).toBe(50);
  expect(Random.snapshot().streams.gameplay).toBe(randomBefore.streams.gameplay);
  const curtain = overlay.querySelector('.battle-entry-curtain');
  expect(curtain).not.toBeNull(); expect(curtain.querySelector('button').hidden).toBe(true);
  const restoredDecodeCount = HTMLImageElement.prototype.decode.mock.calls.length;
  frame(); await flush();
  expect(stage()).toBe(restored); expect(overlay.querySelector('.battle-entry-curtain')).toBe(curtain);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(restoredDecodeCount);
  actor.resolve(result === 'ready'); await flush();
  if (result === 'degraded') {
    expect(restored.dataset.battleEntry).toBe('waiting'); expect(restored.inert).toBe(true);
    expect(BattleSession.getSnapshot().energy).toBe(2);
    const fallback = curtain.querySelector('button'); expect(fallback.hidden).toBe(false);
    fallback.click(); await flush();
  }
  for (let i = 0; i < 30; i++) { if (rafQueue.length) frame(); await flush(); }
  const settled = BattleSession.getSnapshot();
  expect(settled.energy).toBe(1); expect(battlePiles.consumed).toEqual(fuel);
  expect(settled.foes[0].hp).toBe(38); expect(settled.busy).toBe(false);
  expect(stage().dataset.battleEntry).toBe(result); expect(stage()._battleToken).toBe(token);
  expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  if (result === 'degraded') expect(frames.attach).toHaveBeenCalledTimes(2);
  const readyDecodeCount = HTMLImageElement.prototype.decode.mock.calls.length;
  BattleSession.commands.beginCardInteraction('ready-extra-attack', 0); await flush();
  expect(stage()).toBe(restored); expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  for (let i = 0; i < 20; i++) { if (rafQueue.length) frame(); await flush(); }
  expect(BattleSession.getSnapshot()).toMatchObject({ busy: false, energy: 0 });
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(34);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(readyDecodeCount);
});

it('cancels an actual payment action on departure without charging or reviving it after late readiness', async () => {
  frames.attach.mockResolvedValue(true);
  const grudge = Cards.all().find(card => card.id === 'tt7-thundergrudge');
  const game = start([{ uid: 'cancel-payment-source', card: grudge }, ...[1, 2].map(index => ({ uid: `cancel-payment-fuel-${index}`, card: Cards.SHA }))]); await flush();
  BattleSession.commands.beginCardInteraction('cancel-payment-source', 0); frame(); await flush();
  const fuel = BattleSession.getSnapshot().hand.filter(uid => uid !== 'cancel-payment-source').slice(0, 2);
  BattleSession.commands.pickHandSelect(fuel[0]); frame(); await flush();
  const actor = deferred(); frames.attach.mockReturnValue(actor.promise);
  BattleSession.commands.pickHandSelect(fuel[1]); await flush();
  expect(BattleSession.getSnapshot().energy).toBe(2);
  UI.hideOverlay(); await flush();
  expect(BattleSession.getSnapshot()).toMatchObject({ busy: false, energy: 2 }); expect(overlay.querySelector('.battle-entry-curtain')).toBeNull();
  actor.resolve(true); await flush();
  while (rafQueue.length) frame(); await flush();
  expect(game.logs.some(log => log.includes('作为出牌代价'))).toBe(false);
  expect(overlay.hidden).toBe(true);
});
