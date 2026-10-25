import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const folder = 'docs/evidence/2026-10-24-project-lean10';
const baseline = JSON.parse(fs.readFileSync(`${folder}/baseline.json`, 'utf8'));
for (const row of baseline.files) {
  const data = fs.readFileSync(path.join(baseline.cache, row.file));
  if (createHash('sha256').update(data).digest('hex') !== row.sha256) {
    throw new Error(`Frozen baseline changed: ${row.file}`);
  }
}
const selected = JSON.parse(fs.readFileSync(`${folder}/final-battle-summary.json`, 'utf8'))
  .failedFiles.map(item => `tests/${item.file}`);
const testCaches = ['node_modules/.cache/project-lean10-css-test-before',
  'node_modules/.cache/project-lean10-css-test-before-batch2'];
const tests = selected.map(file => {
  const original = testCaches.map(cache => path.join(cache, file)).find(candidate => fs.existsSync(candidate));
  const source = fs.readFileSync(original || file);
  return { file, source:original || file, sha256:createHash('sha256').update(source).digest('hex') };
});
fs.writeFileSync(`${folder}/runtime-bindings/integration-baseline-inputs.json`, JSON.stringify({
  gameBaseline:baseline.cache, verifiedGameFiles:baseline.files.length,
  gameReads:'scopes/baseline.setup.mjs fs read mapping',
  gameImports:'integration-baseline.config.mjs Vite resolve/load in-memory source override', tests,
}, null, 2) + '\n');
const report = 'node_modules/.cache/lean10-final-battle-baseline.json';
const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run',
  '--config', `${folder}/runtime-bindings/integration-baseline.config.mjs`,
  ...selected, '--reporter=json', `--outputFile=${report}`], { encoding:'utf8', maxBuffer:32e6 });
fs.writeFileSync(`${folder}/runtime-bindings/integration-baseline.log`, run.stdout + run.stderr);
console.log(JSON.stringify({ exitCode:run.status, signal:run.signal, report, files:selected.length,
  output:(run.stdout + run.stderr).slice(-1600) }));
if (!fs.existsSync(report)) throw new Error('The baseline run did not produce its JSON report');
