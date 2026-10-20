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

it('preserves decoded winter scenery through simplified entry and rerenders, retaining it beneath modal views without retrying GPU frames', async () => {
  start(); await flush();
  expect(stage().dataset.battleEntry).toBe('waiting'); expect(frames.attach).toHaveBeenCalledTimes(1);
  const firstScenery = expectPaintedScenery();
  overlay.querySelector('.battle-entry-status button').click();
  const firstStage = stage(), token = firstStage._battleToken, note = firstStage.querySelector('.battle-entry-note');
  expect(firstStage.dataset.battleEntry).toBe('degraded'); expect(frames.hide).toHaveBeenCalledTimes(1);
  expect(expectPaintedScenery()).toEqual(firstScenery);
  const firstDecodeCount = HTMLImageElement.prototype.decode.mock.calls.length;
  BattleSession.commands.setPendingHint('entry-rerender'); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(stage().querySelector('.battle-entry-note')).toBe(note);
  expect(frames.attach).toHaveBeenCalledTimes(1); expect(expectPaintedScenery()).toEqual(firstScenery);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(firstDecodeCount);
  BattleSession.commands.openGrave(); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(firstStage.hasAttribute('inert')).toBe(true);
  expect(firstStage.getAttribute('aria-hidden')).toBe('true'); expect(scenery()).toEqual(firstScenery);
  BattleSession.commands.closeGrave(); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(stage()._battleToken).toBe(token);
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).not.toBe(true);
  expect(stage().querySelectorAll('.battle-entry-note')).toHaveLength(1);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull();
  const restoredScenery = expectPaintedScenery();
  expect(restoredScenery).toEqual(firstScenery);
  expect(firstStage.hasAttribute('inert')).toBe(false); expect(firstStage.hasAttribute('aria-hidden')).toBe(false);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(firstDecodeCount);
  expect(frames.attach).toHaveBeenCalledTimes(1);
  start(); await flush();
  expect(stage()._battleToken).not.toBe(token); expect(stage().dataset.battleEntry).toBe('waiting');
  expect(stage().querySelector('.battle-entry-note')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(2);
});

it('keeps folded hand names synchronized with their printed faces and intent in the same enemy HUD group', async () => {
  frames.attach.mockResolvedValue(true); start([{ uid: 'folded-hand-source', card: Cards.SHA }]); await flush();
  const cards = [...stage().querySelectorAll('.sts-hand .bt-card')];
  expect(cards.length).toBeGreaterThan(0);
  cards.forEach(card => {
    expect(card.querySelector('.bt-rest-name')).toBeNull();
    expect(card.querySelector('.hsc-name')?.textContent).toBeTruthy();
    expect(card.parentElement.dataset.act).toBe('btPlay');
    expect(card.parentElement.dataset.uid).toBe(card.dataset.uid);
    expect(card.parentElement.style.getPropertyValue('--hand-rest')).toBe('64px');
  });
  const foe = stage().querySelector('.sts-foe');
  const intent = foe.querySelector('.sts-intent');
  expect(intent.parentElement).toBe(foe.querySelector('.sts-nameplate'));
  expect(intent.getAttribute('role')).toBe('button');
  expect(intent.getAttribute('aria-label')).toContain('入场回归靶子的意图');
  intent.click();
  expect(intent.classList.contains('is-open')).toBe(true);
  expect(BattleSession.getSnapshot().pendingTarget).toBeFalsy();
  BattleSession.commands.setPendingHint('folded-name-rerender'); frame(); await flush();
  expect(stage().querySelector('.sts-hand .bt-card')).toBe(cards[0]);
  expect(stage().querySelector('.sts-intent')).toBe(intent);
  expect(intent.classList.contains('is-open')).toBe(true);
});

it('keeps truly failed winter scenery hidden and reports the failure while simplified combat remains available', async () => {
  const failedDecode = new Error('winter ground layer decode failed');
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  HTMLImageElement.prototype.decode.mockImplementation(function () {
    return this.classList.contains('scene-ground') ? Promise.reject(failedDecode) : Promise.resolve();
  });
  start(); await flush();
  expect(stage().dataset.battleEntry).toBe('waiting');
  expect(overlay.querySelector('.battle-entry-status').textContent).toContain('部分画面资源加载失败');
  expect(warning).toHaveBeenCalledWith('[battle:scenery] painted layer unavailable', failedDecode);
  const failedScenery = scenery();
  expect(failedScenery.every(image => image.hidden)).toBe(true);
  expect(stage().classList.contains('has-painted-scenery')).toBe(false);
  overlay.querySelector('.battle-entry-status button').click();
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
  overlay.querySelector('.battle-entry-status button').click();
  const note = stage().querySelector('.battle-entry-note');
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().inert).toBe(false);
  background.resolve(); await flush();
  expect(expectPaintedScenery()).toEqual(pendingScenery);
  expect(stage().dataset.battleEntry).toBe('degraded'); expect(stage().querySelector('.battle-entry-note')).toBe(note);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(frames.attach).toHaveBeenCalledTimes(1);
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
  overlay.querySelector('.battle-entry-status button').click();
  background.resolve(); await flush();
  expect(expectPaintedScenery()).toEqual(currentScenery);
  expect(oldScenery.every(image => !image.isConnected && image.hidden)).toBe(true);
  expect(stage().dataset.battleEntry).toBe('degraded');
  expect(overlay.querySelectorAll('.battle-scene-world')).toHaveLength(1);
  expect(overlay.querySelectorAll('.battle-scene-foreground')).toHaveLength(1);
});

it('retains completed ready entry and the same presentation on modal return', async () => {
  frames.attach.mockResolvedValue(true); start(); await flush();
  const firstStage = stage(), token = firstStage._battleToken;
  expect(firstStage.dataset.battleEntry).toBe('ready'); expect(frames.attach).toHaveBeenCalledTimes(1);
  BattleSession.commands.openGrave(); frame(); await flush();
  BattleSession.commands.closeGrave(); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(stage()._battleToken).toBe(token);
  expect(stage().dataset.battleEntry).toBe('ready'); expect(overlay.querySelector('.battle-entry-status')).toBeNull();
  expect(frames.attach).toHaveBeenCalledTimes(3);
  expect(frames.attach.mock.calls.every(([target]) => target === body)).toBe(true);
  expect(firstStage.hasAttribute('inert')).toBe(false); expect(firstStage.hasAttribute('aria-hidden')).toBe(false);
  expect(overlay.querySelector('.battle-scene-world')).not.toBeNull();
});

it.each(['ready', 'degraded'])('keeps the %s stage during payment and charges once only after both choices', async result => {
  frames.attach.mockResolvedValue(result === 'ready');
  const grudge = Cards.all().find(card => card.id === 'tt7-thundergrudge');
  expect(grudge?.name).toBe('快意恩仇');
  start([{ uid: 'ready-payment-source', card: grudge }, ...[1, 2].map(index => ({ uid: `ready-payment-fuel-${index}`, card: Cards.SHA })), { uid: 'ready-extra-attack', card: Cards.SHA }]); await flush();
  if (result === 'degraded') overlay.querySelector('.battle-entry-status button').click();
  const firstStage = stage(), token = firstStage._battleToken, firstScenery = scenery();
  const decodeCount = HTMLImageElement.prototype.decode.mock.calls.length;
  BattleSession.commands.beginCardInteraction('ready-payment-source', 0); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(body.textContent).toContain('支付代价');
  expect(firstStage.hasAttribute('inert')).toBe(true); expect(firstStage.getAttribute('aria-hidden')).toBe('true');
  expect(scenery()).toEqual(firstScenery);
  const fuel = BattleSession.getSnapshot().hand.filter(uid => uid !== 'ready-payment-source').slice(0, 2);
  const randomBefore = Random.snapshot();
  BattleSession.commands.pickHandSelect(fuel[0]); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(firstStage.hasAttribute('inert')).toBe(true);
  expect(BattleSession.getSnapshot()).toMatchObject({ energy: 2 });
  expect(battlePiles.consumed).toEqual([]); expect(BattleSession.getSnapshot().foes[0].hp).toBe(50);
  expect(Random.snapshot().streams.gameplay).toBe(randomBefore.streams.gameplay);
  BattleSession.commands.pickHandSelect(fuel[1]); await flush();
  for (let i = 0; i < 30; i++) { if (rafQueue.length) frame(); await flush(); }
  const settled = BattleSession.getSnapshot();
  expect(settled.energy).toBe(1); expect(battlePiles.consumed).toEqual(fuel);
  expect(settled.foes[0].hp).toBe(38); expect(settled.busy).toBe(false);
  expect(stage()).toBe(firstStage); expect(stage().dataset.battleEntry).toBe(result); expect(stage()._battleToken).toBe(token);
  expect(firstStage.hasAttribute('inert')).toBe(false); expect(firstStage.hasAttribute('aria-hidden')).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull(); expect(scenery()).toEqual(firstScenery);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(decodeCount);
  BattleSession.commands.beginCardInteraction('ready-extra-attack', 0); await flush();
  for (let i = 0; i < 20; i++) { if (rafQueue.length) frame(); await flush(); }
  expect(BattleSession.getSnapshot()).toMatchObject({ busy: false, energy: 0 });
  expect(BattleSession.getSnapshot().foes[0].hp).toBe(34);
  expect(stage()).toBe(firstStage); expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(decodeCount);
});

it('cleans up the retained stage on real departure without charging an incomplete payment', async () => {
  frames.attach.mockResolvedValue(true);
  const grudge = Cards.all().find(card => card.id === 'tt7-thundergrudge');
  const game = start([{ uid: 'cancel-payment-source', card: grudge }, ...[1, 2].map(index => ({ uid: `cancel-payment-fuel-${index}`, card: Cards.SHA }))]); await flush();
  const firstStage = stage(), firstScenery = scenery();
  BattleSession.commands.beginCardInteraction('cancel-payment-source', 0); frame(); await flush();
  const fuel = BattleSession.getSnapshot().hand.filter(uid => uid !== 'cancel-payment-source').slice(0, 2);
  BattleSession.commands.pickHandSelect(fuel[0]); frame(); await flush();
  expect(stage()).toBe(firstStage); expect(firstStage.hasAttribute('inert')).toBe(true);
  expect(BattleSession.getSnapshot().energy).toBe(2); expect(battlePiles.consumed).toEqual([]);
  BattleSession.commands.flee(); UI.showOverlay('地图', '', 'map'); await flush();
  while (rafQueue.length) frame(); await flush();
  expect(stage()).toBeNull(); expect(scenery()).toEqual([null, null]);
  expect(firstStage.isConnected).toBe(false); expect(firstScenery.every(node => !node.isConnected)).toBe(true);
  expect(game.logs.some(log => log.includes('作为出牌代价'))).toBe(false);
  expect(overlay.querySelector('.battle-entry-status')).toBeNull();
});

it.each([[1,'winter-platform-minimal'],[2,'winter-platform-minimal'],[3,'winter-platform-minimal']])('mounts one decoded scene on layer %s and keeps it across rendering and modal return', async (layerIdx,key) => {
  const game=start([], {layerIdx}); await flush();
  expect(stage().dataset.sceneryKey).toBe(key);
  const world=overlay.querySelector('.battle-scene-world');
  expect(world.hidden).toBe(false);expect(world.querySelectorAll('.battle-scene-layer')).toHaveLength(2);
  expect(world.querySelector('.scene-static')).toBeNull();expect(overlay.querySelector('.battle-scene-foreground')).not.toBeNull();
  const decoded=HTMLImageElement.prototype.decode.mock.calls.length;
  game.layerIdx=0;BattleSession.commands.setPendingHint('static-render');frame();await flush();
  expect(overlay.querySelector('.battle-scene-world')).toBe(world);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(decoded);
  const retained = stage();
  BattleSession.commands.openGrave();frame();await flush();
  expect(stage()).toBe(retained); expect(retained.hasAttribute('inert')).toBe(true);
  expect(overlay.querySelector('.battle-scene-world')).toBe(world);
  BattleSession.commands.closeGrave();frame();await flush();
  expect(stage()).toBe(retained); expect(retained.hasAttribute('inert')).toBe(false);
  expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(decoded);
  expect(stage().dataset.sceneryKey).toBe(key);
  expect(overlay.querySelectorAll('.battle-scene-layer')).toHaveLength(2);
  expect(overlay.querySelector('.battle-scene-foreground')).not.toBeNull();
});

it('does not let a late decoded static scene reveal itself in a newer boss battle', async () => {
  const oldDecode=deferred();
  HTMLImageElement.prototype.decode.mockReturnValue(oldDecode.promise);
  start([], {layerIdx:2});await flush();const oldWorld=overlay.querySelector('.battle-scene-world');
  expect(oldWorld.hidden).toBe(true);
  HTMLImageElement.prototype.decode.mockResolvedValue();
  start([], {layerIdx:0,isBoss:true});await flush();
  const current=overlay.querySelector('.battle-scene-world');
  expect(stage().dataset.sceneryKey).toBe('winter-platform-minimal');expect(current.hidden).toBe(false);
  expect(oldWorld.isConnected).toBe(false);
  oldDecode.resolve();await flush();
  expect(oldWorld.hidden).toBe(true);expect(overlay.querySelector('.battle-scene-world')).toBe(current);
  expect(overlay.querySelector('.battle-scene-foreground')).not.toBeNull();
});
