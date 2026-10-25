// Deterministic operation counts, not a browser FPS or elapsed-time benchmark.
import { expect, it } from 'vitest';
import { createBattleCardInspection } from '../game/src/battle/effects/battle.card-inspection.js';

it('reports same-input effective-face and pocket-cost lookup work', () => {
  let uidComparisons = 0;
  const card = { id: 'probe', name: '探针', type: '法术', cost: 30,
    rules: { battle: { costModifiers: [{ kind: 'consumedSpellDiscount', amount: 1 }] } } };
  const ownedCards = Array.from({ length: 60 }, (_, i) => ({
    get uid() { uidComparisons++; return `uid-${i}`; }, card: { ...card },
  }));
  const state = { game: { ownedCards }, granted: [], cardOverrides: new Map(),
    consumed: Array.from({ length: 20 }, (_, i) => `uid-${i}`),
    zeroFeeUntil: new Map(), turn: 1, pstat: { status: {} }, pdef: { armor: 1 },
    playedMartialThisTurn: 0, playedMovesThisTurn: 0 };
  const inspection = createBattleCardInspection({ cards: {}, readState: () => state, curseMeta: {} });
  const counts = {};
  for (let i = 0; i < 100; i++) expect(inspection.findEffectiveCard('uid-59').card).toMatchObject(ownedCards[59].card);
  counts.effectiveFace100 = uidComparisons;
  uidComparisons = 0;
  for (let i = 0; i < 100; i++) expect(inspection.effCostOf(card, 'uid-59')).toBe(10);
  counts.activePocketDiscount100 = uidComparisons;
  uidComparisons = 0;
  state.spellCost1 = true;
  for (let i = 0; i < 100; i++) expect(inspection.effCostOf(card, 'uid-59')).toBe(1);
  counts.fixedCostWithPocketDiscount100 = uidComparisons;
  console.log('BATTLE_QUERY_UID_COMPARISONS', JSON.stringify(counts));
});
