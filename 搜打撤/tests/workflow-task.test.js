import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { applyTask, planTask, readTask, summarizeTasks } from '../scripts/workflow-task.mjs';

const owned = [];
function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-task-test-'));
  owned.push(root);
  return root;
}
const identity = { id: 'WF-small', date: '2026-09-30', owner: 'Alice' };
const input = { goal: '减少重复维护', paths: ['scripts/new.mjs'], doneWhen: ['相关测试通过'], stage: 'doing' };
function start(root) {
  const plan = planTask(root, { ...identity, action: 'start', input });
  return applyTask(root, plan, plan.expectedSha256);
}
afterEach(() => {
  for (const root of owned.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-task-test-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('单一任务执行记录', () => {
  it('start默认只预览，显式apply新建，不产生台账副本', () => {
    const root = fixture();
    const plan = planTask(root, { ...identity, action: 'start', input });
    expect(existsSync(path.join(root, 'docs'))).toBe(false);
    expect(() => applyTask(root, plan)).toThrow('--expect');
    applyTask(root, plan, 'absent');
    expect(readTask(root, identity).task).toMatchObject({ ...identity, goal: input.goal, stage: 'doing' });
    expect(existsSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'))).toBe(false);
    expect(() => planTask(root, { ...identity, action: 'start', input })).toThrow('已存在');
    expect(() => planTask(root, { ...identity, date: '2026-10-01', action: 'start', input })).toThrow('其他日期');
  });
  it('拒绝负责人冒用、身份或路径越界、更新直接终态', () => {
    const root = fixture();
    start(root);
    expect(() => planTask(root, { ...identity, owner: 'Bob', action: 'update', input: { goal: '篡改' } })).toThrow('负责人');
    expect(() => planTask(root, { ...identity, action: 'update', input: { id: 'other' } })).toThrow('身份');
    expect(() => planTask(root, { ...identity, action: 'update', input: { paths: ['../outside'] } })).toThrow('相对路径');
    expect(() => planTask(root, { ...identity, id: '../outside', action: 'start', input })).toThrow('任务编号');
    expect(() => planTask(root, { ...identity, action: 'update', input: { stage: 'complete-uncommitted' } })).toThrow('close');
  });
  it('并发内容变化拒写，别人的锁不删除', () => {
    const root = fixture();
    const initial = start(root);
    const plan = planTask(root, { ...identity, action: 'update', input: { goal: '改进目标' } });
    writeFileSync(path.join(root, initial.file), readFileSync(path.join(root, initial.file), 'utf8') + ' ');
    expect(() => applyTask(root, plan, plan.expectedSha256)).toThrow('已变化');
    expect(existsSync(path.join(root, initial.file + '.workflow-lock'))).toBe(false);
    const next = planTask(root, { ...identity, action: 'update', input: { goal: '改进目标' } });
    writeFileSync(path.join(root, initial.file + '.workflow-lock'), 'other');
    expect(() => applyTask(root, next, next.expectedSha256)).toThrow();
    expect(readFileSync(path.join(root, initial.file + '.workflow-lock'), 'utf8')).toBe('other');
  });
  it('close必须声明检查与未验证项，完成是负责人手工判断并保留未提交', () => {
    const root = fixture();
    start(root);
    expect(() => planTask(root, { ...identity, action: 'close', input: { stage: 'complete-uncommitted' } })).toThrow('checks');
    const closure = { stage: 'complete-uncommitted', checks: [{ kind: 'manual', description: '定向测试5项通过', result: 'passed' }], unverified: ['远端CI未验'] };
    expect(() => planTask(root, { ...identity, action: 'close', input: closure })).toThrow('doneWhenConfirmed');
    const plan = planTask(root, { ...identity, action: 'close', input: { ...closure, doneWhenConfirmed: true } });
    applyTask(root, plan, plan.expectedSha256);
    const task = readTask(root, identity).task;
    expect(task.closure).toMatchObject({ kind: 'manual', doneWhenConfirmed: true });
    expect(task.unverified).toEqual(['远端CI未验']);
    expect(() => planTask(root, { ...identity, action: 'update', input: { stage: 'doing' } })).toThrow('已收官');
  });
  it('passed报告核实退出码/信号/错误/稳定指纹，不将exit0自动等同完成', () => {
    const root = fixture();
    start(root);
    const report = 'docs/evidence/2026-09-30-WF-small/result.json';
    const valid = { kind: 'automated-local-check', exitCode: 0, signal: null, error: null, validation: { mode: 'targeted', executed: true }, before: { sha256: 'same' }, after: { sha256: 'same' } };
    const closure = { stage: 'partial', checks: [{ kind: 'report', report, result: 'passed' }], unverified: ['实页未验'] };
    for (const mutation of [{ exitCode: 1 }, { signal: 'SIGTERM' }, { error: 'failed' }, { outcome: 'skip' }, { validation: { mode: 'skip', executed: false } }, { after: { sha256: 'different' } }]) {
      writeFileSync(path.join(root, report), JSON.stringify({ ...valid, ...mutation }));
      expect(() => planTask(root, { ...identity, action: 'close', input: closure })).toThrow('passed');
    }
    writeFileSync(path.join(root, report), JSON.stringify(valid));
    const plan = planTask(root, { ...identity, action: 'close', input: closure });
    applyTask(root, plan, plan.expectedSha256);
    expect(readTask(root, identity).task.stage).toBe('partial');
    expect(readTask(root, identity).task.checks[0].sha256).toMatch(/^[a-f0-9]{64}$/);
  });
  it('隔离报告可收官，但index/依赖/快照变化或skip仍拒绝', () => {
    const root = fixture(); start(root);
    const report = 'docs/evidence/2026-09-30-WF-small/staged.json';
    const digest = 'a'.repeat(64);
    const valid = { kind: 'staged-snapshot-check', exitCode: 0, commandExitCode: 0, outcome: 'passed', gate: { mode: 'quick' }, plan: { indexSha256: digest, dependencies: { ok: true } }, indexAfterSha256: digest, dependenciesAfterCopy: { ok: true }, gitView: { isolatedMetadata: true, indexSha256: digest }, snapshotIndexAfterSha256: digest, snapshotTrackedMutations: [], snapshotRemoved: true };
    const closure = { stage: 'partial', checks: [{ kind: 'report', report, result: 'passed' }], unverified: [] };
    for (const mutation of [{ outcome: 'skip' }, { indexAfterSha256: 'b'.repeat(64) }, { snapshotIndexAfterSha256: 'b'.repeat(64) }, { dependenciesAfterCopy: { ok: false } }, { snapshotTrackedMutations: ['scripts/a.js'] }]) {
      writeFileSync(path.join(root, report), JSON.stringify({ ...valid, ...mutation }));
      expect(() => planTask(root, { ...identity, action: 'close', input: closure })).toThrow('passed');
    }
    writeFileSync(path.join(root, report), JSON.stringify(valid));
    const plan = planTask(root, { ...identity, action: 'close', input: closure });
    applyTask(root, plan, plan.expectedSha256);
    expect(readTask(root, identity).task.stage).toBe('partial');
  });
  it('summary从记录生成并筛负责人；首次计划不能覆盖随后出现的任务', () => {
    const root = fixture();
    const stale = planTask(root, { ...identity, action: 'start', input });
    start(root);
    expect(() => applyTask(root, stale, 'absent')).toThrow('已变化');
    expect(summarizeTasks(root, { owner: 'Alice' }).tasks).toHaveLength(1);
    expect(summarizeTasks(root, { owner: 'Bob' }).tasks).toHaveLength(0);
    mkdirSync(path.join(root, 'docs/evidence/not-a-task'), { recursive: true });
    expect(summarizeTasks(root).tasks).toHaveLength(1);
  });
  it('状态变化不否定代码报告；预览后报告变化拒绝落账', () => {
    const root = fixture();
    start(root);
    const report = 'docs/evidence/2026-09-30-WF-small/result.json';
    const before = { sha256: 'before', environment: { node: 'test' }, manifest: [{ file: 'scripts/a.mjs', sha256: 'code' }, { file: 'docs/STATUS.md', sha256: 'old-state' }] };
    const after = { ...before, sha256: 'after', manifest: [{ file: 'scripts/a.mjs', sha256: 'code' }, { file: 'docs/STATUS.md', sha256: 'new-state' }] };
    writeFileSync(path.join(root, report), JSON.stringify({ kind: 'automated-local-check', exitCode: 0, validation: { mode: 'targeted', executed: true }, before, after }));
    const plan = planTask(root, { ...identity, action: 'close', input: { stage: 'partial', checks: [{ kind: 'report', report, result: 'passed' }], unverified: ['实页未验'] } });
    writeFileSync(path.join(root, report), 'changed');
    expect(() => applyTask(root, plan, plan.expectedSha256)).toThrow('报告已变化');
    expect(readTask(root, identity).task.stage).toBe('doing');
  });
});
