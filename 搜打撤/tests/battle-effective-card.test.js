import { describe, expect, it } from 'vitest';
import { createBattleCardInspection } from '../game/src/battle/effects/battle.card-inspection.js';

const starter = () => ({ id: 'starter-attack', name: '初始攻击', type: '武术', cost: 1,
  dmg: 0, dmgType: 'attack', desc: '攻（+0）' });
const immortal = () => ({ id: 'immortal-token', name: '不朽斩', type: '武术', cost: 1,
  dmg: 1, dmgType: 'attack', desc: '攻（+1），永远被保留在手牌中，无法用于注能' });
const dragon = () => ({ id: 'dragon-token', name: '青龙偃月斩', type: '武术', cost: 2,
  dmg: 3, dmgType: 'attack', desc: '攻（+3）' });
function setup() {
  const owned = { uid: 's1', baseUid: 'origin-1', card: starter(), safe: true };
  const temporary = { uid: 'boss-sha-7-1', card: starter() };
  const templates = [immortal(), dragon()];
  const state = { game: { ownedCards: [owned] }, granted: [temporary], hand: [owned.uid, temporary.uid],
    cardOverrides: new Map(), shaTransform: null, consumed: [], discoverQueue: [], zeroFeeUntil: new Map(), turn: 2,
    unlimitedRune: false, pstat: { status: {} }, pdef: { armor: 0 },
    playedMartialThisTurn: 0, playedMovesThisTurn: 0 };
  const inspection = createBattleCardInspection({ cards: { all: () => templates,
    deriveDraw: () => 0, deriveInfuse: () => 0 }, readState: () => state, curseMeta: {} });
  return { state, inspection, owned, temporary, templates };
}
describe('approved effective-card contract', () => {
  it('keeps raw findCard and original entry metadata while resolving every starter UID', () => {
    const { state, inspection, owned, temporary } = setup();
    state.shaTransform = '不朽斩';
    const raw = JSON.stringify(owned);
    const effective = inspection.findEffectiveCard(owned.uid);
    expect(effective).toMatchObject({ uid: 's1', baseUid: 'origin-1', safe: true,
      card: { id: 'immortal-token', name: '不朽斩', dmg: 1 } });
    expect(inspection.findEffectiveCard(temporary.uid)).toMatchObject({ uid: temporary.uid,
      card: { id: 'immortal-token' } });
    expect(state.hand.map(inspection.findEffectiveCard).map(entry => entry.card.name)).toEqual(['不朽斩', '不朽斩']);
    expect(inspection.findEffectiveCard(owned.uid, { ...dragon(), cost: 0 }).card).toMatchObject({ name: '青龙偃月斩', cost: 0 });
    expect(inspection.findCard(owned.uid)).toBe(owned);
    expect(JSON.stringify(owned)).toBe(raw);
    expect(state.cardOverrides.size).toBe(0);
    expect(inspection.infusionFuelReason(owned.uid)).toContain('无法用于注能');
  });
  it('uses current rule with override-before-transform order and original UID zero-fee state', () => {
    const { state, inspection, owned } = setup();
    state.shaTransform = '不朽斩';
    state.cardOverrides.set(owned.uid, { ...starter(), cost: 0 });
    expect(inspection.findEffectiveCard(owned.uid).card.cost).toBe(1);
    state.zeroFeeUntil.set(owned.uid, 2);
    expect(inspection.effCostOf(inspection.findEffectiveCard(owned.uid).card, owned.uid)).toBe(0);
    state.cardOverrides.set(owned.uid, { ...dragon(), cost: 0 });
    expect(inspection.findEffectiveCard(owned.uid).card.name).toBe('青龙偃月斩');
    expect(inspection.findEffectiveCard(owned.uid).card.cost).toBe(0);
    expect(inspection.findEffectiveCard(owned.uid).baseUid).toBe('origin-1');
    state.cardOverrides.delete(owned.uid);
    state.shaTransform = '青龙偃月斩';
    expect(inspection.findEffectiveCard(owned.uid).card.name).toBe('青龙偃月斩');
    expect(inspection.infusionFuelReason(owned.uid)).toBe('');
  });
  it('returns unavailable target reason and does not mutate original card when template is missing', () => {
    const { state, inspection, owned } = setup();
    const before = JSON.stringify(owned);
    state.shaTransform = '不存在的转换目标';
    expect(inspection.findEffectiveCard(owned.uid).card.name).toBe('初始攻击');
    expect(inspection.infusionFuelReason(owned.uid)).toContain('不存在的转换目标');
    expect(JSON.stringify(owned)).toBe(before);
    state.shaTransform = null;
    expect(inspection.findEffectiveCard(owned.uid).card).toMatchObject(owned.card);
    expect(inspection.infusionFuelReason(owned.uid)).toBe('');
  });
});

it('captured effective faces retain live UID provenance through normalization without swallowing custom candidates', () => {
  const { state, inspection, owned } = setup();
  state.shaTransform = '不朽斩';
  const captured = inspection.findEffectiveCard(owned.uid).card;
  const normalized = inspection.findEffectiveCard(owned.uid, captured, card => ({ ...card })).card;
  state.shaTransform = '青龙偃月斩';
  expect(inspection.findEffectiveCard(owned.uid, normalized).card.name).toBe('青龙偃月斩');
  state.shaTransform = null;
  expect(inspection.findEffectiveCard(owned.uid, captured).card).toMatchObject(owned.card);
  state.shaTransform = '不朽斩';
  state.cardOverrides.set(owned.uid, { ...dragon(), cost: 0 });
  expect(inspection.findEffectiveCard(owned.uid, captured).card).toMatchObject({ name: '青龙偃月斩', cost: 0 });
  state.cardOverrides.delete(owned.uid);
  const custom = { ...starter(), cost: 7, rules: { custom: true } };
  const customFace = inspection.findEffectiveCard(owned.uid, custom).card;
  state.shaTransform = null;
  expect(inspection.findEffectiveCard(owned.uid, customFace).card).toMatchObject(custom);
  state.shaTransform = '不存在的转换目标';
  expect(inspection.findEffectiveCard(owned.uid, normalized).card._battleTransformMissing).toBe('不存在的转换目标');
});

it('a confirmed live raw capture follows a later override while an explicit raw-like custom candidate does not', () => {
  const { state, inspection, owned } = setup();
  const captured = inspection.findEffectiveCard(owned.uid).card;
  const custom = { ...starter(), cost: 7, rules: { custom: true } };
  expect(inspection.findEffectiveCard(owned.uid, custom).card).toMatchObject(custom);
  state.cardOverrides.set(owned.uid, { ...dragon(), cost: 0 });
  expect(inspection.findEffectiveCard(owned.uid, captured).card).toMatchObject({ name: '青龙偃月斩', cost: 0 });
  expect(inspection.findEffectiveCard(owned.uid, custom).card).toMatchObject(custom);
});
