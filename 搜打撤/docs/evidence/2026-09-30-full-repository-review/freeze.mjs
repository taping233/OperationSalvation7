import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = process.cwd();
const out = path.join(root, 'docs/evidence/2026-09-30-full-repository-review');
const snapshot = path.join(out, 'snapshot');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const tracked = new Set(git(['ls-files']).split(/\r?\n/).filter(Boolean));
const extensions = /\.(?:js|mjs|cjs|ts|json|html|css|ink|yml|yaml|md)$/i;
const selected = new Set();
const runtimeRoots = ['game/src/', 'game/data/', 'game/css/', 'game/tools/', 'scripts/', 'tests/', 'narrative/'];
for (const file of tracked) {
  if (!extensions.test(file)) continue;
  if (runtimeRoots.some(prefix => file.startsWith(prefix)) || /^game\/[^/]+\.(html|js|json)$/.test(file) || !file.includes('/')) selected.add(file);
}
const documents = ['README.md', 'docs/README.md', 'docs/rules.md', 'docs/architecture.md', 'docs/save-format.md',
  'docs/audio-system.md', 'docs/quality-gates.md', 'docs/development.md', 'docs/agent-protocol.md',
  'docs/cards/README.md', 'docs/M-BATCH-MATRIX.md', 'docs/M-BATCH-EXCLUSIONS.md', 'docs/BASE-DIRECT-WRITE-AUDIT-2026-09-29.md'];
for (const file of documents) if (fs.existsSync(path.join(root, file))) selected.add(file);
// 已完成未提交的工程工具纳入独立来源层；在途音效试听与 iab-drive 草稿排除。
for (const dir of ['scripts', 'tests']) for (const name of fs.readdirSync(path.join(root, dir))) {
  if (name.startsWith('workflow') || (dir === 'scripts' && name === 'index-validation.mjs')) selected.add(`${dir}/${name}`);
}
const rows = [];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
for (const file of [...selected].sort()) {
  const source = path.join(root, file);
  if (!fs.statSync(source).isFile()) continue;
  const bytes = fs.readFileSync(source);
  const destination = path.join(snapshot, file);
  if (fs.existsSync(destination)) throw new Error('Snapshot already exists: ' + file);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
  let owner = 'root';
  if (/^game\/src\/(battle|cards)\/|^game\/data\/cards/.test(file)) owner = 'battle_cards';
  else if (/^game\/src\/(ui|home|experience)\/|^game\/src\/run\/(?!game\.session)|^game\/css\/|^game\/[^/]+\.html$|^narrative\//.test(file)) owner = 'world_ui';
  else if (/^game\/src\/(core|audio|agent)\/|^game\/src\/[^/]+\.js$|^game\/tools\/|^scripts\/|^[^/]+\.(json|js|mjs|cjs|yml|yaml)$/.test(file)) owner = 'infrastructure';
  const category = file.startsWith('tests/') ? 'test-or-fixture' : file.includes('/generated/') ? 'generated-reference' : file.endsWith('.md') ? 'contract-document' : 'review-target';
  rows.push({ file, owner, category, tracked: tracked.has(file), sha256: hash(bytes), bytes: bytes.length, lines: bytes.toString('utf8').split(/\r?\n/).length });
}
const repoRoot = git(['rev-parse', '--show-toplevel']).trim();
for (const file of ['AGENTS.md', '.github/workflows/ci.yml', '.github/workflows/vite-quality.yml']) {
  const source = path.join(repoRoot, file); if (!fs.existsSync(source)) continue;
  const bytes = fs.readFileSync(source); const destination = path.join(snapshot, '_repo', file);
  fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes);
  rows.push({ file: `_repo/${file}`, owner: 'infrastructure', category: file.endsWith('.md') ? 'contract-document' : 'review-target', tracked: true, sha256: hash(bytes), bytes: bytes.length, lines: bytes.toString('utf8').split(/\r?\n/).length });
}
const summary = { createdAt: new Date().toISOString(), root, snapshot, head: git(['rev-parse', 'HEAD']).trim(),
  branch: git(['branch', '--show-current']).trim(), status: git(['status', '--short']),
  exclusions: ['Godot/Unity/EXE/desktop-app', 'output/旧实验/文档证据与归档', '原始位图音频等二进制素材（仅核对引用）', '在途sfx-audition及替代音效素材', '未跟踪iab-drive草稿'], files: rows };
fs.writeFileSync(path.join(out, 'baseline.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(out, 'asset-paths.txt'), [...tracked].filter(file => file.startsWith('game/assets/')).sort().join('\n'));
for (const owner of ['battle_cards', 'world_ui', 'infrastructure', 'root']) {
  fs.mkdirSync(path.join(out, owner), { recursive: true });
  fs.writeFileSync(path.join(out, owner, 'assigned.json'), JSON.stringify(rows.filter(row => row.owner === owner || row.category === 'test-or-fixture' || row.category === 'contract-document'), null, 2));
}
console.log(JSON.stringify({ head: summary.head, snapshot, files: rows.length, targets: rows.filter(row => row.category === 'review-target').length,
  byOwner: Object.fromEntries(['battle_cards', 'world_ui', 'infrastructure', 'root'].map(owner => [owner, rows.filter(row => row.owner === owner && row.category === 'review-target').length])) }));
