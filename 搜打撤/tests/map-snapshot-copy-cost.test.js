// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { createMapSnapshot, hydrateMapSnapshot, planMapRestore } from '../game/src/run/map-snapshot.js';

const make = () => createMapSnapshot({ mapSeed: 'copy-cost', generatorVersion: 3, layoutVersion: 9, layerData: createLayeredMap('copy-cost') }).value;
const run = snapshot => ({ mapSeed: snapshot.mapSeed, generatorVersion: 3, layoutVersion: 9, layerIdx: 0, trackPos: 0, mapSnapshot: snapshot });
afterEach(() => vi.restoreAllMocks());

describe('map snapshot restore copy boundaries', () => {
  it('restores the same validated snapshot with only the full-validation JSON round trips', () => {
    const snapshot = make();
    const stringify = vi.spyOn(JSON, 'stringify');
    const parse = vi.spyOn(JSON, 'parse');
    const result = planMapRestore(run(snapshot));
    expect(result.ok).toBe(true);
    // 一次完整校验保留尺寸序列化和 JSON 克隆，不再二次校验或逐节点序列化。
    expect(stringify).toHaveBeenCalledTimes(2);
    expect(parse).toHaveBeenCalledTimes(1);
  });

  it('keeps input, restored snapshot, nodes and logical records independently mutable', () => {
    const input = make();
    const baseline = structuredClone(input);
    const restored = planMapRestore(run(input)).value;
    const layer = restored.layerData[0];
    const edgeNode = layer.nodes.findIndex(node => node.next.length);
    layer.nodes[edgeNode].next[0][1] = 999;
    layer.logical[edgeNode].def.name = 'mutated';
    layer.gridBounds.minX = -999;
    layer.doors[0].pair = 'mutated';
    layer.entrances.push(999);
    layer.entranceNames.push('mutated');
    layer.altarEntrances.push({});
    expect(restored.snapshot).toEqual(baseline);
    expect(input).toEqual(baseline);
    expect(layer.logical[edgeNode].next).toEqual(baseline.layers[0].nodes[edgeNode].next);
    expect(layer.nodes[edgeNode].name).toBe(baseline.layers[0].nodes[edgeNode].def.name);
    expect(planMapRestore(run(input)).value.snapshot).toEqual(baseline);
  });

  it('revalidates mutated input on every public entry and keeps position rejection', () => {
    const snapshot = make();
    expect(hydrateMapSnapshot(snapshot).ok).toBe(true);
    expect(planMapRestore({ ...run(snapshot), trackPos: 999 }).code).toBe('INVALID_MAP_POSITION');
    snapshot.layers[0].nodes[0].next.push([9, 999]);
    expect(hydrateMapSnapshot(snapshot).ok).toBe(false);
    expect(planMapRestore(run(snapshot)).ok).toBe(false);
  });

  it.each(['cycle', 'prototype', 'undefined', 'function', 'non-finite'])('still rejects %s payloads at both public entry points', kind => {
    const snapshot = make();
    if (kind === 'cycle') snapshot.layers[0].nodes[0].next.push(snapshot);
    if (kind === 'prototype') Object.defineProperty(snapshot.layers[0], '__proto__', { value: {}, enumerable: true });
    if (kind === 'undefined') snapshot.layers[0].name = undefined;
    if (kind === 'function') snapshot.layers[0].name = () => 'name';
    if (kind === 'non-finite') snapshot.layers[0].gridBounds.minX = Infinity;
    expect(hydrateMapSnapshot(snapshot).ok).toBe(false);
    expect(planMapRestore(run(snapshot)).ok).toBe(false);
  });

  it('keeps legacy regeneration output and position checks', () => {
    const legacy = { seed: 'copy-cost', generatorVersion: 3, layoutVersion: 9, layerIdx: 0, trackPos: 0 };
    expect(planMapRestore(legacy).value.snapshot).toEqual(make());
    expect(planMapRestore({ ...legacy, layerIdx: 99 }).code).toBe('INVALID_MAP_POSITION');
  });
});
