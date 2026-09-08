import { describe, expect, it } from 'vitest';
import { createLayeredMap } from '../game/src/layeredMap.js';
import { generateLayeredMap, validateGeneratedMap } from '../game/src/map-generator.js';
import { checkConnectivity } from '../game/src/map-graph.js';

describe('五层种子化地图生成器', () => {
  it('同 seed 生成完全一致的拓扑与坐标', () => {
    expect(generateLayeredMap('forest-42')).toEqual(generateLayeredMap('forest-42'));
  });

  it('不同 seed 会改变至少一处布局', () => {
    const a = JSON.stringify(generateLayeredMap('forest-a').layers);
    const b = JSON.stringify(generateLayeredMap('forest-b').layers);
    expect(a).not.toBe(b);
    const shapes = new Set(Array.from({ length: 100 }, (_, seed) =>
      JSON.stringify(generateLayeredMap(`shape-${seed}`).layers.map(layer => layer.nodes.map(node => [node.x, node.row])))));
    expect(shapes.size).toBeGreaterThan(80);
  });

  it('批量生成100个 seed，全部通过质量校验并保持规模', () => {
    const map = generateLayeredMap(20260908);
    expect(map.layers).toHaveLength(5);
    expect(map.generatorVersion).toBe(2);
    expect(map.layoutVersion).toBe(2);
    expect(validateGeneratedMap(map.layers).ok).toBe(true);
    expect(checkConnectivity(createLayeredMap(20260908)).ok).toBe(true);
    for (let seed = 0; seed < 100; seed++) {
      const batch = generateLayeredMap(`batch-${seed}`);
      expect(batch.layers.map(layer => layer.nodes.length)).toEqual([13, 15, 17, 15, 13]);
      expect(validateGeneratedMap(batch.layers).ok).toBe(true);
      expect(batch.layers.every(layer => layer.gridBounds && layer.gridBounds.maxX > layer.gridBounds.minX)).toBe(true);
    }
  });

  it('层间门双向连接且终层有撤离点', () => {
    const map = createLayeredMap(7);
    expect(map.slice(0, 4).every(layer => layer.doors.length === 1)).toBe(true);
    expect(map[4].nodes.some(node => node.type === 'extraction')).toBe(true);
    for (let li = 0; li < 4; li++) {
      const door = map[li].doors[0];
      expect(map[li].logical[door.at].next).toContainEqual([door.toLayer, door.arriveAt]);
      expect(map[door.toLayer].logical[door.arriveAt].next).toContainEqual([li, door.at]);
    }
  });
});
