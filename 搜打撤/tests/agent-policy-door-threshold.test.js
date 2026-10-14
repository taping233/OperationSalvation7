// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { greedyPolicy, strategicPolicy } from '../game/src/agent/agent.policy.js';
import { DEFAULT_WEIGHTS, resolveWeights } from '../game/src/agent/agent.weights.js';
const originalOverride = globalThis.__SDT_AGENT_WEIGHTS;
afterEach(() => {
  if (originalOverride === undefined) delete globalThis.__SDT_AGENT_WEIGHTS;
  else globalThis.__SDT_AGENT_WEIGHTS = originalOverride;
});

function observation(hp, label = 'door') {
  const move = (idx, next = []) => ({ type: 'move', id: `move:0,${idx}`, li: 0, idx,
    label: `候选（${label}）`, visited: false, next });
  return {
    phase: 'map',
    run: { hp, maxHp: 100, layer: 1, node: 0, used: 0, bagCap: 16,
      ownedCards: [{}, {}, {}], bossKilled: false },
    // Both doors have equal immediate value. Only the second has a rewarding next step.
    actions: [move(1), move(2, [{ li: 0, idx: 3, label: '宝箱（chest）', visited: false }])],
  };
}

describe('strategic door lookahead HP threshold', () => {
  it('uses the declared geo default, without a parallel gate setting', () => {
    delete globalThis.__SDT_AGENT_WEIGHTS;
    expect(DEFAULT_WEIGHTS.geo.doorNoLookHp).toBe(0.35);
    expect(Object.hasOwn(DEFAULT_WEIGHTS.gate, 'doorNoLookHp')).toBe(false);
    expect(strategicPolicy()(observation(20)).idx).toBe(1);
  });

  it('disables door lookahead at the exact default threshold', () => {
    delete globalThis.__SDT_AGENT_WEIGHTS;
    expect(strategicPolicy()(observation(35)).idx).toBe(1);
  });

  it('keeps normal door lookahead above the default threshold', () => {
    delete globalThis.__SDT_AGENT_WEIGHTS;
    expect(strategicPolicy()(observation(36)).idx).toBe(2);
    expect(strategicPolicy()(observation(80)).idx).toBe(2);
  });

  it('uses an explicit higher geo threshold, including equality', () => {
    globalThis.__SDT_AGENT_WEIGHTS = { geo: { doorNoLookHp: 0.6 } };
    expect(resolveWeights().geo.doorNoLookHp).toBe(0.6);
    expect(strategicPolicy()(observation(50)).idx).toBe(1);
    expect(strategicPolicy()(observation(60)).idx).toBe(1);
    expect(strategicPolicy()(observation(61)).idx).toBe(2);
  });

  it('uses an explicit lower geo threshold instead of always applying the default', () => {
    globalThis.__SDT_AGENT_WEIGHTS = { geo: { doorNoLookHp: 0.2 } };
    expect(strategicPolicy()(observation(20)).idx).toBe(1);
    expect(strategicPolicy()(observation(25)).idx).toBe(2);
  });

  it('does not cut off non-door lookahead at low HP', () => {
    delete globalThis.__SDT_AGENT_WEIGHTS;
    expect(strategicPolicy()(observation(20, 'battle')).idx).toBe(2);
  });

  it('leaves the frozen greedy control independent of strategic geo thresholds', () => {
    delete globalThis.__SDT_AGENT_WEIGHTS;
    const baseline = greedyPolicy()(observation(20)).idx;
    globalThis.__SDT_AGENT_WEIGHTS = { geo: { doorNoLookHp: 1 } };
    expect(greedyPolicy()(observation(20)).idx).toBe(baseline);
  });
});
