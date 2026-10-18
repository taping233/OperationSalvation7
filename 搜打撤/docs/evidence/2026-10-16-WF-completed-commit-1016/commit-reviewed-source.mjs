import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { inspectGateReceipt } from '../../../scripts/workflow-gate-receipt.mjs';
const root = process.cwd(), repo = path.resolve(root, '..');
const directory = 'docs/evidence/2026-10-16-WF-completed-commit-1016';
const readJson = file => {
  const bytes = fs.readFileSync(file);
  return JSON.parse(bytes.toString(bytes[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''));
};
const result = readJson(`${directory}/gate-result-sealed.json`);
if (!result.validation?.passed || !result.validation?.reusableReceipt) throw Error('Final frozen gate is not reusable');
const receipt = inspectGateReceipt(root, result.report, { repo });
if (!receipt.eligible) throw Error(JSON.stringify(receipt));
const inventory = readJson(`${directory}/source-index-inventory.json`);
const git = (args, extra = {}) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, ...extra }).trim();
if (git(['rev-parse', 'HEAD']) !== inventory.head) throw Error('HEAD changed');
const actual = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
if (JSON.stringify(actual) !== JSON.stringify(inventory.inventory.map(item => item.file))) throw Error('Index scope changed');
// Later registered wallpaper, chest-v6 and general-transition deltas remain in the
// working tree. The already reviewed index is the fixed authorized shipping boundary.
const laterDeltas = new Set(['搜打撤/game/src/ui/title-wallpaper.js', '搜打撤/game/css/title-p0.css', '搜打撤/tests/title-wallpaper.test.js', '搜打撤/game/assets/asset-manifest.json',
  '搜打撤/game/assets/README.md', '搜打撤/game/src/run/chests.js', '搜打撤/game/src/run/game.run.scenes.js', '搜打撤/game/src/ui/camp-entry.js', '搜打撤/tests/battle-entry-view.test.js']);
const retained = [];
for (const item of inventory.inventory) {
  const full = path.join(repo, item.file);
  if (item.deleted) { if (fs.existsSync(full)) throw Error(`Deleted file reappeared: ${item.file}`); continue; }
  if (fs.statSync(full).mtimeMs !== item.mtimeMs || createHash('sha256').update(fs.readFileSync(full)).digest('hex') !== item.sha256) {
    if (!laterDeltas.has(item.file)) throw Error(`In-flight change: ${item.file}`);
    retained.push({ file: item.file, reason: 'Later registered second-wallpaper, chest-v6 or general-transition delta; current index remains the previously completed reviewed snapshot', unstagedDiff: git(['diff', '--', item.file]) });
  }
}
fs.writeFileSync(`${directory}/retained-in-flight.json`, JSON.stringify(retained, null, 2) + '\n');
git(['diff', '--cached', '--check']);
const message = `${directory}/source-commit-message.txt`;
fs.writeFileSync(message, 'fix(vite): integrate gameplay updates and performance improvements\n\nCache photo catalog preparation and wait for shared page transitions to be ready. Integrate battle input/HUD, node restoration, reward overview, bag/shop lifecycle and completed wallpaper changes. Remove the approved chibi implementation while retaining its assets.\n\nRepair fast drag release, reward failure persistence and preheat timer ownership; align integration fixtures with the current interaction contracts and stop tests overwriting historical evidence. Full frozen-index gate and native IAB drag/reward checks passed.\n');
const env = { ...process.env, GATE_RECEIPT: path.resolve(root, result.report) };
delete env.SKIP_FULL_TESTS; delete env.GATE_MANIFEST_OK; delete env.FORCE_FULL_TESTS;
const output = git(['commit', '-F', path.resolve(root, message)], { env });
fs.writeFileSync(`${directory}/source-commit-result.json`, JSON.stringify({ commit: git(['rev-parse', 'HEAD']), receipt: result.report, validation: result.validation, output }, null, 2) + '\n');
console.log(output);
