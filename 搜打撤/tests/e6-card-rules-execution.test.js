import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import * as runtime from '../game/src/battle/battle.runtime.js';
import { assertCardRulesExecutable, rejectUnsupportedCard } from '../game/src/battle/battle.rule-guard.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { ...window.SDT.Icons, img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/battle.core.js');
const engine = await import('../game/src/battle/battle.engine.js');
const { createBattleExecPlay } = await import('../game/src/battle/battle.exec-play.js');
const Cards = window.SDT.Cards;
let activeGame;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle() {
  for (let n = 0; n < 500; n++) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await tick();
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
    await tick();
  }
  throw new Error('E6 BattleSession did not become idle');
}

async function startGame(card) {
  const logs = [];
  activeGame = {
    ownedCards: [card, { id: 'payment', name: '支付牌', type: '法术', cost: 0, desc: '' },
      { id: 'fuel', name: '燃料牌', type: '法术', cost: 0, desc: '' }]
      .map((value, index) => ({ uid: `e6-${index}`, card: value, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    log(message, level) { logs.push({ message, level }); }, logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(activeGame, [{ id: 'e6-foe', name: 'E6靶子', hp: 1000, atk: 1 }], { isBoss: false });
  await waitForIdle();
  return activeGame;
}

afterEach(async () => {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
});

const acquire = extra => ({ op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'hand', ...extra });
const cardWith = operations => ({
  id: 'e6-source', name: 'E6规则牌', type: '法术', cost: 2, desc: '任意展示文字。',
  rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: operations } },
});
const paymentRule = { kind: 'handCards', count: 1, type: '法术' };
function assertSchema(card) { expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] }); }
function resources(game) {
  return {
    hand: [...runtime.hand], consumed: [...runtime.consumed], played: [...runtime.played],
    grave: [...runtime.grave], energy: runtime.energy, coins: game.coins,
    fuels: runtime.infuseFuels, hp: runtime.foes.map(foe => foe.hp),
  };
}

describe('E6 complete-list and pre-payment executable rule boundaries', () => {
  it('rejects malformed external input and makes rule issues safe for the visible HTML log', () => {
    const warn = vi.fn();
    for (const input of [null, 1, 'card', []]) {
      expect(rejectUnsupportedCard(input, { warn })).toBe(true);
      expect(() => assertCardRulesExecutable(input)).toThrow(TypeError);
    }
    const card = cardWith([acquire({ act: 'play' })]);
    card.id = '<img src=x onerror="bad()">';
    expect(rejectUnsupportedCard(card, { warn })).toBe(true);
    expect(warn.mock.lastCall[0]).toContain('&lt;img');
    expect(warn.mock.lastCall[0]).not.toContain('<img');
    expect(rejectUnsupportedCard({ id: 'legacy' }, { warn })).toBe(false);
    expect(warn).toHaveBeenCalledTimes(5);
  });

  it.each(['resolver', 'steps'])('rejects a later acquire combination before earlier coins through %s', async entry => {
    const card = cardWith([{ op: 'coins', n: 7 }, acquire({ act: 'play' })]);
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    const run = () => entry === 'steps'
      ? [...engine.resolveCard.steps(card, null, false, 0, 'e6-0')]
      : engine.resolveCard(card, null, false, 0, 'e6-0');
    expect(run).toThrow(TypeError);
    expect(resources(game)).toEqual(before);
  });

  it('rejects an unconsumed acquire filter before coins or obtained cards', async () => {
    const card = cardWith([{ op: 'coins', n: 7 }, acquire({ filter: { type: '法术' } })]);
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    expect(() => engine.resolveCard(card, null, false, 0, 'e6-0')).toThrow(TypeError);
    expect(resources(game)).toEqual(before);
  });

  it('rejects before opening mandatory hand payment selection', async () => {
    const card = cardWith([acquire({ act: 'play' })]);
    card.rules.battle.requirements = [paymentRule];
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    expect(engine.queueCardExecution('e6-0', card, ['e6-2'], null, false)).toBe(false);
    expect(runtime.handSelecting).toBe(null);
    expect(resources(game)).toEqual(before);
    expect(game.logs.some(line => line.level === 'warn' && /无法打出|拒绝/.test(line.message))).toBe(true);
  });

  it('returns false from the real command for unsupported execution without cost', async () => {
    const card = cardWith([acquire({ act: 'play' })]);
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    expect(BattleSession.commands.playCard('e6-0')).toBe(false);
    await waitForIdle();
    expect(resources(game)).toEqual(before);
    expect(game.logs.some(line => line.level === 'warn' && /无法打出|拒绝/.test(line.message))).toBe(true);
  });

  it.each([
    ['playCard', 'requirements'],
    ['playCard', 'costModifiers'],
    ['beginInfusion', 'costModifiers'],
  ])('rejects invalid %s %s before public preplay consumers throw', async (command, field) => {
    const card = {
      id: 'e6-invalid-preplay', name: '非法入口测试卡', type: '法术', cost: 2, infuse: 1, desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } } },
    };
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    // Model an externally mutated live card after battle startup; exercise the
    // public command before it reaches queueCardExecution's existing guard.
    card.rules.battle[field] = [null];
    expect(validateCardRules(card).ok).toBe(false);
    expect(BattleSession.commands[command]('e6-0')).toBe(false);
    expect(resources(game)).toEqual(before);
    expect(runtime.infusing).toBe(null);
    expect(runtime.handSelecting).toBe(null);
    expect(game.logs.some(line => line.level === 'warn' && /规则格式非法/.test(line.message))).toBe(true);
  });

  it.each(['unsupported', 'invalid'])('rechecks %s queued mutation before payment, energy and infusion fuel', async kind => {
    const card = cardWith([{ op: 'coins', n: 7 }]);
    card.rules.battle.requirements = [paymentRule];
    assertSchema(card);
    const game = await startGame(card);
    const before = resources(game);
    let queued;
    const consume = vi.fn();
    const onResolved = vi.fn();
    // Use the production exec flow with a held scheduling port to mutate only
    // after queue acceptance; resolver and runtime remain the real battle ones.
    const flow = createBattleExecPlay({
      queueBattleAction: action => { queued = action; }, requestBattleRender() {},
      findCard: engine.findCard, matchHandSelectKey: engine.matchHandSelectKey,
      effCostOf: engine.effCostOf, fireConsumeTriggers: consume, resolveInfusedFuel: consume,
      resolveCardWithFeedback: async (...args) => engine.resolveCard(...args),
    });
    flow.queueCardExecution('e6-0', card, ['e6-2'], null, false, true, ['e6-1'], onResolved);
    expect(queued).toBeTypeOf('function');
    if (kind === 'unsupported') card.rules.triggers.onPlay.push(acquire({ act: 'play' }));
    else card.rules.triggers.onPlay = 'invalid';
    const failure = await queued(new AbortController().signal).catch(error => error);
    expect.soft(resources(game)).toEqual(before);
    expect(failure).toBeUndefined();
    expect(consume).not.toHaveBeenCalled();
    expect(onResolved).not.toHaveBeenCalled();
    expect(runtime.activeActionSignal).toBe(null);
    expect(game.logs.some(line => line.level === 'warn' && /无法打出|拒绝/.test(line.message))).toBe(true);
  });

  it('preserves supported operation order and resolves only once after name and description rewrites', async () => {
    const card = cardWith([{ op: 'coins', n: 3 }, { op: 'coins', n: 5 }]);
    card.name = '改名'; card.desc = '获得 99 枚金币。';
    assertSchema(card);
    const game = await startGame(card);
    const beforeEnergy = runtime.energy;
    BattleSession.commands.playCard('e6-0');
    await waitForIdle();
    expect(game.coins).toBe(8);
    expect(runtime.energy).toBe(beforeEnergy - 2);
    expect(game.logs.filter(line => /获得 [35] (枚|币|金)/.test(line.message)).map(line => line.message.match(/获得 ([35])/)[1])).toEqual(['3', '5']);
  });

  it('keeps a no-rules text card executable', async () => {
    const card = { id: 'e6-legacy', name: '旧文本卡', type: '法术', cost: 1, desc: '获得 4 枚金币。' };
    const game = await startGame(card);
    const beforeEnergy = runtime.energy;
    BattleSession.commands.playCard('e6-0');
    await waitForIdle();
    expect(runtime.energy).toBe(beforeEnergy - 1);
    expect(runtime.played).toContain('e6-0');
  });
});
