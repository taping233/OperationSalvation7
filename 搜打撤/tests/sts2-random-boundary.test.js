import { installImmediateWebLocks } from './helpers/web-locks.js';
installImmediateWebLocks();
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Random, SeededRandomService } from '../game/src/core/random.js';
import { createBattleFoeLifecycle } from '../game/src/battle/core/battle.foe-lifecycle.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import { recordRun, resetRunCounters, setDriver } from '../game/src/agent/agent.recorder.js';
import { randomPolicy } from '../game/src/agent/agent.policy.js';
import { RunStorage } from '../game/src/hub/game.storage.js';

const RULE_STREAMS = ['battle', 'gameplay'];
const nextRules = service => Object.fromEntries(RULE_STREAMS.map(stream => [stream,
  Array.from({ length: 8 }, () => service.random(stream)),
]));
let previousRandom;
let previousGame;
let previousBattleGame;

function defeatFoes(count) {
  const flow = createBattleFoeLifecycle({
    alive: () => [], foeIdx: () => 0, finish: vi.fn(), hitFoe: vi.fn(),
    executionSession: { stagedResolutionDepth: 0 }, stagedDeathFx: new Set(),
  });
  for (let i = 0; i < count; i++) {
    expect(flow.resolveFoeDefeat({ name: `敌人${i}`, hp: 0, status: {} })).toBe(true);
  }
}

beforeEach(() => {
  previousRandom = Random.snapshot();
  previousGame = window.SDT.game;
  previousBattleGame = runtime.G;
  const game = { log: vi.fn(), mapSeed: 'random-boundary', myClass: '战士', hp: 10 };
  window.SDT.game = game;
  runtime.set$G(game);
  runtime.clearBattlePresentation();
  resetRunCounters();
  setDriver('human');
  localStorage.clear();
  Random.reseed('sts2-random-boundary');
  // 覆盖已使用的流，避免只证明初始流尚未创建。
  for (const stream of RULE_STREAMS) Random.random(stream);
});

afterEach(() => {
  Random.restore(previousRandom);
  window.SDT.game = previousGame;
  runtime.set$G(previousBattleGame);
  runtime.clearBattlePresentation();
  resetRunCounters();
  localStorage.clear();
});

describe('表现与记录随机不推进规则流', () => {
  it.each([1, 7])('%i 次真实击倒仍保留后续战斗和玩法随机序列', count => {
    const before = Random.snapshot();
    const baseline = new SeededRandomService();
    baseline.restore(before);

    defeatFoes(count);

    expect(runtime.floats.filter(item => item.cls === 'stk stk-late stk-cheer')).toHaveLength(count);
    expect(Random.snapshot().streams).toMatchObject(before.streams);
    expect(nextRules(Random)).toEqual(nextRules(baseline));
  });

  it.each([1, 7])('%i 次终局记录仍保留后续战斗和玩法随机序列', count => {
    const before = Random.snapshot();
    const baseline = new SeededRandomService();
    baseline.restore(before);

    const records = Array.from({ length: count }, () => recordRun('abandon'));

    expect(new Set(records.map(entry => entry.id)).size).toBe(count);
    expect(records.every(entry => entry.id.startsWith('run-'))).toBe(true);
    expect(Random.snapshot().streams).toMatchObject(before.streams);
    expect(nextRules(Random)).toEqual(nextRules(baseline));
  });

  it('默认随机策略的真实决策独立于战斗和玩法随机流', () => {
    const before = Random.snapshot();
    const baseline = new SeededRandomService();
    baseline.restore(before);
    const actions = [{ name: 'first' }, { name: 'second' }, { name: 'third' }];
    const decide = randomPolicy();

    const decisions = Array.from({ length: 12 }, () => decide({ actions }));

    expect(decisions.every(action => actions.includes(action))).toBe(true);
    expect(Random.snapshot().streams['agent-policy']).toEqual(expect.any(Number));
    expect(Random.snapshot().streams).toMatchObject(before.streams);
    expect(nextRules(Random)).toEqual(nextRules(baseline));
  });

  it('随机策略继续优先使用调用方的随机函数且不推进服务流', () => {
    const before = Random.snapshot();
    const actions = [{ name: 'first' }, { name: 'second' }];
    const roll = vi.fn(() => 0.9);

    expect(randomPolicy(roll)({ actions })).toBe(actions[1]);

    expect(roll).toHaveBeenCalledTimes(1);
    expect(Random.snapshot()).toEqual(before);
  });

  it('新增命名流沿现有 seed/rngState 存读档契约继续，旧快照和仅 seed 仍可恢复', async () => {
    const legacyState = Random.snapshot();
    defeatFoes(2);
    recordRun('abandon');
    randomPolicy()({ actions: [{ name: 'first' }, { name: 'second' }] });
    const savedState = Random.snapshot();
    expect(savedState.streams.visual).toEqual(expect.any(Number));
    expect(savedState.streams.recording).toEqual(expect.any(Number));
    expect(savedState.streams['agent-policy']).toEqual(expect.any(Number));
    expect(await RunStorage.write(1, { seed: Random.seed, rngState: savedState })).toBe(true);
    const expectedRules = nextRules(Random);
    const expectedOther = [Random.random('visual'), Random.random('recording'), Random.random('agent-policy')];

    const saved = RunStorage.read(1);
    Random.reseed('different-run');
    Random.restore(saved.rngState || saved.seed);
    expect(Random.seed).toBe(saved.seed);
    expect(Random.snapshot()).toEqual(savedState);
    expect(nextRules(Random)).toEqual(expectedRules);
    expect([Random.random('visual'), Random.random('recording'), Random.random('agent-policy')]).toEqual(expectedOther);

    Random.restore(legacyState);
    const legacyBaseline = new SeededRandomService();
    legacyBaseline.restore(legacyState);
    expect(nextRules(Random)).toEqual(nextRules(legacyBaseline));
    Random.restore(saved.seed);
    expect(nextRules(Random)).toEqual(nextRules(new SeededRandomService(saved.seed)));
  });
});
