import { beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { RunStorage } from '../prototypes/map-system/src/game.storage.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../prototypes/map-system/src/cards.js');
await import('../prototypes/map-system/src/base.js');
await import('../prototypes/map-system/src/meta.js');

const fixture = name => JSON.parse(readFileSync(resolve(process.cwd(), `tests/fixtures/${name}`), 'utf8'));
const Base = window.SDT.Base;

describe('固定旧档兼容样本', () => {
  beforeEach(() => localStorage.clear());

  it('v1 单档迁入档位 1，并完整保留未完成对局字段', () => {
    const legacy = fixture('save-v1-run.json');
    localStorage.setItem('sdt-save-v1', JSON.stringify(legacy));
    RunStorage.migrateLegacy();
    expect(RunStorage.read(1)).toEqual({ ...legacy, characterId: 'xuanli' });
    expect(localStorage.getItem('sdt-save-v1')).toBeNull();
  });

  it('v2 三槽按槽读取且不会互相覆盖', () => {
    const slot2 = fixture('save-v2-slot2-run.json');
    RunStorage.write(2, slot2);
    RunStorage.write(3, { ...slot2, slot: 3, myClass: '剑仙' });
    expect(RunStorage.read(1)).toBeNull();
    expect(RunStorage.read(2)).toEqual({ ...slot2, myClass: '牧师', characterId: 'dengkui' });
    expect(RunStorage.read(3).myClass).toBe('剑仙');
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
});
