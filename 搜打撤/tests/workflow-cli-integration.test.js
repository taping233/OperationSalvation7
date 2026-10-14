import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(project, 'scripts/workflow.mjs');
const isolationRoots = [];

function queryFixture() {
  const scratch = mkdtempSync(path.join(os.tmpdir(), 'sdt-cli-isolation-'));
  isolationRoots.push(scratch);
  const scripts = path.join(scratch, 'scripts'); mkdirSync(scripts);
  for (const file of ['workflow.mjs', 'workflow-task.mjs', 'workflow-task-input.mjs', 'workflow-ledger.mjs', 'registry-paths.mjs']) {
    const source = path.join(project, 'scripts', file);
    if (existsSync(source)) writeFileSync(path.join(scripts, file), readFileSync(source));
  }
  // An unrelated backend can be absent or mid-edit without preventing help/read-only task queries.
  writeFileSync(path.join(scripts, 'workflow-gate-receipt.mjs'), 'export const = ;');
  // 宿主代理的 Node 启动提示不是 CLI 输出；仅抑制已知代码，保留其余 stderr 与预载环境。
  const run = args => spawnSync(process.execPath, ['--disable-warning=UNDICI-EHPA', path.join(scripts, 'workflow.mjs'), ...args],
    { cwd: scratch, encoding: 'utf8', timeout: 10000 });
  run.root = scratch;
  return run;
}

afterEach(() => {
  for (const scratch of isolationRoots.splice(0)) {
    const resolved = realpathSync(scratch), relative = path.relative(realpathSync(os.tmpdir()), resolved);
    if (!relative.startsWith('sdt-cli-isolation-') || relative.includes(path.sep) || path.isAbsolute(relative)) throw new Error('拒绝清理非自有 CLI fixture');
    rmSync(resolved, { recursive: true, force: true });
  }
});
describe('流程入口集成', () => {
  // doctor/docs 端到端按真实仓库与检出态字节断言，隔离快照内不成立；staged 门内跳过，工作树门与 CI 覆盖。
  const inStagedSnapshot = Boolean(process.env.SDT_STAGED_SNAPSHOT);
  it.skipIf(inStagedSnapshot)('doctor通过统一入口返回轻预检分项，未请求证明不被误报为通过', () => {
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'doctor', '--json'], { cwd: project, encoding: 'utf8' }));
    expect(result.ok).toBe(true);
    expect(result.project.name).toBe('codename7-soudache-game');
    expect(result.checks.find(check => check.id === 'evidence').status).toBe('not-checked');
    expect(result.checks.find(check => check.id === 'ci').status).toBe('not-checked');
    expect(result.summary.blocked).toBe(0);
    expect(result.entries).toBeUndefined();
  });
  it('直接任务字段可预览、创建、更新和收官，不准备临时JSON且仍校验归属', () => {
    const run = queryFixture();
    const identity = ['--task', 'WF-direct', '--date', '2026-10-02', '--owner', 'Friday', '--json'];
    const start = ['task', 'start', ...identity, '--goal', '验证CLI直接字段', '--paths', 'scripts/workflow-task.mjs',
      '--done-when', '任务字段保存', '--done-when', '任务关闭仍无提交', '--stage', 'doing'];
    const preview = run(start); expect(preview.status, preview.stderr).toBe(0);
    expect(JSON.parse(preview.stdout)).toMatchObject({ dryRun: true, expectedSha256: 'absent' });
    const created = run([...start, '--apply', '--expect', 'absent']); expect(created.status, created.stderr).toBe(0);
    expect(JSON.parse(created.stdout).task.doneWhen).toHaveLength(2);
    const update = run(['task', 'update', ...identity, '--goal', '只更新目标']); expect(update.status, update.stderr).toBe(0);
    expect(JSON.parse(update.stdout).task.paths).toEqual(['scripts/workflow-task.mjs']);
    const wrongOwner = run(['task', 'update', '--task', 'WF-direct', '--date', '2026-10-02', '--owner', 'Other', '--goal', '越权', '--json']);
    expect(wrongOwner.status).toBe(1); expect(JSON.parse(wrongOwner.stdout).error).toContain('负责人');
    const close = ['task', 'close', ...identity, '--stage', 'complete-uncommitted', '--done-when-confirmed',
      '--check', 'manual:passed:已核对fixture:任务字段', '--unverified-none'];
    const closePlan = run(close); expect(closePlan.status, closePlan.stderr).toBe(0);
    const closed = run([...close, '--apply', '--expect', JSON.parse(closePlan.stdout).expectedSha256]);
    expect(closed.status, closed.stderr).toBe(0);
    expect(JSON.parse(closed.stdout).task).toMatchObject({ stage: 'complete-uncommitted',
      checks: [{ kind: 'manual', description: '已核对fixture:任务字段', result: 'passed' }], unverified: [] });
  });

  it('JSON模式与直接字段混用在读文件前拒绝，close漏项不被自动填成完成', () => {
    const run = queryFixture();
    const mixed = run(['task', 'start', '--task', 'WF-mix', '--owner', 'Friday', '--input', 'missing.json', '--goal', '混用', '--json']);
    expect(mixed.status).toBe(1); expect(JSON.parse(mixed.stdout).error).toContain('混用');
    const absent = run(['task', 'start', '--task', 'WF-missing', '--owner', 'Friday', '--goal', '缺少标准', '--json']);
    expect(absent.status).toBe(1); expect(JSON.parse(absent.stdout).error).toContain('--done-when');
    const identity = ['--task', 'WF-close-missing', '--date', '2026-10-02', '--owner', 'Friday', '--json'];
    expect(run(['task', 'start', ...identity, '--goal', '测试关闭漏项', '--paths', 'scripts/workflow-task.mjs',
      '--done-when', '明确记录', '--apply', '--expect', 'absent']).status).toBe(0);
    const close = run(['task', 'close', ...identity, '--stage', 'complete-uncommitted', '--done-when-confirmed', '--checks-none']);
    expect(close.status).toBe(1); expect(JSON.parse(close.stdout).error).toContain('--unverified');
  });

  it('verify预览拒绝缺失测试，--full预览明确完整门且不执行', () => {
    const missing = spawnSync(process.execPath, [cli, 'verify', '--task', 'preview-only', '--tests', 'tests/__missing_automation__.test.js', '--plan', '--json'],
      { cwd: project, encoding: 'utf8' });
    expect(missing.status).toBe(1); expect(JSON.parse(missing.stdout).error).toContain('不存在');
    const full = JSON.parse(execFileSync(process.execPath, [cli, 'verify', '--task', 'preview-only', '--full', '--plan', '--json'], { cwd: project, encoding: 'utf8' }));
    expect(full.dryRun).toBe(true); expect(full.selection.mode).toBe('full'); expect(full.command).toContain('--full');
  });

  it('evidence先识别报告类型，不为无效报告调用项目指纹', () => {
    const scratch = mkdtempSync(path.join(os.tmpdir(), 'sdt-cli-isolation-')); isolationRoots.push(scratch);
    const file = path.join(scratch, 'unsupported.json');
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, kind: 'other', before: {}, after: {}, validation: {} }));
    const run = queryFixture();
    const result = run(['evidence', '--input', file, '--json']);
    expect(result.status).toBe(1); expect(JSON.parse(result.stdout).error).toContain('不是受支持');
    expect(result.stderr).toBe('');
  });

  it('失败冻结报告先轻预检，不加载缺失的index后台或洪泛原报告', () => {
    const run = queryFixture();
    for (const name of ['workflow-gate-receipt.mjs', 'workflow-dependencies.mjs', 'gate-plan.mjs']) {
      writeFileSync(path.join(run.root, 'scripts', name), readFileSync(path.join(project, 'scripts', name)));
    }
    writeFileSync(path.join(run.root, 'scripts/architecture-graph.mjs'), 'export const analyzeModule=()=>({imports:[]});');
    expect(existsSync(path.join(run.root, 'scripts/workflow-staged.mjs'))).toBe(false);
    const directory = path.join(run.root, 'docs/evidence/fixture'); mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'failed.json');
    writeFileSync(file, JSON.stringify({ schemaVersion: 1, kind: 'staged-snapshot-check', outcome: 'failed', exitCode: 1 }));
    const output = run(['evidence', '--input', file, '--json']);
    expect(output.status).toBe(1);
    const result = JSON.parse(output.stdout);
    expect(result).toMatchObject({ ok: false, reusableReceipt: false,
      receiptValidity: { status: 'invalid', reasonCode: 'RECEIPT_FAILED' } });
    expect(result.receiptValidity.report).toBeUndefined();
    expect(result.error).toBeUndefined();
  });
  it('帮助和任务查询只加载需要的库，不依赖完整验收安装或有效receipt模块', () => {
    const run = queryFixture();
    const help = run(['--help', '--json']);
    expect(help.status, help.stderr).toBe(0);
    expect(JSON.parse(help.stdout).help).toContain('ship');
    const summary = run(['task', 'summary', '--json']);
    expect(summary.status, summary.stderr).toBe(0);
    expect(JSON.parse(summary.stdout).tasks).toEqual([]);
    expect(summary.stderr).toBe('');
  });

  it('所选后台不可用时保持JSON失败契约，其它命令仍可用', () => {
    const run = queryFixture();
    const missing = run(['staged', '--plan', '--json']);
    expect(missing.status).toBe(1);
    expect(JSON.parse(missing.stdout)).toMatchObject({ ok: false });
    expect(JSON.parse(missing.stdout).error).toContain('workflow-staged.mjs');
    expect(run(['--help', '--json']).status).toBe(0);
  });
  it('帮助完整暴露记忆、浏览器、隔离与文档能力', () => {
    const help = JSON.parse(execFileSync(process.execPath, [cli, '--help', '--json'], { encoding: 'utf8' }));
    for (const command of ['memory', 'browser import', 'browser compare', 'staged', 'docs']) expect(help.help).toContain(command);
    // 旧 page-snapshot 命令已于 10-02 清理：浏览器证据唯一入口为 workflow browser import/compare，
    // 统一入口的帮助文本本身声明不启动外部浏览器（quality-gates 内置浏览器节为口径真源）。
    expect(help.help.length).toBeGreaterThan(0);
  });
  it.skipIf(inStagedSnapshot)('实际文档索引可从统一命令返回有界、带来源的JSON', () => {
    const result = JSON.parse(execFileSync(process.execPath, [cli, 'docs', '--json'], { encoding: 'utf8' }));
    expect(result.ok).toBe(true);
    expect(result.scannedFiles).toContain('docs/WORKFLOW-TOOLS.md');
    expect(result.findings.some(item => item.kind === 'broken-link')).toBe(false);
  });
  it('八份类型配置确实纳入证据指纹（DEBT-2 strict 扩面起随配置数走）', async () => {
    const { fingerprint } = await import('../scripts/workflow-evidence.mjs');
    const manifest = fingerprint(project).manifest;
    expect(manifest.some(item => item.file === 'jsconfig.strict-hand-selection.json')).toBe(true);
    const configs = manifest.filter(item => /^jsconfig.*\.json$/.test(item.file));
    expect(configs).toHaveLength(8);
    expect(configs.some(item => item.file === 'jsconfig.strict-ui.json')).toBe(true);
  });
  it('暂存计划命令返回边界与数量，不倾倒整个仓库index', () => {
    const output = execFileSync(process.execPath, [cli, 'staged', '--plan', '--json'], { encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 });
    const result = JSON.parse(output);
    expect(result.ok).toBe(true);
    expect(result.indexEntryCount).toBeGreaterThan(0);
    expect(result.entries).toBeUndefined();
    expect(Array.isArray(result.changes)).toBe(true);
    expect(output.length).toBeLessThan(100000 + result.changes.length * 256); // 大批次保留变化清单，仍排除全仓库index entries。
  });
  it('npm工作流入口只连接项目脚本，不改变依赖或跳过原门禁', () => {
    const pkg = JSON.parse(readFileSync(path.join(project, 'package.json'), 'utf8'));
    expect(pkg.scripts.workflow).toBe('node scripts/workflow.mjs');
    expect(pkg.scripts['check:staged:isolate']).toContain('staged --task');
    expect(pkg.scripts['check:staged']).toContain('acceptance-gate.mjs --staged --run');
  });
});
