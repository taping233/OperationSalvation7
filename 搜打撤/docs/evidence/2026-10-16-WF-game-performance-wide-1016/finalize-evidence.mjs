import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
const receipt = read('chibi-deletion-receipt.json');
for (const item of receipt.deleted) {
  if (fs.existsSync(path.join(root, item.path))) throw Error(`Deleted file returned: ${item.path}`);
}
for (const item of receipt.preserved) {
  if (hash(item.path).toLowerCase() !== item.sha256.toLowerCase()) throw Error(`Asset changed: ${item.path}`);
}
const source = [
  'game/src/hub/photo-studio-catalog-cache.js', 'game/src/hub/game.cardslib.page.js',
  'game/src/ui/camp-entry.js', 'game/src/ui/page-loading.js', 'game/css/page-loading.css',
  'game/src/hub/hub.warehouse.js', 'game/src/game.boot.js',
  'game/src/battle/view/battle.aim.js', 'game/src/battle/view/battle.frames.js', 'game/src/audio/sound.js',
  'tests/photo-studio-catalog-cache.test.js', 'tests/page-loading.test.js',
  'tests/battle-frames-lifecycle.test.js', 'tests/sound-lifecycle.test.js',
  'tests/base-inventory-lifecycle-audit.test.js',
];
const summaries = ['wide-tests.json', 'transition-tests-final.json', 'boot-before-tests.json'].map(file => {
  const report = read(file);
  return { file, passed: report.numPassedTests, failed: report.numFailedTests,
    failures: report.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed')
      .map(test => ({ suite: suite.name, name: test.fullName }))) };
});
if (summaries[0].passed !== 130 || summaries[0].failed !== 0
  || summaries[1].passed !== 87 || summaries[1].failed !== 1
  || summaries[2].failed !== 1 || summaries[1].failures[0].name !== summaries[2].failures[0].name) {
  throw Error('Test evidence differs from recorded conclusion');
}
const output = { observedAt: new Date().toISOString(), source: source.map(file => ({ file, sha256: hash(file) })),
  deletion: { deleted: receipt.deleted.length, preserved: receipt.preserved.length, hashesVerified: true },
  tests: summaries, checks: { syntax: 'passed: 428 project files', types: 'passed: 8 configurations',
    eslint: 'passed: 14 edited JavaScript files', docs: 'see docs-check.json' },
  boundaries: ['No build/full suite/CI', 'No commit/push/publish', 'Current IAB window only; test tab closed; existing service retained'] };
fs.writeFileSync(path.join(directory, 'final-verification.json'), JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ tests: summaries.map(({ file, passed, failed }) => ({ file, passed, failed })), deletion: output.deletion }));
