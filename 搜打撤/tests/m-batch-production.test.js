import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import before from '../docs/evidence/e8-card-migration-2026-09-27/catalog-before.json';
import { approvedRevisionBaseline, isApprovedLampArmorRemoval, RETIRED_1010 } from './helpers/card-catalog-approved-revisions.js';
import { isApprovedBackupcellRename } from './helpers/e8-card-inventory.js';

const text = readFileSync('docs/M-BATCH-MATRIX.md', 'utf8');
const targetIds = [...text.matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
const excludes = readFileSync('docs/M-BATCH-EXCLUSIONS.md', 'utf8');
const excludedIds = [...excludes.matchAll(/^\| ([a-z][\w-]+) \|/gm)].map(match => match[1]).filter(id => id !== 'id');
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
    expect(first).toHaveLength(268);
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
    const old = approvedRevisionBaseline(before).production.cards.map(row => row.card);
    expect(first.map(card => card.id).sort()).toEqual(old.map(card => card.id).sort());
    for (const previous of old) {
      const current = first.find(card => card.id === previous.id);
      if (previous.id === 'tt12-backupcell') {
        expect(isApprovedBackupcellRename(previous, current)).toBe(true);
        continue;
      }
      const fields = Object.keys({ ...previous, ...current }).filter(key =>
        JSON.stringify(previous[key]) !== JSON.stringify(current[key]));
      if (previous.id === 'tt3-magic-lamp') expect(isApprovedLampArmorRemoval(previous, current)).toBe(true);
      const allowed = previous.id === 'tt3-noon-duel' ? ['rules', 'dmg', 'dmgType']
        : previous.id === 'tt3-petal' ? ['rules', 'desc', 'heal']
        // 2026-10-02 老板拍板：自然形态→满月形态，转牧师职业卡（id 不变）。
        : previous.id === 'tt3-nature-form' ? ['rules', 'name', 'rarity', 'cls', 'unrandom']
        : previous.id === 'tt3-magic-lamp' ? ['rules', 'armor'] : ['rules'];
      expect(fields.filter(key => !allowed.includes(key)), previous.id).toEqual([]);
      if (excludedIds.includes(previous.id)) expect(current).toEqual(previous);
    }
  });

  it('repeated production initialization preserves every migrated rule', () => {
    Cards.ensureTabletop();
    Cards.ensureDmgTypes();
    Cards.ensureEffectFields();
    const rulesById = cards => cards.map(({ id, rules }) => ({ id, rules }));
    expect(rulesById(Cards.all())).toEqual(rulesById(first));
  });
});
