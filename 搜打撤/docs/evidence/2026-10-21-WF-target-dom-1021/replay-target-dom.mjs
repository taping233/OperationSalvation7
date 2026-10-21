import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Run from this isolated overlay only. Never alters the shared base or index.
const root = path.dirname(fileURLToPath(import.meta.url));
const project = path.join(root, '搜打撤');
const source = path.join(project, 'game/src/battle/view/battle.aim.js');
const output = path.join(root, process.argv[2] || 'replayed');
mkdirSync(output, { recursive:true });
const candidate = readFileSync(source), baseline = readFileSync(path.join(root, 'before.aim.js'));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const reports = [];
try {
  for (const [mode, bytes] of [['baseline', baseline], ['candidate', candidate]]) {
    writeFileSync(source, bytes);
    const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', 'tests/battle-target-dom.test.js', '--reporter=verbose', '--reporter=json', `--outputFile.json=${path.join(output, mode + '-tests.json')}`], { cwd:project, encoding:'utf8' });
    const text = result.stdout + result.stderr;
    writeFileSync(path.join(output, mode + '.log.txt'), text);
    const match = text.match(/BATTLE_TARGET_DOM_COUNTS (\{[^\n]+)/);
    if (!match) throw Error(`${mode}: missing production render operation counts; see log`);
    const report = JSON.parse(readFileSync(path.join(output, mode + '-tests.json'), 'utf8'));
    const counts = JSON.parse(match[1]);
    reports.push({mode, sourceSha256:hash(bytes), exitCode:result.status, counts,
      tests:{total:report.numTotalTests, passed:report.numPassedTests, failed:report.numFailedTests, skipped:report.numPendingTests},
      failedAssertions:report.testResults.flatMap(test => test.assertionResults.filter(assertion => assertion.status === 'failed').map(assertion => assertion.fullName))});
    if (mode === 'candidate' ? result.status !== 0 : result.status !== 1) throw Error(`Unexpected ${mode} test exit ${result.status}`);
  }
} finally {
  writeFileSync(source, candidate);
  if (hash(readFileSync(source)) !== hash(candidate)) throw Error('Candidate restore mismatch');
}
writeFileSync(path.join(output, 'summary.json'), JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports,null,2));
