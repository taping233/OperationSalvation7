#!/usr/bin/env node
// Legacy command name retained; browser control belongs to the current platform.
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { importBrowserEvidence, writeBrowserComparison } from './workflow-browser.mjs';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  const { values } = parseArgs({ options: {
    input: { type: 'string' }, compare: { type: 'string' }, task: { type: 'string' },
    date: { type: 'string' }, help: { type: 'boolean' }, json: { type: 'boolean' },
  } });
  if (values.help) {
    const help = 'page-snapshot 只导入/对比当前平台内置浏览器快照，不启动 Edge/CDP/headless。用法：--input <快照.json> --task <编号> [--compare <前快照.json>] [--json]；采集与限制见 docs/WORKFLOW-TOOLS.md。';
    process.stdout.write(values.json ? JSON.stringify({ ok: true, help }) + '\n' : help + '\n');
  } else {
    if (!values.input || !values.task) throw new Error('必须提供 --input 和 --task；旧自动浏览器驱动已归档，先用当前平台内置浏览器采集');
    const date = values.date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const result = values.compare
      ? writeBrowserComparison(root, { before: values.compare, after: values.input, task: values.task, date })
      : importBrowserEvidence(root, { input: values.input, task: values.task, date });
    process.stdout.write(JSON.stringify({ ok: true, ...result }, null, values.json ? 0 : 2) + '\n');
  }
} catch (error) {
  (process.argv.includes('--json') ? process.stdout : process.stderr).write(JSON.stringify({ ok: false, error: error.message }) + '\n');
  process.exitCode = 1;
}
