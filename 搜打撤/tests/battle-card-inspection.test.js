import { describe, expect, it, vi } from 'vitest';
import { createBattleCardInspection } from '../game/src/battle/effects/battle.card-inspection.js';

function setup() {
  const canonicalRules = { damage: { amount: 4 } };
  const legacy = {
    id: 'tt7-thundergrudge', name: '旧版雷怨', type: '武术', cost: 3,
    dmg: 1, dmgType: 'attack', rules: { old: true }, desc: '附加 1 层流血。',
  };
  const spell = {
    id: 'inspect-spell', name: '费用探针', type: '法术', cost: 4,
    desc: '消耗区中每有一张法术牌，本牌费用 - 1。附加 2 层中毒；附加 3 层中毒；附加 1 层流血。',
  };
  const game = {
    ownedCards: [
      { uid: 'legacy', card: legacy },
      { uid: 'spell', card: spell },
      { uid: 'poison-martial', card: { name: '毒招', type: '武术', desc: '附加 3 层中毒。' } },
      { uid: 'freeze-two', card: { name: '冻气', type: '武术', desc: '冰冻二名敌人。' } },
      { uid: 'creature', card: { name: '生物', type: '生物', desc: '附加 9 层中毒。' } },
    ],
    log: vi.fn(),
  };
  const state = {
    game,
    granted: [{ uid: 'granted', card: { name: '临时牌', type: '武术' } }],
    hand: ['legacy', 'spell', 'poison-martial', 'freeze-two', 'creature'],
    consumed: ['spell'],
    discoverQueue: [],
    cardOverrides: new Map([['override', { uid: 'old-uid-is-ignored', name: '覆盖牌', type: '武术', cost: 8 }]]),
    unlimitedRune: false,
    zeroFeeUntil: new Map(),
    turn: 2,
    pstat: { status: { cosmosForm: 0 } },
    spellCost1: false,
    meleeCost1: false,
    lastPlayedType: null,
    playedMartialThisTurn: 0,
    playedMovesThisTurn: 0,
    pdef: { armor: 1 },
  };
  const cards = {
    TABLETOP10: [{ id: legacy.id, dmg: 4, dmgType: 'spell', rules: canonicalRules }],
    deriveDraw: card => card.derivedDraw || 0,
    deriveInfuse: card => card.derivedInfuse || 0,
    all: () => [
      { type: '武术', random: true },
      { type: '法术', random: true },
      { type: '事件', random: true },
    ],
    isRandomObtainable: card => card.random === true,
  };
  const inspection = createBattleCardInspection({
    cards,
    readState: () => state,
    curseMeta: { bleed: { stack: false }, poison: { stack: true } },
  });
  return { canonicalRules, legacy, spell, game, state, cards, inspection };
}

describe('battle card inspection ports', () => {
  it('按 UID 顺序查找并从定版数据修复旧克隆', () => {
    const { canonicalRules, legacy, inspection } = setup();
    expect(inspection.findCard('legacy')).toEqual({ uid: 'legacy', card: legacy });
    expect(legacy.dmg).toBe(4);
    expect(legacy.dmgType).toBe('spell');
    expect(legacy.rules).toEqual(canonicalRules);
    expect(legacy.rules).not.toBe(canonicalRules);
    expect(inspection.findCard('granted').uid).toBe('granted');
    expect(inspection.findCard('override')).toMatchObject({ uid: 'override', card: { name: '覆盖牌' } });
    expect(inspection.findCard('missing')).toBeNull();
  });

  it('读取派生抽牌、注能与带出法术折扣费用', () => {
    const { spell, state, cards, inspection } = setup();
    spell.derivedDraw = 2;
    spell.derivedInfuse = 3;
    cards.deriveDraw = card => card.derivedDraw || 0;
    cards.deriveInfuse = card => card.derivedInfuse || 0;
    expect(inspection.drawOf(spell)).toBe(2);
    expect(inspection.infuseOf(spell)).toBe(3);
    expect(inspection.infuseOf({ ...spell, _noInfuse: true })).toBe(0);
    expect(inspection.effCostOf(spell, 'spell')).toBe(3);
    state.consumed = [];
    expect(inspection.effCostOf(spell, 'spell')).toBe(4);
  });

  it('聚合手牌诅咒并保留费用交换发现队列语义', () => {
    const { state, inspection, game } = setup();
    expect(inspection.handCurseSpecs()).toEqual([
      { key: 'bleed', n: 1 },
      { key: 'poison', n: 5 },
      { key: 'freeze', n: 1 },
    ]);

    inspection.queueSwapCostDiscover();
    expect(state.discoverQueue).toHaveLength(2);
    expect(state.discoverQueue[0].swapPair).toBe(state.discoverQueue[1].swapPair);
    expect(state.discoverQueue[0].pred({ type: '武术' })).toBe(true);
    expect(state.discoverQueue[0].pred({ type: '生物' })).toBe(false);

    inspection.swapCardCosts('legacy', 'spell');
    expect(state.cardOverrides.get('legacy').cost).toBe(4);
    expect(state.cardOverrides.get('spell').cost).toBe(3);
    expect(game.log).toHaveBeenCalledTimes(2);
  });
});

it('reuses one live ownership scan per effective query without stale array or override caches', () => {
  const { state, inspection, game } = setup();
  const ownedFind = vi.spyOn(game.ownedCards, 'find');
  const grantedFind = vi.spyOn(state.granted, 'find');
  expect(inspection.findEffectiveCard('spell').card.name).toBe('费用探针');
  expect(ownedFind).toHaveBeenCalledTimes(1);
  expect(grantedFind).not.toHaveBeenCalled();
  ownedFind.mockClear();
  expect(inspection.findEffectiveCard('granted').card.name).toBe('临时牌');
  expect(ownedFind).toHaveBeenCalledTimes(1);
  expect(grantedFind).toHaveBeenCalledTimes(1);
  const replacement = { uid: 'spell', safe: true, card: { name: '替换归属', type: '法术' } };
  game.ownedCards.splice(1, 1, replacement);
  expect(inspection.findEffectiveCard('spell')).toBe(replacement);
  state.cardOverrides.set('spell', { name: '新替身', type: '武术' });
  expect(inspection.findEffectiveCard('spell')).toMatchObject({ safe: true, card: { name: '新替身' } });
  state.cardOverrides.delete('spell');
  game.ownedCards = [];
  state.granted.push(replacement);
  expect(inspection.findEffectiveCard('spell')).toBe(replacement);
});

it.each([
  ['rune', (state) => { state.unlimitedRune = true; }, 'bts-cost', 3],
  ['zero fee', (state) => { state.zeroFeeUntil.set('spell', state.turn); }, 'spell', 0],
  ['cosmos', (state) => { state.pstat.status.cosmosForm = 1; }, 'spell', 1],
  ['spell fixed', (state) => { state.spellCost1 = true; }, 'spell', 1],
  ['previous type', (state, card) => { state.lastPlayedType = '武术'; card.rules.battle.costModifiers.unshift({ kind: 'previousCardTypeFree' }); }, 'spell', 0],
  ['martial count', (state, card) => { state.playedMartialThisTurn = 2; card.rules.battle.costModifiers.unshift({ kind: 'martialPlayedDiscount', amount: 1 }); }, 'spell', 2],
  ['move count', (state, card) => { state.playedMovesThisTurn = 3; card.rules.battle.costModifiers.unshift({ kind: 'movesPlayedDiscount', amount: 1 }); }, 'spell', 1],
  ['armor zero', (state, card) => { state.pdef.armor = 0; card.rules.battle.costModifiers.unshift({ kind: 'armorZeroFree' }); }, 'spell', 0],
])('does not scan consumed UIDs when %s already decides cost', (_name, change, uid, expected) => {
  const { state, inspection, spell, game } = setup();
  spell.rules = { battle: { costModifiers: [{ kind: 'consumedSpellDiscount', amount: 1 }] } };
  change(state, spell);
  const find = vi.spyOn(game.ownedCards, 'find');
  expect(inspection.effCostOf(spell, uid)).toBe(expected);
  expect(find).not.toHaveBeenCalled();
});

it('counts live consumed spells once per UID with owned-first precedence, overrides and missing UIDs', () => {
  const { state, inspection, spell } = setup();
  state.consumed = ['spell', 'spell', 'legacy', 'missing', 'granted'];
  state.granted.push({ uid: 'legacy', card: { type: '法术' } });
  expect(inspection.effCostOf(spell, 'spell')).toBe(3);
  state.cardOverrides.set('legacy', { type: '法术' });
  expect(inspection.effCostOf(spell, 'spell')).toBe(2);
  state.granted[0].card.type = '法术';
  expect(inspection.effCostOf(spell, 'spell')).toBe(1);
  state.consumed.splice(0, 4);
  expect(inspection.effCostOf(spell, 'spell')).toBe(3);
});

it('retains filter semantics for sparse consumed arrays', () => {
  const { state, inspection, spell, game } = setup();
  state.consumed = Array(2);
  state.consumed[1] = 'spell';
  game.ownedCards.push({ uid: undefined, card: { type: '法术' } });
  expect(inspection.effCostOf(spell, 'spell')).toBe(3);
});
