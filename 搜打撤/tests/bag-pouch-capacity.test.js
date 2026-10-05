import { readFileSync } from 'node:fs';
import { beforeAll, beforeEach, afterEach, expect, it, vi } from 'vitest';

let session, game, showBackpack, UI;
const pouch = { id: 'tt7-stratagem', name: '法师锦囊', type: '武术', rarity: '稀有' };
const spell = { id: 'capacity-spell', name: '容量法术', type: '法术', rarity: '稀有' };
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '武术', rarity: '稀有' };

beforeAll(async () => {
  document.body.innerHTML = readFileSync('game/index.html', 'utf8');
  window.SDT = { Icons: { img: () => '', rich: String, TYPE_ART: {} },
    Sound: { music() {}, sfx: vi.fn(), setDucked() {} }, FX: { feedback() {} } };
  await import('../game/src/cards/cards.js');
  await import('../game/src/ui/ui.js');
  await import('../game/src/hub/base.js');
  session = await import('../game/src/run/game.session.js');
  ({ showBackpack } = await import('../game/src/hub/game.bag.js'));
  game = session.game;
  UI = window.SDT.UI;
  UI.init(); UI.log = vi.fn(); UI.refresh = () => {};
  window.SDT.Cards.cardHTML = c => `<span>${c.name}</span>`;
  window.SDT.Cards.cardBackHTML = () => '';
  vi.spyOn(window.SDT.Base, 'bagCap').mockReturnValue(16);
  window.SDT.Chests = { isOpen: () => false };
  session._set_active_slot(null);
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(game, { runActive: true, state: 'idle', myClass: '法师', inventory: [],
    usedPocket: [], cardOrder: [], pendingExtraction: null, extractionPending: null,
    terminalPending: null, battleActive: false, nestActive: false, hp: 20, maxHp: 30,
    elapsed: 0, elapsedSynced: 0 });
});
afterEach(() => UI.hideOverlay({ immediate: true }));

function arrange(occupied, bagCopies = 0, storedCopies = 3, withPearl = false) {
  game.ownedCards = [{ uid: 'pouch', card: pouch },
    ...(withPearl ? [{ uid: 'pearl', card: pearl }] : []),
    ...Array.from({ length: bagCopies }, (_, i) => ({ uid: `bag${i}`, card: spell })),
    ...Array.from({ length: storedCopies }, (_, i) => ({ uid: `stored${i}`, card: spell, stored: 1, pouchOf: pouch.id }))];
  const cardSlots = session.cardStacks(false).length;
  game.inventory = Array.from({ length: occupied - cardSlots }, (_, i) => ({ name: `物资${i}`, value: 1, count: 1 }));
  expect(session.usedSlots()).toBe(occupied);
  showBackpack(true);
  UI._acts.inspectStack({ name: pouch.name, safe: '0' });
  UI._acts.pouchStoreZoom();
}
function take() { UI._acts.pouchTake({ name: spell.name }); }

it.each([0, 3])('满包整叠取出拒绝且锦囊与物资原样保留（已有同名 %i 张）', bagCopies => {
  arrange(16, bagCopies);
  const cards = JSON.stringify(game.ownedCards), items = JSON.stringify(game.inventory);
  take();
  expect(session.usedSlots()).toBe(16);
  expect(JSON.stringify(game.ownedCards)).toBe(cards);
  expect(JSON.stringify(game.inventory)).toBe(items);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('背包放不下'), 'warn');
});
it('正好一个空格可取出整叠，保留卡牌总数及物资', () => {
  arrange(15);
  const count = game.ownedCards.length, items = JSON.stringify(game.inventory);
  take();
  expect(session.usedSlots()).toBe(16);
  expect(game.ownedCards).toHaveLength(count);
  expect(game.ownedCards.filter(o => o.pouchOf || o.stored)).toHaveLength(0);
  expect(JSON.stringify(game.inventory)).toBe(items);
});
it('满包同名叠放还有余位时允许无新增格的取出', () => {
  arrange(16, 1, 2);
  take();
  expect(session.usedSlots()).toBe(16);
  expect(game.ownedCards.filter(o => o.card.id === spell.id && !o.stored)).toHaveLength(3);
});
it('珍珠盒有空扩格也不能让法术占用资源专属格', () => {
  arrange(16, 0, 3, true);
  expect(session.bagCap()).toBe(25);
  const before = JSON.stringify(game.ownedCards);
  take();
  expect(session.usedSlots()).toBe(16);
  expect(JSON.stringify(game.ownedCards)).toBe(before);
  expect(UI.log).toHaveBeenLastCalledWith(expect.stringContaining('珍珠盒额外格仅收资源卡'), 'warn');
});
