import { describe, expect, it } from 'vitest';
import { departureSummary } from '../game/src/hub/departure.summary.js';
const starter = { id: 'starter-attack', name: '初始攻击' };
const fireball = { id: 'tt3-fireball', name: '火球' };
const opts = { starterCount: 5, starterCard: starter, fireball, stash: [], picks: {}, capacity: 16,
  stackCapOf: card => ['初始攻击', '火球'].includes(card.name) ? 5 : 3 };
describe('出征摘要与实际初始发放口径', () => {
  it('机器人额外初始牌按每格五张切分，不虚构随机卡', () => {
    const preview = departureSummary({ ...opts, pet: { effect: { extraSha: 2 } } });
    expect(preview.starterCount).toBe(7);
    expect(preview.cells.map(cell => cell.count)).toEqual([5, 2]);
    expect(preview.slots).toBe(2);
    expect(preview.knownCount).toBe(7);
  });
  it('火焰精灵转换后与携带的同名火球合并，超上限另占格', () => {
    const preview = departureSummary({ ...opts, pet: { effect: { shaToFireball: true } },
      stash: [{ card: fireball, count: 2 }], picks: { 火球: 2 } });
    expect(preview.starter).toEqual(fireball);
    expect(preview.cells.map(cell => cell.count)).toEqual([5, 2]);
    expect(preview.extraCount).toBe(2);
  });
  it('珍珠盒额外容量只标为资源格', () => {
    const preview = departureSummary({ ...opts, stash: [{ card: { id: 'tt2-pearlbox', name: '珍珠盒' }, count: 2 }], picks: { 珍珠盒: 2 } });
    expect(preview.capacity).toBe(34);
    expect(preview.resourceBonus).toBe(18);
  });
  it('与出发扣仓一致地忽略职业牌/未知牌，限制为实际拥有数量', () => {
    const card = { name: '普通牌' };
    const preview = departureSummary({ ...opts,
      stash: [{ card, count: 4 }, { card: { name: '职业牌', rarity: '职业' }, count: 2 }],
      picks: { 普通牌: 8, 职业牌: 2, 不存在: 2 } });
    expect(preview.extraCount).toBe(4);
    expect(preview.cells.map(cell => cell.count)).toEqual([5, 3, 1]);
    expect(preview.slots).toBe(3);
  });
});
