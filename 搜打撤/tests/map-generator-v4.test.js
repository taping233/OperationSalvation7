import { describe, expect, it } from 'vitest';
import { generateLayeredMap } from '../game/src/run/map-generator.js';
import { generateCurrentLayeredMap, MAX_CURRENT_MAP_ATTEMPTS } from '../game/src/run/map-generator-v4.js';
import { createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { validateCurrentGeneratedMap, MAP_TYPE_BUDGETS } from '../game/src/run/map-generation-rules.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { Random } from '../game/src/core/random.js';

// 独立断言不调用被测 validator 来证明其自身正确。
function assertRules(map) {
  expect(map).toMatchObject({ generatorVersion: 6, layoutVersion: 9 });
  expect(map.layers.map(layer => layer.nodes.length)).toEqual([7, 11, 16, 16]);
  expect(map.layers.map(layer => layer.nodes.filter(node => node.type === 'resource').length)).toEqual([0, 1, 1, 1]);
  expect(map.layers.map(layer => layer.nodes.filter(node => node.type === 'event').length)).toEqual([1, 2, 3, 2]);
  expect(map.layers.every(layer => layer.nodes.filter(node => node.type === 'chest').every(node => node.name.includes('搜刮点')))).toBe(true);
  map.layers.forEach((layer, li) => {
    const counts = {};
    const adjacent = idx => layer.nodes[idx].next.filter(([to]) => to === li).map(([, next]) => next);
    const distances = (start, blocked = new Set()) => {
      const result = new Map([[start, 0]]), queue = [start];
      for (let i = 0; i < queue.length; i++) for (const next of adjacent(queue[i])) {
        if (blocked.has(next) || result.has(next)) continue;
        result.set(next, result.get(queue[i]) + 1); queue.push(next);
      }
      return result;
    };
    for (const node of layer.nodes) {
      counts[node.type] = (counts[node.type] || 0) + 1;
      for (const [toLi, toIdx] of node.next) expect(map.layers[toLi].nodes[toIdx].next).toContainEqual([li, node.idx]);
      if (node.type === 'battle') expect(adjacent(node.idx).filter(idx => layer.nodes[idx].type === 'battle').length).toBeLessThanOrEqual(1);
    }
    expect(counts).toEqual(MAP_TYPE_BUDGETS[li]);
    expect(distances(layer.entry).size).toBe(layer.nodes.length);
    const fire = layer.nodes.find(node => node.type === 'fire'), shop = layer.nodes.find(node => node.type === 'shop');
    const facility = li % 2 === 0 ? fire : shop;
    expect(layer.nodes.filter(node => node.type === 'fire')).toHaveLength(li % 2 === 0 ? 1 : 0);
    expect(layer.nodes.filter(node => node.type === 'shop')).toHaveLength(li % 2 === 0 ? 0 : 1);
    expect(facility.x).toBeGreaterThanOrEqual(li === 0 ? 1 : 2);
    if (fire) {
      // 独立按边反复松弛：路径花费是经过的普通战斗数，不是移动步数。
      const costs = layer.nodes.map(() => Infinity); costs[layer.entry] = 0;
      for (let pass = 1; pass < layer.nodes.length; pass++) for (const node of layer.nodes) {
        for (const next of adjacent(node.idx)) costs[next] = Math.min(costs[next], costs[node.idx] + Number(layer.nodes[next].type === 'battle'));
      }
      expect(costs[fire.idx]).toBeLessThanOrEqual(2);
      if (li === 0) expect(costs[fire.idx]).toBeGreaterThanOrEqual(1);
    }
    if (li === 0) expect(distances(layer.entry, new Set(layer.nodes.filter(node => node.type === 'battle').map(node => node.idx))).has(fire.idx)).toBe(false);
    if (li === 2) expect(layer.nodes.find(node => node.type === 'emergencyExit').x).toBeGreaterThanOrEqual(4);
    if (li === 3) {
      const d = distances(layer.entry), altar = layer.nodes.find(node => node.type === 'altar'), boss = layer.nodes.find(node => node.type === 'boss');
      expect(d.get(altar.idx)).toBeLessThan(d.get(boss.idx));
      expect(d.get(boss.idx)).toBeLessThan(d.get(layer.exit));
      expect(distances(altar.idx, new Set([layer.exit])).has(boss.idx)).toBe(true);
    }
  });
}

describe('6/9 新局约束生成', () => {
  it.each([0, 24, 625, 1884, 4])('旧反例 %s 在新版本满足全部约束', number => {
    const seed = `audit-map-20261017-${number}`, map = generateCurrentLayeredMap(seed);
    assertRules(map);
    expect(validateCurrentGeneratedMap(map.layers)).toEqual({ ok: true, issues: [] });
  });

  it('500种子独立验证删格后数量/间距/连战/真实图距离，保留幸存节点坐标和边', () => {
    for (let i = 0; i < 500; i++) {
      const seed = `v4-contract-${i}`, map = generateCurrentLayeredMap(seed);
      assertRules(map);
      if (map.generation.attempts === 1) {
        const old = generateLayeredMap(seed);
        map.layers.forEach((layer, li) => layer.nodes.forEach(node => {
          const source = old.layers[li].nodes.find(item => item.id === node.id);
          expect([node.x, node.row]).toEqual([source.x, source.row]);
          const edges = source.next.filter(([to, idx]) => map.layers[to].nodes.some(item => item.id === old.layers[to].nodes[idx].id))
            .map(([to, idx]) => [to, map.layers[to].nodes.findIndex(item => item.id === old.layers[to].nodes[idx].id)]);
          expect(node.next).toEqual(edges);
        }));
      }
    }
  });

  it('已满足新规则的候选保留类型位置', () => {
    const original = generateCurrentLayeredMap('facility-valid');
    const current = generateCurrentLayeredMap('facility-valid', () => original.layers);
    expect(current.layers).toEqual(original.layers);
  });

  it('同seed逐字稳定，不消费对局任何命名随机流', () => {
    Random.reseed(781); Random.random('gameplay'); Random.random('enemy');
    const before = Random.snapshot(), first = generateCurrentLayeredMap('v4-repeat');
    expect(generateCurrentLayeredMap('v4-repeat')).toEqual(first);
    expect(Random.snapshot()).toEqual(before);
  });

  it('固定无解几何被拒收，第二候选确定性成功且不修改注入原图', () => {
    const impossible = [];
    const valid = generateLayeredMap('v4-retry-valid').layers, before = JSON.stringify(impossible), calls = [];
    const map = generateCurrentLayeredMap('v4-injected', (seed, attempt) => { calls.push([seed, attempt]); return attempt ? valid : impossible; });
    expect(calls).toEqual([['v4-injected', 0], ['v4-injected', 1]]);
    expect(map.generation).toEqual({ attempts: 2, fallback: false });
    expect(JSON.stringify(impossible)).toBe(before); assertRules(map);
  });

  it.each(['throw', 'invalid'])('候选源持续%s时有界回退，保底仍满足同一质量门', mode => {
    let calls = 0;
    const map = generateCurrentLayeredMap(`v4-fallback-${mode}`, () => {
      calls++; if (mode === 'throw') throw new Error('injected'); return [];
    });
    expect(calls).toBe(MAX_CURRENT_MAP_ATTEMPTS);
    expect(map.generation).toEqual({ attempts: MAX_CURRENT_MAP_ATTEMPTS, fallback: true });
    assertRules(map);
  });

  it('最终quality独立拒绝旧设施/连战/撤离/终局反例', () => {
    const expected = [[0, '火堆与补给站相邻'], [24, '连续三场战斗'], [625, 'shop 配额异常'], [1884, '紧急撤离点不在深区'], [4, '图距离顺序无效']];
    for (const [number, fragment] of expected) {
      const result = validateCurrentGeneratedMap(generateLayeredMap(`audit-map-20261017-${number}`).layers);
      expect(result.ok).toBe(false); expect(result.issues.some(issue => issue.includes(fragment))).toBe(true);
    }
  });

  it('后置路线覆盖成功与回退都保持完整新规则和原预算', () => {
    const statuses = new Set();
    for (let i = 0; i < 100; i++) {
      const base = createCurrentLayeredMap(`v4-overlay-${i}`);
      const result = applyRouteOverlay({ generatorVersion: 6, layoutVersion: 9, layerData: base });
      expect(result.ok).toBe(true); statuses.add(result.value.status);
      const layers = result.value.layerData.map(layer => ({ ...layer, entry: layer.entrances[0] }));
      assertRules({ generatorVersion: 6, layoutVersion: 9, layers });
      expect(validateCurrentGeneratedMap(layers).ok).toBe(true);
    }
    expect([...statuses].sort()).toEqual(['applied', 'fallback']);
  });
});
