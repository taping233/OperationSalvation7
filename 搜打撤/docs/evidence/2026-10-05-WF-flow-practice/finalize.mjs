import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDocumentation } from '../../../scripts/index-validation.mjs';
import { fingerprint, freshness } from '../../../scripts/workflow-evidence.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const run = (program, args) => {
  const result = spawnSync(program, args, { cwd: root, encoding: 'utf8', timeout: 15000 });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return { command: [program, ...args], exitCode: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
};
const ownPaths = ['../AGENTS.md', 'README.md', 'docs/development.md', 'docs/README.md',
  'docs/WORKFLOW-TOOLS.md', 'docs/quality-gates.md', 'tests/docs-consistency.test.js'];
const reports = readdirSync(directory).filter(name => /^2026.*\.json$/.test(name)).sort();
const reportName = reports.at(-1);
const report = JSON.parse(readFileSync(path.join(directory, reportName), 'utf8'));
assert.equal(report.outcome, 'passed');
const current = fingerprint(root, { documents: report.after.documents, assets: report.after.assets, roots: report.after.selection.roots });
const validity = freshness(report, current);
assert.equal(validity.eligibleForReview, true, JSON.stringify(validity));
const docs = validateDocumentation(root);
assert.equal(docs.ok, true, JSON.stringify(docs.findings));
writeFileSync(path.join(directory, 'docs-check.json'), JSON.stringify(docs, null, 2) + '\n');
const commands = [run(process.execPath, ['node_modules/eslint/bin/eslint.js', 'tests/docs-consistency.test.js']),
  run('git', ['diff', '--check', '--', ...ownPaths])];
for (const name of ['practice.mjs', 'scope-practice.mjs', 'finalize.mjs']) commands.push(run(process.execPath, ['--check', path.join(directory, name)]));
const links = [...readFileSync(path.join(directory, 'README.md'), 'utf8').matchAll(/\]\(([^)]+)\)/g)].map(match => match[1]);
for (const link of links) if (link !== 'verification.json') assert(existsSync(path.resolve(directory, link)), '证据死链：' + link);
const oversized = [];
const visit = folder => {
  for (const entry of readdirSync(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) visit(file);
    else if (statSync(file).size > 1024 * 1024) oversized.push(path.relative(root, file));
  }
};
visit(directory);
assert.deepEqual(oversized, []);
const rulesBytes = statSync(path.join(root, '../AGENTS.md')).size;
const flowBytes = ['docs/README.md', 'docs/QUICKSTART.md', 'docs/WORKFLOW-TOOLS.md', 'docs/quality-gates.md']
  .reduce((sum, name) => sum + statSync(path.join(root, name)).size, 0);
assert(rulesBytes <= 6144 && flowBytes <= 36864);
const verification = { at: new Date().toISOString(), head: run('git', ['rev-parse', 'HEAD']).stdout,
  trackingDifference: run('git', ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}']).stdout,
  remoteRefreshed: false, tests: { report: reportName, outcome: report.outcome, validity },
  docs: { ok: docs.ok, checkedRelativeLinks: docs.checkedRelativeLinks, findings: docs.findings },
  rulesBytes, flowBytes, ownInputs: ownPaths.map(file => ({ file, sha256: digest(readFileSync(path.join(root, file))) })),
  evidenceLinksChecked: links.length, oversized, commands,
  limits: ['仅工程流程/文档和示例守卫；没有游戏实页、build、全量或远端CI验收；无提交授权'] };
writeFileSync(path.join(directory, 'verification.json'), JSON.stringify(verification, null, 2) + '\n');
process.stdout.write(JSON.stringify({ head: verification.head, report: reportName, freshness: validity.result,
  links: docs.checkedRelativeLinks, findings: docs.findings.length, rulesBytes, flowBytes }) + '\n');
