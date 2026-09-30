#!/usr/bin/env node
// 接手简报（2026-09-29 体系降本批）：把接手检查单的机械步骤压成一条命令，
// 现查现算、不读记忆副本。现状事实永远来自 git 与台账真源。
// 用法：node scripts/handoff-brief.mjs （或 npm run handoff）
// 留言信箱存于 Edge localStorage，脚本读不到，仍需按检查单人工查看。
import { formatHandoff, handoff } from './workflow-status.mjs';
import { parseArgs } from 'node:util';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: { task: { type: 'string' }, paths: { type: 'string' }, json: { type: 'boolean' } } });
  const report = handoff(repoDir, { task: values.task, paths: values.paths?.split(',').map(item => item.trim()) });
  console.log(values.json ? JSON.stringify(report) : formatHandoff(report));
} catch (error) {
  console.error(JSON.stringify({ ok: false, error: error.message }));
  process.exitCode = 1;
}
