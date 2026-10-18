import fs from 'node:fs';
import crypto from 'node:crypto';
const file = 'scripts/runtime-asset-redundancy-review.mjs';
let source = fs.readFileSync(file, 'utf8');
const report = 'docs/evidence/2026-10-16-WF-completed-commit-1016/asset-fingerprint-review.json';
const changes = fs.existsSync(report) ? JSON.parse(fs.readFileSync(report,'utf8')) : [];
for (const consumer of ['game/src/audio/sound.js', 'game/src/battle/view/battle.frames.js',
  'game/src/battle/view/battle.layers.js', 'game/src/core/art.js', 'game/src/run/chests.js',
  'game/src/run/game.run.data.js', 'game/src/run/game.run.scenes.js', 'game/src/battle/view/battle.scenery.js',
  'game/css/scenes.css', 'game/src/core/map-node-art.js', 'game/src/core/renderer.js', 'game/src/ui/camp-entry.js']) {
  const sha256 = crypto.createHash('sha256').update(fs.readFileSync(consumer,'utf8').replaceAll('\r\n','\n')).digest('hex');
  const pattern = new RegExp('("' + consumer.replaceAll('.', '\\.') + '": ")([a-f0-9]{64})(")', 'g');
  const previous = [...source.matchAll(pattern)].map(match => match[2]);
  if (!previous.length) throw Error('Missing reviewed consumer ' + consumer);
  source = source.replace(pattern, '$1' + sha256 + '$3');
  const existing = changes.find(item => item.file === consumer);
  if (existing) { existing.previous = [...new Set([...existing.previous,...previous])]; existing.sha256 = sha256; }
  else changes.push({ file:consumer, previous, sha256 });
}
fs.writeFileSync(file,source);
fs.writeFileSync(report,JSON.stringify(changes,null,2)+'\n');
