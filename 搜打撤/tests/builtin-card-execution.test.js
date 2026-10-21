import { describe, expect, it } from 'vitest';
import { sourceCardLibrary } from '../scripts/sync-cards-from-live.mjs';
import { BUILTIN_EXECUTION_REVISIONS, migrateBuiltinExecutionCard } from '../game/src/cards/builtin-card-execution.js';
import { BUILTIN_PREVIOUS_RULES } from '../game/src/cards/builtin-card-previous-rules.js';
import { BATTLE_TRIGGER_POINTS } from '../game/src/cards/card-trigger-contract.js';
import { triggerExecutionPlan, equipmentExecutionPlan, createCardRuleExecutionView } from '../game/src/cards/card-execution-plan.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { ensureBuiltinExecutionRules } from '../game/src/cards/cards.sync.builtin.js';
import { BUILTIN_EXECUTABLE_IDS } from '../game/src/cards/builtin-card-identities.js';
import { targetSideFor, isAreaEffect, unplayableReasonFor } from '../game/src/battle/effects/battle.target-rules.js';
import approvedExecution from './fixtures/builtin-execution-approved-20261020.json';

const library = sourceCardLibrary();

describe('native execution declarations', () => {
  it('covers every active executable identity and leaves zero hosted source declarations', () => {
    const executable = library.filter(card => ['道具', '装备', '法术', '武术', '能力卡'].includes(card.type));
    expect(new Set(executable.map(card => card.id))).toEqual(new Set(BUILTIN_EXECUTABLE_IDS));
    expect(executable.filter(card => !card.rules || card.rules.battle?.hosted?.length)).toEqual([]);
    for (const card of executable) {
      for (const point of BATTLE_TRIGGER_POINTS) expect(triggerExecutionPlan(card, point).kind, `${card.id}:${point}`).toBe('structured');
      for (const point of ['onEquip', 'battleStart', 'skill']) expect(equipmentExecutionPlan(card, point).kind, `${card.id}:${point}`).toBe('structured');
    }
  });
  it('matches the independent approved declaration inventory exactly', () => {
    expect(BUILTIN_EXECUTION_REVISIONS).toEqual(approvedExecution);
  });
  it('carries explicit silence policy through active and delayed views without granting it to ordinary items', () => {
    const potion = library.find(card => card.id === 'tt3-mystery-potion');
    const active = createCardRuleExecutionView(potion, potion.rules.triggers.onPlay);
    const delayed = createCardRuleExecutionView(active, active.rules.triggers.onPlay[0].ops);
    expect(active.rules.battle.ignoresSilence).toBe(true);
    expect(delayed.rules.battle.ignoresSilence).toBe(true);
    const ordinary = library.find(card => card.id === 'tt-jinchuangyao');
    expect(createCardRuleExecutionView(ordinary, ordinary.rules.bag.use).rules.battle.ignoresSilence).toBeUndefined();
    expect(validateCardRules({ ...potion, rules: { ...potion.rules, battle: { ...potion.rules.battle, ignoresSilence: 'yes' } } }).ok).toBe(false);
  });
  it('runs every migrated source card through schema and capability, with no hosted owner', () => {
    for (const id of Object.keys(BUILTIN_EXECUTION_REVISIONS)) {
      const card = library.find(candidate => candidate.id === id);
      expect(card, id).toBeTruthy();
      expect(card.rules.battle?.hosted, id).toBeUndefined();
      expect(validateCardRules(card), id).toMatchObject({ ok: true });
      expect(inspectCardRuleCapability(card), id).toMatchObject({ ok: true });
      for (const point of BATTLE_TRIGGER_POINTS) expect(triggerExecutionPlan(card, point).kind, `${id}:${point}`).toBe('structured');
      for (const point of ['onEquip', 'battleStart', 'skill']) expect(equipmentExecutionPlan(card, point).kind, `${id}:${point}`).toBe('structured');
    }
  });

  it('keeps absent native domains inert even if display text gains another effect', () => {
    const card = { ...library.find(candidate => candidate.id === 'tt3-noon-duel'),
      desc: '抽到时获得99点能量；消耗时获得99点能量；每回合开始时回复99血。' };
    for (const point of ['onDraw', 'onConsume', 'onTurnStart']) expect(triggerExecutionPlan(card, point)).toEqual({ kind: 'structured', ops: [] });
    const custom = { ...card, id: 'player-created' };
    expect(triggerExecutionPlan(custom, 'onDraw').kind).toBe('text');
    const historical = { ...card, id: 'unknown-historical' };
    expect(triggerExecutionPlan(historical, 'onConsume').kind).toBe('text');
  });

  it('upgrades exact former native rules after display edits, and preserves explicit player rules', () => {
    const native = library.find(candidate => candidate.id === 'tt7-arcanebolt');
    const old = { ...native, name: '玩家改名', desc: '展示文字不再说明任何规则', rules: structuredClone(BUILTIN_PREVIOUS_RULES[native.id]) };
    const next = migrateBuiltinExecutionCard(old);
    expect(next.name).toBe(old.name); expect(next.desc).toBe(old.desc);
    expect(next.rules).toEqual(native.rules); expect(next.rules).not.toBe(native.rules);
    expect(migrateBuiltinExecutionCard(next)).toBe(next);
    const explicit = { ...old, rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [] } } };
    expect(migrateBuiltinExecutionCard(explicit)).toBe(explicit);
  });

  it('applies one validated, idempotent library update and preserves a failed storage result', () => {
    const native = library.find(candidate => candidate.id === 'tt7-arcanebolt');
    let cards = [{ ...native, rules: structuredClone(BUILTIN_PREVIOUS_RULES[native.id]) }];
    const original = cards;
    const api = { all: () => cards, saveAll: next => { cards = next; } };
    expect(ensureBuiltinExecutionRules(api)).toBe(1);
    expect(ensureBuiltinExecutionRules(api)).toBe(0);
    expect(original[0].rules).toEqual(BUILTIN_PREVIOUS_RULES[native.id]);
    expect(ensureBuiltinExecutionRules({ all: () => original, saveAll: () => false })).toBe(false);
  });

  it('dig-treasure declares three bottom-deck candidates and one selected-card price reward', () => {
    const card = library.find(candidate => candidate.id === 'tt3-dig-treasure');
    expect(card.desc).toContain('三张牌中发现1张');
    expect(card.rules.triggers.onPlay).toEqual([
      { op: 'acquire', n: 3, pool: { kind: '牌库底' }, dest: 'discover' },
      { op: 'armor', priceOf: 'discovered' },
    ]);
  });

  it('does not recover native target, area or hand-payment requirements from changed display text', () => {
    const original = library.find(card => card.id === 'tt8-hero-mage');
    const changed = { ...original, desc: '全体敌人。消耗 3 张手牌。无法打出。' };
    expect(targetSideFor(changed, ['武术', '法术'])).toBe(targetSideFor(original, ['武术', '法术']));
    expect(isAreaEffect(changed)).toBe(isAreaEffect(original));
    expect(unplayableReasonFor(changed, 'boss', { handCards: [], selfCard: changed })).toBeNull();
    const custom = { ...changed, id: 'custom-mage' };
    expect(unplayableReasonFor(custom, 'boss', { handCards: [], selfCard: custom })).toBeTruthy();
  });

  it('preflights nested choice and scheduled operations before any effect can be paid', () => {
    const nested = { id: 'custom-nested', type: '法术', rules: { version: 1, triggers: { onPlay: [
      { op: 'choice', options: [
        { label: 'bad', ops: [{ op: 'transform', what: 'self', into: {} }] },
        { label: 'safe', ops: [] },
      ] },
    ] } } };
    expect(validateCardRules(nested).ok).toBe(true);
    expect(inspectCardRuleCapability(nested)).toMatchObject({ ok: false });
    const scheduled = structuredClone(nested);
    scheduled.rules.triggers.onPlay = [{ op: 'schedule', delay: 1, ops: [{ op: 'transform', what: 'self', into: {} }] }];
    expect(inspectCardRuleCapability(scheduled)).toMatchObject({ ok: false });
  });
});
