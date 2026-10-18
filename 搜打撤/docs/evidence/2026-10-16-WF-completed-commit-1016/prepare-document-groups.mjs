import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd(), repo = path.resolve(root, '..');
const directory = 'docs/evidence/2026-10-16-WF-completed-commit-1016';
const original = fs.readFileSync(`${directory}/docs-paths.txt`, 'utf8').trim().split(/\r?\n/);
const ownNames = ['README.md', 'selection.json', 'quartermaster-target.json', 'quartermaster-readonly-check.json', 'asset-consumer-review.md', 'asset-consumer-review-diff.json', 'asset-fingerprint-review.json',
  'browser-d9705293-b044-4843-9840-a76e62e122af-snapshot.json', 'browser-da1b3d9b-d570-4305-96b0-f80fb1e91e67-snapshot.json',
  'battle-drag.png', 'chest-resume.png', 'failures.json', 'repair-last2.json', 'source-index-inventory.json',
  'source-commit-result.json', 'retained-in-flight.json', 'final-verification.json', 'docs-check-final.json', 'gate-result-repaired.json', 'gate-result-bounded.json', 'gate-result-final.json', 'gate-result-sealed.json', 'bounded-run-memory.json', 'document-groups.json'];
const candidates = [...original.filter(file => !file.includes('/WF-completed-commit-1016/') && !file.includes('/WF-integration-ship-1016/') && !file.includes('/quartermaster-write-attempts-')), ...ownNames.map(name => `搜打撤/${directory}/${name}`)];
const status = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).split('\0').filter(Boolean);
const changedFiles = new Set();
for (let index = 0; index < status.length; index++) {
  const row = status[index];
  changedFiles.add(row.slice(3));
  if (/[RC]/.test(row.slice(0, 2))) { changedFiles.add(status[++index]); }
}
const groups = { gameEvidence: [], artEvidence: [] }, excluded = [];
for (const file of [...new Set(candidates)]) {
  const full = path.join(repo, file);
  if (!fs.existsSync(full)) { excluded.push({ file, reason: 'not yet produced' }); continue; }
  if (fs.statSync(full).size > 1024 * 1024 || /\.(?:mp[34]|wav|ogg|flac|m4a|avi|mov|webm|zip|7z|rar|tar|gz|woff2?|ttf|otf)$/i.test(file)) { excluded.push({ file, reason: 'project binary/size rule' }); continue; }
  if (!changedFiles.has(file)) continue;
  const art = /(?:card-style|card-node|card-rarity|nai|wu-|winter-painterly|restore-default-art|art-style|art-ui|xart)/i.test(file) && !file.includes('WF-completed-commit');
  const item = { file, bytes: fs.statSync(full).size, sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex'), mtimeMs: fs.statSync(full).mtimeMs };
  if (/\.(?:json|md|js|mjs|cjs|html|css|txt|py|toml|snapshot)$/i.test(file) && /(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(fs.readFileSync(full, 'utf8'))) throw Error('Potential secret: ' + file);
  groups[art ? 'artEvidence' : 'gameEvidence'].push(item);
}
// The inventory records other files, avoiding a recursive self-hash.
for (const group of Object.values(groups)) {
  const index = group.findIndex(item => item.file.endsWith('/document-groups.json'));
  if (index >= 0) group.splice(index, 1);
}
fs.writeFileSync(`${directory}/document-groups.json`, JSON.stringify({ observedAt: new Date().toISOString(), groups, excluded, secretScan: 'common token patterns: no matches; not exhaustive' }, null, 2) + '\n');
console.log(JSON.stringify({ gameEvidence: groups.gameEvidence.length, artEvidence: groups.artEvidence.length, excluded: excluded.length }));
