import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLedger, hash, table } from '../../../scripts/workflow-ledger.mjs';
import { classifyLedgerRow } from '../../../scripts/registry-paths.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const file = 'docs/PENDING.md';
const original = readFileSync(path.join(root, file), 'utf8');
const snapshot = readFileSync(path.join(root, 'docs/archive/WF-ledger-context-1009/originals/docs/PENDING.md'), 'utf8');
const sources = [...table(snapshot, '活账').rows.filter(row => classifyLedgerRow(row, 'pending').state === 'resolved'), ...table(snapshot, '已决记录').rows];
const closed = table(original, '已决记录');
if (sources.length !== closed.rows.length) throw new Error('Historical index changed; review before repairing');
const lines = [...closed.lines];
closed.rows.forEach((row, i) => {
  if (row.cells[0] !== sources[i].cells[0]) throw new Error('Historical identity changed');
  const title = sources[i].cells[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/[\[\]`*_]/g, '').replaceAll('|', '／').slice(0, 70);
  const cells = [...row.cells];
  cells[1] = title;
  lines[row.index] = '| ' + cells.join(' | ') + ' |';
});
const content = lines.join(original.includes('\r\n') ? '\r\n' : '\n');
const result = applyLedger(root, { file, content, expectedSha256: hash(original) }, hash(original));
console.log(JSON.stringify({ file: result.file, repairedHistoryTitles: closed.rows.length }));
