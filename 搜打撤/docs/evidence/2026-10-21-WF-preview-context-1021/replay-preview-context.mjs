import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
const project = `${root}搜打撤`;
const paths = ['game/src/battle/view/battle.aim.js', 'game/src/battle/view/battle.hover.js',
  'game/src/battle/core/battle.core.js', 'game/src/battle/core/battle.card-play.domain.js'];
const candidate = new Map(paths.map(path => [path, readFileSync(`${project}/${path}`, 'utf8')]));
const directory = process.argv[2] || 'ab-final';
mkdirSync(`${root}${directory}`, { recursive: true });
const results = {};
function run(label) {
  const report = `${root}${directory}/${label}.json`;
  const result = spawnSync(process.execPath, [`${project}/node_modules/vitest/vitest.mjs`, 'run', '--config', `${root}instrumented.vitest.config.mjs`, '--reporter=verbose', '--reporter=json', `--outputFile=${report}`], { cwd: project, encoding: 'utf8' });
  const output = result.stdout + result.stderr;
  writeFileSync(`${root}${directory}/${label}.log.txt`, output);
  const counts = output.split('\n').filter(line => /^(?:POINTER_HAND_COUNTS|CATALOG_POINTER_HAND_COUNTS) /.test(line)).map(line => JSON.parse(line.slice(line.indexOf('{'))));
  const json = JSON.parse(readFileSync(report, 'utf8'));
  results[label] = { exitCode: result.status, passed: json.numPassedTests, failed: json.numFailedTests, total: json.numTotalTests, counts,
    failures: json.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName)) };
  console.log(label, JSON.stringify(results[label]));
}
try {
  for (const path of paths) writeFileSync(`${project}/${path}`, readFileSync(`${root}baseline/${path}`));
  run('original');
  for (const [path, source] of candidate) writeFileSync(`${project}/${path}`, source);
  const aimPath = paths[0];
  const fresh = candidate.get(aimPath);
  if (!fresh.includes('const handRuleContext = {};')) throw new Error('No private context anchor');
  writeFileSync(`${project}/${aimPath}`, fresh.replace('const handRuleContext = {};', 'const handRuleContext = a.handRuleContext ||= {};'));
  run('stale-aim-context');
  for (const [path, source] of candidate) writeFileSync(`${project}/${path}`, source);
  run('candidate');
} finally {
  for (const [path, source] of candidate) writeFileSync(`${project}/${path}`, source);
  writeFileSync(`${root}${directory}/summary.json`, JSON.stringify(results, null, 2) + '\n');
}
if (results.original?.failed !== 4 || results['stale-aim-context']?.failed < 1 || results.candidate?.failed !== 0 || results.candidate?.passed !== 8) throw new Error('Unexpected A/B result');
for (let i = 0; i < 4; i++) {
  const before = results.original.counts[i], after = results.candidate.counts[i];
  if (before.handProjection !== 8 || after.handProjection !== 1 || before.cost !== 8 || after.cost !== 8 || before.capability !== 8 || after.capability !== 8
    || JSON.stringify(before.text) !== JSON.stringify(after.text)) throw new Error(`Count or semantic mismatch: fixture ${i}`);
}
