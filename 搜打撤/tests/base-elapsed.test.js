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
  Base.data.stats.playSeconds = 100;
  expect(Base.save()).toBe(true);
});

afterEach(() => vi.restoreAllMocks());

describe('Base elapsed commands', () => {
  it('sync increments and persists once, reporting the checkpoint', () => {
    const original = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      return original.call(this, key, value);
    });

    expect(Base.syncPlayTime(35, 25)).toEqual({ changed: true, delta: 10, checkpoint: 35, persisted: true });
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(JSON.parse(localStorage.getItem(slotKey)).stats.playSeconds).toBe(110);
    expect(setItem.mock.calls.filter(([key]) => key === slotKey)).toHaveLength(1);
  });

  it('write failure advances memory and checkpoint once; same elapsed does not double count', () => {
    const savedBefore = localStorage.getItem(slotKey);
    const original = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      if (key === slotKey) throw new Error('quota');
      return original.call(this, key, value);
    });

    expect(Base.syncPlayTime(35, 25)).toEqual({ changed: true, delta: 10, checkpoint: 35, persisted: false });
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(localStorage.getItem(slotKey)).toBe(savedBefore);
    expect(Base.syncPlayTime(35, 35)).toEqual({ changed: false, delta: 0, checkpoint: 35 });
    expect(setItem.mock.calls.filter(([key]) => key === slotKey)).toHaveLength(1);

    setItem.mockRestore();
    expect(Base.save()).toBe(true);
    expect(JSON.parse(localStorage.getItem(slotKey)).stats.playSeconds).toBe(110);
  });

  it('elapsed 回退或未变化时不写盘、不改累计值', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(Base.syncPlayTime(20, 25)).toEqual({ changed: false, delta: 0, checkpoint: 25 });
    expect(Base.data.stats.playSeconds).toBe(100);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('旧档 migration 按 max 语义补齐并只在实际提升时写盘', () => {
    const original = Storage.prototype.setItem;
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (key, value) {
      return original.call(this, key, value);
    });

    expect(Base.migrateElapsed(80)).toEqual({ changed: false, checkpoint: 80 });
    expect(Base.migrateElapsed(120)).toEqual({ changed: true, checkpoint: 120, persisted: true });
    expect(Base.data.stats.playSeconds).toBe(120);
    expect(JSON.parse(localStorage.getItem(slotKey)).stats.playSeconds).toBe(120);
    expect(setItem.mock.calls.filter(([key]) => key === slotKey)).toHaveLength(1);
  });

  it('没有活动档位时仅更新内存并明确未持久化', () => {
    Base.use(null);
    Base.data.stats.playSeconds = 100;
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(Base.syncPlayTime(35, 25)).toEqual({ changed: true, delta: 10, checkpoint: 35, persisted: false });
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(setItem).not.toHaveBeenCalled();
  });

  it('Infinity-Infinity 差值为 NaN 时不写盘、不污染累计值', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');

    expect(Base.syncPlayTime(Infinity, Infinity)).toEqual({ changed: false, delta: 0, checkpoint: Infinity });
    expect(Base.data.stats.playSeconds).toBe(100);
    expect(setItem).not.toHaveBeenCalled();
  });
});
