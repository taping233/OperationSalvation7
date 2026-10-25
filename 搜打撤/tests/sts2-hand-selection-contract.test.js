import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildHandSelectionContract } from '../game/src/battle/core/battle.hand-selection.js';

const fixture = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({
  game: fixture.game, getActiveSlot: () => null, startNewGame() {},
  curLayer: () => null, bagCap: () => 30, usedSlots: () => fixture.game.ownedCards?.length || 0,
}));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: () => false, reenterCell: () => false }));

window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, UI: {},
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { ...battleRules(6, 30, 15, 0, 0, 0) }, items: {} } };
await import('../game/src/cards/cards.js');
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
const { act } = await import('../game/src/agent/agent.runner.js');
const { observe, bustSigCache } = await import('../game/src/agent/agent.state.js');
const { setTurbo } = await import('../game/src/core/turbo.js');
const paymentCard = () => ({ id: 'selection-payment', name: '选牌支付', cost: 1, type: '武术',
  dmg: 2, dmgType: 'fixed', desc: '造成2点固定伤害。',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false },
    requirements: [{ kind: 'handCards', count: 2, type: '初始攻击' }] },
  triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } });
const martial = index => ({ id: `martial-${index}`, name: '初始攻击', type: '武术', cost: 1,
  dmg: 1, dmgType: 'attack', desc: '攻。' });
const spell = () => ({ id: 'selection-spell', name: '普通法术', type: '法术', cost: 0, desc: '' });
const pickActions = obs => obs.actions.filter(action => action.type === 'battle' && action.name === 'pickHandSelect');
const skipActions = obs => obs.actions.filter(action => action.type === 'battle' && action.name === 'skipHandSelect');
async function idle() {
  for (let i = 0; i < 200; i++) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) return state;
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  throw new Error('Actual battle command did not settle');
}
function start(cards = [paymentCard(), martial(1), martial(2), spell()]) {
  if (fixture.game.battleActive) BattleSession.commands.flee();
  Object.keys(fixture.game).forEach(key => { delete fixture.game[key]; });
  Object.assign(fixture.game, { runActive: true, nestActive: false, battleActive: false, state: 'idle',
    discoveredPairs: new Set(), nestRunes: [], turn: 1, mode: 'standard', mapSeed: 72831,
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '侠客',
    inventory: [], usedPocket: [], cardOrder: cards.map((_, index) => `card-${index}`),
    ownedCards: cards.map((card, index) => ({ uid: `card-${index}`, card, safe: false })),
    log() {}, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, onBattleEnd() {},
  });
  window.SDT.game = fixture.game;
  window.SDT.Battle = BattleSession;
  BattleSession.start(fixture.game, [{ id: 'target', name: '选牌测试靶', hp: 80, atk: 1 }], { isBoss: false });
  bustSigCache();
}
function selectEffect({ type = '武术', mandatory = false, n = 1, act: kind = 'consume' } = {}) {
  runtime.set$handSelecting({ n, type, act: kind, mandatory, thenText: '', target: null, srcCard: null, onDone: null });
  bustSigCache();
  return observe();
}

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"></div></div>';
  setTurbo(true);
  configureBattleRenderer(() => {});
  window.SDT.Cards.ensureSha(); window.SDT.Cards.ensureStarters();
  window.SDT.Cards.ensureDmgTypes(); window.SDT.Cards.ensureEffectFields();
  start();
});
afterEach(async () => {
  await idle();
  if (fixture.game.battleActive) BattleSession.commands.flee();
  configureBattleRenderer(null);
});

describe('domain hand-selection candidates shared by snapshots and Agent', () => {
  it('builds immutable ordered candidates without modifying frozen inputs', () => {
    const selection = Object.freeze({ act: 'payment', type: '武术', mandatory: true,
      excludedUids: Object.freeze(['self']), selectedUids: Object.freeze(['already']) });
    const entries = Object.freeze(['b', 'self', 'already', 'a'].map(uid => Object.freeze({ uid,
      card: Object.freeze({ type: '武术' }) })));
    const contract = buildHandSelectionContract(selection, entries);
    expect(contract).toEqual({ candidateUids: ['b', 'a'], canCancel: false });
    expect(Object.isFrozen(contract)).toBe(true);
    expect(Object.isFrozen(contract.candidateUids)).toBe(true);
    expect(entries.map(entry => entry.uid)).toEqual(['b', 'self', 'already', 'a']);
    expect(selection.selectedUids).toEqual(['already']);
  });

  it('exposes only payable UIDs, reduces them after each selection, and preserves final payment validation', async () => {
    const before = BattleSession.getSnapshot();
    expect(act({ type: 'battle', name: 'playCard', args: ['card-0', 0] }).ok).toBe(true);
    let obs = observe();
    expect(obs.battle.handSelecting).toMatchObject({ candidateUids: ['card-1', 'card-2'], canCancel: false, need: 2 });
    expect(pickActions(obs).map(action => action.args[0])).toEqual(['card-1', 'card-2']);
    expect(skipActions(obs)).toEqual([]);
    const stale = pickActions(obs)[0];
    expect(act(stale).ok).toBe(true);
    obs = observe();
    expect(obs.battle.handSelecting).toMatchObject({ candidateUids: ['card-2'], need: 1 });
    expect(act(stale)).toMatchObject({ ok: false, code: 'HAND_SELECTION_UNAVAILABLE' });
    expect(act({ type: 'battle', name: 'skipHandSelect', args: [] }))
      .toMatchObject({ ok: false, code: 'HAND_SELECTION_MANDATORY' });
    expect(BattleSession.getSnapshot().energy).toBe(before.energy);
    expect(act(pickActions(obs)[0]).ok).toBe(true);
    const after = await idle();
    expect(after.handSelecting).toBeNull();
    expect(after.energy).toBe(before.energy - 1);
    expect(after.consumed).toContain('card-1');
    expect(after.consumed).toContain('card-2');
    expect(after.foes[0].hp).toBe(78);
    expect(act(stale)).toMatchObject({ ok: false, code: 'HAND_SELECTION_STALE' });
  });

  it.each(['consume', 'copy', 'zero', 'play'])('every emitted %s effect pick is legal under the same current candidate contract', async kind => {
    start([martial(0), martial(1), spell()]);
    const initial = selectEffect({ act: kind });
    expect(pickActions(initial).map(action => action.args[0])).toEqual(['card-0', 'card-1']);
    for (const action of pickActions(initial)) {
      start([martial(0), martial(1), spell()]);
      selectEffect({ act: kind });
      expect(act(action).ok).toBe(true);
      const state = await idle();
      expect(state.handSelecting).toBeNull();
      if (kind === 'consume') expect(state.consumed).toContain(action.args[0]);
      if (kind === 'copy') expect(state.hand).toHaveLength(4);
      if (kind === 'zero') expect(runtime.zeroFeeUntil.has(action.args[0])).toBe(true);
    }
  });

  it('removes consumed effect candidates during a multi-step mandatory selection', () => {
    start([martial(0), martial(1), spell()]);
    let obs = selectEffect({ n: 2, mandatory: true });
    expect(skipActions(obs)).toEqual([]);
    const first = pickActions(obs)[0];
    expect(act(first).ok).toBe(true);
    obs = observe();
    expect(obs.battle.handSelecting).toMatchObject({ candidateUids: ['card-1'], need: 1, canCancel: false });
    expect(act(first)).toMatchObject({ ok: false, code: 'HAND_SELECTION_UNAVAILABLE' });
    expect(act(pickActions(obs)[0]).ok).toBe(true);
    expect(BattleSession.getSnapshot().handSelecting).toBeNull();
    expect(BattleSession.getSnapshot().consumed).toEqual(['card-0', 'card-1']);
  });

  it('emits and executes skip only for optional selections without consuming a card', () => {
    const obs = selectEffect();
    const hand = BattleSession.getSnapshot().hand;
    expect(skipActions(obs)).toHaveLength(1);
    expect(act(skipActions(obs)[0]).ok).toBe(true);
    expect(BattleSession.getSnapshot().handSelecting).toBeNull();
    expect(BattleSession.getSnapshot().hand).toEqual(hand);
    expect(BattleSession.getSnapshot().consumed).toEqual([]);
  });

  it('rechecks a card that disappeared between observation and dispatch without paying or advancing', () => {
    act({ type: 'battle', name: 'playCard', args: ['card-0', 0] });
    const stale = pickActions(observe())[0];
    fixture.game.ownedCards.splice(fixture.game.ownedCards.findIndex(entry => entry.uid === stale.args[0]), 1);
    const before = BattleSession.getSnapshot();
    expect(before.handSelecting.candidateUids).toEqual(['card-2']);
    expect(act(stale)).toMatchObject({ ok: false, code: 'HAND_SELECTION_UNAVAILABLE' });
    expect(BattleSession.getSnapshot().energy).toBe(before.energy);
    expect(BattleSession.getSnapshot().handSelecting.n).toBe(2);
    expect(BattleSession.getSnapshot().consumed).toEqual([]);
  });

  it('uses stored override eligibility and leaves legacy card definitions unchanged while building candidates', () => {
    start([martial(0), martial(1), spell()]);
    const legacy = fixture.game.ownedCards[0].card;
    legacy.id = 'tt7-thundergrudge'; legacy.dmg = -999;
    runtime.cardOverrides.set('card-1', { ...fixture.game.ownedCards[1].card, type: '法术' });
    const before = JSON.stringify(fixture.game.ownedCards);
    runtime.set$handSelecting({ n: 1, type: '武术', act: 'consume', mandatory: true });
    const state = BattleSession.getSnapshot();
    expect(state.handSelecting.candidateUids).toEqual(['card-0']);
    expect(JSON.stringify(fixture.game.ownedCards)).toBe(before);
    expect(legacy.dmg).toBe(-999);
    expect(Object.isFrozen(state.handSelecting.candidateUids)).toBe(true);
  });
});
