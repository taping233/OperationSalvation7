import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createBattleResolution } from '../game/src/battle/core/battle.resolution.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { Random } from '../game/src/core/random.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import * as Combat from '../game/src/battle/core/combat.js';

window.SDT = window.SDT || {};
window.SDT.Icons = { ...window.SDT.Icons, img: () => '', TYPE_ART: {} };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 9, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;
let activeGame;

beforeAll(() => {
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  Cards.ensureDmgTypes(); Cards.ensureEffectFields();
});

const cardWith = (operation, extra = {}) => ({
  id: 'structured-draw-source', name: '规则抽牌', type: '法术', cost: 2, desc: '抽 99 张牌。', ...extra,
  rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [operation] } },
});

function drawResolver(mode, status = { poison: 2, bleed: 1 }) {
  const target = { hp: 100, maxHp: 100, dead: false, status };
  const draw = vi.fn(({ n }) => n);
  const grant = vi.fn();
  const text = vi.fn(() => ({ did: true }));
  const random = vi.fn(() => 0.5);
  const coins = vi.fn();
  const resolve = createBattleResolution({ runtime,
    readState: () => ({ mode, grave: [] }), getPlayerStatus: () => ({ status: {} }),
    esc: String, log() {}, getAliveFoes: () => [target], getGrowth: () => 0,
    getDamageTypes: () => ['武术', '法术'], getDamageTypeMeta: () => ({}), fixedDamageType: 'fixed',
    splitClauses: () => ({ immediate: ['抽 99 张牌'], turnStart: [], battle: [], onInfused: [], onDraw: [], skill: [] }),
    applyTextEffects: text, drawOf: card => card.draw || 0, randomBattle: random,
    deckDraw: draw, grantSha: grant, addCoins: coins, combat: Combat,
    getAllCards: () => [], randomDiscoverCard: () => { random(); return { id: 'obtained', type: '法术' }; },
    addTempCard: () => 'obtained',
  });
  return { resolve, target, draw, grant, text, random, coins };
}

describe('structured draw source authority', () => {
  const cases = [
    ['literal', { amount: 3 }, {}, 3],
    ['card field', { amountField: 'draw' }, { draw: 3 }, 3],
    ['range', { range: [2, 4] }, {}, 3],
    ['zero range', { range: [0, 0] }, {}, 0],
    ['curse kinds', { perCurseKinds: true }, {}, 2],
    ['zero curse kinds', { perCurseKinds: true }, {}, 0, {}],
  ];
  for (const mode of ['boss', 'normal']) {
    it.each(cases)(`${mode}: filtered draw uses its %s source once without replaying text`, (_label, source, extra, amount, status) => {
      const harness = drawResolver(mode, status);
      const card = cardWith({ op: 'draw', ...source, filter: { type: '装备' } }, extra);
      expect(validateCardRules(card).ok).toBe(true);
      harness.resolve(card, harness.target, false, 0, null);
      expect(harness.draw.mock.calls).toEqual([[{ n: amount, type: '装备' }]]);
      expect(harness.grant).not.toHaveBeenCalled();
      expect(harness.text).not.toHaveBeenCalled();
      expect(harness.random).toHaveBeenCalledTimes(source.range ? 1 : 0);
    });
  }
});

const unsupportedDraw = { op: 'draw', untilHandN: 6, filter: { type: '装备' } };
const triggerPoints = ['onPlay', 'onTurnStart', 'onTurnEnd', 'onBattleStart', 'onConsume', 'onDraw', 'onKill',
  'onDamaged', 'onPlayCard', 'onAcquire', 'onFreezeDealt'];

describe('unimplemented filtered hand-size draws reject before effects', () => {
  it('has no existing production card that depends on the rejected combination', () => {
    const conflicts = [];
    const visit = (value, id, path = 'rules') => {
      if (!value || typeof value !== 'object') return;
      if (value.op === 'draw' && value.untilHandN !== undefined && value.filter !== undefined) conflicts.push({ id, path });
      Object.entries(value).forEach(([key, child]) => visit(child, id, `${path}.${key}`));
    };
    Cards.all().forEach(card => visit(card.rules, card.id));
    expect(conflicts).toEqual([]);
  });

  it.each(triggerPoints)('preflights %s through the same capability check', point => {
    const card = cardWith(unsupportedDraw);
    card.rules.triggers = { [point]: [{ ...unsupportedDraw }] };
    const before = JSON.stringify(card);
    expect(validateCardRules(card).ok).toBe(true);
    expect(inspectCardRuleCapability(card)).toMatchObject({
      kind: 'unsupported', ok: false,
      issues: [expect.objectContaining({ path: `rules.triggers.${point}[0].filter` })],
    });
    expect(JSON.stringify(card)).toBe(before);
  });

  it.each(['onEquip', 'battleStart', 'skill'])('preflights equipment %s before its runner consumes operations', point => {
    const card = { id: 'unsupported-equip-draw', type: '装备', rules: { version: 1,
      equip: { [point]: point === 'skill' ? { oncePerBattle: true, ops: [unsupportedDraw] } : [unsupportedDraw] } } };
    expect(validateCardRules(card).ok).toBe(true);
    expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'unsupported', ok: false,
      issues: [expect.objectContaining({ path: `rules.equip.${point}${point === 'skill' ? '.ops' : ''}[0].filter` })] });
  });

  it('rejects the whole resolver list before coins or an earlier random draw', () => {
    const harness = drawResolver('boss');
    const card = cardWith(unsupportedDraw);
    card.rules.triggers.onPlay = [{ op: 'coins', n: 7 },
      { op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'hand' }, unsupportedDraw];
    expect(validateCardRules(card).ok).toBe(true);
    expect(() => harness.resolve(card, harness.target, false, 0, null)).toThrow(/filter/);
    expect(harness.coins).not.toHaveBeenCalled();
    expect(harness.random).not.toHaveBeenCalled();
    expect(harness.draw).not.toHaveBeenCalled();
    expect(harness.grant).not.toHaveBeenCalled();
  });
});

const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle() {
  for (let n = 0; n < 500; n++) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await tick();
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return;
    }
    await tick();
  }
  throw new Error('Structured draw battle did not become idle');
}

afterEach(async () => {
  if (activeGame?.battleActive) { BattleSession.commands.flee(); await waitForIdle(); }
  activeGame = null;
});

it('real play command rejects before hand payment, energy, state changes or random consumption', async () => {
  const card = cardWith({ ...unsupportedDraw, handOps: [{ op: 'consumeHand' }] });
  card.rules.triggers.onPlay.unshift({ op: 'coins', n: 7 });
  card.rules.battle.requirements = [{ kind: 'handCards', count: 1, type: '法术' }];
  activeGame = {
    ownedCards: [card, { id: 'draw-payment', name: '支付牌', type: '法术', cost: 0, desc: '' }]
      .map((value, index) => ({ uid: `structured-draw-${index}`, card: value, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '侠客', characterId: null,
    state: 'idle', battleActive: false, logs: [],
    log(message) { this.logs.push(message); }, heal() {}, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(activeGame, [{ id: 'draw-foe', name: '靶子', hp: 1000, atk: 1 }], { isBoss: false });
  await waitForIdle();
  const resources = () => ({ hand: [...runtime.hand], consumed: [...runtime.consumed], played: [...runtime.played],
    energy: runtime.energy, coins: activeGame.coins, hp: activeGame.hp, random: Random.snapshot() });
  const before = resources();
  expect(BattleSession.commands.playCard('structured-draw-0')).toBe(false);
  await waitForIdle();
  expect(resources()).toEqual(before);
  expect(runtime.handSelecting).toBe(null);
  expect(activeGame.logs.some(message => /规则尚未支持/.test(message))).toBe(true);
});
