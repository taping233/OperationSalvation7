import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
const require = createRequire(import.meta.url);

test('local clone scan detects copied logic but excludes generated/vendor/license files', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'redundancy-contract-'));
  const source = Array.from({ length: 14 }, (_, i) => `const value${i} = input[${i}] * ${i + 2};`).join('\n');
  for (const file of ['a.js', 'b.js', 'generated/c.js', 'vendor/d.js', 'LICENSE.txt']) {
    mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
    writeFileSync(path.join(dir, file), source);
  }
  const out = path.join(dir, 'reports');
  const result = spawnSync(process.execPath, [require.resolve('jscpd/run-jscpd.js'), dir,
    '--config', path.resolve('tests/tools/redundancy-report.json'), '--workers', '1', '--output', out], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const report = JSON.parse(readFileSync(path.join(out, 'jscpd-report.json'), 'utf8'));
  assert.ok(report.duplicates.length > 0);
  assert.equal(report.statistics.total.sources, 2);
  for (const item of report.duplicates) {
    for (const file of [item.firstFile, item.secondFile]) assert.match(file.name, /^[ab]\.js$/);
  }
});
