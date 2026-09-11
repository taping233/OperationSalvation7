/* 敌人数量生成规则（2026-09-10 定版）：
 * 1) 每层每种敌人的数量区间一律落在 1~3 只之间；
 * 2) 区间内每个数量等概率生成——1-3 出 1/2/3 各约 1/3，2-3 出 2/3 各约 1/2。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || {};
await import('../game/src/rules.js');
await import('../game/src/mapData.js');
const MAP = window.SDT.MAP;

beforeAll(() => { /* mapData 只依赖 rules 副本，无需额外准备 */ });

// 确定性 LCG，避免统计测试抖动
function lcg(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; }; }

describe('遭遇表数量区间（2026-09-10 定版）', () => {
  it('每层每种敌人的数量区间都落在 1~3 只之间', () => {
    MAP.encounters.forEach((enc, li) => {
      (enc.entries || []).forEach(ent => {
        const [min, max] = ent.size;
        expect(min, `第${li + 1}层 ${ent.id} 数量下限`).toBeGreaterThanOrEqual(1);
        expect(max, `第${li + 1}层 ${ent.id} 数量上限`).toBeLessThanOrEqual(3);
        expect(min, `第${li + 1}层 ${ent.id} 区间非法`).toBeLessThanOrEqual(max);
      });
    });
  });

  it('rollCount 在区间内等概率取数：1-3 各约 1/3，2-3 各约 1/2', () => {
    const check = (size, expected) => {
      const rand = lcg(0x5eed1234);
      const N = 60000;
      const counts = new Map(expected.map(n => [n, 0]));
      let outOfRange = 0;
      for (let i = 0; i < N; i++) {
        const n = MAP.rollCount(size, rand);
        if (counts.has(n)) counts.set(n, counts.get(n) + 1); else outOfRange++;
      }
      expect(outOfRange, `rollCount(${size}) 出了区间外的数 ${outOfRange} 次`).toBe(0);
      const p = 1 / expected.length;
      for (const [n, count] of counts) {
        const ratio = count / N;
        expect(Math.abs(ratio - p), `rollCount(${size}) 出 ${n} 的频率 ${ratio.toFixed(4)} 偏离 ${p.toFixed(4)}`).toBeLessThan(0.02);
      }
    };
    check([1, 3], [1, 2, 3]);
    check([2, 3], [2, 3]);
    check([1, 2], [1, 2]);
  }, 20000);
});
