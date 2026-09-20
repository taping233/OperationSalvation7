/* 钥匙计数 ×N 解析（迭代评审 09-20 B-P1）：「三把钥匙」「两把钥匙」改名后
 * 数量必须读 desc 的「×N」标记，不再按卡名/「一串」识别——卡面「钥匙 ×3」与
 * 宝藏大门进度一致。 */
import { describe, expect, it, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');
await import('../game/src/base.js');

let Base;
beforeAll(() => {
  Base = window.SDT.Base;
});

describe('宝藏大门钥匙计数', () => {
  it('「钥匙 ×3」「钥匙 ×2」按 desc 标记计 3/2（三把/两把钥匙）', () => {
    Base.use(4);
    Base.data.keys = 0;
    Base.data.stash = [
      { card: { id: 'tt-key-one', name: '三把钥匙', desc: '钥匙 ×3。' }, count: 1 },
      { card: { id: 'tt-keys-bunch', name: '两把钥匙', desc: '钥匙 ×2。' }, count: 2 },
    ];
    // 3×1 + 2×2 = 7
    expect(Base.keyCount()).toBe(7);
  });

  it('无 ×N 标记（一把钥匙）按 1 计；真实钥匙储备累加', () => {
    Base.data.keys = 2;
    Base.data.stash = [{ card: { id: 'tt-key', name: '钥匙', desc: '解锁大门。' }, count: 3 }];
    expect(Base.keyCount()).toBe(5);
  });

  it('非钥匙卡不计数', () => {
    Base.data.keys = 0;
    Base.data.stash = [{ card: { id: 'tt-wood', name: '木材', desc: '木材 ×3。' }, count: 5 }];
    expect(Base.keyCount()).toBe(0);
  });
});
