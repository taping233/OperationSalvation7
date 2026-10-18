import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd(), repo = path.resolve(root, '..');
const dir = 'docs/evidence/2026-10-16-WF-completed-commit-1016';
const plan = JSON.parse(fs.readFileSync(`${dir}/document-groups.json`, 'utf8'));
const env = { ...process.env };
for (const key of ['GATE_RECEIPT', 'SKIP_FULL_TESTS', 'GATE_MANIFEST_OK', 'FORCE_FULL_TESTS']) delete env[key];
const git = args => execFileSync('git', args, { cwd: repo, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024, env }).trim();
const committed = [];
for (const [group, items] of Object.entries(plan.groups)) {
  const allowed = items.map(item => item.file);
  if (group === 'gameEvidence') allowed.push(`搜打撤/${dir}/document-groups.json`);
  const priorIndex = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  if (priorIndex.some(file => !allowed.includes(file))) throw Error('Index includes files outside this reviewed document group');
  const assertUnchanged = () => {
    for (const item of items) {
      const full = path.join(repo, item.file);
      if (fs.statSync(full).mtimeMs !== item.mtimeMs || createHash('sha256').update(fs.readFileSync(full)).digest('hex') !== item.sha256) throw Error(`Document changed after review: ${item.file}`);
    }
  };
  assertUnchanged();
  if (!items.length) continue;
  const paths = items.map(item => item.file);
  if (group === 'gameEvidence') paths.push(`搜打撤/${dir}/document-groups.json`);
  git(['add', '--', ...paths]);
  const staged = git(['diff', '--cached', '--name-only', '-z']).split('\0').filter(Boolean);
  if (staged.length !== paths.length || staged.some(file => !paths.includes(file))) throw Error('Staged document scope differs');
  git(['diff', '--cached', '--check']);
  assertUnchanged();
  const message = group === 'gameEvidence' ? 'docs(game): archive completed audits and integration verification' : 'docs(art): record completed reference and generation studies';
  const output = git(['commit', '-m', message]);
  const record = { group, commit: git(['rev-parse', 'HEAD']), files: staged.length, output };
  committed.push(record);
  fs.writeFileSync(`${dir}/document-commit-result.json`, JSON.stringify(committed, null, 2) + '\n');
  console.log(JSON.stringify({ group, commit: record.commit, files: record.files }));
}
