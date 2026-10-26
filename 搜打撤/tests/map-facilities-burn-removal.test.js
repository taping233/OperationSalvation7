// @vitest-environment node
import { expect, it } from 'vitest';
import * as Combat from '../game/src/battle/core/combat.js';
import { generateCurrentLayeredMap } from '../game/src/run/map-generator-v4.js';
import { createLayeredMap } from '../game/src/run/layeredMap.js';
import { validateCurrentGeneratedMap, PREVIOUS_MAP_TYPE_BUDGETS } from '../game/src/run/map-generation-rules.js';
import { createMapSnapshot, validateMapSnapshot } from '../game/src/run/map-snapshot.js';
import { readFileSync } from 'node:fs';

it('新局四层各仅一个交替设施，节点数与可达性保留', () => {
  for (let seed = 0; seed < 100; seed++) {
    const map = generateCurrentLayeredMap(`alternating-${seed}`);
    expect(map.layers.map(layer => layer.nodes.length)).toEqual([7, 11, 16, 16]);
    expect(map.layers.map(layer => layer.nodes.filter(n => n.type === 'fire').length)).toEqual([1, 0, 1, 0]);
    expect(map.layers.map(layer => layer.nodes.filter(n => n.type === 'shop').length)).toEqual([0, 1, 0, 1]);
    expect(validateCurrentGeneratedMap(map.layers).ok).toBe(true);
  }
});

it('旧4/9双设施存档保持原地图并可恢复，新配额不回写旧存档', () => {
  let old;
  for (let seed = 0; seed < 100; seed++) {
    const layers = createLayeredMap(`audit-map-20261017-${seed}`);
    const raw = layers.map(layer => ({ ...layer, entry: layer.entrances[0] }));
    if (validateCurrentGeneratedMap(raw, PREVIOUS_MAP_TYPE_BUDGETS, false).ok) { old = layers; break; }
  }
  expect(old).toBeDefined();
  const made = createMapSnapshot({mapSeed:'old-facilities', generatorVersion:4, layoutVersion:9, layerData:old});
  expect(made.ok).toBe(true);
  const before = JSON.stringify(made.value);
  expect(validateMapSnapshot(made.value).ok).toBe(true);
  expect(JSON.stringify(made.value)).toBe(before);
  expect(made.value.layers.every(layer => layer.nodes.some(n => n.def.type === 'fire') && layer.nodes.some(n => n.def.type === 'shop'))).toBe(true);
});

it('灼烧不可施加，旧状态不计入诅咒且不造成回合末伤害', () => {
  const target = {hp:20, status:{burn:3, poison:2}};
  expect(Combat.CURSES).not.toContain('burn');
  expect(Combat.CURSE_META.burn).toBeUndefined();
  expect(Combat.addCurse(target, 'burn', 2)).toBe(0);
  expect(Combat.hasCurse({status:{burn:3}})).toBe(false);
  expect(Combat.tickPoison(target).dealt).toBe(2);
  expect(target.hp).toBe(18);
  expect(target.status.burn).toBeUndefined();
});

it('敌人数据不再赋予灼烧，玩家词条字典无灼烧入口', () => {
  const map = JSON.parse(readFileSync('game/data/map.json', 'utf8'));
  expect(Object.keys(map.monsters).length).toBeGreaterThan(0);
  expect(Object.values(map.monsters).every(foe => foe.behavior !== 'burn')).toBe(true);
  expect(readFileSync('game/data/map.json', 'utf8')).not.toContain('"behavior": "burn"');
  for (const file of ['term-tips.js', 'term-tips.runtime.js']) {
    expect(readFileSync(`game/src/ui/${file}`, 'utf8')).not.toContain('灼烧');
  }
});
