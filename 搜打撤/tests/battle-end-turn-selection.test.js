import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

window.SDT = {
  Icons: { img: () => '', TYPE_ART: {} },
  Sound: { music() {}, sfx() {}, setDucked() {}, setBoss() {} },
  MAP: {
    rules: { battleEnergy: 2, battleHandMax: 30, bossDeckSize: 15, starterSha: 0,
      battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
    items: { rations: { name: '口粮' }, wood: { name: '木材' } },
  },
};
await import('../game/src/cards/cards.js');
const { BattleSession, configureBattleRenderer } = await import('../game/src/battle/core/battle.core.js');
const { applyRuneFlag } = await import('../game/src/battle/runtime/battle.runtime.effects.js');
const { enqueueFeedback } = await import('../game/src/battle/view/battle.feedback.js');
const { Random } = await import('../game/src/core/random.js');
const Cards = window.SDT.Cards;
let activeGame;
let releaseFeedback;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});
beforeEach(() => {
  vi.useFakeTimers();
  Random.reseed('end-turn-selection-regression');
  releaseFeedback = null;
  configureBattleRenderer(snapshot => activeGame?.observations.push(snapshot));
});
afterEach(async () => {
  releaseFeedback?.();
  if (activeGame?.battleActive) BattleSession.commands.flee();
  await vi.runOnlyPendingTimersAsync();
  configureBattleRenderer(null);
  activeGame = null;
  vi.restoreAllMocks();
  window.SDT.MAP.rules.battleEnergy = 2;
  vi.useRealTimers();
});

function catalog(id) {
  const card = Cards.all().find(entry => entry.id === id);
  if (!card) throw new Error(`回合结束选择测试缺少现行卡牌 ${id}`);
  return card;
}
const frostfall = () => catalog('tt3-frostfall');
const starter = () => catalog('starter-attack');
const foe = hp => ({ id: 'selection-foe', name: '回合续接靶子', hp: hp ?? 1000, atk: 3, behavior: 'strike' });
function start(cards, { hp, swift = true, energy = 2 } = {}) {
  window.SDT.MAP.rules.battleEnergy = energy;
  const game = {
    ownedCards: cards.map((card, index) => ({ uid: `card-${index}`, card, safe: false })),
    inventory: [], usedPocket: [], cardOrder: cards.map((_, index) => `card-${index}`),
    hp: 50, maxHp: 50, atk: 5, spellPower: 0, coins: 0,
    myClass: '法师', characterId: null, state: 'idle', battleActive: false,
    logs: [], observations: [], lastBattleEnd: null,
    log(message) {
      const state = BattleSession.getSnapshot();
      this.logs.push({ text: String(message), state });
      this.observations.push(state);
    },
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    onBattleEnd(_options, played, win) { this.lastBattleEnd = { played, win }; },
  };
  activeGame = game;
  BattleSession.start(game, [foe(hp)], { isBoss: false, name: '回合结束选择生命周期回归' });
  if (swift) applyRuneFlag('swift');
  return game;
}
async function settle() {
  // 测试运行时演出等待归零；敌方步进和合帧渲染仍由虚拟时钟实际执行。
  await vi.advanceTimersByTimeAsync(1000);
  const state = BattleSession.getSnapshot();
  activeGame?.observations.push(state);
  return state;
}
const enemyAttacks = game => game.logs.filter(entry => entry.text.includes('攻击：你受到'));
function expectWaiting(game, field) {
  const state = BattleSession.getSnapshot();
  expect(state[field]).toBeTruthy();
  expect(state.turn).toBe(1);
  expect(state.phase).not.toBe('enemy');
  expect(game.hp).toBe(50);
  expect(enemyAttacks(game)).toHaveLength(0);
  expect(game.observations.some(snapshot => snapshot.phase === 'enemy')).toBe(false);
  return state;
}
function expectOneEnemyTurn(game, state, hp = 47) {
  expect(state).toMatchObject({ turn: 2, phase: 'player', busy: false, actionQueueLength: 0 });
  expect(state.handSelecting).toBeNull();
  expect(state.choosing).toBeNull();
  expect(state.discovering).toBeNull();
  expect(state.dartPending).toBeFalsy();
  expect(game.hp).toBe(hp);
  expect(enemyAttacks(game)).toHaveLength(1);
  const phases = game.observations.map(snapshot => snapshot.phase)
    .filter((phase, index, all) => phase !== all[index - 1]);
  expect(phases.filter(phase => phase === 'enemy')).toHaveLength(1);
}
async function endIntoHandSelection(game) {
  BattleSession.commands.endTurn();
  await settle();
  return expectWaiting(game, 'handSelecting');
}

describe('极速符文现行剑荡妖邪：选择完成后续接一次敌方阶段', () => {
  it('真实目录卡打开手选，免费选牌先完整执行，再攻击并进入可操作的第 2 回合', async () => {
    const productionCard = frostfall();
    expect(productionCard.name).toBe('剑荡妖邪');
    const game = start([productionCard, starter()]);
    const waiting = await endIntoHandSelection(game);
    expect(waiting.handSelecting).toMatchObject({ act: 'play', type: '武术', n: 1 });
    expect(waiting.energy).toBe(0);
    expect(waiting.foes[0].hp).toBe(990);

    BattleSession.commands.pickHandSelect('card-1');
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(state.hand).toEqual([]);
    expect(state.foes[0].hp).toBe(985);
    expect(enemyAttacks(game)[0].state).toMatchObject({ energy: 0, turn: 1 });
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(985);
    // 再跨一个调度窗口确认一次性续接没有留下第二次敌方执行。
    expectOneEnemyTurn(game, await settle());
  });

  it('嵌套两张现行剑荡妖邪，第二次手选仍阻止敌方推进', async () => {
    const game = start([frostfall(), frostfall(), starter()]);
    await endIntoHandSelection(game);
    BattleSession.commands.pickHandSelect('card-1');
    await settle();
    const nested = expectWaiting(game, 'handSelecting');
    expect(nested.energy).toBe(0);
    expect(nested.foes[0].hp).toBe(980);

    BattleSession.commands.pickHandSelect('card-2');
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(975);
  });

  it('选择命令清掉弹层后，子牌仍等待反馈时也不会提前开始敌方阶段', async () => {
    const game = start([frostfall(), starter()]);
    await endIntoHandSelection(game);
    const gate = new Promise(resolve => { releaseFeedback = resolve; });
    void enqueueFeedback(() => gate);
    await vi.advanceTimersByTimeAsync(0);

    BattleSession.commands.pickHandSelect('card-1');
    const running = await settle();
    expect(running.handSelecting).toBeNull();
    expect(running).toMatchObject({ phase: 'resolving', turn: 1, busy: true });
    expect(game.hp).toBe(50);
    expect(enemyAttacks(game)).toHaveLength(0);
    expect(game.observations.some(snapshot => snapshot.phase === 'enemy')).toBe(false);

    releaseFeedback();
    expectOneEnemyTurn(game, await settle());
  });

  it('等待选牌时重复结束回合、重复选牌不会跳过或重复续接', async () => {
    const game = start([frostfall(), starter()]);
    BattleSession.commands.endTurn();
    BattleSession.commands.endTurn();
    await settle();
    expectWaiting(game, 'handSelecting');
    BattleSession.commands.endTurn();
    BattleSession.commands.endTurn();
    await settle();
    expectWaiting(game, 'handSelecting');

    BattleSession.commands.pickHandSelect('card-1');
    BattleSession.commands.pickHandSelect('card-1');
    BattleSession.commands.endTurn();
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(state.foes[0].hp).toBe(985);
  });

  it('跳过可选手选仍继续该次回合结束流程', async () => {
    const game = start([frostfall(), starter()]);
    await endIntoHandSelection(game);
    BattleSession.commands.skipHandSelect();
    BattleSession.commands.skipHandSelect();
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(state.hand).toEqual(['card-1']);
    expect(state.foes[0].hp).toBe(990);
  });

  it('选中子牌击杀最后敌人时直接胜利，旧续接不能发动敌方攻击', async () => {
    const game = start([frostfall(), starter()], { hp: 14 });
    await endIntoHandSelection(game);
    BattleSession.commands.pickHandSelect('card-1');
    const state = await settle();
    expect(game.battleActive).toBe(false);
    expect(game.lastBattleEnd).toMatchObject({ win: true, played: ['card-0', 'card-1'] });
    expect(state).toMatchObject({ phase: 'victory', turn: 1, busy: false, actionQueueLength: 0 });
    expect(game.hp).toBe(50);
    expect(enemyAttacks(game)).toHaveLength(0);
    expect(game.observations.some(snapshot => snapshot.phase === 'enemy')).toBe(false);
  });

  it('选牌期间逃跑中止旧续接，迟到的选牌与跳过命令保持无效', async () => {
    const game = start([frostfall(), starter()]);
    await endIntoHandSelection(game);
    BattleSession.commands.flee();
    BattleSession.commands.pickHandSelect('card-1');
    BattleSession.commands.skipHandSelect();
    const state = await settle();
    expect(game.battleActive).toBe(false);
    expect(state).toMatchObject({ turn: 1, busy: false, actionQueueLength: 0 });
    expect(game.hp).toBe(50);
    expect(enemyAttacks(game)).toHaveLength(0);
  });

  it('已选择的子牌仍在演出时换战斗，旧动作取消后不能续接或改写新局', async () => {
    const oldGame = start([frostfall(), starter()]);
    await endIntoHandSelection(oldGame);
    const gate = new Promise(resolve => { releaseFeedback = resolve; });
    void enqueueFeedback(() => gate);
    await vi.advanceTimersByTimeAsync(0);
    BattleSession.commands.pickHandSelect('card-1');
    expect(await settle()).toMatchObject({ turn: 1, phase: 'resolving', busy: true });

    const replacement = start([starter()], { swift: false });
    releaseFeedback();
    const state = await settle();
    expect(state).toMatchObject({ turn: 1, phase: 'player', busy: false, actionQueueLength: 0 });
    expect(state.hand).toEqual(['card-0']);
    expect(replacement.hp).toBe(50);
    expect(enemyAttacks(replacement)).toHaveLength(0);
    expect(enemyAttacks(oldGame)).toHaveLength(0);
  });

  it('在选牌处开始新战斗，旧续接与迟到的选择不能影响新战斗', async () => {
    const oldGame = start([frostfall(), starter()]);
    await endIntoHandSelection(oldGame);
    const replacement = start([starter()], { swift: false });
    BattleSession.commands.pickHandSelect('card-1');
    BattleSession.commands.skipHandSelect();
    const state = await settle();
    expect(state).toMatchObject({ turn: 1, phase: 'player', busy: false, actionQueueLength: 0 });
    expect(state.hand).toEqual(['card-0']);
    expect(replacement.hp).toBe(50);
    expect(enemyAttacks(replacement)).toHaveLength(0);
    expect(enemyAttacks(oldGame)).toHaveLength(0);
    BattleSession.commands.endTurn();
    expectOneEnemyTurn(replacement, await settle());
  });
});

describe('现行血毒双镖的依赖目标交互', () => {
  it('回合已结束而第二镖待选时，普通出牌、注能与背包技能不能抢占依赖目标', async () => {
    const infusable = catalog('tt3sp-silverthorn');
    expect(infusable.infuse).toBe(1);
    const game = start([catalog('tt7-bloodpoison'), starter(), infusable], { energy: 6 });
    game.myClass = '战士'; // 构造足够余费与需要敌方目标的背包攻击技能。
    BattleSession.commands.endTurn();
    await settle();
    const waiting = expectWaiting(game, 'dartPending');
    expect(waiting.energy).toBe(4);
    expect(waiting.busy).toBe(false); // 排除 busy/费用不足自然拒绝，实际覆盖待续接保护。
    const beforeTargetHp = waiting.foes[0].hp;
    const independentActions = [
      () => BattleSession.commands.playCard('card-1', 0),
      () => BattleSession.commands.beginInfusion('card-1'),
      () => BattleSession.commands.beginInfusion('card-2'), // 真实可注能卡，仍有另一张手牌可支付。
      () => BattleSession.commands.bagSlam(),
    ];
    for (const action of independentActions) {
      action();
      const unchanged = await settle();
      expectWaiting(game, 'dartPending');
      expect(unchanged.dartPending).toEqual(waiting.dartPending);
      expect(unchanged.hand).toEqual(['card-1', 'card-2']);
      expect(unchanged.energy).toBe(waiting.energy);
      expect(unchanged.foes[0].hp).toBe(beforeTargetHp);
      expect(unchanged.infusing).toBeNull();
      expect(unchanged.pendingTarget).toBeNull();
      expect(unchanged.slamPending).toBeFalsy();
    }

    BattleSession.commands.resolveDart(0);
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(state.hand).toEqual(['card-1', 'card-2']);
    expect(enemyAttacks(game)[0].state.energy).toBe(waiting.energy);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(beforeTargetHp - 7);
  });

  it('剑荡妖邪免费打出血毒双镖后等待第二镖目标，目标结算后才续接', async () => {
    const game = start([frostfall(), catalog('tt7-bloodpoison')]);
    await endIntoHandSelection(game);
    BattleSession.commands.pickHandSelect('card-1');
    await settle();
    const waiting = expectWaiting(game, 'dartPending');
    const beforeTargetHp = waiting.foes[0].hp;
    BattleSession.commands.endTurn();
    await settle();
    expectWaiting(game, 'dartPending');

    BattleSession.commands.resolveDart(0);
    BattleSession.commands.resolveDart(0);
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(beforeTargetHp - 7); // 第一镖流血使第二镖 +1
  });

  it('取消血毒双镖第二镖目标时只续接一次，并丢弃迟到的点选', async () => {
    const game = start([catalog('tt7-bloodpoison')]);
    BattleSession.commands.endTurn();
    await settle();
    const waiting = expectWaiting(game, 'dartPending');
    const beforeCancelHp = waiting.foes[0].hp;
    BattleSession.commands.cancelInteraction();
    BattleSession.commands.cancelInteraction();
    BattleSession.commands.resolveDart(0);
    const state = await settle();
    expectOneEnemyTurn(game, state);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(beforeCancelHp);
  });
});

describe('构造固定发现候选池的抉择与发现续接场景', () => {
  // 神灯使用现行生产者；另一例是明确构造的单次发现卡。固定池避免随机追加其它交互。
  it('现行神灯抉择 → 直接施放发现牌 → 嵌套手选，整条子链完成后才攻击', async () => {
    const lamp = catalog('tt3-magic-lamp');
    const selected = frostfall();
    const game = start([lamp, starter()]);
    vi.spyOn(Cards, 'all').mockReturnValue([selected]);
    BattleSession.commands.endTurn();
    await settle();
    expectWaiting(game, 'choosing');
    BattleSession.commands.pickChoice(0);
    BattleSession.commands.pickChoice(0);
    await settle();
    expectWaiting(game, 'discovering');
    BattleSession.commands.pickDiscover(0);
    BattleSession.commands.pickDiscover(0);
    await settle();
    expectWaiting(game, 'handSelecting');
    BattleSession.commands.pickHandSelect('card-1');
    const state = await settle();
    // 神灯的发现选项不附带护甲；整条子链结束后承受一次 3 点敌方攻击。
    expectOneEnemyTurn(game, state, 47);
    expect(state.pdef.armor).toBe(0);
    expect(enemyAttacks(game)[0].state.energy).toBe(1);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(985);
  });

  it('构造单次直接发现施放剑荡妖邪，等待其手选完成后续接', async () => {
    const producer = { id: 'constructed-discover-play', name: '构造直接发现', cost: 2,
      type: '法术', dmg: 0, desc: '发现 1 张牌并直接施放。' };
    const selected = frostfall();
    const game = start([producer, starter()]);
    vi.spyOn(Cards, 'all').mockReturnValue([selected]);
    BattleSession.commands.endTurn();
    await settle();
    expectWaiting(game, 'discovering');
    BattleSession.commands.pickDiscover(0);
    await settle();
    expectWaiting(game, 'handSelecting');
    BattleSession.commands.pickHandSelect('card-1');
    expectOneEnemyTurn(game, await settle());
    expect(enemyAttacks(game)[0].state.energy).toBe(0);
    expect(enemyAttacks(game)[0].state.foes[0].hp).toBe(985);
  });
});
