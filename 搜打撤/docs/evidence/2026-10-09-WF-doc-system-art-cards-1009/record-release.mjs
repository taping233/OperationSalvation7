import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLedger, hash } from '../../../scripts/workflow-ledger.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const file = 'docs/PARALLEL-REGISTRY.md';
const original = readFileSync(path.join(root, file), 'utf8');
const territory = 'docs/{terminology.md,M-BATCH-MATRIX.md,game-compendium.md}';
const old = original.split(/\r?\n/).find(line => line.startsWith('| Friday（ZCode') && line.includes('招式词条') && line.includes(territory));
if (!old) throw new Error('Declared ZCode row missing; review before editing');
const revised = old.replace(territory, `~~${territory}~~（10-09 老板确认文档占用结束，允许本轮接手；源码归属保留）`);
let content = original.replace(old, revised);
content = content.replace('术语、迁移矩阵和图鉴正文仍由他会话占用，只读留整合差异',
  '老板已确认术语、迁移矩阵与图鉴文档释放，本轮接手；其他源码与素材归属保留');
const result = applyLedger(root, { file, content, expectedSha256: hash(original) }, hash(original));
console.log(JSON.stringify({ file: result.file, releasedDocuments: 3, sourceClaimsPreserved: true }));
