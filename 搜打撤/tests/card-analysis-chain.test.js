import { expect, it, vi } from 'vitest';
import { analyzeCardRules, inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { createRuleBackfiller } from '../game/src/cards/cards.sync.backfiller.js';
import { assertCardRulesExecutable } from '../game/src/battle/effects/battle.rule-guard.js';
import { KEY } from '../game/src/cards/cards.consts.js';

const healRules = amount => ({ version: 1, battle: { target: { side: 'self', area: false } },
  triggers: { onPlay: [{ op: 'heal', amount }] } });

it('rechecks the next operation after an in-place change and ignores edited receipts', () => {
  const card = { id: 'analysis', type: '法术', rules: healRules(1) };
  expect(analyzeCardRules(card).capability.ok).toBe(true);
  card.rules.triggers.onPlay[0].amount = 0;
  const rejected = analyzeCardRules(card);
  expect(rejected.validation.ok).toBe(false);
  expect(rejected.capability).toMatchObject({ kind: 'invalid', ok: false });
  expect(() => assertCardRulesExecutable(card)).toThrow('Invalid card rules');
  rejected.validation.ok = true;
  expect(analyzeCardRules(card).validation.ok).toBe(false);
  card.rules.triggers.onPlay[0].amount = 2;
  expect(analyzeCardRules(card).capability).toEqual(inspectCardRuleCapability(card));
  expect(analyzeCardRules(card).capability.ok).toBe(true);
});

it('validates the registered-trigger preflight view separately from the valid root', () => {
  const card = { id: 'registered', type: '法术', rules: healRules(1),
    _registeredTriggers: { onDraw: [{ op: 'not-implemented' }] } };
  const analysis = analyzeCardRules(card);
  expect(analysis.validation.ok).toBe(true);
  expect(analysis.capability).toEqual(inspectCardRuleCapability(card));
  expect(analysis.capability).toMatchObject({ kind: 'invalid', ok: false });
});

function migration(rules) {
  const canonical = { id: 'candidate', type: '法术' };
  let cards = [canonical];
  const values = new Map([[KEY, JSON.stringify(cards)]]);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const library = { CANONICAL: [canonical], all: () => cards, saveAll: vi.fn(next => {
    cards = next; storage.setItem(KEY, JSON.stringify(next)); return true;
  }) };
  const ensure = createRuleBackfiller({ label: 'analysis', markerKey: 'analysis-marker',
    definitions: new Map([[canonical.id, { rules }]]), canonicalTableById: new Map([[canonical.id, 'CANONICAL']]) });
  return { library, storage, run: () => ensure({ library, storage }) };
}

it.each([
  [healRules(0), 'validation failed'],
  [{ version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onPlay: [{ op: 'draw', amount: 1, handOps: [{ op: 'copyRandom' }] }] } }, 'capability unsupported'],
])('does not persist or mark a rejected analysis (%s)', (rules, message) => {
  const fixture = migration(rules);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    fixture.run();
    expect(fixture.library.saveAll).not.toHaveBeenCalled();
    expect(fixture.storage.getItem('analysis-marker')).toBeNull();
    expect(error.mock.calls.flat().join(' ')).toContain(message);
  } finally { error.mockRestore(); }
});

it('retries a rejected persistence attempt without marking success early', () => {
  const fixture = migration(healRules(1));
  fixture.library.saveAll.mockReturnValueOnce(false);
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    fixture.run();
    expect(fixture.storage.getItem('analysis-marker')).toBeNull();
    fixture.run();
    expect(fixture.library.saveAll).toHaveBeenCalledTimes(2);
    expect(fixture.storage.getItem('analysis-marker')).toBe('1');
  } finally { error.mockRestore(); }
});
