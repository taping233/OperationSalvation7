import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { RUNTIME_REDUNDANCY_REVIEW } from '../../../scripts/runtime-asset-redundancy-review.mjs';
const directory = 'docs/evidence/2026-10-19-unused-cleanup';
const assets = JSON.parse(fs.readFileSync(directory + '/runtime-exclusions.json'));
if (assets.warnings.length) throw Error('Runtime analysis inconclusive');
const retiredCode = [
  'game/src/audio/sound.bank.js', 'game/src/audio/sound.scape.js', 'game/src/audio/sound.ui-samples.js',
  'tests/sound-bank.test.js', 'tests/soundscape.test.js', 'tests/sound-ui-samples.test.js',
  'game/css/base-framework-v6.css', 'game/css/base-home-v3.css',
];
const categories = new Map(RUNTIME_REDUNDANCY_REVIEW.candidates.map(e => ['game/assets/' + e.path, e.category]));
const files = [...assets.files.map(f => f.path), ...retiredCode].map(file => {
  const bytes = fs.readFileSync(file);
  return { path: file, category: categories.get(file) || (file.startsWith('tests/') ? 'obsolete-audio-tests' : file.endsWith('.css') ? 'retired-base-css' : 'obsolete-audio-implementation'), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
});
if (new Set(files.map(f => f.path)).size !== files.length) throw Error('Duplicate deletion paths');
const groups = Object.fromEntries([...new Set(files.map(f => f.category))].map(category => [category, { files: files.filter(f => f.category === category).length, bytes: files.filter(f => f.category === category).reduce((s,f) => s+f.bytes,0) }]));
const plan = { status: 'awaiting-exact-path-approval', head: execFileSync('git', ['rev-parse', 'HEAD'], {encoding:'utf8'}).trim(), generatedAt: new Date().toISOString(), count: files.length, bytes: files.reduce((s,f) => s+f.bytes,0), groups, files,
  coupledEdits: ['game/assets/asset-manifest.json: remove only deleted asset entries', 'scripts/runtime-asset-redundancy-review.mjs: remove the two deleted opaque-consumer keys; retain all live fingerprints', 'tests/runtime-asset-redundancy.test.js and tests/retired-scenes-publication.test.js: replace historical-source existence assumptions with exact approved retirement receipts; preserve current asset references and selector protections', 'docs/architecture.md and current asset/source documentation: describe the retained implementation'],
  retained: ['active skin and event work', 'QA hosts and boot-order contract', 'MIT audit sources and licenses', 'live duplicate assets and runtime aliases', 'development audition and design pages', 'historical evidence and editable art sources', 'previously approved Wu directories remain blocked under PENDING47; no retry'],
  limits: ['Runtime import graph is a candidate finder, not standalone deletion proof.', 'Four development previews use Blob imports; targets reviewed as chest/reward controllers, not the proposed audio or CSS files.', 'No game sources, assets or tests deleted during this audit; no build or browser interaction.'] };
fs.writeFileSync(directory + '/deletion-plan.json', JSON.stringify(plan, null, 2) + '\n');
let markdown = '# 待批准删除清单\n\n状态：尚未执行删除。共' + plan.count + '文件，' + (plan.bytes / 1048576).toFixed(2) + ' MiB。授权以本清单精确路径及SHA256为边界，执行前复核变化与占用。完整机器清单见[deletion-plan.json](deletion-plan.json)。\n\n';
for (const [category, summary] of Object.entries(groups)) {
  markdown += '## ' + category + '（' + summary.files + '文件）\n\n';
  for (const file of files.filter(f => f.category === category)) markdown += '- `' + file.path + '` — ' + file.bytes + '字节，SHA256 `' + file.sha256 + '`\n';
  markdown += '\n';
}
fs.writeFileSync(directory + '/DELETE-LIST.md', markdown);
console.log(JSON.stringify({count:plan.count,MiB:plan.bytes/1048576,groups}));
