import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/run/game.session.js', () => ({ game: {} }));
vi.mock('../game/src/agent/agent.state.js', () => ({ observe: () => ({ phase: 'battle' }) }));
const { readReplayState, firstDifference } = await import('../game/src/agent/agent.replay-state.js');
const previousSDT = window.SDT;
afterEach(() => { window.SDT = previousSDT; });

function fixture(token, selectionId, { stale = false, fuel = 'fuel-a', targetIndex = 0 } = {}) {
  const choice = Object.freeze({ uid: 'spell', card: { rules: { battleToken: 'card-rule-value' } },
    fuelUids: Object.freeze([fuel]), targetIndex, battleToken: stale ? token - 1 : token, selectionId });
  const diagnostics = Object.freeze({ battle: Object.freeze({ pendingTarget: choice, infusing: choice }),
    rules: Object.freeze({ interaction: Object.freeze({ interaction: choice, infusing: choice }) }) });
  window.SDT = { MAP: { rules: {} }, Battle: { getReplayState: () => diagnostics, getSnapshot: () => ({ battleToken: token }) } };
  return { state: readReplayState(), choice };
}

it('compares fresh fixture identities while preserving rule fields and immutable live diagnostics', () => {
  const first = fixture(5, 10);
  const second = fixture(9, 47);
  expect(firstDifference(first.state, second.state)).toBeNull();
  expect(first.choice).toMatchObject({ battleToken: 5, selectionId: 10 });
  expect(first.state.battle.pendingTarget).toMatchObject({ battleToken: 'current-battle', fuelUids: ['fuel-a'] });
  expect(first.state.battle.pendingTarget).not.toHaveProperty('selectionId');
  expect(first.state.battle.pendingTarget.card.rules.battleToken).toBe('card-rule-value');
});

it('still rejects stale membership, changed fuel and changed targets in both projections', () => {
  const { state } = fixture(5, 10);
  expect(firstDifference(state, fixture(9, 47, { stale: true }).state)?.path).toContain('battleToken');
  expect(firstDifference(state, fixture(9, 47, { fuel: 'fuel-b' }).state)?.path).toContain('fuelUids.0');
  expect(firstDifference(state, fixture(9, 47, { targetIndex: 1 }).state)?.path).toContain('targetIndex');
  const changed = fixture(9, 47).state;
  changed.battleRules.interaction.interaction.fuelUids[0] = 'fuel-b';
  expect(firstDifference(state, changed)?.path).toContain('battleRules.interaction.interaction.fuelUids.0');
});
