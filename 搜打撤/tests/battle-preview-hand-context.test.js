import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCardPlayDomain } from '../game/src/battle/core/battle.card-play.domain.js';
import { createInspectionDomain } from '../game/src/battle/effects/battle.card-inspection.domain.js';
import * as Capability from '../game/src/cards/card-rules.capability.js';

const card = (extra = {}) => ({ id: 'preview-context', name: '群体招式', type: '法术', cost: 1, desc: '', dmg: 3, dmgType: 'spell',
  rules: { version: 1, battle: { target: { side: 'enemy', area: true }, requirements: [] },
    triggers: { onPlay: [{ op: 'damage', amount: 3, target: 'allEnemies' }] } }, ...extra });
const payment = (count = 2, type = null) => {
  const value = card();
  value.rules.battle.requirements = [{ kind: 'handCards', count, ...(type ? { type } : {}) }];
  return value;
};
const starter = () => card({ id: 'preview-starter', name: '初始攻击', type: '武术' });
function setup(cards, catalog = {}) {
  const state = {
    G: { battleActive: true, log() {} }, battleState: { token: 1, phase: 'player' },
    hand: cards.map((_, i) => `u${i}`), mode: 'boss', equipped: [],
    foes: Array.from({ length: 4 }, (_, i) => ({ id: `foe-${i}`, hp: 30, dead: false })),
    energy: 9, freeCast: new Set(), game: { ownedCards: cards.map((value, i) => ({ uid: `u${i}`, card: value })) },
    cardOverrides: new Map(), granted: [], shaTransform: null, interaction: null,
  };
  const inspection = createInspectionDomain({}).createBattleCardInspection({ cards: catalog, readState: () => state });
  const services = {
    readState: () => state, findCard: vi.fn(inspection.findCard), findEffectiveCard: vi.fn(inspection.findEffectiveCard),
    alive: () => state.foes.filter(foe => !foe.dead), equipCap: () => 2, hasPendingEndTurn: () => false,
    effCostOf: vi.fn(value => value.cost), infuseOf: value => value.infuse || 0,
    infusionFuelReason: inspection.infusionFuelReason, damageTypes: () => ['武术', '法术'],
    interactionOf: kind => state.interaction?.kind === kind ? state.interaction : null,
    requestedTargetReason: vi.fn(() => null), executeTargetReason: vi.fn(() => null),
    executionAvailability: vi.fn(() => null), warnCardRuleRejection: vi.fn(), requestBattleRender: vi.fn(),
    submitExecution: vi.fn(uid => ({ status: 'accepted', uid, battleToken: state.battleState.token })),
    set$interaction: value => { state.interaction = value; }, set$pendingHint: vi.fn(),
  };
  const domain = createCardPlayDomain({}).createBattleCardPlay(services);
  const availability = (index = 0, context = null) => domain.getCardPlayAvailability('u0', index, false, context);
  return { state, inspection, services, domain, availability };
}
afterEach(() => vi.restoreAllMocks());

describe('single-hover raw-hand context at the command boundary', () => {
  it('shares only hand projection with the preview check, not target costs or capabilities', () => {
    const values = Array.from({ length: 9 }, () => card());
    const { availability, domain, services } = setup(values);
    const inspect = vi.spyOn(Capability, 'inspectCardRuleCapability');
    const context = {};
    expect(domain.unplayableReason(values[0], context)).toBeNull();
    for (let i = 0; i < 4; i++) expect(availability(i, context).status).toBe('ready');
    expect(services.findCard).toHaveBeenCalledTimes(9);
    expect(services.findEffectiveCard).toHaveBeenCalledTimes(4);
    expect(services.effCostOf).toHaveBeenCalledTimes(4);
    expect(inspect).toHaveBeenCalledTimes(4);
    expect(services.requestedTargetReason.mock.calls.map(([, target]) => target.id)).toEqual(['foe-0', 'foe-1', 'foe-2', 'foe-3']);
    expect(services.executeTargetReason).toHaveBeenCalledTimes(4);
    expect(services.executionAvailability).toHaveBeenCalledTimes(4);
    expect(context.handCards.map(entry => entry.card)).toEqual(values);
    values.forEach((value, index) => expect(context.handCards[index].card).toBe(value));
  });

  it('excludes duplicate raw self references and missing UIDs in command availability', () => {
    const self = payment(2), fuel = starter();
    const { state, availability } = setup([self, self, fuel]);
    state.hand.push('missing');
    const context = {};
    expect(availability(0, context)).toMatchObject({ status: 'rejected', reason: { code: 'CARD_UNPLAYABLE' } });
    expect(availability(1, context).reason.message).toContain('现有 1 张');
    expect(context.handCards).toHaveLength(3);
    expect(context.handCards[0].card).toBe(self);
    expect(context.handCards[1].card).toBe(self);
  });

  it('retains override -> owned -> granted priority and raw override self identity', () => {
    const { state, availability } = setup([starter(), starter()]);
    const self = payment(2, '初始攻击'), owned = state.game.ownedCards[1].card, granted = starter();
    state.cardOverrides.set('u0', self);
    state.granted.push({ uid: 'u1', card: card({ type: '资源' }) }, { uid: 'g', card: granted });
    state.hand.push('g');
    const context = {};
    expect(availability(0, context).status).toBe('ready');
    expect(context.handCards[0].card).toBe(self);
    expect(context.handCards[1].card).toBe(owned);
    expect(context.handCards[2].card).toBe(granted);
    state.cardOverrides.set('g', card({ type: '资源' }));
    expect(availability(0, {}).reason.message).toContain('现有 1 张');
  });

  it('keeps transformed execution faces separate from raw hand payment identity', () => {
    const transformed = { ...payment(2), name: '变形群体招式' };
    const { state, availability, inspection } = setup([starter(), starter()], { all: () => [transformed] });
    state.shaTransform = transformed.name;
    const context = {};
    expect(availability(0, context).status).toBe('ready');
    expect(inspection.findEffectiveCard('u0').card).not.toBe(context.handCards[0].card);
    expect(context.handCards[0].card).toBe(state.game.ownedCards[0].card);
    state.cardOverrides.set('u0', transformed);
    expect(availability(0, {}).reason.message).toContain('现有 1 张');
  });

  it.each(['tt7-thundergrudge', 'tt7-meteorrain'])('materialization still repairs an unselected raw legacy %s', id => {
    const canonical = starter(); canonical.id = id; canonical.dmg = 7; canonical.dmgType = 'fixed'; canonical.rules.triggers.onPlay[0].amount = 7;
    const legacy = { ...starter(), id, dmg: 99, dmgType: 'spell', rules: { battle: { requirements: [{ kind: 'unplayable' }] } } };
    const { availability, services } = setup([payment(1, '初始攻击'), legacy], { TABLETOP10: [canonical] });
    const context = {};
    expect(availability(0, context).status).toBe('ready');
    expect(legacy).toMatchObject({ dmg: 7, dmgType: 'fixed', rules: canonical.rules });
    expect(context.handCards[1].card).toBe(legacy);
    expect(availability(1, context).status).toBe('ready');
    expect(services.findCard).toHaveBeenCalledTimes(2);
  });

  it('fresh batch, standalone query, and final submission all observe hand removal', () => {
    const { state, availability, domain, services } = setup([payment(2, '初始攻击'), starter(), starter()]);
    const context = {};
    expect(availability(0, context).status).toBe('ready');
    state.hand.pop();
    expect(availability(0, {}).reason.message).toContain('现有 1 张');
    expect(domain.getCardPlayAvailability('u0', 0).reason.message).toContain('现有 1 张');
    expect(domain.submitCardPlay('u0', 0).reason.code).toBe('CARD_UNPLAYABLE');
    expect(services.submitExecution).not.toHaveBeenCalled();
    state.hand.push('u2');
    expect(domain.submitCardPlay('u0', 0).status).toBe('accepted');
    expect(services.submitExecution).toHaveBeenCalledOnce();
    state.hand.shift();
    expect(availability(0, {}).reason.code).toBe('NOT_IN_HAND');
    expect(domain.submitCardPlay('u0', 0).reason.code).toBe('NOT_IN_HAND');
  });

  it('fresh queries see raw replacement and in-place requirement edits', () => {
    const self = payment(1, '初始攻击');
    const { state, availability, domain } = setup([self, starter()]);
    expect(availability(0, {}).status).toBe('ready');
    state.game.ownedCards[1].card = card();
    expect(availability(0, {}).reason.message).toContain('现有 0 张');
    state.game.ownedCards[1].card = starter();
    expect(domain.getCardPlayAvailability('u0', 0).status).toBe('ready');
    self.rules.battle.requirements[0].count = 2;
    expect(availability(0, {}).reason.message).toContain('需要 2 张');
    expect(domain.submitCardPlay('u0', 0).reason.code).toBe('CARD_UNPLAYABLE');
  });

  it('does not cache current energy, cost, capability, or mode with the raw hand', () => {
    const self = card();
    const { state, availability } = setup([self]);
    const context = {};
    expect(availability(0, context).status).toBe('ready');
    state.energy = 0;
    expect(availability(1, context).reason.code).toBe('INSUFFICIENT_ENERGY');
    self.cost = 0;
    expect(availability(1, context).status).toBe('ready');
    self.rules.triggers.onPlay.push({ op: 'futureUnsupportedOperation' });
    expect(availability(2, context).reason.code).toMatch(/^RULE_/);
    self.rules.triggers.onPlay = []; self.dmg = 0; self.type = '能力卡'; state.mode = 'normal';
    expect(availability(3, context).reason.message).toContain('能力卡');
  });

  it('reruns requested target, execution target, and execution availability in their existing order', () => {
    const { availability, services, state } = setup([card()]);
    const context = {}, blocked = { code: 'TARGET_BLOCKED', message: '当前目标不可用' };
    services.requestedTargetReason.mockImplementation((_card, target) => target === state.foes[1] ? blocked : null);
    services.executeTargetReason.mockImplementation((_card, target) => target === state.foes[2] ? blocked : null);
    services.executionAvailability.mockImplementationOnce(() => null).mockImplementation(() => blocked);
    expect(availability(0, context).status).toBe('ready');
    expect(availability(1, context).reason).toEqual(blocked);
    expect(availability(2, context).reason).toEqual(blocked);
    expect(availability(3, context).reason).toEqual(blocked);
    expect(services.requestedTargetReason).toHaveBeenCalledTimes(4);
    expect(services.executeTargetReason).toHaveBeenCalledTimes(3);
    expect(services.executionAvailability).toHaveBeenCalledTimes(2);
  });

  it('does not carry selected infusion fuel, waivers, or free-cast state in the hand context', () => {
    const self = card({ infuse: 1 }); self.rules.battle.requirements = [{ kind: 'infused' }];
    const { state, availability, services, domain } = setup([self, starter()]);
    const context = {};
    // Current local flow first offers material selection; explicit direct play
    // must still reject an unfulfilled infusion requirement with this context.
    expect(availability(0, context).status).toBe('ready');
    expect(domain.getCardPlayAvailability('u0', 0, true, context).reason.code).toBe('INFUSION_REQUIRED');
    state.interaction = { kind: 'card', uid: 'u0', fuelUids: ['u1'] };
    expect(availability(1, context).status).toBe('ready');
    expect(services.executionAvailability).toHaveBeenLastCalledWith('u0', expect.objectContaining(self), ['u1'], false);
    state.freeCast.add('u0');
    expect(availability(2, context).status).toBe('ready');
    expect(services.executionAvailability).toHaveBeenLastCalledWith('u0', expect.objectContaining(self), ['u1'], true);
    state.interaction.fuelUids = [];
    expect(availability(3, context).reason.code).toBe('INFUSION_REQUIRED');
    expect(domain.submitCardPlay('u0', 0).reason.code).toBe('INFUSION_REQUIRED');
    state.allSpellsInfused = true;
    expect(availability(0, context).status).toBe('ready');
    state.allSpellsInfused = false; self._noInfuse = true;
    expect(availability(0, context).status).toBe('ready');
  });
});
