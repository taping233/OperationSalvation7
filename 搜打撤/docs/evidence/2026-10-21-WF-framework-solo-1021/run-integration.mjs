import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fingerprint } from '../../../scripts/workflow-evidence.mjs';

const root = process.cwd();
const mode = process.argv[2];
if (!['static', 'target', 'full', 'recovery'].includes(mode)) throw new Error('Choose static, target, full, or recovery after source freeze.');
const evidence = 'docs/evidence/2026-10-21-WF-framework-solo-1021';
const temporary = '.tmp/WF-framework-solo-1021-integration';
mkdirSync(temporary, { recursive: true });
const npmCli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!existsSync(npmCli)) throw new Error('Installed npm CLI was not found beside node.');
const tests = [
  'boot', 'framework-independent-battles', 'battle-snapshot-integration',
  'game-store-snapshot', 'contracts', 'architecture-boundaries',
].map(name => `tests/${name}.test.js`);
const reuseTypes = mode === 'static' ? process.argv[3] : null;
if (reuseTypes && !existsSync(reuseTypes)) throw new Error('Reusable type evidence was not found.');
const commands = mode === 'static' ? ['check:syntax', 'validate:data', ...(!reuseTypes ? ['typecheck'] : []), 'lint'].map(script => ['run', script])
  : mode === 'target' ? [['run', 'test:target', '--', ...tests]]
  : mode === 'recovery' ? [['run', 'test:target', '--', 'tests/facade-snapshot-drift.test.js',
    'tests/architecture-boundaries.test.js', 'tests/game-session-browser-boundary.test.js'], ['run', 'docs:check']]
  : [['test']];
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const before = fingerprint(root, { documents: true, assets: true });
const id = `${mode}-${new Date().toISOString().replaceAll(':', '-')}`;
const beforePath = `${temporary}/${id}-before.json`;
writeFileSync(beforePath, JSON.stringify(before));
const steps = [];
for (let index = 0; index < commands.length; index++) {
  const args = commands[index];
  const logPath = `${temporary}/${id}-${index + 1}.log`;
  writeFileSync(logPath, '', { flag: 'wx' });
  console.log(`START ${index + 1}/${commands.length}: npm ${args.join(' ')}`);
  const startedAt = new Date().toISOString();
  const execution = await new Promise(resolve => {
    const child = spawn(process.execPath, [npmCli, ...args], { cwd: root, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', data => appendFileSync(logPath, data));
    child.stderr.on('data', data => appendFileSync(logPath, data));
    child.on('error', error => resolve({ exitCode: null, error: error.message }));
    child.on('close', (exitCode, signal) => resolve({ exitCode, signal }));
  });
  const bytes = readFileSync(logPath), text = bytes.toString('utf8');
  const step = { command: ['node', npmCli, ...args], startedAt, endedAt: new Date().toISOString(),
    ...execution, log: logPath, logBytes: bytes.length, logSha256: sha(bytes),
    testFiles: [...text.matchAll(/Test Files\s+([^\r\n]+)/g)].at(-1)?.[1]?.trim() ?? null,
    tests: [...text.matchAll(/\n\s*Tests\s+([^\r\n]+)/g)].at(-1)?.[1]?.trim() ?? null };
  steps.push(step);
  console.log(JSON.stringify(step));
  if (step.exitCode !== 0) { console.log(text.slice(-14000)); break; }
}
const after = fingerprint(root, { documents: true, assets: true });
const afterPath = `${temporary}/${id}-after.json`;
writeFileSync(afterPath, JSON.stringify(after));
const changedFiles = [];
const entryKey = entry => JSON.stringify([entry.file, entry.kind ?? 'file']);
const previousFiles = new Map(before.manifest.map(entry => [entryKey(entry), entry]));
for (const entry of after.manifest) {
  if (previousFiles.get(entryKey(entry))?.sha256 !== entry.sha256) changedFiles.push(entry.file);
  previousFiles.delete(entryKey(entry));
}
changedFiles.push(...[...previousFiles.values()].map(entry => entry.file));
const groupsStable = Object.fromEntries(Object.keys(before.groups).map(group => [group, before.groups[group] === after.groups[group]]));
const passed = steps.length === commands.length && steps.every(step => step.exitCode === 0);
const inputStable = before.sha256 === after.sha256;
const report = { task: 'WF-framework-solo-1021', mode, generatedAt: new Date().toISOString(), node: process.version,
  passed, inputStable, groupsStable, changedFiles, steps,
  reusedChecks: reuseTypes ? [{ name: 'typecheck', evidence: reuseTypes, evidenceSha256: sha(readFileSync(reuseTypes)),
    condition: 'Integration owner must verify the frozen type inputs and environment against the evidence before reuse.' }] : [],
  before: { sha256: before.sha256, groups: before.groups, files: before.manifest.length, path: beforePath,
    manifestSha256: sha(readFileSync(beforePath)) },
  after: { sha256: after.sha256, groups: after.groups, files: after.manifest.length, path: afterPath,
    manifestSha256: sha(readFileSync(afterPath)) },
  limits: [...after.limits, 'No build, real browser interaction, or remote CI claim. Logs/manifests retained under .tmp; regenerate using this script.'] };
const reportPath = `${evidence}/${id}.json`;
writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ reportPath, passed, inputStable, groupsStable, changedFiles }));
if (!passed || !inputStable) process.exitCode = 1;
