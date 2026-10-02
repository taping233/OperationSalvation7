/* INFRA-03 回归：autoRun 结束后必须还原「调用前」的驱动标签。
 * 旧实现 previousDriver = setDriver(driver)（返回刚写入的标签），human→autoRun(greedy)
 * 收口后 driver 仍停在 greedy；修复后先 getDriver() 读旧值再写入。 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {}, slot: 1 }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => fixture.slot, startNewGame: vi.fn(),
  curLayer: () => null, bagCap: () => 16, usedSlots: () => 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { UI: {}, Sound: { sfx() {} } };
const { autoRun } = await import('../game/src/agent/agent.runner.js');
const { getDriver, setDriver } = await import('../game/src/agent/agent.recorder.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const { bustSigCache } = await import('../game/src/agent/agent.state.js');

const options = { preSettled: true, allowEmpty: true, quietMs: 1, pollMs: 1, timeoutMs: 100, commandTimeoutMs: 100 };

beforeEach(() => {
  Object.assign(fixture.game, { state: 'idle', runActive: true, battleActive: false, nestActive: false,
    discoveredPairs: new Set(), nestRunes: [], turn: 1, ownedCards: [], inventory: [] });
  fixture.slot = 1;
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  window.SDT.game = fixture.game;
  window.SDT.UI = { _acts: {} };
  setTurbo(true);
  bustSigCache();
});
afterEach(() => vi.restoreAllMocks());

describe('INFRA-03 autoRun 驱动标签还原', () => {
  it('human → autoRun(greedy) 结束后恢复 human', async () => {
    setDriver('human');
    const trace = await autoRun({ decide: () => null, driver: 'greedy', maxSteps: 3, ...options });
    expect(trace.stopReason).toBe('decide-null');
    expect(getDriver(), 'autoRun 收口后驱动标签未还原为 human').toBe('human');
  });

  it('human → autoRun(random) 结束后同样恢复 human（局内期间标签生效）', async () => {
    setDriver('human');
    let seenDuring = null;
    const probe = () => { seenDuring = getDriver(); return null; };
    await autoRun({ decide: probe, driver: 'random', maxSteps: 3, ...options });
    expect(seenDuring).toBe('random');   // 局内标签确实是本局 driver
    expect(getDriver()).toBe('human');   // 收口还原调用前的 human
  });
});
