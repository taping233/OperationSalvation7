import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const hash = value => createHash('sha256').update(value).digest('hex');
function inside(root, value) {
  const file = path.resolve(root, value);
  const relative = path.relative(root, file);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path outside project');
  if (existsSync(file)) {
    const physical = path.relative(realpathSync(root), realpathSync(file));
    if (physical.startsWith('..') || path.isAbsolute(physical)) throw new Error('Symlink outside project');
  }
  return file;
}

export function summarize(root, input) {
  root = path.resolve(root);
  if (!input.title || !Array.isArray(input.paths) || !input.paths.length || !Array.isArray(input.reports) || !Array.isArray(input.unverified)) throw new Error('title, paths, reports and explicit unverified required');
  const paths = input.paths.map(file => {
    const absolute = inside(root, file);
    return { file, exists: existsSync(absolute), sha256: existsSync(absolute) ? hash(readFileSync(absolute)) : null };
  });
  const reports = input.reports.map(item => {
    const file = inside(root, item.path);
    const bytes = readFileSync(file);
    const sha256 = hash(bytes);
    const raw = JSON.parse(bytes);
    let result = 'unverified';
    if (raw.steps?.length && raw.steps.every(step => Number.isInteger(step.exitCode))) {
      result = raw.ok === true && raw.steps.every(step => step.exitCode === 0) ? 'passed' : 'failed';
    } else if (raw.schemaVersion === 1 && Number.isInteger(raw.exitCode)) {
      result = raw.exitCode !== 0 ? 'failed' : raw.outcome === 'skip' || raw.validation?.executed === false ? 'unverified' : 'passed';
    } else if (raw.source === 'Codex current in-app browser tab') {
      result = raw.status === 'captured' ? 'observed' : 'unverified';
    }
    const failed = result === 'failed';
    if (item.sha256 && item.sha256 !== sha256 && !failed) result = 'stale';
    const warnings = [];
    if (raw.before?.sha256 && raw.after?.sha256 && raw.before.sha256 !== raw.after.sha256) {
      warnings.push('Report inputs changed during validation; use workflow evidence for grouped freshness review');
      if (result !== 'failed') result = 'unverified';
    }
    if (raw.after?.manifest) {
      for (const entry of raw.after.manifest) {
        if (entry.kind && entry.kind !== 'file') continue;
        try {
          const source = inside(root, entry.file);
          if (!existsSync(source) || hash(readFileSync(source)) !== entry.sha256) warnings.push('Changed since report: ' + entry.file);
        } catch { warnings.push('Outside project fingerprint not checked: ' + entry.file); }
      }
      if (warnings.length && !failed) result = 'stale';
    } else warnings.push('No source fingerprint in report; current file hashes are inventory only, not freshness proof');
    return { path: item.path, sha256, result, warnings, coverage: item.coverage || raw.detail || 'Not declared' };
  });
  const unverified = [...input.unverified, ...reports.filter(item => ['stale', 'unverified'].includes(item.result)).map(item => item.path + ': ' + item.result)];
  const hasFailure = reports.some(item => item.result === 'failed');
  const doneWhenConfirmed = input.doneWhenConfirmed === true && !hasFailure;
  const closeInput = { stage: doneWhenConfirmed ? 'complete-uncommitted' : 'partial', doneWhenConfirmed,
    checks: reports.map(item => ({ kind: 'manual', result: 'unverified', description: `${item.path}: reported ${item.result}; owner must review coverage/freshness before declaring a passed check` })), unverified };
  return { version: 1, title: input.title, paths, reports, unverified, hasFailure,
    ownerCompletionDeclared: input.doneWhenConfirmed === true, closeInput,
    limits: ['Read-only aggregation; never closes tasks, changes ledgers, grants commit permission or substitutes for workflow evidence/ship gates',
      'Browser observed is not a gameplay pass; source inventory hashes do not establish test freshness'] };
}

export function writeSummary(root, directory, summary) {
  const folder = inside(path.resolve(root), directory);
  let ancestor = folder;
  while (!existsSync(ancestor)) ancestor = path.dirname(ancestor);
  const physical = path.resolve(realpathSync(ancestor), path.relative(ancestor, folder));
  inside(realpathSync(root), physical);
  const names = ['summary.json', 'summary.md', 'task-close-input.json'];
  if (names.some(name => existsSync(path.join(folder, name)))) throw new Error('Existing summary preserved; choose new output directory');
  mkdirSync(folder, { recursive: true });
  const markdown = `# ${summary.title}\n\n` + summary.reports.map(item => `- ${item.path}: ${item.result} — ${item.coverage}`).join('\n')
    + '\n\n未核项：\n' + (summary.unverified.map(item => '- ' + item).join('\n') || '- 无额外声明；仍须负责人审阅证据覆盖。')
    + '\n\n本摘要不自动释放占用、关闭任务或授权提交。\n';
  for (const [name, value] of [['summary.json', JSON.stringify(summary, null, 2)], ['summary.md', markdown], ['task-close-input.json', JSON.stringify(summary.closeInput, null, 2)]]) {
    writeFileSync(path.join(folder, name), value + '\n', { flag: 'wx' });
  }
}

function main() {
  const { values } = parseArgs({ options: { help: { type: 'boolean' }, root: { type: 'string' }, input: { type: 'string' }, out: { type: 'string' }, write: { type: 'boolean' } } });
  if (values.help) { console.log('node tools/workflow-summary.mjs --input <JSON> [--root <project>] [--out <project directory> --write]\nAggregates explicit paths/reports, preserves failed/observed/unverified distinctions and emits an owner-review task-close input; no automatic ledger/git actions.'); return; }
  const root = path.resolve(values.root || fileURLToPath(new URL('..', import.meta.url)));
  if (!values.input) throw new Error('--input required');
  const summary = summarize(root, JSON.parse(readFileSync(inside(root, values.input), 'utf8')));
  if (values.write) { if (!values.out) throw new Error('--out required with --write'); writeSummary(root, values.out, summary); }
  console.log(JSON.stringify(summary));
  if (summary.hasFailure) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(); } catch (error) { console.error(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1; }
}
