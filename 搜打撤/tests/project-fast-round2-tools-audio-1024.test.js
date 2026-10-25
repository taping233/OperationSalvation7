// @vitest-environment node
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it, vi } from 'vitest';
import { collectAudit } from '../scripts/dependency-audit-diagnostics.mjs';
import { SampleOnlyPlayer } from '../game/src/audio/sound.samples.player.js';

it('uses an executable npm entry on the current platform without issuing network requests', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-audit-platform-'));
  const output = path.join(root, 'audit.json');
  const report = { auditReportVersion: 2, vulnerabilities: {}, metadata: {
    vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 }, dependencies: { total: 1 },
  } };
  collectAudit(output, null, { run(command, args, options) {
    // Exercise only the exact platform launcher prefix with --version. The
    // returned audit result is a fixture; no audit/network request is made.
    expect(args.slice(-6)).toEqual(['audit', '--package-lock-only', '--ignore-scripts', '--json',
      '--registry=https://registry.npmjs.org/', '--audit-level=info']);
    const versionArgs = [...args.slice(0, -6), '--version'];
    const result = spawnSync(command, versionArgs, { ...options, timeout: 5000 });
    expect(result.error?.code).toBeUndefined();
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
    return { status: 0, stdout: JSON.stringify(report) };
  }, emit() {} });
  expect(JSON.parse(readFileSync(output, 'utf8'))).toEqual(report);
});

it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])('silently drops the unknown sample event %s', name => {
  const createBufferSource = vi.fn();
  const player = new SampleOnlyPlayer({ state: 'running', createBufferSource }, {});
  expect(player.play(name)).toBe(false);
  expect(createBufferSource).not.toHaveBeenCalled();
  expect(player.voices.size).toBe(0);
});
