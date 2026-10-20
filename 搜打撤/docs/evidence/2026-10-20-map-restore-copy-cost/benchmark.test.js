import { expect, it } from 'vitest';
import { writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { createLayeredMap, createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { applyGuardedRoute } from '../game/src/run/map-route-v2.js';
import { createMapSnapshot, planMapRestore as after } from '../game/src/run/map-snapshot.js';
import { planMapRestore as before } from '../game/src/run/map-snapshot.baseline.js';

function count(fn, input) {
  const stringify = JSON.stringify, parse = JSON.parse;
  const cost = { stringifyCalls: 0, stringifyChars: 0, parseCalls: 0, parseChars: 0 };
  JSON.stringify = (...args) => { const raw = stringify(...args); cost.stringifyCalls++; cost.stringifyChars += raw?.length || 0; return raw; };
  JSON.parse = (...args) => { cost.parseCalls++; cost.parseChars += args[0].length; return parse(...args); };
  try { expect(fn(input).ok).toBe(true); } finally { JSON.stringify = stringify; JSON.parse = parse; }
  return cost;
}
function time(fn, input, iterations) {
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(input);
  return (performance.now() - start) / iterations;
}
it('compares fixed real-generator inputs and equal outputs', () => {
  const inputs = [];
  for (const [name, version, guarded] of [['legacy-snapshot', 3, false], ['current-snapshot', 6, false], ['current-guarded', 6, true]]) {
    const seed = 'audit-map-20261017-0';
    let layerData = version === 3 ? createLayeredMap(seed) : createCurrentLayeredMap(seed), routeVersion, routePlan;
    if (guarded) {
      const base = applyRouteOverlay({ generatorVersion: version, layoutVersion: 9, layerData }).value;
      ({ layerData, routeVersion, routePlan } = applyGuardedRoute({ generatorVersion: version, layoutVersion: 9, layerData: base.layerData, baseRoutePlan: base.routePlan }).value);
    }
    const made = createMapSnapshot({ mapSeed: seed, generatorVersion: version, layoutVersion: 9, layerData, routeVersion, routePlan });
    expect(made.ok).toBe(true);
    inputs.push({ name, run: { mapSnapshot: made.value, layerIdx: 1, trackPos: 2 } });
  }
  inputs.push({ name: 'legacy-regeneration', run: { seed: 'audit-map-20261017-0', generatorVersion: 3, layoutVersion: 9, layerIdx: 1, trackPos: 2 } });
  const results = [];
  for (const { name, run } of inputs) {
    expect(after(run)).toEqual(before(run));
    const beforeCost = count(before, run), afterCost = count(after, run);
    time(before, run, 25); time(after, run, 25);
    const b = [], a = [];
    for (let i = 0; i < 7; i++) {
      if (i % 2) { a.push(time(after, run, 100)); b.push(time(before, run, 100)); }
      else { b.push(time(before, run, 100)); a.push(time(after, run, 100)); }
    }
    const median = values => [...values].sort((a,b) => a-b)[3];
    results.push({ name, inputSha256: createHash('sha256').update(JSON.stringify(run)).digest('hex'), snapshotChars: run.mapSnapshot ? JSON.stringify(run.mapSnapshot).length : null, nodeCount: run.mapSnapshot?.layers.reduce((n,l)=>n+l.nodes.length,0), beforeCost, afterCost, beforeMedianMs: median(b), afterMedianMs: median(a), beforeSamplesMs: b, afterSamplesMs: a });
  }
  writeFileSync('benchmark-results.json', JSON.stringify({ runtime: process.version, warmup:25, iterations:100, samples:7, scope:'Node/Vitest synthetic repeated restore; not real-device loading latency', results },null,2));
}, 30000);
