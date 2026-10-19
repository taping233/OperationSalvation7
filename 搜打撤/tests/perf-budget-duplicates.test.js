// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
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

it('reports category bytes, largest files and duplicate paths without extra reads or changing totals', () => {
  const contents = { '/build/assets/a.webp': 'same', '/build/assets/b.webp': 'same', '/build/assets/app.js': 'longer script' };
  const stat = vi.fn(file => ({ size: Buffer.byteLength(contents[file]) }));
  const read = vi.fn(file => Buffer.from(contents[file]));
  const report = inspectPackageBytes(Object.keys(contents), { stat, read, details: true, root: '/build' });
  expect(report.packageBytes).toBe(oldTotals(contents).packageBytes);
  expect(report.duplicateBytes).toBe(4);
  expect(report.composition.categories).toEqual([{ extension: '.js', bytes: 13, files: 1 }, { extension: '.webp', bytes: 8, files: 2 }]);
  expect(report.composition.largest[0]).toEqual({ file: 'assets/app.js', bytes: 13 });
  expect(report.composition.duplicateGroups).toEqual([{ files: ['assets/a.webp', 'assets/b.webp'], copies: 2, filesTruncated: false, wastedBytes: 4 }]);
  expect(stat).toHaveBeenCalledTimes(3);
  expect(read).toHaveBeenCalledTimes(2);
});

it('keeps complete category totals while bounding large-file and duplicate lists', () => {
  const contents = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`item-${i}.bin`, 'a'.repeat(i + 1)]));
  const report = inspectPackageBytes(Object.keys(contents), {
    stat: file => ({ size: contents[file].length }), read: file => Buffer.from(contents[file]), details: true,
  });
  expect(report.composition.largest).toHaveLength(12);
  expect(report.composition.categories[0]).toEqual({ extension: '.bin', files: 30, bytes: 465 });
  expect(report.composition.duplicateGroups).toEqual([]);
});


it('CLI emits composition for a synthetic completed-build fixture while keeping budget checks', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'sdt-budget-fixture-'));
  mkdirSync(path.join(root, 'assets/js'), { recursive: true });
  writeFileSync(path.join(root, 'index.html'), '<script type="module" src="./assets/js/index-test.js"></script>');
  for (const file of ['index-test.js', 'battle.view-test.js', 'vendor-narrative-test.js']) {
    writeFileSync(path.join(root, 'assets/js', file), 'console.log(' + JSON.stringify(file) + ');');
  }
  const run = spawnSync(process.execPath, ['scripts/perf-budget.cjs'], {
    env: { ...process.env, SDT_BUILD_OUT_DIR: root }, encoding: 'utf8',
  });
  expect(run.status, run.stderr).toBe(0);
  const line = run.stdout.split('\n').find(item => item.startsWith('[perf-budget:composition] '));
  const report = JSON.parse(line.slice('[perf-budget:composition] '.length));
  expect(report.categories.find(item => item.extension === '.js').files).toBe(3);
  expect(report.largest.every(item => !path.isAbsolute(item.file))).toBe(true);
  expect(run.stdout).toContain('[perf-budget] PASS');
  expect(run.stdout).toContain('entry-gzip=');
});
