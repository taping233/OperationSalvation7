import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RULES } from '../game/src/core/rules.js';

window.SDT = window.SDT || {};
window.SDT.MAP = { rules: RULES };
window.SDT.UI = { log: vi.fn() };
await import('../game/src/hub/base.js');
const { Base } = window.SDT;
const key = Base.SLOT_KEY(1);
const persisted = () => JSON.parse(localStorage.getItem(key));
let fixtureSequence = 0;

function seed() {
  localStorage.setItem(key, JSON.stringify({ version: Base.BASE_VERSION, fixtureSequence: ++fixtureSequence, coins: 100,
    stash: [{ card: { id: 'snapshot-card', name: '档案卡' }, count: 2 }], pocket: [],
    stats: { playSeconds: 100 }, pets: { dog: { lv: 1, ts: 0 } }, petSel: 'dog',
    _m01: { revision: 4, requests: {} } }));
  Base.use(1);
}

function blockSave() {
  const original = Storage.prototype.setItem;
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) {
    if (name === key) throw new Error('fixture write failure');
    return original.call(this, name, value);
  });
}

beforeEach(() => { localStorage.clear(); seed(); });
afterEach(() => vi.restoreAllMocks());

describe('基地持久快照与运行内存隔离', () => {
  it('切到另一档再返回不能带回未保存的嵌套进度，也不改另一档', () => {
    const otherKey = Base.SLOT_KEY(2);
    const other = JSON.stringify({ version: Base.BASE_VERSION, stats: { playSeconds: 200 },
      stash: [{ card: { id: 'other-card', name: '另档卡' }, count: 5 }], pocket: [] });
    localStorage.setItem(otherKey, other);
    Base.data.stash[0].count = 9;
    Base.data.stats.playSeconds = 150;
    expect(Base.use(2).stash[0].count).toBe(5);
    expect(Base.use(1).stash[0].count).toBe(2);
    expect(Base.data.stats.playSeconds).toBe(100);
    expect(localStorage.getItem(otherKey)).toBe(other);
  });

  it('外部更新自动失配缓存，预览不推进旧运行态写基线', () => {
    const latest = JSON.stringify({ version: Base.BASE_VERSION, stats: { playSeconds: 250 },
      stash: [{ card: { id: 'updated-card', name: '更新卡' }, count: 6 }], pocket: [],
      _m01: { revision: 5, requests: {} } });
    localStorage.setItem(key, latest);
    const preview = Base.peek(1);
    expect(preview.stats.playSeconds).toBe(250);
    preview.stash[0].count = 99;
    expect(Base._readForCommit(1).stash[0].count).toBe(6);
    expect(Base.save()).toBe(false);
    expect(localStorage.getItem(key)).toBe(latest);
    expect(Base.use(1).stash[0].count).toBe(6);
    expect(Base.save()).toBe(true);
  });

  it('持久快照仍按原串缓存迁移，命中不再JSON.parse且每次只读一次主键', () => {
    const parse = vi.spyOn(JSON, 'parse');
    const get = vi.spyOn(Storage.prototype, 'getItem');
    Base.peek(1);
    Base._readForCommit(1);
    Base.use(1);
    expect(parse).not.toHaveBeenCalled();
    expect(get.mock.calls.filter(([name]) => name === key)).toHaveLength(3);
  });

  it('修改只读预览不污染后续预览、装载或持久原串', () => {
    const raw = localStorage.getItem(key);
    const preview = Base.peek(1);
    preview.stash[0].count = 99;
    preview.stash[0].card.name = '未保存预览';
    preview.stats.playSeconds = 999;
    expect(Base.peek(1).stash[0]).toMatchObject({ count: 2, card: { name: '档案卡' } });
    expect(Base.use(1).stats.playSeconds).toBe(100);
    expect(localStorage.getItem(key)).toBe(raw);
  });

  it('未保存的运行态嵌套编辑不进入下一次装载，当前运行内存仍可继续', () => {
    Base.data.stash[0].count = 8;
    Base.data.stats.playSeconds = 123;
    expect(Base.data.stash[0].count).toBe(8);
    expect(Base.peek(1).stash[0].count).toBe(2);
    expect(Base._readForCommit(1).stats.playSeconds).toBe(100);
    expect(Base.use(1).stash[0].count).toBe(2);
    expect(Base.data.stats.playSeconds).toBe(100);
  });

  it('保存失败时沿用内存checkpoint，预览和重新装载仍来自磁盘', () => {
    const blocked = blockSave();
    expect(Base.syncPlayTime(35, 25)).toEqual({ changed: true, delta: 10, checkpoint: 35, persisted: false });
    expect(Base.data.stats.playSeconds).toBe(110);
    expect(persisted().stats.playSeconds).toBe(100);
    expect(Base.peek(1).stats.playSeconds).toBe(100);
    blocked.mockRestore();
    expect(Base.use(1).stats.playSeconds).toBe(100);
  });

  it('成功保存后的缓存也独立于下一次未保存运行态，重试会保存完整内存', () => {
    Base.data.stats.playSeconds = 120;
    expect(Base.save()).toBe(true);
    const blocked = blockSave();
    expect(Base.syncPlayTime(35, 25).persisted).toBe(false);
    expect(Base.data.stats.playSeconds).toBe(130);
    expect(Base.peek(1).stats.playSeconds).toBe(120);
    blocked.mockRestore();
    expect(Base.save()).toBe(true);
    expect(persisted().stats.playSeconds).toBe(130);
    expect(Base.use(1).stats.playSeconds).toBe(130);
  });

  it('内部刷新返回值与采纳运行态、持久缓存分别隔离', () => {
    const preview = Base._refreshExternal(1);
    preview.stats.playSeconds = 400;
    preview.stash[0].card.name = '外部未保存';
    expect(Base.data.stats.playSeconds).toBe(100);
    expect(Base.data.stash[0].card.name).toBe('档案卡');
    expect(Base.peek(1).stats.playSeconds).toBe(100);
  });

  it('成功写穿透缓存代表真实JSON原串，保留JSON序列化的既有口径', () => {
    Base.data.extraCheckpoint = { value: Infinity, transient: () => {} };
    expect(Base.save()).toBe(true);
    expect(Base.peek(1).extraCheckpoint).toEqual({ value: null });
    expect(persisted().extraCheckpoint).toEqual({ value: null });
    expect(Base.use(1).extraCheckpoint).toEqual({ value: null });
  });

  it('提交接口写成功后仍隔离快照，普通mutate保留未改仓库引用', () => {
    const next = Base._readForCommit(1);
    next.stats.playSeconds = 120;
    Base._writeCommitted(1, next);
    Base.data.stats.playSeconds = 150;
    expect(Base.peek(1).stats.playSeconds).toBe(120);
    expect(Base.use(1).stats.playSeconds).toBe(120);
    const stack = Base.data.stash[0];
    expect(Base.unlockBack('snapshot-back')).toBe(true);
    expect(Base.data.stash[0]).toBe(stack);
    Base.data.stash[0].count = 9;
    expect(Base.peek(1).stash[0].count).toBe(2);
  });
});
