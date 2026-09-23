import { describe, expect, it } from 'vitest';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { generateLayeredMap, validateGeneratedMap } from '../game/src/run/map-generator.js';
import { checkConnectivity } from '../game/src/run/map-graph.js';

describe('四层种子化地图生成器', () => {
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
    expect(map.layers).toHaveLength(4);
    expect(map.generatorVersion).toBe(3);
    expect(map.layoutVersion).toBe(9);   // v9：2026-09-19 关卡审查——L3 紧急撤离点改落层后半段（x≥4）
    expect(validateGeneratedMap(map.layers).ok).toBe(true);
    expect(checkConnectivity(createLayeredMap(20260908)).ok).toBe(true);
    for (let seed = 0; seed < 100; seed++) {
      const batch = generateLayeredMap(`batch-${seed}`);
      expect(batch.layers.map(layer => layer.nodes.length)).toEqual([7, 12, 17, 17]);   // Item 17：L2=12（=L3 配置总量）、L4=17（终局链+分层配额）
      expect(validateGeneratedMap(batch.layers).ok).toBe(true);
      expect(batch.layers.every(layer => layer.gridBounds && layer.gridBounds.maxX > layer.gridBounds.minX)).toBe(true);
    }
  });

  it('格子数量定版（2026-09-10）：每层物资格 1~4 个、野生敌人格 ≤4（200 种子）', () => {
    for (let seed = 0; seed < 200; seed++) {
      const map = generateLayeredMap(`quota-${seed}`);
      map.layers.forEach((layer, li) => {
        const chests = layer.nodes.filter(n => n.type === 'chest').length;
        const battles = layer.nodes.filter(n => n.type === 'battle').length;
        const events = layer.nodes.filter(n => n.type === 'event').length;
        expect(chests, `seed=${seed} 第${li + 1}层物资格数量异常`).toBeGreaterThanOrEqual(1);
        expect(chests, `seed=${seed} 第${li + 1}层宝箱格超过 4`).toBeLessThanOrEqual(4);
        expect(battles, `seed=${seed} 第${li + 1}层敌人格超过 4`).toBeLessThanOrEqual(4);
        // 2026-09-13：每层事件格 ≤3（第 3 层受战斗/搜刮上限约束结构性最少 4 个，放宽到 ≤4）
        expect(events, `seed=${seed} 第${li + 1}层事件格超过 ${li === 2 ? 4 : 3}`).toBeLessThanOrEqual(li === 2 ? 4 : 3);
      });
    }
  });

  it('层间门双向连接且终层有撤离点', () => {
    const map = createLayeredMap(7);
    expect(map.slice(0, 3).every(layer => layer.doors.length === 1)).toBe(true);
    expect(map[3].nodes.some(node => node.type === 'extraction')).toBe(true);
    for (let li = 0; li < 3; li++) {
      const door = map[li].doors[0];
      expect(map[li].logical[door.at].next).toContainEqual([door.toLayer, door.arriveAt]);
      expect(map[door.toLayer].logical[door.arriveAt].next).toContainEqual([li, door.at]);
    }
  });

  it('第四层「祭坛 → 首脑」终局组合：各恰好 1 格且祭坛在首脑之前（2026-09-09 玩法定版）', () => {
    for (let seed = 0; seed < 60; seed++) {
      const map = generateLayeredMap(`finale-${seed}`);
      const l4 = map.layers[3];
      const altars = l4.nodes.filter(n => n.type === 'altar');
      const bosses = l4.nodes.filter(n => n.type === 'boss');
      expect(altars, `seed=${seed} 祭坛格数量异常`).toHaveLength(1);
      expect(bosses, `seed=${seed} 首脑格数量异常`).toHaveLength(1);
      // 祭坛在首脑之前：按纵深 (x, row) 排序祭坛严格先于首脑（同层两格可能同 x 不同 row）
      const depth = (n) => n.x * 100 + (n.row + 3);
      expect(depth(altars[0]), `seed=${seed} 祭坛未在首脑之前`).toBeLessThan(depth(bosses[0]));
      expect(validateGeneratedMap(map.layers).ok).toBe(true);
    }
  });

  it('紧急撤离点只出现在第三层（2026-09-09 撤离定版）', () => {
    for (let seed = 0; seed < 40; seed++) {
      const map = generateLayeredMap(`exit-${seed}`);
      map.layers.forEach((layer, li) => {
        const exits = layer.nodes.filter(n => n.type === 'emergencyExit');
        if (li === 2) expect(exits.length, `seed=${seed} 第三层缺紧急撤离点`).toBeGreaterThanOrEqual(1);
        else expect(exits.length, `seed=${seed} 第${li + 1}层不应有紧急撤离点`).toBe(0);
      });
    }
  });

  it('保底房间：每层至少 1 火堆 1 补给站，功能房不与同类相邻（2026-09-09 试玩反馈）', () => {
    const isAdj = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.row - b.row) === 1;
    for (let seed = 0; seed < 60; seed++) {
      const map = generateLayeredMap(`pity-${seed}`);
      for (const layer of map.layers) {
        expect(layer.nodes.some(n => n.type === 'fire'), `seed=${seed} 缺火堆`).toBe(true);
        expect(layer.nodes.some(n => n.type === 'shop'), `seed=${seed} 缺补给站`).toBe(true);
        for (let a = 0; a < layer.nodes.length; a++) {
          for (let b = a + 1; b < layer.nodes.length; b++) {
            const same = layer.nodes[a].type === layer.nodes[b].type && (layer.nodes[a].type === 'fire' || layer.nodes[a].type === 'shop');
            expect(same && isAdj(layer.nodes[a], layer.nodes[b]), `seed=${seed} 同类功能房扎堆 @${a},${b}`).toBe(false);
          }
        }
      }
    }
  });
});
