import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { fingerprint, freshness } from '../scripts/workflow-evidence.mjs';
import { dependencyScope, documentationInputs } from '../scripts/workflow-dependencies.mjs';
import { gateInputScope } from '../scripts/workflow-gate-receipt.mjs';

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
  it('真实task测试只锁实际import和契约，不锁音效、战斗、项目台账或archive', () => {
    const sourceRoot = process.cwd(), roots = ['tests/workflow-task.test.js'];
    const actual = fingerprint(sourceRoot, { roots });
    expect(actual.selection.mode).toBe('targeted');
    expect(actual.manifest.some(entry => /^(?:game\/.*(?:audio|battle)|docs\/archive|docs\/evidence)/.test(entry.file))).toBe(false);
    expect(actual.manifest.map(entry => entry.file)).toEqual(expect.arrayContaining([
      'tests/workflow-task.test.js', 'scripts/workflow-task.mjs', 'scripts/workflow-ledger.mjs', 'scripts/workflow-dependencies.mjs',
    ]));
    const gate = gateInputScope(sourceRoot, { entries: [], prefix: '' }, { mode: 'quick', tests: roots });
    expect(gate.code).toBe('project'); expect(gate.relatedFiles).toEqual([]); expect(gate.mediaFiles).toEqual([]);
    const root = fixture();
    for (const file of actual.selection.files) {
      mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
      writeFileSync(path.join(root, file), readFileSync(path.join(sourceRoot, file)));
    }
    mkdirSync(path.join(root, 'docs/archive/unrelated'), { recursive: true });
    const scope = { roots }, before = fingerprint(root, scope);
    const report = { schemaVersion: 1, exitCode: 0, before, after: before };
    writeFileSync(path.join(root, 'game/src/audio/unrelated.js'), 'different audio');
    writeFileSync(path.join(root, 'docs/archive/unrelated/README.md'), 'different history');
    expect(freshness(report, fingerprint(root, scope)).eligibleForReview).toBe(true);
    for (const file of ['tests/workflow-task.test.js', 'scripts/workflow-task.mjs', 'scripts/workflow-dependencies.mjs']) {
      writeFileSync(path.join(root, file), readFileSync(path.join(root, file), 'utf8') + '\n// related change');
      expect(freshness(report, fingerprint(root, scope)).codeEligibleForReview).toBe(false);
    }
  });
  it('fixture契约只放行显式模块，新导入的不透明I/O及未知workflow测试仍退回project', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'tests/workflow-task.test.js'), "import '../scripts/workflow-task.mjs';");
    writeFileSync(path.join(root, 'scripts/workflow-task.mjs'), "import './unknown.mjs';");
    writeFileSync(path.join(root, 'scripts/unknown.mjs'), "import {readFileSync as alias} from 'node:fs'; alias('unknown');");
    expect(dependencyScope(root, ['tests/workflow-task.test.js']).mode).toBe('project');
    writeFileSync(path.join(root, 'tests/workflow-new.test.js'), "import {execFileSync} from 'node:child_process'; execFileSync('unknown');");
    expect(dependencyScope(root, ['tests/workflow-new.test.js']).mode).toBe('project');
    writeFileSync(path.join(root, 'scripts/workflow-task.mjs'), "import {readFileSync} from 'node:fs'; readFileSync('fixture');");
    writeFileSync(path.join(root, 'tests/workflow-new.test.js'), "import '../scripts/workflow-task.mjs';");
    expect(dependencyScope(root, ['tests/workflow-task.test.js', 'tests/workflow-new.test.js']).mode).toBe('project');
  });
  it('docs命令契约锁当前目录、清单目标、替代入口与link存在，不锁全部archive原文', () => {
    const root = fixture();
    writeFileSync(path.join(root, 'scripts/index-validation.mjs'), readFileSync(path.resolve('scripts/index-validation.mjs')));
    for (const directory of ['docs/archive/workflow-example', 'docs/archive/unrelated', 'game/src/new-domain']) mkdirSync(path.join(root, directory), { recursive: true });
    const put = (file, text) => writeFileSync(path.join(root, file), text);
    put('docs/RULE.md', '[target](linked.md)'); put('docs/linked.md', 'target');
    put('docs/archive/workflow-example/original.md', 'retained');
    put('docs/archive/workflow-example/manifest.json', JSON.stringify({ items: [{ source: 'old.md', target: 'docs/archive/workflow-example/original.md', replacedBy: 'scripts/index-validation.mjs', sha256: 'a'.repeat(64) }] }));
    put('docs/archive/unrelated/README.md', 'unrelated');
    const inputs = documentationInputs(root);
    expect(inputs.files).toContain('docs/archive/workflow-example/original.md');
    expect(inputs.files).not.toContain('docs/archive/unrelated/README.md');
    expect(inputs.existence).toContain('scripts/index-validation.mjs');
    const scope = { roots: ['scripts/index-validation.mjs'] }, before = fingerprint(root, scope);
    expect(before.selection.mode).toBe('targeted');
    const report = { schemaVersion: 1, exitCode: 0, before, after: before };
    put('docs/archive/unrelated/README.md', 'updated unrelated');
    expect(freshness(report, fingerprint(root, scope)).eligibleForReview).toBe(true);
    put('docs/added.md', 'new scanned doc');
    expect(freshness(report, fingerprint(root, scope)).eligibleForReview).toBe(false);
    const next = fingerprint(root, scope), nextReport = { schemaVersion: 1, exitCode: 0, before: next, after: next };
    put('docs/archive/workflow-example/original.md', 'changed retained source');
    expect(freshness(nextReport, fingerprint(root, scope)).eligibleForReview).toBe(false);
  });
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
