import { expect } from 'vitest';

// Battle commits the UID ledger; the host settles permanent ownership after battle.
// These assertions exercise BattleSession state, not a constructed host's persistence.
export function battleItemSources(game, runtime, uid) {
  return [...game.ownedCards, ...runtime.granted].filter(entry => entry.uid === uid);
}
export function expectBattleItemCommitted(game, runtime, uid) {
  expect(runtime.G).toBe(game);
  expect(runtime.hand).not.toContain(uid);
  expect(runtime.played.filter(value => value === uid)).toHaveLength(1);
  const sources = battleItemSources(game, runtime, uid);
  expect(sources).toHaveLength(1);
  return sources[0];
}
