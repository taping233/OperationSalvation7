import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/hub/base.js');
const Base = window.SDT.Base;
const slotKey = Base.SLOT_KEY(1);

beforeEach(() => {
  localStorage.clear();
  window.SDT.MAP = { rules: RULES };
  window.SDT.UI = { log: vi.fn() };
  Base.use(1);
  expect(Base.save()).toBe(true);
});

afterEach(() => vi.restoreAllMocks());

describe('Base 宠物蛋保底命令', () => {
  it('固定基础概率不受未出次数或战斗次数影响，第 150 次宝箱奖励触发硬保底', () => {
    Base.data.eggPity = 40;
    Base.data.eggBattles = 500;
    expect(Base.petEggDropChance()).toBe(RULES.rewards.petEggBaseChance);
    Base.data.eggPity = 148;
    expect(Base.petEggDropChance()).toBe(RULES.rewards.petEggBaseChance);
    Base.data.eggPity = 149;
    expect(Base.petEggDropChance()).toBe(1);
  });

  it('保存成功时只推进并落盘一次', () => {
    Base.data.eggPity = 2;
    expect(Base.save()).toBe(true);
    const original = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      return original.call(this, key, value);
    });

    expect(Base.recordPetEggChestResult({ eggGranted: false })).toEqual({ eggPity: 3, persisted: true });
    expect(Base.data.eggPity).toBe(3);
    expect(JSON.parse(localStorage.getItem(slotKey)).eggPity).toBe(3);
    expect(setItem.mock.calls.filter(([key]) => key === slotKey)).toHaveLength(1);
  });

  it('存档写失败时明确返回未持久化，仍保留旧版内存推进且不改存档', () => {
    Base.data.eggPity = 4;
    expect(Base.save()).toBe(true);
    const savedBefore = localStorage.getItem(slotKey);
    const original = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === slotKey) throw new Error('quota');
      return original.call(this, key, value);
    });

    expect(Base.recordPetEggChestResult({ eggGranted: false })).toEqual({ eggPity: 5, persisted: false });
    expect(Base.data.eggPity).toBe(5);
    expect(localStorage.getItem(slotKey)).toBe(savedBefore);
  });

  it('未来版本存档受保护时只在内存推进，不覆盖原始存档', () => {
    const protectedRaw = JSON.stringify({ version: Base.BASE_VERSION + 1, eggPity: 8 });
    localStorage.setItem(slotKey, protectedRaw);
    Base.use(1);

    expect(Base.recordPetEggChestResult({ eggGranted: false })).toEqual({ eggPity: 1, persisted: false });
    expect(Base.data.eggPity).toBe(1);
    expect(localStorage.getItem(slotKey)).toBe(protectedRaw);
  });

  it('未选择档位时仅推进内存且不尝试写盘', () => {
    Base.use(null);
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(Base.recordPetEggChestResult({ eggGranted: false })).toEqual({ eggPity: 1, persisted: false });
    expect(Base.data.eggPity).toBe(1);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('只有实际加入蛋时归零；缺蛋或重复未加入都累加 pity', () => {
    Base.data.eggPity = 6;
    expect(Base.recordPetEggChestResult({ eggGranted: false })).toEqual({ eggPity: 7, persisted: true });
    expect(Base.recordPetEggChestResult({ eggGranted: true })).toEqual({ eggPity: 0, persisted: true });
    expect(Base.data.eggPity).toBe(0);
  });

  it('第 149 次未出后第 150 次奖励必出，提前实际加入蛋后重新从基础概率计数', () => {
    Base.data.eggPity = 148;
    expect(Base.petEggDropChance()).toBe(RULES.rewards.petEggBaseChance);
    expect(Base.recordPetEggChestResult({ eggGranted: false }).eggPity).toBe(149);
    expect(Base.petEggDropChance()).toBe(1);
    expect(Base.recordPetEggChestResult({ eggGranted: true }).eggPity).toBe(0);
    expect(Base.petEggDropChance()).toBe(RULES.rewards.petEggBaseChance);
  });
});
