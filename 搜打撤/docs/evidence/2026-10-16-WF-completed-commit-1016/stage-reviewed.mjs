import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const repo = path.resolve(root, '..');
const dir = 'docs/evidence/2026-10-16-WF-completed-commit-1016';
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8' }).trim();
const existingIndex = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
const failures = JSON.parse(fs.readFileSync(`${dir}/failures.json`, 'utf8'));
const updates = Object.keys(failures.failuresByFile).filter(file => fs.existsSync(file));
updates.push('tests/map-travel-path.test.js', 'tests/helpers/chest-actions.js', 'game/selftest.js', 'scripts/runtime-asset-redundancy-review.mjs');
updates.push(...['2026-10-16-WF-battle-play-feedback-1016/core-contract.md',
  '2026-10-16-WF-battle-platform-minimal/README.md', '2026-10-16-WF-battle-return-1016/drag-reference.md',
  '2026-10-16-WF-game-performance-1016/README.md', '2026-10-16-WF-game-performance-wide-1016/README.md'].map(file => `docs/evidence/${file}`));
const paths = [...new Set([...existingIndex.filter(file => fs.existsSync(path.join(repo, file))), ...updates.map(file => `搜打撤/${file}`)])];
git(['add', '--', ...paths]);
const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
const inventory = staged.map(file => {
  const full = path.join(repo, file);
  return fs.existsSync(full) ? { file, sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex'), bytes: fs.statSync(full).size, mtimeMs: fs.statSync(full).mtimeMs } : { file, deleted: true };
});
fs.writeFileSync(`${dir}/source-index-inventory.json`, JSON.stringify({ observedAt: new Date().toISOString(), head: git(['rev-parse', 'HEAD']), inventory }, null, 2) + '\n');
git(['diff', '--cached', '--check']);
console.log(JSON.stringify({ staged: staged.length, paths: staged.filter(file => !existingIndex.includes(file)) }));
