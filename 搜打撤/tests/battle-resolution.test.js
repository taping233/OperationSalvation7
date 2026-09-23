import { describe, expect, it } from 'vitest';
import { createBattleResolution } from '../game/src/battle.resolution.js';

function makeResolver(state) {
  const events = [];
  const resolver = createBattleResolution({
    readState: () => state.current,
    getPlayerStatus: () => state.playerStatus || { status: {} },
    esc: value => String(value),
    log: (...args) => events.push(['log', ...args]),
    heal: amount => events.push(['heal', amount]),
    addFloat: value => events.push(['float', value]),
    addDelayed: value => events.push(['delayed', value]),
    takeDeckBottom: count => [], deckBottomCount: () => 0,
    startSurge: () => {}, getAllCards: () => [], isRandomObtainable: () => false,
    randomBattle: () => 0, getDamageTypes: () => ['武术'], getDamageTypeMeta: () => ({}), fixedDamageType: 'fixed',
    hasCurse: () => false, getAliveFoes: () => [state.target], getGrowth: () => 0,
    findCard: () => null, addTempCard: () => 'temp', queueDiscover: () => {},
    splitClauses: () => ({ immediate: ['可观察顺序'], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: () => { events.push(['text']); state.onText?.(); return { did: true }; },
    registerTurnStart: () => {}, registerBattle: () => false, castRandomSpells: () => Promise.resolve(),
    drawCards: () => 0, grantSha: () => {},
    hitFoe: (_foe, _card, amount) => { events.push(['damage', amount]); return amount; },
    drawOf: () => 0, isAOE: () => false, addArmor: amount => events.push(['armor', amount]),
  });
  return { resolver, events };
}

describe('battle resolution ports', () => {
  it('preserves damage-before-text order', () => {
    const runtime = { current: { mode: 'boss', playedMovesThisTurn: 1, infuseFuels: 0, grave: [] } };
    const target = { hp: 20, maxHp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ current: runtime.current, playerStatus: { status: {} }, target });
    const card = { id: 'probe', name: '顺序探针', type: '武术', dmg: 3, dmgType: 'fixed', desc: '本回合每打出一张其他招式，造成2点固定伤害。' };
    resolver(card, target, false, 0, null);
    expect(events.filter(event => ['damage', 'text'].includes(event[0]))).toEqual([['damage', 3], ['text']]);
  });

  it('reads rebound runtime values on the next cast', () => {
    const runtime = { current: { mode: 'boss', playedMovesThisTurn: 1, infuseFuels: 0, grave: [] } };
    const target = { hp: 20, maxHp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ get current() { return runtime.current; }, playerStatus: { status: {} }, target });
    const card = { id: 'probe', name: '状态探针', type: '武术', dmg: 3, dmgType: 'fixed', desc: '本回合每打出一张其他招式，造成2点固定伤害。' };
    resolver(card, target, false, 0, null);
    events.length = 0;
    runtime.current = { ...runtime.current, playedMovesThisTurn: 4 };
    resolver(card, target, false, 0, null);
    expect(events.filter(event => event[0] === 'damage')).toHaveLength(4);
    expect(events.filter(event => event[0] === 'text')).toHaveLength(1);
  });

  it('reads player status again after text effects before the structured heal fallback', () => {
    const player = { current: { status: {} } };
    const healCard = { id: 'probe-heal', name: '禁疗探针', type: '法术', dmg: 0, desc: '可观察顺序', heal: 3 };
    // Mutate the player binding from a command before the structured heal fallback reads status.
    const callState = { current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, get playerStatus() { return player.current; }, target: { hp: 20, dead: false, status: {} }, onText: () => { player.current = { status: { healban: 2 } }; } };
    const { resolver, events } = makeResolver(callState);
    const target = callState.target;
    resolver(healCard, target, false, 0, null);
    expect(events.some(event => event[0] === 'heal')).toBe(false);
    expect(events.some(event => event[0] === 'log' && String(event[1]).includes('禁疗中'))).toBe(true);
  });

  it('sends structured armor through the armor command after text effects', () => {
    const target = { hp: 20, dead: false, status: {} };
    const { resolver, events } = makeResolver({ current: { mode: 'boss', playedMovesThisTurn: 0, infuseFuels: 0, grave: [] }, playerStatus: { status: {} }, target });
    resolver({ id: 'probe-armor', name: '护甲探针', type: '法术', dmg: 0, desc: '可观察顺序', armor: 4 }, target, false, 0, null);
    expect(events.filter(event => ['text', 'armor'].includes(event[0]))).toEqual([['text'], ['armor', 4]]);
  });
});
