import { beforeEach, describe, expect, it } from 'vitest';
import { RunStorage, SLOT_COUNT } from '../game/src/hub/game.storage.js';

// base 侧粘滞 issue 修复的端到端钉（2026-09-28 代码线收敛批）：
// 旧行为：坏档 issue 标记只在原串变 null 或 save() 成功时清除——坏档被外部修复后
// Base.issue 仍为 'corrupt'，Base.save() 被 `if (issue(slot)) return false` 永久锁死。
// 收敛后读取管线按 run 侧语义在可读路径清除 issue。本用例钉住完整链：
// 坏档 → peek 报 corrupt → 外部修复原串 → peek 恢复 + issue 清零 → save 解锁。

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');
const Base = window.SDT.Base;
const slotKey = (i) => Base.SLOT_KEY(i);

beforeEach(() => {
  localStorage.clear();
  for (let slot = 1; slot <= SLOT_COUNT; slot++) RunStorage.remove(slot);
});

describe('base 坏档 issue 不再粘滞', () => {
  it('坏档→外部修复→peek 恢复→save 解锁', () => {
    localStorage.setItem(slotKey(1), '{broken');
    expect(Base.peek(1)).toBeNull();
    expect(Base.issue(1)).toBe('corrupt');
    expect(localStorage.getItem(Base.CORRUPT_KEY(1))).toBe('{broken');   // 坏档备份口径不变

    // 外部（另一标签页/人工）把原串修成合法基地档
    const fixed = JSON.stringify({ version: Base.BASE_VERSION, coins: 7, stash: [], pocket: [] });
    localStorage.setItem(slotKey(1), fixed);

    expect(Base.peek(1)).toMatchObject({ coins: 7 });
    expect(Base.issue(1)).toBeNull();          // 修复点：issue 不再粘滞

    // save 解锁：旧实现这里因残留 issue 返回 false，玩家进度永远写不回
    Base.use(1);
    expect(Base.save()).toBe(true);
  });
});
