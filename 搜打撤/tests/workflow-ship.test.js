/* workflow-ship 收官落库一条龙契约（2026-10-02）：分组/排除/无主阻断/FULL 预估/apply 全链。 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { planShip, applyShip } from '../scripts/workflow-ship.mjs';

const roots = [];
let fixtureRoot = null;
// quotepath=false：中文路径不断言转义八进制（Windows+中文仓实测坑）。
const git = (args, options = {}) => execFileSync('git', ['-C', fixtureRoot, '-c', 'core.quotepath=false', ...args], { stdio: 'pipe', encoding: 'utf8', ...options });

beforeEach(() => {
  fixtureRoot = mkdtempSync(path.join(os.tmpdir(), 'sdt-ship-test-'));
  roots.push(fixtureRoot);
  git(['init', '-q']);
  git(['config', 'core.autocrlf', 'false']);
  git(['config', 'core.hooksPath', '']);   // fixture 不挂项目钩子（apply 集成只验证 git 语义）
  git(['config', 'user.email', 'ship@test']);
  git(['config', 'user.name', 'ship-test']);
  const project = path.join(fixtureRoot, '搜打撤');
  mkdirSync(path.join(project, 'game/src/core'), { recursive: true });
  mkdirSync(path.join(project, 'tests'), { recursive: true });
  mkdirSync(path.join(project, 'scripts'), { recursive: true });
  mkdirSync(path.join(project, 'docs'), { recursive: true });
  mkdirSync(path.join(project, '.sfx-work'), { recursive: true });
  writeFileSync(path.join(project, 'game/src/core/registry.js'), 'export const a = 1;\n');
  writeFileSync(path.join(project, 'tests/x.test.js'), 'export const b = 2;\n');
  writeFileSync(path.join(project, 'scripts/x.mjs'), 'export const c = 3;\n');
  writeFileSync(path.join(project, 'docs/README.md'), '# f\n');
  writeFileSync(path.join(project, 'docs/STATUS.md'), '# status\n');
  writeFileSync(path.join(project, '.sfx-work/tmp.bin'), 'x');
  writeFileSync(path.join(fixtureRoot, '根级散件.txt'), 'x');
  git(['add', '.']);
  git(['commit', '-qm', 'base']);
});

afterEach(() => {
  for (const root of roots.splice(0)) {
    const relative = path.relative(os.tmpdir(), root);
    if (!relative.startsWith('sdt-ship-test-') || relative.includes(path.sep)) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
}, 30_000);

function seedChanges() {
  const project = path.join(fixtureRoot, '搜打撤');
    writeFileSync(path.join(project, 'game/src/core/registry.js'), 'export const a = 2;\n');
  writeFileSync(path.join(project, 'tests/x.test.js'), 'export const b = 3;\n');             // code
  writeFileSync(path.join(project, 'docs/README.md'), '# f2\n');                             // docs
  writeFileSync(path.join(project, 'docs/STATUS.md'), '# status2\n');
  writeFileSync(path.join(project, '未知文件.map'), 'x');                                    // unknown
  writeFileSync(path.join(project, '.sfx-work/tmp2.bin'), 'x');                              // excluded
  writeFileSync(path.join(project, '__try_probe.json'), '{}');                               // excluded（try 配置模式）
}

function receiptFixture(project, patch = {}) {
  const directory = path.join(project, 'docs/evidence/receipt'); mkdirSync(directory, { recursive: true });
  const hash = text => createHash('sha256').update(text).digest('hex'), digest = hash('fixture');
  writeFileSync(path.join(directory, 'check.log'), 'fixture log');
  const report = { schemaVersion: 1, kind: 'staged-snapshot-check', outcome: 'passed', exitCode: 0, commandExitCode: 0,
    endedAt: '2026-10-02T00:00:00Z', gate: { mode: 'quick', tests: ['tests/x.test.js'] },
    gateReceipt: { schemaVersion: 1, entriesSha256: digest, changesSha256: digest, dependenciesSha256: digest,
      gate: { mode: 'quick', tests: ['tests/x.test.js'] },
      environment: { node: process.version }, scope: { documents: 'targeted', relatedFiles: [] } },
    plan: { root: project, repo: fixtureRoot, indexSha256: digest, dependencies: { ok: true } },
    dependenciesAfterCopy: { ok: true }, gitView: { isolatedMetadata: true }, indexAfterSha256: digest,
    snapshotIndexExpectedSha256: digest, snapshotIndexContentSha256: digest, snapshotTrackedMutations: [],
    log: 'docs/evidence/receipt/check.log', logSha256: hash('fixture log'), ...patch };
  writeFileSync(path.join(directory, 'check.json'), JSON.stringify(report));
  return 'docs/evidence/receipt/check.json';
}

describe('ship 收官落库一条龙', () => {
  it('干净树：无提交计划但不报错', () => {
    const plan = planShip(path.join(fixtureRoot, '搜打撤'), {});
    expect(plan.ok).toBe(false);
    expect(plan.commits).toEqual([]);
    expect(plan.blocked).toBeNull();
    expect(plan).toMatchObject({ status: 'noop', reasonCode: 'SHIP_NO_CHANGES', nextAction: 'no-action' });
  });

  it('混合树：两笔分组+unknown/excluded 分流+FULL 预估', () => {
    seedChanges();
    const plan = planShip(path.join(fixtureRoot, '搜打撤'), {});
    expect(plan.ok).toBe(true);
    expect(plan.commits).toHaveLength(2);
    const code = plan.commits.find((c) => c.scope === 'code');
    const docs = plan.commits.find((c) => c.scope === 'docs');
    expect(code.paths.sort()).toEqual(['搜打撤/game/src/core/registry.js', '搜打撤/tests/x.test.js', '搜打撤/docs/README.md'].sort());
    expect(plan.coupledDocs).toEqual(['搜打撤/docs/README.md']);
    expect(docs.paths).toEqual(['搜打撤/docs/STATUS.md']);
    expect(plan.unknownPaths).toContain('搜打撤/未知文件.map');
    expect(plan.excludedPaths.some((p) => p.includes('.sfx-work'))).toBe(true);
    expect(plan.excludedPaths.some((p) => p.includes('__try_probe.json'))).toBe(true);
    expect(plan.expectFull).toBe(true);   // core/ 命中 FULL_SOURCE 近似
    expect(plan.gate.mode).toBe('full');
    expect(plan).toMatchObject({ status: 'ready', reasonCode: 'SHIP_READY', receiptValidity: { status: 'not-provided' } });
  });

  it('staged 预检命中 REGISTRY 无主物品即阻断（26a5254 防线前移）', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤');
    const registryPath = path.join(project, 'docs', 'PARALLEL-REGISTRY.md');
    writeFileSync(registryPath,
      '# r\n\n## 无主物品\n\n| 物品 | 现象 | 发现时间 | 备注 |\n|---|---|---|---|\n| `搜打撤/未知文件.map` | 演练注入 | 10-02 | 阻断演练 |\n');
    const plan = planShip(project, {});
    expect(plan.ok).toBe(false);
    expect(plan.blocked).toContain('无主物品');
    expect(plan.blocked).toContain('未知文件.map');
    expect(plan.blockedPaths).toContain('搜打撤/未知文件.map');
    writeFileSync(registryPath, '# r\n');
  });

  it('apply 全链：两笔真实提交落库且工作树只剩 unknown/excluded', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤');
    const plan = planShip(project, { message: 'test(vite): ship 集成演练' });
    expect(plan.ok).toBe(true);
    const result = applyShip(project, plan, { expectedSha256: plan.planSha256 });
    expect(result.ok).toBe(true);
    expect(result.results).toHaveLength(2);
    expect(result.status).toBe('completed');
    expect(result.results.every(item => /^[a-f0-9]{40,64}$/.test(item.commit))).toBe(true);
    const head1 = git(['log', '-1', '--pretty=%B']).trim();
    expect(head1).toContain('docs(vite): 收官落库');
    const head2 = git(['log', '-2', '--pretty=%B']).split('\n\n')[1];
    expect(head2).toContain('ship 集成演练');
    const status = git(['status', '--porcelain']).trim().split('\n').filter(Boolean);
    expect(status.some((l) => l.includes('未知文件.map'))).toBe(true);
    expect(status.some((l) => l.includes('.sfx-work'))).toBe(true);
    expect(status.some((l) => l.includes('registry.js') || l.includes('x.test.js') || l.includes('README.md'))).toBe(false);
  });

  it('超长路径清单与中文、空格、通配符字面路径仍按代码和文档两笔提交', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤');
    const special = 'game/src/core/中文 空格 [1] #.js';
    writeFileSync(path.join(project, special), 'export const special = true;\n');
    for (let index = 0; index < 400; index += 1) {
      const name = `long-${String(index).padStart(4, '0')}-${'a'.repeat(80)}.js`;
      writeFileSync(path.join(project, 'game/src/core', name), `export const value = ${index};\n`);
    }
    const plan = planShip(project);
    expect(plan.commits).toHaveLength(2);
    expect(plan.commits[0].paths.join(' ').length).toBeGreaterThan(32_767);
    expect(plan.commits[0].paths).toContain('搜打撤/' + special);
    const result = applyShip(project, plan, { expectedSha256: plan.planSha256 });
    expect(result).toMatchObject({ ok: true, status: 'completed' });
    const codePaths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD~1']).split('\0');
    const docPaths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', '-z', 'HEAD']).split('\0');
    expect(codePaths).toContain('搜打撤/' + special);
    expect(codePaths).not.toContain('搜打撤/docs/STATUS.md');
    expect(docPaths).toContain('搜打撤/docs/STATUS.md');
    expect(docPaths).not.toContain('搜打撤/' + special);
    expect(git(['status', '--porcelain', '--untracked-files=all'])).not.toContain('long-');
  }, 60_000);

  it('计划外已暂存内容阻断，不能随默认打包混入', () => {
    seedChanges(); git(['add', '搜打撤/未知文件.map']);
    const plan = planShip(path.join(fixtureRoot, '搜打撤'));
    expect(plan.ok).toBe(false);
    expect(plan.blocked).toContain('index 含计划外');
    expect(plan).toMatchObject({ status: 'blocked', reasonCode: 'SHIP_FOREIGN_STAGED', foreignStaged: ['搜打撤/未知文件.map'] });
    expect(git(['diff', '--cached', '--name-only'])).toContain('未知文件.map');
  });
  it('缺失、failed/skip、坏JSON/结构/日志/来源报告均typed blocked，预检不声称当前可复用', () => {
    seedChanges(); const project = path.join(fixtureRoot, '搜打撤');
    const check = (receipt, reasonCode) => {
      const plan = planShip(project, { receipt });
      expect(plan).toMatchObject({ ok: false, status: 'blocked', reasonCode, receiptValidity: { eligible: false } });
      expect(git(['diff', '--cached', '--name-only']).trim()).toBe('');
    };
    check('docs/evidence/missing.json', 'RECEIPT_MISSING');
    check('../outside.json', 'RECEIPT_PATH_INVALID');
    check(receiptFixture(project, { outcome: 'failed', exitCode: 1 }), 'RECEIPT_FAILED');
    check(receiptFixture(project, { outcome: 'skip' }), 'RECEIPT_SKIPPED');
    check(receiptFixture(project, { gateReceipt: {} }), 'RECEIPT_STRUCTURE_INVALID');
    check(receiptFixture(project, { logSha256: 'changed' }), 'RECEIPT_LOG_INVALID');
    const receipt = receiptFixture(project), location = path.join(project, receipt);
    writeFileSync(location, '{'); check(receipt, 'RECEIPT_JSON_INVALID');
    receiptFixture(project, { plan: { root: path.join(project, 'foreign'), repo: fixtureRoot, indexSha256: 'a'.repeat(64), dependencies: { ok: true } }, indexAfterSha256: 'a'.repeat(64) });
    check(receipt, 'RECEIPT_WORKSPACE_MISMATCH');
    const ready = planShip(project, { receipt: receiptFixture(project) });
    expect(ready).toMatchObject({ ok: true, receiptValidity: { status: 'prechecked', strictCurrentCheck: 'commit-gate' } });
    const report = JSON.parse(readFileSync(location, 'utf8')); report.endedAt = 'changed';
    writeFileSync(location, JSON.stringify(report));
    expect(() => applyShip(project, ready, { expectedSha256: ready.planSha256 })).toThrow('报告在预览后已变化');
    expect(git(['diff', '--cached', '--name-only']).trim()).toBe('');
  }, 20_000);
  it('第二组hook失败返回完成commit与剩余stage，重试只给只读下一步', () => {
    seedChanges(); const project = path.join(fixtureRoot, '搜打撤'), plan = planShip(project);
    writeFileSync(path.join(fixtureRoot, '.git/hooks/pre-commit'), '#!/bin/sh\nif git diff --cached --name-only | grep -q "docs/STATUS.md"; then exit 9; fi\n');
    git(['config', 'core.hooksPath', '.git/hooks']);
    let failure; try { applyShip(project, plan, { expectedSha256: plan.planSha256 }); } catch (error) { failure = error; }
    expect(failure.details).toMatchObject({ currentScope: 'docs', reasonCode: 'SHIP_COMMIT_FAILED',
      stagedRemaining: ['搜打撤/docs/STATUS.md'], remainingPaths: ['搜打撤/docs/STATUS.md'], nextAction: 'inspect-preserved-state-and-replan' });
    expect(failure.details.completed).toEqual([{ scope: 'code', commit: git(['rev-parse', 'HEAD']).trim() }]);
    expect(() => JSON.stringify(failure.details)).not.toThrow();
  });

  it('缺少计划确认、文件变化或 index 变化均在写前拒绝', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤'), plan = planShip(project);
    expect(() => applyShip(project, plan)).toThrow('--expect');
    try { applyShip(project, plan); } catch (error) {
      expect(error.details).toMatchObject({ completed: [], reasonCode: 'SHIP_PLAN_EXPECT_REQUIRED', stagedRemaining: [] });
    }
    writeFileSync(path.join(project, 'docs/README.md'), '# later\n');
    expect(() => applyShip(project, plan, { expectedSha256: plan.planSha256 })).toThrow('预览后已变化');
    expect(git(['diff', '--cached', '--name-only']).trim()).toBe('');
    const fresh = planShip(project);
    git(['add', '搜打撤/docs/README.md']);
    expect(() => applyShip(project, fresh, { expectedSha256: fresh.planSha256 })).toThrow('预览后已变化');
    expect(git(['diff', '--cached', '--name-only'])).toContain('docs/README.md');
  });

  it('编辑占用与 doing 任务只列在途，完成未提交归属允许打包', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤');
    writeFileSync(path.join(project, 'scripts/x.mjs'), 'export const c=4;\n');
    writeFileSync(path.join(project, 'docs/PARALLEL-REGISTRY.md'),
      '# Registry\n## 活跃登记\n| owner | paths | goal | date | state |\n|---|---|---|---|---|\n'
      + '| Friday（editing WF-edit） | scripts/x.mjs | editing | 10-02 | 编辑中 |\n'
      + '| Friday（done WF-done） | docs/README.md | done | 10-02 | 完成未提交 |\n');
    const taskDir = path.join(project, 'docs/evidence/2026-10-02-active');
    mkdirSync(taskDir, { recursive: true });
    writeFileSync(path.join(taskDir, 'task.json'), JSON.stringify({ stage: 'doing', paths: ['game/src/core/registry.js'] }));
    const plan = planShip(project);
    expect(plan.inProgressPaths).toEqual(expect.arrayContaining(['搜打撤/scripts/x.mjs', '搜打撤/game/src/core/registry.js']));
    expect(plan.commits.flatMap(c => c.paths)).toContain('搜打撤/docs/README.md');
    expect(plan.commits.flatMap(c => c.paths)).not.toContain('搜打撤/scripts/x.mjs');
  });

  it('表头前的活跃登记保护源码与证据目录，不混入完成提交', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤');
    const evidence = path.join(project, 'docs/evidence/active');
    mkdirSync(evidence, { recursive: true });
    writeFileSync(path.join(evidence, 'screen.jpg'), 'in progress');
    writeFileSync(path.join(project, 'docs/PARALLEL-REGISTRY.md'),
      '# Registry\n## 活跃登记\n'
      + '| Friday（WF-live） | game/src/core/registry.js；docs/evidence/active/ | 进行中 | 10-13 | 编辑中 |\n'
      + '| owner | paths | goal | date | state |\n|---|---|---|---|---|\n');
    const plan = planShip(project);
    expect(plan.inProgressPaths).toEqual(expect.arrayContaining([
      '搜打撤/game/src/core/registry.js', '搜打撤/docs/evidence/active/screen.jpg',
    ]));
    expect(plan.commits.flatMap(commit => commit.paths)).not.toContain('搜打撤/docs/evidence/active/screen.jpg');
  });

  it('待决未跟踪目录、证据二进制与大件不默认落库', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤'), pendingDir = path.join(project, 'docs/proposal');
    mkdirSync(pendingDir); writeFileSync(path.join(pendingDir, 'idea.md'), '# pending\n');
    writeFileSync(path.join(project, 'docs/PENDING.md'),
      '# Pending\n## 活账\n| id | item | date | source | note |\n|---|---|---|---|---|\n'
      + '| 1 | `docs/proposal/` 待决 | 10-02 | review | |\n');
    const evidence = path.join(project, 'docs/evidence/sample'); mkdirSync(evidence, { recursive: true });
    writeFileSync(path.join(evidence, 'sound.wav'), 'audio');
    writeFileSync(path.join(evidence, 'large.json'), 'x'.repeat(1024 * 1024 + 1));
    const plan = planShip(project);
    expect(plan.excludedPaths).toEqual(expect.arrayContaining([
      '搜打撤/docs/proposal/idea.md', '搜打撤/docs/evidence/sample/sound.wav', '搜打撤/docs/evidence/sample/large.json']));
  });

  it('已有后续文档组暂存时只提交当前组，不把它并进代码笔', () => {
    seedChanges(); git(['add', '搜打撤/docs/STATUS.md']);
    const project = path.join(fixtureRoot, '搜打撤'), plan = planShip(project);
    applyShip(project, plan, { expectedSha256: plan.planSha256 });
    const codeCommitPaths = git(['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD~1']);
    expect(codeCommitPaths).toContain('game/src/core/registry.js');
    expect(codeCommitPaths).not.toContain('docs/STATUS.md');
  });

  it('门禁失败保留已暂存现场，不回滚或继续第二组', () => {
    seedChanges();
    const hooks = path.join(fixtureRoot, '.git/hooks');
    writeFileSync(path.join(hooks, 'pre-commit'), '#!/bin/sh\nexit 1\n');
    git(['config', 'core.hooksPath', '.git/hooks']);
    const project = path.join(fixtureRoot, '搜打撤'), plan = planShip(project);
    const head = git(['rev-parse', 'HEAD']);
    expect(() => applyShip(project, plan, { expectedSha256: plan.planSha256 })).toThrow();
    expect(git(['rev-parse', 'HEAD'])).toBe(head);
    expect(git(['diff', '--cached', '--name-only'])).toContain('game/src/core/registry.js');
    expect(readFileSync(path.join(project, 'docs/README.md'), 'utf8')).toBe('# f2\n');
  });

  it('预览后任务重新变为 doing 时写前拒绝，保护在途源码', () => {
    seedChanges();
    const project = path.join(fixtureRoot, '搜打撤'), directory = path.join(project, 'docs/evidence/2026-10-02-task');
    mkdirSync(directory, { recursive: true });
    const taskFile = path.join(directory, 'task.json');
    writeFileSync(taskFile, JSON.stringify({ stage: 'complete-uncommitted', paths: ['game/src/core/registry.js'] }));
    const plan = planShip(project);
    writeFileSync(taskFile, JSON.stringify({ stage: 'doing', paths: ['game/src/core/registry.js'] }));
    const head = git(['rev-parse', 'HEAD']);
    expect(() => applyShip(project, plan, { expectedSha256: plan.planSha256 })).toThrow('预览后已变化');
    expect(git(['rev-parse', 'HEAD'])).toBe(head);
    expect(git(['diff', '--cached', '--name-only']).trim()).toBe('');
  });

  it('首笔 hook 改写后续同路径 index blob 时不覆盖并发内容', () => {
    seedChanges();
    const concurrent = git(['hash-object', '-w', '--stdin'], { input: '# concurrent\n' }).trim();
    writeFileSync(path.join(fixtureRoot, '.git/hooks/post-commit'),
      '#!/bin/sh\ngit update-index --cacheinfo 100644,' + concurrent + ',搜打撤/docs/STATUS.md\n');
    git(['config', 'core.hooksPath', '.git/hooks']);
    const project = path.join(fixtureRoot, '搜打撤'), plan = planShip(project);
    let failure; try { applyShip(project, plan, { expectedSha256: plan.planSha256 }); } catch (error) { failure = error; }
    expect(failure.message).toContain('并发变化');
    expect(failure.details).toMatchObject({ currentScope: 'code', reasonCode: 'SHIP_COMMIT_CONCURRENT',
      completed: [{ scope: 'code', commit: git(['rev-parse', 'HEAD']).trim() }], remainingPaths: ['搜打撤/docs/STATUS.md'] });
    expect(git(['show', ':搜打撤/docs/STATUS.md'])).toBe('# concurrent\n');
    expect(git(['show', 'HEAD:搜打撤/docs/STATUS.md'])).toBe('# status\n');
  });
});
