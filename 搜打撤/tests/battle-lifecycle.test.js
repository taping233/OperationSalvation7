import { describe, expect, it, vi } from 'vitest';

window.SDT = window.SDT || { Icons: { img: () => '' } };
window.SDT.Icons.TYPE_ART = {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 6, battleHandMax: 8, bossDeckSize: 15, starterSha: 5, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession, configureBattleRenderer, viewApi } = await import('../game/src/battle/battle.core.js');
const battleRuntime = await import('../game/src/battle/battle.runtime.js');
const { finish, requestBattleRender } = await import('../game/src/battle/battle.engine.js');
const { on: onBattleEnd } = await import('../game/src/core/event-bus.js');

window.SDT.Cards.ensureSha();
window.SDT.Cards.ensureStarters();
window.SDT.Cards.ensureTabletop();
window.SDT.Cards.ensureDmgTypes();
window.SDT.Cards.ensureEffectFields();
const feeRule = window.SDT.Cards.all().find(card => card.id === 'tt5-galaxy-voyage');
if (!feeRule) throw new Error('生命周期测试需要现有的「银河之旅」持续费用规则卡');
const armor = { id: 'lifecycle-armor', name: '生命周期护甲', cost: 1, type: '法术', desc: '获得 3 点护甲。', armor: 3 };
const probeSpell = { id: 'lifecycle-probe-spell', name: '费用探针', cost: 3, type: '武术', desc: '造成攻击伤害。', dmg: 1, dmgType: 'attack' };

function makeGame() {
  return {
    ownedCards: [
      { uid: 'fee-rule', card: feeRule, safe: false },
      { uid: 'armor-1', card: armor, safe: false },
    ],
    inventory: [], cardOrder: ['fee-rule', 'armor-1'], usedPocket: [], eventLog: [],
    hp: 30, maxHp: 30, atk: 5, spellPower: 0, coins: 8, turn: 1,
    myClass: '战士', characterId: 'heixiang', state: 'idle', battleActive: false,
    log(message) { this.eventLog.push(String(message)); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    onBattleEnd() {},
  };
}

const foe = () => ({ id: 'lifecycle-foe', name: '重置靶子', hp: 40, atk: 1 });
const start = (game, isBoss) => BattleSession.start(game, [foe()], isBoss
  ? { isBoss: true, nest: true, name: '生命周期首脑战' }
  : { isBoss: false, name: '生命周期普通战' });

async function drain() {
  for (let i = 0; i < 100; i++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) return state;
  }
  throw new Error('战斗动作未在生命周期用例中结算完成');
}

async function contaminateWithRealCards(game, isBoss) {
  start(game, isBoss);
  BattleSession.commands.playCard('fee-rule', null);
  await drain();
  BattleSession.commands.playCard('armor-1', 'self');
  await drain();
  const state = BattleSession.getSnapshot();
  expect(state.energy).toBe(3);
  expect(state.pdef.armor).toBe(3);
  expect(viewApi.effCostOf(probeSpell, 'probe-spell')).toBe(1);
}

function expectFreshBattle(state, mode) {
  expect(state).toMatchObject({ mode, turn: 1, energy: 6, maxEnergy: 6, pendingHint: '' });
  expect(state.pendingTarget).toBeNull();
  expect(state.pdef).toEqual({ shield: 0, armor: 0, guard: false });
  expect(viewApi.effCostOf(probeSpell, 'probe-spell')).toBe(3);
}

describe('跨战斗生命周期重置', () => {
  it('同一 session 二次 finish 不重复广播 battle:end', () => {
    const game = makeGame();
    const events = [];
    const off = onBattleEnd('battle:end', (...args) => events.push(args));
    try {
      start(game, false);
      BattleSession.commands.flee();
      expect(events).toHaveLength(1);

      finish(null); // 模拟排队中的旧完成回调迟到
      expect(events).toHaveLength(1);
      expect(battleRuntime.battleSession).toBeNull();
    } finally {
      off();
    }
  });

  it('替换战斗时取消真实排队的敌方步骤', () => {
    vi.useFakeTimers();
    const game = makeGame();
    let renderCount = 0;
    configureBattleRenderer(() => { renderCount++; });
    try {
      start(game, false);
      const first = battleRuntime.battleSession;
      BattleSession.commands.endTurn();
      expect(BattleSession.getSnapshot()).toMatchObject({ phase: 'enemy', busy: true });
      expect(vi.getTimerCount()).toBeGreaterThan(0);

      start(game, true);
      const second = battleRuntime.battleSession;
      const stableRenderCount = renderCount;
      expect(first.signal.aborted).toBe(true);
      vi.runOnlyPendingTimers();

      expect(BattleSession.getSnapshot()).toMatchObject({ phase: 'player', busy: false });
      expect(game.hp).toBe(30);
      expect(renderCount).toBe(stableRenderCount);
      expect(second.isCurrent()).toBe(true);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
      configureBattleRenderer(null);
    }
  });

  it('替换战斗时撤销真实挂起出牌，旧收尾不能改状态或重绘新战', async () => {
    const game = makeGame();
    let renderCount = 0;
    let releaseSurge;
    const surge = new Promise(resolve => { releaseSurge = resolve; });
    configureBattleRenderer(() => { renderCount++; });
    start(game, false);
    const first = battleRuntime.battleSession;
    battleRuntime.set$surgeWaiter(surge);
    BattleSession.commands.playCard('armor-1', 'self');
    const oldActionSignal = battleRuntime.activeActionSignal;
    expect(oldActionSignal).toBeTruthy();
    expect(battleRuntime.surgeWaiter).toBeNull();

    start(game, true);
    expect(first.signal.aborted).toBe(true);
    expect(first.isCurrent()).toBe(false);
    const second = battleRuntime.battleSession;
    expect(second.id).toBeGreaterThan(first.id);
    const newBattleRenderCount = renderCount;
    expect(newBattleRenderCount).toBeGreaterThan(0);

    // An old async action must pass its captured session to rendering.
    requestBattleRender(first);
    expect(renderCount).toBe(newBattleRenderCount);

    releaseSurge();
    for (let i = 0; i < 100 && battleRuntime.activeActionSignal; i++) {
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(battleRuntime.activeActionSignal).toBeNull();
    expect(BattleSession.getSnapshot()).toMatchObject({ phase: 'player', busy: false });
    expect(renderCount).toBe(newBattleRenderCount);

    BattleSession.commands.flee();
    expect(second.signal.aborted).toBe(true);
    expect(battleRuntime.battleSession).toBeNull();
    configureBattleRenderer(null);
  });

  it('Boss → 普通战重置真实出牌造成的费用规则、能量与护甲', async () => {
    const game = makeGame();
    await contaminateWithRealCards(game, true);
    BattleSession.commands.setPendingHint('旧战斗的拖拽提示');
    BattleSession.commands.flee();

    start(game, false);
    expectFreshBattle(BattleSession.getSnapshot(), 'normal');
    BattleSession.commands.flee();
  });

  it('普通战 → Boss → 再开普通战隔离上一战真实费用规则与护甲状态', async () => {
    const game = makeGame();
    await contaminateWithRealCards(game, false);
    BattleSession.commands.setPendingHint('普通战遗留提示');
    BattleSession.commands.flee();

    start(game, true);
    expectFreshBattle(BattleSession.getSnapshot(), 'boss');
    BattleSession.commands.setPendingHint('Boss 遗留提示');
    BattleSession.commands.flee();

    start(game, false);
    expectFreshBattle(BattleSession.getSnapshot(), 'normal');
    BattleSession.commands.flee();
  });
});
