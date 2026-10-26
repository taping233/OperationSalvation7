// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { applyGuardedRoute } from '../game/src/run/map-route-v2.js';
import { FIRE_BATTLE_LIMIT, MAP_TYPE_BUDGETS, minimumBattlesTo, validateCurrentGeneratedMap } from '../game/src/run/map-generation-rules.js';
import { createMapSnapshot, planMapRestore, validateMapSnapshot } from '../game/src/run/map-snapshot.js';

const oldBytes = readFileSync('tests/fixtures/map-v5-late-fire.json');
const oldSnapshot = JSON.parse(oldBytes.toString('utf8'));
const rawLayers = layers => layers.map((layer, li) => ({ ...layer, entry: layer.entry ?? layer.entrances[0],
  nodes: layer.nodes.map((node, idx) => ({ ...node, li, idx, type: node.type ?? node.def.type })) }));

// 独立 Bellman-Ford oracle：遍历完整层内边反复松弛，不调用生产寻路/质量门。
function fewestBattles(layer, li, target) {
  const cost = layer.nodes.map(() => Infinity);
  cost[layer.entry ?? layer.entrances[0]] = 0;
  for (let pass = 1; pass < layer.nodes.length; pass++) for (let at = 0; at < layer.nodes.length; at++) {
    for (const [to, next] of layer.nodes[at].next) if (to === li) {
      const type = layer.nodes[next].type ?? layer.nodes[next].def.type;
      cost[next] = Math.min(cost[next], cost[at] + Number(type === 'battle'));
    }
  }
  return cost[target];
}

describe('6/9 火堆最晚第二场普通战后可达', () => {
  it('最少战斗数按路径费用而非步数计算，忽略跨层边并支持候选战斗集合', () => {
    const types = ['entrance', 'battle', 'battle', 'battle', 'event', 'battle', 'fire', 'battle', 'event', 'event'];
    const layer = { entry: 0, nodes: types.map((type, idx) => ({ li: 2, idx, type, next: [] })) };
    for (const [a, b] of [[0, 1], [1, 2], [2, 3], [3, 6], [0, 4], [4, 5], [5, 7], [7, 8], [8, 6]]) {
      layer.nodes[a].next.push([2, b]); layer.nodes[b].next.push([2, a]);
    }
    layer.nodes[0].next.push([1, 6]);
    const before = JSON.stringify(layer);
    expect(fewestBattles(layer, 2, 6)).toBe(2);
    expect(minimumBattlesTo(layer, 6)).toBe(2);
    expect(minimumBattlesTo(layer, 6, new Set([1, 2, 3]))).toBe(0);
    expect(minimumBattlesTo(layer, 0)).toBe(0);
    expect(minimumBattlesTo(layer, 9)).toBe(Infinity);
    expect(JSON.stringify(layer)).toBe(before);
    expect(FIRE_BATTLE_LIMIT).toBe(2);
  });

  it('多种子经过真实 v1/v2 覆盖与快照最终门后，1/3层仍在两场普通战内到火堆', () => {
    const seeds = ['audit-map-20261017-3', ...Array.from({ length: 64 }, (_, i) => `fire-pacing-20261019-${i}`)];
    for (const seed of seeds) {
      const first = applyRouteOverlay({ generatorVersion: 6, layoutVersion: 9, layerData: createCurrentLayeredMap(seed) });
      expect(first.ok).toBe(true);
      const second = applyGuardedRoute({ generatorVersion: 6, layoutVersion: 9, layerData: first.value.layerData, baseRoutePlan: first.value.routePlan });
      expect(second.ok).toBe(true);
      const layers = rawLayers(second.value.layerData);
      for (const li of [0, 2]) {
        const fire = layers[li].nodes.find(node => node.type === 'fire');
        const count = fewestBattles(layers[li], li, fire.idx);
        expect(count).toBeLessThanOrEqual(2);
        if (li === 0) expect(count).toBeGreaterThanOrEqual(1);
        expect(minimumBattlesTo(layers[li], fire.idx)).toBe(count);
      }
      const made = createMapSnapshot({ mapSeed: seed, generatorVersion: 6, layoutVersion: 9, ...second.value });
      expect(made.ok).toBe(true);
      expect(validateMapSnapshot(made.value).ok).toBe(true);
    }
  });

  it('真实旧5迟到火堆快照按旧规则逐字恢复，伪装新6身份必须被拒', () => {
    expect(createHash('sha256').update(oldBytes).digest('hex')).toBe('0d576bfad4d8580be3b919e47dd0b0c5ef55d544b194e7f264e19c96654575ed');
    expect(oldSnapshot).toMatchObject({ mapSeed: 'audit-map-20261017-3', generatorVersion: 5, layoutVersion: 9, routeVersion: 'r5-routes-v2' });
    const layers = rawLayers(oldSnapshot.layers), fire = layers[2].nodes.find(node => node.type === 'fire');
    expect(fewestBattles(layers[2], 2, fire.idx)).toBe(3);
    expect(validateCurrentGeneratedMap(layers, MAP_TYPE_BUDGETS, false).ok).toBe(true);
    expect(validateCurrentGeneratedMap(layers).ok).toBe(false);
    const before = JSON.stringify(oldSnapshot);
    const restored = planMapRestore({ mapSeed: oldSnapshot.mapSeed, generatorVersion: 5, layoutVersion: 9,
      routeVersion: oldSnapshot.routeVersion, mapSnapshot: oldSnapshot, layerIdx: 2, trackPos: 0 });
    expect(restored.ok).toBe(true);
    expect(restored.value.generatorVersion).toBe(5);
    expect(JSON.stringify(createMapSnapshot(restored.value).value)).toBe(before);
    expect(JSON.stringify(oldSnapshot)).toBe(before);
    const forged = { ...structuredClone(oldSnapshot), generatorVersion: 6 };
    const forgedBefore = JSON.stringify(forged);
    expect(validateMapSnapshot(forged)).toMatchObject({ ok: false, code: 'INVALID_MAP_SNAPSHOT', preserveRun: true });
    expect(JSON.stringify(forged)).toBe(forgedBefore);
  });
});
