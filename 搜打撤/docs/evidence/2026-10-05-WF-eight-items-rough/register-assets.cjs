// Update only these sixteen entries, preserve every unrelated manifest byte.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const manifestPath = path.join(root, 'game/assets/asset-manifest.json');
const original = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'images.json'), 'utf8'));
const newline = original.includes('\r\n') ? '\r\n' : '\n';
const additions = [];
let updated = original;
const formatted = entry => JSON.stringify(entry, null, 2).split('\n').map((line, i) => i === 0 ? line : '    ' + line).join(newline);
for (const output of report.items.flatMap(item => item.outputs)) {
  const entry = { path: output.path.replace('game/assets/', ''), ext: 'webp', bytes: output.bytes,
    sha256: output.sha256, license: '项目自有（AI 生成）',
    source: 'docs/evidence/2026-10-05-WF-eight-items-rough/images.json' };
  const old = manifest.assets.find(asset => asset.path === entry.path);
  if (!old) { additions.push(entry); continue; }
  const needle = '"path": ' + JSON.stringify(entry.path);
  const at = updated.indexOf(needle);
  if (at < 0) throw new Error('Target entry text changed: ' + entry.path);
  const start = updated.lastIndexOf('{', at);
  const end = updated.indexOf('}', at) + 1;
  if (start < 0 || end <= at) throw new Error('Target block format changed');
  updated = updated.slice(0, start) + formatted({ ...old, ...entry }) + updated.slice(end);
}
if (additions.length) {
  const arrayNeedle = '"assets": [';
  if (!updated.includes(arrayNeedle)) throw new Error('Asset array format changed');
  const blocks = additions.map(entry => '    ' + formatted(entry)).join(',' + newline);
  updated = updated.replace(arrayNeedle, arrayNeedle + newline + blocks + ',');
}
const countNeedle = '"count": ' + manifest.count + ',';
if (!updated.includes(countNeedle)) throw new Error('Count format changed');
updated = updated.replace(countNeedle, '"count": ' + (manifest.assets.length + additions.length) + ',');
if (fs.readFileSync(manifestPath, 'utf8') !== original) throw new Error('Concurrent manifest edit; stop');
fs.writeFileSync(manifestPath, updated);
console.log('Registered sixteen outputs; added=' + additions.length + '; count=' + (manifest.assets.length + additions.length));
