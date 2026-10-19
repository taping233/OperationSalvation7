import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { walk, inspectPackageBytes } = require('../../../scripts/perf-budget.cjs');
if (!process.argv[2]) throw new Error('Pass an existing, completed build directory to inspect read-only.');
const fixture = path.resolve(process.argv[2]);
const files = walk(fixture);
function baseline(files, { stat, read }) {
  const packageBytes = files.reduce((sum, file) => sum + stat(file).size, 0);
  const groups = new Map();
  for (const file of files) {
    const body = read(file);
    const hash = createHash('sha256').update(body).digest('hex');
    const group = groups.get(hash) || { bytes: body.length, count: 0 };
    group.count++;
    groups.set(hash, group);
  }
  return { packageBytes, duplicateBytes: [...groups.values()].reduce((sum, group) => sum + (group.count - 1) * group.bytes, 0) };
}
function measure(method) {
  let bytesRead = 0, filesRead = 0;
  const read = file => { const body = readFileSync(file); bytesRead += body.length; filesRead++; return body; };
  const start = performance.now();
  const result = method(files, { stat: statSync, read });
  return { ...result, elapsedMs: performance.now() - start, filesRead, bytesRead };
}
const runs = [];
for (let round = 0; round < 6; round++) {
  const names = round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized'];
  const result = { round, order: names };
  for (const name of names) result[name] = measure(name === 'baseline' ? baseline : inspectPackageBytes);
  if (result.baseline.packageBytes !== result.optimized.packageBytes || result.baseline.duplicateBytes !== result.optimized.duplicateBytes) throw new Error('Budget totals differ');
  runs.push(result);
}
console.log(JSON.stringify({ fixture, node: process.version, files: files.length,
  scope: 'Read-only existing older build, not the current snapshot. Alternating warm-cache microbenchmark; no browser/game FPS or current build claim.', runs }, null, 2));
