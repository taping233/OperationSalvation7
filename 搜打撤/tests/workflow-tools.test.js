import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {afterEach, describe, expect, it, vi } from 'vitest';
import { applyLedger, hash, planLedger, readLedger, table } from '../scripts/workflow-ledger.mjs';
import { checkArguments, fingerprint, freshness } from '../scripts/workflow-evidence.mjs';
import { archivePlan, snapshot } from '../scripts/workflow-archive.mjs';
import { commitReferences, findExisting, ledgerWarnings } from '../scripts/workflow-status.mjs';

// tsc 子进程类契约测试固有慢：默认 5s 在全量并行负载下必超时（与 boot.test 同族）
vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

const temporaryRoots = [];
const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(project, 'scripts/workflow.mjs');
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-workflow-test-'));
  temporaryRoots.push(root);
  mkdirSync(path.join(root, 'docs'), { recursive: true });
  writeFileSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'), '# 登记\r\n## 活跃登记\r\n| 会话/来源 | 属地 | 事项 | 登记时间 | 状态 |\r\n|---|---|---|---|---|\r\n| Alice（测试 WF-one） | scripts/a.mjs | 测试 | 09-30 | 编辑中 |\r\n| Bob（测试 WF-two） | scripts/b.mjs | 测试 | 09-30 | 编辑中 |\r\n\r\n## 无主物品\r\n| 物品 | 现象 | 时间 | 备注 |\r\n|---|---|---|---|\r\n## 近期已释放\r\n| 会话/来源 | 属地 | 事项 | 时段 |\r\n|---|---|---|---|\r\n');
  writeFileSync(path.join(root, 'docs/PENDING.md'), '# 待办\n## 活账\n| # | 事项 | 发现时间 | 来源 | 备注 |\n|---|---|---|---|---|\n| 1 | 事项 | 日期 | 来源 | 备注 |\n## 已决记录（不计入活账）\n| # | 事项与结果 | 决策时间 | 来源 | 后续 |\n|---|---|---|---|---|\n');
  return root;
}
afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-workflow-test-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('台账写入边界', () => {
  it('预览不写，应用只改自有行，并保留中文/其他会话与 CRLF', () => {
    const root = fixture();
    const file = path.join(root, 'docs/PARALLEL-REGISTRY.md');
    const before = readFileSync(file, 'utf8');
    const plan = planLedger(root, { kind: 'registry', action: 'update', key: 'WF-one', owner: 'Alice',
      cells: ['Alice（测试 WF-one）', 'scripts/a.mjs', '已定向验证', '09-30', '完成未提交'] });
    expect(readFileSync(file, 'utf8')).toBe(before);
    applyLedger(root, plan, plan.expectedSha256);
    const after = readFileSync(file, 'utf8');
    expect(after).toBe(before.replace('测试 | 09-30 | 编辑中', '已定向验证 | 09-30 | 完成未提交'));
    expect(after).toContain('Bob（测试 WF-two）');
    expect(after).toContain('\r\n');
  });
  it('其他人改过台账就拒绝写，不留下锁或覆盖新内容', () => {
    const root = fixture();
    const file = path.join(root, 'docs/PARALLEL-REGISTRY.md');
    const plan = planLedger(root, { kind: 'registry', action: 'update', key: 'WF-one', owner: 'Alice',
      cells: ['Alice（测试 WF-one）', 'scripts/a.mjs', '验证', '09-30', '待验收'] });
    writeFileSync(file, readFileSync(file, 'utf8') + '\r\n别人补充\r\n');
    expect(() => applyLedger(root, plan, plan.expectedSha256)).toThrow('已变化');
    expect(readFileSync(file, 'utf8')).toContain('别人补充');
    expect(existsSync(file + '.workflow-lock')).toBe(false);
  });
  it('拒绝无版本写入、错误负责人、重复 ID、表格注入和未知台账', () => {
    const root = fixture();
    const request = { kind: 'registry', action: 'update', key: 'WF-one', owner: 'Alice',
      cells: ['Alice（测试 WF-one）', 'scripts/a.mjs', '验证', '09-30', '待验收'] };
    const plan = planLedger(root, request);
    expect(() => applyLedger(root, plan)).toThrow('--expect');
    expect(() => planLedger(root, { ...request, action: 'add' })).toThrow('已存在');
    expect(() => planLedger(root, { ...request, owner: 'Bob', cells: ['Bob（测试 WF-one）', ...request.cells.slice(1)] })).toThrow('负责人');
    expect(() => planLedger(root, { ...request, cells: ['Alice（测试 WF-one）', 'a|b', ...request.cells.slice(2)] })).toThrow('单元格');
    expect(() => readLedger(root, '../outside')).toThrow('仅支持');
  });
  it('明确收官后移入历史表，保留相邻活账；已关闭编号不能重新登记', () => {
    const root = fixture();
    const plan = planLedger(root, { kind: 'registry', action: 'close', key: 'WF-one', owner: 'Alice',
      cells: ['Alice（测试 WF-one）', 'scripts/a.mjs', '完成未提交；证据 docs/evidence/test/', '09-30'] });
    applyLedger(root, plan, plan.expectedSha256);
    expect(readLedger(root, 'registry').rows.map(row => row.key)).toEqual(['WF-two']);
    expect(table(readFileSync(path.join(root, plan.file), 'utf8'), '近期已释放').rows[0].cells[0]).toContain('WF-one');
    expect(() => planLedger(root, { kind: 'registry', action: 'add', key: 'WF-one', owner: 'Alice',
      cells: ['Alice（测试 WF-one）', 'scripts/a.mjs', '再开', '09-30', '编辑中'] })).toThrow('已存在');
  });
  it('待拍板收官保留编号与明确结果，编号不可变更', () => {
    const root = fixture();
    const options = { kind: 'pending', action: 'close', key: '1', cells: ['~~1~~', '老板决定保留', '09-30', '原来源', '已回写'] };
    const plan = planLedger(root, options);
    applyLedger(root, plan, plan.expectedSha256);
    expect(readLedger(root, 'pending').rows).toHaveLength(0);
    expect(() => planLedger(fixture(), { ...options, cells: ['2', ...options.cells.slice(1)] })).toThrow('编号');
    expect(() => planLedger(fixture(), { kind: 'pending', action: 'update', key: '1',
      cells: ['1', '确认后的事项', '09-30', '老板本会话', ''] })).not.toThrow();
  });
  it('已有工具锁时不删别人的锁、不写目标', () => {
    const root = fixture();
    const plan = planLedger(root, { kind: 'pending', action: 'update', key: '1', cells: ['1', '新事项', '日期', '来源', '备注'] });
    const file = path.join(root, plan.file);
    writeFileSync(file + '.workflow-lock', 'other session');
    expect(() => applyLedger(root, plan, plan.expectedSha256)).toThrow();
    expect(readFileSync(file + '.workflow-lock', 'utf8')).toBe('other session');
    expect(hash(readFileSync(file, 'utf8'))).toBe(plan.expectedSha256);
  });
});

describe('验收证据可信边界', () => {
  it('文档变化可保留候选；源码/新增测试变化使旧证据失效', () => {
    const root = fixture();
    const before = fingerprint(root);
    const report = { schemaVersion: 1, exitCode: 0, before, after: before };
    writeFileSync(path.join(root, 'docs/notes.md'), '只是说明');
    expect(freshness(report, fingerprint(root)).result).toBe('candidate');
    const docBefore = fingerprint(root, { documents: true });
    writeFileSync(path.join(root, 'docs/notes.md'), '说明改了');
    expect(freshness({ schemaVersion: 1, exitCode: 0, before: docBefore, after: docBefore },
      fingerprint(root, { documents: true })).result).toBe('stale');
    mkdirSync(path.join(root, 'game/src'), { recursive: true });
    writeFileSync(path.join(root, 'game/src/new.js'), 'export const value = 1;');
    expect(freshness(report, fingerprint(root)).result).toBe('stale');
    const sourceBefore = fingerprint(root);
    mkdirSync(path.join(root, 'game/tools'), { recursive: true });
    writeFileSync(path.join(root, 'game/tools/agent-policy.mjs'), 'export const policy = 1;');
    expect(freshness({ schemaVersion: 1, exitCode: 0, before: sourceBefore, after: sourceBefore }, fingerprint(root)).result).toBe('stale');
  });
  it('失败、信号中断、过程中改动都不能成为可复用候选', () => {
    const before = { sha256: 'old' }, after = { sha256: 'new' };
    expect(freshness({ schemaVersion: 1, before, after: before, exitCode: 1 }, before).eligibleForReview).toBe(false);
    expect(freshness({ schemaVersion: 1, before, after: before, exitCode: null }, before).result).toBe('failed');
    expect(freshness({ schemaVersion: 1, before, after: before, exitCode: 0, signal: 'SIGTERM' }, before).eligibleForReview).toBe(false);
    expect(freshness({ schemaVersion: 1, before, after, exitCode: 0 }, after).result).toBe('changed-during-check');
  });
  it('必须明确验证范围，显式定向不会退化成全量', () => {
    expect(() => checkArguments({})).toThrow('只能选');
    expect(() => checkArguments({ tests: ['tests/a.test.js'], full: true })).toThrow('只能选');
    expect(checkArguments({ tests: ['tests/a.test.js'] })).toEqual(['scripts/acceptance-gate.mjs', '--target-tests', 'tests/a.test.js']);
    expect(checkArguments({ suite: true })[0]).toBe('node_modules/vitest/vitest.mjs');
  });
});

describe('防重复建设与归档', () => {
  it('交接来源的会话 UUID 和 SHA256 不能误认作 Git 提交', () => {
    expect(commitReferences('来源会话 01a0f009-2a31-7850-a09f-208ebe7cb113，提交 `fd38468`；哈希 ' + 'a'.repeat(64)))
      .toEqual(['fd38468']);
  });
  it('命中现有工具与冲突措辞，历史内容需显式查；检测同正文仍不删除', () => {
    const root = fixture();
    mkdirSync(path.join(root, 'scripts'));
    writeFileSync(path.join(root, 'scripts/existing.mjs'), 'const handoff = true;');
    mkdirSync(path.join(root, 'docs/archive/old'), { recursive: true });
    writeFileSync(path.join(root, 'docs/archive/old/history.md'), 'handoff 历史工具');
    writeFileSync(path.join(root, 'docs/a.md'), '定向→全量→实页三级验收；双提交落库');
    writeFileSync(path.join(root, 'docs/b.md'), readFileSync(path.join(root, 'docs/a.md')));
    writeFileSync(path.join(root, 'docs/browser.md'), '不得切外部 headless Edge/CDP。');
    expect(findExisting(root, 'handoff').matches).toHaveLength(1);
    expect(findExisting(root, 'handoff', 20, true).matches[0].file).toContain('archive');
    expect(archivePlan(root).duplicates[0].files).toEqual(['docs/a.md', 'docs/b.md']);
    expect(archivePlan(root).review.some(item => item.code === 'implicit-commit')).toBe(true);
    expect(archivePlan(root).review.some(item => item.file === 'docs/browser.md')).toBe(false);
    expect(existsSync(path.join(root, 'docs/b.md'))).toBe(true);
    const rows = [{ key: 'WF-x', cells: ['Alice', 'scripts/a.mjs'] }, { key: 'WF-x', cells: ['Bob', 'scripts/a.mjs'] }];
    expect(ledgerWarnings(rows, 'registry').map(item => item.code)).toEqual(['duplicate-id', 'overlapping-path']);
  });
  it('归档保留原文和哈希，不改源，不覆盖历史，不接受路径逃逸', () => {
    const root = fixture();
    const file = path.join(root, 'docs/PENDING.md');
    const before = readFileSync(file);
    const manifest = snapshot(root, 'test-archive', ['docs/PENDING.md'], 'docs/WORKFLOW-TOOLS.md');
    expect(readFileSync(file)).toEqual(before);
    expect(readFileSync(path.join(root, manifest.items[0].target))).toEqual(before);
    expect(manifest.items[0].sha256).toBe(hash(before));
    expect(() => snapshot(root, 'test-archive', ['docs/PENDING.md'])).toThrow('禁止覆盖');
    expect(() => snapshot(root, '../../outside', ['docs/PENDING.md'])).toThrow('任务编号');
    expect(() => snapshot(root, 'other', ['../outside.md'])).toThrow('明确项目相对路径');
  });
});

describe('命令行可复用', () => {
  it('在其他工作目录也能发现项目，JSON 为单个可解析对象', () => {
    const output = execFileSync(process.execPath, [cli, 'find', '--query', 'handoff-brief', '--json'], { cwd: os.tmpdir(), encoding: 'utf8' });
    expect(JSON.parse(output).ok).toBe(true);
    const help = execFileSync(process.execPath, [cli, '--help'], { cwd: os.tmpdir(), encoding: 'utf8' });
    expect(help).toContain('archive snapshot');
    const helpJson = JSON.parse(execFileSync(process.execPath, [cli, '--help', '--json'], { encoding: 'utf8' }));
    expect(helpJson.ok).toBe(true);
    expect(helpJson.help).toContain('archive snapshot');
  });
  it('错误 JSON 与非零退出，预览验收不启动子进程', () => {
    const failed = spawnSync(process.execPath, [cli, 'verify', '--tests', 'a,', '--json'], { encoding: 'utf8' });
    expect(failed.status).not.toBe(0);
    expect(JSON.parse(failed.stdout).ok).toBe(false);
    const plan = JSON.parse(execFileSync(process.execPath, [cli, 'verify', '--tests', 'tests/workflow-tools.test.js', '--plan', '--json'], { encoding: 'utf8' }));
    expect(plan.dryRun).toBe(true);
    expect(plan.command).toContain('--target-tests');
  });
});
