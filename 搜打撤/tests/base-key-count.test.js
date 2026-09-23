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

  it('旧档按名称统计钥匙，即使快照缺少资源 type', () => {
    Base.data.keys = 0;
    Base.data.stash = [{ card: { id: 'legacy-key-event', name: '钥匙包', desc: '钥匙 ×2。' }, count: 3 }];
    expect(Base.keyCount()).toBe(6);
  });

  it('结构化材料按稳定卡 id 对应的数据计数，不读取改写后的 desc', () => {
    Base.data.keys = 1;
    Base.data.stash = [
      { card: { id: 'tt-key-one', name: '任意改名', type: '资源', desc: '纯展示文案',
        rules: { version: 1, base: { material: { kind: 'keys', amount: 3 } } } }, count: 2 },
      { card: { id: 'tt3-wood-bundle', name: '任意改名', type: '资源', desc: '纯展示文案',
        rules: { version: 1, base: { material: { kind: 'wood', amount: 3 } } } }, count: 1 },
    ];
    expect(Base.keyCount()).toBe(7);
    expect(Base.materialInfo(Base.data.stash[1].card).kind).toBe('wood');
    expect(Base.materialAmount(Base.data.stash[1].card)).toBe(3);
  });

  it('拒绝无效的结构化材料参数，避免静默退回 desc', () => {
    const card = { id: 'tt-key-one', type: '资源', name: '钥匙', desc: '钥匙 ×9',
      rules: { version: 1, base: { material: { kind: 'keys', amount: 0 } } } };
    expect(() => Base.materialAmount(card)).toThrow(/Invalid base\.material for card tt-key-one/);
  });
});
