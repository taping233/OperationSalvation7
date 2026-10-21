import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import * as Combat from '../game/src/battle/core/combat.js';
import { createBattleResolution } from '../game/src/battle/core/battle.resolution.js';
import { createBattleEquipment } from '../game/src/battle/bag/battle.equipment.js';
import { createCardRuleExecution } from '../game/src/battle/effects/battle.rule-guard.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { splitEffectClauses } from '../game/src/battle/effects/battle.effect-clauses.js';

window.SDT = window.SDT || {};
window.SDT.Sound = { sfx() {} };
window.SDT.MAP = { rules: { battleHandMax: 99 } };
window.SDT.Cards = { DMG_TYPES: ['法术', '武术'], sellPrice: card => card.cost || 0 };
const { createBattleExecPlay } = await import('../game/src/battle/core/battle.exec-play.js');

const card = (ops, battle = { target: { side: 'self', area: false } }, extra = {}) => ({
  id: 'authority', name: '规则卡', type: '法术', cost: 0, desc: '', ...extra,
  rules: { version: 1, battle, triggers: { onPlay: ops } },
});
const enemy = { target: { side: 'enemy', area: false } };
const equip = (fields, extra = {}) => ({ id: 'authority-equip', name: '规则装备', type: '装备', cost: 0,
  desc: '', ...extra, rules: { version: 1, equip: fields } });

beforeEach(() => {
  runtime.set$G({ hp: 100, maxHp: 100, battleActive: true, ownedCards: [], log: vi.fn() });
  runtime.resetBattlePlayerState(9); runtime.clearBattlePiles(); runtime.clearBattlePopups();
  runtime.resetPilesCarryover(); runtime.resetCastOverrides(); runtime.set$hand([]);
  runtime.set$equipped([]); runtime.set$nestSyn({}); runtime.set$sel(new Set()); runtime.set$mode('normal');
  runtime.set$foes([{ id: 'target', name: '靶子', hp: 100, maxHp: 100, atk: 8, dead: false, status: {} }]);
  runtime.resetBattleEffectFlags(); runtime.set$nextSpellTwice(0); runtime.set$consumeFireballN(0);
  runtime.set$allSpellsInfused(false); runtime.set$poisonOnSpell(false); runtime.set$killAtkUp(0);
  runtime.set$infuseFuels(0); runtime.set$playedMovesThisTurn(0); runtime.set$playedMartialThisTurn(0);
});

function resolverHarness(extra = {}) {
  const events = [];
  const target = runtime.foes[0];
  let price = 1;
  const text = vi.fn(() => ({ did: true }));
  const turnStart = vi.fn();
  const ports = {
    readState: () => ({ mode: runtime.mode, grave: [], playedMovesThisTurn: 0 }),
    getPlayerStatus: () => runtime.pstat, esc: String, log: (...args) => events.push(['log', ...args]),
    getAliveFoes: () => runtime.foes.filter(foe => !foe.dead), getGrowth: () => 0,
    getDamageTypes: () => ['法术', '武术'], getDamageTypeMeta: () => ({ fixed: {}, attack: {} }), fixedDamageType: 'fixed',
    splitClauses: splitEffectClauses, applyTextEffects: text, registerTurnStart: turnStart, registerBattle: vi.fn(),
    randomBattle: () => 0, getPriceOfLastDrawn: () => price, getTurn: () => runtime.turn,
    drawCards: n => { events.push(['draw', n]); price = 7; return n; },
    grantSha: n => { events.push(['draw', n]); price = 7; }, countDrawnSpells: () => 1,
    hitFoe: (foe, _card, amount) => { events.push(['hit', amount]); foe.hp -= amount; foe.dead = foe.hp <= 0; return amount; },
    addCoins: n => events.push(['coins', n]), addArmor: n => events.push(['armor', n]),
    heal: n => events.push(['heal', n]), addFloat() {}, addDelayed() {}, drawOf: value => value.draw || 0,
    getAllCards: () => [], randomDiscoverCard: () => ({ id: 'new', name: '随机牌', type: '法术' }),
    addTempCard: () => 'new', getMyClass: () => null, queueDiscover: job => events.push(['discover', job]),
    addEnergy: n => events.push(['energy', n]), addEnergyCap: n => events.push(['energyCap', n]),
    addPlayerMaxHp: n => events.push(['maxHp', n]), combat: Combat,
    setConsumeFireball: vi.fn(), setAllSpellsInfused: vi.fn(), registerGrowthCard: vi.fn(),
    setPoisonLegacy: vi.fn(), setPlayerCurseImmune: vi.fn(), setStealthStrike: vi.fn(),
    setNextSpellTwice: runtime.set$nextSpellTwice,
    ...extra,
  };
  return { resolve: createBattleResolution({ runtime: runtime, ...ports }), target, ports, events, text, turnStart };
}

describe('declared effect order and status ownership', () => {
  it('draws before price damage instead of reusing the previous draw price', () => {
    const h = resolverHarness();
    h.resolve(card([{ op: 'draw', amount: 1 }, { op: 'damage', perTargetPrice: true, target: 'chosenEnemy' }], enemy,
      { dmgType: 'fixed' }), h.target);
    expect(h.events.filter(event => ['draw', 'hit'].includes(event[0]))).toEqual([['draw', 1], ['hit', 7]]);
    expect(h.text).not.toHaveBeenCalled();
  });

  it('applies a curse before a damage condition that reads it', () => {
    const h = resolverHarness();
    h.resolve(card([{ op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy' },
      { op: 'damage', amount: 3, target: 'chosenEnemy', cond: { foeStatus: 'poison' } }], enemy,
    { dmgType: 'fixed' }), h.target);
    expect(h.target.status.poison).toBe(1);
    expect(h.events).toContainEqual(['hit', 3]);
  });

  it('preserves the terminal guard when a declared damage kills the final foe', () => {
    const h = resolverHarness(); h.target.hp = 2;
    h.resolve(card([{ op: 'damage', amount: 2, target: 'chosenEnemy' }, { op: 'coins', n: 7 }], enemy,
      { dmgType: 'fixed' }), h.target);
    expect(h.events).toContainEqual(['hit', 2]);
    expect(h.events).not.toContainEqual(['coins', 7]);
  });

  it('skips non-damage effects under silence while retaining attack damage', () => {
    runtime.pstat.status.silence = 1;
    const h = resolverHarness();
    h.resolve(card([{ op: 'coins', n: 7 }, { op: 'damage', amount: 2, target: 'chosenEnemy' }], enemy,
      { dmgType: 'attack' }), h.target);
    expect(h.events).toContainEqual(['hit', 2]);
    expect(h.events).not.toContainEqual(['coins', 7]);
  });

  it('routes self curses through the common player immunity command', () => {
    runtime.pstat.status.poison = 2;
    const addPlayerCurse = vi.fn(() => 0);
    const h = resolverHarness({ addPlayerCurse });
    h.resolve(card([{ op: 'curse', curse: 'poison', stacks: 3, target: 'self' }]));
    expect(addPlayerCurse).toHaveBeenCalledWith('poison', 3);
    expect(runtime.pstat.status.poison).toBe(2);
  });

  it('does not reapply attack loss when an already-cursed enemy rejects the new curse', () => {
    const h = resolverHarness(); h.target.status.atkDown = 2; h.target.noCurseKeys = ['atkDown'];
    h.resolve(card([{ op: 'curse', curse: 'atkDown', amount: 3, duration: 2, target: 'chosenEnemy' }], enemy), h.target);
    expect(h.target.atk).toBe(8);
  });

  it('extends an existing freeze without broadcasting a new freeze application', () => {
    const h = resolverHarness(); h.target.status.freeze = 2;
    const previous = Combat.COMBAT_HOOKS.onFreeze;
    const onFreeze = vi.fn(); Combat.COMBAT_HOOKS.onFreeze = onFreeze;
    try {
      h.resolve(card([{ op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'chosenEnemy' }], enemy), h.target);
      expect(h.target.status.freeze).toBe(3); expect(onFreeze).not.toHaveBeenCalled();
    } finally { Combat.COMBAT_HOOKS.onFreeze = previous; }
  });

  it.each([true, false])('extends a self curse only when the independent immunity gate allows it: %s', allowed => {
    runtime.pstat.status.freeze = 2;
    const h = resolverHarness({ canApplyPlayerCurse: () => allowed });
    h.resolve(card([{ op: 'curse', curse: 'freeze', duration: 1, extend: 1, target: 'self' }]));
    expect(runtime.pstat.status.freeze).toBe(allowed ? 3 : 2);
  });

  it.each(['consumeFireball', 'allSpellsInfused', 'growth', 'poisonLegacy', 'playerCurseImmune', 'stealthStrike'])(
    'connects registerRule %s to its existing domain command', rule => {
      const h = resolverHarness();
      h.resolve(card([{ op: 'registerRule', rule }]));
      const command = { consumeFireball: 'setConsumeFireball', allSpellsInfused: 'setAllSpellsInfused',
        growth: 'registerGrowthCard', poisonLegacy: 'setPoisonLegacy', playerCurseImmune: 'setPlayerCurseImmune',
        stealthStrike: 'setStealthStrike' }[rule];
      expect(h.ports[command]).toHaveBeenCalledTimes(1);
    });

  it('keeps an unmigrated turn-start clause when only onPlay is structured', () => {
    const h = resolverHarness();
    h.resolve(card([{ op: 'coins', n: 1 }], undefined, { desc: '获得99枚金币。每回合开始时：获得2点护甲。' }));
    expect(h.events).toContainEqual(['coins', 1]); expect(h.turnStart).toHaveBeenCalledTimes(1);
    expect(h.text).not.toHaveBeenCalled();
  });

  it('honours an explicit empty turn-start declaration retained by the execution view', () => {
    const h = resolverHarness();
    const value = card([{ op: 'coins', n: 1 }], undefined, { desc: '每回合开始时：获得99点护甲。' });
    value._registeredTriggers = { ...value.rules.triggers, onTurnStart: [] };
    h.resolve(value);
    expect(h.turnStart).not.toHaveBeenCalled();
  });

  it('does not register an old turn-start clause beside its structured scheduled damage', () => {
    const addDelayed = vi.fn(); const h = resolverHarness({ addDelayed });
    h.resolve(card([{ op: 'damage', amount: 2, target: 'chosenEnemy', hits: { count: 4 }, schedule: 'nextTurn' }], enemy,
      { type: '武术', dmgType: 'fixed', desc: '下回合开始时：连开4枪，每枪造成2点固定伤害。' }), h.target);
    expect(addDelayed).toHaveBeenCalledTimes(1); expect(h.turnStart).not.toHaveBeenCalled();
    expect(h.events.some(event => event[0] === 'hit')).toBe(false);
  });

  it('keeps an unmigrated heal beside an already-structured scheduled damage clause', () => {
    const addDelayed = vi.fn(); const h = resolverHarness({ addDelayed });
    h.resolve(card([{ op: 'damage', amount: 2, target: 'chosenEnemy', hits: { count: 4 }, schedule: 'nextTurn' }], enemy,
      { type: '武术', dmgType: 'fixed', desc: '下回合开始时：连开4枪，每枪造成2点固定伤害。下回合开始时：回复3点生命。' }), h.target);
    expect(addDelayed).toHaveBeenCalledTimes(1);
    expect(h.turnStart.mock.calls[0][1]).toEqual([{ text: '回复3点生命', each: false }]);
  });

  it('keeps an unmigrated draw beside an already-structured armor decay clause', () => {
    const addDelayed = vi.fn(); const h = resolverHarness({ addDelayed });
    h.resolve(card([{ op: 'armor', amount: 8, decayAtTurnEnd: 4 }], undefined,
      { desc: '你获得8点护甲。下回合开始时：你失去4点护甲。下回合开始时：抽1张牌。' }));
    expect(addDelayed).toHaveBeenCalledTimes(1);
    expect(h.turnStart.mock.calls[0][1]).toEqual([{ text: '抽1张牌', each: false }]);
  });
});

describe('shared isolated operation views and preflight', () => {
  it('materializes equipment fields and removes fields owned by other effects without mutating the source', () => {
    const value = equip({ skill: { ops: [{ op: 'draw', amountField: 'draw' }] } }, { armor: 8, heal: 6, draw: 2 });
    const before = JSON.stringify(value);
    const view = createCardRuleExecution(value, value.rules.equip.skill.ops);
    expect(view.rules.triggers.onPlay).toEqual([{ op: 'draw', amount: 2 }]);
    expect(view).not.toHaveProperty('armor'); expect(view).not.toHaveProperty('heal');
    expect(view.rules).not.toHaveProperty('equip');
    expect(JSON.stringify(value)).toBe(before);
  });

  it.each([
    [{ op: 'status', status: 'freeze', target: 'allEnemies', duration: 1 }, { side: null, area: true }],
    [{ op: 'discover', count: 1, pool: { kind: 'moves', cost: 2 }, costDecayPerTurn: 1 }, { side: null, area: false }],
  ])('derives a truthful target for %j', (operation, target) => {
    const value = equip({ skill: { ops: [operation] } });
    expect(inspectCardRuleCapability(value).ok).toBe(true);
    expect(createCardRuleExecution(value, [operation]).rules.battle.target).toEqual(target);
  });

  it('rejects batches the common resolver cannot execute before registration or skill consumption', () => {
    const value = equip({ skill: { ops: [{ op: 'status', status: 'freeze', target: 'allEnemies', duration: 1 },
      { op: 'coins', n: 7 }] } });
    expect(validateCardRules(value).ok).toBe(true);
    expect(inspectCardRuleCapability(value)).toMatchObject({ ok: false, kind: 'unsupported' });
    const h = equipmentHarness();
    expect(() => h.equipment.registerEquip('bad', value)).toThrow();
    expect(runtime.equipped).toEqual([]); expect(h.queue).not.toHaveBeenCalled();
  });

  it.each(['bad', -1, 0.5])('rejects malformed focus=%j instead of silently ignoring it', focus => {
    expect(validateCardRules(equip({ passive: { aura: { focus } } })).ok).toBe(false);
  });

  it('rejects undefined conditional aura combinations before they are equipped', () => {
    for (const passive of [{ cond: { hasCurse: true }, aura: { deckCap: 3 } },
      { cond: { vsFreeze: 2 }, aura: { focus: 1 } }]) {
      expect(inspectCardRuleCapability(equip({ passive })).ok).toBe(false);
    }
  });

  it('rejects self attack loss until the real player attack and restoration domains support it', () => {
    const value = card([{ op: 'curse', curse: 'atkDown', amount: 2, duration: 1, target: 'self' }]);
    expect(validateCardRules(value).ok).toBe(true);
    expect(inspectCardRuleCapability(value)).toMatchObject({ ok: false, kind: 'unsupported' });
  });

  it('rejects competing whole-card and damage-only last-hand replays before payment', () => {
    const value = card([{ op: 'damage', amount: 2, target: 'chosenEnemy', recast: { on: 'lastHand', times: 1 } }],
      enemy, { dmgType: 'fixed' });
    value.rules.triggers.replay = { on: 'lastHand', times: 1 };
    expect(inspectCardRuleCapability(value)).toMatchObject({ ok: false, kind: 'invalid' });
  });
});

function equipmentHarness() {
  const h = resolverHarness();
  const queue = vi.fn();
  const equipment = createBattleEquipment({ requestBattleRender() {}, clearTargetSession() {}, queueBattleAction: queue,
    throwIfActionCancelled() {}, runStagedSteps: async steps => { Array.from(steps); },
    resolveCardSteps: h.resolve.steps, applyTextEffects: h.text, sweepDead() {}, alive: () => runtime.foes.filter(f => !f.dead),
    finish() {}, processChoice() {}, processDiscoverQueue() {}, processHandSelect() {},
    triggersM2: { resolveEquipOps: (source, operations) => h.resolve(createCardRuleExecution(source, operations)) },
  });
  return { ...h, equipment, queue };
}

describe('equipment domain ownership including empty and false declarations', () => {
  it('does not replay an old active skill when its explicit operations are empty', () => {
    const h = equipmentHarness();
    const value = equip({ skill: { ops: [] } }, { desc: '主动技能：获得99枚金币。' });
    runtime.equipped.push({ uid: 'equip', card: value, used: false });
    expect(h.equipment.equipSkillText(value)).toBe(''); h.equipment.useEquipSkill('equip');
    expect(h.queue).not.toHaveBeenCalled(); expect(h.text).not.toHaveBeenCalled();
    expect(runtime.equipped[0].used).toBe(false);
  });

  it('does not borrow a conditional text aura when the declared static aura is zero', () => {
    runtime.pstat.status.poison = 1;
    const h = equipmentHarness();
    h.equipment.registerEquip('equip', equip({ passive: { aura: { atk: 0, spellPower: 0 } } },
      { desc: '诅咒状态下，攻+99，法伤+99。' }));
    expect(runtime.pstat.status.atkUp || 0).toBe(0); expect(runtime.pstat.status.spellUp || 0).toBe(0);
  });

  it('distinguishes an explicit empty battle-start batch from an unmigrated field', () => {
    const h = equipmentHarness();
    expect(h.equipment.isBattleStartEquip(equip({ battleStart: [] }, { desc: '对战开始时：获得99点护甲。' }))).toBe(false);
    expect(h.equipment.isBattleStartEquip(equip({ skill: { ops: [] } }, { desc: '对战开始时：获得3点护甲。' }))).toBe(true);
  });

  it('runs a repeatable structured skill despite an already-used marker and never replays its old text', async () => {
    const h = equipmentHarness();
    const value = equip({ skill: { oncePerBattle: false, ops: [{ op: 'coins', n: 2 }] } },
      { desc: '主动技能：获得99枚金币。' });
    runtime.equipped.push({ uid: 'equip', card: value, used: true });
    expect(inspectCardRuleCapability(value).ok).toBe(true);
    h.equipment.useEquipSkill('equip'); await h.queue.mock.calls[0][0]();
    h.equipment.useEquipSkill('equip'); await h.queue.mock.calls[1][0]();
    expect(h.events.filter(event => event[0] === 'coins')).toEqual([['coins', 2], ['coins', 2]]);
    expect(h.text).not.toHaveBeenCalled();
  });

  it('initial equipment removes all selected cards before onEquip draws and registers events once', () => {
    const a = equip({ battleStart: [{ op: 'coins', n: 1 }], onEquip: [{ op: 'draw', amount: 1 }],
      passive: { aura: { atk: 2 } } });
    const b = equip({ battleStart: [{ op: 'coins', n: 1 }] }, { id: 'authority-equip-b' });
    runtime.set$mode('boss'); runtime.G.ownedCards = [{ uid: 'a', card: a }, { uid: 'b', card: b }];
    runtime.set$sel(new Set(['a', 'b'])); runtime.set$drawPile(['a', 'b']);
    const registered = vi.fn(); const resolveOps = vi.fn(() => expect(runtime.drawPile).toEqual([]));
    const h = createBattleEquipment({ alive: () => runtime.foes,
      triggersM2: { registerCard: registered, resolveEquipOps: resolveOps } });
    h.applyBattleStartPassives();
    expect(registered.mock.calls.map(call => [call[1], call[2]])).toEqual([
      ['a', { battleStarted: false }], ['b', { battleStarted: false }],
    ]);
    expect(runtime.pstat.status.atkUp).toBe(2); expect(resolveOps).toHaveBeenCalledTimes(3);
  });
});

function execHarness(value, extra = {}) {
  const entries = [{ uid: 'source', card: value }, ...(extra.entries || [])];
  runtime.G.ownedCards = entries; runtime.set$hand(entries.map(entry => entry.uid));
  const resolve = extra.resolve || vi.fn(async () => {});
  const actions = [];
  const flow = createBattleExecPlay({ requestBattleRender() {}, findCard: uid => entries.find(entry => entry.uid === uid),
    effCostOf: c => c.cost || 0, fireConsumeTriggers: vi.fn(), resolveCardWithFeedback: resolve,
    queueBattleAction: action => { actions.push(action); return true; }, takeSurge: async () => {},
    registerEquip() {}, summonAlly() {}, applyKillRewards: vi.fn(), poisonRandomFoe() {}, applyImitate() {},
    beginDartStrike: vi.fn(), sweepDead() {}, finish() {}, processChoice() {}, processDiscoverQueue() {}, ...extra.ports });
  return { flow, resolve, actions };
}

describe('play/replay/retention use one authoritative source before payment', () => {
  it('whole-card replay plus the old last-hand description resolves exactly twice', async () => {
    const value = card([{ op: 'coins', n: 1 }], undefined, { desc: '最后一张手牌，效果触发2次。' });
    value.rules.triggers.replay = { on: 'lastHand', times: 1 };
    const h = execHarness(value); h.flow.queueCardExecution('source', value, [], null, true);
    await h.actions[0](); expect(h.resolve).toHaveBeenCalledTimes(2);
  });

  it('keeps old last-hand text working when only another trigger has migrated', async () => {
    const value = { id: 'legacy-replay', name: '旧重放', type: '法术', cost: 0, desc: '最后一张手牌，效果触发2次。',
      rules: { version: 1, triggers: { onDraw: [] } } };
    const h = execHarness(value); h.flow.queueCardExecution('source', value, [], null, true);
    await h.actions[0](); expect(h.resolve).toHaveBeenCalledTimes(2);
  });

  it('does not repeat a structured onPlay just because its display text mentions last hand', async () => {
    const value = card([], undefined, { desc: '最后一张手牌，效果触发99次。' });
    const h = execHarness(value); h.flow.queueCardExecution('source', value, [], null, true);
    await h.actions[0](); expect(h.resolve).toHaveBeenCalledTimes(1);
  });

  it('lets explicit keepInHand=false override an obsolete retention description', async () => {
    const value = card([], { keepInHand: false }, { desc: '永远被保留在手牌中。' });
    const h = execHarness(value); h.flow.queueCardExecution('source', value, [], null, true);
    await h.actions[0](); expect(runtime.hand).not.toContain('source'); expect(runtime.played).toContain('source');
    expect(validateCardRules({ ...value, rules: { version: 1, battle: { keepInHand: 'false' } } }).ok).toBe(false);
  });

  it('leaves a newly registered next-spell repeat for the next spell', async () => {
    const value = card([{ op: 'registerRule', rule: 'doubleNextSpell' }]);
    const resolve = vi.fn(async () => runtime.set$nextSpellTwice(1));
    const h = execHarness(value, { resolve }); h.flow.queueCardExecution('source', value, [], null, true);
    await h.actions[0](); expect(resolve).toHaveBeenCalledTimes(1); expect(runtime.nextSpellTwice).toBe(1);
  });

  it('rejects an invalid requested target before consuming valid hand payment', async () => {
    const value = { id: 'tt13-mind-control', name: '精神控制', type: '法术', cost: 0, desc: '',
      rules: { version: 1, battle: { requirements: [{ kind: 'handCards', count: 1, type: '法术' }] } } };
    const payment = { uid: 'payment', card: { id: 'payment', type: '法术' } };
    const h = execHarness(value, { entries: [payment] });
    h.flow.queueCardExecution('source', value, [], runtime.foes[0], false, true, ['payment']);
    const before = { hand: [...runtime.hand], energy: runtime.energy };
    await h.actions[0]();
    expect(runtime.hand).toEqual(before.hand); expect(runtime.energy).toBe(before.energy);
    expect(runtime.consumed).toEqual([]); expect(h.resolve).not.toHaveBeenCalled();
  });
});
