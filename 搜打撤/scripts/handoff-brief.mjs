#!/usr/bin/env node
// 接手简报（2026-09-29 体系降本批）：把接手检查单的机械步骤压成一条命令，
// 现查现算、不读记忆副本。现状事实永远来自 git 与台账真源。
// 用法：node scripts/handoff-brief.mjs （或 npm run handoff）
// 留言信箱存于 Edge localStorage，脚本读不到，仍需按检查单人工查看。
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const git = args => execSync(`git ${args}`, { cwd: repoDir, maxBuffer: 10 * 1024 * 1024 }).toString('utf8').trim();

// 取 markdown 某节内的表格数据行（跳过表头与 |---| 分隔行）。
const tableRows = (markdown, heading) => {
  const start = markdown.indexOf(heading);
  if (start < 0) return [];
  const rest = markdown.slice(start + heading.length);
  const body = rest.indexOf('\n## ') < 0 ? rest : rest.slice(0, rest.indexOf('\n## '));
  return body.split('\n').filter(line => {
    if (!line.trim().startsWith('|')) return false;
    const first = (line.split('|')[1] || '').trim();
    return first && !/^\s*[-:\s]+$/.test(first) && !['会话/来源', '#', '物品'].includes(first);
  });
};
const cell = (line, index) => (line.split('|')[index + 1] || '').trim();
const clip = (text, max) => (text.length > max ? `${text.slice(0, max)}…` : text);

console.log('== HEAD ==');
console.log(git('log -3 --oneline'));
console.log('\n== 工作树 ==');
const status = git('status --short');
console.log(status || '（干净）');

const registry = readFileSync(resolve(repoDir, 'docs/PARALLEL-REGISTRY.md'), 'utf8');
const active = tableRows(registry, '## 活跃登记');
console.log(`\n== 并行热点（活跃 ${active.length} 条，真源 docs/PARALLEL-REGISTRY.md）==`);
for (const line of active) console.log(`- [${cell(line, 4) || '无状态'}] ${cell(line, 1)}｜${clip(cell(line, 2), 80)}`);

const unowned = tableRows(registry, '## 无主物品');
console.log(`\n== 无主物品（勿动，${unowned.length} 条）==`);
for (const line of unowned) console.log(`- ${cell(line, 0)}：${clip(cell(line, 1), 60)}`);

const pending = readFileSync(resolve(repoDir, 'docs/PENDING.md'), 'utf8');
const open = tableRows(pending, '## 活账').filter(line => !line.includes('~~'));
console.log(`\n== 待拍板活账（${open.length} 条，真源 docs/PENDING.md）==`);
for (const line of open) console.log(`- ${cell(line, 0)} ${clip(cell(line, 1), 70)}`);
