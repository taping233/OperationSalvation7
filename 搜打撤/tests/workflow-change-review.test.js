// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { reviewChange, relatedUiCases } from '../scripts/workflow-change-review.mjs';
import { fingerprint, repositoryContext, runCheck } from '../scripts/workflow-evidence.mjs';
import { hash } from '../scripts/workflow-ledger.mjs';

// Keep temporary test evidence recoverable; no cleanup of shared project files.
function fixture() {
  const root = mkdtempSync(path.join(tmpdir(), 'sdt-change-review-'));
  for (const directory of ['game/src/ui', 'game/data', 'game/dev', 'game/css', 'tests', 'scripts', 'docs/production/art', 'docs/evidence/check']) {
    mkdirSync(path.join(root, directory), { recursive: true });
  }
  write(root, 'game/src/ui/example.js', 'export const example = 1;');
  write(root, 'tests/example.test.js', "import { example } from '../game/src/ui/example.js'; export const checked = example;");
  write(root, 'docs/quality-gates.md', 'Local checks require separate browser evidence.');
  write(root, 'docs/development.md', 'Current game/src/ui/example.js uses a component.');
  write(root, 'game/dev/example-review.html', '<title>Example UI</title>\n<script type="module">import {example} from "../src/ui/example.js";</script>');
  return root;
}
function write(root, file, text) { writeFileSync(path.join(root, file), text); }
function report(root, changes = {}) {
  const snapshot = fingerprint(root);
  const file = 'docs/evidence/check/result.json';
  write(root, 'docs/evidence/check/check.log', 'tests executed');
  const value = { schemaVersion: 1, kind: 'automated-local-check', before: snapshot, after: snapshot,
    exitCode: 0, outcome: 'passed', validation: { mode: 'targeted', executed: true, tests: ['tests/example.test.js'] },
    log: 'docs/evidence/check/check.log', logSha256: hash('tests executed'), ...changes };
  write(root, file, JSON.stringify(value));
  return file;
}

describe('change review without Git', () => {
  it('the unified CLI exposes read-only review and rejects missing paths', () => {
    const run = spawnSync(process.execPath, ['scripts/workflow.mjs', 'review', '--paths', 'scripts/workflow-change-review.mjs', '--json'], { encoding: 'utf8' });
    expect(run.status, run.stderr).toBe(0);
    const result = JSON.parse(run.stdout);
    expect(result.kind).toBe('change-review');
    expect(result.readOnly).toBe(true);
    expect(result.plan.tests).toContain('tests/workflow-change-review.test.js');
    const missing = spawnSync(process.execPath, ['scripts/workflow.mjs', 'review', '--json'], { encoding: 'utf8' });
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout).error).toContain('--paths');
  });
  it('uses existing gate selection, current document links and real HTML references without claiming a pass', () => {
    const root = fixture();
    const result = reviewChange(root, { paths: ['game/src/ui/example.js'] });
    expect(result.repository).toMatchObject({ mode: 'snapshot', head: null, status: null, reusableReceipt: false });
    expect(existsSync(path.join(root, '.git'))).toBe(false);
    expect(result.plan.mode).toBe('quick');
    expect(result.plan.tests).toContain('tests/example.test.js');
    expect(result.documents.find(item => item.file === 'docs/development.md').references).toEqual([{ line: 1, paths: ['game/src/ui/example.js'] }]);
    expect(result.ui.candidates).toEqual([{ file: 'game/dev/example-review.html', title: 'Example UI', status: 'not-verified',
      references: [{ file: 'game/src/ui/example.js', line: 2 }] }]);
    expect(result.verification.status).toBe('not-provided');
    expect(result.readOnly).toBe(true);
  });
  it('requires explicit project paths and leaves missing paths visible', () => {
    const root = fixture();
    expect(() => reviewChange(root)).toThrow('--paths');
    expect(() => reviewChange(root, { paths: ['.'] })).toThrow('根目录');
    expect(reviewChange(root, { paths: ['game/css'] }).ui.status).toBe('needs-manual-review');
    expect(() => reviewChange(root, { paths: ['../outside'] })).toThrow('项目内');
    const result = reviewChange(root, { paths: ['game/css/missing.css'] });
    expect(result.missingPaths).toEqual(['game/css/missing.css']);
    expect(result.plan.mode).toBe('skip');
    expect(result.ui.status).toBe('needs-manual-review');
    expect(result.gaps.some(item => item.includes('UI'))).toBe(true);
  });
  it('preserves full selection and never treats a targeted result as full', () => {
    const root = fixture(); mkdirSync(path.join(root, 'game/src/core'));
    write(root, 'game/src/core/state.js', 'export const state = {};');
    const input = report(root);
    const result = reviewChange(root, { paths: ['game/src/core/state.js'], input });
    expect(result.plan.mode).toBe('full');
    expect(result.verification.scope).toBe('partial');
    expect(result.verification.reusableReceipt).toBe(false);
  });
  it('exposes stale, failed, skipped and tampered evidence separately', () => {
    const root = fixture();
    const input = report(root);
    let result = reviewChange(root, { paths: ['game/src/ui/example.js'], input });
    expect(result.verification.status).toBe('candidate');
    expect(result.verification.missingTests).toContain('tests/contracts.test.js');
    expect(result.verification.scope).toBe('partial');
    write(root, 'game/src/ui/example.js', 'export const example = 2;');
    expect(reviewChange(root, { paths: ['game/src/ui/example.js'], input }).verification.status).toBe('stale');
    report(root, { exitCode: 1, outcome: 'failed' });
    expect(reviewChange(root, { paths: ['game/src/ui/example.js'], input }).verification.status).toBe('failed');
    report(root, { outcome: 'skip', validation: { mode: 'skip', executed: false, tests: [] } });
    expect(reviewChange(root, { paths: ['game/src/ui/example.js'], input }).verification.status).toBe('skipped');
    write(root, 'docs/evidence/check/check.log', 'tampered');
    result = reviewChange(root, { paths: ['game/src/ui/example.js'], input });
    expect(result.verification.status).toBe('invalid');
    expect(result.verification.error).toContain('哈希');
  });
  it('rejects unsafe report paths and unsupported reports without executing content', () => {
    const root = fixture();
    expect(reviewChange(root, { paths: ['game/src/ui/example.js'], input: '../external.json' }).verification.status).toBe('invalid');
    write(root, 'docs/evidence/check/other.json', JSON.stringify({ kind: 'staged-snapshot-check' }));
    const result = reviewChange(root, { paths: ['game/src/ui/example.js'], input: 'docs/evidence/check/other.json' });
    expect(result.verification.error).toContain('工作区报告');
  });
  it('finds CSS, absolute /src and transitive candidate references, not unrelated HTML', () => {
    const root = fixture();
    write(root, 'game/dev/more.html', '<link href="../css/example.css?x=1">\n<script type="module" src="/src/ui/consumer.js"></script>');
    expect(relatedUiCases(root, ['game/css/example.css', 'game/src/ui/consumer.js']).map(item => item.file)).toEqual(['game/dev/more.html']);
  });
  it('tool-only change has no game UI requirement and does not scan historical evidence as current docs', () => {
    const root = fixture();
    write(root, 'scripts/custom.mjs', 'export const n = 1;');
    write(root, 'docs/evidence/check/old.md', 'scripts/custom.mjs was once tested');
    const result = reviewChange(root, { paths: ['scripts/custom.mjs'] });
    expect(result.ui.status).toBe('not-required-for-tool-only-change');
    expect(result.documents.some(item => item.file.includes('/evidence/'))).toBe(false);
  });
  it('verify executes an explicit fixture runner in a snapshot and records null Git metadata', async () => {
    const root = fixture();
    write(root, 'scripts/acceptance-gate.mjs', "console.log('fixture targeted check');");
    const result = await runCheck(root, { task: 'snapshot-test', date: '2026-10-17', tests: ['tests/example.test.js'], json: true });
    const saved = JSON.parse(readFileSync(path.join(root, result.report), 'utf8'));
    expect(result.exitCode).toBe(0);
    expect(saved.repository.before.mode).toBe('snapshot');
    expect(saved.repository.after.mode).toBe('snapshot');
    expect(saved.head).toBeNull(); expect(saved.statusBefore).toBeNull(); expect(saved.statusAfter).toBeNull();
    expect(saved.reusableReceipt).toBe(false);
    expect(saved.freshness.result).toBe('candidate');
    expect(existsSync(path.join(root, '.git'))).toBe(false);
  });
  it('a broken Git marker is an error, not an implicit snapshot exemption', () => {
    const root = fixture(); write(root, '.git', 'gitdir: nonexistent-git-dir');
    expect(() => repositoryContext(root)).toThrow('不能按无仓库降级');
  });
});
