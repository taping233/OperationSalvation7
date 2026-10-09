import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyLedger, hash, table } from '../../../scripts/workflow-ledger.mjs';
import { classifyLedgerRow, parseActiveRegistry } from '../../../scripts/registry-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const { plans } = JSON.parse(readFileSync(path.join(here, 'ledger-plan.json'), 'utf8'));
const ready = plans.map(plan => {
  const current = readFileSync(path.join(root, plan.file), 'utf8');
  const content = readFileSync(path.join(here, plan.preview), 'utf8');
  if (hash(current) !== plan.expectedSha256 || hash(content) !== plan.previewSha256) throw new Error('Ledger or preview changed');
  const state = text => plan.file.endsWith('PENDING.md')
    ? table(text, '活账').rows.filter(row => classifyLedgerRow(row, 'pending').state === 'open').map(row => row.line)
    : parseActiveRegistry(text, { includeSettled: true });
  if (JSON.stringify(state(current)) !== JSON.stringify(state(content))) throw new Error('Active claims changed');
  return { ...plan, content };
});
for (const plan of ready) {
  const result = applyLedger(root, plan, plan.expectedSha256);
  console.log(JSON.stringify({ file: result.file, preservedActive: true, bytesBefore: plan.bytesBefore, bytesAfter: plan.bytesAfter }));
}
