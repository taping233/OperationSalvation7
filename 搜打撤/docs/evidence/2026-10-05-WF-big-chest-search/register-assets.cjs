// Register only this task's eight output assets, preserving all other manifest text.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const manifestPath = path.join(root, 'game/assets/asset-manifest.json');
const original = fs.readFileSync(manifestPath, 'utf8');
const manifest = JSON.parse(original);
const report = JSON.parse(fs.readFileSync(path.join(__dirname, 'images.json'), 'utf8'));
const entries = (report.items || [{ outputs: report.outputs }]).flatMap(item => item.outputs.map(output => ({
  path: output.path.replace('game/assets/', ''), ext: 'webp', bytes: output.bytes,
  sha256: output.sha256, license: '项目自有（AI 生成）',
  source: 'docs/evidence/2026-10-05-WF-big-chest-search/images.json'
})));
if (entries.some(entry => manifest.assets.some(old => old.path === entry.path))) {
  throw new Error('A target entry already exists; stop instead of duplicating');
}
const newline = original.includes('\r\n') ? '\r\n' : '\n';
const block = entries.map(entry => JSON.stringify(entry, null, 2).split('\n').map(line => '    ' + line).join(newline)).join(',' + newline);
const countNeedle = '"count": ' + manifest.count + ',';
const arrayNeedle = '"assets": [';
if (!original.includes(countNeedle) || !original.includes(arrayNeedle)) throw new Error('Manifest format changed');
const updated = original.replace(countNeedle, '"count": ' + (manifest.assets.length + entries.length) + ',')
  .replace(arrayNeedle, arrayNeedle + newline + block + ',');
if (fs.readFileSync(manifestPath, 'utf8') !== original) throw new Error('Concurrent manifest edit; stop');
fs.writeFileSync(manifestPath, updated);
console.log('Registered ' + entries.length + ' card assets; count=' + (manifest.assets.length + entries.length));
