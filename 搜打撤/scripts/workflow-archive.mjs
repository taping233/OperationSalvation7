import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { hash } from './workflow-ledger.mjs';
import { currentDocuments, duplicateDocuments, filesUnder } from './workflow-status.mjs';
import { safeId } from './workflow-evidence.mjs';

// Deterministic review hints, not semantic rulings or automatic archive/deletion.
const REVIEW_RULES = [
  { code: 'fixed-full-gate', pattern: /定向→全量→实页三级验收/, authority: 'docs/quality-gates.md', reason: '固定全套措辞需核对分级验收' },
  { code: 'implicit-commit', pattern: /双提交落库/, authority: '../AGENTS.md', reason: '提交需单独授权，流程不能隐含授权' },
  { code: 'old-browser-entry', pattern: /headless.*(?:Edge|CDP)|Edge.*CDP/i, authority: 'docs/quality-gates.md', reason: '浏览器入口需区分历史实现与现行许可，提及本身不是违规' },
  { code: 'dated-current', pattern: /当前技术轮|主工作区集成.*进行中/, authority: 'docs/STATUS.md', reason: '带时点的当前描述需核对，不推定已经完成' },
];

export function archivePlan(root) {
  const review = [];
  const documents = currentDocuments(root);
  const references = [...documents, ...filesUnder(root, 'scripts'), ...filesUnder(root, 'tests')]
    .filter(file => /\.(?:md|js|mjs|cjs)$/.test(file));
  for (const file of documents) {
    const lines = readFileSync(path.join(root, file), 'utf8').split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) for (const rule of REVIEW_RULES) {
      if (rule.code === 'old-browser-entry' && /不得|不要|停用|不再|不沿用|保留作历史/.test(lines[index])) continue;
      if (rule.pattern.test(lines[index])) review.push({ file, line: index + 1, code: rule.code,
        authority: rule.authority, reason: rule.reason, excerpt: lines[index].slice(0, 200) });
    }
  }
  const duplicates = duplicateDocuments(root).map(group => ({ ...group, references: references.filter(file => {
    const text = readFileSync(path.join(root, file), 'utf8');
    return group.files.some(candidate => file !== candidate && text.includes(path.posix.basename(candidate)));
  }) }));
  return { schemaVersion: 1, scope: 'docs 根层 + docs/production', duplicates, review,
    limits: ['模式命中仅为复核候选，不自动判定冲突', '引用只检索现行文档/scripts/tests，移动前仍需全项目核对',
      '不按 mtime 宣判过期；不移动、不删除、不合并同字节不同用途的文件'] };
}

export function snapshot(root, task, paths, replacements) {
  safeId(task);
  if (!paths.length) throw new Error('必须指定要留档的 --paths');
  const base = 'docs/archive/' + task;
  const allowed = new Set(currentDocuments(root));
  const items = paths.map(file => {
    if (!allowed.has(file)) throw new Error('只接受现行 Markdown 的明确项目相对路径：' + file);
    const target = base + '/originals/' + file;
    if (existsSync(path.join(root, target))) throw new Error('归档原文已存在，禁止覆盖：' + target);
    return { source: file, target, sha256: hash(readFileSync(path.join(root, file))), replacedBy: replacements ?? null };
  });
  const manifestFile = base + '/manifest.json';
  if (existsSync(path.join(root, manifestFile))) throw new Error('归档清单已存在，使用新的批次编号');
  for (const item of items) {
    mkdirSync(path.dirname(path.join(root, item.target)), { recursive: true });
    writeFileSync(path.join(root, item.target), readFileSync(path.join(root, item.source)), { flag: 'wx' });
    if (hash(readFileSync(path.join(root, item.target))) !== item.sha256) throw new Error('归档哈希不匹配：' + item.target);
  }
  const manifest = { schemaVersion: 1, at: new Date().toISOString(), task, method: 'copy-original-before-revision', items,
    limits: ['原文保持字节，内部相对链接仍以 source 原位置解释', '本命令未修改源文件；替代状态由负责人核实并在现行入口注明'] };
  writeFileSync(path.join(root, manifestFile), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  return manifest;
}
