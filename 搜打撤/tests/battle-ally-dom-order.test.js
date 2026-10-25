import { battleViewMocks, overlayElements, frameMocks, inventoryFields, mountBattleRoot } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js', () => ({
  createBattleEntryGate: () => ({ begin() {}, wait() {}, cancel() {}, dispose() {}, pending: () => false, ready: () => true }),
  waitForBattleImages: () => ({ promise: Promise.resolve(true), cancel() {} }),
}));
vi.mock('../game/src/battle/view/battle.frames.js', () => ({
  ...frameMocks(),
}));
const rich = value => String(value || '').replace(/\[\[icon:[^\]]+\]\]/g, '');
const UI = {
  el: {}, _lastMode: null, hideTooltip() {}, showTooltip() {}, refresh() {}, log() {}, act() {},
  showOverlay(title, html, mode, options = {}) {
    this._overlayRevision = (this._overlayRevision || 0) + 1;
    if (options.battleBody) { if (!options.battleBody(rich(html))) return; }
    else this.el.ovBody.innerHTML = rich(html); this.el.overlay.hidden = false; this._lastMode = mode; },
  hideOverlay() { this.el.overlay.hidden = true; document.dispatchEvent(new Event('sdt-overlay-close')); },
};
window.SDT = {
  UI, ...battleViewMocks(rich, true, 9, 99, 5, 5),
};
await import('../game/src/cards/cards.js');
const { BattleSession, commands } = await import('../game/src/battle/core/battle.core.js');
const Runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { render } = await import('../game/src/battle/view/battle.view.js');
const { mountUnitLayer, updateUnits } = await import('../game/src/battle/view/battle.layers.js');
const { clearFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
const catalog = Cards.all();
let game, frames;
const originalAnimate = Element.prototype.animate;
const ally = (name, extra = {}) => ({ name, atk: 4, hp: 4, maxHp: 4, dead: false, status: {}, defense: {}, ...extra });
const mount = () => UI.el.ovBody.querySelector('[data-unit-mount="allies"]');
const nodes = () => [...mount().children];
function expectSameNodes(actual, expected) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((node, index) => {
    expect(node).toBe(expected[index]);
    expect(node.parentElement).toBe(mount());
    expect(node.isConnected).toBe(true);
  });
}
function flush() { const pending = frames; frames = []; pending.forEach(callback => callback(performance.now())); }
async function settle() {
  for (let i = 0; i < 400; i++) {
    flush(); await new Promise(resolve => setTimeout(resolve, 5));
    if (!Runtime.busy && !BattleSession.getSnapshot().actionQueueLength && !frames.length) return;
  }
  throw new Error('Battle did not settle');
}
async function start(ids = ['tt3-bandage']) {
  game = {
    ownedCards: ids.map((id, i) => ({ uid: `ally-card-${i}`, card: structuredClone(catalog.find(card => card.id === id)) })),
    ...inventoryFields(60, 80, 1, '法师'), log() {}, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {},
  };
  window.SDT.game = game;
  BattleSession.start(game, [{ id: 'ally-target', name: '训练靶', hp: 120, atk: 3 }], { isBoss: false });
  await settle();
}
function paint(allies) {
  const snapshot = { ...BattleSession.getSnapshot(), allies };
  updateUnits(mountUnitLayer(UI.el.ovBody, snapshot.battleToken), snapshot, {});
  return nodes();
}
function observeMoves(target = mount()) {
  const append = vi.spyOn(target, 'appendChild');
  const observer = new MutationObserver(() => {});
  observer.observe(target, { childList: true });
  return {
    counts: () => ({ appendChildCalls: append.mock.calls.length, childListRecords: observer.takeRecords().length }),
    close() { observer.disconnect(); append.mockRestore(); },
  };
}
beforeEach(() => {
  frames = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.push(callback); return frames.length; });
  mountBattleRoot();
  UI.el = { ...overlayElements() };
  UI._lastMode = null;
});
afterEach(async () => {
  clearFeedback();
  if (game?.battleActive) { commands.flee(); await settle(); }
  UI.hideOverlay(); frames = []; Element.prototype.animate = originalAnimate; vi.restoreAllMocks();
});

it('keeps real summoned allies in place through unchanged, energy and busy renders', async () => {
  await start(['tt7-recruit', 'tt7-recruit', 'tt3-bandage']);
  for (const entry of game.ownedCards.filter(entry => entry.card.id === 'tt7-recruit')) {
    expect(commands.submitCardPlay(entry.uid, 'self', true).status).toBe('queued');
    await settle();
  }
  expect(BattleSession.getSnapshot().allies).toHaveLength(4);
  const kept = nodes(), moves = observeMoves();
  expect(kept).toHaveLength(4);
  render(); Runtime.set$energy(0); render(); Runtime.set$busy(true); render(); Runtime.set$busy(false); render();
  expectSameNodes(nodes(), kept);
  expect(moves.counts()).toEqual({ appendChildCalls: 0, childListRecords: 0 });
  moves.close();
});

it('performs zero ally moves across 100 unchanged production unit updates', async () => {
  await start();
  const allies = Array.from({ length: 4 }, () => ally('封印肢体', { statless: true, hp: null, maxHp: null, atk: 0 }));
  const kept = paint(allies), moves = observeMoves();
  for (let i = 0; i < 100; i++) paint(allies);
  expectSameNodes(nodes(), kept);
  expect(moves.counts()).toEqual({ appendChildCalls: 0, childListRecords: 0 });
  moves.close();
});

it('uses the original append-all fallback for additions and keeps survivors on removal', async () => {
  await start();
  const a = ally('步兵'), b = ally('射手'), c = ally('守卫');
  const [first] = paint([a]), moves = observeMoves();
  const expanded = paint([a, b, c]);
  expect(expanded[0]).toBe(first);
  expect(moves.counts().appendChildCalls).toBe(3);
  moves.close();
  const [middle] = paint([b]);
  expect(middle).toBe(expanded[1]);
  expect(expanded[0].isConnected).toBe(false); expect(expanded[2].isConnected).toBe(false);
});

it('keeps occurrence-based identities for duplicate names and updates their indexes', async () => {
  await start();
  const a = ally('步兵'), b = ally('射手');
  const [a1, a2, b1] = paint([a, a, b]);
  expectSameNodes(paint([b, a, a]), [b1, a1, a2]);
  expect(nodes().map(node => node.dataset.allyI)).toEqual(['0', '1', '2']);
  expectSameNodes(paint([a, b]), [a1, b1]); expect(a2.isConnected).toBe(false);
});

it('fully restores reverse order rather than conditionally appending each index', async () => {
  await start();
  const a = ally('步兵'), b = ally('射手'), c = ally('守卫');
  const [first, middle, last] = paint([a, b, c]), moves = observeMoves();
  expectSameNodes(paint([c, b, a]), [last, middle, first]);
  expect(moves.counts().appendChildCalls).toBe(3);
  moves.close();
});

it('repairs externally displaced DOM nodes even when names and count are unchanged', async () => {
  await start();
  const allies = [ally('步兵'), ally('射手'), ally('守卫')], original = paint(allies);
  mount().prepend(original[2]);
  const moves = observeMoves();
  expectSameNodes(paint(allies), original);
  expect(moves.counts().appendChildCalls).toBe(3);
  moves.close();
});

it('updates HP, death and statless presentation without moving retained allies', async () => {
  await start();
  const living = ally('步兵'), object = ally('封印肢体', { statless: true, hp: null, maxHp: null, atk: 0 });
  const kept = paint([living, object]), moves = observeMoves();
  expectSameNodes(paint([{ ...living, hp: 1, atk: 7 }, object]), kept);
  expect(kept[0].querySelector('.sts-hp span').textContent).toBe('1/4');
  expect(kept[0].querySelector('.sts-stats').textContent).toContain('攻 7');
  paint([{ ...living, hp: 0, dead: true }, object]);
  expect(kept[0].classList.contains('dead')).toBe(true);
  expect(kept[0].querySelector('.sts-hp span').textContent).toBe('0/4');
  expect(kept[1].querySelector('.sts-unit-vitals').hidden).toBe(true);
  expect(moves.counts()).toEqual({ appendChildCalls: 0, childListRecords: 0 });
  moves.close();
});

it('clears an empty list and does not retain removed-node ownership', async () => {
  await start();
  const allies = [ally('步兵'), ally('射手')], old = paint(allies);
  expect(paint([])).toEqual([]); expect(mount().style.display).toBe('none');
  expect(old.every(node => !node.isConnected)).toBe(true);
  const moves = observeMoves(); paint([]);
  expect(moves.counts()).toEqual({ appendChildCalls: 0, childListRecords: 0 }); moves.close();
  const fresh = paint(allies);
  expect(fresh.every(node => !old.includes(node))).toBe(true); expect(mount().style.display).toBe('');
});

it('reattaches retained allies into a replacement mount and abandons the old owner', async () => {
  await start();
  const allies = [ally('步兵'), ally('射手')], kept = paint(allies), oldMount = mount();
  const replacement = oldMount.cloneNode(false); oldMount.replaceWith(replacement);
  expect(kept.every(node => !node.isConnected)).toBe(true);
  const moves = observeMoves(replacement);
  expectSameNodes(paint(allies), kept);
  expect(kept.every(node => node.parentElement === replacement)).toBe(true);
  expect(oldMount.children).toHaveLength(0);
  expect(moves.counts().appendChildCalls).toBe(2); moves.close();
});

it('keeps the same allies across a retained deck overlay and its return', async () => {
  await start();
  Runtime.set$allies([ally('步兵'), ally('射手')]); render();
  const kept = nodes(), owner = mount(), moves = observeMoves();
  Runtime.set$viewingDeck(true); render();
  expect(UI.el.ovBody.querySelector('.battle-secondary-layer')).not.toBeNull();
  expectSameNodes(nodes(), kept);
  Runtime.set$viewingDeck(false); render();
  expectSameNodes(nodes(), kept); expect(mount()).toBe(owner);
  expect(moves.counts()).toEqual({ appendChildCalls: 0, childListRecords: 0 }); moves.close();
});

it('resets ally ownership for a new battle token even with identical names and count', async () => {
  await start();
  const allies = [ally('步兵'), ally('步兵')], old = paint(allies), oldToken = BattleSession.getSnapshot().battleToken;
  commands.flee(); await settle(); await start();
  expect(BattleSession.getSnapshot().battleToken).not.toBe(oldToken);
  const fresh = paint(allies);
  expect(fresh.every(node => !old.includes(node))).toBe(true);
  expect(old.every(node => !node.isConnected)).toBe(true);
  expect(fresh.every(node => node.parentElement === mount())).toBe(true);
});
