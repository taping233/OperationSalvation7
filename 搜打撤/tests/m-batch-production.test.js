import approvedBatch from './fixtures/approved-card-batch-20261020.json';
import approvedNativeExecution from './fixtures/builtin-execution-approved-20261020.json';
const withApprovedExecution = card => ({ ...card, ...approvedNativeExecution[card.id]?.fields, ...(approvedNativeExecution[card.id] ? { rules: approvedNativeExecution[card.id].rules } : {}) });
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import before from '../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';
import { approvedRevisionBaseline, APPROVED_1018_PRODUCTION_REVISIONS, isApprovedLampArmorRemoval, RETIRED_1010 } from './helpers/card-catalog-approved-revisions.js';
import { isApprovedBackupcellRevision } from './helpers/e8-card-inventory.js';

const text = readFileSync('docs/M-BATCH-MATRIX.md', 'utf8');
const targetIds = [...text.matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
const excludes = readFileSync('docs/M-BATCH-EXCLUSIONS.md', 'utf8');
const excludedIds = [...excludes.matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
// 2026-10-18 已批准的生产文案/名称修订；固定前后值投影，原 before 与 CARDS_SYNC 不改。
const APPROVED_PRODUCTION_FACE_REVISIONS = [
  ["cmtn6bge52qt","desc","在背包中才能使用，复原最多两张卡牌","地图背包：从消耗区复原最多2张卡牌；战斗：从本场消耗牌复原最多2张回到手牌。对应消耗区为空时不可使用。"],
  ["foe-esper_candle","desc","攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击并灼烧。","攻击 9 / 生命 6。反抗能力者·第4层。掌心烈焰：攻击。"],
  ["foe-fire_el","desc","攻击 10 / 生命 7。变异·第4层。攻击并灼烧。","攻击 10 / 生命 7。变异·第4层。攻击。"],
  ["tt-crystal","desc","在背包中才能使用，可以复原最多 3 张卡牌。","地图背包：从消耗区复原最多3张卡牌；战斗：从本场消耗牌复原最多3张回到手牌。对应消耗区为空时不可使用。"],
  ["tt6-chestdraw","name","熔断双箱","熔断物资箱"],
];
function approvedProductionFaceBaseline(original) {
  const baseline = approvedRevisionBaseline(original);
  for (const [id, field, previous, current] of APPROVED_PRODUCTION_FACE_REVISIONS) {
    const card = baseline.production.cards.find(row => row.id === id)?.card;
    if (!card || card[field] !== previous) throw new Error(`Unreviewed original ${id}.${field}`);
    card[field] = current;
  }
  return baseline;
}
const currentBaseline = approvedProductionFaceBaseline(before);
let Cards, storage, first;

beforeAll(async () => {
  vi.resetModules();
  const values = new Map();
  storage = { getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key) };
  vi.stubGlobal('localStorage', storage);
  vi.stubGlobal('SDT', { Icons: { img: () => '', TYPE_ART: {} } });
  await import('../game/src/cards/cards.js');
  Cards = window.SDT.Cards;
  for (const name of ['ensureStarters', 'ensureSha', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) Cards[name]();
  first = structuredClone(Cards.all());
});
afterAll(() => vi.unstubAllGlobals());

describe('M batch production boot', () => {
  it('covers the agreed 150-card target and leaves exactly the 51 exclusions legacy', () => {
    expect(targetIds).toHaveLength(150);
    expect(new Set(targetIds).size).toBe(150);
    expect(excludedIds).toHaveLength(51);
    expect(first).toHaveLength(282);
    const missing = targetIds.filter(id => !RETIRED_1010.has(id) && !first.find(card => card.id === id)?.rules);
    console.info('M missing target rules', JSON.stringify(missing));
    expect(missing).toEqual([]);
    expect(first.filter(card => !card.rules).map(card => card.id).sort()).toEqual([...excludedIds].sort());
    for (const card of first) {
      expect(validateCardRules(card).ok, `${card.id}: schema`).toBe(true);
      expect(inspectCardRuleCapability(card).ok, `${card.id}: capability`).toBe(true);
    }
  });

  it('preserves every original ID and only changes explicitly migrated fields', () => {
    const old = currentBaseline.production.cards.map(row => row.card);
    expect(first.map(card => card.id).sort()).toEqual([...old, ...approvedBatch.additions].map(card => card.id).sort());
    for (const card of approvedBatch.additions) expect(first.find(current => current.id === card.id)).toEqual(withApprovedExecution(card));
    for (const previous of old) {
      const current = first.find(card => card.id === previous.id);
      if (previous.id === approvedBatch.flame.id) {
        expect(current).toEqual(withApprovedExecution(approvedBatch.flame));
        expect(previous.desc).toBe('本局对战中，法伤+1');
        continue;
      }
      if (previous.id === 'tt12-backupcell') {
        expect(isApprovedBackupcellRevision(previous, current)).toBe(true);
        continue;
      }
      const fields = Object.keys({ ...previous, ...current }).filter(key =>
        JSON.stringify(previous[key]) !== JSON.stringify(current[key]));
      if (previous.id === 'tt3-magic-lamp') expect(isApprovedLampArmorRemoval(previous, current)).toBe(true);
      const allowed = previous.id === 'tt3-dig-treasure' ? ['rules', 'desc']
        : previous.id === 'tt3-noon-duel' ? ['rules', 'dmg', 'dmgType']
        : previous.id === 'tt3-mystery-potion' ? ['rules', 'desc']
        : previous.id === 'tt3-petal' ? ['rules', 'desc', 'heal']
        // 2026-10-02 老板拍板：自然形态→满月形态，转牧师职业卡（id 不变）。
        : previous.id === 'tt3-nature-form' ? ['rules', 'name', 'rarity', 'cls', 'unrandom']
        // 2026-10-21 老板实测 12 条 #1：影噬调史诗（仅 rarity 一格；神灯第 1 项文案改
        //「发现招式」由 helper 基线投影处理，卡面差集仍是 rules+armor）。
        : previous.id === 'tt3sp-shadowbug' ? ['rules', 'rarity']
        : previous.id === 'tt3-magic-lamp' ? ['rules', 'armor'] : ['rules'];
      const approvedFields = approvedNativeExecution[previous.id]?.fields || {};
      for (const [key, value] of Object.entries(approvedFields)) expect(current[key], `${previous.id}.${key}`).toEqual(value);
      expect(fields.filter(key => !allowed.includes(key) && !Object.hasOwn(approvedFields, key)), previous.id).toEqual([]);
      if (previous.id === 'tt3-dig-treasure') expect(current.desc).toBe('从牌库底三张牌中发现1张牌，并获得等同于其价格的护甲。');
      if (excludedIds.includes(previous.id)) expect(current).toEqual(previous);
    }
  });

  it('五条批准文案和名称修订只改变精确字段，现有规则与数值保持原值', () => {
    for (const [id] of APPROVED_PRODUCTION_FACE_REVISIONS) {
      expect(first.find(card => card.id === id)).toEqual(currentBaseline.production.cards.find(row => row.id === id).card);
    }
  });

  it('事件与腐化之种投影精确批准值，生产初始化不扩展字段白名单', () => {
    for (const [id, field, , current] of APPROVED_1018_PRODUCTION_REVISIONS) {
      expect(first.find(card => card.id === id)[field], `${id}.${field}`).toBe(current);
    }
    expect(first.find(card => card.id === 'cc-rot-seed').rules).toEqual(approvedNativeExecution['cc-rot-seed'].rules);
  });

  it('神秘药水文案只同步主动战斗与下回合时点，使用批准的延迟结构声明', () => {
    expect(currentBaseline.production.cards.find(row => row.id === 'tt3-mystery-potion').card.desc)
      .toBe('回合开始时：变成1张随机招式卡牌，使其费用为0。');
    const card = first.find(card => card.id === 'tt3-mystery-potion');
    expect(card.desc).toBe('仅战斗中使用。使用后，下回合开始时：变成1张随机招式卡牌，使其费用为0。');
    expect(card.rules).toEqual(approvedNativeExecution['tt3-mystery-potion'].rules);
  });

  it('repeated production initialization preserves every migrated rule', () => {
    Cards.ensureTabletop();
    Cards.ensureDmgTypes();
    Cards.ensureEffectFields();
    const rulesById = cards => cards.map(({ id, rules }) => ({ id, rules }));
    expect(rulesById(Cards.all())).toEqual(rulesById(first));
  });
});
