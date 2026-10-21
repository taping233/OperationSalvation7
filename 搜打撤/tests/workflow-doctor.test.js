import { execFileSync } from 'node:child_process';
import { symlinkSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { doctor } from '../scripts/workflow-doctor.mjs';

const roots = [];
const packages = ['vite', 'vitest', 'eslint', 'typescript', 'acorn', 'acorn-walk', 'jsdom'];
const put = (root, file, content) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
};
function fixture({ omit = [], brokenDocs = false, nodeModules = true } = {}) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-doctor-'));
  roots.push(root);
  const files = {
    'package.json': JSON.stringify({ name: 'codename7-soudache-game', version: '0.60.0', type: 'module', devDependencies: Object.fromEntries(packages.map(name => [name, '^1.0.0'])) }),
    'package-lock.json': JSON.stringify({ lockfileVersion: 3, packages: Object.fromEntries(packages.map(name => ['node_modules/' + name, { version: '1.0.0' }])) }),
    'README.md': '# Project', 'docs/README.md': brokenDocs ? '[broken](missing.md)' : '# Docs',
    'docs/QUICKSTART.md': '# Start', 'docs/WORKFLOW-TOOLS.md': '# Tools', 'docs/quality-gates.md': '# Gates',
    'docs/PARALLEL-REGISTRY.md': '## 活跃登记\n| owner | scope | item | date | status |\n|---|---|---|---|---|\n| Friday（WF-done） | scripts/local.mjs | 完成 | 10-02 | 完成未提交 |\n## 近期已释放\n| owner | scope | item | date |\n|---|---|---|---|\n',
    'docs/PENDING.md': '## 活账\n| id | item | date | source | note |\n|---|---|---|---|---|\n| ~~1~~ | 完成 | 10-02 | fixture | 完结 |\n## 已决记录\n| id | item | date | source | note |\n|---|---|---|---|---|\n',
    '.githooks/pre-commit': '#!/bin/sh\nexit 0', 'scripts/workflow.mjs': '// fixture',
    'scripts/acceptance-gate.mjs': '// fixture', 'node_modules/vitest/vitest.mjs': '// fixture',
    'node_modules/eslint/bin/eslint.js': '// fixture', 'node_modules/typescript/bin/tsc': '// fixture',
  };
  for (const name of packages) files[`node_modules/${name}/package.json`] = JSON.stringify({ name, version: '1.0.0', engines: { node: '>=18' } });
  for (const [file, content] of Object.entries(files)) {
    if (!omit.includes(file) && (nodeModules || !file.startsWith('node_modules/'))) put(root, file, content);
  }
  const probes = [];
  const probe = request => {
    probes.push(request);
    const args = request.args;
    if (request.program !== 'git') return { status: 0, stdout: '10.0.0\n' };
    if (args[0] === '--version') return { status: 0, stdout: 'git version fixture\n' };
    if (args.includes('--show-toplevel')) return { status: 0, stdout: root + '\n' };
    if (args.includes('--git-path')) return { status: 0, stdout: '.githooks/pre-commit\n' };
    if (args[0] === 'config') return { status: 0, stdout: 'file:.git/config\t.githooks\n' };
    throw new Error('unexpected probe');
  };
  return { root, probe, probes, files };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-doctor-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});
const item = (report, id) => report.checks.find(check => check.id === id);

describe('只读项目 doctor', () => {
  it('沿用真实文档/台账模型；完成未提交、无证明/CI不误报；不写文件或运行检查', async () => {
    const { root, probe, probes, files } = fixture();
    const before = Object.keys(files).map(file => readFileSync(path.join(root, file)));
    const report = await doctor(root, { probe });
    expect(report.ok).toBe(true);
    expect(report.project).toMatchObject({ name: 'codename7-soudache-game', version: '0.60.0', root });
    expect(item(report, 'registry')).toMatchObject({ status: 'info', details: { counts: { editing: 0, 'complete-uncommitted': 1 } } });
    expect(item(report, 'pending').details.counts).toEqual({ open: 0, resolved: 1 });
    expect(item(report, 'hooks')).toMatchObject({ status: 'passed', details: { present: true } });
    expect(item(report, 'evidence').status).toBe('not-checked');
    expect(item(report, 'ci').status).toBe('not-checked');
    expect(report.summary.blocked).toBe(0);
    for (let index = 0; index < before.length; index++) expect(readFileSync(path.join(root, Object.keys(files)[index]))).toEqual(before[index]);
    expect(existsSync(path.join(root, 'docs/evidence'))).toBe(false);
    expect(probes.every(request => request.program === 'git' || request.args.includes('--version'))).toBe(true);
    for (const command of ['install', 'commit', 'add']) expect(probes.flatMap(request => request.args)).not.toContain(command);
  });
  it('单项缺失或EPERM隔离，依赖/文档/台账检查仍完成且建议不执行', async () => {
    const { root, probe } = fixture({ omit: ['node_modules/eslint/package.json'], brokenDocs: true });
    const denied = request => request.program === 'git' ? { error: Object.assign(new Error('spawn EPERM'), { code: 'EPERM' }), status: null } : probe(request);
    const report = await doctor(root, { probe: denied });
    expect(report.ok).toBe(false);
    expect(item(report, 'git')).toMatchObject({ status: 'blocked', details: { code: 'EPERM' } });
    expect(item(report, 'dependencies')).toMatchObject({ status: 'blocked', details: { missing: ['eslint'] } });
    expect(item(report, 'documentation').status).toBe('blocked');
    expect(item(report, 'registry').status).toBe('info');
    expect(item(report, 'hooks').status).toBe('not-checked');
    expect(item(report, 'ci').status).toBe('not-checked');
  });
  it('锁文件版本漂移是有明确来源的warning，不声称字节或engine已核', async () => {
    const { root, probe } = fixture();
    put(root, 'node_modules/eslint/package.json', JSON.stringify({ name: 'eslint', version: '2.0.0', engines: { node: '>=24' } }));
    const report = await doctor(root, { probe });
    expect(item(report, 'dependencies')).toMatchObject({ status: 'warning', details: { mismatched: ['eslint'] } });
    expect(item(report, 'dependencies').details.engines).toContain('不推断');
  });
  it('两种报告只展示recorded元数据，历史passed不承诺当前复用资格', async () => {
    const { root, probe } = fixture();
    for (const kind of ['automated-local-check', 'staged-snapshot-check']) {
      const file = `docs/evidence/fixture/${kind}.json`;
      put(root, file, JSON.stringify({ kind, outcome: 'passed', exitCode: 0, validation: { mode: 'quick' }, log: 'missing.log' }));
      const report = await doctor(root, { probe, input: file });
      expect(item(report, 'evidence')).toMatchObject({ status: 'info', details: { kind, recordedOutcome: 'passed', currentEligibility: 'not-checked' } });
      expect(item(report, 'evidence').details).not.toHaveProperty('eligibleForReview');
      expect(report.ok).toBe(true);
    }
  });
  it('拒绝项目外输入、坏JSON和未知报告，但不破坏其他检查', async () => {
    const { root, probe } = fixture();
    for (const [input, content] of [['../outside.json', null], ['docs/evidence/bad.json', '{bad'], ['docs/evidence/unknown.json', '{"kind":"other"}']]) {
      if (content) put(root, input, content);
      const report = await doctor(root, { probe, input });
      expect(item(report, 'evidence').status).toBe('warning');
      expect(item(report, 'documentation').status).toBe('passed');
      expect(item(report, 'registry').status).toBe('info');
    }
  });
  it('可选selection真实校验测试列表，缺失测试拒绝而不写证据', async () => {
    const { root, probe } = fixture();
    put(root, 'tests/local.test.js', '// fixture');
    const valid = await doctor(root, { probe, tests: ['tests/local.test.js'] });
    expect(item(valid, 'selection')).toMatchObject({ status: 'passed', details: { selection: { mode: 'targeted', tests: ['tests/local.test.js'] } } });
    const missing = await doctor(root, { probe, tests: ['tests/missing.test.js'] });
    expect(item(missing, 'selection').status).toBe('blocked');
    expect(missing.ok).toBe(false);
    expect(existsSync(path.join(root, 'docs/evidence'))).toBe(false);
  });
  it('检查新增直接依赖，显示可读 node_modules 链接但不把链接等同锁一致', async () => {
    const { root, probe } = fixture();
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    pkg.devDependencies['new-tool'] = '1.0.0';
    put(root, 'package.json', JSON.stringify(pkg));
    const report = await doctor(root, { probe });
    expect(item(report, 'dependencies')).toMatchObject({ status: 'blocked', details: {
      missing: ['new-tool'], nodeModules: { linked: false, targetReadable: true } } });
    const { root: linkedRoot, probe: linkedProbe } = fixture({ nodeModules: false });
    expect(existsSync(path.join(linkedRoot, 'node_modules'))).toBe(false);
    symlinkSync(path.join(root, 'node_modules'), path.join(linkedRoot, 'node_modules'), 'junction');
    const linked = await doctor(linkedRoot, { probe: linkedProbe });
    expect(item(linked, 'dependencies').details.nodeModules).toEqual({ linked: true, targetReadable: true });
  });
  it('node_modules 缺失仍列出缺包，失效链接标记不可读', async () => {
    const { root, probe } = fixture({ nodeModules: false });
    expect(existsSync(path.join(root, 'node_modules'))).toBe(false);
    const absent = await doctor(root, { probe });
    expect(item(absent, 'dependencies')).toMatchObject({ status: 'blocked', details: {
      missing: packages, nodeModules: { linked: false, targetReadable: false } } });
    symlinkSync(path.join(root, 'missing-modules'), path.join(root, 'node_modules'), 'junction');
    const broken = await doctor(root, { probe });
    expect(item(broken, 'dependencies')).toMatchObject({ status: 'blocked', details: {
      missing: packages, nodeModules: { linked: true, targetReadable: false } } });
  });
  it('无 Git 的恢复副本明确不可冻结运行，其他诊断继续', async () => {
    const { root, probe } = fixture();
    const report = await doctor(root, { staged: true, probe: request => request.args.includes('--show-toplevel')
      ? { status: 128 } : probe(request) });
    expect(report.ok).toBe(false);
    expect(item(report, 'staged-readiness')).toMatchObject({ status: 'blocked', details: {
      canRun: false, mode: 'unavailable', executed: false, passed: false } });
    expect(item(report, 'registry').status).toBe('info');
  });
  it('冻结预检复用全部锁依赖检查，缺传递包先阻断且不生成执行证据', async () => {
    const { root, probe } = fixture();
    const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
    const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    lock.packages[''] = { devDependencies: pkg.devDependencies };
    lock.packages['node_modules/transitive-tool'] = { version: '1.0.0' };
    put(root, 'package-lock.json', JSON.stringify(lock));
    put(root, 'node_modules/.package-lock.json', JSON.stringify(lock));
    const git = args => execFileSync('git', args, { cwd: root, stdio: 'pipe' });
    git(['init', '-q']);
    git(['add', 'package.json']);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=' + path.join(root, 'no-hooks'), 'commit', '--allow-empty', '-qm', 'fixture']);
    git(['add', 'package.json', 'package-lock.json']);
    const blocked = await doctor(root, { probe, staged: true });
    expect(item(blocked, 'staged-readiness')).toMatchObject({ status: 'blocked', details: {
      canRun: false, mode: 'pending-snapshot-selection', executed: false, passed: false,
      blocked: ['node_modules/transitive-tool 未安装'] } });
    put(root, 'node_modules/transitive-tool/package.json', '{"version":"1.0.0"}');
    const ready = await doctor(root, { probe, staged: true });
    expect(item(ready, 'staged-readiness')).toMatchObject({ status: 'info', details: {
      canRun: true, executed: false, passed: false, reusableReceipt: false, blocked: [] } });
    expect(existsSync(path.join(root, 'docs/evidence'))).toBe(false);
    expect(existsSync(path.join(root, 'dist'))).toBe(false);
    git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.test', '-c', 'core.hooksPath=' + path.join(root, 'no-hooks'), 'commit', '-qm', 'lock fixture']);
    const empty = await doctor(root, { probe, staged: true });
    expect(item(empty, 'staged-readiness')).toMatchObject({ status: 'info', details: {
      canRun: false, mode: 'skip', executed: false, passed: false, reusableReceipt: false } });
    await expect(doctor(root, { probe, staged: true, tests: ['tests/a.test.js'] })).rejects.toThrow('不能');
  });

});
