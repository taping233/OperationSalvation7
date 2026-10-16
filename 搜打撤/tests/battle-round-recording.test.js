import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: { rules: { battleEnergy: 2, battleHandMax: 8, bossDeckSize: 15, starterSha: 1,
    battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 }, items: {} },
};
await import('../game/src/cards/cards.js');
const recorder = await import('../game/src/agent/agent.recorder.js');
window.SDT.Agent = { recorder };
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');
let game, summary;
const tick = () => new Promise(resolve => setTimeout(resolve, 1));
async function idle() {
  for (let i = 0; i < 500; i++) {
    await tick();
    const snapshot = BattleSession.getSnapshot();
    if (!snapshot.busy && !snapshot.actionQueueLength) return snapshot;
  }
  throw new Error('battle did not settle');
}
async function start(options = {}, hp = 1000) {
  BattleSession.start(game, [{ id: 'round-audit', name: '回合统计靶子', hp, atk: 1, behavior: 'strike' }], options);
  return idle();
}
async function advanceTo(round, extra = false) {
  while (BattleSession.getSnapshot().turn < round) {
    // 只为覆盖真实额外回合分支设置已获得的效果；不伪装实页卡牌输入。
    if (extra) runtime.set$extraTurn(true);
    BattleSession.commands.endTurn();
    await idle();
  }
}
function expectRecord(round, mode) {
  const stats = recorder.snapshotRunBattles();
  expect(summary.round).toBe(round);
  expect(stats).toMatchObject({ fought: 1, won: mode === 'win' ? 1 : 0 });
  expect(stats.log).toHaveLength(1);
  expect(stats.log[0]).toMatchObject({ round, mode, turn: 42, hits: null, potions: null });
}
beforeAll(() => {
  for (const key of ['ensureSha', 'ensureStarters', 'ensureTabletop', 'ensureDmgTypes', 'ensureEffectFields']) window.SDT.Cards[key]();
});
beforeEach(() => {
  localStorage.clear();
  recorder.resetRunCounters();
  recorder.snapshotRunBattles('round-recording-run');
  summary = null;
  game = {
    ownedCards: [{ uid: 'attack', card: structuredClone(window.SDT.Cards.all().find(card => card.id === 'starter-attack')) }],
    inventory: [], usedPocket: [], cardOrder: [], eventLog: [], layerIdx: 0, trackPos: 1,
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, turn: 42,
    state: 'idle', battleActive: false, myClass: '侠客', log() {}, heal() {}, addItem() {},
    onBattleEnd(opts) { summary = opts.battleSummary; },
  };
  window.SDT.game = game;
});
afterEach(() => { if (game?.battleActive) BattleSession.commands.flee(); });

describe('跑局战斗轮数与实时快照/终局摘要一致', () => {
  it('普通战第3回合胜利，记录战斗轮数而不是状态机初始值或局内行动数', async () => {
    await start({}, 1);
    await advanceTo(3);
    const snapshot = BattleSession.getSnapshot();
    BattleSession.commands.playCard(snapshot.hand[0], 0);
    await idle();
    expect(game.battleActive).toBe(false);
    expectRecord(snapshot.turn, 'win');
  });

  it('首脑战第5回合认输，落败记录与最后复盘轮数相同', async () => {
    await start({ isBoss: true, directBossStart: true });
    await advanceTo(5);
    const snapshot = BattleSession.getSnapshot();
    BattleSession.commands.surrender();
    expectRecord(snapshot.turn, 'lose');
  });

  it('首脑第5轮敌方攻击致死，不把终局时钟提前计成下一轮', async () => {
    game.hp = 5;
    await start({ isBoss: true, directBossStart: true });
    await advanceTo(5);
    const snapshot = BattleSession.getSnapshot();
    BattleSession.commands.endTurn();
    await idle();
    expect(game.battleActive).toBe(false);
    expect(game.hp).toBeLessThanOrEqual(0);
    expectRecord(snapshot.turn, 'lose');
  });

  it.each([false, true])('第3回合撤退（额外回合=%s）沿用实际战斗时钟', async extra => {
    await start();
    await advanceTo(3, extra);
    const snapshot = BattleSession.getSnapshot();
    BattleSession.commands.flee();
    expectRecord(snapshot.turn, 'flee');
  });

  it('首回合胜利仍记录1', async () => {
    await start({}, 1);
    BattleSession.commands.playCard(BattleSession.getSnapshot().hand[0], 0);
    await idle();
    expectRecord(1, 'win');
  });

  it('第3回合存检查点后重开，重开后的第1回合才是最终记录源', async () => {
    await start();
    await advanceTo(3);
    const checkpoint = BattleSession.serialize();
    expect(BattleSession.restore(game, checkpoint)).toBe(true);
    await idle();
    expect(BattleSession.getSnapshot().turn).toBe(1);
    expect(recorder.snapshotRunBattles().fought).toBe(0);
    BattleSession.commands.flee();
    expectRecord(1, 'flee');
  });

  it('追加新战斗只使用新轮数，不改写此前已有的轮数记录', async () => {
    recorder.noteBattle(true, { round: 1, mode: 'win', foe: '历史记录' });
    const oldRow = structuredClone(recorder.snapshotRunBattles().log[0]);
    await start();
    await advanceTo(3);
    BattleSession.commands.flee();
    const stats = recorder.snapshotRunBattles();
    expect(stats.log[0]).toEqual(oldRow);
    expect(stats.log[1].round).toBe(3);
    expect(summary.round).toBe(3);
  });
});
