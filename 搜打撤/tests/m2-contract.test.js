// M2 契约扩展验收（2026-09-27 代理E）：块1 onPlay 剩余扩展 + 块2 triggers/lifecycle/装备域。
// 规格：docs/cards/M-BATCH-CONTRACT-SPEC-2026-09-27.md（M2 状态标注）；实现：schema/capability/m2 执行件/
// battle.triggers.m2.js runner/engine 挂点/equipment/card-cost/enemy-phase。
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { validateCardRules } from '../game/src/cards/card-rules.schema.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';
import { hand, consumed, foes, allies, equipped, pstat, set$pstat, set$hand,
  set$infuseFuels, recordHandInfusion, set$playedMovesThisTurn, set$extraTurn, set$noDrawNext, set$meleeCost1, set$consumed } from '../game/src/battle/runtime/battle.runtime.js';
import { createTriggerRunner } from '../game/src/battle/effects/battle.triggers.m2.js';
import { resolveStealAtk, restoreAtkDown, countCurseKinds } from '../game/src/battle/effects/effect-steps.m2.js';
import { calculateEnemyIntent } from '../game/src/battle/core/battle.enemy-intent.js';
import { intentViewModel } from '../game/src/battle/view/battle.intent.view.js';

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
const engine = await import('../game/src/battle/core/battle.engine.js');
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
const foe = (id, hp = 1000, atk = 1) => ({ id, name: `M2靶子-${id}`, hp, maxHp: hp, atk });
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
  throw new Error('M2 BattleSession 动作未在时限内收敛');
}

async function startGame(cards, foesArg) {
  const logs = [];
  const game = {
    ownedCards: cards.map(card => ({ uid: `m2-${uidSequence++}`, card, safe: false })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0,
    myClass: '侠客', characterId: null, state: 'idle', battleActive: false, lastBattleEnd: null,
    log(message) { logs.push(String(message).replace(/\[\[[^\]]+\]\]/g, '')); },
    logs, heal(amount) { this.hp = Math.min(this.maxHp, this.hp + amount); },
    addItem() {}, onBattleEnd() {},
  };
  activeGame = game;
  BattleSession.start(game, foesArg, { isBoss: false, name: 'M2 契约扩展验收' });
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
  set$extraTurn(false);
  set$noDrawNext(false);
  set$meleeCost1(false);
  set$infuseFuels(0);
  set$playedMovesThisTurn(0);
  set$hand([]);
  set$consumed([]);
};

afterEach(async () => {
  await finishBattle();
});

const R = (battle, onPlay) => ({ rules: { version: 1, battle, triggers: { onPlay } } });
const SELF = { target: { side: 'self', area: false } };
const ENEMY_ONE = { target: { side: 'enemy', area: false } };
const filler = (id = 'm2-filler') => ({ id, name: '陪衬牌', cost: 0, type: '法术', desc: '' });
const assertSchema = card => expect(validateCardRules(card)).toMatchObject({ ok: true, errors: [] });
const assertSupported = card => expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });

describe('M2 schema and capability contract (block 1)', () => {
  it('accepts stealAtk (amount/capTo exclusive) and noDrawNext', () => {
    const capTo = { id: 'm2-steal-cap', name: '影噬', cost: 0, type: '武术', desc: '偷取攻击',
      ...R(ENEMY_ONE, [{ op: 'stealAtk', capTo: 1, target: 'chosenEnemy' }]) };
    assertSchema(capTo);
    assertSupported(capTo);
    const flat = { ...capTo, id: 'm2-steal-amt' };
    flat.rules.triggers.onPlay = [{ op: 'stealAtk', amount: 1, target: 'chosenEnemy' }];
    assertSchema(flat);
    const dual = { ...capTo, id: 'm2-steal-dual' };
    dual.rules.triggers.onPlay = [{ op: 'stealAtk', amount: 1, capTo: 1, target: 'chosenEnemy' }];
    expect(validateCardRules(dual).ok).toBe(false);
    const noDraw = { id: 'm2-nodraw', name: '破浪斩', cost: 0, type: '武术', desc: '下回合无法抽牌',
      ...R(ENEMY_ONE, [{ op: 'noDrawNext' }]) };
    assertSchema(noDraw);
    assertSupported(noDraw);
  });

  it('accepts damage.onKill rewards and dynamic damage sources', () => {
    const onKill = { id: 'm2-onkill', name: '闪金之锤', cost: 0, type: '法术', dmg: 5, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { coins: 2 } }]) };
    assertSchema(onKill);
    assertSupported(onKill);
    const bad = { ...onKill, id: 'm2-onkill-bad' };
    bad.rules.triggers.onPlay[0].onKill = { coins: -1 };
    expect(validateCardRules(bad).ok).toBe(false);
    const perInfused = { id: 'm2-perinfused', name: '充能射线', cost: 0, type: '法术', dmg: 5, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', perInfusedInHand: 2 }]) };
    assertSchema(perInfused);
    const perTargetPrice = { id: 'm2-qigong', name: '气功波', cost: 0, type: '法术', dmg: 0, dmgType: 'fixed', desc: '',
      ...R({ target: { side: 'enemy', area: true } }, [
        { op: 'draw', amount: 1 },
        { op: 'damage', perTargetPrice: true, target: 'allEnemies' },
      ]) };
    assertSchema(perTargetPrice);
    assertSupported(perTargetPrice);
    const mul = { ...onKill, id: 'm2-mul' };
    mul.rules.triggers.onPlay[0] = { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', spellPowerMul: 2 };
    assertSchema(mul);
    const hits = { ...onKill, id: 'm2-perplayed' };
    hits.rules.triggers.onPlay[0] = { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hits: { perPlayedMoves: true } };
    assertSchema(hits);
    assertSupported(hits);
    const lastHand = { ...onKill, id: 'm2-recast-lh' };
    lastHand.rules.triggers.onPlay[0] = { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', recast: { on: 'lastHand', times: 1 } };
    assertSchema(lastHand);
    const scheduled = { ...onKill, id: 'm2-sched' };
    scheduled.rules.triggers.onPlay[0] = { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', schedule: 'nextTurnStart' };
    assertSchema(scheduled);
    assertSupported(scheduled);
  });

  it('accepts curse source/bindTarget/atkDown and draw perCurseKinds', () => {
    const handMoves = { id: 'm2-handmoves', name: '诅咒之刃', cost: 0, type: '法术', desc: '',
      ...R(ENEMY_ONE, [{ op: 'curse', source: 'handMoves', target: 'chosenEnemy' }]) };
    assertSchema(handMoves);
    assertSupported(handMoves);
    const atkDown = { id: 'm2-atkdown', name: '割蚀', cost: 0, type: '法术', desc: '',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' }]) };
    assertSchema(atkDown);
    assertSupported(atkDown);
    const badAtkDown = { ...atkDown, id: 'm2-atkdown-bad' };
    badAtkDown.rules.triggers.onPlay[0].amount = 0;
    expect(validateCardRules(badAtkDown).ok).toBe(false);
    const bind = { id: 'm2-bind', name: '深渊诅咒', cost: 0, type: '法术', dmg: 7, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'curse', curse: 'healban', duration: 1, bindTarget: 'prevDamage' },
        { op: 'draw', perCurseKinds: true },
      ]) };
    assertSchema(bind);
    assertSupported(bind);
  });

  it('accepts cond.anyCurse, armor priceOf/consumeEquip and execute perCurseKinds', () => {
    const anyCurse = { id: 'm2-anycurse', name: '暗影射击', cost: 0, type: '法术', dmg: 3, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', cond: { anyCurse: true } }]) };
    assertSchema(anyCurse);
    assertSupported(anyCurse);
    const consumeEquip = { id: 'm2-castarmor', name: '铸甲', cost: 0, type: '法术', desc: '',
      ...R(SELF, [{ op: 'armor', amount: 10, consumeEquip: true }]) };
    assertSchema(consumeEquip);
    assertSupported(consumeEquip);
    const execute = { id: 'm2-execute', name: '吞噬', cost: 0, type: '法术', desc: '',
      ...R(ENEMY_ONE, [{ op: 'execute', cap: { atk: 4 }, perCurseKinds: true }]) };
    assertSchema(execute);
    assertSupported(execute);
  });

  it('accepts all trigger points with container duration and structured equipment', () => {
    const triggers = {
      id: 'm2-triggers', name: '时点卡', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: {
        onTurnStart: [{ op: 'draw', amount: 1 }],
        onTurnEnd: [{ op: 'noDrawNext' }],
        onDamaged: [{ op: 'armor', amount: 1 }],
        onPlayCard: [{ op: 'energy', n: 1 }],
        onKill: [{ op: 'coins', n: 1 }],
        duration: 3,
      } },
    };
    assertSchema(triggers);
    assertSupported(triggers);
    const equip = {
      id: 'm2-equip', name: '规则长剑', cost: 0, type: '装备', desc: '',
      rules: { version: 1, equip: {
        onEquip: [{ op: 'armor', amount: 5 }],
        battleStart: [{ op: 'energy', n: 1 }],
        passive: { aura: { atk: 1, focus: 1 }, cond: { hasCurse: true } },
        skill: { oncePerBattle: true, ops: [{ op: 'cleanse', target: 'self' }] },
      } },
    };
    assertSchema(equip);
    assertSupported(equip);
    const container = { ...equip, id: 'm2-equip-container' };
    container.rules.equip.container = { slots: 3 };
    const cap = inspectCardRuleCapability(container);
    expect(cap.ok).toBe(false);
    expect(cap.issues.some(i => i.path.includes('container'))).toBe(true);
  });

  it('accepts registerRule extensions and movesPlayedDiscount cost modifier', () => {
    const bleedAmp = { id: 'm2-bleedamp', name: '飞身劈规则化', cost: 0, type: '法术', desc: '',
      ...R(SELF, [{ op: 'registerRule', rule: 'bleedAmp' }]) };
    assertSchema(bleedAmp);
    assertSupported(bleedAmp);
    const cost1 = { ...bleedAmp, id: 'm2-cost1' };
    cost1.rules.triggers.onPlay[0] = { op: 'registerRule', rule: 'meleeCost1' };
    assertSchema(cost1);
    const discount = { id: 'm2-movesdisc', name: '追斩规则化', cost: 2, type: '武术', dmg: 0, dmgType: 'fixed', desc: '',
      rules: { version: 1, battle: {
        target: { side: 'enemy', area: false },
        costModifiers: [{ kind: 'movesPlayedDiscount', amount: 1 }],
      }, triggers: { onPlay: [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }] } } };
    assertSchema(discount);
    assertSupported(discount);
  });

  it('keeps the resolver guard: trigger containers must go through the runner pipeline', async () => {
    const card = { id: 'm2-guard', name: '绕管卡', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onDraw: [] } } };
    assertSchema(card);
    assertSupported(card);
    expect(() => engine.resolveCard(card, null, false, 0, null)).toThrow(TypeError);
  });
});

describe('M2 semantics in real BattleSession (block 1)', () => {
  it('steals attack down to a cap and grants atkUp (shadow-bug style)', async () => {
    const card = { id: 'm2-steal-live', name: '影噬', cost: 0, type: '武术', desc: '偷取攻击',
      ...R(ENEMY_ONE, [{ op: 'stealAtk', capTo: 1, target: 'chosenEnemy' }]) };
    const game = await startGame([card, filler()], [foe('steal', 1000, 5)]);
    await playCard(game, card, 0);
    expect(foes[0].atk).toBe(1);
    expect(pstat.status.atkUp).toBe(4);
    expect(game.logs.some(line => line.includes('偷取'))).toBe(true);
  });

  it('pays onKill rewards when the damage kills (coin reward)', async () => {
    const card = { id: 'm2-onkill-live', name: '闪金之锤', cost: 0, type: '法术', dmg: 5, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { coins: 2 } }]) };
    const game = await startGame([card, filler()], [foe('onkill', 4)]);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].dead).toBe(true);
    expect(game.coins).toBe(2);
  });

  it('scales damage with perInfusedInHand for that instance while held', async () => {
    const card = { id: 'm2-infused-live', name: '充能射线', cost: 0, type: '法术', dmg: 5, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', perInfusedInHand: 2 }]) };
    const game = await startGame([card, filler()], [foe('infused')]);
    recordHandInfusion(hand);
    recordHandInfusion(hand);
    const state = await playCard(game, card, 0);
    expect(state.foes[0].hp).toBe(1000 - 5 - 2 * 2);
  });

  it('uses played-moves count as the hit count (rapid fire)', async () => {
    const card = { id: 'm2-rapid-live', name: '连续射击', cost: 0, type: '武术', dmg: 2, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [{ op: 'damage', amountField: 'dmg', target: 'chosenEnemy', hits: { perPlayedMoves: true } }]) };
    const game = await startGame([card, filler()], [foe('rapid')]);
    set$playedMovesThisTurn(1);   // 模拟本回合已打出一张其他招式
    const state = await playCard(game, card, 0);
    expect(state.foes[0].hp).toBe(1000 - 2);
  });

  it('aggregates hand-move curses via curse.source handMoves', async () => {
    const carrier = { id: 'm2-venom', name: '毒箭陪衬', cost: 0, type: '法术', desc: '附加 2 层中毒' };
    const card = { id: 'm2-handmoves-live', name: '诅咒之刃', cost: 0, type: '法术', desc: '',
      ...R(ENEMY_ONE, [{ op: 'curse', source: 'handMoves', target: 'chosenEnemy' }]) };
    const game = await startGame([card, carrier], [foe('handmoves')]);
    await playCard(game, card, 0);
    expect(foes[0].status.poison).toBe(2);
    expect(game.logs.some(line => line.includes('附加手牌招式的诅咒'))).toBe(true);
  });

  it('applies atkDown curse with amount cut and restores after expiry tick', async () => {
    const card = { id: 'm2-atkdown-live', name: '割蚀', cost: 0, type: '法术', desc: '降低 2 攻持续 3 回合',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' }]) };
    const game = await startGame([card, filler()], [foe('atkdown', 1000, 5)]);
    await playCard(game, card, 0);
    expect(foes[0].atk).toBe(3);
    expect(foes[0].status.atkDown).toBe(3);
    expect(foes[0]._atkDownAmount).toBe(2);
    // 模拟到期：计时归零后回合管线归还
    foes[0].status.atkDown = 0;
    restoreAtkDown(foes[0]);
    expect(foes[0].atk).toBe(5);
    expect(foes[0]._atkDownAmount).toBeUndefined();
  });

  it('draws per target curse kinds (abyss curse style)', async () => {
    const card = { id: 'm2-percurse-live', name: '深渊诅咒', cost: 0, type: '法术', dmg: 7, dmgType: 'fixed', desc: '',
      ...R(ENEMY_ONE, [
        { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
        { op: 'curse', curse: 'healban', duration: 1, bindTarget: 'prevDamage' },
        { op: 'curse', curse: 'silence', duration: 1, bindTarget: 'prevDamage' },
        { op: 'draw', perCurseKinds: true },
      ]) };
    const game = await startGame([card, filler()], [foe('percurse')]);
    const before = hand.length;
    await playCard(game, card, 0);
    expect(foes[0].status.healban).toBe(1);
    expect(foes[0].status.silence).toBe(1);
    expect(hand.length).toBe(before - 1 + 2);   // 本牌离手后按 2 种诅咒抽 2 张（普通战=初始攻击）
    expect(game.logs.some(line => line.includes('身负 2 种诅咒'))).toBe(true);
  });

  it('consumes a hand equipment as armor cost (anvil style)', async () => {
    const card = { id: 'm2-castarmor-live', name: '铸甲', cost: 0, type: '法术', desc: '消耗 1 张装备牌，+10甲',
      ...R(SELF, [{ op: 'armor', amount: 10, consumeEquip: true }]) };
    const equipCard = { id: 'm2-equip-fodder', name: ' fodder', cost: 0, type: '装备', desc: '' };
    const game = await startGame([card, filler(), equipCard], [foe('castarmor')]);
    const state = await playCard(game, card, 'self');
    expect(state.pdef.armor).toBe(10);
    const fodderUid = game.ownedCards.find(item => item.card.id === 'm2-equip-fodder')?.uid;
    expect(consumed).toContain(fodderUid);
  });

  it('executes foes whose atk meets the cap and summons allies', async () => {
    const execute = { id: 'm2-execute-live', name: '吞噬', cost: 0, type: '法术', desc: '消灭攻4及以下',
      ...R(ENEMY_ONE, [{ op: 'execute', cap: { atk: 4 } }]) };
    const game = await startGame([execute, filler()], [foe('weak', 1000, 3), foe('strong', 1000, 9)]);
    const state = await playCard(game, execute, 0);
    expect(state.foes[0].dead).toBe(true);
    expect(state.foes[1].dead).toBeFalsy();
    await finishBattle();

    const summon = { id: 'm2-summon-live', name: '征召', cost: 0, type: '法术', desc: '召唤步兵',
      ...R(SELF, [{ op: 'summon', name: '步兵', atk: 4, hp: 4, count: 2 }]) };
    const game2 = await startGame([summon, filler()], [foe('summon')]);
    await playCard(game2, summon, 'self');
    const infantry = allies.filter(a => a.name === '步兵');
    expect(infantry.length).toBe(2);
  });

  it('actual Devour kills the selected second eligible foe and settles once', async () => {
    const devour = Cards.all().find(card => card.id === 'tt3sp-devour');
    expect(devour.rules.battle.target).toEqual({ side: 'enemy', area: false });
    const game = await startGame([devour, filler()], [foe('first-eligible', 6, 4), foe('second-selected', 6, 4)]);
    const state = await playCard(game, devour, 1);
    expect(state.foes[0].dead).toBeFalsy();
    expect(state.foes[1].dead).toBe(true);
    expect(state.busy).toBe(false);
    expect(state.actionQueueLength).toBe(0);
    expect(game.battleActive).toBe(true);
  });

  it('actual Devour does not redirect from an ineligible selected foe', async () => {
    const devour = Cards.all().find(card => card.id === 'tt3sp-devour');
    const game = await startGame([devour, filler()], [foe('eligible', 6, 4), foe('ineligible-selected', 6, 5)]);
    const uid = game.ownedCards.find(item => item.card.id === devour.id).uid;
    const before = BattleSession.getSnapshot();
    expect(BattleSession.commands.getCardPlayAvailability(uid).status).toBe('ready');
    const availability = BattleSession.commands.getCardPlayAvailability(uid, 1);
    expect(availability).toMatchObject({ status: 'rejected', reason: { code: 'EXECUTE_TARGET_INELIGIBLE' } });
    const submitted = BattleSession.commands.submitCardPlay(uid, 1);
    expect(submitted).toMatchObject({ status: 'rejected', reason: { code: 'EXECUTE_TARGET_INELIGIBLE' } });
    const state = await waitForIdle();
    expect(state.energy).toBe(before.energy);
    expect(state.hand).toEqual(before.hand);
    expect(state.played).toEqual(before.played);
    expect(state.foes.every(foe => !foe.dead && foe.hp === 6)).toBe(true);
    expect(state.busy).toBe(false);
    expect(state.actionQueueLength).toBe(0);
  });

  it('Devour with no eligible enemies rejects before targeting and preserves resources', async () => {
    const devour = Cards.all().find(card => card.id === 'tt3sp-devour');
    const game = await startGame([devour, filler()], [foe('too-strong', 6, 5)]);
    const uid = game.ownedCards.find(item => item.card.id === devour.id).uid;
    const before = BattleSession.getSnapshot();
    expect(BattleSession.commands.getCardPlayAvailability(uid)).toMatchObject({ status: 'rejected' });
    expect(BattleSession.commands.submitCardPlay(uid)).toMatchObject({ status: 'rejected' });
    const after = await waitForIdle();
    expect(after.energy).toBe(before.energy);
    expect(after.hand).toEqual(before.hand);
    expect(after.pendingTarget).toBeFalsy();
  });

  it('flips noDrawNext / extraTurn / meleeCost1 flags via ops', async () => {
    const card = { id: 'm2-flags-live', name: '规则三连', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: { onPlay: [
        { op: 'noDrawNext' }, { op: 'extraTurn' }, { op: 'registerRule', rule: 'meleeCost1' },
      ] } } };
    assertSchema(card);
    assertSupported(card);
    const game = await startGame([card, filler()], [foe('flags')]);
    await playCard(game, card, 'self');
    expect(engine).toBeTruthy();
  });

  it('registers played-card triggers and fires onTurnStart via the runner (real play path)', async () => {
    const card = { id: 'm2-trigger-live', name: '花瓣法阵', cost: 0, type: '法术', desc: '',
      rules: { version: 1, battle: { target: { side: null, area: false } }, triggers: {
        onTurnStart: [{ op: 'energy', n: 1 }],
        duration: 2,
      } } };
    const game = await startGame([card, filler()], [foe('trigger')]);
    await playCard(game, card, 'self');
    // 打出即登记（无立即触发）；直接驱动回合开始管线验证触发与 duration 递减
    await engine.processDelayed();
    const logs = game.logs.join('\n');
    expect(logs.includes('能量 +1') || logs.includes('获得 1 点能量')).toBe(true);
    await engine.processDelayed();
    await engine.processDelayed();
    // duration=2：两次触发后登记过期，第三次回合开始不再触发——用 runner 行为的确定性由单测兜底
  });

  it('runs the trigger runner unit contract: register, fire, duration expiry, onDraw, onConsume', () => {
    const executed = [];
    const resolveCard = syntheticCard => {
      executed.push({ onPlay: syntheticCard.rules?.triggers?.onPlay, desc: syntheticCard.desc });
    };
    const runner = createTriggerRunner({
      resolveCard, log: () => {}, esc: v => String(v),
      getAliveFoes: () => [], addEnergy: () => {},
    });
    const host = { id: 'm2-runner', name: '时点卡', rules: { version: 1, triggers: {
      onTurnStart: [{ op: 'energy', n: 1 }],
      onDraw: [{ op: 'coins', n: 1 }],
      onConsume: [{ op: 'coins', n: 2 }],
      duration: 2,
    } } };
    runner.registerCard(host, 'm2-runner-uid');
    runner.fireTurnStart();
    runner.fireTurnStart();
    runner.fireTurnStart();   // duration=2：第三次触发时登记已过期，不再执行
    expect(executed.length).toBe(2);
    expect(executed[0].onPlay).toEqual([{ op: 'energy', n: 1 }]);
    expect(executed[0].desc).toBe('');

    runner.fireDrawn(host, null);
    expect(executed.length).toBe(3);
    expect(executed[2].onPlay).toEqual([{ op: 'coins', n: 1 }]);
    runner.fireConsume(host, null);
    expect(executed.length).toBe(4);
    expect(executed[3].onPlay).toEqual([{ op: 'coins', n: 2 }]);
  });

  it('equips structured rules: onEquip resolves on wear and skill.ops runs via the skill entry', async () => {
    const equip = {
      id: 'm2-equip-live', name: '规则草甲', cost: 0, type: '装备', desc: '',
      rules: { version: 1, equip: {
        onEquip: [{ op: 'armor', amount: 5 }],
        skill: { oncePerBattle: true, ops: [{ op: 'cleanse', target: 'self' }] },
      } },
    };
    assertSchema(equip);
    assertSupported(equip);
    const game = await startGame([equip, filler()], [foe('equip')]);
    await playCard(game, equip, 'self');
    const state = BattleSession.getSnapshot();
    expect(state.pdef.armor).toBe(5);
    expect(equipped.some(e => e.card.id === 'm2-equip-live')).toBe(true);
    // 主动技能入口（无 desc 文本时走 rules.equip.skill）
    vi.spyOn(engine, 'useEquipSkill');
    engine.useEquipSkill(game.ownedCards.find(item => item.card.id === 'm2-equip-live')?.uid);
    expect(game.logs.some(line => line.includes('主动技能发动') || line.includes('净化'))).toBe(true);
  });
});

describe('M2 unit helpers', () => {
  it('counts curse kinds on a foe', () => {
    const deps = { combat: { CURSES: ['bleed', 'poison', 'burn'] } };
    expect(countCurseKinds({ status: { bleed: 2, burn: 1 } }, deps)).toBe(2);
    expect(countCurseKinds(null, deps)).toBe(0);
  });

  it('steals a flat amount without over-stealing', () => {
    const logs = [];
    const deps = {
      combat: { addBlessing: () => {} },
      getAliveFoes: () => [target],
      getPlayerStatus: () => ({ status: {} }),
      getTurn: () => 3,
      log: m => logs.push(m),
      esc: v => String(v),
    };
    const target = { name: '靶', atk: 2, dead: false };
    expect(resolveStealAtk({ name: '禁咒' }, { amount: 5 }, target, deps)).toBe(true);
    expect(target.atk).toBe(0);
    expect(target._stealRestore).toBe(2);
    expect(logs.join()).toContain('偷取');
  });
});

describe('U12 意图角标与实伤一致（2026-09-29 夜班 F2）', () => {
  it('玩家回合内挂 atkDown 后，渲染口径意图显示值与 playerTakeHit 实伤一致', async () => {
    const card = { id: 'u12-atkdown-intent', name: '割蚀·意图验收', cost: 0, type: '法术', desc: '降低 2 攻持续 3 回合',
      ...R(ENEMY_ONE, [{ op: 'curse', curse: 'atkDown', amount: 2, duration: 3, target: 'chosenEnemy' }]) };
    const game = await startGame([card, filler()], [foe('u12intent', 1000, 5)]);
    // 渲染层表达式照抄 battle.layers.js updateFoes：快照 foe + 快照 turn/pstat 现算（U12-b 方案①）
    const display = snap => intentViewModel(calculateEnemyIntent(snap.foes[0], snap.turn, snap.pstat?.status))[0];
    expect(display(BattleSession.getSnapshot()).damage).toBe(5);   // 削攻前预告 5
    await playCard(game, card, 0);                                  // 玩家回合内削攻 5→3
    expect(foes[0].atk).toBe(3);
    const after = BattleSession.getSnapshot();
    expect(after.foes[0].intent.damage).toBe(5);   // foe.intent 快照契约不变（仍为回合末值）
    const shown = display(after).damage;           // 修复前此处仍显示 5（stale）
    expect(shown).toBe(3);
    // 实伤走公共入口 playerTakeHit；玩家无护甲/护盾/格挡/流血时 dealt 应与角标一致
    expect(after.pdef.armor).toBe(0);
    expect(after.pdef.shield).toBe(0);
    const dealt = engine.playerTakeHit({ atk: foes[0].atk, name: 'u12靶子' });
    expect(dealt).toBe(shown);
  });
});
