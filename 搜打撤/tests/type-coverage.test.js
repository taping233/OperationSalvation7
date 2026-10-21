// @vitest-environment node
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { auditTypeCoverage } from '../scripts/check-type-coverage.mjs';

function fixture() {
  const root = fs.mkdtempSync(path.resolve('.tmp/type-coverage-test-'));
  for (const dir of ['game/src', 'game/data', 'tests', '.tmp']) fs.mkdirSync(path.join(root, dir), { recursive:true });
  fs.writeFileSync(path.join(root, 'game/src/checked.js'), 'export const checked = 1;\n');
  fs.writeFileSync(path.join(root, 'game/src/standalone.js'), 'export const standalone = 2;\n');
  return root;
}
function config(root, name, overrides = {}) {
  fs.writeFileSync(path.join(root, name), JSON.stringify({ compilerOptions: {
    target:'ESNext', module:'ESNext', moduleResolution:'Bundler', allowJs:true,
    checkJs:true, strict:false, noEmit:true, types:[],
  }, include:['game/src/**/*.js'], ...overrides }));
}

describe('implementation coverage compiler probes', () => {
  it('counts real checking and strict checking separately, not imported or listed JS', async () => {
    const root = fixture();
    config(root, 'check.json');
    config(root, 'fixture-only.json', { compilerOptions:{allowJs:true,checkJs:false,noEmit:true,types:[]} });
    config(root, 'strict.json', { compilerOptions:{allowJs:true,checkJs:true,strict:true,noEmit:true,types:[]} });
    const report = await auditTypeCoverage({root, configs:['check.json','fixture-only.json','strict.json']});
    expect(report.implementationChecked).toBe(2);
    expect(report.strictChecked).toBe(2);
    expect(report.configs[1].checked).toEqual([]);
    expect(report.configs[1].loaded).toHaveLength(2);
  });
  it('detects excluded, unlisted and ts-nocheck implementations with real compiler diagnostics', async () => {
    const root = fixture();
    config(root, 'excluded.json', {exclude:['game/src/standalone.js']});
    config(root, 'listed.json', {include:undefined,files:['game/src/checked.js']});
    for (const name of ['excluded.json','listed.json']) {
      const report = await auditTypeCoverage({root,configs:[name]});
      expect(report.files.filter(file=>!file.checkedBy.length).map(file=>file.file)).toEqual(['game/src/standalone.js']);
    }
    fs.writeFileSync(path.join(root,'game/src/standalone.js'), '// @ts-nocheck\nexport const standalone = 2;\n');
    config(root, 'suppressed.json');
    const report = await auditTypeCoverage({root,configs:['suppressed.json']});
    expect(report.files.filter(file=>!file.checkedBy.length).map(file=>file.file)).toEqual(['game/src/standalone.js']);
  });
  it('includes new TypeScript implementations in the denominator even if the JS config omits them', async () => {
    const root = fixture();
    fs.writeFileSync(path.join(root,'game/src/future.ts'), 'export const future = 1;\n');
    config(root, 'check.json');
    const report = await auditTypeCoverage({root,configs:['check.json']});
    expect(report.denominator).toBe(3);
    expect(report.files.filter(file=>!file.checkedBy.length).map(file=>file.file)).toEqual(['game/src/future.ts']);
  });
});
