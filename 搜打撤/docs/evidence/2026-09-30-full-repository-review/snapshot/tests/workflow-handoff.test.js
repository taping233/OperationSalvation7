import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatHandoff, handoff } from '../scripts/workflow-status.mjs';

const roots = [];
function put(root, file, content) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), content);
}
function gitAt(root, ...args) { return execFileSync('git', ['-c', 'core.autocrlf=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
function fixture(nested = false) {
  const repository = mkdtempSync(path.join(os.tmpdir(), 'sdt-handoff-'));
  roots.push(repository);
  const root = nested ? path.join(repository, '搜打撤 工程') : repository;
  mkdirSync(root, { recursive: true });
  put(root, 'docs/PARALLEL-REGISTRY.md', '# 占用\n## 活跃登记\n| 会话 | 范围 | 事项 | 时间 | 状态 |\n|---|---|---|---|---|\n'
    + '| Alice（cards WF-cards） | game/src/cards/ | 卡牌 | 09-30 | 编辑中 |\n'
    + '| Bob（other WF-other） | game/src/cards2/ | 邻域 | 09-30 | 编辑中 |\n'
    + '| Chen（中文 WF-chinese） | game/src/中文 空格/ | 中文路径 | 09-30 | 编辑中 |\n'
    + '\n## 无主物品\n| 物品 | 现象 | 时间 | 备注 |\n|---|---|---|---|\n| game/src/cards/unowned.js | 未知 | 09-30 | 勿动 |\n| other物品 | 未知 | 09-30 | 勿动 |\n'
    + '\n## 近期已释放\n| 会话 | 范围 | 事项 | 时间 |\n|---|---|---|---|\n| 历史 | scripts/old.js | 引用 abcdef0 | 昨日 |\n');
  put(root, 'docs/PENDING.md', '# 拍板\n## 活账\n| # | 事项 | 发现 | 来源 | 备注 |\n|---|---|---|---|---|\n'
    + '| 1 | 卡牌取舍 | 09-30 | WF-cards | game/src/cards/ |\n| 2 | 其他域 | 09-30 | WF-other | game/src/cards2/ |\n'
    + '\n## 已决记录\n| # | 事项 | 时间 | 来源 | 后续 |\n|---|---|---|---|---|\n');
  put(root, 'game/src/cards/a.js', 'a'); put(root, 'game/src/cards2/a.js', 'b');
  put(root, 'game/src/中文 空格/按钮.js', 'c');
  put(root, 'docs/evidence/2026-09-30-cards/task.json', JSON.stringify({ id: 'cards', owner: 'Alice', goal: '卡牌', paths: ['game/src/cards'],
    doneWhen: ['定向通过'], stage: 'editing', checks: [], unverified: [], updatedAt: '2026-09-30T10:00:00Z' }));
  put(root, 'docs/evidence/2026-09-30-other/task.json', JSON.stringify({ id: 'other', owner: 'Bob', goal: '邻域', paths: ['game/src/cards2'],
    doneWhen: [], stage: 'editing', checks: [], unverified: [], updatedAt: '2026-09-30T11:00:00Z' }));
  gitAt(repository, 'init', '-q'); gitAt(repository, 'add', '.');
  gitAt(repository, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture');
  put(root, 'game/src/cards/a.js', 'changed cards'); put(root, 'game/src/cards2/a.js', 'changed neighbor');
  put(root, 'game/src/中文 空格/按钮.js', 'changed chinese');
  return { root, repository };
}
afterEach(() => {
  for (const root of roots.splice(0)) {
    if (!root.startsWith(path.join(os.tmpdir(), 'sdt-handoff-'))) throw new Error('拒绝清理非自有 fixture');
    rmSync(root, { recursive: true, force: true });
  }
});

describe('任务定向接手简报', () => {
  it('任务 id 与登记 WF-id 同向，目录边界不包含 cards2，JSON 明确省略', () => {
    const { root } = fixture();
    for (const task of ['cards', 'WF-cards']) {
      const report = handoff(root, { task });
      expect(report.taskRecord.status).toBe('found');
      expect(report.changes.map(item => item.path)).toEqual(['game/src/cards/a.js']);
      expect(report.registry.rows.map(item => item.key)).toEqual(['WF-cards']);
      expect(report.pending.rows.map(item => item.key)).toEqual(['1']);
      expect(report.omitted).toMatchObject({ changes: 2, registry: 2, pending: 1, unowned: 1, evidence: 1 });
      expect(report.recentTasks.map(item => item.id)).toEqual(['cards']);
      expect(report.evidence[0].status).toBe('candidate-only');
    }
  });
  it('缺任务记录明确 not-found，不随意回退最近任务或展示其他域 Git', () => {
    const { root } = fixture();
    const report = handoff(root, { task: 'missing' });
    expect(report.taskRecord).toMatchObject({ status: 'not-found', id: 'missing' });
    expect(report.changes).toEqual([]); expect(report.evidence).toEqual([]); expect(report.recentTasks).toEqual([]);
    expect(report.omitted.changes).toBe(3);
    expect(formatHandoff(report)).toContain('not-found');
    expect(report.limits.join(' ')).toContain('不代表全局无问题');
  });
  it('嵌套仓库、Windows 分隔符、中文、空格及改名前路径正确保留', () => {
    const { root } = fixture(true);
    const report = handoff(root, { paths: ['game\\src\\中文 空格'] });
    expect(report.changes.map(item => item.path)).toEqual(['game/src/中文 空格/按钮.js']);
    expect(report.registry.rows.map(item => item.key)).toEqual(['WF-chinese']);
    gitAt(root, 'mv', 'game/src/中文 空格/按钮.js', 'game/src/new-name.js');
    const renamed = handoff(root, { paths: ['game/src/中文 空格'] });
    expect(renamed.changes).toHaveLength(1);
    expect(renamed.changes[0]).toMatchObject({ path: 'game/src/new-name.js', originalPath: 'game/src/中文 空格/按钮.js' });
  });
  it('人读摘要保持短，不输出全部工作树、记忆 JSON、历史整账或日志', () => {
    const { root } = fixture();
    for (let index = 0; index < 20; index++) put(root, `game/src/cards/new ${index}.js`, 'new');
    // Report/log files are not parsed to build a task summary.
    put(root, 'docs/evidence/2026-09-30-cards/huge-report.json', 'broken json should not be read');
    const report = handoff(root), text = formatHandoff(report);
    expect(text.split('\n').length).toBeLessThanOrEqual(22);
    expect(text).toContain('省略'); expect(text).toContain('--json');
    expect(text).not.toContain('"codex"'); expect(text).not.toContain('abcdef0');
    expect(text).not.toContain('broken json'); expect(text).not.toContain('game/src/cards/new 9.js');
    expect(report.recentTasks.map(item => item.id)).toEqual(['other', 'cards']);
    expect(report.warnings.some(item => item.commit === 'abcdef0')).toBe(false);
  });
  it('摘要严格只读，不修改 index、台账或任务记录；范围逃逸拒绝', () => {
    const { root, repository } = fixture();
    const files = [path.join(repository, '.git/index'), path.join(root, 'docs/PENDING.md'),
      path.join(root, 'docs/PARALLEL-REGISTRY.md'), path.join(root, 'docs/evidence/2026-09-30-cards/task.json')];
    const before = files.map(file => readFileSync(file));
    handoff(root, { task: 'cards' });
    for (let index = 0; index < files.length; index++) expect(readFileSync(files[index])).toEqual(before[index]);
    expect(existsSync(path.join(repository, '.git/index.lock'))).toBe(false);
    expect(() => handoff(root, { paths: ['../outside'] })).toThrow('项目内');
  });
  it('重复任务 id 明确 ambiguous，小元数据无效/过大记录只统计跳过', () => {
    const { root } = fixture();
    const task = readFileSync(path.join(root, 'docs/evidence/2026-09-30-cards/task.json'));
    put(root, 'docs/evidence/2026-09-29-cards/task.json', task);
    put(root, 'docs/evidence/2026-09-30-broken/task.json', '{broken');
    put(root, 'docs/evidence/2026-09-30-big/task.json', ' '.repeat(70 * 1024));
    const report = handoff(root, { task: 'cards' });
    expect(report.taskRecord.status).toBe('ambiguous');
    expect(report.taskRecord.matches).toHaveLength(2);
    expect(report.counts.skippedTaskMetadata).toBe(2);
    expect(report.changes).toEqual([]);
    expect(formatHandoff(report)).toContain('元数据跳过 2 项');
  });
  it('定向保留本任务活账引用提交疑点，其他任务未确认提交只计省略', () => {
    const { root } = fixture();
    const ledger = path.join(root, 'docs/PENDING.md');
    writeFileSync(ledger, readFileSync(ledger, 'utf8').replace('卡牌取舍', '卡牌取舍 abcdef1').replace('其他域', '其他域 abcdef2'));
    const report = handoff(root, { task: 'cards' });
    expect(report.warnings.filter(item => item.code === 'unconfirmed-commit').map(item => item.commit)).toEqual(['abcdef1']);
    expect(report.omitted.warnings).toBe(1);
  });
});
