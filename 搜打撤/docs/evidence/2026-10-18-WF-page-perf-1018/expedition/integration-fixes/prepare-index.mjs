import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const repository = path.resolve('..');
const workspace = process.cwd();
const evidence = path.join(workspace, 'docs/evidence/2026-10-18-WF-page-perf-1018/expedition/integration-fixes');
const mirror = path.join(workspace, '.tmp/page-perf-1018/expedition-integration/project');
const targets = ['map-render-performance', 'e4-async-entry', 'dev-tools-lazy-entry', 'e8-card-inventory', 'm-batch-production'].map(name => `tests/${name}.test.js`);
mkdirSync(path.join(evidence, 'baseline'), { recursive: true });
for (const file of targets) {
  const output = path.join(evidence, 'baseline', file.replaceAll('/', '__') + '.txt');
  const bytes = readFileSync(path.join(workspace, file));
  if (existsSync(output)) { if (!readFileSync(output).equals(bytes)) throw new Error(`Baseline changed: ${file}`); }
  else writeFileSync(output, bytes, { flag: 'wx' });
}
const index = execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: repository, maxBuffer: 64 * 1024 * 1024 });
const entries = index.toString('utf8').split('\0').filter(Boolean).map(line => {
  const match = /^(\d+) ([0-9a-f]+) (\d)\t([\s\S]+)$/.exec(line);
  if (!match || match[3] !== '0') throw new Error('Unmerged or invalid index entry');
  return { mode: match[1], oid: match[2], path: match[4] };
}).filter(entry => entry.path.startsWith('搜打撤/')).map(entry => ({ ...entry, relative: entry.path.slice('搜打撤/'.length) }))
  .filter(({ relative: file }) => /^(game\/(src|css|data)\/|tests\/|scripts\/)/.test(file) && /\.(js|mjs|cjs|ts|json|css|html|md)$/.test(file)
    || /^game\/assets\/.*\.json$/.test(file) || ['game/index.html', 'package.json', 'docs/M-BATCH-MATRIX.md', 'docs/M-BATCH-EXCLUSIONS.md',
      'docs/evidence/e8-card-migration-2026-09-27/catalog-before.json', 'docs/evidence/e8-card-migration-2026-09-27/catalog-before.md'].includes(file));
const blobOutput = execFileSync('git', ['cat-file', '--batch'], { cwd: repository, input: entries.map(entry => entry.oid).join('\n') + '\n', maxBuffer: 128 * 1024 * 1024 });
let cursor = 0;
for (const entry of entries) {
  const end = blobOutput.indexOf(10, cursor);
  const [oid, type, length] = blobOutput.subarray(cursor, end).toString('utf8').split(' ');
  if (oid !== entry.oid || type !== 'blob') throw new Error(`Unexpected object ${entry.path}`);
  const start = end + 1, bytes = blobOutput.subarray(start, start + Number(length));
  const output = path.join(mirror, entry.relative);
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, bytes);
  cursor = start + Number(length) + 1;
}
if (!index.equals(execFileSync('git', ['ls-files', '--stage', '-z'], { cwd: repository, maxBuffer: 64 * 1024 * 1024 }))) throw new Error('Index changed during export');
writeFileSync(path.join(mirror, 'vite.integration.config.mjs'), "import { defineConfig } from 'vitest/config';\nexport default defineConfig({ test: { environment: 'jsdom', globals: true, pool: 'forks', fileParallelism: false } });\n");
const manifest = { mirror, indexSha256: createHash('sha256').update(index).digest('hex'), files: entries.map(({ relative, oid }) => ({ path: relative, oid })) };
writeFileSync(path.join(evidence, 'index-inputs.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({ mirror, files: entries.length, indexSha256: manifest.indexSha256 }));
