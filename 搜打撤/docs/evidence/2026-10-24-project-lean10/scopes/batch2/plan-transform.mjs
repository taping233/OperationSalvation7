import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// Reuse the frozen first-batch transformer, changing configuration only.
const original = 'docs/evidence/2026-10-24-project-lean10/scopes';
const firstBatch = JSON.parse(fs.readFileSync(`${original}/manifest.json`, 'utf8'));
const paused = ['base-camp-rework.css', 'base-cohesion-v5.css', 'base-personnel-v12.css',
  'base-archive-facilities-v12.css', 'expedition-inventory.css', 'base-camp.css',
  'base-logistics-trade-v12.css', 'feedback-oct12.css', 'home-linked-interactions.css'];
const skipped = [...new Set([...firstBatch.files.map(item => path.basename(item.file)), ...paused])];
let source = fs.readFileSync(`${original}/plan-transform.mjs`, 'utf8');
const edits = [
  [`const evidence = '${original}';`, `const evidence = '${original}/batch2';`],
  ["const cache = 'node_modules/.cache/project-lean10-scopes-before';",
    "const cache = 'node_modules/.cache/project-lean10-scopes-before-batch2';"],
  ['if (excluded.test(name)) continue;', `if (excluded.test(name) || ${JSON.stringify(skipped)}.includes(name)) continue;`],
  ['if (result.structural < 1000) continue;', 'if (result.structural < 1) continue;'],
  ["scope: '52-file selector scope refactor; all features retained'",
    "scope: 'Second batch: remaining positive selector scope refactors; first batch and paused sources excluded'"],
];
for (const [before, after] of edits) {
  if (!source.includes(before)) throw new Error(`Transformer configuration changed: ${before}`);
  source = source.replace(before, after);
}
const result = spawnSync(process.execPath,
  ['--input-type=module', '-', ...(process.argv.includes('--apply') ? ['--apply'] : [])],
  { input: source, encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
process.stdout.write(result.stdout || ''); process.stderr.write(result.stderr || '');
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
