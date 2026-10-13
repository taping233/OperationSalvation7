import { beforeEach, describe, expect, it, vi } from 'vitest';
import { shopV3HTML } from '../game/src/hub/hub.shop-v3.js';

const goods = [
  { id: 'tt3-skewer', price: 6, tip: '基础招式 · 造成 2 点伤害，无视护甲' },
  { id: 'tt3-staff', price: 6, tip: '基础装备 · 法伤 +1' },
  { material: 'rations', name: '口粮', price: 4, tip: '基地物资 +1 · 升级宠物' },
  { material: 'wood', name: '木材', price: 4, tip: '基地物资 +1 · 扩建背包与仓库' },
];
const list = [
  { id: 'tt3-skewer', name: '穿刺', type: '法术', desc: '造成 2 点伤害，无视护甲。' },
  { id: 'tt3-staff', name: '法杖', type: '装备', desc: '法伤 +1。' },
  { id: 'tt-rations', name: '口粮', type: '资源' },
  { id: 'tt-wood', name: '木材', type: '资源' },
];
let base, cards, art;
beforeEach(() => {
  base = {
    data: { coins: 10, wood: 7, rations: 2, stash: [{ card: list[0], count: 2 }, { card: list[0], count: 1 }] },
    stashRoom: () => 2, stashCap: () => 25,
  };
  cards = { all: () => list };
  art = { cardIcon: vi.fn(card => `<img src="${card.id}.webp" alt="${card.name}">`) };
});
const render = () => {
  const root = document.createElement('main');
  root.innerHTML = shopV3HTML({ base, cards, art, goods });
  return root;
};
describe('独立补给商店的陈列与购买状态', () => {
  it('陈列真实商品、数量和动作，渲染不更改存档', () => {
    const before = JSON.stringify(base.data);
    const root = render();
    expect(root.querySelectorAll('.shop-v3-product')).toHaveLength(4);
    expect(root.querySelectorAll('[data-act="shopPreview"]')).toHaveLength(2);
    expect(root.querySelector('[data-kind="wood"]').dataset.act).toBe('rawItem');
    expect(root.querySelector('[data-kind="rations"]').dataset.act).toBe('rawItem');
    expect(root.querySelector('[data-goods-id="tt3-skewer"] .shop-v3-meta').textContent).toContain('持有 3 张');
    expect(root.querySelector('[data-goods-id="wood"] .shop-v3-meta').textContent).toContain('持有 7 个');
    expect(root.querySelector('[data-goods-id="rations"] .shop-v3-price').textContent).toContain('4');
    expect(root.querySelector('[data-act="shopBuy"][data-i="2"]').getAttribute('aria-label')).toContain('4 储备币');
    expect(root.querySelector('[data-act="shopPreview"][data-i="0"]')).not.toBeNull();
    expect(root.querySelector('.shop-v3-footer')).toBeNull();
    expect(art.cardIcon.mock.calls.map(([card]) => card.id)).toEqual(['tt3-skewer', 'tt3-staff', 'tt-rations', 'tt-wood']);
    expect(JSON.stringify(base.data)).toBe(before);
  });
  it('仓库满时只阻止卡牌购买，物资仍可购买和查看', () => {
    base.stashRoom = () => 0;
    const root = render();
    expect(root.querySelector('[data-act="shopBuy"][data-i="0"]').disabled).toBe(true);
    expect(root.querySelector('[data-act="shopBuy"][data-i="1"]').disabled).toBe(true);
    expect(root.querySelector('[data-act="shopBuy"][data-i="2"]').disabled).toBe(false);
    expect(root.querySelector('[data-act="shopBuy"][data-i="3"]').disabled).toBe(false);
    expect(root.querySelector('[data-act="shopPreview"][data-i="0"]').disabled).toBe(false);
    expect(root.querySelector('.shop-v3-footer').textContent).toContain('卡牌仓库已满');
    expect(root.querySelector('[data-tab="stash"]').dataset.view).toBe('cards');
    expect(root.querySelector('[data-tab="upgrade"]').dataset.facility).toBe('stash');
    expect(root.querySelector('[data-goods-id="wood"]').textContent).not.toContain('仓库已满');
  });
  it('缺币显示各商品的真实缺口，详情仍可打开', () => {
    base.data.coins = 3;
    const root = render();
    expect([...root.querySelectorAll('[data-act="shopBuy"]')].every(button => button.disabled)).toBe(true);
    expect(root.querySelector('[data-goods-id="tt3-skewer"]').textContent).toContain('还需 3 储备币');
    expect(root.querySelector('[data-goods-id="wood"]').textContent).toContain('还需 1 储备币');
    expect(root.querySelector('[data-kind="wood"]').disabled).toBe(false);
  });
  it('缺商品和满仓、缺币同时出现时，关键购买条件均可读', () => {
    cards.all = () => list.filter(card => card.id !== 'tt3-skewer');
    base.data.coins = 3;
    base.stashRoom = () => 0;
    const root = render();
    const product = root.querySelector('[data-goods-id="tt3-skewer"]');
    expect(product.querySelector('[data-act="shopPreview"]').disabled).toBe(true);
    expect(product.querySelector('[data-act="shopBuy"]').disabled).toBe(true);
    expect(product.querySelector('.shop-v3-shortfall').textContent).toBe('暂缺商品 · 还需 3 储备币');
    expect(product.querySelector('[data-act="shopBuy"]').getAttribute('aria-label')).toContain('仓库已满');
    expect(root.querySelector('.shop-v3-footer').textContent).toContain('卡牌仓库已满');
  });
});
