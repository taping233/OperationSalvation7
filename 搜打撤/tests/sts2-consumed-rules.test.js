import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { matchElsewhere } from '../game/src/battle/effects/effect-verbs.js';

window.SDT ||= { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Icons ||= { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(30, 200, 1, 0, 99, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const C = window.SDT.Cards;
C.ensureSha(); C.ensureStarters(); C.ensureTabletop(); C.ensureDmgTypes(); C.ensureEffectFields();
const { BattleSession, configureBattleRenderer, viewApi } = await import('../game/src/battle/core/battle.core.js');
const { createBattleCardInspection } = await import('../game/src/battle/effects/battle.card-inspection.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');
const { Random } = await import('../game/src/core/random.js');
let game;

beforeEach(() => {
  vi.useFakeTimers(); configureBattleRenderer(() => {});
  Random.reseed('consumed-rules'); R.set$lastDeckSel([]);
});
afterEach(() => {
  if (game?.battleActive) E.finish(null);
  configureBattleRenderer(null); vi.clearAllTimers(); vi.useRealTimers();
});

const spell = id => ({ id, name: id, type: '法术', cost: 0, desc: '' });
const discount = () => ({ ...spell('discount'), cost: 8, rules: { version: 1,
  battle: { target: { side: 'self', area: false }, costModifiers: [{ kind: 'consumedSpellDiscount', amount: 1 }] },
  triggers: { onPlay: [{ op: 'armor', amount: 1 }] } } });
function begin(mode, cards) {
  game = { ownedCards: cards.map(card => ({ uid: card.id, card: structuredClone(card) })),
    ...playerFields(100, 100, 1, 0, '战士', null), inventory: [], usedPocket: [],
    logs: [], log(value) { this.logs.push(value); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); }, onBattleEnd() {} };
  BattleSession.start(game, [{ id: 'consumed-target', name: '消耗规则靶', hp: 999, atk: 0 }],
    { isBoss: mode === 'boss', directBossStart: true });
  expect(R.battleState.phase).toBe('player');
}
async function play(uid, side = 'self') {
  const result = BattleSession.commands.submitCardPlay(uid, side);
  expect(result.status).toBe('queued');
  await vi.advanceTimersByTimeAsync(3000);
  expect((await result.settled).status).toBe('committed');
  expect(R.busy).toBe(false);
}
function mixedPiles(mode, source) {
  begin(mode, [source, discount(), ...['used', 'fuel', 'discarded', 'grave-only', 'held', 'queued'].map(spell),
    { id: 'martial', name: '非匹配类型', type: '武术', cost: 0, desc: '' }]);
  // Seed the four legacy locations and historical overlapping bookkeeping in a live session.
  R.set$hand([source.id, 'discount', 'held']); R.set$drawPile(['queued']);
  R.played.push('used', 'used', 'held', 'queued', 'martial');
  R.set$consumed(['fuel', 'used']); R.set$discard(['discarded', 'fuel']);
  R.set$grave(['grave-only', 'discarded', 'used']);
  expect(new Set(BattleSession.getSnapshot().consumedPile))
    .toEqual(new Set(['used', 'fuel', 'discarded', 'grave-only', 'martial']));
}

describe.each(['normal', 'boss'])('统一消耗牌堆规则接线：%s', mode => {
  it('结构化 graveyard 混合四个旧源按 UID 增伤；手牌、牌库与本次结算牌均不计', async () => {
    const source = { ...spell('structured-scale'), dmg: 7, dmgType: 'fixed', rules: { version: 1,
      battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', graveyard: { type: '法术', perCard: 1 } },
      ] } } };
    mixedPiles(mode, source);
    expect(viewApi.effCostOf(discount(), 'discount')).toBe(4);
    await play(source.id, 0);
    expect(R.foes[0].hp).toBe(988); // 7 + four spent spell UIDs, excluding this resolving spell.
    expect(BattleSession.getSnapshot().consumedPile).toContain(source.id); // Available only after settlement.
    expect(viewApi.effCostOf(discount(), 'discount')).toBe(3);
    expect(game.logs.some(line => line.includes('消耗牌堆中有 4 张'))).toBe(true);
    expect(game.logs.some(line => line.includes('墓地增伤'))).toBe(false);
  });

  it.each(['墓地', '弃牌堆', '消耗牌堆'])('旧词 %s 的描述增伤使用同一个集合', async term => {
    const desc = `造成7点固定伤害；${term}中每有1张法术牌，伤害+1。`;
    const source = { ...spell('legacy-scale'), dmg: 7, dmgType: 'fixed', desc };
    expect(matchElsewhere(desc, { structuredHit: true })).toContain('graveScale');
    mixedPiles(mode, source);
    await play(source.id, 0);
    expect(R.foes[0].hp).toBe(988);
    expect(game.logs.some(line => line.includes('消耗牌堆中有 4 张'))).toBe(true);
  });

  it('真实复原按原 UID 清四源重影；取回法术后折费数量同步降低', async () => {
    const recovery = { id: 'recovery', name: '实际复原', type: '武术', cost: 0, desc: '复原1张卡牌。' };
    mixedPiles(mode, recovery);
    expect(viewApi.effCostOf(discount(), 'discount')).toBe(4);
    await play(recovery.id);
    expect(R.hand).toContain('grave-only');
    expect(R.hand).not.toContain(recovery.id); // Its own in-flight play is not recoverable.
    expect([R.played, R.consumed, R.discard, R.grave].flat()).not.toContain('grave-only');
    expect(BattleSession.getSnapshot().consumedPile).not.toContain('grave-only');
    expect(viewApi.effCostOf(discount(), 'discount')).toBe(5);
    expect(game.ownedCards.filter(entry => entry.uid === 'grave-only')).toHaveLength(1);
  });

  it('无其他消耗牌时复原不能取回正在结算的自身', async () => {
    const source = { ...spell('only-recovery'), desc: '复原1张卡牌。' };
    begin(mode, [source]);
    await play(source.id);
    expect(R.hand).not.toContain(source.id);
    expect(BattleSession.getSnapshot().consumedPile).toEqual([source.id]);
    expect(game.logs.some(line => line.includes('复原 1 张消耗卡'))).toBe(false);
  });

  it('费用不足拒绝不改牌堆、能量、实例或随机状态', () => {
    mixedPiles(mode, { id: 'spare', name: '备用', type: '武术', cost: 0, desc: '' });
    R.set$energy(0);
    const before = { piles: [R.hand, R.drawPile, R.played, R.consumed, R.discard, R.grave].map(a => [...a]),
      owned: structuredClone(game.ownedCards), rng: Random.snapshot(), energy: R.energy };
    const result = BattleSession.commands.submitCardPlay('discount', 'self');
    expect(result.status).toBe('rejected');
    expect([R.hand, R.drawPile, R.played, R.consumed, R.discard, R.grave]).toEqual(before.piles);
    expect(game.ownedCards).toEqual(before.owned); expect(Random.snapshot()).toEqual(before.rng);
    expect(R.energy).toBe(before.energy); expect(viewApi.effCostOf(discount(), 'discount')).toBe(4);
  });
});

it('统一消耗查询只在折费槽实际生效时执行，其他费用优先级仍不读取', () => {
  const card = discount(), getConsumedPile = vi.fn(() => ['spell', 'spell']);
  const state = { game: { ownedCards: [{ uid: 'spell', card: spell('fuel') }] },
    granted: [], consumed: [], cardOverrides: new Map(), zeroFeeUntil: new Map(),
    turn: 1, pstat: { status: {} }, pdef: { armor: 1 }, getConsumedPile,
    playedMartialThisTurn: 0, playedMovesThisTurn: 0 };
  const inspect = createBattleCardInspection({ cards: {}, curseMeta: {}, readState: () => state });
  const withModifier = modifier => ({ ...card, rules: { ...card.rules,
    battle: { ...card.rules.battle, costModifiers: [modifier, ...card.rules.battle.costModifiers] } } });
  const cases = [
    [{ ...card, rules: undefined, desc: '' }, 'ordinary', () => {}, 8],
    [card, 'bts-cost', () => { state.unlimitedRune = true; }, 7],
    [card, 'discount', () => { state.unlimitedRune = false; state.zeroFeeUntil.set('discount', 1); }, 0],
    [card, 'discount', () => { state.zeroFeeUntil.clear(); state.pstat.status.cosmosForm = 1; }, 1],
    [card, 'discount', () => { state.pstat.status.cosmosForm = 0; state.spellCost1 = true; }, 1],
    [{ ...card, type: '武术' }, 'discount', () => { state.spellCost1 = false; state.meleeCost1 = true; }, 1],
    [withModifier({ kind: 'previousCardTypeFree' }), 'discount', () => { state.meleeCost1 = false; state.lastPlayedType = '武术'; }, 0],
    [withModifier({ kind: 'martialPlayedDiscount', amount: 1 }), 'discount', () => { state.lastPlayedType = null; state.playedMartialThisTurn = 2; }, 6],
    [withModifier({ kind: 'movesPlayedDiscount', amount: 1 }), 'discount', () => { state.playedMovesThisTurn = 3; }, 5],
    [withModifier({ kind: 'armorZeroFree' }), 'discount', () => { state.pdef.armor = 0; }, 0],
  ];
  for (const [candidate, uid, change, expected] of cases) {
    change(); expect(inspect.effCostOf(candidate, uid)).toBe(expected);
    expect(getConsumedPile).not.toHaveBeenCalled();
  }
  state.spellCost1 = false;
  expect(inspect.effCostOf(card, 'discount')).toBe(7); // Duplicate spell UID discounts once.
  expect(getConsumedPile).toHaveBeenCalledTimes(1);
});

describe.each(['normal', 'boss'])('挖宝底三张候选：%s', mode => {
  function digFixture(count, oldRule = false) {
    const canonical = C.all().find(card => card.id === 'tt3-dig-treasure');
    expect(canonical).toBeTruthy();
    const dig = structuredClone(canonical);
    if (oldRule) dig.rules.triggers.onPlay.find(op => op.op === 'acquire').n = 1;
    const loot = [2, 5, 9, 13].map((value, i) => ({ id: `bottom-${i}`, name: `底牌-${i}`, type: '武术',
      cost: value, value, desc: '' })).slice(0, count);
    begin(mode, [dig, ...loot]);
    R.set$hand([dig.id]); R.set$drawPile(loot.map(card => card.id)); R.set$lastDrawnUids([]);
    return { dig, loot };
  }

  it.each([false, true])('新定义及旧 n:1 实例都只发现一次底部三张（旧实例=%s）', async oldRule => {
    const { dig, loot } = digFixture(4, oldRule);
    const granted = R.granted.length;
    R.cardOverrides.set('bottom-1', { ...loot[1], cost: 0, desc: '仅此实例的费用覆盖' });
    await play(dig.id);
    expect(R.discovering.options.map(card => card.id)).toEqual(loot.slice(0, 3).map(card => card.id));
    expect(R.discovering.n).toBe(1); expect(R.drawPile).toEqual(['bottom-3']);
    expect(R.pdef.armor).toBe(0);
    BattleSession.commands.pickDiscover(1); await vi.advanceTimersByTimeAsync(3000);
    expect(R.pdef.armor).toBe(C.sellPrice(loot[1])); expect(R.pdef.armor).toBe(5);
    expect(R.drawPile).toEqual(['bottom-0', 'bottom-2', 'bottom-3']);
    expect(R.hand).toEqual(['bottom-1']);
    expect(R.hand.map(uid => E.findCard(uid)?.card.id)).toEqual(['bottom-1']);
    expect(E.findCard('bottom-1').card.desc).toBe('仅此实例的费用覆盖');
    expect(R.granted).toHaveLength(granted);
    expect(R.discovering).toBeNull(); expect(R.discoverQueue).toEqual([]);
  });

  it('不足三张时只翻实际库存，未选牌按原序放回', async () => {
    const { dig, loot } = digFixture(2, true);
    await play(dig.id);
    expect(R.discovering.options.map(card => card.id)).toEqual(loot.map(card => card.id));
    expect(R.discovering.n).toBe(1);
    BattleSession.commands.pickDiscover(1); await vi.advanceTimersByTimeAsync(3000);
    expect(R.drawPile).toEqual(['bottom-0']); expect(R.pdef.armor).toBe(5);
    expect(R.discovering).toBeNull(); expect(R.discoverQueue).toEqual([]);
  });

  it('空库不随机补候选或护甲，也不发新的临时牌', async () => {
    const { dig } = digFixture(0, true);
    const granted = R.granted.length;
    await play(dig.id);
    expect(R.discovering).toBeNull(); expect(R.discoverQueue).toEqual([]);
    expect(R.hand).toEqual([]); expect(R.drawPile).toEqual([]);
    expect(R.granted).toHaveLength(granted); expect(R.pdef.armor).toBe(0);
    expect(game.logs.some(line => line.includes('牌库底没有可取的卡牌'))).toBe(true);
  });
});

it('挖宝取到10库实体后保留 normal-sha UID，打出也不会转入战后消耗区', async () => {
  const dig = structuredClone(C.all().find(card => card.id === 'tt3-dig-treasure'));
  begin('normal', [dig]);
  const originals = R.drawPile.slice(0, 3), granted = R.granted.length;
  expect(originals.every(uid => uid.startsWith('normal-sha-'))).toBe(true);
  R.set$drawPile([...originals]);
  await play(dig.id);
  expect(R.discovering.deckBottomUids).toEqual(originals);
  BattleSession.commands.pickDiscover(0); await vi.advanceTimersByTimeAsync(3000);
  expect(R.hand).toEqual([originals[0]]); expect(R.granted).toHaveLength(granted);
  expect(R.drawPile).toEqual(originals.slice(1));
  await play(originals[0], 0);
  expect(R.played).toContain(originals[0]);
  E.finish(null);
  expect(R.opts.spentCards.some(entry => entry.uid === originals[0])).toBe(false);
  expect(R.opts.spentCards.some(entry => entry.card.id === C.SHA.id)).toBe(false);
});
