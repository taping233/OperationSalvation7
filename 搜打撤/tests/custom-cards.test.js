/* 卡牌库完整性检查（2026-09-10 需求批次 v4–v10）：
 * 跑完整 ensure 迁移链后逐张核验本会话新增/改版卡牌——字段、唯一性、随机池归属。 */
import { describe, it, expect, beforeAll } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 3, battleHandMax: 10, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards.js');
const C = window.SDT.Cards;

beforeAll(() => {
  C.ensureSha();
  C.ensureStarters();
  C.ensureTabletop();   // 完整迁移链（含 ensureCardsSyncLive v10）
  C.ensureDmgTypes();
  C.ensureEffectFields();
});

// 本会话新增的卡：id → 期望字段
const NEW_CARDS = [
  { id: 'cc-rapid-fire',  name: '连续射击', cost: 1, rarity: '史诗', type: '武术', dmgType: 'fixed' },
  { id: 'cc-mana-surge',  name: '法力奔涌', cost: 2, rarity: '传说', type: '法术' },
  { id: 'cc-chase-slash', name: '追斩',     cost: 2, rarity: '稀有', type: '武术', dmgType: 'attack' },
  { id: 'cc-cursed-blade', name: '诅咒之刃', cost: 2, rarity: '稀有', type: '武术', dmgType: 'attack' },
  { id: 'cc-lava-blast',  name: '熔岩爆破', cost: 2, rarity: '稀有', type: '法术', dmgType: 'spell' },
  { id: 'cc-double-boom', name: '二次爆炸', cost: 1, rarity: '衍生', type: '法术', dmgType: 'spell' },
];

describe('卡牌库完整性（2026-09-10 批次 v4–v10）', () => {
  it('全部新卡存在、字段正确、每张 id 在库中恰好一份', () => {
    const all = C.all();
    NEW_CARDS.forEach(e => {
      const hits = all.filter(c => c.id === e.id);
      expect(hits.length, `${e.name}（${e.id}）应恰好有一份`).toBe(1);
      const c = hits[0];
      expect(c.name).toBe(e.name);
      expect(c.cost).toBe(e.cost);
      expect(c.rarity).toBe(e.rarity);
      expect(c.type).toBe(e.type);
      if (e.dmgType) expect(c.dmgType).toBe(e.dmgType);
      if (e.heal) expect(c.heal).toBe(e.heal);
      expect(String(c.desc || '').length).toBeGreaterThan(0);
    });
  });

  it('迷之匣已改版为主动技能（旧开战被动移除；2026-09-16 留言措辞变更）', () => {
    const hits = C.all().filter(c => c.id === 'tt3eq-mistbox');
    expect(hits.length).toBe(1);
    const c = hits[0];
    expect(c.type).toBe('装备');
    expect(c.desc).toContain('主动技能');
    expect(c.desc).toContain('发现两张随机招式');
    expect(c.desc).toContain('交换其费用');
    expect(c.desc).not.toContain('对战开始时');
  });

  it('全库 id 无重复', () => {
    const all = C.all();
    const ids = all.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('随机池归属：衍生 token 不进池，其余新卡可随机获取', () => {
    const obtainable = id => C.isRandomObtainable(C.all().find(c => c.id === id));
    expect(obtainable('cc-rapid-fire')).toBe(true);
    expect(obtainable('cc-mana-surge')).toBe(true);
    expect(obtainable('cc-chase-slash')).toBe(true);
    expect(obtainable('cc-cursed-blade')).toBe(true);
    expect(obtainable('cc-lava-blast')).toBe(true);
    expect(obtainable('cc-double-boom')).toBe(false);   // 衍生 token：仅熔岩爆破置入
  });
});
