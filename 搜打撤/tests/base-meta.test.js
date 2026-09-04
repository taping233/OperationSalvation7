/* base.js + meta.js 单元测试：存档档位隔离 / 旧基地迁移 / 卡背解锁 / 成就领取
 * （迁移自 selftest.js 第 3+4 节，借 jsdom 提供真实的 localStorage） */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../prototypes/map-system/src/cards.js');
await import('../prototypes/map-system/src/base.js');
await import('../prototypes/map-system/src/meta.js');




let Base, Meta, Cards;
beforeAll(() => {
  Base = window.SDT.Base;
  Meta = window.SDT.Meta;
  Cards = window.SDT.Cards;
});

const store = () => JSON.parse(JSON.stringify(globalThis.localStorage));

describe('基地存档档位隔离', () => {
  it('slot1 木材落盘到独立键', () => {
    Base.use(1); Base.data.wood = 9; Base.save();
    expect(JSON.parse(localStorage.getItem('sdt-base-v2-slot1')).wood).toBe(9);
  });
  it('slot2 基地独立（新档从零开始：木材 0）', () => {
    Base.use(2);
    expect(Base.data.wood).toBe(0);
  });
  it('旧档安全补齐累计游玩时间', () => {
    expect(Base.data.stats.playSeconds).toBe(0);
  });
  it('切回 slot1 数据不串档', () => {
    Base.data.wood = 6; Base.save();
    Base.use(1);
    expect(Base.data.wood).toBe(9);
  });
  it('peek(2) 只读不影响当前档', () => {
    expect(Base.peek(2).wood).toBe(6);
  });
  it('hasSlot / wipe', () => {
    expect(Base.hasSlot(1)).toBe(true);
    Base.wipe(2);
    expect(Base.hasSlot(2)).toBe(false);
    expect(Base.hasSlot(1)).toBe(true);
  });
});

describe('旧全局基地迁移', () => {
  it('旧全局基地迁入有对局存档的档位，迁移后旧键删除', () => {
    localStorage.setItem('sdt-base-v1', JSON.stringify({ wood: 12, rations: 3 }));
    localStorage.setItem('sdt-save-v2-slot3', '{"turn":2}');
    Base.migrateLegacy([3]);
    expect(JSON.parse(localStorage.getItem('sdt-base-v2-slot3')).wood).toBe(12);
    expect(localStorage.getItem('sdt-base-v1')).toBeNull();
  });
});

describe('卡背：默认解锁 / 成就领取 / 装备 / 按档隔离', () => {
  it('默认卡背恒解锁，猎手初始未解锁', () => {
    expect(Base.isBackUnlocked('classic')).toBe(true);
    expect(Base.isBackUnlocked('wolf')).toBe(false);
  });
  it('成就领取解锁卡背，重复领取被拒', () => {
    Base.data.stats.kills = 10;
    expect(Meta.claim('kill10').ok).toBe(true);
    expect(Base.isBackUnlocked('wolf')).toBe(true);
    expect(Meta.claim('kill10').ok).toBe(false);
  });
  it('装备猎手卡背并渲染', () => {
    expect(Base.setBack('wolf')).toBe(true);
    expect(Base.backSel()).toBe('wolf');
    expect(Cards.cardBackHTML().includes('hb-wolf')).toBe(true);
    expect(Cards.cardBackHTML('altar').includes('hb-altar')).toBe(true);
  });
  it('slot2 卡背解锁隔离、回退默认，未解锁不能装备', () => {
    Base.use(2);
    expect(Base.isBackUnlocked('wolf')).toBe(false);
    expect(Base.backSel()).toBe('classic');
    expect(Cards.cardBackHTML().includes('hb-classic')).toBe(true);
    expect(Base.setBack('boss')).toBe(false);
  });
});
