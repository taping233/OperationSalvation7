import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const evidence = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(evidence, '../../..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const phase = process.argv[2] || 'before';
if (!['before', 'after'].includes(phase)) throw new Error('phase must be before or after');
const output = path.join(evidence, `${phase}.json`);
if (existsSync(output)) throw new Error('Evidence already exists; preserve it');
const documents = [];
function visit(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) { visit(absolute); continue; }
    if (!/\.(md|txt|pdf)$/i.test(entry.name)) continue;
    const file = path.relative(project, absolute).replaceAll('\\', '/');
    if (file.startsWith('docs/evidence/2026-10-09-WF-doc-system-1009/')) continue;
    const bytes = readFileSync(absolute);
    const content = /\.pdf$/i.test(entry.name) ? '' : bytes.toString('utf8');
    const historical = /^docs\/(archive|evidence|modules|nightshift)\//.test(file);
    const toolReference = /^docs\/(previews|ui-art-overhaul)\//.test(file);
    const proposal = /PROPOSAL|PLAN|2026-\d{2}-\d{2}/.test(entry.name);
    const kind = historical ? 'history-or-evidence' : toolReference ? 'tool-reference'
      : file === 'docs/game-compendium.md' ? 'generated'
      : /^(PENDING|PARALLEL-REGISTRY|STATUS)\.md$/.test(entry.name) ? 'state-or-navigation'
      : proposal ? 'proposal-or-dated-record' : 'current-reference';
    documents.push({ file, kind, bytes: bytes.length, sha256: sha256(bytes),
      title: content.match(/^#\s+(.+)$/m)?.[1] || entry.name,
      reviewCandidates: historical || toolReference ? [] : content.split(/\r?\n/).flatMap((line, i) =>
        /本轮|本次|当前基线|已经|全部.*完成|不等于|不代表|阶段[：:]|下一轮/.test(line)
          ? [{ line: i + 1, text: line.slice(0, 260) }] : []) });
  }
}
visit(path.join(project, 'docs'));
for (const file of ['../AGENTS.md', '../README.md', 'README.md', 'game/src/README.md', 'game/assets/README.md']) {
  const bytes = readFileSync(path.resolve(project, file));
  documents.push({ file, kind: 'entry-or-rule', bytes: bytes.length, sha256: sha256(bytes) });
}
documents.sort((a, b) => a.file.localeCompare(b.file));
const counts = documents.reduce((result, item) => { result[item.kind] = (result[item.kind] || 0) + 1; return result; }, {});
const report = { phase, recordedAt: new Date().toISOString(), counts, documents,
  limits: ['分类与措辞命中是复核候选，不能代替内容审查', '历史和证据保留原文', '不证明游戏运行或实页验收'] };
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', 'utf8');
console.log(JSON.stringify({ phase, counts, files: documents.length, bytes: statSync(output).size }));
