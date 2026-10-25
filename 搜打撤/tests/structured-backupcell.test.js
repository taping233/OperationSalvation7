import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { triggerExecutionPlan } from '../game/src/cards/card-execution-plan.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { sfx() {}, music() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(9, 99, 15, 0, 0, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Engine = await import('../game/src/battle/core/battle.engine.js');
const Cards = window.SDT.Cards;
const canonical = Cards.TABLETOP12.find(card => card.id === 'tt12-backupcell');

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

afterEach(() => { if (runtime.G?.battleActive) BattleSession.commands.flee(); });

function resolve(card, mode) {
  const logs = [];
  const game = { ownedCards: [{ uid: 'source', card }], hp: 20, maxHp: 20, atk: 1,
    spellPower: 0, coins: 0, myClass: null, state: 'idle', battleActive: false,
    log: message => logs.push(message), heal() {}, addItem() {}, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'foe', name: 'test foe', hp: 100, atk: 1 }], { isBoss: false });
  runtime.set$mode(mode);
  runtime.set$energy(2);
  runtime.set$maxEnergy(11);
  runtime.set$hand([]);
  if (mode === 'boss') {
    game.ownedCards.push({ uid: 'draw1', card: { id: 'draw1', name: '1', type: '武术', cost: 0 } },
      { uid: 'draw2', card: { id: 'draw2', name: '2', type: '武术', cost: 0 } });
    runtime.set$drawPile(['draw1', 'draw2']);
  }
  Engine.resolveCard(card, null, false, 0, 'source');
  const result = { energy: runtime.energy, maxEnergy: runtime.maxEnergy, drawn: runtime.hand.length,
    remaining: runtime.drawPile.length, logs:logs.map(log=>log.replaceAll('[[icon:draw-card]]','[[icon:cards]]')) };
  BattleSession.commands.flee();
  return result;
}

describe('后备能源的结构化打出合同', () => {
  it('has schema and runtime support; refill accepts no amount or bag shortcut', () => {
    expect(validateCardRules(canonical)).toMatchObject({ ok: true });
    expect(inspectCardRuleCapability(canonical)).toMatchObject({ ok: true });
    const invalid = structuredClone(canonical);
    invalid.rules.triggers.onPlay[1].n = 99;
    expect(validateCardRules(invalid).ok).toBe(false);
    expect(validateCardRules({ id: 'bag', rules: { version: 1,
      bag: { use: [{ op: 'refillEnergy' }] } } }).ok).toBe(false);
  });

  it.each(['normal', 'boss'])('preserves legacy draw and refill order in %s mode when display text changes', mode => {
    const structured = structuredClone(canonical);
    structured.desc = '展示文案已改：获得999点能量，抽99张牌。';
    const legacy = structuredClone(canonical);
    delete legacy.rules.triggers;
    // A historical unknown identity exercises the text adapter. Missing native
    // domains are deliberately inert after native declaration ownership.
    legacy.id = 'historical-backupcell-control';
    expect(triggerExecutionPlan(legacy, 'onPlay').kind).toBe('text');
    expect(triggerExecutionPlan(structured, 'onPlay').kind).toBe('structured');
    const previous = resolve(legacy, mode);
    const current = resolve(structured, mode);
    expect(current).toEqual(previous);
    expect(current).toMatchObject({ energy: 11, maxEnergy: 11, drawn: 2 });
  });

  it('upgrades a marked legacy library while preserving display edits and explicit player rules', () => {
    const legacy = structuredClone(canonical);
    delete legacy.rules.triggers;
    legacy.desc = '玩家改过的展示文案';
    Cards.saveAll([legacy, ...Cards.TABLETOP12.filter(card => card.id !== legacy.id)]);
    localStorage.setItem('sdt-cards-tt12-onplay-v1-seeded', '1');
    Cards.ensureTT12OnPlayRules();
    const upgraded = Cards.all().find(card => card.id === legacy.id);
    expect(upgraded.desc).toBe(legacy.desc);
    expect(upgraded.rules.triggers).toEqual(canonical.rules.triggers);
    const custom = { ...upgraded, rules: { ...upgraded.rules, triggers: { onPlay: [] } }, draw: 0 };
    Cards.saveAll(Cards.all().map(card => card.id === legacy.id ? custom : card));
    Cards.ensureTT12OnPlayRules();
    expect(Cards.all().find(card => card.id === legacy.id).rules.triggers.onPlay).toEqual([]);
  });
});
