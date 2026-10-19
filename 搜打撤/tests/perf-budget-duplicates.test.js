// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const { inspectPackageBytes } = require('../scripts/perf-budget.cjs');

function inspect(contents) {
  const files = Object.keys(contents);
  const stat = vi.fn(file => ({ size: Buffer.byteLength(contents[file]) }));
  const read = vi.fn(file => Buffer.from(contents[file]));
  return { result: inspectPackageBytes(files, { stat, read }), stat, read };
}

function oldTotals(contents) {
  let packageBytes = 0, duplicateBytes = 0;
  const hashes = new Set();
  for (const content of Object.values(contents)) {
    const body = Buffer.from(content);
    packageBytes += body.length;
    const hash = createHash('sha256').update(body).digest('hex');
    if (hashes.has(hash)) duplicateBytes += body.length;
    hashes.add(hash);
  }
  return { packageBytes, duplicateBytes };
}

describe('Build duplicate-byte inspection', () => {
  it('matches the all-file hash calculation for mixed groups and every extra copy', () => {
    const contents = { a: 'same', b: 'same', c: 'same', d: 'diff', e: '更长的唯一文件', f: 'xy', g: 'xy' };
    const { result, stat } = inspect(contents);
    expect(result).toEqual(oldTotals(contents));
    expect(result.duplicateBytes).toBe(10);
    expect(stat).toHaveBeenCalledTimes(Object.keys(contents).length);
  });

  it('does not count same-size files with different content as duplicates', () => {
    const { result, read } = inspect({ a: 'abcd', b: 'efgh' });
    expect(result).toEqual({ packageBytes: 8, duplicateBytes: 0 });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('handles empty files and empty input without adding bytes', () => {
    expect(inspect({ a: '', b: '', c: '' }).result).toEqual({ packageBytes: 0, duplicateBytes: 0 });
    const { result, read } = inspect({});
    expect(result).toEqual({ packageBytes: 0, duplicateBytes: 0 });
    expect(read).not.toHaveBeenCalled();
  });

  it('never reads a unique-size file and still includes it in the package total', () => {
    const { result, read } = inspect({ unique: 'single', a: 'aa', b: 'aa' });
    expect(result).toEqual({ packageBytes: 10, duplicateBytes: 2 });
    expect(read.mock.calls.map(([file]) => file)).toEqual(['a', 'b']);
    expect(inspect({ only: 'unique' }).read).not.toHaveBeenCalled();
  });

  it('propagates stat and candidate-read failures instead of passing a partial scan', () => {
    expect(() => inspectPackageBytes(['missing'], { stat: () => { throw new Error('missing'); } })).toThrow('missing');
    expect(() => inspectPackageBytes(['a', 'b'], {
      stat: () => ({ size: 1 }), read: () => { throw new Error('unreadable'); },
    })).toThrow('unreadable');
  });
});
