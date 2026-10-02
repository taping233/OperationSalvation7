import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runStaged, stagedPlan } from '../scripts/workflow-staged.mjs';

const roots = [];
const activeCases = new Set();
function asyncCase(body) {
  return () => {
    const task = Promise.resolve().then(body);
    activeCases.add(task);
    task.then(() => activeCases.delete(task), () => activeCases.delete(task));
    return task;
  };
}
const git = (root, args, input) => execFileSync('git', args, { cwd: root, input, encoding: 'utf8' });
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-staged-test-')); roots.push(root);
  git(root, ['init', '-q']); git(root, ['config', 'core.autocrlf', 'false']);
  git(root, ['config', 'user.email', 'fixture@example.invalid']); git(root, ['config', 'user.name', 'fixture']);
  const project = path.join(root, '搜打撤');
  mkdirSync(path.join(project, 'scripts'), { recursive: true });
  mkdirSync(path.join(project, 'node_modules'), { recursive: true });
  writeFileSync(path.join(project, 'package.json'), '{"type":"module","dependencies":{}}');
  writeFileSync(path.join(project, 'package-lock.json'), JSON.stringify({ lockfileVersion: 3, packages: { '': { dependencies: {} } } }));
  writeFileSync(path.join(project, 'node_modules/.package-lock.json'), '{"packages":{}}');
  writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
  writeFileSync(path.join(project, 'scripts/value.txt'), 'base');
  writeFileSync(path.join(project, 'scripts/acceptance-gate.mjs'), `import {readFileSync,existsSync,writeFileSync} from 'node:fs';
export function planForPaths(paths){return {mode:paths.every(p=>p.endsWith('.md'))?'skip':'full',paths,reasons:[],tests:[]};}
export function reverseImports(){return {fileSet:new Set(),reverse:new Map()};}
if(process.argv[1]?.endsWith('acceptance-gate.mjs')){
if(process.argv.includes('--plan')) {const {execFileSync}=await import('node:child_process'); const paths=execFileSync('git',['-c','core.quotepath=false','diff','--cached','--name-only','--no-renames'],{encoding:'utf8'}).trim().split('\\n').map(p=>p.replace(/^搜打撤\\//,''));console.log(JSON.stringify(planForPaths(paths)));}
else {
const value=readFileSync('scripts/value.txt','utf8');
if(value==='must-fail') process.exitCode=7;
else if(value==='signal') process.kill(process.pid,'SIGTERM');
else if(value==='mutate'){writeFileSync('scripts/value.txt','changed');}
else if(value!=='staged'||existsSync('scripts/untracked.txt')) process.exitCode=8;
else console.log('snapshot passed');
}
}
`);
  git(root, ['add', '.']); git(root, ['commit', '-qm', 'fixture']);
  return { root, project, value: path.join(project, 'scripts/value.txt') };
}
const options = { task: 'fixture', date: '2026-09-30', json: true };
afterEach(async () => {
  // Vitest timeout does not cancel the test promise. Await its entire body, including later runs,
  // before deleting a fixture used by a still-running Git/Node process.
  await Promise.allSettled([...activeCases]);
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-staged-test-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
    if (existsSync(root) && process.platform === 'win32') execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      'Remove-Item -LiteralPath $env:SDT_STAGED_TEST_CLEANUP_PATH -Recurse -Force -ErrorAction Stop'], { env: { ...process.env, SDT_STAGED_TEST_CLEANUP_PATH: root } });
  }
}, 90_000);

describe('Git index 隔离验收', () => {
  it('普通门与隔离门共用真实 scripts-only 计划，未暂存 package 内容不会泄漏', asyncCase(async () => {
    const f = fixture();
    for (const name of ['acceptance-gate.mjs', 'gate-plan.mjs', 'registry-paths.mjs', 'workflow-gate-receipt.mjs', 'workflow-dependencies.mjs']) {
      writeFileSync(path.join(f.project, 'scripts', name), readFileSync(path.resolve('scripts', name)));
    }
    writeFileSync(path.join(f.project, 'scripts/architecture-graph.mjs'), 'export const analyzeModule=()=>({imports:[]});');
    for (const name of ['compile-narrative', 'check-syntax', 'validate-data', 'check-types']) {
      writeFileSync(path.join(f.project, 'scripts', name + '.mjs'), 'console.log("fixture static pass");');
    }
    mkdirSync(path.join(f.project, 'tests'), { recursive: true });
    for (const name of ['architecture-boundaries', 'contracts']) writeFileSync(path.join(f.project, 'tests', name + '.test.js'), '// fixture guard');
    for (const file of ['eslint/bin/eslint.js', 'vitest/vitest.mjs']) {
      mkdirSync(path.dirname(path.join(f.project, 'node_modules', file)), { recursive: true });
      writeFileSync(path.join(f.project, 'node_modules', file), 'console.log("fixture runner pass");');
    }
    git(f.root, ['add', '.']); git(f.root, ['commit', '-qm', 'real gate fixture']);
    const packageFile = path.join(f.project, 'package.json');
    writeFileSync(packageFile, '{"type":"module","dependencies":{},"scripts":{"syntax":"node scripts/check-syntax.mjs"}}');
    git(f.root, ['add', '搜打撤/package.json']);
    const normal = spawnSync(process.execPath, ['scripts/acceptance-gate.mjs', '--staged', '--plan', '--json'], {
      cwd: f.project, encoding: 'utf8', env: { ...process.env, GATE_RECEIPT: '' } });
    expect(normal.status, normal.stderr).toBe(0);
    const normalPlan = JSON.parse(normal.stdout); expect(normalPlan.mode).toBe('quick');
    writeFileSync(packageFile, '{"type":"module","dependencies":{"foreign":"1"}}');
    const result = await runStaged(f.project, options), report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(result.outcome, JSON.stringify(report)).toBe('passed');
    expect(report.gate).toEqual(normalPlan);
  }), 60_000);
  it('真实 workflow staged --plan 在冻结Git视图内可执行，且不借用源工作树/index', asyncCase(async () => {
    const f = fixture();
    const sourceScripts = path.resolve('scripts');
    // impact-query.mjs：workflow-status.mjs 的属地 token 依赖（WF-code-map 引入）；不复制则快照内 import 链断。
    for (const name of readdirSync(sourceScripts).filter(name => /^workflow.*\.mjs$/.test(name) || name === 'index-validation.mjs' || name === 'impact-query.mjs')) {
      writeFileSync(path.join(f.project, 'scripts', name), readFileSync(path.join(sourceScripts, name)));
    }
    const gate = path.join(f.project, 'scripts/acceptance-gate.mjs');
    writeFileSync(gate, readFileSync(gate, 'utf8') + `
if(process.argv[1]?.endsWith('acceptance-gate.mjs')&&!process.argv.includes('--plan')){
const {execFileSync}=await import('node:child_process');
const result=JSON.parse(execFileSync(process.execPath,['scripts/workflow.mjs','staged','--plan','--json'],{encoding:'utf8'}));
if(!result.ok||result.repo===${JSON.stringify(f.root)}||!result.changes.some(item=>item.path==='scripts/value.txt'))throw new Error('未使用冻结的Git视图');
}
`);
    writeFileSync(f.value, 'staged'); git(f.root, ['add', '搜打撤/scripts']);
    writeFileSync(f.value, 'working');
    const sourceIndex = readFileSync(path.join(f.root, '.git/index'));
    const result = await runStaged(f.project, options);
    const report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(result.outcome, JSON.stringify(report)).toBe('passed');
    expect(report.gitView.isolatedMetadata).toBe(true);
    expect(report.snapshotIndexAfterSha256).toBe(report.gitView.indexSha256);
    expect(readFileSync(path.join(f.root, '.git/index'))).toEqual(sourceIndex);
    expect(readFileSync(f.value, 'utf8')).toBe('working');
  }), 60_000);
  it('只导出暂存字节，排除不同的工作树和未跟踪文件，源 index 没有副作用', asyncCase(async () => {
    const f = fixture();
    writeFileSync(f.value, 'staged'); git(f.root, ['add', '搜打撤/scripts/value.txt']);
    writeFileSync(f.value, 'working');
    writeFileSync(path.join(f.project, 'scripts/untracked.txt'), 'untracked');
    // This unstaged gate must never execute.
    writeFileSync(path.join(f.project, 'scripts/acceptance-gate.mjs'), 'throw new Error("working gate leaked");');
    const index = readFileSync(path.join(f.root, '.git/index'));
    const result = await runStaged(f.project, options);
    const report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(result.outcome, JSON.stringify(report)).toBe('passed'); expect(result.exitCode).toBe(0);
    expect(result.validation).toMatchObject({ executed: true, passed: true, reusableReceipt: true, reason: 'STAGED_PASSED' });
    expect(result.nextAction).toBe('review-ship-plan-with-receipt');
    expect(readFileSync(path.join(f.root, '.git/index')).equals(index)).toBe(true);
    expect(readFileSync(f.value, 'utf8')).toBe('working');
    expect(report.snapshotRemoved).toBe(true); expect(existsSync(report.snapshotDirectory)).toBe(false);
    expect(report.indexAfterSha256).toBe(report.plan.indexSha256);
    expect(report.snapshotTrackedMutations).toEqual([]);
  }), 60_000);
  it('删除与重命名沿用冻结 gate 定向选择，不再被隔离入口覆写 full', asyncCase(async () => {
    const f = fixture();
    writeFileSync(f.value, 'staged');
    writeFileSync(path.join(f.project, 'scripts/deleted.txt'), 'old');
    writeFileSync(path.join(f.project, 'scripts/old-name.txt'), 'rename-content');
    git(f.root, ['add', '.']); git(f.root, ['commit', '-qm', 'more']);
    git(f.root, ['rm', '搜打撤/scripts/deleted.txt']);
    renameSync(path.join(f.project, 'scripts/old-name.txt'), path.join(f.project, 'scripts/new-name.txt'));
    const gate = path.join(f.project, 'scripts/acceptance-gate.mjs');
    writeFileSync(gate, readFileSync(gate, 'utf8').replace("?'skip':'full'", "?'skip':'quick'"));
    git(f.root, ['add', '-A']);
    const result = await runStaged(f.project, options);
    const report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(report.plan.changes.some(entry => entry.status === 'D')).toBe(true);
    expect(report.plan.changes.some(entry => entry.status === 'A' && entry.path === 'scripts/new-name.txt')).toBe(true);
    expect(report.command.slice(2)).toEqual(['--staged', '--run']);
    expect(report.gate.mode).toBe('quick');
    expect(result.outcome).toBe('passed');
  }), 60_000);
  it('锁不匹配或额外安装包阻断，不安装、不将失败写成通过', asyncCase(async () => {
    const f = fixture(); writeFileSync(f.value, 'staged'); git(f.root, ['add', '.']);
    writeFileSync(path.join(f.project, 'node_modules/.package-lock.json'), '{"packages":{"node_modules/extra":{"version":"1"}}}');
    const plan = stagedPlan(f.project); expect(plan.blocked.join('\n')).toContain('锁外');
    expect(plan.validation).toMatchObject({ executed: false, passed: false, reusableReceipt: false, reason: 'STAGED_PLAN_BLOCKED' });
    const result = await runStaged(f.project, options);
    const report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(result.outcome).toBe('blocked'); expect(result.exitCode).toBe(1); expect(report.snapshotDirectory).toBeUndefined();
  }), 30_000);
  it('拒绝 symlink 与 gitlink index 项', () => {
    const f = fixture();
    const blob = git(f.root, ['hash-object', '-w', '--stdin'], 'target\n').trim();
    git(f.root, ['update-index', '--add', '--cacheinfo', '120000,' + blob + ',搜打撤/link']);
    const commit = git(f.root, ['rev-parse', 'HEAD']).trim();
    git(f.root, ['update-index', '--add', '--cacheinfo', '160000,' + commit + ',搜打撤/submodule']);
    expect(stagedPlan(f.project).blocked.filter(text => text.includes('symlink/gitlink'))).toHaveLength(2);
  });
  it('失败命令与检查改写快照均不冒充通过', asyncCase(async () => {
    const f = fixture(); writeFileSync(f.value, 'must-fail'); git(f.root, ['add', '.']);
    const failed = await runStaged(f.project, options); expect(failed.outcome).toBe('failed'); expect(failed.exitCode).toBe(7);
    writeFileSync(f.value, 'mutate'); git(f.root, ['add', '.']);
    const mutated = await runStaged(f.project, options); expect(mutated.outcome).toBe('invalidated'); expect(mutated.exitCode).toBe(1);
    const report = JSON.parse(readFileSync(path.join(f.project, mutated.report), 'utf8'));
    expect(report.snapshotTrackedMutations).toContain('搜打撤/scripts/value.txt');
  }), 60_000);
  it('运行期间 index 改动使结果失效，保留别人新 index', asyncCase(async () => {
    const f = fixture();
    const gate = path.join(f.project, 'scripts/acceptance-gate.mjs');
    writeFileSync(gate, readFileSync(gate, 'utf8').replace("else console.log('snapshot passed');", `else {const {execFileSync}=await import('node:child_process');execFileSync('git',['update-index','--assume-unchanged','搜打撤/scripts/value.txt'],{cwd:${JSON.stringify(f.root)}});console.log('changed index');}`));
    writeFileSync(f.value, 'staged'); git(f.root, ['add', '.']);
    const result = await runStaged(f.project, options);
    expect(result.outcome).toBe('invalidated'); expect(result.exitCode).toBe(1);
    expect(git(f.root, ['ls-files', '-v', '搜打撤/scripts/value.txt']).startsWith('h ')).toBe(true);
  }), 60_000);
  it('文档路径 skip 明确未运行检查，不标通过', asyncCase(async () => {
    const f = fixture(); writeFileSync(path.join(f.project, 'note.md'), 'documentation'); git(f.root, ['add', '搜打撤/note.md']);
    const result = await runStaged(f.project, options);
    const report = JSON.parse(readFileSync(path.join(f.project, result.report), 'utf8'));
    expect(result.outcome).toBe('skip'); expect(report.command).toBeUndefined();
    expect(result.validation).toMatchObject({ executed: false, passed: false, reusableReceipt: false, reason: 'STAGED_SKIPPED' });
    expect(report.limits.join('\n')).toContain('未执行检查');
  }), 60_000);
  it('空index仅skip，不是passed或可复用报告，计划与执行均给安全下一步', asyncCase(async () => {
    const f = fixture(), plan = stagedPlan(f.project);
    expect(plan.validation).toEqual({ executed: false, passed: false, reusableReceipt: false, reason: 'STAGED_EMPTY_INDEX' });
    const result = await runStaged(f.project, options);
    expect(result.outcome).toBe('skip'); expect(result.validation).toEqual(plan.validation);
    expect(result.nextAction).toBe('select-completed-range-and-review-stage-plan');
  }), 60_000);
  it('检查被信号终止也返回失败退出码', asyncCase(async () => {
    const f = fixture(); writeFileSync(f.value, 'signal'); git(f.root, ['add', '.']);
    const result = await runStaged(f.project, options);
    expect(result.outcome).toBe('failed'); expect(result.exitCode).not.toBe(0); expect(result.exitCode).not.toBeNull();
  }), 60_000);
  it('检查命令exit0但收尾输入证明失败不返回passed', asyncCase(async () => {
    const f = fixture(), gate = path.join(f.project, 'scripts/acceptance-gate.mjs');
    writeFileSync(gate, readFileSync(gate, 'utf8').replace('reasons:[],tests:[]', "reasons:[],tests:['tests/contracts.test.js']"));
    writeFileSync(f.value, 'staged'); git(f.root, ['add', '.']);
    const result = await runStaged(f.project, options);
    expect(result.outcome).toBe('failed'); expect(result.exitCode).toBe(1);
    expect(result.validation).toMatchObject({ executed: true, passed: false, reusableReceipt: false, reason: 'STAGED_FAILED' });
  }), 60_000);
  it('依赖版本证据不符阻断，即使工作树锁看起来相符', () => {
    const f = fixture();
    mkdirSync(path.join(f.project, 'node_modules/example'), { recursive: true });
    writeFileSync(path.join(f.project, 'node_modules/example/package.json'), '{"version":"2.0.0"}');
    writeFileSync(path.join(f.project, 'node_modules/.package-lock.json'), '{"packages":{"node_modules/example":{"version":"1.0.0","integrity":"sha512-test"}}}');
    writeFileSync(path.join(f.project, 'package-lock.json'), '{"lockfileVersion":3,"packages":{"":{"dependencies":{}},"node_modules/example":{"version":"1.0.0","integrity":"sha512-test"}}}');
    git(f.root, ['add', '搜打撤/package-lock.json']);
    writeFileSync(path.join(f.project, 'package-lock.json'), '{"lockfileVersion":3,"packages":{}}');
    expect(stagedPlan(f.project).blocked.join('\n')).toContain('与暂存锁不匹配');
  });
});
