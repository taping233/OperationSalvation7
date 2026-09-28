import { describe, expect, it } from 'vitest';
import { inspectComparisonProvenance } from '../game/tools/agent-compare-provenance.mjs';

const runs = [{ seed: 77001, outcome: 'extract' }, { seed: 77002, outcome: 'death' }];

function summary({ fingerprint = 'same-code', changedDuringRun = false, mode = 'standard', probeUi = false,
  runsCount = 2, policy = 'strategic', driver = 'strategic', weights = 'weights-a', lock = 'lock-hash' } = {}) {
  return {
    meta: {
      policy, driver,
      provenance: {
        schemaVersion: 1,
        code: { fingerprint, changedDuringRun },
        runtime: { lockSha256: lock, node: 'v22.0.0', platform: 'win32', arch: 'x64' },
        config: { mode, seedBase: 77001, runs: runsCount, maxSteps: 2000, timeoutMs: 30000,
          probeUi, profile: false, selfcheck: false, debugSteps: false, scdbg: false },
        weights: { sha256: weights },
      },
    },
  };
}

describe('agent compare provenance gate', () => {
  it('allows a same-code paired run whose planned policy, driver, and weights differ', () => {
    const result = inspectComparisonProvenance({
      challengerSummary: summary({ policy: 'strategic', driver: 'challenger', weights: 'candidate-hash' }),
      championSummary: summary({ policy: 'greedy', driver: 'champion', weights: 'baseline-hash' }),
      challengerRuns: runs,
      championRuns: runs,
    });
    expect(result).toMatchObject({ status: 'verified', eligible: true, pairRate: 100, commonSeeds: 2 });
    expect(result.sides.challenger.weightsSha256).toBe('candidate-hash');
    expect(result.sides.champion.policy).toBe('greedy');
  });

  it('blocks different code, changed-during-run, runtime, config, and enabled probe', () => {
    const result = inspectComparisonProvenance({
      challengerSummary: summary({ fingerprint: 'challenger-code', changedDuringRun: true, probeUi: true }),
      championSummary: summary({ lock: 'other-lock', mode: 'nest' }),
      challengerRuns: runs,
      championRuns: runs,
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      '代码 fingerprint 不一致',
      '运行期间代码状态变化，不能配对晋级',
      'runtime.lockSha256 不一致',
      'config.mode 不一致',
      '正式配对要求两侧 probeUi=false',
    ]));
  });

  it('blocks incomplete, null-seed, or duplicate-seed pairs', () => {
    const result = inspectComparisonProvenance({
      challengerSummary: summary(), championSummary: summary(),
      challengerRuns: [{ seed: 77001 }, { seed: 77001 }],
      championRuns: [{ seed: 77001 }, { seed: null }, { seed: 77002 }],
    });
    expect(result.eligible).toBe(false);
    expect(result.reasons).toEqual(expect.arrayContaining([
      'challenger 有 1 个重复 seed',
      'champion 有 1 局 seed 缺失',
      '两侧 runs 局数不一致',
    ]));
  });

  it('keeps legacy summaries readable but marks them as non-promotable', () => {
    const result = inspectComparisonProvenance({
      challengerSummary: { meta: { policy: 'greedy' } },
      championSummary: { meta: { policy: 'greedy' } },
      challengerRuns: runs,
      championRuns: runs,
    });
    expect(result).toMatchObject({ status: 'legacy', eligible: false });
    expect(result.reasons[0]).toContain('历史数据未验证');
    expect(result.sides.challenger.policy).toBe('greedy');
  });
});
