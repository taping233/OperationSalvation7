import { beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {}, observation: null }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixture.game, getActiveSlot: () => 1, startNewGame: vi.fn() }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: vi.fn(), reenterCell: vi.fn() }));
vi.mock('../game/src/agent/agent.state.js', () => ({
  observe: () => fixture.observation, settleSignature: () => 'stable', bustSigCache() {}, markUiFailure() {},
}));
const { autoRun } = await import('../game/src/agent/agent.runner.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { resetRunCounters, noteBattle, recordRun } = await import('../game/src/agent/agent.recorder.js');

beforeEach(() => {
  resetRunCounters(); localStorage.clear(); document.body.innerHTML = '';
  Object.assign(fixture.game, { runActive: true, battleActive: true, discoveredPairs: new Set(), nestRunes: [] });
  fixture.observation = { phase: 'battle', turn: 1, actions: [], run: { active: true },
    battle: { turn: 3, energy: 2, player: { hp: 10 } } };
  window.SDT = { game: fixture.game, Battle: { getSnapshot: () => ({ busy: false, actionQueueLength: 0 }), commands: {} } };
  setTurbo(true);
});

it.each(['usePotion', 'flee'])('rejected %s does not record a successful battle action', async name => {
  window.SDT.Battle.commands[name] = () => false;
  const trace = await autoRun({ decide: () => ({ type: 'battle', name }), maxSteps: 1, preSettled: true });
  expect(trace[0]).toMatchObject({ ok: false, id: `battle:${name}` });
  noteBattle(false);
  expect(recordRun('abandon').lastBattles[0]).toMatchObject({ potions: 0, fleeT: null });
});

it.each([true, undefined])('accepted legacy result %s still records the successful action', async value => {
  window.SDT.Battle.commands.usePotion = () => value;
  window.SDT.Battle.commands.flee = () => value;
  let index = 0;
  await autoRun({ decide: () => ({ type: 'battle', name: ['usePotion', 'flee'][index++] }), maxSteps: 2, preSettled: true });
  noteBattle(false);
  expect(recordRun('abandon').lastBattles[0]).toMatchObject({ potions: 1, fleeT: 3 });
});
