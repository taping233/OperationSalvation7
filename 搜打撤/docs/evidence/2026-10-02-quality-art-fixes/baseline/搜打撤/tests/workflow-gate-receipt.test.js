import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runStaged, stagedPlan } from '../scripts/workflow-staged.mjs';
import { dependencyBytes, inspectGateReceipt, verifyGateReceipt } from '../scripts/workflow-gate-receipt.mjs';

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
