import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunStorage, SLOT_COUNT } from '../game/src/hub/game.storage.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
await import('../game/src/hub/meta.js');

const fixture = name => JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/${name}`), 'utf8'));
const Base = window.SDT.Base;

describe('固定旧档兼容样本', () => {
  beforeEach(() => {
    localStorage.clear();
    for (let slot = 1; slot <= 5; slot++) RunStorage.remove(slot);
  });

  it('v1 单档迁入档位 1，并完整保留未完成对局字段', () => {
    const legacy = fixture('save-v1-run.json');
    localStorage.setItem('sdt-save-v1', JSON.stringify(legacy));
    RunStorage.migrateLegacy();
    // 旧档无 version 字段 → 读取时按 0 处理并逐级盖章升到当前 SAVE_VERSION；
    // 1→2 迁移把「杀」旧 id（builtin-sha）归一为 starter-attack，卡内容不动
    expect(RunStorage.read(1)).toEqual({
      ...legacy,
      ownedCards: [{ uid: 'legacy-card-1', card: { id: 'starter-attack', name: '初始攻击', type: '武术', cost: 1 } }],
      characterId: 'heixiang',
      version: RunStorage.SAVE_VERSION,
    });
    expect(localStorage.getItem('sdt-save-v1')).toBeNull();
  });

  it('v2 五槽按槽读取且不会互相覆盖', () => {
    const slot2 = fixture('save-v2-slot2-run.json');
    expect(SLOT_COUNT).toBe(5);
    // write 统一盖章 version（schema 版本契约）
    RunStorage.write(2, slot2);
    RunStorage.write(3, { ...slot2, slot: 3, myClass: '剑仙' });
    RunStorage.write(5, { ...slot2, slot: 5, myClass: '法师' });
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.read(2)).toEqual({ ...slot2, myClass: '牧师', characterId: 'xingyue', version: RunStorage.SAVE_VERSION });
    expect(RunStorage.read(3).myClass).toBe('剑仙');
    expect(RunStorage.read(4)).toBeNull();
    expect(RunStorage.read(5).myClass).toBe('法师');
  });

  it('损坏存档：原串备份到 corrupt 键并返回 null', () => {
    localStorage.setItem('sdt-save-v2-slot1', '{broken json');
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.issue(1)).toBe('corrupt');
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBe('{broken json');
    // 下一次成功写入后备份与异常标记清除
    RunStorage.write(1, { hp: 10 });
    expect(RunStorage.issue(1)).toBeNull();
    expect(localStorage.getItem(RunStorage.corruptKey(1))).toBeNull();
  });

  it('版本过新：原样保留不碰、拒绝读取', () => {
    const future = JSON.stringify({ hp: 10, version: RunStorage.SAVE_VERSION + 1 });
    localStorage.setItem('sdt-save-v2-slot2', future);
    expect(RunStorage.read(2)).toBeNull();
    expect(RunStorage.issue(2)).toBe('tooNew');
    expect(localStorage.getItem('sdt-save-v2-slot2')).toBe(future);
  });

  it('旧标签页加载对局后发现档位已更新时拒绝覆盖', () => {
    RunStorage.readForLoad(4); // 旧标签看到空档
    const newer = JSON.stringify({ version: RunStorage.SAVE_VERSION, hp: 27,
      _r2: { runId: 'other-tab-run', revision: 0 } });
    localStorage.setItem(RunStorage.key(4), newer); // 模拟另一标签先写入
    RunStorage.read(4); // 列表只读重查不得替旧内存快照推进基线
    expect(RunStorage.write(4, { hp: 10 })).toBe(false);
    expect(localStorage.getItem(RunStorage.key(4))).toBe(newer);
  });

  it('重新载入另一标签保存的最新对局后允许继续保存', () => {
    RunStorage.readForLoad(5);
    const latest = JSON.stringify({ version: RunStorage.SAVE_VERSION, hp: 27,
      _r2: { runId: 'latest-run', revision: 2 } });
    localStorage.setItem(RunStorage.key(5), latest);
    expect(RunStorage.read(5).hp).toBe(27); // 列表读取不移动旧编辑基线
    expect(RunStorage.write(5, { hp: 10 })).toBe(false);
    expect(RunStorage.readForLoad(5).hp).toBe(27); // 真正载入时接受最新基线
    expect(RunStorage.write(5, { hp: 26 })).toBe(true);
    expect(RunStorage.read(5).hp).toBe(26);
  });

  it('无编辑基线时也拒绝覆盖另一标签刚创建的对局', () => {
    const latest = JSON.stringify({ version: RunStorage.SAVE_VERSION, hp: 27,
      _r2: { runId: 'new-slot-run', revision: 0 } });
    localStorage.setItem(RunStorage.key(4), latest);
    expect(RunStorage.write(4, { hp: 10 })).toBe(false);
    expect(localStorage.getItem(RunStorage.key(4))).toBe(latest);
  });

  it('旧基地迁移保留仓库、职业、成就和卡背，并补齐新字段', () => {
    const legacyBase = fixture('base-v1.json');
    localStorage.setItem('sdt-base-v1', JSON.stringify(legacyBase));
    localStorage.setItem('sdt-save-v2-slot1', JSON.stringify(fixture('save-v1-run.json')));
    Base.migrateLegacy([1]);
    const data = Base.use(1);
    expect(data.stash).toEqual(legacyBase.stash);
    expect(data.classes['战士']).toEqual({ lv: 4, xp: 12 });
    expect(data.achClaimed.kill10).toBe(true);
    expect(data.backSel).toBe('wolf');
    expect(data.stats.playSeconds).toBe(0);
    expect(data.collection).toEqual({});
  });

  it('基地存档盖章 version；损坏基地备份到 corrupt 键', () => {
    const legacyBase = fixture('base-v1.json');
    localStorage.setItem('sdt-base-v2-slot2', JSON.stringify(legacyBase));
    const data = Base.use(2);
    Base.save();
    const stored = JSON.parse(localStorage.getItem('sdt-base-v2-slot2'));
    expect(stored.version).toBe(Base.BASE_VERSION);
    expect(data.version).toBe(Base.BASE_VERSION);

    localStorage.setItem('sdt-base-v2-slot3', '{broken');
    expect(Base.peek(3)).toBeNull();
    expect(Base.issue(3)).toBe('corrupt');
    expect(localStorage.getItem(Base.CORRUPT_KEY(3))).toBe('{broken');
  });

  it('旧标签页基地数据过期时拒绝覆盖并保留新存档', () => {
    const base = Base.use(4);
    base.wood = 2;
    const newer = JSON.stringify({ version: Base.BASE_VERSION, wood: 19,
      _m01: { revision: 1, requests: {} } });
    localStorage.setItem(Base.SLOT_KEY(4), newer); // 模拟另一标签先写入
    expect(Base.save()).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(4))).toBe(newer);
  });

  it('选档时观察为空、另一标签创建基地后拒绝按newSlot重置', () => {
    const log = vi.fn();
    window.SDT.UI = { log };
    expect(Base.peek(5)).toBeNull();
    const newer = JSON.stringify({ version: Base.BASE_VERSION, wood: 19,
      _m01: { revision: 1, requests: {} } });
    localStorage.setItem(Base.SLOT_KEY(5), newer);
    Base.use(5); // newSlot launch 路径会先进入基地
    expect(Base.reset(5)).toBe(false);
    expect(localStorage.getItem(Base.SLOT_KEY(5))).toBe(newer);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('请返回选档重新进入'), 'warn');
  });
});
