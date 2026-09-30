import { describe, expect, it } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards/cards.js');
await import('../game/src/hub/base.js');

const Base = window.SDT.Base;

describe('基地材料旧档行为基线', () => {
  it('旧存档实例按卡名识别材料，并按描述 ×N 折入木材和钥匙', () => {
    const slot = 8;
    localStorage.setItem(Base.SLOT_KEY(slot), JSON.stringify({
      wood: 4,
      rations: 2,
      keys: 1,
      stash: [
        { card: { id: 'tt3-wood-bundle', name: '一捆木材', type: '资源', rarity: '稀有', desc: '木材 ×3。' }, count: 2 },
        { card: { id: 'tt-key-one', name: '一把钥匙', type: '资源', rarity: '古朴', desc: '钥匙 ×3。' }, count: 1 },
      ],
      pocket: [],
    }));
    Base.use(slot);

    // 旧档卡牌没有 rules；当前逻辑仍从 name/desc 得到材料类型与每张数量。
    const woodStack = Base.data.stash.find(stack => stack.card.id === 'tt3-wood-bundle');
    expect(woodStack.card.rules).toBeUndefined();
    expect(Base.materialInfo(woodStack.card).kind).toBe('wood');
    expect(Base.materialAmount(woodStack.card)).toBe(3);
    expect(Base.useStashMaterial('一捆木材', true)).toMatchObject({ ok: true, qty: 2, total: 6 });
    expect(Base.data.wood).toBe(10);

    expect(Base.keyCount()).toBe(4); // 储备钥匙 1 + 仓库中的钥匙 ×3
    expect(Base.useStashMaterial('一把钥匙', true)).toMatchObject({ ok: true, qty: 1, total: 3 });
    expect(Base.data.keys).toBe(4);
    expect(Base.keyCount()).toBe(4);
    expect(Base.data.stash).toHaveLength(0);
  });

  it('描述没有 ×N 时每张按 1 计；使用前仓库钥匙数含整堆数量', () => {
    const slot = 9;
    localStorage.setItem(Base.SLOT_KEY(slot), JSON.stringify({
      keys: 2,
      stash: [{ card: { id: 'tt-key', name: '钥匙', type: '资源', desc: '解锁大门。' }, count: 3 }],
      pocket: [],
    }));
    Base.use(slot);
    expect(Base.materialAmount(Base.data.stash[0].card)).toBe(1);
    expect(Base.keyCount()).toBe(5);
  });

  it('结构化材料类型和数量不受卡名/描述改写影响，keyCount 只读结构化钥匙规则', () => {
    const slot = 10;
    Base.use(slot);
    Base.data.wood = 0;
    Base.data.keys = 2;
    const woodCard = {
      id: 'synthetic-wood-material', name: '回复药草', type: '资源', desc: '钥匙 ×99。',
      rules: { version: 1, base: { material: { kind: 'wood', amount: 4 } } },
    };
    const keyCard = {
      id: 'synthetic-key-material', name: '木材宝箱', type: '资源', desc: '木材 ×99。',
      rules: { version: 1, base: { material: { kind: 'keys', amount: 3 } } },
    };
    Base.data.stash = [
      { card: woodCard, count: 2 },
      { card: keyCard, count: 2 },
      { card: { id: 'tt-key', name: '旧档钥匙', type: '资源', desc: '钥匙 ×2。' }, count: 1 },
    ];

    expect(Base.materialInfo(woodCard).kind).toBe('wood');
    expect(Base.materialAmount(woodCard)).toBe(4);
    expect(Base.keyCount()).toBe(10); // 储备 2 + 结构化钥匙 3×2 + 旧档钥匙 2×1
    expect(Base.useStashMaterial('回复药草', true)).toMatchObject({ ok: true, qty: 2, total: 8, label: '木材' });
    expect(Base.data.wood).toBe(8);

    const rewrittenWood = { ...woodCard, name: '完全改名', desc: '回复 50 点生命。' };
    const rewrittenKey = { ...keyCard, name: '完全改名的其他牌', desc: '无数量说明。' };
    expect(Base.materialInfo(rewrittenWood).kind).toBe('wood');
    expect(Base.materialAmount(rewrittenWood)).toBe(4);
    Base.data.stash = [
      { card: rewrittenWood, count: 2 },
      { card: rewrittenKey, count: 2 },
      { card: { id: 'tt-key', name: '旧档钥匙', type: '资源', desc: '钥匙 ×2。' }, count: 1 },
    ];
    expect(Base.keyCount()).toBe(10);
    expect(Base.useStashMaterial('完全改名', true)).toMatchObject({ ok: true, qty: 2, total: 8, label: '木材' });
    expect(Base.data.wood).toBe(16);
  });

  it('结构化材料规则缺字段、kind/amount 非法或用于非资源卡时明确报出卡牌 id', () => {
    const invalidMaterials = [
      { kind: 'wood', amount: 0 },
      { kind: 'wood', amount: 1.5 },
      { kind: 'metal', amount: 1 },
      { amount: 1 },
      { kind: 'keys' },
    ];
    invalidMaterials.forEach((material, index) => {
      const id = `synthetic-invalid-material-${index}`;
      const card = { id, type: '资源', rules: { version: 1, base: { material } } };
      expect(() => Base.materialAmount(card)).toThrow(id);
    });

    const wrongType = {
      id: 'synthetic-invalid-material-type', type: '道具',
      rules: { version: 1, base: { material: { kind: 'wood', amount: 1 } } },
    };
    expect(() => Base.materialInfo(wrongType)).toThrow(wrongType.id);

    Base.use(11);
    Base.data.stash = [{ card: wrongType, count: 1 }];
    expect(() => Base.keyCount()).toThrow(wrongType.id);
  });
});
