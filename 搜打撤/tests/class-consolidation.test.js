/* 职业整合（2026-09-05 定版，迁移自完整包）回归测试：5 职业卡池、旧档卡库迁移、爆率、生物图鉴、熟练度迁移 */
import { describe, it, expect, beforeAll } from 'vitest';
window.SDT = window.SDT || { Icons: { img: () => '' } };
await import('../game/src/cards.js');
const Cards = window.SDT.Cards;

describe('职业整合数据迁移冒烟', () => {
  beforeAll(() => { localStorage.removeItem('sdt-cards-v1'); Cards.ensureTabletop(); });
  it('职业表 = 5 职业', () =>
    expect(Cards.CLASSES).toEqual(['侠客', '战士', '牧师', '法师', '降临者']));
  it('每职业 10-12 张职业卡（不含英雄/衍生）', () => {
    for (const cls of Cards.CLASSES) {
      const n = Cards.classPool(cls).filter(c => c.rarity === '职业' && !c.hero).length;
      expect(n, cls).toBeGreaterThanOrEqual(10);
      expect(n, cls).toBeLessThanOrEqual(12);
    }
  });
  it('每职业至少 1 张英雄卡，rarityOf 推导棱彩', () => {
    for (const cls of Cards.CLASSES) {
      const heroes = Cards.classPool(cls).filter(c => c.hero);
      expect(heroes.length, cls).toBeGreaterThan(0);
      expect(Cards.rarityOf(heroes[0])).toBe('棱彩');
      expect(Cards.isRandomObtainable(heroes[0])).toBe(false);
    }
  });
  it('职业整合迁移：旧 11 职业卡改归属/更名/退役，新 cc- 卡补种', () => {
    // 伪造旧存档卡库
    const old = [
      { id: 'tt7-throwblade', name: '飞刃偷袭', cls: '刺客', rarity: '初始', type: '武术' },
      { id: 'tt7-thundergrudge', name: '疾雷恩仇', cls: '剑客', rarity: '古朴', type: '武术' },
      { id: 'tt7-ironphalanx', name: '铁甲阵', cls: '剑客', rarity: '稀有', type: '武术' },
      { id: 'tt8-hero-sword', name: '无量仙剑·云风', cls: '剑客', type: '英雄卡', rarity: '稀有' },
      { id: 'tt8-hero-summoner', name: '神话终章·维新', cls: '召唤师', type: '英雄卡', rarity: '稀有' },
    ];
    localStorage.setItem('sdt-cards-v1', JSON.stringify(old.map(c => ({ ...c, desc: '' }))));
    // 真实旧档路径：清掉全部批次补种标记后再跑一次 ensureTabletop（老档重播补种）
    ['sdt-cards-tt-seeded','sdt-cards-tt2-v3-seeded','sdt-cards-tt3-v5-seeded','sdt-cards-tt4-v2-seeded',
     'sdt-cards-tt5-seeded','sdt-cards-tt6-seeded','sdt-cards-tt7-seeded','sdt-cards-tt7-v2-seeded',
     'sdt-cards-tt8-seeded','sdt-cards-tt9-seeded','sdt-cards-cc2-seeded'].forEach(k => localStorage.removeItem(k));
    Cards.ensureTabletop();
    const all = Cards.all();
    const by = id => all.find(c => c.id === id);
    expect(by('tt7-throwblade').cls).toBe('侠客');
    expect(by('tt7-thundergrudge').name).toBe('快意恩仇');
    expect(by('tt7-thundergrudge').rarity).toBe('职业');
    expect(by('tt7-ironphalanx').cls).toBe('战士');
    expect(by('tt8-hero-summoner').cls).toBe('法师');
    expect(by('cc-unmoved')).toBeTruthy();
    expect(Cards.classPool('召唤师').length).toBe(0);
  });
  it('randomDropCard 只出五类且稀有度在权重表内', () => {
    for (let i = 0; i < 60; i++) {
      const c = Cards.randomDropCard();
      if (!c) continue;
      expect(Cards.DROP_TYPES).toContain(c.type);
      expect(Object.keys(Cards.DROP_WEIGHTS)).toContain(c.rarity);
    }
  });
  it('生物图鉴入卡库且不可随机/打出', async () => {
    await import('../game/src/battle.rules.js');
    const foe = Cards.all().find(c => c.type === '生物');
    expect(foe).toBeTruthy();
    const { unplayableReasonFor } = await import('../game/src/battle.rules.js');
    expect(unplayableReasonFor(foe, 'boss')).toMatch(/图鉴/);
  });
});

describe('meta 职业熟练度迁移冒烟', () => {
  it('侠客取刺客/剑客/游侠中最高一份', async () => {
    window.SDT.Base = { data: { classes: { 刺客: { lv: 3, xp: 10 }, 剑客: { lv: 5, xp: 0 } } }, save() {} };
    await import('../game/src/meta.js');
    const Meta = window.SDT.Meta;
    expect(Meta.classLv('侠客')).toBe(5);
  });
});
