import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

window.SDT ||= {};
window.SDT.Icons = { ...(window.SDT.Icons || {}), img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 30, battleHandMax: 99, bossDeckSize: 1, starterSha: 0,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
let game = null;
let sequence = 0;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

const facts = () => runtime.pstat?.requestedCards?.history?.events || [];
const completions = () => facts().filter(event => event.kind === 'cardCompleted');
const damage = side => facts().filter(event => event.kind === 'damage' && (!side || event.targetSide === side));

async function idle() {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 10));
    const snapshot = BattleSession.getSnapshot();
    if (snapshot.deckSelection) {
      for (const entry of snapshot.deckSelection.cards.slice(0, snapshot.deckSelection.need))
        if (!snapshot.deckSelection.selected.includes(entry.uid)) BattleSession.commands.selectDeckCard(entry.uid);
      BattleSession.commands.confirmDeck();
      continue;
    }
    if (!snapshot.busy && snapshot.actionQueueLength === 0) return snapshot;
  }
  throw new Error('Combat facts action did not settle');
}

async function start(cards, definitions = [{ id: 'facts-target', name: '事实靶', hp: 200, atk: 3 }]) {
  const ownedCards = cards.map(value => {
    const card = typeof value === 'string' ? Cards.all().find(candidate => candidate.id === value) : value;
    expect(card, `fixture card ${value}`).toBeTruthy();
    return { uid: `facts-${sequence++}`, card: structuredClone(card), safe: false };
  });
  game = {
    ownedCards, hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    logs: [], onLog: null,
    log(message) { this.logs.push(String(message)); this.onLog?.(String(message)); },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, definitions, { isBoss: false, name: '战斗事实回归' });
  await idle();
  return game;
}

async function play(id, target = 'self') {
  const entry = game.ownedCards.find(candidate => candidate.card.id === id && runtime.hand.includes(candidate.uid));
  expect(entry, `live hand card ${id}`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, target);
  await idle();
  return entry;
}

afterEach(async () => {
  if (game?.battleActive) { BattleSession.commands.flee(); await idle(); }
  game = null;
});

describe('战斗事实通过真实 BattleSession 边界记录', () => {
  it('规则结算读取此前完成牌，完成事实随后更新本回合计数', async () => {
    const rapid = { id: 'facts-rapid', name: '事实连续射击', type: '武术', cost: 0,
      dmg: 2, dmgType: 'fixed', desc: '', rules: { version: 1,
        battle: { target: { side: 'enemy', area: false } },
        triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hits: { perPlayedMoves: true } }] } } };
    await start([rapid, rapid]);
    const observations = [];
    game.onLog = text => {
      if (text.includes('本回合') && text.includes('招式'))
        observations.push({ moves: runtime.playedMovesThisTurn, completed: completions().length });
    };
    const first = await play(rapid.id, 0);
    expect(runtime.foes[0].hp).toBe(200);
    expect(completions()).toMatchObject([{ uid: first.uid, movesAfter: 1, martialAfter: 1 }]);
    const second = await play(rapid.id, 0);
    expect(runtime.foes[0].hp).toBe(198);
    expect(observations).toEqual([{ moves: 0, completed: 0 }, { moves: 1, completed: 1 }]);
    expect(completions()).toMatchObject([
      { uid: first.uid, cardId: rapid.id, movesAfter: 1, martialAfter: 1 },
      { uid: second.uid, cardId: rapid.id, movesAfter: 2, martialAfter: 2 },
    ]);
    expect(runtime.playedMovesThisTurn).toBe(2);
    expect(runtime.playedMartialThisTurn).toBe(2);
  });

  it('费用拒绝不记完成或伤害事实，也不移动手牌', async () => {
    await start([{ ...Cards.all().find(card => card.id === 'tt2-shoot'), cost: 3 }]);
    const entry = game.ownedCards[0];
    runtime.set$energy(0);
    const before = JSON.stringify(facts());
    expect(BattleSession.commands.getCardPlayAvailability(entry.uid, 0).status).toBe('rejected');
    expect(BattleSession.commands.submitCardPlay(entry.uid, 0).status).toBe('rejected');
    BattleSession.commands.playCard(entry.uid, 0);
    await idle();
    expect(JSON.stringify(facts())).toBe(before);
    expect(runtime.hand).toContain(entry.uid);
    expect(runtime.foes[0].hp).toBe(200);
    expect(runtime.playedMovesThisTurn).toBe(0);
  });

  it('护身按真实正伤事实取10/6，完全挡下的命中不算造成伤害', async () => {
    await start(['tt13-guard', 'tt13-guard', 'tt2-shoot', 'tt2-shoot']);
    runtime.foes[0].defense.shield = 50;
    await play('tt2-shoot', 0);
    expect(runtime.foes[0].hp).toBe(200);
    expect(damage('enemy')).toEqual([]);
    await play('tt13-guard');
    expect(runtime.pdef.armor).toBe(10);
    runtime.foes[0].defense.shield = 0;
    await play('tt2-shoot', 0);
    expect(damage('enemy')).toMatchObject([{ amount: 2, targetId: 'facts-target', hpAfter: 198 }]);
    const before = runtime.pdef.armor;
    await play('tt13-guard');
    expect(runtime.pdef.armor - before).toBe(6);
  });

  it.each([false, true])('新回合清条件而保留旧事实，新战重新计账：extraTurn=%s', async extraTurn => {
    await start(['tt2-shoot', 'tt13-guard']);
    await play('tt2-shoot', 0);
    const oldTurn = runtime.turn;
    if (extraTurn) runtime.set$extraTurn(true);
    BattleSession.commands.endTurn();
    await idle();
    expect(runtime.turn).toBe(oldTurn + 1);
    expect(damage('enemy')).toMatchObject([{ turn: oldTurn, amount: 2 }]);
    expect(runtime.playedMovesThisTurn).toBe(0);
    const before = runtime.pdef.armor;
    await play('tt13-guard');
    expect(runtime.pdef.armor - before).toBe(10);
    BattleSession.commands.flee(); await idle();
    await start(['tt13-guard']);
    expect(facts()).toEqual([]);
    await play('tt13-guard');
    expect(runtime.pdef.armor).toBe(10);
    expect(completions()).toMatchObject([{ movesAfter: 1, martialAfter: 1 }]);
  });

  it('源卡和敌人后续改变不会重写已记事实或已取快照', async () => {
    await start(['tt2-shoot']);
    const entry = await play('tt2-shoot', 0);
    const recorded = JSON.stringify(facts());
    const snapshot = BattleSession.getSnapshot();
    const copied = JSON.stringify(snapshot.pstat.requestedCards.history);
    entry.card.id = 'changed-id'; entry.card.name = '改名卡'; entry.card.type = '资源';
    runtime.foes[0].id = 'changed-target'; runtime.foes[0].name = '改名敌人'; runtime.foes[0].hp = 50;
    expect(JSON.stringify(facts())).toBe(recorded);
    expect(JSON.stringify(snapshot.pstat.requestedCards.history)).toBe(copied);
    expect(damage('enemy')[0]).toMatchObject({ cardId: 'tt2-shoot', targetId: 'facts-target', hpAfter: 198 });
    expect(completions()[0]).toMatchObject({ cardId: 'tt2-shoot', cardType: '武术' });
  });

  it('真实受伤先记玩家事实再触发逆鳞反击，零伤不触发', async () => {
    await start(['tt13-scale-armor']);
    await play('tt13-scale-armor');
    expect(runtime.equipped.some(entry => entry.card.id === 'tt13-scale-armor')).toBe(true);
    runtime.pdef.shield = 50;
    BattleSession.commands.endTurn(); await idle();
    expect(damage()).toEqual([]);
    expect(game.hp).toBe(100);
    runtime.pdef.shield = 0; runtime.pdef.armor = 0;
    const hitTurn = runtime.turn;
    BattleSession.commands.endTurn(); await idle();
    expect(game.hp).toBe(97);
    expect(damage()).toMatchObject([
      { targetSide: 'player', turn: hitTurn, amount: 3, hpAfter: 97 },
      { targetSide: 'enemy', turn: hitTurn, amount: 3, cardId: 'tt13-scale-armor' },
    ]);
  });

  it('JSON旧战斗档的damageTurn兼容护身条件，恢复不修改输入', async () => {
    await start(['tt13-guard']);
    const uid = game.ownedCards[0].uid;
    const saved = JSON.parse(JSON.stringify({
      opts: { isBoss: false }, mode: 'normal', turn: 2, energy: 20, maxEnergy: 20,
      hand: [uid], drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
      pdef: { armor: 0, shield: 0, guard: false },
      pstat: { status: {}, requestedCards: { damageTurn: 2, flameForms: [], astrolabes: {} } },
      foes: [{ id: 'restored-target', name: '恢复敌人', hp: 200, maxHp: 200, atk: 3,
        dead: false, status: {}, defense: {} }],
      delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [],
    }));
    const unchanged = JSON.stringify(saved);
    expect(BattleSession.restore(game, saved)).toBe(true);
    await idle();
    await play('tt13-guard');
    expect(runtime.pdef.armor).toBe(6);
    expect(facts()).toMatchObject([
      { kind: 'legacyEnemyDamage', turn: 2 },
      { kind: 'cardCompleted', turn: 2, uid, cardId: 'tt13-guard' },
    ]);
    expect(JSON.stringify(saved)).toBe(unchanged);
  });
});
