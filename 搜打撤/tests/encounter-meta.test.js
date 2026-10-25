import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { encounterPoolMeta, layerEncounterMeta } from '../game/src/run/encounter-meta.js';

// CODE-003 遭遇池元数据钉（2026-09-28 代码线）：只读、零依赖、层回退镜像
// buildEncounter（[layerIdx] || [0]）；eliteChance 只揭示不掷骰。

const map = JSON.parse(readFileSync(resolve(process.cwd(), 'game/data/map.json'), 'utf8'));

describe('encounter-meta 遭遇池元数据', () => {
  it('四层表各自出数：risk/精英概率/组数与真实数据一致', () => {
    const risks = [0, 1, 2, 3].map(li => layerEncounterMeta(map, li).risk);
    expect(risks).toEqual(['低', '中', '高', '极高']);
    expect(layerEncounterMeta(map, 1).eliteChance).toBe(1);
    expect(layerEncounterMeta(map, 2).eliteChance).toBe(1);
    expect(layerEncounterMeta(map, 3).eliteChance).toBe(1);
    expect(layerEncounterMeta(map, 0).eliteChance).toBe(0);
    expect(layerEncounterMeta(map, 1).groupCount).toBe(1);
  });

  it('越界层回退第 0 层（镜像引擎口径）', () => {
    expect(layerEncounterMeta(map, 9).risk).toBe('低');
    expect(layerEncounterMeta(map, 9)).toEqual(layerEncounterMeta(map, 0));
  });

  it('敌 id 经 monsters 表映射为名；缺失表返回 null 供展示层降级', () => {
    const meta = layerEncounterMeta(map, 0);
    for (const entry of meta.entries) {
      expect(typeof entry.name).toBe('string');
      expect(entry.name.length).toBeGreaterThan(0);
    }
    expect(layerEncounterMeta({}, 0)).toBeNull();
    expect(encounterPoolMeta(null, map.monsters)).toBeNull();
  });

  it('纯只读：不修改传入对象', () => {
    const snapshot = JSON.stringify(map.encounters);
    layerEncounterMeta(map, 1);
    expect(JSON.stringify(map.encounters)).toBe(snapshot);
  });
});
