import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { summarize, writeSummary } from '../tools/workflow-summary.mjs';
import { previewPersonnelSkin } from '../tools/browser-personnel.mjs';

const roots = [];
const root = () => { const value = mkdtempSync(path.join(os.tmpdir(), 'workflow-standardize-')); roots.push(value); return value; };
afterEach(() => { for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true }); });
const sha = value => createHash('sha256').update(value).digest('hex');

function fixture(report) {
  const project = root();
  writeFileSync(path.join(project, 'code.js'), 'current');
  writeFileSync(path.join(project, 'report.json'), JSON.stringify(report));
  return { project, input: { title: 'Scoped closeout', paths: ['code.js'], reports: [{ path: 'report.json' }], unverified: [] } };
}

describe('explicit closeout aggregation', () => {
  it('retains failure and does not turn an owner completion declaration into a passing closeout', () => {
    const { project, input } = fixture({ ok: false, steps: [{ exitCode: 8 }], after: { manifest: [{ file: 'code.js', sha256: sha('old') }] } });
    input.doneWhenConfirmed = true;
    const result = summarize(project, input);
    expect(result.hasFailure).toBe(true);
    expect(result.closeInput.stage).toBe('partial');
    expect(result.closeInput.checks[0].result).toBe('unverified');
  });
  it('reports browser observation separately from passed tests and rejects overwritten summaries', () => {
    const { project, input } = fixture({ source: 'Codex current in-app browser tab', status: 'captured', detail: 'preview only' });
    const result = summarize(project, input);
    expect(result.reports[0].result).toBe('observed');
    expect(result.closeInput.doneWhenConfirmed).toBe(false);
    writeSummary(project, 'out', result);
    expect(JSON.parse(readFileSync(path.join(project, 'out/task-close-input.json'))).stage).toBe('partial');
    expect(() => writeSummary(project, 'out', result)).toThrow('preserved');
  });
  it('marks a source fingerprint or pinned report mismatch stale', () => {
    const { project, input } = fixture({ schemaVersion: 1, exitCode: 0,
      after: { manifest: [{ file: 'code.js', sha256: sha('previous') }] } });
    expect(summarize(project, input).reports[0].result).toBe('stale');
    input.reports[0].sha256 = '0'.repeat(64);
    expect(summarize(project, input).reports[0].result).toBe('stale');
  });
  it('does not mark skipped checks passed and rejects escaped paths', () => {
    const { project, input } = fixture({ schemaVersion: 1, exitCode: 0, outcome: 'skip' });
    expect(summarize(project, input).reports[0].result).toBe('unverified');
    input.paths = ['../outside'];
    expect(() => summarize(project, input)).toThrow('outside');
  });
});

function personnelTab({ slot = 1, selected = true, failure = false } = {}) {
  const state = { selected, clicks: [], skin: 'drum-room' };
  const locator = name => {
    const known = ['查看常无欲', '外观'].includes(name);
    return { count: async () => known ? 1 : 0, isVisible: async () => known,
      getAttribute: async () => name === '查看常无欲' ? String(state.selected) : failure ? 'false' : 'true',
      click: async () => {
        if (name === '外观' && failure) throw new Error('connection lost after character selection');
        state.clicks.push(name); state.selected = true;
      } };
  };
  const tab = { url: async () => 'http://localhost:5200/', screenshot: async () => Buffer.from('fixture'),
    dev: { logs: async () => [] },
    playwright: { domSnapshot: async () => `档案 / ${String(slot).padStart(2, '0')} button 查看常无欲 button 外观`,
      getByRole: (_role, options) => locator(options.name),
      locator: () => ({ getAttribute: async () => state.skin, evaluateAll: async () => [{ complete: true, width: 1659, height: 948 }] }) } };
  return { tab, state };
}
describe('resumable current-tab personnel recipe', () => {
  it('requires a real boolean for an equipment write', async () => {
    const project = root();
    const { tab } = personnelTab();
    await expect(previewPersonnelSkin(tab, { root: project, directory: 'proof', slot: 1,
      characterName: '常无欲', skinId: 'drum-room', skinName: '余响·鼓房', apply: 'false' })).rejects.toThrow('boolean');
  });
  it('does not repeat navigation when already at the target preview', async () => {
    const project = root();
    const { tab, state } = personnelTab();
    const result = await previewPersonnelSkin(tab, { root: project, directory: 'proof', slot: 1, characterName: '常无欲', skinId: 'drum-room', skinName: '余响·鼓房' });
    expect(result.status).toBe('preview-observed');
    expect(state.clicks).toEqual([]);
    expect(result.inputKind).toBe('static-inspection');
  });
  it('refuses a different active slot without switching or resetting it', async () => {
    const project = root();
    const { tab, state } = personnelTab({ slot: 2 });
    const result = await previewPersonnelSkin(tab, { root: project, directory: 'proof', slot: 1, characterName: '常无欲', skinId: 'drum-room', skinName: '余响·鼓房' });
    expect(result.status).toBe('inconclusive');
    expect(state.clicks).toEqual([]);
  });
  it('persists completed actions when the next operation loses its connection', async () => {
    const project = root();
    const { tab } = personnelTab({ selected: false, failure: true });
    const result = await previewPersonnelSkin(tab, { root: project, directory: 'proof', slot: 1, characterName: '常无欲', skinId: 'drum-room', skinName: '余响·鼓房' });
    expect(result.status).toBe('inconclusive');
    expect(result.actions).toEqual(['choose-character']);
    const saved = JSON.parse(readFileSync(path.join(project, 'proof/personnel-route.json')));
    expect(saved.errors[0]).toContain('connection lost');
  });
});
