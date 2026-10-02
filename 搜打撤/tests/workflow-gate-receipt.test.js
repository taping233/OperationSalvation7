import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runStaged, stagedPlan } from '../scripts/workflow-staged.mjs';
import { dependencyBytes, gateInputScope, gateReceipt, inspectGateReceipt, verifyGateReceipt } from '../scripts/workflow-gate-receipt.mjs';

const roots = [];
function fixture() {
  const repo = mkdtempSync(path.join(os.tmpdir(), 'sdt-receipt-test-')); roots.push(repo);
  const root = path.join(repo, '搜打撤');
  for (const dir of ['scripts', 'tests', 'node_modules', 'docs']) mkdirSync(path.join(root, dir), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: repo, encoding: 'utf8' });
  writeFileSync(path.join(root, 'package.json'), '{"type":"module","dependencies":{}}');
  writeFileSync(path.join(root, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"":{"dependencies":{}}}}');
  writeFileSync(path.join(root, 'node_modules/.package-lock.json'), '{"packages":{}}');
  writeFileSync(path.join(repo, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(root, 'scripts/value.mjs'), 'base');
  writeFileSync(path.join(root, 'docs/STATUS.md'), 'base');
  writeFileSync(path.join(root, 'docs/guide.md'), 'base');
  writeFileSync(path.join(root, 'asset.png'), 'base image');
  writeFileSync(path.join(root, 'tests/fixture.test.js'), '// fixture selected test');
  writeFileSync(path.join(root, 'scripts/acceptance-gate.mjs'), `import {readFileSync} from 'node:fs';
if(process.argv.includes('--plan')) console.log(JSON.stringify({mode:'quick',paths:['scripts/value.mjs'],tests:['tests/fixture.test.js'],reasons:[]}));
else if(readFileSync('scripts/value.mjs','utf8')!=='staged') process.exitCode=9;
else console.log('fixture gate passed');`);
  git('init', '-q'); git('add', '.'); git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'base');
  writeFileSync(path.join(root, 'scripts/value.mjs'), 'staged'); git('add', '搜打撤/scripts/value.mjs');
  return { root, repo, git, verify: file => verifyGateReceipt(root, file, stagedPlan(root)) };
}
const options = { task: 'receipt', date: '2026-10-02', json: true };
function linkOrSkip(context, target, location, type = 'file') {
  try { symlinkSync(target, location, type); }
  catch (error) {
    if (process.platform === 'win32' && ['EPERM', 'EACCES', 'ENOTSUP'].includes(error.code)) {
      context.skip();
    } else throw error;
  }
}
function executable(f) {
  mkdirSync(path.join(f.root, 'node_modules/.bin'), { recursive: true });
  mkdirSync(path.join(f.root, 'node_modules/example/bin'), { recursive: true });
  const file = path.join(f.root, 'node_modules/example/bin/cli.js');
  writeFileSync(file, '#!/usr/bin/env node\nconsole.log("fixture");\n');
  return { file, link: path.join(f.root, 'node_modules/.bin/example') };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-receipt-test-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
    if (existsSync(root) && process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Remove-Item -LiteralPath $env:SDT_RECEIPT_TEST_CLEANUP_PATH -Recurse -Force -ErrorAction Stop'], { env: { ...process.env, SDT_RECEIPT_TEST_CLEANUP_PATH: root } });
  }
});

describe('冻结 index 成功报告的严格复用', () => {
  it('静态资产审计锁完整资产目录与债务登记，质量配置变更范围也进指纹', () => {
    const f = fixture(), plan = stagedPlan(f.root);
    const gate = { mode: 'quick', tests: [] }, scope = gateInputScope(f.root, plan, gate);
    expect(scope.relatedFiles).toContain('docs/asset-audit-debt.json');
    expect(scope.existence).toContain('docs/asset-audit-debt.json');
    const receipt = gateReceipt(plan, gate, 'dependencies', scope);
    for (const file of ['game/assets/new.png', 'game/assets/asset-manifest.json', 'docs/asset-audit-debt.json']) {
      const changed = { ...plan, entries: [...plan.entries, { file: plan.prefix + '/' + file, mode: '100644', object: 'asset-object', stage: 0 }] };
      expect(gateReceipt(changed, gate, 'dependencies', scope).entriesSha256, file).not.toBe(receipt.entriesSha256);
    }
    for (const file of ['eslint.config.js', 'jsconfig.json', 'vitest.config.mjs', '.githooks/pre-commit', 'game/assets/new.png', 'docs/asset-audit-debt.json']) {
      const changed = { ...plan, changes: [...plan.changes, { path: file, status: 'M' }] };
      expect(gateReceipt(changed, gate, 'dependencies', scope).changesSha256, file).not.toBe(receipt.changesSha256);
    }
  });
  it('标准 npm .bin 文件链接保留文本与目标字节，隔离副本摘要一致', context => {
    const f = fixture(), bin = executable(f);
    linkOrSkip(context, '../example/bin/cli.js', bin.link);
    const copiedRoot = path.join(f.repo, 'copy');
    const before = dependencyBytes(f.root, { destination: path.join(copiedRoot, 'node_modules') });
    const copied = path.join(copiedRoot, 'node_modules/.bin/example');
    expect(lstatSync(copied).isSymbolicLink()).toBe(true);
    expect(readlinkSync(copied)).toBe(readlinkSync(bin.link));
    expect(readFileSync(copied)).toEqual(readFileSync(bin.file));
    expect(dependencyBytes(copiedRoot)).toBe(before);
    writeFileSync(bin.file, 'changed target');
    expect(dependencyBytes(f.root)).not.toBe(before);
  });
  it('相同目标字节也锁定链接文本，并在 POSIX 锁定执行位', context => {
    const f = fixture(), bin = executable(f);
    writeFileSync(path.join(f.root, 'node_modules/example/bin/other.js'), readFileSync(bin.file));
    linkOrSkip(context, '../example/bin/cli.js', bin.link);
    const before = dependencyBytes(f.root);
    unlinkSync(bin.link); // Only this test's own temporary link.
    linkOrSkip(context, '../example/bin/other.js', bin.link);
    expect(dependencyBytes(f.root)).not.toBe(before);
    if (process.platform !== 'win32') {
      const linked = dependencyBytes(f.root);
      chmodSync(bin.file, 0o755);
      expect(dependencyBytes(f.root)).not.toBe(linked);
    }
  });
  for (const [kind, value] of [
    ['越界', '../../outside.js'], ['绝对路径', 'absolute'], ['悬空', '../example/bin/missing.js'],
    ['目录', '../example/bin'], ['自循环', '../.bin/example'], ['缓存', '../.cache/cli.js'],
  ]) it('拒绝' + kind + ' .bin 链接', context => {
    const f = fixture(), bin = executable(f);
    writeFileSync(path.join(f.root, 'outside.js'), 'outside');
    mkdirSync(path.join(f.root, 'node_modules/.cache'), { recursive: true });
    writeFileSync(path.join(f.root, 'node_modules/.cache/cli.js'), 'cache');
    const target = value === 'absolute' ? bin.file : value;
    linkOrSkip(context, target, bin.link, kind === '目录' ? 'dir' : 'file');
    expect(() => dependencyBytes(f.root)).toThrow();
  });
  it('拒绝包内链接、链式文件链接与目录中转链接', context => {
    const f = fixture(), bin = executable(f);
    const alias = path.join(f.root, 'node_modules/example/bin/alias.js');
    linkOrSkip(context, 'cli.js', alias);
    linkOrSkip(context, '../example/bin/alias.js', bin.link);
    expect(() => dependencyBytes(f.root)).toThrow('普通文件');
    unlinkSync(bin.link);
    expect(() => dependencyBytes(f.root)).toThrow('非受控');
    unlinkSync(alias);
    const directory = path.join(f.root, 'node_modules/example/linked');
    linkOrSkip(context, 'bin', directory, 'dir');
    linkOrSkip(context, '../example/linked/cli.js', bin.link);
    expect(() => dependencyBytes(f.root)).toThrow('普通文件');
  });
  it('拒绝依赖包目录链接，包括无需管理员权限的 Windows junction', context => {
    const f = fixture();
    executable(f);
    linkOrSkip(context, path.join(f.root, 'node_modules/example'), path.join(f.root, 'node_modules/linked'),
      process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => dependencyBytes(f.root)).toThrow('非受控');
  });
  it('带真实 .bin 链接的隔离验收可复用，目标字节变化使报告失效', async context => {
    const f = fixture(), bin = executable(f);
    linkOrSkip(context, '../example/bin/cli.js', bin.link);
    const result = await runStaged(f.root, options);
    expect(result.outcome).toBe('passed');
    expect(f.verify(result.report).mode).toBe('quick');
    writeFileSync(bin.file, 'changed executable');
    expect(() => f.verify(result.report)).toThrow('依赖字节');
  }, 60_000);
  it('真实隔离报告可复用；证据、状态暂存和纯状态 HEAD 前进不废弃代码证据', async () => {
    const f = fixture(), start = performance.now(), result = await runStaged(f.root, options);
    const isolatedMs = performance.now() - start, verifyStart = performance.now();
    expect(result.outcome).toBe('passed'); expect(f.verify(result.report).mode).toBe('quick');
    const reuseMs = performance.now() - verifyStart;
    console.log(JSON.stringify({ isolatedMs, reuseMs }));
    writeFileSync(path.join(f.root, 'docs/STATUS.md'), 'updated');
    f.git('add', '搜打撤/docs/STATUS.md', '搜打撤/docs/evidence');
    expect(f.verify(result.report).mode).toBe('quick');
    f.git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'state only', '--only', '搜打撤/docs/STATUS.md');
    expect(f.verify(result.report).mode).toBe('quick');
    writeFileSync(path.join(f.root, 'docs/guide.md'), 'ordinary docs changed');
    writeFileSync(path.join(f.root, 'asset.png'), 'unrelated media changed');
    f.git('add', '搜打撤/docs/guide.md', '搜打撤/asset.png');
    expect(f.verify(result.report).mode).toBe('quick');
    f.git('-c', 'user.name=fixture', '-c', 'user.email=f@x.invalid', 'commit', '-qm', 'ordinary docs only', '--only', '搜打撤/docs/guide.md');
    expect(f.verify(result.report).mode).toBe('quick');
  }, 60_000);
  it('提交门在真实混树中 --reuse 成功，不用逃生变量且不改源 index', async () => {
    const f = fixture(), result = await runStaged(f.root, options);
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs', 'architecture-graph.mjs', 'workflow-gate-receipt.mjs', 'workflow-staged.mjs', 'workflow-dependencies.mjs']) {
      writeFileSync(path.join(f.root, 'scripts', name), readFileSync(path.resolve('scripts', name)));
    }
    writeFileSync(path.join(f.root, 'scripts/architecture-graph.mjs'), 'export const analyzeModule = () => ({ imports: [] });');
    writeFileSync(path.join(f.root, 'scripts/value.mjs'), 'foreign unfinished');
    writeFileSync(path.join(f.root, 'scripts/foreign.mjs'), 'unfinished');
    const index = readFileSync(path.join(f.repo, '.git/index')), env = { ...process.env };
    delete env.GATE_MANIFEST_OK; delete env.GATE_RECEIPT;
    const checked = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--staged', '--run', '--reuse', result.report], { cwd: f.root, encoding: 'utf8', env });
    expect(checked.status, checked.stderr).toBe(0); expect(checked.stdout).toContain('REUSED');
    expect(readFileSync(path.join(f.repo, '.git/index'))).toEqual(index);
    const temporaryIndex = path.join(f.repo, '.git/fixture-commit-index');
    writeFileSync(temporaryIndex, index);
    execFileSync('git', ['update-index', '--assume-unchanged', '搜打撤/scripts/value.mjs'], {
      cwd: f.repo, env: { ...env, GIT_INDEX_FILE: temporaryIndex } });
    const temporary = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--staged', '--run', '--reuse', result.report], {
      cwd: f.root, encoding: 'utf8', env: { ...env, GIT_INDEX_FILE: temporaryIndex } });
    expect(temporary.status, temporary.stderr).toBe(0); expect(temporary.stdout).toContain('REUSED');
    expect(readFileSync(path.join(f.repo, '.git/index'))).toEqual(index);
  }, 60_000);
  it('失败、中断、skip、未结束、运行中变更与快照改写一律拒绝', async () => {
    const f = fixture(), result = await runStaged(f.root, options), file = path.join(f.root, result.report);
    const original = JSON.parse(readFileSync(file, 'utf8'));
    for (const patch of [{ outcome: 'failed' }, { exitCode: 1 }, { signal: 'SIGTERM' }, { error: 'error' },
      { outcome: 'skip' }, { endedAt: null }, { indexAfterSha256: 'changed' }, { snapshotIndexContentSha256: 'changed' },
      { snapshotTrackedMutations: ['source'] }, { cleanupError: 'failed' }, { commandExitCode: null }]) {
      writeFileSync(file, JSON.stringify({ ...original, ...patch }));
      expect(inspectGateReceipt(f.root, result.report).eligible).toBe(false);
      expect(() => f.verify(result.report)).toThrow();
    }
  }, 60_000);
  it('有文档输入的动态测试保守锁项目文档，scope列出共同验收文件', async () => {
    const f = fixture();
    writeFileSync(path.join(f.root, 'tests/fixture.test.js'), "import {readFileSync} from 'node:fs'; readFileSync('docs/guide.md');");
    f.git('add', '搜打撤/tests/fixture.test.js');
    const result = await runStaged(f.root, options), report = JSON.parse(readFileSync(path.join(f.root, result.report), 'utf8'));
    expect(report.gateReceipt.scope.documents).toBe('project');
    expect(report.gateReceipt.scope.relatedFiles).toContain('docs/guide.md');
    writeFileSync(path.join(f.root, 'docs/guide.md'), 'changed input'); f.git('add', '搜打撤/docs/guide.md');
    expect(() => f.verify(result.report)).toThrow('冻结源码');
  }, 60_000);
  it('源码、依赖字节、环境和日志变化拒绝复用，缓存写入不污染依赖证据', async () => {
    const f = fixture(), result = await runStaged(f.root, options);
    const report = JSON.parse(readFileSync(path.join(f.root, result.report), 'utf8'));
    const before = dependencyBytes(f.root);
    mkdirSync(path.join(f.root, 'node_modules/.cache'), { recursive: true });
    writeFileSync(path.join(f.root, 'node_modules/.cache/eslint'), 'cache');
    expect(dependencyBytes(f.root)).toBe(before);
    writeFileSync(path.join(f.root, 'node_modules/changed.js'), 'dependency changed');
    expect(inspectGateReceipt(f.root, result.report)).toMatchObject({ eligible: true, status: 'prechecked', strictCurrentCheck: 'commit-gate' });
    expect(() => f.verify(result.report)).toThrow('依赖字节');
    // Keep the source index changes, rather than rolling back the fixture.
    writeFileSync(path.join(f.root, 'scripts/value.mjs'), 'changed'); f.git('add', '搜打撤/scripts/value.mjs');
    expect(() => f.verify(result.report)).toThrow('冻结源码');
    writeFileSync(path.join(f.root, report.log), 'altered log');
    expect(() => f.verify(result.report)).toThrow('日志');
  }, 60_000);
  it('环境与验收模式变化分别失败关闭', async () => {
    const f = fixture(), result = await runStaged(f.root, options), location = path.join(f.root, result.report);
    const report = JSON.parse(readFileSync(location, 'utf8'));
    writeFileSync(location, JSON.stringify({ ...report, gateReceipt: { ...report.gateReceipt,
      environment: { ...report.gateReceipt.environment, node: 'different' } } }));
    expect(() => f.verify(result.report)).toThrow('验收环境');
    writeFileSync(location, JSON.stringify({ ...report, gate: { ...report.gate, mode: 'skip' } }));
    expect(inspectGateReceipt(f.root, result.report).reasonCode).toBe('RECEIPT_SKIPPED');
    expect(() => f.verify(result.report)).toThrow();
  }, 60_000);
});
