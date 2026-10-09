import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const files = ['docs/terminology.md', 'docs/M-BATCH-MATRIX.md', 'docs/game-compendium.md',
  'docs/production/art/ART-DIRECTION-BRIEF.md', 'docs/production/art/VISUAL-BIBLE.md',
  'docs/character-bible/README.md', ...['wu', 'changwuyu', 'baita', 'heixiang', 'xingyue'].map(id => `docs/character-bible/${id}.md`),
  'scripts/generate-compendium.mjs', 'tests/compendium.test.js'];
const records = [];
for (const file of files) {
  const bytes = readFileSync(path.join(root, file));
  const target = path.join(here, 'originals', file);
  if (existsSync(target)) throw new Error('Original already preserved');
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, bytes, { flag: 'wx' });
  records.push({ file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });
}
writeFileSync(path.join(here, 'before.json'), JSON.stringify({ recordedAt: new Date().toISOString(), records,
  method: 'read-only-evidence-copies; character-bible is outside workflow archive snapshot scope' }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ preservedFiles: records.length }));
