import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { dataSlice } from '../game/src/cards/cards.data.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM7EquipRules, M7_EQUIP_MARKER_KEY } from '../game/src/cards/cards.sync.m7.js';

const EXPECTED = {
  'tt3-longsword': { version: 1, equip: { passive: { aura: { atk: 1 } } } },
  'tt3-staff': { version: 1, equip: { passive: { aura: { spellPower: 1 } } } },
  'tt3-grass-armor': { version: 1, equip: { onEquip: [{ op: 'armor', amountField: 'armor' }] } },
  'tt3-light-mail': { version: 1, equip: { skill: { oncePerBattle: true, ops: [{ op: 'draw', amountField: 'draw' }] } } },
  'tt3-holy-staff': { version: 1, equip: { skill: { oncePerBattle: true, ops: [
    { op: 'cleanse', target: 'self' }, { op: 'heal', amountField: 'heal' },
  ] } } },
  'tt2-treasuremap': { version: 1, equip: { skill: { oncePerBattle: true, ops: [
    { op: 'acquire', n: 1, pool: { kind: '搜索军用保险柜' }, dest: 'deck' },
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

// 卡面取当前解析后的正式数据；规则期望独立保留，避免手抄旧名称与旧描述。
const TABLE_BY_ID = { 'tt2-treasuremap':'TABLETOP11', 'tt7-arcanescroll':'TABLETOP11', 'tt7-talisman':'TABLETOP11', 'tt12-raygun':'TABLETOP12' };
const CANONICAL = Object.keys(EXPECTED).map(id => {
  const row = dataSlice[TABLE_BY_ID[id] || 'TABLETOP10'].find(card => card?.id === id);
  if (!row) throw Error('Missing current equipment: ' + id);
  return Object.fromEntries(Object.entries(row).filter(([key]) => key !== 'rules'));
});

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
  it.each(CANONICAL)('$id: 当前装备规则通过 schema 与消费能力校验', canonical => {
    const card = { ...canonical, rules:EXPECTED[canonical.id] };
    expect(validateCardRules(card), canonical.id).toMatchObject({ ok:true, errors:[] });
    expect(inspectCardRuleCapability(card), canonical.id).toMatchObject({ ok:true, kind:'supported' });
  });

  it('完整批次一次回填当前装备，卡面与保存结果逐卡一致', () => {
    const harness = makeHarness(fresh());
    ensureM7EquipRules(harness);
    expect(harness.cards().map(card => card.id).sort()).toEqual(Object.keys(EXPECTED).sort());
    for (const canonical of CANONICAL) {
      const migrated = harness.cards().find(item => item.id === canonical.id);
      expect(migrated.rules, canonical.id).toEqual(EXPECTED[canonical.id]);
      const face = Object.fromEntries(Object.entries(migrated).filter(([key]) => key !== 'rules'));
      expect(face, canonical.id).toEqual(canonical);
    }
    expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
    expect(harness.storage.getItem(M7_EQUIP_MARKER_KEY)).toBe('1');
    expect(harness.library.saves).toBe(1);
  });

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
