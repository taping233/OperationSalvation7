import { battleRules, playerFields } from './helpers/environment-fixtures.js';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { ...(window.SDT.Icons || {}), img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { ...battleRules(20, 99, 1, 0, 5, 1) },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const { CURSES } = await import('../game/src/battle/core/combat.js');
const { validateCardRules } = await import('../game/src/cards/card-rules.schema.js');
const Cards = window.SDT.Cards;
let activeGame, sequence = 0;

beforeAll(() => {
  for (const card of Cards.TABLETOP13) expect(validateCardRules(card), `seed schema ${card.id}`).toMatchObject({ ok: true, errors: [] });
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

async function idle() {
  const until = Date.now() + 5000;
  while (Date.now() < until) {
    await new Promise(resolve => setTimeout(resolve, 10));
    const snapshot = BattleSession.getSnapshot();
    if (snapshot.deckSelection) {
      const selection = snapshot.deckSelection;
      for (const entry of selection.cards.slice(0, selection.need)) {
        if (!selection.selected.includes(entry.uid)) BattleSession.commands.selectDeckCard(entry.uid);
      }
      BattleSession.commands.confirmDeck();
      continue;
    }
    if (!snapshot.busy && snapshot.actionQueueLength === 0) return snapshot;
  }
  throw new Error('Requested-card BattleSession action did not settle');
}

async function start(ids, definitions = [{ id: 'target', name: '测试靶', hp: 100, atk: 1 }], options = {}) {
  const ownedCards = ids.map(id => {
    const card = Cards.all().find(candidate => candidate.id === id);
    expect(card, `catalog card ${id}`).toBeTruthy();
    return { uid: `requested-${sequence++}`, card: structuredClone(card), safe: false };
  });
  const logs = [];
  activeGame = {
    ownedCards, ...playerFields(100, 100, 5, 0, '侠客', null), lastBattleEnd: null,
    log(message) { logs.push(String(message)); }, logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); }, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(activeGame, definitions, { isBoss: false, name: 'Requested-card integration', ...options });
  await idle();
  return activeGame;
}

async function play(id, target = 'self') {
  const entry = activeGame.ownedCards.find(candidate => candidate.card.id === id && runtime.hand.includes(candidate.uid));
  expect(entry, `${id} must be available in hand`).toBeTruthy();
  BattleSession.commands.playCard(entry.uid, target);
  return idle();
}

afterEach(async () => {
  if (activeGame?.battleActive) { BattleSession.commands.flee(); await idle(); }
  activeGame = null;
});

describe('requested cards through real BattleSession', () => {
  it('已有十三批播种标记的旧卡库也补入穷鬼套餐，重复初始化不增加副本', () => {
    const original = Cards.all();
    Cards.saveAll(original.filter(card => card.id !== 'tt13-poor-meal'));
    localStorage.setItem('sdt-cards-tt13-v1-seeded', '1');
    localStorage.removeItem('sdt-cards-poor-meal-v1-seeded');
    Cards.ensureTabletop();
    Cards.ensureTabletop();
    const matches = Cards.all().filter(card => card.id === 'tt13-poor-meal');
    expect(matches).toHaveLength(1);
    expect(Cards.isRandomObtainable(matches[0])).toBe(true);
  });

  it('穷鬼套餐只在穿戴且手牌不超过三张时免除技能费用，并保留每回合一次', async () => {
    await start(['tt13-poor-meal', 'starter-attack', 'starter-attack', 'starter-attack', 'starter-attack']);
    expect(engine.slamSkill().cost).toBe(1);
    await play('tt13-poor-meal');
    expect(runtime.equipped.some(entry => entry.card.id === 'tt13-poor-meal')).toBe(true);
    expect(runtime.hand.length).toBe(4);
    expect(engine.slamSkill().cost).toBe(1);
    const removed = runtime.hand.pop();
    expect(engine.slamSkill()).toMatchObject({ cost: 0, used: false });
    expect(engine.slamSkill().hint).toMatch(/^0 费/);
    runtime.hand.push(removed);
    expect(engine.slamSkill().cost).toBe(1);
    runtime.hand.pop();
    runtime.set$energy(0);
    BattleSession.commands.beginSlamInteraction();
    BattleSession.commands.resolveSlamInteraction(0);
    await idle();
    expect(runtime.energy).toBe(0);
    expect(runtime.foes[0].hp).toBe(98);
    expect(engine.slamSkill().used).toBe(true);
    BattleSession.commands.beginSlamInteraction();
    BattleSession.commands.resolveSlamInteraction(0);
    await idle();
    expect(runtime.foes[0].hp).toBe(98);
    runtime.equipped.splice(0);
    expect(engine.slamSkill().cost).toBe(1);
  });

  it.each(['侠客', '战士', '法师', '降临者', '牧师'])('穷鬼套餐适用于%s的技能，零手牌也免除费用', async cls => {
    await start(['tt13-poor-meal']);
    activeGame.myClass = cls;
    expect(engine.slamSkill().cost).toBeGreaterThan(0);
    await play('tt13-poor-meal');
    expect(runtime.hand).toHaveLength(0);
    expect(engine.slamSkill().cost).toBe(0);
  });

  it('snipe deals fixed nine without attack or spell bonuses and no refund on survival', async () => {
    await start(['tt13-snipe']);
    activeGame.atk = 50; activeGame.spellPower = 50;
    const energy = runtime.energy;
    await play('tt13-snipe', 0);
    expect(runtime.foes[0].hp).toBe(91);
    expect(runtime.energy).toBe(energy - 2);
  });

  it.each([false, true])('snipe refunds one on kill, including last enemy=%s', async last => {
    const definitions = [{ id: 'weak', name: '弱敌', hp: 9, atk: 1 }];
    if (!last) definitions.push({ id: 'survivor', name: '余敌', hp: 100, atk: 1 });
    await start(['tt13-snipe'], definitions);
    const energy = runtime.energy;
    await play('tt13-snipe', 0);
    expect(runtime.foes[0].dead).toBe(true);
    expect(runtime.energy).toBe(energy - 1);
    expect(activeGame.battleActive).toBe(!last);
  });

  it('snipe refunds energy before a real boss defeat interrupts staged resolution', async () => {
    await start(['tt13-snipe'], [{ id: 'boss', name: '首脑靶', hp: 9, atk: 1, boss: true }], { isBoss: true });
    expect(runtime.foes[0].boss).toBe(true);
    const energy = runtime.energy;
    await play('tt13-snipe', 0);
    expect(runtime.foes[0].dead).toBe(true);
    expect(runtime.energy).toBe(energy - 1);
    expect(activeGame.battleActive).toBe(false);
  });

  it('snipe does not count a zero-HP revival as a kill or refund energy', async () => {
    await start(['tt13-snipe'], [{ id: 'reviving', name: '复活靶', hp: 9, atk: 1, revive: { hearts: 8, atk: 8 } }]);
    const energy = runtime.energy;
    await play('tt13-snipe', 0);
    expect(runtime.foes[0]).toMatchObject({ hp: 8, dead: false, revived: true });
    expect(runtime.energy).toBe(energy - 2);
    expect(activeGame.battleActive).toBe(true);
  });

  it('legacy restore retains boss identity and soul-contract marks', async () => {
    await start(['tt13-mind-control']);
    const uid = activeGame.ownedCards[0].uid;
    const saved = {
      opts: { isBoss: true }, mode: 'boss', turn: 2, energy: 20, maxEnergy: 20,
      hand: [uid], drawPile: [], discard: [], grave: [], played: [], consumed: [], granted: [],
      pdef: { armor: 0, shield: 0, guard: false }, pstat: { status: {} },
      foes: [{ id: 'saved-boss', name: '恢复首脑', hp: 5, maxHp: 10, atk: 1, dead: false, boss: true, soulContractMarked: true, status: {}, defense: {} },
        { id: 'controlled', name: '已转化敌人', hp: 3, maxHp: 10, atk: 1, dead: true, controlled: true, status: {}, defense: {} }],
      delayed: [], growth: {}, growthNames: [], zeroFeeUntil: [], cardOverrides: [],
    };
    expect(BattleSession.restore(activeGame, saved)).toBe(true);
    await idle();
    expect(runtime.foes[0]).toMatchObject({ boss: true, soulContractMarked: true });
    expect(runtime.foes[1].controlled).toBe(true);
    delete saved.foes[0].boss;
    expect(BattleSession.restore(activeGame, saved)).toBe(true);
    await idle();
    expect(runtime.foes[0].boss).toBeUndefined();
    expect(runtime.foes[0].controlBoss).toBe(true);
    expect(BattleSession.commands.getCardPlayAvailability(uid, 0).status).toBe('rejected');
  });

  it('guard gives ten armor before damage and six after dealing damage', async () => {
    await start(['tt13-guard', 'tt13-guard', 'tt2-shoot']);
    await play('tt13-guard');
    expect(runtime.pdef.armor).toBe(10);
    await play('tt2-shoot', 0);
    const before = runtime.pdef.armor;
    await play('tt13-guard');
    expect(runtime.pdef.armor - before).toBe(6);
  });

  it.each([false, true])('guard damage history resets on a new turn, extraTurn=%s', async extraTurn => {
    await start(['tt13-guard', 'tt2-shoot']);
    await play('tt2-shoot', 0);
    if (extraTurn) runtime.set$extraTurn(true);
    const oldTurn = runtime.turn;
    BattleSession.commands.endTurn();
    await idle();
    expect(runtime.turn).toBe(oldTurn + 1);
    const before = runtime.pdef.armor;
    await play('tt13-guard');
    expect(runtime.pdef.armor - before).toBe(10);
  });

  it('bitter rain alone adds poison without treating its own poison as a prior curse', async () => {
    await start(['tt13-bitter-rain']);
    await play('tt13-bitter-rain', 0);
    expect(runtime.foes[0].status.poison).toBe(2);
    expect(CURSES.filter(key => runtime.foes[0].status[key] > 0)).toEqual(['poison']);
  });

  it('bitter rain on an already cursed enemy adds exactly one previously absent kind', async () => {
    await start(['tt13-bitter-rain']);
    runtime.foes[0].status.bleed = 3;
    await play('tt13-bitter-rain', 0);
    const status = runtime.foes[0].status;
    expect(status.poison).toBe(2); expect(status.bleed).toBe(3);
    expect(CURSES.filter(key => status[key] > 0)).toHaveLength(3);
  });

  it('bitter rain never duplicates another curse when all kinds are present', async () => {
    await start(['tt13-bitter-rain']);
    for (const key of CURSES) runtime.foes[0].status[key] = 2;
    const before = { ...runtime.foes[0].status };
    await play('tt13-bitter-rain', 0);
    for (const key of CURSES) expect(runtime.foes[0].status[key]).toBe(before[key] + (key === 'poison' ? 2 : 0));
  });

  it.each([{ hp: 30, armor: 0, after: 22 }, { hp: 4, armor: 0, after: 1 }, { hp: 4, armor: 6, after: 2 }, { hp: 1, armor: 0, after: 1 }])('mercy adds three attack, applies armor, then prevents lethal damage: %j', async ({ hp, armor, after }) => {
    await start(['tt13-mercy'], [{ id: 'target', name: '留情靶', hp, atk: 1 }]);
    runtime.foes[0].defense.armor = armor;
    await play('tt13-mercy', 0);
    expect(runtime.foes[0].hp).toBe(after);
    expect(runtime.foes[0].dead).toBe(false);
    expect(runtime.foes[0].defense.armor).toBe(0);
  });

  it('mind control converts a wounded non-boss without kill rewards', async () => {
    await start(['tt13-mind-control'], [{ id: 'convert', name: '受伤敌人', hp: 10, atk: 3 }, { id: 'other', name: '其他敌人', hp: 100, atk: 1 }]);
    runtime.foes[0].hp = 6;
    runtime.set$killAtkUp(7);
    const before = runtime.pstat.status.atkUp || 0;
    await play('tt13-mind-control', 0);
    expect(runtime.allies.some(ally => ally.name === '受伤敌人' && ally.hp === 6 && ally.atk === 3)).toBe(true);
    expect(engine.alive().some(foe => foe.name === '受伤敌人')).toBe(false);
    expect(runtime.pstat.status.atkUp || 0).toBe(before);
    expect(activeGame.logs.some(log => log.includes('饮血剑'))).toBe(false);
  });

  it.each(['full', 'boss'])('mind control never converts an illegal %s target', async kind => {
    await start(['tt13-mind-control']);
    if (kind === 'boss') { runtime.foes[0].hp = 50; runtime.foes[0].boss = true; }
    const { uid, card } = activeGame.ownedCards[0];
    const energy = runtime.energy;
    expect(BattleSession.commands.getCardPlayAvailability(uid, 0).status).toBe('rejected');
    expect(BattleSession.commands.submitCardPlay(uid, 0).status).toBe('rejected');
    await play('tt13-mind-control', 0);
    expect(runtime.energy).toBe(energy);
    expect(runtime.hand).toContain(uid);
    // Automatic/free selection producers must also recheck before committing the card.
    engine.queueCardExecution(uid, card, [], runtime.foes[0], false);
    await idle();
    expect(runtime.energy).toBe(energy);
    expect(runtime.hand).toContain(uid);
    expect(runtime.allies).toHaveLength(0);
    expect(engine.alive()).toHaveLength(1);
  });

  it('spring restores a used hero skill so it can be used again in the same turn', async () => {
    await start(['tt13-spring']);
    const turn = runtime.turn;
    BattleSession.commands.beginSlamInteraction();
    BattleSession.commands.resolveSlamInteraction(0);
    await idle();
    expect(engine.slamSkill().used).toBe(true);
    expect(runtime.foes[0].hp).toBe(98);
    await play('tt13-spring');
    expect(engine.slamSkill().used).toBe(false);
    BattleSession.commands.beginSlamInteraction();
    BattleSession.commands.resolveSlamInteraction(0);
    await idle();
    expect(runtime.turn).toBe(turn);
    expect(runtime.foes[0].hp).toBe(96);
    expect(engine.slamSkill().used).toBe(true);
  });
});

it('inferred control boss immunity does not create a victory flag when another enemy survives', async () => {
  await start(['tt13-snipe'], [
    { id:'inferred-boss', name:'首位敌人', hp:9, atk:0 },
    { id:'survivor', name:'仍存活敌人', hp:100, atk:0 },
  ], { isBoss:true });
  expect(runtime.foes[0].controlBoss).toBe(true);
  expect(runtime.foes[0].boss).toBeUndefined();
  expect(runtime.foes[1].controlBoss).toBe(false);
  await play('tt13-snipe', 0);
  expect(runtime.foes[0].dead).toBe(true);
  expect(runtime.foes[1].dead).toBe(false);
  expect(activeGame.battleActive).toBe(true);
});
