import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BATTLE_TRIGGER_POINTS, DIRECT_TRIGGER_POINTS, REGISTERED_TRIGGER_POINTS,
  hasStructuredTrigger } from '../game/src/cards/card-trigger-contract.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = { rules: { ...battleRules(9, 20, 1, 0, 0, 1) }, items: {} };
await import('../game/src/cards/cards.js');
const Cards = window.SDT.Cards;
Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
// Battle dependencies register the SDT facade during import, after its Icons port is ready.
const { createTriggerRunner } = await import('../game/src/battle/effects/battle.triggers.m2.js');
const { createBattleDraw } = await import('../game/src/battle/core/battle.draw.js');
const { throwIfActionCancelled } = await import('../game/src/battle/runtime/battle.staged-playback.js');
const Combat = await import('../game/src/battle/core/combat.js');
const { Random, setRandomService, SeededRandomService } = await import('../game/src/core/random.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const engine = await import('../game/src/battle/core/battle.engine.js');
const runtime = await import('../game/src/battle/runtime/battle.runtime.js');

const host = (triggers, extra = {}) => ({ id: 'lifecycle-listener', name: '时点监听', type: '法术', cost: 0,
  desc: '', rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers }, ...extra });
const energyOp = n => ({ op: 'energy', n });
function runnerHarness(resolve) {
  const state = { active: true, token: 1, signal: null, cursed: false };
  const target = { name: '目标', hp: 100 };
  const execute = vi.fn(resolve);
  const addEnergy = vi.fn();
  const runner = createTriggerRunner({ resolveCard: execute, log: vi.fn(), esc: String,
    getAliveFoes: () => [target], addEnergy, isBattleActive: () => state.active,
    getBattleToken: () => state.token, getActionSignal: () => state.signal,
    throwIfCancelled: throwIfActionCancelled, hasPlayerCurse: () => state.cursed });
  return { runner, execute, state, target, addEnergy };
}

let game;
function makeGame(cards) {
  return { ownedCards: cards.map((card, index) => ({ uid: `life-${index}`, card })), hp: 100,
    maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士', state: 'idle', battleActive: false,
    log(message) { this.onLog?.(message); }, heal(n) { this.hp = Math.min(this.maxHp, this.hp + n); },
    addItem() {}, onBattleEnd() {} };
}
function begin(cards, options = {}) {
  for (const card of cards) if (card.rules) {
    expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
    expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });
  }
  game = makeGame(cards);
  BattleSession.start(game, [{ id: 'life-foe', name: '靶子', hp: 1000, atk: 1 }], options);
  return game;
}
async function settle() { await vi.advanceTimersByTimeAsync(5000); expect(runtime.busy).toBe(false); }
async function play(index = 0) { BattleSession.commands.playCard(`life-${index}`, 'self'); await settle(); }
beforeEach(() => { vi.useFakeTimers(); runtime.set$lastDeckSel([]); runtime.set$equipped([]); });
afterEach(() => {
  if (game?.battleActive) engine.finish(null);
  game = null;
  vi.restoreAllMocks(); vi.clearAllTimers(); vi.useRealTimers();
});

describe('shared trigger contract and runner event boundaries', () => {
  it('词表无重复，获取/抽到/消耗只有直调入口，剥离视图保留显式空声明', () => {
    expect(new Set(BATTLE_TRIGGER_POINTS).size).toBe(11);
    expect(BATTLE_TRIGGER_POINTS).toEqual(['onPlay', ...REGISTERED_TRIGGER_POINTS, ...DIRECT_TRIGGER_POINTS]);
    expect(REGISTERED_TRIGGER_POINTS).not.toContain('onAcquire');
    expect(hasStructuredTrigger({ _registeredTriggers: { onTurnStart: [] }, rules: { triggers: {} } }, 'onTurnStart')).toBe(true);
    const { runner, execute } = runnerHarness();
    const card = host({ onAcquire: [energyOp(1)] });
    expect(runner.registerCard(card, 'direct-only')).toBe(false);
    runner.fireAcquire(card);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['onTurnStart', 'fireTurnStart'], ['onTurnEnd', 'fireTurnEnd'], ['onBattleStart', 'fireBattleStart'],
    ['onKill', 'fireKill'], ['onDamaged', 'fireDamaged'], ['onPlayCard', 'firePlayCard'], ['onFreezeDealt', 'fireFreezeDealt'],
  ])('%s 只在对应事件中执行，容器次数到期后清除', (point, fire) => {
    const { runner, execute } = runnerHarness();
    runner.registerCard(host({ [point]: [energyOp(1)], duration: 1 }), point);
    runner[fire](); runner[fire]();
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0][0].rules.triggers).toEqual({ onPlay: [energyOp(1)] });
  });

  it('同次效果触发另一时点时，已预留的最后一次不能被嵌套领取', () => {
    const h = runnerHarness(() => h.runner.fireKill());
    h.runner.registerCard(host({ onTurnStart: [energyOp(1)], onKill: [energyOp(2)], duration: 1 }), 'once');
    h.runner.fireTurnStart();
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('无限持续监听不会因自身再次发出相同时点而递归溢出', () => {
    const h = runnerHarness(() => h.runner.fireFreezeDealt(h.target));
    h.runner.registerCard(host({ onFreezeDealt: [energyOp(1)] }), 'recursive');
    h.runner.fireFreezeDealt(h.target);
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it.each(['finish', 'replace', 'reset'])('前一个监听%s后不执行旧登记快照', action => {
    const h = runnerHarness(() => {
      if (action === 'finish') h.state.active = false;
      else if (action === 'replace') h.state.token++;
      else h.runner.reset();
    });
    h.runner.registerCard(host({ onKill: [energyOp(1)] }), 'first');
    h.runner.registerCard(host({ onKill: [energyOp(2)] }), 'second');
    h.runner.fireKill();
    expect(h.execute).toHaveBeenCalledTimes(1);
  });

  it('取消信号从runner透传，不作为普通牌效错误吞掉', () => {
    const h = runnerHarness();
    h.runner.registerCard(host({ onDamaged: [energyOp(1)] }), 'cancel');
    const controller = new AbortController(); controller.abort(); h.state.signal = controller.signal;
    expect(() => h.runner.fireDamaged()).toThrow();
    expect(h.execute).not.toHaveBeenCalled();
  });

  it('条件focus只在玩家身负诅咒时给予能量', () => {
    const h = runnerHarness();
    runtime.set$equipped([{ card: { name: '条件专注', rules: { equip: {
      passive: { aura: { focus: 2 }, cond: { hasCurse: true } },
    } } } }]);
    h.runner.fireTurnStart(); expect(h.addEnergy).not.toHaveBeenCalled();
    h.state.cursed = true; h.runner.fireTurnStart(); expect(h.addEnergy).toHaveBeenCalledWith(2);
  });

  it('冻结回调保留实际目标，失效目标回退当前活敌；合成视图剥离旧声明', () => {
    const h = runnerHarness();
    const second = { name: '第二目标', hp: 20 };
    h.runner.registerCard(host({ onFreezeDealt: [energyOp(1)] }, { _registeredTriggers: { onFreezeDealt: [energyOp(1)] } }), 'target');
    h.runner.fireFreezeDealt(second);
    expect(h.execute.mock.calls[0][1]).toBe(second);
    expect(h.execute.mock.calls[0][0]).not.toHaveProperty('_registeredTriggers');
    second.dead = true; h.runner.fireFreezeDealt(second);
    expect(h.execute.mock.calls[1][1]).toBe(h.target);
  });
});

describe('real battle lifecycle hosts', () => {
  it.each(['self', 'enemy', 'poison'])('%s实际受伤进入同一onDamaged宿主', async source => {
    const listener = host({ onPlay: [], onDamaged: [{ op: 'armor', amount: 3 }] });
    const selfDamage = host({ onPlay: [{ op: 'heal', selfDamage: 2 }] }, { id: 'life-self-damage' });
    begin([listener, selfDamage]); await play();
    if (source === 'self') await play(1);
    else if (source === 'enemy') engine.playerTakeHit(runtime.foes[0]);
    else {
      runtime.pstat.status.poison = 2; runtime.foes[0].status.freeze = 1;
      BattleSession.commands.endTurn(); await settle();
    }
    expect(runtime.pdef.armor).toBe(3);
  });

  it.each(['enemy', 'poison'])('%s致死后不再广播治疗监听使玩家复活', async source => {
    begin([host({ onPlay: [], onDamaged: [{ op: 'heal', amount: 5 }] })]); await play();
    game.hp = 1;
    if (source === 'poison') {
      runtime.pstat.status.poison = 2; runtime.foes[0].status.freeze = 1;
    } else runtime.foes[0].atk = 2;
    BattleSession.commands.endTurn(); await settle();
    expect(game.hp).toBeLessThanOrEqual(0);
    expect(game.battleActive).toBe(false);
  });

  it('敌方冰冻玩家不会奖励onFreezeDealt，玩家冰冻实际敌人触发一次', async () => {
    begin([host({ onPlay: [], onFreezeDealt: [{ op: 'armor', amount: 3 }] })]); await play();
    Combat.addCurse(runtime.pstat, 'freeze', 1);
    expect(runtime.pdef.armor).toBe(0);
    Combat.addCurse(runtime.foes[0], 'freeze', 1);
    expect(runtime.pdef.armor).toBe(3);
  });

  it('获取保护只覆盖执行栈，不污染实体；同一实体再次获得仍触发', () => {
    begin([]);
    const card = host({ onAcquire: [energyOp(1)] }, { id: 'life-acquire' });
    const first = engine.addTempCard(card);
    const saved = runtime.granted.find(entry => entry.uid === first).card;
    expect(saved).not.toHaveProperty('_m2Acquiring');
    engine.addTempCard(saved);
    expect(runtime.energy).toBe(11);
    const fireAcquire = vi.fn();
    createBattleDraw({ fireAcquire, alive: () => runtime.foes }).addDeckCard(card);
    expect(fireAcquire).toHaveBeenCalledTimes(1);
  });

  it('文本随机获取阿猫仅执行结构化获取效果一次', () => {
    begin([]);
    const apollo = Cards.all().find(card => card.id === 'tt2-apollo');
    const filler = { id: 'life-random', name: '普通随机牌', type: '法术', cost: 0, rarity: '古朴', desc: '' };
    vi.spyOn(Cards, 'all').mockReturnValue([apollo, filler]);
    const previousRandom = Random.snapshot();
    setRandomService({ random: () => 0, reseed() {}, snapshot: () => ({}), restore() {} });
    try {
      engine.resolveCard({ id: 'life-legacy-acquire', name: '旧文本获取', type: '法术', cost: 0, desc: '置入随机卡牌直至手牌达到1张。' }, null, false, 0);
    } finally {
      const restored = new SeededRandomService(previousRandom.seed);
      restored.restore(previousRandom);
      setRandomService(restored);
    }
    expect(runtime.energy).toBe(10);
    expect(runtime.granted.filter(entry => ['tt2-apollo', 'life-random'].includes(entry.card.id))
      .map(entry => entry.card.id)).toEqual(['tt2-apollo', 'life-random']);
  });

  it('延迟回调内追加的新任务留到下个时点，既不立刻执行也不丢失', async () => {
    begin([]);
    let appended = false;
    game.onLog = message => {
      if (!appended && message.includes('回合开始时')) {
        appended = true;
        runtime.delayed.push({ cardName: '追加调度', text: '获得4点能量' });
      }
    };
    runtime.delayed.push({ cardName: '延迟原始', text: '获得1点能量' });
    await engine.processDelayed();
    expect(runtime.energy).toBe(10);
    expect(runtime.delayed).toEqual([{ cardName: '追加调度', text: '获得4点能量' }]);
    await engine.processDelayed();
    expect(runtime.energy).toBe(14); expect(runtime.delayed).toEqual([]);
  });

  it('额外回合同样兑现结束时点，开始时禁抽先于常规抽牌', async () => {
    begin([host({ onPlay: [], onTurnEnd: [{ op: 'armor', amount: 2 }], onTurnStart: [{ op: 'noDrawNext' }] }),
      { id: 'life-plain', name: '普通牌', type: '法术', cost: 0, desc: '' }]);
    await play();
    runtime.set$mode('boss'); runtime.set$hand([]); runtime.set$drawPile(['life-1']); runtime.set$extraTurn(true);
    BattleSession.commands.endTurn(); await settle();
    expect(runtime.turn).toBe(2); expect(runtime.pdef.armor).toBe(2);
    expect(runtime.hand).toEqual([]); expect(runtime.drawPile).toEqual(['life-1']);
  });

  it.each([false, true])('活随从计时状态到期，伤害破自身潜行；时光只作用于玩家：%s', async time => {
    begin([]); runtime.foes[0].atk = 0;
    const ally = { name: '随从', hp: 10, atk: 2, status: {}, defense: {} };
    Combat.addBlessing(ally, 'stealth', 2); Combat.addBlessing(ally, 'atkUp', 2, 1);
    runtime.set$allies([ally]); if (time) runtime.applyRuneFlag('time');
    BattleSession.commands.endTurn(); await settle();
    expect(ally.status.stealth).toBe(0); expect(ally.status.atkUp).toBe(0);
  });

  it.each(['ally', 'poison'])('%s消灭末敌仍先兑现该次onKill，再结束战斗', async source => {
    begin([host({ onPlay: [], onKill: [{ op: 'coins', n: 2 }] })]); await play();
    if (source === 'ally') runtime.set$allies([{ name: '终结随从', hp: 10, atk: 1000, status: {}, defense: {} }]);
    else { runtime.foes[0].hp = 1; runtime.foes[0].status.poison = 1; runtime.foes[0].status.freeze = 1; }
    BattleSession.commands.endTurn(); await settle();
    expect(game.coins).toBe(2); expect(game.battleActive).toBe(false);
  });

  it('新战斗编组开始即清空旧登记，不等到beginBoss后才清零', async () => {
    begin([host({ onPlay: [], onFreezeDealt: [{ op: 'coins', n: 1 }] })]); await play();
    game = makeGame([{ id: 'life-deck', name: '新牌', type: '法术', cost: 0, desc: '' }]);
    BattleSession.start(game, [{ id: 'new-foe', name: '新敌人', hp: 100, atk: 1 }], { isBoss: true });
    Combat.addCurse(runtime.foes[0], 'freeze', 1);
    expect(game.coins).toBe(0);
  });
});
