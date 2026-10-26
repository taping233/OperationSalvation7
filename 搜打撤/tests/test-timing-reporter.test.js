// @vitest-environment node
import { expect, it } from 'vitest';
import { timingSummary } from '../scripts/test-timing-reporter.mjs';

const test = (name, state, note, mode = 'run') => ({ fullName: name, options: { mode }, location: { line: 9 }, result: () => ({ state, note }) });
const module = (file, tests, duration, state = 'passed') => ({ moduleId: '/project/' + file, project: { name: 'node' },
  state: () => state, children: { allTests: () => tests.values() },
  diagnostic: () => ({ duration, collectDuration: 2, environmentSetupDuration: 0, prepareDuration: 1 }) });

it('只汇总当次文件，失败、中断、跳过及未完成不混作通过', () => {
  const report = timingSummary('/project', [module('tests/slow.test.js', [test('ok', 'passed'), test('blocked', 'skipped', 'Windows EPERM'),
    test('unfinished', 'pending')], 90), module('tests/fast.test.js', [test('bad', 'failed')], 10, 'failed')], [new Error('unhandled')], 'interrupted', 1000, 1100);
  expect(report.counts).toEqual({ passed: 1, failed: 1, skipped: 1, pending: 1 });
  expect(report.reason).toBe('interrupted');
  expect(report.completed).toBe(false);
  expect(report.unhandledErrors).toBe(1);
  expect(report.wallMilliseconds).toBe(100);
  expect(report.slowestFiles.map(file => file.milliseconds)).toEqual([90, 10]);
  expect(report.files[0]).toMatchObject({ passed: 1, failed: 0, skipped: 1, pending: 1 });
  expect(report.skipped).toEqual([{ file: 'tests/slow.test.js', test: 'blocked', reason: 'Windows EPERM', reasonProvided: true, line: 9 }]);
});

it('声明跳过未附原因时明确标记，不编造环境故障', () => {
  const report = timingSummary('/project', [module('tests/skip.test.js', [test('conditional', 'skipped', undefined, 'skip'),
    test('future', 'skipped', undefined, 'todo')], 0, 'skipped')], [], 'passed', 0, 1);
  expect(report.counts.passed).toBe(0);
  expect(report.skipped[0]).toMatchObject({ reasonProvided: false, reason: expect.stringContaining('未提供具体原因') });
  expect(report.skipped[1].reason).toContain('todo');
});

it('收集阶段失败即使没有注册用例也必须单列失败文件', () => {
  const report = timingSummary('/project', [module('tests/import-error.test.js', [], 0, 'failed')], [], 'failed', 0, 1);
  expect(report.fileCounts.failed).toBe(1);
  expect(report.completed).toBe(false);
  expect(report.counts.passed).toBe(0);
});
