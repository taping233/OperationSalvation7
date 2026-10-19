import { describe, expect, it } from 'vitest';
import { KEY } from '../game/src/cards/cards.consts.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureM10HostedEquipmentRules, M10_HOSTED_EQUIPMENT_MARKER_KEY } from '../game/src/cards/cards.sync.m10.js';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {} };
window.SDT.MAP = { rules: { battleEnergy: 6, battleHandMax: 8, bossDeckSize: 15,
  starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
items: { rations: { name: '口粮' }, wood: { name: '木材' } } };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha();
Cards.ensureStarters();
Cards.ensureTabletop();
Cards.ensureDmgTypes();
Cards.ensureEffectFields();

const RULE_NAME = new Map([
  ['tt2-frostsword', 'frost-sword'], ['tt3-crimson-pouch', 'crimson-pouch'],
  ['tt3-fate-wheel', 'fate-wheel'],
  ['tt3-azure-sword', 'azure-sword'], ['tt3-chaos-eye', 'chaos-eye'],
  ['tt3-immortal-blade', 'immortal-blade'], ['tt3-silver-runesword', 'silver-runesword'],
  ['tt3-sapper-bomb', 'sapper-bomb'], ['tt3-wolf-bow', 'wolf-bow'],
  ['tt3-reverse-bow', 'reverse-bow'],
]);
const CANONICAL = [...RULE_NAME.keys()].map(id => Cards.TABLETOP10.find(card => card.id === id));
if (CANONICAL.some(card => !card)) throw new Error('M10 canonical TABLETOP10 equipment row missing');
const EXPECTED = Object.fromEntries([...RULE_NAME].map(([id, name]) => [id,
  { version: 1, battle: { hosted: [name] },
    ...(id === 'tt2-frostsword' ? { equip: { passive: { cond: { vsFreeze: 2 } } } } : {}),
  },
]));

function makeHarness(cards) {
  let store = cards.map(card => ({ ...card }));
  const values = new Map([[KEY, JSON.stringify(store)]]);
  const storage = {
    getItem: key => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
  };
  const library = {
    TABLETOP10: Cards.TABLETOP10,
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

describe('M10 hosted 装备数据回填', () => {
  it('全部 10 张存活 hosted id/name 绑定通过 schema 与 capability', () => {
    expect(CANONICAL).toHaveLength(10);
    for (const card of CANONICAL) {
      const candidate = { ...card, rules: EXPECTED[card.id] };
      expect(validateCardRules(candidate).ok, `${card.id} schema`).toBe(true);
      expect(inspectCardRuleCapability(candidate), `${card.id} capability`).toMatchObject({
        ok: true, kind: 'supported',
      });
    }
  });

  it('从 TABLETOP10 当前 canonical 回填全批，保存复读后才盖 marker', () => {
    const harness = makeHarness(CANONICAL);
    ensureM10HostedEquipmentRules(harness);
    for (const canonical of CANONICAL) {
      const migrated = harness.cards().find(card => card.id === canonical.id);
      expect(migrated.rules).toEqual(EXPECTED[canonical.id]);
      const face = Object.fromEntries(Object.entries(migrated).filter(([key]) => key !== 'rules'));
      expect(face).toEqual(canonical);
    }
    expect(harness.storage.getItem(KEY)).toBe(JSON.stringify(harness.cards()));
    expect(harness.storage.getItem(M10_HOSTED_EQUIPMENT_MARKER_KEY)).toBe('1');
    expect(harness.library.saves).toBe(1);
    ensureM10HostedEquipmentRules(harness);
    expect(harness.library.saves).toBe(1);
  });

  it('旧版寒冰剑 hosted 声明补入冰冻增伤，保留其他装备声明', () => {
    const legacy = CANONICAL.map(card => ({ ...card, rules: { version: 1, battle: { hosted: [RULE_NAME.get(card.id)] } } }));
    const harness = makeHarness(legacy);
    harness.storage.setItem('sdt-cards-m10-hosted-equipment-v1-seeded', '1');
    ensureM10HostedEquipmentRules(harness);
    expect(harness.cards()[0].rules).toEqual(EXPECTED['tt2-frostsword']);
    expect(harness.cards()[1]).toEqual(legacy[1]);
    expect(harness.library.saves).toBe(1);
  });

  it('不覆盖玩家改卡或已有 rules；缺卡时不部分保存、不盖 marker', () => {
    const changed = CANONICAL.map(card => ({ ...card }));
    changed[0] = { ...changed[0], name: '玩家改名' };
    const changedHarness = makeHarness(changed);
    ensureM10HostedEquipmentRules(changedHarness);
    expect(changedHarness.cards()[0]).toEqual(changed[0]);
    expect(changedHarness.cards()[0].rules).toBeUndefined();
    expect(changedHarness.cards()[1].rules).toEqual(EXPECTED[changedHarness.cards()[1].id]);

    const missingHarness = makeHarness(CANONICAL.slice(0, 1));
    ensureM10HostedEquipmentRules(missingHarness);
    expect(missingHarness.library.saves).toBe(0);
    expect(missingHarness.storage.getItem(M10_HOSTED_EQUIPMENT_MARKER_KEY)).toBeNull();
  });
});
