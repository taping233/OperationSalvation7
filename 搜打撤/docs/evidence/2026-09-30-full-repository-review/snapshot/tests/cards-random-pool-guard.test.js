/* 随机池防退回守卫（卡库审计 2026-09-17 发现三，2026-09-25 修复）：石榴弹珠。
 * 老板 2026-09-13 拍板「石榴石弹珠卖价 3→4，并退出商店/发现池」——资源/古朴卡的
 * isRandomObtainable 只看 unrandom 字段，而定版覆盖批次（cards-sync.json）的
 * tt3-garnet-marble 无该字段，ensureCardsSyncLive 整卡覆盖会把它抹掉。
 * 本文件锁定：播种链终态 unrandom 在位 + ensureRandomPoolFixes 的防退回补回。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
await import('../game/src/cards/cards.js');

const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureStarters();
  Cards.ensureSha();
  Cards.ensureTabletop();   // 含定版覆盖（ensureCardsSyncLive）与 ensureRandomPoolFixes
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

describe('石榴弹珠随机池归属（老板 2026-09-13 拍板：退出商店/发现池）', () => {
  it('播种链终态 unrandom 在位，不进随机/发现/掉落池', () => {
    const marble = Cards.all().find(c => c.id === 'tt3-garnet-marble');
    expect(marble, '卡库应存在 tt3-garnet-marble').toBeTruthy();
    expect(marble.unrandom, 'ensureCardsSyncLive 整卡覆盖后 unrandom 应由 ensureRandomPoolFixes 补回').toBe(true);
    expect(Cards.isRandomObtainable(marble)).toBe(false);
  });

  it('老板拍板的卖价与可出售资格同步在位', () => {
    const marble = Cards.all().find(c => c.id === 'tt3-garnet-marble');
    expect(marble.value).toBe(4);
    expect(Cards.isSellable(marble)).toBe(true);
  });

  it('unrandom 被抹掉时幂等补回（定版升版重播防退回）', () => {
    const marble = Cards.all().find(c => c.id === 'tt3-garnet-marble');
    delete marble.unrandom;                    // 模拟 ensureCardsSyncLive 整卡覆盖的抹除
    Cards.ensureRandomPoolFixes();
    expect(Cards.all().find(c => c.id === 'tt3-garnet-marble').unrandom).toBe(true);
    expect(Cards.isRandomObtainable(marble)).toBe(false);
  });
});
