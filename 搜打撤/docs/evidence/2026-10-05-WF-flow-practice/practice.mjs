import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseOptions } from '../../../scripts/web-up.mjs';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const phase = process.argv[2];
assert(['before', 'after'].includes(phase));
const results = { phase, startedAt: new Date().toISOString(), experiments: [] };
const run = (name, args, cwd = root) => {
  const started = performance.now();
  const result = spawnSync(process.execPath, args, { cwd, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  const item = { name, command: args, cwd: path.relative(root, cwd).replaceAll('\\', '/'),
    ms: Math.round(performance.now() - started), exitCode: result.status, stdout: result.stdout, stderr: result.stderr };
  results.experiments.push(item);
  return item;
};
const readme = readFileSync(path.join(root, 'README.md'), 'utf8');
const startup = readme.match(/```powershell\r?\n(npm run \w+)/)[1];
results.startup = { command: startup, expected: 'npm run web', matches: startup === 'npm run web',
  webDefault: parseOptions([]), boundary: '只解析现有入口；未启停服务或核验游戏实页' };
assert.equal(parseOptions([]).port, 5200);

// Execute the documented CLI against an owned fixture, preserving the real project's task/ledger/index.
const fixture = path.join(directory, 'fixture-' + phase);
mkdirSync(path.join(fixture, 'scripts'), { recursive: true });
for (const name of ['workflow.mjs', 'workflow-task.mjs', 'workflow-task-input.mjs', 'workflow-ledger.mjs', 'registry-paths.mjs']) {
  copyFileSync(path.join(root, 'scripts', name), path.join(fixture, 'scripts', name));
}
const guide = readFileSync(path.join(root, 'docs/WORKFLOW-TOOLS.md'), 'utf8');
const example = action => {
  const line = guide.match(new RegExp(`# task-${action}-example\\r?\\n([^\\r\\n]+)`))[1];
  const tail = line.split(`workflow -- task ${action} `)[1].split(' | ')[0];
  return ['scripts/workflow.mjs', 'task', action, ...[...tail.matchAll(/"([^"]*)"|(\S+)/g)].map(m => m[1] ?? m[2]), '--date', '2026-10-05'];
};
const start = run('documented-task-start', example('start'), fixture);
assert.equal(start.exitCode, 0);
const close = run('documented-task-close-preview', example('close'), fixture);
if (phase === 'before') {
  assert.equal(JSON.parse(start.stdout).dryRun, true);
  assert.notEqual(close.exitCode, 0);
  assert.match(close.stdout + close.stderr, /任务不存在/);
} else {
  assert.equal(results.startup.matches, true);
  assert.equal(JSON.parse(start.stdout).task.stage, 'doing');
  assert.equal(close.exitCode, 0);
  const plan = JSON.parse(close.stdout);
  const closed = run('documented-task-close-apply', [...example('close'), '--apply', '--expect', plan.expectedSha256], fixture);
  assert.equal(closed.exitCode, 0);
  assert.equal(JSON.parse(closed.stdout).task.stage, 'complete-uncommitted');
  const overwrite = run('duplicate-start-rejected', example('start'), fixture);
  assert.notEqual(overwrite.exitCode, 0);
}
const docs = run('docs-check', ['scripts/workflow.mjs', 'docs', '--json']);
assert.equal(docs.exitCode, 0);
results.endedAt = new Date().toISOString();
writeFileSync(path.join(directory, phase + '.json'), JSON.stringify(results, null, 2) + '\n');
process.stdout.write(JSON.stringify({ phase, startup: results.startup, experiments: results.experiments.map(({ name, ms, exitCode }) => ({ name, ms, exitCode })) }) + '\n');
