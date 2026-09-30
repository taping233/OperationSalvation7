import { describe, expect, it } from 'vitest';
import { hashSeed, nextRandom } from '../game/src/core/random-core.js';
import { generateLayeredMap, GENERATOR_VERSION, LAYOUT_VERSION } from '../game/src/run/map-generator.js';

// RNG 核心位等价钉（2026-09-28 代码线收敛）：map-generator 此前逐字复制
// core/random 的 hashSeed + sfc32 步进算法。收敛后唯一实现=random-core.js
// （零依赖件，刻意不触 sdt-facade）；本测试用收敛前的参考实现逐位对照，
// 防止抽取引入任何数值漂移——地图可复现契约（generatorVersion=3/layoutVersion=9）依赖它。

const UINT32_RANGE = 0x100000000;
const STEP = 0x6D2B79F5;

// —— 参考实现（收敛前 map-generator.js 的原实现，逐字符保留）——
function refHashSeed(value) { const text = String(value); let hash = 2166136261;
  for (let i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0; }
function refRng(seed) { let state = refHashSeed(seed) || 0x9e3779b9; return () => { state = (state + STEP) >>> 0;
  let value = state; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE; }; }

// —— 参考实现（收敛前 core/random.js 的流式原实现）——
function refStreamRandom(seed, key) {
  let state = refHashSeed(`${seed}:${key}`);
  return () => {
    state = (state + STEP) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

describe('RNG 核心位等价（map-generator ↔ core/random 收敛）', () => {
  const seeds = ['abc', 0, 1, 12345, 'seed-42', '', '埋点:gameplay'];

  it.each(seeds.map(s => [String(s), s]))('hashSeed 逐位一致：%s', (_label, seed) => {
    expect(hashSeed(seed)).toBe(refHashSeed(seed));
  });

  it.each(seeds.map(s => [String(s), s]))('步进序列 1000 位逐位一致：%s', (_label, seed) => {
    const ref = refRng(seed);
    let state = hashSeed(seed) || 0x9e3779b9;
    for (let i = 0; i < 1000; i++) {
      const step = nextRandom(state);
      state = step.state;
      expect(step.value).toBe(ref());
    }
  });

  it('core 流式口径（流名盐）与参考实现逐位一致', () => {
    const ref = refStreamRandom(777, 'gameplay');
    let state = hashSeed('777:gameplay');
    for (let i = 0; i < 500; i++) {
      const step = nextRandom(state);
      state = step.state;
      expect(step.value).toBe(ref());
    }
  });

  it('黄金值：seed=42 的前三个数（防常数漂移）', () => {
    let state = hashSeed(42) || 0x9e3779b9;
    const values = [];
    for (let i = 0; i < 3; i++) { const step = nextRandom(state); state = step.state; values.push(step.value); }
    const ref = refRng(42);
    expect(values).toEqual([ref(), ref(), ref()]);
  });

  it('地图生成端到端：委托后 v3/9 生成器产物结构不变', () => {
    const map = generateLayeredMap('bit-eq-check');
    expect(map.layers).toHaveLength(4);
    expect(GENERATOR_VERSION).toBe(3);
    expect(LAYOUT_VERSION).toBe(9);
    for (const layer of map.layers) {
      expect(layer.nodes.length).toBeGreaterThan(0);
      for (const n of layer.nodes) {
        expect(Number.isInteger(n.idx)).toBe(true);
        expect(Array.isArray(n.next)).toBe(true);
      }
    }
  });
});
