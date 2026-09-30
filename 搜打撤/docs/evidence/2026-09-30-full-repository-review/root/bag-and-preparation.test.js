// Audit evidence: assertions intentionally confirm observed defects.
import { readFileSync } from 'node:fs';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
document.body.innerHTML = readFileSync('docs/evidence/2026-09-30-full-repository-review/snapshot/game/index.html', 'utf8');
window.SDT = { Icons: { img: () => '', rich: value => String(value), TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../snapshot/game/src/cards/cards.js');
await import('../snapshot/game/src/ui/ui.js');
await import('../snapshot/game/src/hub/base.js');
const session = await import('../snapshot/game/src/run/game.session.js');
const { game } = session;
const { UI, Base, Cards } = window.SDT;
UI.init();
UI.log = vi.fn(); UI.refresh = () => {};
Cards.cardHTML = card => `<span>${card.name}</span>`;
Cards.cardBackHTML = () => '';
const { showBackpack } = await import('../snapshot/game/src/hub/game.bag.js');
const { bagSlots } = await import('../snapshot/game/src/hub/game.bag.bridge.js');
const departure = await import('../snapshot/game/src/hub/game.hub.depart.js');
const { createHubPreparationFeature } = await import('../snapshot/game/src/hub/game.hub.preparation.js');
const scenes = await import('../snapshot/game/src/run/game.run.scenes.js');
const altar = await import('../snapshot/game/src/run/game.run.altar.js');
const flow = await import('../snapshot/game/src/run/game.run.flow.js');
const { setBagReturnHook } = await import('../snapshot/game/src/hub/bag-return-hook.js');
const card = { id: 'test-card', name: '测试招式', type: '武术', rarity: '稀有' };
const entries = (count, c = card, flags = {}) => Array.from({ length: count }, (_, n) => ({ uid: `${c.id}-${n}`, card: { ...c }, ...flags }));
beforeEach(() => {
  localStorage.clear(); Base.use(1); session._set_active_slot(null);
  Object.assign(game, { runActive: true, state: 'idle', myClass: '战士', inventory: [], ownedCards: [],
    usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, nestActive: false, hp: 20, maxHp: 30, elapsed: 0, elapsedSynced: 0 });
  window.SDT.Chests = { isOpen: () => false };
  UI.hideOverlay({ immediate: true });
  setBagReturnHook(null);
});
afterEach(() => vi.restoreAllMocks());

it('R-HUB-01: applying a preset clears its actual departure selection', async () => {
  let intent;
  const snapshot = { stash: [{ card, count: 2 }], characters: {}, pets: {}, goals: { presets: {
    'preset-1': { name: '猛攻', picks: [{ card: { cardId: card.id }, count: 2 }] } } } };
  Base.data.stash = structuredClone(snapshot.stash);
  const feature = createHubPreparationFeature({
    data: { readBase: () => ({ ok: true, value: snapshot, revision: 0 }), readBaseReceipt: () => ({ ok: true, value: null }),
      commitBase: vi.fn(), slotId: () => 1, cardCatalog: () => [card], characters: () => [], pets: () => [], bagCapacity: () => 16 },
    view: { openPanel: () => ({ isConnected: true }), buildModel: value => value,
      mount: (_root, options) => { intent = options.onIntent; return { dispose() {}, update() {} }; } },
    navigation: { applyPicks: departure.setDeployPick, openDeparture: departure.openDepartPrep, returnToBase() {} },
    reportError: vi.fn(), formatError: value => value.message, requestId: () => 'audit-preset',
  });
  feature.open(); await intent({ type: 'preset-apply', payload: { presetId: 'preset-1' } });
  console.log('R-HUB-01', JSON.stringify({ actualPicks: departure.deployPick, selectedBagCount: departure.deploySlotsUsed() }));
  expect(departure.deployPick).toEqual({});
  expect(departure.deploySlotsUsed()).toBe(1);
});

it('R-BAG-01: whole-name movement exceeds safe stack capacity', () => {
  game.ownedCards = entries(9);
  expect(session.safeUsed()).toBe(0);
  bagSlots.moveStackSafe(card.name, true);
  console.log('R-BAG-01', JSON.stringify({ safeUsed: session.safeUsed(), safeCap: session.safeCap(), safeCards: game.ownedCards.filter(o => o.safe).length }));
  expect(session.safeUsed()).toBe(3);
  expect(session.safeUsed()).toBeGreaterThan(session.safeCap());
  expect(game.ownedCards.filter(o => o.safe)).toHaveLength(9);
});

it('R-BAG-02: pearl withdrawal releases several slots after checking only one', () => {
  const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '装备', rarity: '稀有' };
  const resource = { id: 'test-resource', name: '测试资源', type: '资源', rarity: '稀有' };
  const currency = { id: 'test-currency', name: '测试货币', type: '资源', rarity: '稀有' };
  game.ownedCards = [...entries(1, pearl), ...entries(9, resource, { stored: 1 }),
    ...entries(69, currency)];
  expect(session.usedSlots()).toBe(24); expect(session.bagCap()).toBe(25);
  showBackpack(true);
  UI._acts.inspectStack({ name: pearl.name, safe: '0' });
  UI._acts.pearlStoreZoom();
  UI._acts.pearlTake({ name: resource.name });
  console.log('R-BAG-02', JSON.stringify({ usedSlots: session.usedSlots(), bagCap: session.bagCap() }));
  expect(session.usedSlots()).toBe(27);
  expect(session.usedSlots()).toBeGreaterThan(session.bagCap());
});

it('R-BAG-03: pouch whole-stack deposit exceeds three-card limit', () => {
  const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
  const spellA = { id: 'spell-a', name: '法术甲', type: '法术', rarity: '稀有' };
  const spellB = { id: 'spell-b', name: '法术乙', type: '法术', rarity: '稀有' };
  game.ownedCards = [...entries(1, pouch), ...entries(2, spellA, { stored: 1, pouchOf: pouch.id }), ...entries(3, spellB)];
  showBackpack(true); UI._acts.inspectStack({ name: pouch.name, safe: '0' }); UI._acts.pouchStoreZoom();
  UI._acts.pouchPut({ name: spellB.name });
  const stored = game.ownedCards.filter(o => o.pouchOf === pouch.id).length;
  console.log('R-BAG-03', JSON.stringify({ stored, limit: 3 }));
  expect(stored).toBe(5);
});

it('parent verifies WORLD-001 with the real bag close callback and overlay actions', () => {
  const onDone = vi.fn();
  scenes.openPickupPage('coin', '+1', onDone);
  expect(UI._acts.pickupGo).toBeTypeOf('function');
  showBackpack(true);
  bagSlots.closeBackpack();
  const button = document.querySelector('[data-act="pickupGo"]');
  expect(button).not.toBeNull();
  button.click();
  console.log('WORLD-001-parent', JSON.stringify({ visibleClaimButton: true, registered: typeof UI._acts.pickupGo, claimCalls: onDone.mock.calls.length }));
  expect(UI._acts.pickupGo).toBeUndefined();
  expect(onDone).not.toHaveBeenCalled();
});

it('parent verifies WORLD-002 with actual bag close and actual reenterCell', () => {
  session.buildDerived('parent-world-audit');
  game.layerIdx = 0; game.trackPos = game.layerData[0].entrances[0];
  game.layerData[0].logical[game.trackPos].def.type = 'fire';
  game.visited = {}; game.hp = 1; game.maxHp = 100;
  UI.showCardReward = () => {}; // cosmetic reward animation is not part of the state check
  const key = `0,${game.trackPos}`;
  const expected = 1 + session.MAP.rules.fireHeal * 3;
  altar.openFireRest();
  showBackpack(true); bagSlots.closeBackpack();
  expect(game.state).toBe('idle'); expect(game.visited[key]).toBeUndefined();
  flow.reenterCell();
  showBackpack(true); bagSlots.closeBackpack();
  flow.reenterCell();
  console.log('WORLD-002-parent', JSON.stringify({ hp: game.hp, expectedRepeatedHp: expected, visited: game.visited[key] ?? null }));
  expect(game.hp).toBe(expected);
  expect(game.visited[key]).toBeUndefined();
});

it('R-BAG-04: safe pearl box rescues unsafe pouch spells from another container', async () => {
  const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '装备', rarity: '稀有' };
  const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
  const spell = { id: 'stored-spell', name: '锦囊里的法术', type: '法术', rarity: '稀有' };
  game.hp = 0;
  game.ownedCards = [...entries(1, pearl, { safe: true }), ...entries(1, pouch),
    ...entries(2, spell, { stored: 1, pouchOf: pouch.id })];
  await session.doDeath();
  const rescued = Base.data.stash.map(stack => ({ name: stack.card.name, count: stack.count }));
  console.log('R-BAG-04', JSON.stringify({ rescued, safeCards: 1, pouchSafe: false }));
  expect(rescued).toContainEqual({ name: spell.name, count: 2 });
  expect(rescued).not.toContainEqual({ name: pouch.name, count: 1 });
});
