import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { runSteps } from '../tools/art-check.mjs';
import { captureBrowserEvidence } from '../tools/browser-evidence.mjs';

const roots = [];
const root = () => { const value = mkdtempSync(path.join(os.tmpdir(), 'art-workflow-')); roots.push(value); return value; };
afterEach(() => { for (const value of roots.splice(0)) rmSync(value, { recursive: true, force: true }); });

describe('art command exit codes', () => {
  it('preserves the native failure and never starts dependent commands', () => {
    const spawn = vi.fn(() => ({ status: 7, stdout: '', stderr: 'failed' }));
    const result = runSteps([{ name: 'first' }, { name: 'must-not-run' }], spawn);
    expect(result.exitCode).toBe(7);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(spawn.mock.calls[0][2].shell).toBe(false);
  });
  it('treats launch errors and signals as failure', () => {
    expect(runSteps([{}], () => ({ status: null, error: new Error('missing') })).ok).toBe(false);
  });
});

function tab(breakImages = false) {
  return { url: async () => 'http://localhost:5200/', screenshot: vi.fn(async () => Buffer.from('fixture screenshot')),
    playwright: { locator: () => ({ evaluateAll: async () => {
      if (breakImages) throw new Error('tab connection lost');
      return [{ src: 'skin.webp', complete: true, width: 1659, height: 948, fit: 'contain' }];
    } }) }, dev: { logs: async () => [] } };
}
describe('current-tab evidence capture', () => {
  it('keeps screenshot and declares real-input coverage without claiming gameplay passed', async () => {
    const project = root();
    const target = tab();
    const result = await captureBrowserEvidence(target, { root: project, directory: 'evidence', inputKind: 'real-input', detail: 'clicked skin preview' });
    expect(result.status).toBe('captured');
    expect(result.inputKind).toBe('real-input');
    expect(result.images[0].fit).toBe('contain');
    expect(target.screenshot).toHaveBeenCalledTimes(1);
    expect(readFileSync(path.join(project, 'evidence/page.png')).toString()).toBe('fixture screenshot');
    await expect(captureBrowserEvidence(target, { root: project, directory: 'evidence', inputKind: 'real-input', detail: 'repeat' })).rejects.toThrow('preserved');
  });
  it('retains the screenshot if the connection fails during later inspection', async () => {
    const project = root();
    const result = await captureBrowserEvidence(tab(true), { root: project, directory: 'evidence', inputKind: 'static-inspection', detail: 'image state only' });
    expect(result.status).toBe('inconclusive');
    expect(result.screenshot.bytes).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(path.join(project, 'evidence/page.json'))).errors).toEqual(['tab connection lost']);
  });
  it('rejects directory escapes and undeclared input provenance', async () => {
    const project = root();
    mkdirSync(path.join(project, 'inside'));
    await expect(captureBrowserEvidence(tab(), { root: project, directory: '../escape', inputKind: 'real-input', detail: 'x' })).rejects.toThrow('inside');
    await expect(captureBrowserEvidence(tab(), { root: project, directory: 'inside' })).rejects.toThrow('Declare');
  });
});
