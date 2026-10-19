// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSlice } from '../tools/workflow-slice.mjs';
import { summarize } from '../tools/workflow-summary.mjs';

function fixture(exitCode = 0) {
  const root = mkdtempSync(path.join(tmpdir(), 'sdt-slice-'));
  for (const folder of ['game/src/ui', 'game/src/core', 'game/data', 'game/dev', 'tests', 'scripts', 'docs/evidence/check']) mkdirSync(path.join(root, folder), { recursive: true });
  writeFileSync(path.join(root, 'game/src/ui/example.js'), 'export const example = 1;');
  writeFileSync(path.join(root, 'game/src/core/state.js'), 'export const state = {};');
  writeFileSync(path.join(root, 'tests/example.test.js'), "import '../game/src/ui/example.js';");
  writeFileSync(path.join(root, 'game/dev/example.html'), '<title>Example</title><script type="module" src="../src/ui/example.js"></script>');
  writeFileSync(path.join(root, 'scripts/acceptance-gate.mjs'), `
    import { writeFileSync } from 'node:fs';
    const args = process.argv.slice(2);
    if(args.includes('--plan')) console.log(JSON.stringify({mode:args.some(x=>x.includes('core/'))?'full':'quick',tests:['tests/example.test.js']}));
    else { writeFileSync('executed.json',JSON.stringify(args)); process.exitCode=${exitCode}; }
  `);
  return root;
}
const options = (out, extra = {}) => ({ paths: ['game/src/ui/example.js'], out: 'docs/evidence/check/' + out, ...extra });
const read = (root, file) => JSON.parse(readFileSync(path.join(root, file), 'utf8'));

describe('workflow slice composition', () => {
  it('plans without executing and keeps candidate URLs and unverified summary explicit', async () => {
    const root = fixture();
    const result = await runSlice(root, options('plan'));
    expect(result.status).toBe('planned');
    expect(result.review.plan.mode).toBe('quick');
    expect(result.pages).toMatchObject([{ urlPath: '/dev/example.html', status: 'not-verified' }]);
    expect(existsSync(path.join(root, 'executed.json'))).toBe(false);
    expect(read(root, result.summary).closeInput.doneWhenConfirmed).toBe(false);
    const composition = summarize(root, { title: 'composition', paths: result.paths,
      reports: [{ path: 'docs/evidence/check/plan/run.json' }], unverified: [] });
    expect(composition.reports[0].result).toBe('unverified');
    await expect(runSlice(root, options('plan'))).rejects.toThrow('Existing evidence');
  });
  it('runs the existing paths gate and reuses the report without executing again', async () => {
    const root = fixture();
    const result = await runSlice(root, options('run', { run: true, task: 'slice', date: '2026-10-19' }));
    expect(result.exitCode).toBe(0);
    expect(read(root, 'executed.json')).toContain('--paths');
    expect(result.review.verification.status).toBe('candidate');
    const reused = await runSlice(root, options('reuse', { input: result.verificationReport }));
    expect(reused.automation.checksRun).toBe(false);
    expect(reused.review.verification.status).toBe('candidate');
    expect(read(root, reused.summary).reports[0].result).toBe('passed');
    writeFileSync(path.join(root, 'game/src/ui/example.js'), 'export const example = 2;');
    const stale = await runSlice(root, options('stale', { input: result.verificationReport }));
    expect(stale.status).toBe('stale');
    expect(read(root, stale.summary).reports[0].result).toBe('stale');
  });
  it('retains full selection and the original failing exit code without marking completion', async () => {
    const root = fixture(7);
    const result = await runSlice(root, options('failure', { paths: ['game/src/core/state.js'], run: true, task: 'slice', date: '2026-10-19' }));
    expect(result.review.plan.mode).toBe('full');
    expect(read(root, result.verificationReport).validation.mode).toBe('full');
    expect(result.status).toBe('failed');
    expect(result.exitCode).toBe(7);
    expect(read(root, result.summary)).toMatchObject({ hasFailure: true, closeInput: { doneWhenConfirmed: false } });
  });
  it('preserves skip as unverified and browser captured as observed', async () => {
    const root = fixture();
    writeFileSync(path.join(root, 'docs/example.md'), 'tool notes');
    writeFileSync(path.join(root, 'scripts/acceptance-gate.mjs'), "console.log(JSON.stringify({mode:'skip',tests:[]}));");
    writeFileSync(path.join(root, 'docs/evidence/check/browser.json'), JSON.stringify({ source: 'Codex current in-app browser tab', status: 'captured', detail: 'static current window' }));
    const result = await runSlice(root, options('skip', { paths: ['docs/example.md'], run: true, task: 'slice', date: '2026-10-19', reports: ['docs/evidence/check/browser.json'] }));
    expect(result.status).toBe('skipped');
    expect(result.review.plan.mode).toBe('skip');
    expect(read(root, result.summary).reports.map(item => item.result)).toEqual(['unverified', 'observed']);
  });
  it('rejects unsafe/missing inputs before running the gate', async () => {
    const root = fixture();
    await expect(runSlice(root, options('bad', { out: '../outside' }))).rejects.toThrow('项目内');
    await expect(runSlice(root, options('bad', { paths: ['game/src/ui'] }))).rejects.toThrow('explicit files');
    await expect(runSlice(root, options('bad', { run: true, input: 'docs/evidence/check/absent.json' }))).rejects.toThrow('mutually exclusive');
    await expect(runSlice(root, options('bad', { input: 'docs/evidence/check/absent.json' }))).rejects.toThrow();
    expect(existsSync(path.join(root, 'executed.json'))).toBe(false);
  });
});
