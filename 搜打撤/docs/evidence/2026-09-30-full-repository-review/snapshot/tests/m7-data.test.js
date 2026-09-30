import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM7EquipRules, M7_EQUIP_MARKER_KEY } from '../game/src/cards/cards.sync.m7.js';

// These are the current TABLETOP10/11 canonical records, copied from the resolved runtime rows.
const CANONICAL = [
  { id: 'tt3-longsword', name: '长剑', cost: 0, rarity: '古朴', type: '装备', desc: '+1 攻。', dmg: 0, value: 2 },
  { id: 'tt3-staff', name: '法杖', cost: 0, rarity: '古朴', type: '装备', desc: '法伤 +1。', dmg: 0, value: 2 },
  { id: 'tt3-grass-armor', name: '草甲', cost: 0, rarity: '古朴', type: '装备', desc: '装备：装备时获得5点护甲。', dmg: 0, armor: 5, value: 2 },
  { id: 'tt3-light-mail', name: '急速跑鞋', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：抽3张牌', dmg: 0, draw: 3 },
  { id: 'tt3-holy-staff', name: '圣杖', cost: 0, rarity: '稀有', type: '装备', desc: '主动技能：净化并回复5血', dmg: 0, heal: 5, value: 3 },
  { id: 'tt2-treasuremap', name: '寻宝图', cost: 0, rarity: '古朴', type: '装备', dmg: 0, draw: 1, desc: '主动技能：将 1张‘搜索大宝箱’洗入牌库，抽1张牌。', value: 2, sellable: false },
  { id: 'tt12-raygun', name: '射线枪', cost: 0, rarity: '古朴', type: '装备', desc: '主动技能：发现一张射线牌并直接释放' },
  { id: 'tt7-talisman', name: '灵符', cost: 0, rarity: '稀有', type: '装备', desc: '对战开始时，额外抽 2 张牌。', dmg: 0, draw: 2, sellable: false, value: 3 },
  { id: 'tt3-blooddrinker', name: '饮血剑', cost: 0, rarity: '史诗', type: '装备', desc: '本局对战内，每消灭 1 个敌人，+1 点攻击力。', dmg: 0, value: 4 },
  { id: 'tt3-master-staff', name: '大法师之杖', cost: 0, rarity: '传说', type: '装备', desc: '回合开始时法伤 +1。', dmg: 0, value: 5 },
  { id: 'tt3-twinwater-mail', name: '冰甲', cost: 0, rarity: '古朴', type: '装备', desc: '冰冻 1 名敌人后，+3甲。', dmg: 0, armor: 3 },
  { id: 'tt2-apollo', name: '阿猫的礼物', cost: 0, rarity: '史诗', type: '装备', desc: '发现或随机获取该牌时，回复1点能量并获取另1张随机卡牌。', dmg: 0, value: 4 },
  { id: 'tt2-wreck', name: '沉船宝盒', cost: 0, rarity: '史诗', type: '装备', desc: '消耗该牌时，获取 2张随机卡牌。', dmg: 0, value: 4 },
  { id: 'tt8-archdemon', cls: '侠客', hero: true, tokenOf: 'tt8-hero-ranger', name: '天启诛魔剑', cost: 0, rarity: '衍生', type: '装备', desc: '获得 1 点攻击力，获得3张重斩。', dmg: 0, value: 8, unrandom: true },
  { id: 'tt7-arcanescroll', cls: '法师', name: '奥术残卷', cost: 0, rarity: '职业', type: '装备', dmg: 0, draw: 3, desc: '消耗该牌时抽 3 张牌。', value: 3, sellable: false },
];

const EXPECTED = {
  'tt3-longsword': { version: 1, equip: { passive: { aura: { atk: 1 } } } },
  'tt3-staff': { version: 1, equip: { passive: { aura: { spellPower: 1 } } } },
  'tt3-grass-armor': { version: 1, equip: { onEquip: [{ op: 'armor', amountField: 'armor' }] } },
  'tt3-light-mail': { version: 1, equip: { skill: { oncePerBattle: true, ops: [{ op: 'draw', amountField: 'draw' }] } } },
  'tt3-holy-staff': { version: 1, equip: { skill: { oncePerBattle: true, ops: [
    { op: 'cleanse', target: 'self' }, { op: 'heal', amountField: 'heal' },
  ] } } },
  'tt2-treasuremap': { version: 1, equip: { skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '搜索大宝箱' }, dest: 'deck' },
    { op: 'draw', amountField: 'draw' },
  ] } } },
  'tt12-raygun': { version: 1, equip: { skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '射线' }, dest: 'discover', act: 'play' },
  ] } } },
  'tt7-talisman': { version: 1, equip: { battleStart: [{ op: 'draw', amountField: 'draw' }] } },
  'tt3-blooddrinker': { version: 1, equip: { onEquip: [] }, triggers: { onKill: [{ op: 'blessing', key: 'atkUp', stacks: 1 }] } },
  'tt3-master-staff': { version: 1, equip: { onEquip: [] }, triggers: { onTurnStart: [{ op: 'blessing', key: 'spellUp', stacks: 1 }] } },
  'tt3-twinwater-mail': { version: 1, equip: { onEquip: [] }, triggers: { onFreezeDealt: [{ op: 'armor', amountField: 'armor' }] } },
  'tt2-apollo': { version: 1, equip: { onEquip: [] }, triggers: { onAcquire: [
    { op: 'energy', n: 1 }, { op: 'acquire', n: 1, pool: { kind: '随机' },
      filter: { exceptIds: ['tt2-apollo'] }, dest: 'hand' },
  ] } },
  'tt2-wreck': { version: 1, equip: { onEquip: [] }, triggers: { onConsume: [{ op: 'acquire', n: 2, pool: { kind: '随机' }, dest: 'hand' }] } },
  'tt8-archdemon': { version: 1, equip: {
    passive: { aura: { atk: 1 } },
    onEquip: [{ op: 'acquire', n: 3, pool: { kind: '重斩' }, dest: 'hand' }],
  } },
  'tt7-arcanescroll': { version: 1, equip: { onEquip: [] }, triggers: { onConsume: [{ op: 'draw', amountField: 'draw' }] } },
};

const fresh = () => CANONICAL.map(card => ({ ...card }));
function makeHarness(cards) {
  let store = cards.map(card => ({ ...card }));
  const values = new Map([[KEY, JSON.stringify(store)]]);
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const library = {
    TABLETOP10: CANONICAL.filter(card => ['tt8-archdemon', 'tt3-longsword', 'tt3-staff', 'tt3-grass-armor', 'tt3-light-mail', 'tt3-holy-staff', 'tt3-blooddrinker', 'tt3-master-staff', 'tt3-twinwater-mail', 'tt2-apollo', 'tt2-wreck'].includes(card.id)),
    TABLETOP11: CANONICAL.filter(card => ['tt7-arcanescroll', 'tt2-treasuremap', 'tt7-talisman'].includes(card.id)),
    TABLETOP12: CANONICAL.filter(card => card.id === 'tt12-raygun'),
    saves: 0,
    all: () => store,
    saveAll(next) {
      this.saves += 1;
      store = next.map(card => ({ ...card }));
      storage.setItem(KEY, JSON.stringify(store));
      return true;
    },
  };
  return { storage, library, cards: () => store };
}

describe('M7 装备收编数据回填', () => {
  for (const canonical of CANONICAL) {
    it(`${canonical.id}: schema/capability 双门通过并从当前 canonical 保守回填`, () => {
      const rules = EXPECTED[canonical.id];
      const card = { ...canonical, rules };
      expect(validateCardRules(card).ok).toBe(true);
      expect(inspectCardRuleCapability(card)).toMatchObject({ ok: true, kind: 'supported' });

      const harness = makeHarness(fresh());
      ensureM7EquipRules(harness);
      const migrated = harness.cards().find(item => item.id === canonical.id);
      expect(migrated.rules).toEqual(rules);
      const face = Object.fromEntries(Object.entries(migrated).filter(([key]) => key !== 'rules'));
      expect(face).toEqual(canonical);
      expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
      expect(harness.storage.getItem(M7_EQUIP_MARKER_KEY)).toBe('1');
      expect(harness.library.saves).toBe(1);
    });
  }

  it('marker 一次性，已改卡和自带 rules 的卡不覆盖', () => {
    const harness = makeHarness(fresh());
    ensureM7EquipRules(harness);
    ensureM7EquipRules(harness);
    expect(harness.library.saves).toBe(1);

    const changed = fresh();
    changed[0] = { ...changed[0], name: '玩家改名' };
    const preserved = makeHarness(changed);
    ensureM7EquipRules(preserved);
    expect(preserved.cards()[0]).toEqual(changed[0]);
    expect(preserved.cards()[0].rules).toBeUndefined();

    const owned = fresh();
    owned[0] = { ...owned[0], rules: { version: 1, equip: { passive: { aura: { atk: 9 } } } } };
    const ownedHarness = makeHarness(owned);
    ensureM7EquipRules(ownedHarness);
    expect(ownedHarness.cards()[0].rules.equip.passive.aura.atk).toBe(9);
  });

  it('缺失 canonical 卡或原始库串时不部分落库、不盖 marker', () => {
    const missing = makeHarness([fresh()[0]]);
    ensureM7EquipRules(missing);
    expect(missing.storage.getItem(M7_EQUIP_MARKER_KEY)).toBeNull();
    expect(missing.library.saves).toBe(0);

    const noRaw = makeHarness(fresh());
    noRaw.storage.getItem = () => null;
    ensureM7EquipRules(noRaw);
    expect(noRaw.storage.getItem(M7_EQUIP_MARKER_KEY)).toBeNull();
  });
});
