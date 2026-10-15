import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root = process.cwd();
const path = resolve(root, 'game/assets/asset-manifest.json');
const original = readFileSync(path, 'utf8');
const manifest = JSON.parse(original);
const receipt = JSON.parse(readFileSync(new URL('./atlas-receipt.json', import.meta.url), 'utf8'));
const entries = receipt.parts.map(part => {
  const path = `chibi/wu-v1/${part.path}`;
  const absolute = resolve(root, 'game/assets', path);
  const sha256 = createHash('sha256').update(readFileSync(absolute)).digest('hex');
  if (sha256 !== part.sha256) throw new Error(`Asset changed: ${path}`);
  if (manifest.assets.some(entry => entry.path === path)) throw new Error(`Already registered: ${path}`);
  return { path, ext:'webp', license:'老板授权项目角色素材；Codex 内置 image_gen 生成', bytes:statSync(absolute).size, sha256,
    source:'docs/evidence/2026-10-14-WF-base-chibi/README.md' };
});
const marker = '"assets": [';
const offset = original.indexOf(marker);
if (offset < 0) throw new Error('Manifest array missing');
const inserted = entries.map(entry => JSON.stringify(entry, null, 2).split('\n').map(line => '    ' + line).join('\n')).join(',\n');
let next = original.slice(0, offset + marker.length) + '\n' + inserted + ',' + original.slice(offset + marker.length);
next = next.replace(`"count": ${manifest.count}`, `"count": ${manifest.assets.length + entries.length}`);
const verified = JSON.parse(next);
if (verified.count !== verified.assets.length) throw new Error('Count mismatch');
writeFileSync(path, next);
console.log(`Registered ${entries.length} chibi parts; preserved existing entries.`);
