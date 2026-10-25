import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dir, '../../../..');
const read = relative => fs.readFileSync(path.join(root, relative));
const json = relative => JSON.parse(fs.readFileSync(path.join(dir, relative), 'utf8'));
const hash = value => createHash('sha256').update(value).digest('hex');
const normalized = bytes => Buffer.byteLength(bytes.toString('utf8').replace(/\r\n/g, '\n'));
const baseline = json('baseline.json');
const tests = json('test-baseline.json');
const prior = json('../source-manifest.json');
const runtime = json('runtime-plan/measurement.json');
const css = json('dead-dom/manifest.json');
const fixturePlan = json('fixtures/plan.json');
const gameBase = new Map(baseline.files.map(row => [row.file, row]));
const testBase = new Map(tests.files.map(row => [row.file, row]));

const gameRows = [...runtime.rows, ...css.files].map(row => {
  const old = gameBase.get(row.file);
  if (!old) throw new Error(`Missing round2 game baseline: ${row.file}`);
  const before = read(`${baseline.cache}/${row.file}`);
  const after = read(row.file);
  if (hash(before) !== old.sha256 || hash(after) !== row.afterSha256) {
    throw new Error(`Game source freeze mismatch: ${row.file}`);
  }
  return { file: row.file, before: old.normalizedBytes, after: normalized(after),
    saved: old.normalizedBytes - normalized(after), sha256: hash(after) };
});

const testPaths = [...new Set([...fixturePlan.paths,
  'tests/battle-runtime-state-guard.test.js', 'tests/battle-runtime-compatibility.test.js',
  'tests/helpers/css-reachability.js', 'tests/css-dead-dom-reachability.test.js'])].sort();
const testRows = testPaths.map(file => {
  const old = testBase.get(file);
  if (old && hash(read(`${tests.cache}/${file}`)) !== old.sha256) {
    throw new Error(`Test baseline cache mismatch: ${file}`);
  }
  const after = read(file);
  return { file, before: old?.normalizedBytes ?? 0, after: normalized(after),
    saved: (old?.normalizedBytes ?? 0) - normalized(after), sha256: hash(after) };
});

const gameRound2Net = gameRows.reduce((sum, row) => sum + row.saved, 0);
const testsNet = testRows.reduce((sum, row) => sum + row.saved, 0);
const gameStructuralNet = prior.structuralNet + gameRound2Net;
const combinedStructuralNet = gameStructuralNet + testsNet;
const summary = {
  status: 'batch-complete-uncommitted-task-paused-by-user', unit: 'UTF-8 bytes after CRLF to LF normalization',
  gameBaseline: prior.baseline.normalizedBytes, testsBaseline: tests.normalizedBytes,
  combinedBaseline: tests.combinedBaseline, target: tests.target,
  carriedGameStructuralNet: prior.structuralNet, gameRound2Net, testsNet,
  round2CombinedNet: gameRound2Net + testsNet,
  gameRuntimeNet: prior.runtimeNet + gameRound2Net,
  gameStructuralNet, gameStructuralPercent: gameStructuralNet / prior.baseline.normalizedBytes * 100,
  combinedStructuralNet, combinedStructuralPercent: combinedStructuralNet / tests.combinedBaseline * 100,
  remainingToTenPercent: tests.target - combinedStructuralNet,
  existingEngineeringCostDeducted: prior.engineeringNetAdded,
  existingFormatAndCommentReductionExcluded: prior.nonStructuralReduction,
  gameRows, testRows,
};
fs.writeFileSync(path.join(dir, 'measurement.json'), JSON.stringify(summary, null, 2) + '\n');
const { gameRows: _gameRows, testRows: _testRows, ...compact } = summary;
console.log(JSON.stringify({ ...compact, gamePaths: gameRows.length, testPaths: testRows.length }, null, 2));
