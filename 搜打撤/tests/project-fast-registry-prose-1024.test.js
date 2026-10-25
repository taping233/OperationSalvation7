// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, it } from 'vitest';
import { readLedger, planLedger } from '../scripts/workflow-ledger.mjs';
import { handoff } from '../scripts/workflow-status.mjs';
import { parseActiveRegistry, registryHits } from '../scripts/registry-paths.mjs';

const registry = `# 登记
## 活跃登记
Friday / 冻结查错 WF-frozen，2026-10-24：独占 \`game/src/agent/agent.scenes.js\`；保留上一批完成未提交增量。源码已冻结，集成验证中。

Alice（功能修复 WF-done）：属地 \`scripts/done.mjs\`。
完成未提交、编辑释放；无服务/提交。

| 会话 | 属地 | 事项 | 时间 | 状态 |
|---|---|---|---|---|
| Bob（表格 WF-table） | scripts/table.mjs | 改动 | 10-24 | 编辑中 |

## 无主物品
| 物品 | 现象 | 时间 | 备注 |
|---|---|---|---|

## 近期已释放
Friday（历史 WF-history）：属地 \`scripts/history.mjs\`；编辑中。
| 会话 | 属地 | 事项 | 时间 |
|---|---|---|---|
`;

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-prose-registry-'));
  mkdirSync(path.join(root, 'docs'));
  writeFileSync(path.join(root, 'docs/PARALLEL-REGISTRY.md'), registry);
  writeFileSync(path.join(root, 'docs/PENDING.md'), '## 活账\n| # | 事项 | 日期 | 来源 | 备注 |\n|---|---|---|---|---|\n## 已决记录\n| # | 事项 | 日期 | 来源 | 备注 |\n|---|---|---|---|---|\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root, stdio: 'pipe' });
  execFileSync('git', ['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-qm', 'fixture'], { cwd: root, stdio: 'pipe' });
  return root;
}

it('handoff includes paragraph claims, keeps frozen code occupied and completed ownership separate', () => {
  const root = fixture(), file = path.join(root, 'docs/PARALLEL-REGISTRY.md');
  const before = readFileSync(file, 'utf8');
  const ledger = readLedger(root, 'registry');
  expect(ledger.groups.editing.map(row => row.key)).toEqual(['WF-frozen', 'WF-table']);
  expect(ledger.groups['complete-uncommitted'].map(row => row.key)).toEqual(['WF-done']);
  const report = handoff(root, { task: 'WF-frozen' });
  expect(report.registry.rows.map(row => row.key)).toEqual(['WF-frozen']);
  expect(report.registry.rows[0].cells.join(' ')).toContain('集成验证中');
  expect(readFileSync(file, 'utf8')).toBe(before);
});

it('impact path protection sees the same paragraph source and ignores released sections', () => {
  const rows = parseActiveRegistry(registry);
  expect(registryHits(['game/src/agent/agent.scenes.js'], rows)).toMatchObject([
    { state: 'editing', isBlocking: true, action: 'coordinate-editing' },
  ]);
  expect(registryHits(['scripts/done.mjs'], rows)).toMatchObject([
    { state: 'complete-uncommitted', isBlocking: false, action: 'retain-ownership' },
  ]);
  expect(registryHits(['scripts/history.mjs'], rows)).toEqual([]);
});

it('table mutations cannot duplicate or overwrite an existing paragraph registration', () => {
  const root = fixture(), request = { kind: 'registry', key: 'WF-frozen', owner: 'Friday',
    cells: ['Friday（冻结 WF-frozen）', 'scripts/a.mjs', '验证', '10-24', '编辑中'] };
  expect(() => planLedger(root, { ...request, action: 'add' })).toThrow('已存在');
  expect(() => planLedger(root, { ...request, action: 'update' })).toThrow('段落登记');
});
