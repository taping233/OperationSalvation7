import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { previewCheck, repositoryContext } from '../../../scripts/workflow-evidence.mjs';

const root = mkdtempSync(path.join(os.tmpdir(), 'sdt-validation-slow-plan-'));
mkdirSync(path.join(root, 'scripts'));
const runner = `import { writeFileSync } from 'node:fs';
if (!process.argv.includes('--plan')) { writeFileSync('executed', 'unexpected'); process.exit(9); }
await new Promise(resolve => setTimeout(resolve, 16_000));
console.log(JSON.stringify({ mode: 'full', paths: [], tests: [], reasons: ['16s planning fixture'] }));
`;
writeFileSync(path.join(root, 'scripts/acceptance-gate.mjs'), runner);
const started = performance.now();
const plan = previewCheck(root, { full: true });
const elapsedMs = Math.round(performance.now() - started);
assert.equal(plan.dryRun, true);
assert.equal(plan.selection.mode, 'full');
assert(elapsedMs >= 16_000);
assert.equal(existsSync(path.join(root, 'executed')), false);
assert.equal(existsSync(path.join(root, 'docs/evidence')), false);
const source = new URL('../../../scripts/workflow-evidence.mjs', import.meta.url);
const result = { kind: 'synthetic-slow-plan-check', outcome: 'passed', root, elapsedMs,
  injectedDelayMs: 16_000, previousLimitMs: 15_000, currentLimitMs: 60_000,
  source: fileURLToPath(source), sourceSha256: createHash('sha256').update(readFileSync(source)).digest('hex'),
  repository: repositoryContext(root), plan, checksExecuted: false,
  limits: ['人工延迟夹具，仅验证超过旧时限的计划可完成；不代表真实项目选验耗时或完整门通过。'] };
writeFileSync(new URL('slow-plan.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ outcome: result.outcome, elapsedMs, mode: plan.selection.mode, checksExecuted: false }));
