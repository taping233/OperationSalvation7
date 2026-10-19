#!/usr/bin/env node
// A short composition of existing review/verify/summary tools, not another gate.
import { existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { reviewChange } from '../scripts/workflow-change-review.mjs';
import { runCheck, safeId } from '../scripts/workflow-evidence.mjs';
import { toProjectPath } from '../scripts/gate-plan.mjs';
import { summarize, writeSummary } from './workflow-summary.mjs';

function localPath(root, value) {
  const relative = toProjectPath(value, root);
  if (!relative) throw new Error('Specify a concrete project path');
  const absolute = path.resolve(root, relative);
  for (let current = absolute; current !== root; current = path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('Symlink paths are not accepted');
  }
  return { relative, absolute };
}

/** Browser evidence is supplied by the caller; this entry never opens a browser. */
export async function runSlice(root, options) {
  root = realpathSync(path.resolve(root));
  const started = performance.now();
  if (options.run && options.input) throw new Error('--run and --input are mutually exclusive');
  if (!Array.isArray(options.paths) || !options.paths.length) throw new Error('Explicit --paths required');
  const paths = [...new Set(options.paths.map(value => {
    const file = localPath(root, value);
    if (existsSync(file.absolute) && !lstatSync(file.absolute).isFile()) throw new Error('Use explicit files, not directories: ' + file.relative);
    return file.relative;
  }))];
  const out = localPath(root, options.out);
  if (!out.relative.startsWith('docs/evidence/')) throw new Error('--out must be inside docs/evidence/');
  for (const file of ['run.json', 'summary/summary.json', 'summary/summary.md', 'summary/task-close-input.json']) {
    if (existsSync(path.join(out.absolute, file))) throw new Error('Existing evidence preserved; choose a new --out');
  }
  const reports = (options.reports ?? []).map(value => {
    const file = localPath(root, value);
    if (!file.relative.startsWith('docs/evidence/')) throw new Error('Reports must be inside docs/evidence/');
    JSON.parse(readFileSync(file.absolute, 'utf8')); // Reject missing/malformed evidence before running checks.
    return { path: file.relative };
  });
  if (options.run) {
    safeId(options.task);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(options.date ?? '')) throw new Error('Explicit --date YYYY-MM-DD required with --run');
  }
  let review = reviewChange(root, { paths, input: options.input });
  const planningMs = performance.now() - started;
  if (options.input && review.verification.status === 'invalid') throw new Error(review.verification.error);
  let execution = null;
  const checkingStarted = performance.now();
  if (options.run) {
    execution = await runCheck(root, { task: options.task, date: options.date, paths, json: true });
    // No next check is started after failure; review/summary only record the result.
    review = reviewChange(root, { paths, input: execution.report });
  }
  const checkingMs = performance.now() - checkingStarted;
  const verificationReport = execution?.report ?? options.input;
  if (verificationReport) reports.unshift({ path: verificationReport,
    coverage: `workflow verify: ${review.verification.scope}; ${review.verification.status}; gate ${review.plan.mode}` });
  const unverified = [...(options.unverified ?? [])];
  if (!verificationReport) unverified.push('仅规划，自动检查尚未执行。');
  if (review.verification.status !== 'candidate') unverified.push('workflow review: ' + review.verification.status);
  if (review.verification.scope === 'partial') unverified.push('现有报告未覆盖全部所选范围。');
  if (review.ui.status === 'needs-manual-review') unverified.push('UI候选仍待当前平台内置浏览器验证；已附截图仅保留其声明的输入范围。');
  const summary = summarize(root, { title: options.title ?? '改动检查与页面入口', paths, reports, unverified });
  const failed = summary.hasFailure || review.verification.status === 'failed';
  const result = { schemaVersion: 1, kind: 'workflow-slice',
    status: failed ? 'failed' : verificationReport ? review.verification.status : 'planned',
    paths, review, verificationReport: verificationReport ?? null,
    pages: review.ui.candidates.map(item => ({ ...item, urlPath: '/' + item.file.replace(/^game\//, '') })),
    summary: out.relative + '/summary/summary.json',
    timing: { planningMs, checkingMs, totalMs: performance.now() - started },
    automation: { callerCommands: 1, browserOpened: false, checksRun: Boolean(options.run),
      limits: 'Timing is this invocation only; no claim of saved time without a comparable baseline.' },
    validation: { executed: false, reason: 'Composition output is not a check receipt; inspect verificationReport and its scope.' },
    exitCode: failed ? (execution?.exitCode || 1) : 0,
    limits: ['Existing full/quick/skip selection is retained; skip is not passed.',
      'Summary never closes tasks, changes ledgers, builds, stages or commits.',
      'UI URLs are static candidates, not complete gameplay coverage; use the current platform browser.'] };
  mkdirSync(out.absolute, { recursive: true });
  writeSummary(root, out.relative + '/summary', summary);
  writeFileSync(path.join(out.absolute, 'run.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return result;
}

async function main() {
  const { values } = parseArgs({ options: {
    help: { type: 'boolean' }, root: { type: 'string' }, paths: { type: 'string' }, out: { type: 'string' },
    task: { type: 'string' }, date: { type: 'string' }, title: { type: 'string' }, run: { type: 'boolean' },
    input: { type: 'string' }, report: { type: 'string', multiple: true }, unverified: { type: 'string', multiple: true },
  } });
  if (values.help) {
    console.log('node tools/workflow-slice.mjs --paths <CSV files> --out docs/evidence/<task>/<attempt> [--run --task <id> --date YYYY-MM-DD | --input <verify report>] [--report <browser/other JSON>] [--unverified <text>]\nDefault: plan only. Reuses review/verify/summary; no browser/build/git mutations. Existing output is never overwritten.');
    return;
  }
  if (!values.paths || !values.out) throw new Error('--paths and --out required');
  const result = await runSlice(values.root ?? fileURLToPath(new URL('..', import.meta.url)), {
    ...values, paths: values.paths.split(',').map(item => item.trim()), reports: values.report,
  });
  console.log(JSON.stringify({ status: result.status, gate: result.review.plan.mode, verificationReport: result.verificationReport,
    report: values.out + '/run.json', summary: result.summary, pages: result.pages, timing: result.timing, exitCode: result.exitCode }));
  process.exitCode = result.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; });
}
