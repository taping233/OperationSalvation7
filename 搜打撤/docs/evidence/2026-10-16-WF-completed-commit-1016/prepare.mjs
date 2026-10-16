import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(directory, '../../..');
const repo = path.resolve(project, '..');
const raw = fs.readFileSync(path.join(project, '.tmp-ship-plan-1016.json'));
const plan = JSON.parse(raw.toString(raw[0] === 255 ? 'utf16le' : 'utf8').replace(/^\uFEFF/, ''));
const active = [
  'docs/production/art/NAI-PROMPTING.md', 'docs/evidence/2026-10-16-wu-snow-road-nai45',
  'docs/evidence/2026-10-16-wu-style-AD',
];
const within = (file, prefix) => file === prefix || file.startsWith(prefix + '/');
const binary = /\.(mp[34]|wav|ogg|flac|m4a|avi|mov|webm|zip|7z|rar|tar|gz|woff2?|ttf|otf)$/i;
const exclusions = [];
const selected = { code: [], docs: [] };
for (const commit of plan.commits) for (const file of commit.paths) {
  const relative = file.replace(/^搜打撤\//, '');
  const full = path.join(repo, file);
  const reason = active.some(prefix => within(relative, prefix)) ? 'active ownership; retain in working tree'
    : relative.startsWith('game/art-source/') ? 'source artwork and generation intermediates; runtime assets are selected separately'
      : /^game\/(?:base-design-options|card-design-options|card-design-references|event-template)/.test(relative) ? 'design candidates, not accepted runtime'
        : /(?:prepare-selection|frozen-result|code-index|privacy-review|secret-scan)/.test(relative)
          && relative.includes('WF-integration-ship-1016') ? 'previous shipping session intermediates'
          : binary.test(relative) || (fs.existsSync(full) && fs.statSync(full).size > 1024 * 1024) ? 'binary type or size excluded by project rule'
            : null;
  if (reason) exclusions.push({ file, reason });
  else selected[commit.scope].push(file);
}
for (const file of plan.unknownPaths) exclusions.push({ file, reason: 'unknown completion/ownership; configuration, tools, PV sources or temporary output retained' });
for (const file of plan.inProgressPaths) exclusions.push({ file, reason: 'unfinished task metadata' });
for (const file of plan.excludedPaths) exclusions.push({ file, reason: 'workflow exclusion, oversized evidence or pending decision' });
const inventory = Object.values(selected).flat().map(file => {
  const full = path.join(repo, file);
  return fs.existsSync(full) ? { file, sha256: createHash('sha256').update(fs.readFileSync(full)).digest('hex'),
    bytes: fs.statSync(full).size, mtimeMs: fs.statSync(full).mtimeMs } : { file, deleted: true };
});
const sensitive = [];
for (const item of inventory) {
  if (item.deleted || !/\.(?:json|md|js|mjs|cjs|html|css|txt|py|toml)$/i.test(item.file)) continue;
  const text = fs.readFileSync(path.join(repo, item.file), 'utf8');
  if (/(?:sk-[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{35,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)/.test(text)) sensitive.push(item.file);
}
if (sensitive.length) throw Error('Potential secrets, paths only: ' + sensitive.join(', '));
const record = { observedAt: new Date().toISOString(), head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  selected, inventory, exclusions, secretScan: { commonTokenPatterns: 'no matches', exhaustive: false } };
fs.writeFileSync(path.join(directory, 'selection.json'), JSON.stringify(record, null, 2) + '\n');
fs.writeFileSync(path.join(directory, 'code-paths.txt'), selected.code.join('\n') + '\n');
fs.writeFileSync(path.join(directory, 'docs-paths.txt'), selected.docs.join('\n') + '\n');
console.log(JSON.stringify({ code: selected.code.length, docs: selected.docs.length, excluded: exclusions.length, secretMatches: sensitive.length }));
