// @vitest-environment node
// One bridge runs eight offline node:test fixtures; the TAP guard has its own contract.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { expect, it } from 'vitest';

const INCOMPLETE_TAP_RESULT = /^not ok\b|^ok\s+\d+\b[^\r\n]*\s+#\s*(?:SKIP|TODO)\b/im;

it('TAP guard accepts zero-count summaries but rejects failed or skipped result lines', () => {
  expect('ok 1 - fixture\n1..1\n# tests 1\n# pass 1\n# skipped 0\n# todo 0\n')
    .not.toMatch(INCOMPLETE_TAP_RESULT);
  for (const result of ['not ok 1 - fixture', 'ok 1 - fixture # SKIP reason',
    'ok 1 - fixture # TODO reason', 'ok 1 - fixture # skip reason', 'ok 1 - fixture # todo reason']) {
    expect(result).toMatch(INCOMPLETE_TAP_RESULT);
  }
});

it('dependency audit: all eight offline Node fixtures pass without skips', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const fixture = path.join(root, 'tests/tools/dependency-audit-diagnostics.test.mjs');
  const result = spawnSync(process.execPath, ['--test', '--test-reporter=tap', fixture], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
  const diagnostics = `${result.stdout || ''}\n${result.stderr || ''}`;
  expect(result.error, diagnostics).toBeUndefined();
  expect(result.signal, diagnostics).toBeNull();
  expect(result.status, diagnostics).toBe(0);
  const tap = result.stdout.replaceAll('\r\n', '\n');
  expect(tap, diagnostics).toMatch(/^1\.\.8$/m);
  expect(tap.match(/^ok \d+ - /gm), diagnostics).toHaveLength(8);
  for (const [label, count] of Object.entries({ tests: 8, suites: 0, pass: 8,
    fail: 0, cancelled: 0, skipped: 0, todo: 0 })) {
    expect(tap, diagnostics).toMatch(new RegExp(`^# ${label} ${count}$`, 'm'));
  }
  expect(tap, diagnostics).not.toMatch(INCOMPLETE_TAP_RESULT);
}, 20000);
