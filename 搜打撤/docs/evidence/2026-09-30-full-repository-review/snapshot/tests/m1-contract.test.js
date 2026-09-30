// M1 契约扩展验收（2026-09-27 代理E）：新 op / 新字段 / 混合目标契约的能力门与实战结算。
// 规格：docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md；实现：card-rules.schema.js、card-rules.capability.js、
// battle.resolution.js 注册点 + effect-steps.m1.js 执行件。
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { hand, consumed, grave, discard, granted, foes, set$mode, set$hand, set$grave, set$discard, set$consumed, pstat, set$pstat } from '../game/src/battle/runtime/battle.runtime.js';
import { resolveCleanseOperation, resolveDrawUntilHandN, resolveDrawHandOps } from '../game/src/battle/effects/effect-steps.m1.js';

window.SDT = window.SDT || {};
window.SDT.Icons = window.SDT.Icons || { img: () => '' };
window.SDT.Icons.TYPE_ART = window.SDT.Icons.TYPE_ART || {};
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { battleEnergy: 99, battleHandMax: 99, bossDeckSize: 15, starterSha: 0, battleStartDraw: 5, battleTurnDraw: 1, diceSides: 6 },
  items: { rations: { name: '口粮' }, wood: { name: '木材' } },
};
await import('../game/src/cards/cards.js');
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const Cards = window.SDT.Cards;

beforeAll(() => {
  Cards.ensureSha();
  Cards.ensureStarters();
  Cards.ensureTabletop();
  Cards.ensureDmgTypes();
  Cards.ensureEffectFields();
});

let uidSequence = 0;
let activeGame = null;
function makeGame(cards) {
  const logs = [];
  const game = {
    ownedCards: cards.map(card => ({ uid: `m1-${uidSequence++}`, card, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false,
    lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs,
    heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  return game;
}

const foe = (id, hp = 1000, atk = 1) => ({ id, name: `M1靶子-${id}`, hp, atk });
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
async function waitForIdle(timeoutMs = 5000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    const state = BattleSession.getSnapshot();
    if (!state.busy && state.actionQueueLength === 0) {
      await tick();
      const fresh = BattleSession.getSnapshot();
      if (!fresh.busy && fresh.actionQueueLength === 0) return fresh;
    }
    await tick();
  }
  throw new Error('M1 BattleSession 动作未在时限内收敛');
}

async function startGame(cards, foes, { isBoss = false } = {}) {
  const game = makeGame(cards);
  activeGame = game;
  BattleSession.start(game, foes, { isBoss, name: 'M1 契约扩展验收' });
  await waitForIdle();
  return game;
}

async function playCard(game, card, target) {
  const entry = game.ownedCards.find(item => item.card.id === card.id);
  expect(entry, `应在真实战斗中找到手牌 ${card.id}`).toBeTruthy();
  expect(validateCardRules(card), `synthetic card ${card.id} must pass schema`).toMatchObject({ ok: true, errors: [] });
  BattleSession.commands.playCard(entry.uid, target);
  return waitForIdle();
}

const finishBattle = async () => {
  if (activeGame?.battleActive) {
    BattleSession.commands.flee();
    await waitForIdle();
  }
  activeGame = null;
  set$pstat({ ...pstat, status: {} });
  set$mode('normal');
  set$hand([]);
  set$grave([]);
  set$discard([]);
};

afterEach(async () => {
  await finishBattle();
});

// —— M1 执行件单元级桩（BOSS 分支：编组交互进不了测试骨架，直接以 boss 运行态驱动）——
function m1DepsStub({ drawCards = () => 0, grantSha = () => {}, countDrawnSpells = () => 0 } = {}) {
  const logs = [];
  return { logs,
    deps: {
      drawCards, grantSha, countDrawnSpells,
      findCard: uid => ({ card: { name: `牌-${uid}` } }),
      log: message => logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')),
      esc: value => String(value),
      combat: { purify: () => [], CURSE_META: {} },
      getPlayerStatus: () => ({ status: {} }),
    } };
}

describe('M1 extension units in boss mode', () => {
  afterEach(() => {
    set$mode('normal');
    set$hand([]);
    set$grave([]);
    set$discard([]);
    set$consumed([]);
  });

  it('draw.untilHandN stops on an empty deck (boss drawCards loop)', () => {
    set$mode('boss');
    let deck = 2;
    const { logs, deps } = m1DepsStub({
      drawCards: () => {
        if (!deck) return 0;
        deck--;
        hand.push(`deck-${deck}`);
        return 1;
      },
    });
    set$hand(['a', 'b', 'c']);
    const spells = resolveDrawUntilHandN({ name: '法力补给' }, { untilHandN: 6 }, deps);
    expect(hand.length).toBe(5);   // 3 张在手 + 牌库只剩 2 张，抽干截停
    expect(spells).toBe(0);
    expect(logs.some(line => line.includes('抽了 2 张牌') && line.includes('直到手牌有 6 张'))).toBe(true);
  });

  it('draw.untilHandN stops once the hand reaches N (boss drawCards loop)', () => {
    set$mode('boss');
    const { deps } = m1DepsStub({
      drawCards: () => {
        hand.push(`deck-${hand.length}`);
        return 1;
      },
    });
    set$hand(['a', 'b']);
    resolveDrawUntilHandN({ name: '法力补给' }, { untilHandN: 5 }, deps);
    expect(hand.length).toBe(5);   // 到量即停，不溢出
  });

  it('draw.handOps consumeHand sends the hand to consumed and grave in boss mode', () => {
    set$mode('boss');
    const { logs, deps } = m1DepsStub();
    set$hand(['u1', 'u2']);
    [...resolveDrawHandOps({ name: '金蝉脱壳' }, [{ op: 'consumeHand' }], deps)];
    expect(hand.length).toBe(0);
    expect([...consumed]).toEqual(['u1', 'u2']);
    expect([...grave]).toEqual(['u1', 'u2']);
    expect(logs.some(line => line.includes('消耗了所有手牌（2 张）'))).toBe(true);
  });

  it('draw.handOps dumpHand sends the hand to the discard pile in boss mode', () => {
    set$mode('boss');
    const { logs, deps } = m1DepsStub();
    set$hand(['u1', 'u2']);
    [...resolveDrawHandOps({ name: '弃牌' }, [{ op: 'dumpHand' }], deps)];
    expect(hand.length).toBe(0);
    expect([...discard]).toEqual(['u1', 'u2']);
    expect(consumed.length).toBe(0);
    expect(logs.some(line => line.includes('弃置了所有手牌（2 张') && line.includes('进弃牌堆'))).toBe(true);
  });

  it('cleanse unit delegates to combat.purify with aligned logging', () => {
    const cleared = [];
    const { logs, deps } = { logs: [], deps: {
      findCard: uid => ({ card: { name: `牌-${uid}` } }),
      log: message => logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')),
      esc: value => String(value),
      combat: { purify: () => cleared, CURSE_META: { bleed: { name: '流血' } } },
      getPlayerStatus: () => ({ status: {} }),
    } };
    cleared.push('bleed');
    expect(resolveCleanseOperation({ name: '净化' }, { target: 'self' }, deps)).toBe(true);
    expect(logs.some(line => line.includes('净化清除了身上的 流血'))).toBe(true);
    cleared.length = 0;
    expect(resolveCleanseOperation({ name: '净化' }, { target: 'self' }, deps)).toBe(true);
    expect(logs.some(line => line.includes('身上没有诅咒'))).toBe(true);
    expect(resolveCleanseOperation({ name: '净化' }, { target: 'chosenEnemy' }, deps)).toBe(false);
  });
});

// —— 结构化卡构造器（rules 数据对象风格与 cards.sync.js A3 回填定义一致）——
const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const SELF = { target: { side: 'self', area: false } };
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const filler = (id = 'm1-filler') => ({ id, name: '陪衬牌', cost: 0, type: '法术', desc: '' });

describe('M1 schema and capability contract', () => {
  const assertSchema = card => expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
  const assertSupported = card => expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });

  it('accepts cleanse on self and rejects other targets / duplicates', () => {
    const card = { id: 'm1-cleanse', name: '净化', cost: 0, type: '法术', desc: '净化自身', ...R(SELF, [{ op: 'cleanse', target: 'self' }]) };
    assertSchema(card);
    assertSupported(card);
    const enemyTarget = { ...card, id: 'm1-cleanse-foe' };
    enemyTarget.rules.triggers.onPlay = [{ op: 'cleanse', target: 'chosenEnemy' }];
    expect(validateCardRules(enemyTarget).errors.some(e => e.path.includes('target'))).toBe(true);
    expect(inspectCardRuleCapability(enemyTarget).ok).toBe(false);
    const duplicate = { ...card, id: 'm1-cleanse-dup' };
    duplicate.rules.triggers.onPlay = [{ op: 'cleanse', target: 'self' }, { op: 'cleanse', target: 'self' }];
    expect(validateCardRules(duplicate).errors.some(e => /duplicate/.test(e.message))).toBe(true);
  });

  it('accepts literal heal selfDamage mixed with enemy damage (mixed-side contract)', () => {
    // 恶魔之力式：主体效果指向敌人（battle.target side enemy），自伤字面量免 side 强制
    const card = { id: 'm1-losehp', name: '恶魔之力', cost: 0, type: '法术', dmg: 4, dmgType: 'fixed', desc: '4′，损失 2 点生命。',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'heal', selfDamage: 2 }]) };
    assertSchema(card);
    assertSupported(card);
    // field-anchored 效果 op 不参与混合放行（绿化箭式仍拒绝）
    const fieldAnchored = { ...card, id: 'm1-field-mix' };
    fieldAnchored.rules.triggers.onPlay = [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'heal', amountField: 'heal' }];
    expect(validateCardRules(fieldAnchored).ok).toBe(false);
  });

  it('accepts curse mixed with literal armor (spore-wall contract)', () => {
    const card = { id: 'm1-mixed-curse-armor', name: '孢子城墙', cost: 0, type: '法术', desc: '附加 2 层中毒，获得 6 点护甲',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' }, { op: 'armor', amount: 6 }]) };
    assertSchema(card);
    assertSupported(card);
  });

  it('accepts damage hits.range and damage range as random-count sources', () => {
    const hits = { id: 'm1-hits-range', name: '随机段数', cost: 0, type: '法术', dmg: 2, dmgType: 'fixed', desc: '释放 3 次',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hits: { range: [3, 3] } }]) };
    assertSchema(hits);
    assertSupported(hits);
    const dmgRange = { id: 'm1-dmg-range', name: '区间伤害', cost: 0, type: '法术', dmg: 4, dmgType: 'fixed', desc: '造成4点法伤',
      ...R(ENEMY_ONE, [{ op: 'damage', range: [4, 4], target: 'chosenEnemy' }]) };
    assertSchema(dmgRange);
    assertSupported(dmgRange);
  });

  it('accepts draw range / untilHandN / supported handOps and rejects the rest', () => {
    const range = { id: 'm1-draw-range', name: '摸索', cost: 0, type: '法术', desc: '抽2-3张牌',
      ...R(SELF, [{ op: 'draw', range: [2, 3] }]) };
    assertSchema(range);
    assertSupported(range);
    const badRange = { ...range, id: 'm1-draw-range-bad' };
    badRange.rules.triggers.onPlay = [{ op: 'draw', range: [3, 2] }];
    expect(validateCardRules(badRange).errors.some(e => e.path.endsWith('range'))).toBe(true);
    const dualSource = { ...range, id: 'm1-draw-dual' };
    dualSource.rules.triggers.onPlay = [{ op: 'draw', amount: 1, untilHandN: 4 }];
    expect(validateCardRules(dualSource).ok).toBe(false);

    const consume = { id: 'm1-goldencicada', name: '金蝉脱壳', cost: 0, type: '法术', desc: '消耗所有手牌，抽 3 张',
      ...R(SELF, [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }]) };
    assertSchema(consume);
    assertSupported(consume);
    const dump = { ...consume, id: 'm1-dump-hand' };
    dump.rules.triggers.onPlay = [{ op: 'draw', amount: 1, handOps: [{ op: 'dumpHand' }] }];
    assertSchema(dump);
    assertSupported(dump);
    const pendingHandOp = { ...consume, id: 'm1-handop-pending' };
    pendingHandOp.rules.triggers.onPlay = [{ op: 'draw', amount: 1, handOps: [{ op: 'copyRandom' }] }];
    assertSchema(pendingHandOp);   // 键位先行：schema 放行 consumeHand/dumpHand/copyRandom 等
    const pendingResult = inspectCardRuleCapability(pendingHandOp);
    expect(pendingResult.ok).toBe(false);
    expect(pendingResult.issues.some(issue => issue.path.includes('handOps[0].op'))).toBe(true);
  });

  it('gates acquire filter by the consumed key set (cost/costMax now, type stays rejected)', () => {
    const base = { id: 'm1-filter', name: '取牌', cost: 0, type: '法术', desc: '获得',
      ...R(SELF, [{ op: 'acquire', n: 1, pool: { kind: '招式' }, dest: 'hand', filter: { cost: 0 } }]) };
    assertSchema(base);
    assertSupported(base);
    const costMax = { ...base, id: 'm1-filter-costmax' };
    costMax.rules.triggers.onPlay[0].filter = { costMax: 1 };
    assertSchema(costMax);
    assertSupported(costMax);
    const typeFilter = { ...base, id: 'm1-filter-type' };
    typeFilter.rules.triggers.onPlay[0].filter = { type: '法术' };
    assertSchema(typeFilter);   // 键位先行放行
    const typeResult = inspectCardRuleCapability(typeFilter);
    expect(typeResult.ok).toBe(false);   // 能力门收口：type 过滤 Wave1 未消费
    expect(typeResult.issues.some(issue => issue.path.endsWith("filter.type"))).toBe(true);
  });

  it('keeps healban and abreak curses schema-complete', () => {
    const healban = { id: 'm1-healban', name: '禁疗', cost: 0, type: '法术', desc: '附加禁疗',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' }]) };
    assertSchema(healban);
    assertSupported(healban);
    const abreak = { ...healban, id: 'm1-abreak' };
    abreak.rules.triggers.onPlay = [{ op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' }];
    assertSchema(abreak);
    assertSupported(abreak);
  });
});

describe('M1 new semantics in real BattleSession', () => {
  it('cleanse clears every curse on the player', async () => {
    const card = { id: 'm1-cleanse-live', name: '治愈', cost: 0, type: '法术', desc: '回复 5 点生命，净化自身',
      ...R(SELF, [{ op: 'heal', amount: 5 }, { op: 'cleanse', target: 'self' }]) };
    const game = await startGame([card, filler()], [foe('cleanse')]);
    set$pstat({ ...pstat, status: { ...pstat.status, bleed: 3, healban: 2 } });
    game.hp = 80;
    await playCard(game, card, 'self');
    const status = BattleSession.getSnapshot().pstat.status;
    expect(status.bleed || 0).toBe(0);
    expect(status.healban || 0).toBe(0);
    // op 按声明序结算：heal 在先、被 healban 拦下（顺带验证禁疗诅咒口径）；净化随后清光诅咒
    expect(game.hp).toBe(80);
    expect(game.logs.some(line => line.includes('禁疗中'))).toBe(true);
    expect(game.logs.some(line => line.includes('净化清除了身上的'))).toBe(true);
  });

  it('resolves demon-power style mixed side: enemy damage plus literal selfDamage', async () => {
    const card = { id: 'm1-losehp-live', name: '恶魔之力', cost: 0, type: '法术', dmg: 4, dmgType: 'fixed', desc: '4′，损失 2 点生命。',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'heal', selfDamage: 2 }]) };
    const game = await startGame([card, filler()], [foe('demon')]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].hp).toBe(996);
    expect(game.hp).toBe(98);
  });

  it('U16 终局守卫：致死段全灭后，余下 selfDamage 不落账（战后 hp 不掉，旧语义为 98）', async () => {
    const card = { id: 'm1-losehp-kill', name: '恶魔之力·斩杀', cost: 0, type: '法术', dmg: 5, dmgType: 'fixed', desc: '5′，损失 2 点生命。',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'heal', selfDamage: 2 }]) };
    const game = await startGame([card, filler()], [foe('demon-kill', 4)]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].dead).toBe(true);   // 唯一敌人倒在伤害段 → 本卡即胜利（finish(true) 照常）
    expect(game.hp).toBe(100);               // 旧语义：余下 selfDamage 胜利结算前照常落账，战后 hp=98
  });

  it('rolls damage hits.range as a random segment count', async () => {
    const card = { id: 'm1-hits-live', name: '元素爆发', cost: 0, type: '法术', dmg: 2, dmgType: 'fixed', desc: '随机段数',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hits: { range: [3, 3] } }]) };
    const game = await startGame([card, filler()], [foe('hits')]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].hp).toBe(994);   // 2 × 3 段（区间 [3,3] 每次施放掷一次，等值区间锁定确定性）
  });

  it('draws a random count from draw.range', async () => {
    const card = { id: 'm1-draw-range-live', name: '摸索', cost: 0, type: '法术', desc: '抽2-3张牌',
      ...R(SELF, [{ op: 'draw', range: [2, 2] }]) };
    const game = await startGame([card, filler()], [foe('range')]);
    const before = hand.length;
    await playCard(game, card, 'self');
    expect(hand.length).toBe(before - 1 + 2);   // 本牌离手后净增 2
    // 普通战抽牌口径：改为获得初始攻击（与既有 draw 分支同款日志）
    expect(game.logs.some(line => line.includes('获得 2 张【初始攻击】'))).toBe(true);
  });

  it('draws until the hand reaches N cards in normal battles (grantSha fallback)', async () => {
    const card = { id: 'm1-until-live', name: '法力补给', cost: 0, type: '法术', desc: '抽牌，直到有 6 张手牌',
      ...R(SELF, [{ op: 'draw', untilHandN: 6 }]) };
    const game = await startGame([card, filler()], [foe('until')]);
    await playCard(game, card, 'self');
    expect(hand.length).toBe(6);
    expect(game.logs.some(line => line.includes('获得 5 张【初始攻击】') && line.includes('补齐到 6 张手牌'))).toBe(true);
  });

  it('consumes the whole hand before the draw resolves (golden-cicada order)', async () => {
    const card = { id: 'm1-cicada-live', name: '金蝉脱壳', cost: 0, type: '法术', desc: '消耗所有手牌，抽 3 张',
      ...R(SELF, [{ op: 'draw', amount: 3, handOps: [{ op: 'consumeHand' }] }]) };
    const fillerA = { ...filler('m1-cicada-a'), name: '陪衬甲' };
    const fillerB = { ...filler('m1-cicada-b'), name: '陪衬乙' };
    const game = await startGame([card, fillerA, fillerB], [foe('cicada')]);
    await playCard(game, card, 'self');
    const fillerUids = game.ownedCards
      .filter(item => ['m1-cicada-a', 'm1-cicada-b'].includes(item.card.id))
      .map(item => item.uid);
    expect(fillerUids.length).toBe(2);
    for (const uid of fillerUids) expect(consumed).toContain(uid);
    expect(hand.length).toBe(3);   // 手牌清空后获得 3 张【初始攻击】
    expect(game.logs.some(line => line.includes('消耗了所有手牌（2 张）'))).toBe(true);
  });

  it('applies curse and self armor in one mixed-side card (spore wall)', async () => {
    const card = { id: 'm1-spore-live', name: '孢子城墙', cost: 0, type: '法术', desc: '附加 2 层中毒，自己获得 6 点护甲',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' }, { op: 'armor', amount: 6 }]) };
    const game = await startGame([card, filler()], [foe('spore')]);
    await playCard(game, card, 0);
    expect(foes[0].status.poison).toBe(2);
    expect(BattleSession.getSnapshot().pdef.armor).toBe(6);
  });

  it('applies healban and abreak timed curses to the chosen enemy', async () => {
    const healban = { id: 'm1-healban-live', name: '深渊诅咒', cost: 0, type: '法术', desc: '附加禁疗',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'healban', duration: 1, target: 'chosenEnemy' }]) };
    const game = await startGame([healban, filler()], [foe('healban')]);
    await playCard(game, healban, 0);
    expect(foes[0].status.healban).toBe(1);
    await finishBattle();

    const abreak = { id: 'm1-abreak-live', name: '穿刺', cost: 0, type: '法术', desc: '附加破甲',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'abreak', duration: 2, target: 'chosenEnemy' }]) };
    const game2 = await startGame([abreak, filler()], [foe('abreak')]);
    await playCard(game2, abreak, 0);
    expect(foes[0].status.abreak).toBe(2);
  });

  it('filters acquired cards by literal cost (acquire.filter basic wave)', async () => {
    const card = { id: 'm1-filter-live', name: '零费猎手', cost: 0, type: '法术', desc: '获得 6 张 0 费招式',
      ...R(SELF, [{ op: 'acquire', n: 6, pool: { kind: '招式' }, dest: 'hand', filter: { cost: 0 } }]) };
    const game = await startGame([card, filler()], [foe('filter')]);
    const before = hand.length;
    await playCard(game, card, 'self');
    expect(hand.length).toBe(before - 1 + 6);
    // 新入手的临时卡（granted，uid 前缀 bts）必须全部满足 filter：0 费武术/法术
    const gained = granted.filter(entry => hand.includes(entry.uid)).map(entry => entry.card);
    expect(gained.length).toBe(6);
    for (const gainedCard of gained) {
      expect(gainedCard.cost).toBe(0);
      expect(['武术', '法术']).toContain(gainedCard.type);
    }
    expect(game.logs.some(line => line.includes('零费猎手') && line.includes('获得'))).toBe(true);
  });
});
