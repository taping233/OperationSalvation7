import { describe, expect, it } from 'vitest';
import { DEFAULT_WEIGHTS } from '../game/src/agent/agent.weights.js';
import {
  attachRunProvenance, captureCodeState, createRunProvenance, fingerprintCode, hashWeightOverride,
} from '../game/tools/agent-run-provenance.mjs';

describe('agent run provenance', () => {
  it('adds provenance without changing legacy summary fields', () => {
    const summary = { meta: { policy: 'greedy', runs: 2, avgRunMs: 100, timeoutRuns: 0 }, overall: { extractRate: 50 } };
    const provenance = createRunProvenance({
      startCode: { head: 'abc', branch: 'work', dirty: true, fingerprint: 'fp' },
      endCode: { head: 'abc', branch: 'work', dirty: true, fingerprint: 'fp' },
      projectRoot: 'Z:/missing-project',
      config: { policy: 'greedy', mode: 'standard', seedBase: 1, runs: 2, maxSteps: 2000,
        timeoutMs: 30000, slowStepMs: 1000, probeUi: false, profile: false, selfcheck: false,
        debugSteps: 0, scdbg: false },
      weights: { source: 'default', sha256: null },
    });

    attachRunProvenance(summary, provenance);

    expect(summary.meta).toMatchObject({ policy: 'greedy', runs: 2, avgRunMs: 100, timeoutRuns: 0 });
    expect(summary.overall).toEqual({ extractRate: 50 });
    expect(provenance).toMatchObject({
      schemaVersion: 1,
      code: { head: 'abc', branch: 'work', dirty: true, fingerprint: 'fp', changedDuringRun: false },
      runtime: { node: process.version, platform: process.platform, arch: process.arch, lockSha256: '' },
      weights: { source: 'default', sha256: hashWeightOverride(DEFAULT_WEIGHTS) },
    });
  });

  it('changes the dirty fingerprint when tracked code changes', () => {
    let trackedDiff = Buffer.alloc(0);
    const gitExec = (_command, args) => {
      if (args.includes('rev-parse')) return Buffer.from('abc\n');
      if (args.includes('branch')) return Buffer.from('work\n');
      if (args.includes('diff')) return trackedDiff;
      if (args.includes('status')) return Buffer.alloc(0);
      if (args.includes('ls-files')) return Buffer.alloc(0);
      throw new Error('unexpected git command');
    };

    const before = captureCodeState('Z:/project', { gitExec });
    trackedDiff = Buffer.from('tracked source patch');
    const after = captureCodeState('Z:/project', { gitExec });

    expect(before).toMatchObject({ head: 'abc', branch: 'work', dirty: false });
    expect(after).toMatchObject({ head: 'abc', branch: 'work', dirty: true });
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(fingerprintCode({ head: 'abc', trackedDiff: Buffer.alloc(0), untracked: [{ path: 'game/src/new.js', sha256: 'one' }] }))
      .not.toBe(fingerprintCode({ head: 'abc', trackedDiff: Buffer.alloc(0), untracked: [{ path: 'game/src/new.js', sha256: 'two' }] }));
  });

  it('includes untracked code contents in the dirty fingerprint', () => {
    let contents = Buffer.from('first version');
    const gitExec = (_command, args) => {
      if (args.includes('rev-parse')) return Buffer.from('abc\n');
      if (args.includes('branch')) return Buffer.from('work\n');
      if (args.includes('diff')) return Buffer.alloc(0);
      if (args.includes('status')) return Buffer.from('?? untracked');
      if (args.includes('ls-files')) return Buffer.from('game/src/untracked.js\0');
      throw new Error('unexpected git command');
    };
    const deps = {
      gitExec,
      getStat: () => ({ isSymbolicLink: () => false, isFile: () => true }),
      readBytes: () => contents,
    };

    const before = captureCodeState('Z:/project', deps);
    contents = Buffer.from('second version');
    const after = captureCodeState('Z:/project', deps);

    expect(before).toMatchObject({ dirty: true, head: 'abc' });
    expect(after).toMatchObject({ dirty: true, head: 'abc' });
    expect(after.fingerprint).not.toBe(before.fingerprint);
  });

  it('returns unknown Git provenance instead of throwing when Git is unavailable', () => {
    expect(captureCodeState('Z:/not-a-repo', { gitExec: () => { throw new Error('git unavailable'); } })).toBeNull();
  });
});
