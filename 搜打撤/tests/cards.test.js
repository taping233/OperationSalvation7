/* cards.js 单元测试：抽卡/注能/回复/护甲词条推导 + 卡面角标（迁移自 selftest.js 第 2 节） */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');

let Cards;
beforeAll(() => { Cards = window.SDT.Cards; });

const d = (desc) => Cards.deriveDraw({ desc });
const inf = (desc) => Cards.deriveInfuse({ desc });
const heal = (desc) => Cards.deriveHeal({ desc });
const armor = (desc) => Cards.deriveArmor({ desc });

describe('抽卡/注能/回复/护甲词条推导', () => {
  it('deriveDraw 抽 2 张牌', () => expect(d('摸底：抽 2 张牌。')).toBe(2));
  it('deriveDraw 优先已标注', () => expect(Cards.deriveDraw({ draw: 3, desc: '抽 2 张牌' })).toBe(3));
  it('deriveDraw 无词条', () => expect(d('造成 2 点伤害。')).toBe(0));
  it('deriveInfuse 注能(2)', () => expect(inf('注能(2)：额外施放 1 段。')).toBe(2));
  it('deriveInfuse 注能（2）全角', () => expect(inf('注能（1）：1′ 冰冻、流血、中毒。')).toBe(1));
  it('deriveInfuse 注能(小)=1', () => expect(inf('注能(小)：改为 8′。')).toBe(1));
  it('deriveInfuse 无词条', () => expect(inf('造成 3 点伤害，回复等量生命。')).toBe(0));
  it('deriveHeal 回复 6 点生命', () => expect(heal('回复 6 点生命。')).toBe(6));
  it('deriveHeal +4 血', () => expect(heal('+4 血。')).toBe(4));
  it('deriveHeal 优先结构化词条', () => expect(Cards.deriveHeal({ heal: 9, desc: '回复 2 点生命。' })).toBe(9));
  it('deriveArmor 获得 5 点护甲', () => expect(armor('获得 5 点护甲。')).toBe(5));
  it('deriveArmor +3 甲', () => expect(armor('+3 甲。')).toBe(3));
  it('deriveArmor 优先结构化词条', () => expect(Cards.deriveArmor({ armor: 8, desc: '获得 2 点护甲。' })).toBe(8));
});

describe('卡面角标', () => {
  beforeAll(() => {
    // 页面由 icons-bitmap 提供 TYPE_ART；测试环境补最小映射
    window.SDT.Icons = window.SDT.Icons || {};
    window.SDT.Icons.TYPE_ART = Cards.TYPE_ART;
  });
  it('卡面显示回复词条角标', () =>
    expect(Cards.cardHTML({ name: '疗愈', cost: 1, rarity: '初始', type: '法术', heal: 3 }).includes('回 3')).toBe(true));
  it('卡面显示护甲词条角标', () =>
    expect(Cards.cardHTML({ name: '铁壁', cost: 1, rarity: '初始', type: '武术', armor: 4 }).includes('甲 4')).toBe(true));
});
