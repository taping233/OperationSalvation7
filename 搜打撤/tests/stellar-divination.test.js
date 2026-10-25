import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createBattleDiscoverFlow } from '../game/src/battle/effects/battle.discover-flow.js';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(99, 8, 15, 0, 0, 0) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const { createBattleDraw } = await import('../game/src/battle/core/battle.draw.js');
const { drawCards, queueCardExecution, findCard } = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const card = () => ({ id: 'stellar-test', name: '星光测试', type: '法术', rarity: '普通', cost: 3, desc: '造成3点法术伤害。', _castOnDraw: true });
const canonical = id => { const result = C.all().find(c => c.id === id); expect(result).toBeTruthy(); return result; };
function start() {
  const game = { ownedCards: [], ...playerFields(100, 100, 5, 0, '战士', null), logs: [], log(message) { this.logs.push(message); },
    heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'foe', name: '靶', hp: 100, atk: 0 }], { isBoss: false });
  R.set$mode('boss');
  R.set$drawPile([]); // 该文件隔离BOSS发现/抽牌，不混入普通入口的99临时库。
  R.set$energy(0);
  return game;
}
function put(cardValue, uid = 'stellar-copy') {
  R.granted.push({ uid, card: structuredClone(cardValue) });
  R.drawPile.push(uid);
  return uid;
}
async function settle() { await vi.advanceTimersByTimeAsync(1000); expect(R.busy).toBe(false); }
beforeEach(() => { vi.useFakeTimers(); R.set$lastDeckSel([]); R.set$allSpellsInfused(false); });
afterEach(() => { vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers(); });

it('stellar discovery gives an independent original and two deep copies, then shuffles once', () => {
  const original = { ...card(), rules: { triggers: { onPlay: [{ op: 'draw', n: 1 }] } } };
  delete original._castOnDraw;
  const hand = [], deck = [], jobs = [{ n: 1, explicit: [original], act: 'stellarCopies' }];
  let state = null;
  const shuffleDeck = vi.fn();
  const flow = createBattleDiscoverFlow({
    cards: { all: () => [original], isRandomObtainable: () => true, sellPrice: () => 1,
      addTempCard: value => { hand.push(value); return 'original'; },
      addDeckCard: value => { deck.push(value); return `copy-${deck.length}`; },
      findByUid: () => null, queueCardExecution: vi.fn(), fireCatGift: vi.fn() },
    interaction: { getJobs: () => jobs, get: () => state, set: value => { state = value; }, requestRender: vi.fn() },
    random: { next: () => 0 },
    battle: { currentClass: () => '战士', firstAliveTarget: () => null, hasAliveFoes: () => true, sweepDead: vi.fn(), finishVictory: vi.fn() },
    effects: { shuffleDeck }, output: { log: vi.fn() },
  });
  flow.processDiscoverQueue(); flow.pickDiscover(0); flow.pickDiscover(0);
  expect(hand).toHaveLength(1); expect(deck).toHaveLength(2); expect(shuffleDeck).toHaveBeenCalledTimes(1);
  expect(hand[0]._castOnDraw).toBeUndefined(); expect(deck.every(copy => copy._castOnDraw)).toBe(true);
  deck[0].rules.triggers.onPlay[0].n = 7;
  expect(deck[1].rules.triggers.onPlay[0].n).toBe(1);
  expect(hand[0].rules.triggers.onPlay[0].n).toBe(1);
  expect(original.rules.triggers.onPlay[0].n).toBe(1);
});

it.each([false, true])('drawn copies cast at zero energy and never enter hand, full=%s', async full => {
  start(); if (full) R.set$hand(Array.from({ length: 8 }, (_, i) => `filler-${i}`));
  const uid = put(card()); const before = R.hand.slice();
  expect(drawCards(1)).toBe(1); await settle();
  expect(R.hand).toEqual(before); expect(R.lastDrawnUids).not.toContain(uid);
  expect(R.foes[0].hp).toBe(97); expect(R.energy).toBe(0);
  expect(R.discard.filter(value => value === uid)).toHaveLength(1);
});

it('a consumed draw-cast copy is not automatically recycled by later empty draws', async () => {
  start(); R.set$drawPile([]); const uid = put(card());
  expect(drawCards(1)).toBe(1); await settle();
  for (let i = 0; i < 2; i++) expect(drawCards(1)).toBe(0);
  expect(R.hand).not.toContain(uid); expect(R.drawPile).not.toContain(uid);
  expect(R.discard.filter(value => value === uid)).toHaveLength(1);
  expect(R.foes[0].hp).toBe(97);
});

it('a free draw cast still requires infusion and preserves the uncast copy', async () => {
  const game = start(); const source = canonical('tt12-raydragon'); const uid = put({ ...source, _castOnDraw: true });
  expect(drawCards(1)).toBe(1); await settle();
  expect(R.hand).toContain(uid); expect(R.discard).not.toContain(uid); expect(R.foes[0].hp).toBe(100);
  expect(game.logs.some(message => message.includes('保留在手牌中'))).toBe(true);
  expect(source._noInfuse).toBeUndefined();
});

it('two draw-cast discoveries preserve both nested choices and do not retain their source copies', async () => {
  start(); const source = canonical('tt12-magicfind'); const option = { ...card(), id: 'nested-option', cost: 1, _castOnDraw: undefined };
  vi.spyOn(C, 'all').mockReturnValue([option]);
  const first = put({ ...source, _castOnDraw: true }, 'nested-first');
  const second = put({ ...source, _castOnDraw: true }, 'nested-second');
  expect(drawCards(2)).toBe(2); await settle(); expect(R.discovering).toBeTruthy();
  BattleSession.commands.pickDiscover(0); await settle(); expect(R.discovering).toBeTruthy();
  BattleSession.commands.pickDiscover(0); await settle(); expect(R.discovering).toBeNull();
  expect(R.hand).not.toContain(first); expect(R.hand).not.toContain(second);
  expect(R.granted.filter(entry => entry.card.id === option.id)).toHaveLength(2);
});


it('canonical stellar divination keeps the chosen spell and shuffles two draw-cast copies', async () => {
  start(); const source = canonical('tt13-stellar-divination');
  const option = { ...card(), cost: 1 }; delete option._castOnDraw;
  vi.spyOn(C, 'all').mockReturnValue([option]);
  const uid = put(source, 'stellar-source'); R.drawPile.pop(); R.hand.push(uid); R.set$energy(1);
  BattleSession.commands.playCard(uid, 'self'); await settle();
  expect(R.discovering).toMatchObject({ act: 'copyToDeck', copies: 2, castOnDraw: true });
  BattleSession.commands.pickDiscover(0); await settle();
  const generated = R.granted.filter(entry => entry.card.id === option.id);
  expect(generated).toHaveLength(3);
  expect(generated.filter(entry => R.hand.includes(entry.uid))).toHaveLength(1);
  const copies = generated.filter(entry => entry.card._castOnDraw);
  expect(copies).toHaveLength(2);
  expect(copies.every(entry => R.drawPile.includes(entry.uid))).toBe(true);
  // Discarded source stays outside the draw batch; only the two shuffled copies are drawn.
  expect(drawCards(2)).toBe(2); await settle();
  expect(copies.every(entry => !R.hand.includes(entry.uid))).toBe(true);
  expect(R.foes[0].hp).toBe(94); expect(R.energy).toBe(0);
  expect(option._castOnDraw).toBeUndefined();
});


it('type-targeted deck draw also releases a copy through the queue despite a full hand', async () => {
  start(); R.set$hand(Array.from({ length: 8 }, (_, i) => `filler-${i}`));
  const uid = put(card());
  const flow = createBattleDraw({ R: () => window.SDT.MAP.rules, alive: () => R.foes.filter(foe => !foe.dead), findCard, queueCardExecution, checkSealTransformation() {} });
  expect(flow.deckDraw({ n: 1, type: '法术' })).toBe(1); await settle();
  expect(R.hand).toHaveLength(8); expect(R.hand).not.toContain(uid); expect(R.foes[0].hp).toBe(97);
});
