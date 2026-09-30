import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fingerprint, freshness } from '../scripts/workflow-evidence.mjs';
import { dependencyScope } from '../scripts/workflow-dependencies.mjs';

const owned = [];
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-dependency-test-')); owned.push(root);
  for (const dir of ['tests', 'scripts', 'game/src/audio', 'docs']) mkdirSync(path.join(root, dir), { recursive: true });
  writeFileSync(path.join(root, 'tests/target.test.js'), "import {value} from '../scripts/tool.mjs'; export const test=value;");
  writeFileSync(path.join(root, 'scripts/tool.mjs'), "import {value} from './helper.mjs'; export {value};");
  writeFileSync(path.join(root, 'scripts/helper.mjs'), 'export const value=1;');
  writeFileSync(path.join(root, 'game/src/audio/unrelated.js'), 'export const sound=1;');
  return root;
}
afterEach(() => {
  for (const root of owned.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-dependency-test-'))) throw new Error('非自有fixture');
    rmSync(root, { recursive: true, force: true });
  }
});
describe('定向输入范围', () => {
  it('关联依赖受监控，音效会话的无关源码变化不使定向代码证据失效', () => {
    const root = fixture(), scope = { roots: ['tests/target.test.js'] };
    const before = fingerprint(root, scope);
    expect(before.selection.mode).toBe('targeted');
    expect(before.manifest.map(item => item.file)).toContain('scripts/helper.mjs');
    expect(before.manifest.map(item => item.file)).not.toContain('game/src/audio/unrelated.js');
    const report = { schemaVersion: 1, exitCode: 0, before, after: before };
    writeFileSync(path.join(root, 'game/src/audio/unrelated.js'), 'export const sound=2;');
    expect(freshness(report, fingerprint(root, scope)).codeEligibleForReview).toBe(true);
    writeFileSync(path.join(root, 'scripts/helper.mjs'), 'export const value=2;');
    expect(freshness(report, fingerprint(root, scope)).codeEligibleForReview).toBe(false);
  });
  it('静态JSON输入受监控，动态import不能证明时退回完整项目', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'scripts/tool.mjs'), "import data from './data.json'; export const value=data;");
    writeFileSync(path.join(root, 'scripts/data.json'), '{}');
    expect(dependencyScope(root, ['tests/target.test.js']).files).toContain('scripts/data.json');
    writeFileSync(path.join(root, 'scripts/tool.mjs'), 'const target="./helper.mjs"; await import(target);');
    const scoped = fingerprint(root, { roots: ['tests/target.test.js'] });
    expect(scoped.selection.mode).toBe('project');
    expect(scoped.manifest.map(item => item.file)).toContain('game/src/audio/unrelated.js');
  });
  it('未知文件输入和不可达依赖保守扩大，不静默漏掉', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'scripts/tool.mjs'), 'const name="data"; readFileSync(name);');
    expect(dependencyScope(root, ['tests/target.test.js']).mode).toBe('project');
    expect(dependencyScope(root, ['tests/missing.test.js']).mode).toBe('project');
  });
});
