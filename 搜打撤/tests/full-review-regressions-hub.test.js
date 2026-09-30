// 09-30 全仓深审 ROOT 组（背包/整备/死亡抢运）修复回归。发现来源：
// docs/evidence/2026-09-30-full-repository-review/root/findings.json，
// 复现手法沿用其 bag-and-preparation.test.js，断言反转成修复后行为。
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
document.body.innerHTML = readFileSync('game/index.html', 'utf8');
window.SDT = { Icons: { img: () => '', rich: value => String(value), TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../game/src/cards/cards.js');
await import('../game/src/ui/ui.js');
await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { game } = session;
const { UI, Base, Cards } = window.SDT;
UI.init();
UI.log = vi.fn(); UI.refresh = () => {};
Cards.cardHTML = card => `<span>${card.name}</span>`;
Cards.cardBackHTML = () => '';
const { showBackpack } = await import('../game/src/hub/game.bag.js');
const { bagSlots } = await import('../game/src/hub/game.bag.bridge.js');
const departure = await import('../game/src/hub/game.hub.depart.js');
const { createHubPreparationFeature } = await import('../game/src/hub/game.hub.preparation.js');
const card = { id: 'test-card', name: '测试招式', type: '武术', rarity: '稀有' };
const entries = (count, c = card, flags = {}) => Array.from({ length: count }, (_, n) => ({ uid: `${c.id}-${n}`, card: { ...c }, ...flags }));

beforeEach(() => {
  localStorage.clear(); Base.use(1); session._set_active_slot(null);
  Object.assign(game, { runActive: true, state: 'idle', myClass: '战士', inventory: [], ownedCards: [],
    usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null, terminalPending: null,
    battleActive: false, nestActive: false, hp: 20, maxHp: 30, elapsed: 0, elapsedSynced: 0 });
  window.SDT.Chests = { isOpen: () => false };
  UI.hideOverlay({ immediate: true });
});

it('ROOT-01 预设应用：整备页保留刚注入的预设选择（不再清空）', async () => {
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
    reportError: vi.fn(), formatError: value => value.message, requestId: () => 'regress-preset',
  });
  feature.open();
  await intent({ type: 'preset-apply', payload: { presetId: 'preset-1' } });
  expect(departure.deployPick).toEqual({ [card.name]: 2 });   // 此前被 openDepartPrep 清成 {}
});

it('ROOT-02 同名整堆入安全格：按格数增量拒收（9 张 > 2 格容量）', () => {
  game.ownedCards = entries(9);
  expect(session.safeCap()).toBe(2);
  bagSlots.moveStackSafe(card.name, true);
  expect(game.ownedCards.filter(o => o.safe)).toHaveLength(0);   // 此前 9 张全部越过 2 格容量
  expect(session.safeUsed()).toBe(0);
});

it('ROOT-02 反向：容量内的整堆移动仍然放行（4 张同名恰好 2 格）', () => {
  game.ownedCards = entries(4);
  bagSlots.moveStackSafe(card.name, true);
  expect(game.ownedCards.filter(o => o.safe)).toHaveLength(4);
  expect(session.safeUsed()).toBe(2);
});

it('ROOT-03 珍珠盒整叠取出：背包放不下整叠所需格数时拒收', () => {
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
  expect(session.usedSlots()).toBe(24);   // 此前越界到 27/25
  expect(game.ownedCards.filter(o => o.stored)).toHaveLength(9);   // 整叠仍在珍珠盒
});

it('ROOT-04 锦囊整叠存入：已有 2 张 + 整叠 3 张被拒收（3 张上限）', () => {
  const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
  const spellA = { id: 'spell-a', name: '法术甲', type: '法术', rarity: '稀有' };
  const spellB = { id: 'spell-b', name: '法术乙', type: '法术', rarity: '稀有' };
  game.ownedCards = [...entries(1, pouch), ...entries(2, spellA, { stored: 1, pouchOf: pouch.id }), ...entries(3, spellB)];
  showBackpack(true); UI._acts.inspectStack({ name: pouch.name, safe: '0' }); UI._acts.pouchStoreZoom();
  UI._acts.pouchPut({ name: spellB.name });
  expect(game.ownedCards.filter(o => o.pouchOf === pouch.id)).toHaveLength(2);   // 此前越界到 5/3
});

it('ROOT-05 死亡抢运：不安全锦囊里的法术随锦囊一起丢失（不再被珍珠盒错误带回）', async () => {
  const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '装备', rarity: '稀有' };
  const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
  const spell = { id: 'stored-spell', name: '锦囊里的法术', type: '法术', rarity: '稀有' };
  game.hp = 0;
  game.ownedCards = [...entries(1, pearl, { safe: true }), ...entries(1, pouch),
    ...entries(2, spell, { stored: 1, pouchOf: pouch.id })];
  await session.doDeath();
  const rescued = Base.data.stash.map(stack => ({ name: stack.card.name, count: stack.count }));
  expect(rescued).toContainEqual({ name: pearl.name, count: 1 });        // 盒本身在安全格，正常带回
  expect(rescued).not.toContainEqual({ name: spell.name, count: 2 });    // 此前被错误抢运
  expect(rescued).not.toContainEqual({ name: pouch.name, count: 1 });
});
