// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { taskInputFromValues } from '../scripts/workflow-task-input.mjs';

const start = { goal: ' 修正接口 ', paths: 'scripts/a.mjs, docs/a.md', 'done-when': [' 测试通过 ', '文档对应'], stage: 'doing' };

describe('任务直接字段输入', () => {
  it('映射重复字段与 CSV，不修改调用者输入，不注入身份或通过证据', () => {
    const values = { ...start, owner: 'Friday', task: 'WF-test', date: '2026-10-02' };
    const before = JSON.stringify(values);
    expect(taskInputFromValues('start', values)).toEqual({ goal: '修正接口', paths: ['scripts/a.mjs', 'docs/a.md'], doneWhen: ['测试通过', '文档对应'], stage: 'doing' });
    expect(JSON.stringify(values)).toBe(before);
  });
  it('保留 input 路线，任何直接字段都不能混用，缺失输入友好报错', () => {
    expect(taskInputFromValues('start', { input: 'task.json' })).toBeNull();
    for (const [field, value] of Object.entries({ ...start, 'done-when-confirmed': true, check: ['manual:passed:已核对'], unverified: ['CI'], 'checks-none': true, 'unverified-none': true })) {
      expect(() => taskInputFromValues('update', { input: 'task.json', [field]: value })).toThrow('混用');
    }
    expect(() => taskInputFromValues('start', { owner: 'Friday' })).toThrow('提供 --input');
    expect(() => taskInputFromValues('start', { input: '' })).toThrow('非空');
  });
  it('start 缺少必需项、空 CSV 项或空完成标准不偷偷接受', () => {
    for (const missing of ['goal', 'paths', 'done-when']) {
      const values = { ...start }; delete values[missing];
      expect(() => taskInputFromValues('start', values)).toThrow('需要');
    }
    expect(() => taskInputFromValues('start', { ...start, paths: 'scripts/a.mjs,' })).toThrow('非空');
    expect(() => taskInputFromValues('start', { ...start, 'done-when': [] })).toThrow('至少一项');
  });
  it('update 仅传提供字段，显式 none 才清空原数组', () => {
    expect(taskInputFromValues('update', { goal: '只改目标' })).toEqual({ goal: '只改目标' });
    expect(taskInputFromValues('update', { 'checks-none': true, 'unverified-none': true })).toEqual({ checks: [], unverified: [] });
    expect(() => taskInputFromValues('update', { 'checks-none': true, check: ['manual:passed:说明'] })).toThrow('混用');
    expect(() => taskInputFromValues('update', { 'unverified-none': true, unverified: ['CI'] })).toThrow('混用');
    expect(() => taskInputFromValues('update', { 'checks-none': false })).toThrow('明确启用');
  });
  it('check 只拆前两冒号，保留说明冒号和报告原路径，严格拒绝未知种类和结果', () => {
    expect(taskInputFromValues('update', { check: ['manual:passed:已核对：步骤:退出码', 'report:failed:docs/evidence/demo/report.json', 'manual:unverified:尚未执行'] }).checks)
      .toEqual([{ kind: 'manual', result: 'passed', description: '已核对：步骤:退出码' }, { kind: 'report', result: 'failed', report: 'docs/evidence/demo/report.json' }, { kind: 'manual', result: 'unverified', description: '尚未执行' }]);
    for (const value of ['manual:ok:说明', 'auto:passed:说明', 'manual:passed: ', 'report:passed', 'manual:passed']) {
      expect(() => taskInputFromValues('update', { check: [value] })).toThrow('--check');
    }
  });
  it('close 必须明确终态和两个数组，完成还需要人工确认', () => {
    const values = { stage: 'complete-uncommitted', 'checks-none': true, 'unverified-none': true, 'done-when-confirmed': true };
    expect(taskInputFromValues('close', values)).toEqual({ stage: 'complete-uncommitted', doneWhenConfirmed: true, checks: [], unverified: [] });
    for (const field of ['stage', 'checks-none', 'unverified-none', 'done-when-confirmed']) {
      const incomplete = { ...values }; delete incomplete[field];
      expect(() => taskInputFromValues('close', incomplete)).toThrow(field === 'done-when-confirmed' ? '完成' : '明确');
    }
    expect(taskInputFromValues('close', { stage: 'partial', check: ['manual:failed:检查失败'], unverified: ['保留现场'] }))
      .toEqual({ stage: 'partial', checks: [{ kind: 'manual', result: 'failed', description: '检查失败' }], unverified: ['保留现场'] });
    expect(() => taskInputFromValues('close', { ...values, 'done-when-confirmed': 'true' })).toThrow('布尔');
    expect(() => taskInputFromValues('read', values)).toThrow('仅支持');
  });
});
