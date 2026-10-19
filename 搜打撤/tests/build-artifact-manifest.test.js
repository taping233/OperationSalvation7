// @vitest-environment node
import { it, expect } from 'vitest';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeBuildProvenance, verifyBuildArtifact } from '../scripts/build-artifact-manifest.mjs';
function fixture() {
  const base = mkdtempSync(path.join(tmpdir(), 'sdt-artifact-'));
  const outDir = path.join(base, 'output'), fontLicenseDir = path.join(base, 'licenses');
  mkdirSync(path.join(outDir, 'assets/fonts'), { recursive: true });
  mkdirSync(path.join(outDir, 'assets/js'), { recursive: true });
  mkdirSync(fontLicenseDir);
  writeFileSync(path.join(outDir, 'index.html'), '<script src="assets/js/main.js"></script>');
  writeFileSync(path.join(outDir, 'assets/js/main.js'), 'console.log("fixture");');
  writeFileSync(path.join(fontLicenseDir, 'LICENSE-Font.txt'), 'Original notice');
  writeFileSync(path.join(outDir, 'assets/fonts/LICENSE-Font.txt'), 'Original notice');
  return { outDir, fontLicenseDir, sourceSha: 'a'.repeat(40), runId: '123', budgetOutcome: 'failure' };
}
it('records exact SHA, failed budget and per-file hashes without claiming CI acceptance', () => {
  const input = fixture(), result = writeBuildProvenance(input);
  expect(result.sourceSha).toBe(input.sourceSha);
  expect(result.performanceBudget).toBe('failure');
  expect(result.fileCount).toBe(3);
  expect(result.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256))).toBe(true);
  expect(result.notices).toContain('assets/fonts/LICENSE-Font.txt');
  expect(result.tests).toContain('separate CI');
  expect(writeBuildProvenance(input).fileCount).toBe(3);
  expect(JSON.parse(readFileSync(path.join(input.outDir, 'build-provenance.json'))).sourceSha).toBe(input.sourceSha);
});
it('rejects missing or changed licenses and incomplete entries', () => {
  const input = fixture();
  writeFileSync(path.join(input.outDir, 'assets/fonts/LICENSE-Font.txt'), 'changed');
  expect(() => writeBuildProvenance(input)).toThrow('Missing or changed font license');
  const empty = path.join(tmpdir(), 'sdt-empty-' + Math.random());mkdirSync(empty);
  expect(() => writeBuildProvenance({ ...input, outDir: empty })).toThrow('Missing build entry');
});
it('rejects ambiguous provenance and symlinked output content', () => {
  const input = fixture();
  expect(() => writeBuildProvenance({ ...input, sourceSha: 'master' })).toThrow('Exact source');
  expect(() => writeBuildProvenance({ ...input, budgetOutcome: 'skipped' })).toThrow('Completed budget');
  symlinkSync(input.fontLicenseDir, path.join(input.outDir, 'external'), 'junction');
  expect(() => writeBuildProvenance(input)).toThrow('symlinks');
});
it('workflow archives only successful builds, preserves budget failure and limits retention', () => {
  const workflow = readFileSync('../.github/workflows/vite-quality.yml', 'utf8');
  expect(workflow).toContain('run: npm run prebuild && npm exec vite build');
  expect(workflow).toContain('run: npm run postbuild');
  expect(workflow).toContain("steps.vite.outcome == 'success'");
  expect(workflow).toContain("steps.provenance.outcome == 'success'");
  expect(workflow).not.toContain('continue-on-error');
  expect(workflow).toContain('SOURCE_SHA: ${{ github.sha }}');
  expect(workflow).toContain('path: 搜打撤/desktop-app/game/');
  expect(workflow).toContain('retention-days: 7');
  expect(workflow).toContain('contents: read');
});

it('matches archive hidden-path exclusions and reports them without removing source files', () => {
  const input = fixture();
  writeFileSync(path.join(input.outDir, 'assets/.gitkeep'), '');
  mkdirSync(path.join(input.outDir, '.hidden'));
  writeFileSync(path.join(input.outDir, '.hidden/private.txt'), 'not archived');
  const result = writeBuildProvenance(input);
  expect(result.fileCount).toBe(3);
  expect(result.excludedHiddenPaths).toEqual(['.hidden', 'assets/.gitkeep']);
  expect(readFileSync(path.join(input.outDir, '.hidden/private.txt'), 'utf8')).toBe('not archived');
  expect(result.files.some(file => file.path.includes('.hidden'))).toBe(false);
});

it('verifies downloaded files against an explicit source and retains failed budget status', () => {
  const input = fixture();writeBuildProvenance(input);
  const result = verifyBuildArtifact({ outDir: input.outDir, expectedSha: input.sourceSha });
  expect(result.verifiedFiles).toBe(3);
  expect(result.performanceBudget).toBe('failure');
  expect(() => verifyBuildArtifact({ outDir: input.outDir, expectedSha: 'b'.repeat(40) })).toThrow('provenance mismatch');
  writeFileSync(path.join(input.outDir, 'assets/js/main.js'), 'modified');
  expect(() => verifyBuildArtifact({ outDir: input.outDir, expectedSha: input.sourceSha })).toThrow('file mismatch');
});
it('rejects extra files and unsafe or duplicate manifest paths', () => {
  const input = fixture();writeBuildProvenance(input);
  const target = path.join(input.outDir, 'build-provenance.json');
  const manifest = JSON.parse(readFileSync(target, 'utf8'));
  manifest.files.push({ ...manifest.files[0] });writeFileSync(target, JSON.stringify(manifest));
  expect(() => verifyBuildArtifact({ outDir: input.outDir, expectedSha: input.sourceSha })).toThrow('duplicate');
  manifest.files.pop();manifest.files[0].path = '../outside';writeFileSync(target, JSON.stringify(manifest));
  expect(() => verifyBuildArtifact({ outDir: input.outDir, expectedSha: input.sourceSha })).toThrow('Unsafe');
  writeBuildProvenance(input);writeFileSync(path.join(input.outDir, 'unexpected.txt'), 'extra');
  expect(() => verifyBuildArtifact({ outDir: input.outDir, expectedSha: input.sourceSha })).toThrow('inventory');
});
