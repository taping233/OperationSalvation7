// 夜班 U4 守卫测试（2026-09-29）：两条 P3 健壮性收口。
// U4-a：effect-steps.m2 resolveCopyRandom 拒绝缺 deps.random 的装配（战斗随机必须走
//       battle 种子流，消灭 `|| Math.random` 静默退化口）。
// U4-b：versioned-slot-reader 迁移链完整性装载校验（maxVersion+1 忘写迁移函数时装配期
//       显式炸出，不再静默跳级盖章）；另附「正常链路不受影响」回归。
// 姿势对齐 m2-contract.test.js「M2 unit helpers」：直调 + 手搓最小 deps。
import { afterEach, describe, expect, it } from 'vitest';
import { resolveCopyRandom } from '../game/src/battle/effects/effect-steps.m2.js';
import { set$hand } from '../game/src/battle/runtime/battle.runtime.piles.js';
import { createVersionedSlotReader } from '../game/src/hub/versioned-slot-reader.js';

const esc = v => String(v);
const log = () => {};

describe('U4-a copyRandom 随机退化口守卫', () => {
  afterEach(() => set$hand([]));

  it('deps 未注入 random 时显式 throw，不再静默退化到 Math.random', () => {
    set$hand(['u4a-uid-1']);   // 手牌非空才会走到随机选取口
    const deps = { findCard: () => null, addTempCard: () => {}, log, esc };
    expect(() => resolveCopyRandom({ name: '守卫牌' }, deps))
      .toThrow(/deps\.random 未注入/);
  });

  it('回归：注入 random 后复制链路正常（守卫不拦正常装配）', () => {
    const card = { name: '被复制牌' };
    set$hand(['u4a-uid-2']);
    const added = [];
    const deps = {
      random: () => 0,                       // 恒选第一张
      findCard: uid => ({ uid, card }),
      addTempCard: c => added.push(c),
      log, esc,
    };
    expect(resolveCopyRandom({ name: '守卫牌' }, deps)).toBe(true);
    expect(added).toEqual([card]);
  });
});

describe('U4-b 迁移链完整性装载校验', () => {
  const versionOf = (d) => {
    const v = Object.hasOwn(d, 'version') ? d.version : 0;
    return Number.isInteger(v) && v >= 0 ? v : NaN;
  };
  const make = (overrides = {}) => createVersionedSlotReader({
    logTag: '[test]',
    maxVersion: 2,
    migrations: { 1: d => { d.migrated = true; return d; } },
    corruptKeyFor: i => `u4b-corrupt-${i}`,
    versionOf,
    rejectArrays: true,
    ...overrides,
  });

  it('模拟 maxVersion+1 忘写迁移函数：装配期显式炸出（缺末级 2→3）', () => {
    expect(() => make({ maxVersion: 3, migrations: { 1: d => d } }))
      .toThrow(/迁移表断链.*2→3/);
  });

  it('缺中间档同样炸出（1→2 缺失）', () => {
    expect(() => make({ maxVersion: 3, migrations: { 2: d => d } }))
      .toThrow(/迁移表断链.*1→2/);
  });

  it('回归：迁移链完整时读档行为不变——v0 老档盖章迁移、v1 档迁移、当前版直读', () => {
    const r = make();
    // v0 老档（无 version 字段）：0→1 仅盖章（迁移表按约定不设 0 号键）→ 1→2 迁移
    expect(r.parse(1, JSON.stringify({ hp: 10 }))).toEqual({ hp: 10, migrated: true, version: 2 });
    expect(r.issue(1)).toBeNull();
    // v1 档：走 1→2 迁移
    expect(r.parse(2, JSON.stringify({ version: 1, hp: 5 }))).toEqual({ version: 2, hp: 5, migrated: true });
    // 当前版本档：不进迁移循环，原样返回
    expect(r.parse(3, JSON.stringify({ version: 2, hp: 7 }))).toEqual({ version: 2, hp: 7 });
  });
});
