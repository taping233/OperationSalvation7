import { battleRules } from './helpers/environment-fixtures.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Combat from '../game/src/battle/core/combat.js';
import { resolveDrawUntilHandN } from '../game/src/battle/effects/effect-steps.m1.js';
import { resolveStealAtk } from '../game/src/battle/effects/effect-steps.m2.js';
import { inspectCardRuleCapability } from '../game/src/cards/card-rules.capability.js';

window.SDT = window.SDT || { Icons: { img: () => '', TYPE_ART: {} } };
window.SDT.Sound = { music() {}, sfx() {}, setDucked() {}, setBoss() {} };
window.SDT.MAP = {
  rules: { ...battleRules(9, 8, 1, 0, 0, 0) }, items: {},
};
await import('../game/src/cards/cards.js');
window.SDT.Cards.ensureSha();
window.SDT.Cards.ensureStarters();
window.SDT.Cards.ensureTabletop();
window.SDT.Cards.ensureDmgTypes();
window.SDT.Cards.ensureEffectFields();
const { BattleSession } = await import('../game/src/battle/core/battle.core.js');
const E = await import('../game/src/battle/core/battle.engine.js');
const R = await import('../game/src/battle/runtime/battle.runtime.js');

const automatic = {
  id: 'audit-auto-draw', name: '抽到即施放测试牌', type: '法术', cost: 0, desc: '',
  rules: { version: 1, battle: { target: { side: 'self', area: false } },
    triggers: { onDraw: [{ op: 'energy', n: 1 }] } },
};
const plain = { id: 'audit-plain', name: '普通测试牌', type: '武术', cost: 0, desc: '' };
let game;
function beginDrawDeck(cards, handUids = []) {
  game = {
    ownedCards: cards.map((card, index) => ({ uid: `audit-${index}`, card })),
    hp: 100, maxHp: 100, atk: 5, spellPower: 0, coins: 0, myClass: '战士',
    state: 'idle', battleActive: false, log() {}, heal() {}, addItem() {}, onBattleEnd() {},
  };
  BattleSession.start(game, [{ id: 'audit-foe', name: '靶子', hp: 1000, atk: 1 }], { isBoss: false });
  R.set$mode('boss');
  R.set$hand(handUids);
  R.set$drawPile(game.ownedCards.map(entry => entry.uid));
  R.set$discard([]);
  return game;
}
function drawDeps(maxCalls = 6) {
  let calls = 0;
  return {
    get calls() { return calls; },
    drawCards(n) {
      // Bound the pre-fix reproduction without allowing a synchronous hang.
      if (++calls > maxCalls) throw new Error('draw-to-hand repeated the same automatic-only deck');
      return E.drawCards(n);
    },
    grantSha: E.grantSha, findCard: E.findCard,
    countDrawnSpells: () => R.lastDrawnUids.filter(uid => E.findCard(uid)?.card.type === '法术').length,
    log() {}, esc: String,
  };
}
afterEach(() => { if (game?.battleActive) BattleSession.commands.flee(); game = null; });

describe('battle rule audit 2026-10-14', () => {
  it.each(['attack', 'spell', 'fixed'])('破甲使 %s 伤害跳过减伤、格挡、护盾和护甲', type => {
    const target = { hp: 30, status: { abreak: 1, reduce: 4 },
      defense: { shield: 5, armor: 6, guard: true } };
    const result = Combat.dealDamage({}, target, 8, type);
    expect(result.dealt).toBe(8);
    expect(target.hp).toBe(22);
    expect(target.defense).toEqual({ shield: 5, armor: 6, guard: true });
  });

  it('没有破甲时减伤仍生效，并由护盾先于护甲吸收余伤', () => {
    const target = { hp: 30, status: { reduce: 2 }, defense: { shield: 3, armor: 2, guard: false } };
    const result = Combat.dealDamage({}, target, 8, 'fixed');
    expect(result).toMatchObject({ dealt: 1, reduced: 2, absorbed: 5 });
    expect(target.defense).toMatchObject({ shield: 0, armor: 0 });
    expect(target.hp).toBe(29);
  });

  it.each(['immune', 'stealth'])('破甲不会绕过 %s 的前置免伤', key => {
    const target = { hp: 30, status: { abreak: 1, reduce: 4, [key]: 1 } };
    expect(Combat.dealDamage({}, target, 8, 'true').dealt).toBe(0);
    expect(target.hp).toBe(30);
  });

  it('真实伤害始终绕过防御与减伤，破甲到期后普通伤害恢复减伤', () => {
    const target = { hp: 30, status: { abreak: 1, reduce: 4 },
      defense: { shield: 3, armor: 2, guard: true } };
    expect(Combat.dealDamage({}, target, 8, 'true').dealt).toBe(8);
    Combat.tickDurations(target);
    expect(target.status.abreak).toBe(0);
    expect(Combat.dealDamage({}, target, 8, 'fixed').dealt).toBe(0);
    expect(target.defense).toMatchObject({ shield: 3, armor: 2 });
  });

  it('抽至指定手牌数时，只有抽到即施放牌的循环牌库会正常停止', () => {
    beginDrawDeck([automatic]);
    const deps = drawDeps();
    expect(() => resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps)).not.toThrow();
    expect(R.hand).toEqual([]);
    expect(deps.calls).toBe(1);
    expect([...R.drawPile, ...R.discard]).toEqual(['audit-0']);
    expect(R.energy).toBe(10);
  });

  it('抽到即施放牌之后仍会继续抽取尚未见过的普通牌', () => {
    beginDrawDeck([plain, automatic]);
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(2);
    expect(R.hand).toEqual(['audit-0']);
    expect(R.discard).toEqual(['audit-1']);
  });

  it('抽至手牌数累计本次全部法术，不减去前次抽牌记录', () => {
    beginDrawDeck([{ ...plain, type: '法术' }, { ...plain, type: '法术' }, { ...plain, type: '法术' }]);
    R.set$drawPile(['audit-0', 'audit-1']);
    R.set$lastDrawnUids(['audit-2']);
    const deps = drawDeps();
    expect(resolveDrawUntilHandN(plain, { untilHandN: 2 }, deps)).toBe(2);
    expect(deps.calls).toBe(2);
  });

  it('自动牌耗尽后停止，后续抽牌不自动取回消耗牌', () => {
    beginDrawDeck([automatic, automatic, automatic]);
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(3);
    expect(R.hand).toEqual([]);
    expect(R.energy).toBe(12);
    expect(E.drawCards(1)).toBe(0);
    expect(R.energy).toBe(12);
  });

  it('抽至目标手牌数在空库停止，不自动取回消耗牌', () => {
    beginDrawDeck([plain, plain, plain]);
    R.set$drawPile(['audit-0']);
    R.set$discard(['audit-1', 'audit-2']);
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 3 }, deps);
    expect(deps.calls).toBe(2);
    expect(R.hand).toEqual(['audit-0']);
    expect(R.discard).toEqual(['audit-1', 'audit-2']);
  });

  it('空牌堆正常停止，旧法术记录不会计入本次抽牌', () => {
    beginDrawDeck([{ ...plain, type: '法术' }]);
    R.set$drawPile([]);
    R.set$lastDrawnUids(['audit-0']);
    const deps = drawDeps();
    expect(resolveDrawUntilHandN(plain, { untilHandN: 2 }, deps)).toBe(0);
    expect(deps.calls).toBe(1);
  });

  it('自动施放新洗入的普通牌仍可被本次连抽取得', () => {
    beginDrawDeck([{ ...automatic, rules: { version: 1, triggers: {
      onDraw: [{ op: 'acquire', n: 1, pool: { kind: '初始攻击' }, dest: 'deck' }],
    } } }]);
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(2);
    expect(R.hand).toHaveLength(1);
    expect(E.findCard(R.hand[0]).card.name).toBe('初始攻击');
  });

  it('抽到即施放击杀最后敌人后停止继续抽牌', () => {
    beginDrawDeck([plain, { ...automatic, dmgType: 'fixed', rules: { version: 1, triggers: {
      onDraw: [{ op: 'damage', amount: 1, target: 'chosenEnemy' }],
    } } }]);
    R.foes[0].hp = 1;
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(1);
    expect(R.foes[0].dead).toBe(true);
    expect(R.hand).toEqual([]);
    expect(R.drawPile).toEqual(['audit-0']);
  });

  it('抽到即施放自伤结束战斗后停止继续抽牌', () => {
    beginDrawDeck([plain, { ...automatic, rules: { version: 1, triggers: {
      onDraw: [{ op: 'heal', selfDamage: 1 }],
    } } }]);
    game.hp = 1;
    const deps = drawDeps();
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(1);
    expect(game.battleActive).toBe(false);
    expect(R.hand).toEqual([]);
  });

  it('连续三张自动牌均回弃牌堆，随后仍抽到底部普通牌', () => {
    beginDrawDeck([plain, automatic, automatic, automatic]);
    const sizes = [];
    const deps = drawDeps();
    const draw = deps.drawCards;
    deps.drawCards = n => {
      const before = R.drawPile.length + R.discard.length;
      const got = draw(n);
      sizes.push([before, R.drawPile.length + R.discard.length]);
      return got;
    };
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, deps);
    expect(deps.calls).toBe(4);
    expect(sizes).toEqual([[4, 4], [4, 4], [4, 4], [4, 3]]);
    expect(R.hand).toEqual(['audit-0']);
  });

  it('消耗自动牌的缩库桩不会使遍历阈值提前缩到普通牌之前', () => {
    beginDrawDeck([plain, automatic, automatic, automatic]);
    const draw = vi.fn(() => {
      const uid = R.drawPile.pop();
      if (!uid) return 0;
      if (E.findCard(uid).card.id === automatic.id) R.consumed.push(uid);
      else R.hand.push(uid);
      return 1;
    });
    resolveDrawUntilHandN(plain, { untilHandN: 1 }, { ...drawDeps(), drawCards: draw });
    expect(draw).toHaveBeenCalledTimes(4);
    expect(R.hand).toEqual(['audit-0']);
    expect(R.consumed).toEqual(['audit-3', 'audit-2', 'audit-1']);
  });

  it('法术抽至两张后，perSpellHeal在真实出牌链路回复两张的生命', async () => {
    const refill = { id: 'audit-refill-heal', name: '补牌回复', type: '法术', cost: 0, desc: '',
      rules: { version: 1, battle: { target: { side: 'self', area: false } }, triggers: {
        onPlay: [{ op: 'draw', untilHandN: 2 }, { op: 'heal', perSpellHeal: 3 }],
      } } };
    beginDrawDeck([refill, { ...plain, type: '法术' }, { ...plain, type: '法术' }]);
    R.set$hand(['audit-0']);
    R.set$drawPile(['audit-1', 'audit-2']);
    game.hp = 50;
    game.heal = function (n) { this.hp = Math.min(this.maxHp, this.hp + n); };
    BattleSession.commands.playCard('audit-0', 'self');
    await settle();
    expect(game.hp).toBe(56);
  });

  it('真实割蚀把敌人降至0攻后，影噬不能把敌人抬到1攻', async () => {
    const cards = ['tt3wu-shike', 'tt3sp-shadowbug'].map(id => window.SDT.Cards.all().find(card => card.id === id));
    expect(cards.every(Boolean)).toBe(true);
    beginDrawDeck(cards);
    R.set$mode('normal');
    R.set$hand(['audit-0', 'audit-1']);
    BattleSession.commands.playCard('audit-0', 0);
    await settle();
    expect(R.foes[0].atk).toBe(0);
    BattleSession.commands.playCard('audit-1', 0);
    await settle();
    expect(R.foes[0].atk).toBe(0);
    expect(R.pstat.status.atkUp).toBe(0);
  });

  it('allEnemies契约逐一偷取活着的目标，并分别登记实际归还量', () => {
    const enemies = [{ atk: 5 }, { atk: 6 }, { atk: 100, dead: true }];
    const deps = stealDeps(enemies);
    const operation = { op: 'stealAtk', amount: 2, target: 'allEnemies' };
    const card = stealCard(operation);
    expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });
    resolveStealAtk(card, operation, enemies[1], deps);
    expect(enemies.map(foe => foe.atk)).toEqual([3, 4, 100]);
    expect(enemies.slice(0, 2).map(foe => foe._stealRestore)).toEqual([2, 2]);
    expect(deps.player.status.atkUp).toBe(4);
    expect(deps.random).not.toHaveBeenCalled();
  });

  it('群体偷取在真实出牌与回合链路中生效，并在回合末分别归还', async () => {
    const card = stealCard({ op: 'stealAtk', amount: 2, target: 'allEnemies' });
    beginDrawDeck([card]);
    const first = R.foes[0];
    first.atk = 5;
    R.set$foes([first, { ...first, id: 'audit-second', atk: 6, status: {},
      defense: { shield: 0, armor: 0, guard: false } }]);
    R.set$mode('normal');
    R.set$hand(['audit-0']);
    BattleSession.commands.playCard('audit-0', 1);
    await settle();
    expect(R.foes.map(foe => foe.atk)).toEqual([3, 4]);
    expect(R.pstat.status.atkUp).toBe(4);
    BattleSession.commands.endTurn();
    await settle();
    expect(game.hp).toBe(93);
    expect(R.foes.map(foe => foe.atk)).toEqual([5, 6]);
    expect(R.pstat.status.atkUp).toBe(0);
  });

  it('randomEnemy契约使用一次注入的随机数，忽略单体点选并排除尸体', () => {
    const enemies = [{ atk: 5 }, { atk: 100, dead: true }, { atk: 6 }];
    const deps = stealDeps(enemies);
    const operation = { op: 'stealAtk', amount: 2, target: 'randomEnemy' };
    const card = stealCard(operation);
    expect(inspectCardRuleCapability(card)).toMatchObject({ kind: 'supported', ok: true });
    resolveStealAtk(card, operation, enemies[0], deps);
    expect(enemies.map(foe => foe.atk)).toEqual([5, 100, 4]);
    expect(deps.random).toHaveBeenCalledTimes(1);
  });

  it('单体偷取只结算原目标，不新增随机数消耗，也不超额偷取', () => {
    const enemies = [{ atk: 5 }, { atk: 1 }];
    const deps = stealDeps(enemies);
    resolveStealAtk(plain, { op: 'stealAtk', amount: 3, target: 'chosenEnemy' }, enemies[1], deps);
    expect(enemies.map(foe => foe.atk)).toEqual([5, 0]);
    expect(deps.player.status.atkUp).toBe(1);
    expect(enemies[1]._stealRestore).toBe(1);
    expect(deps.random).not.toHaveBeenCalled();
  });

  it.each(['allEnemies', 'randomEnemy'])('%s场上已空时不结算、不消耗随机数', target => {
    const deps = stealDeps([]);
    expect(resolveStealAtk(plain, { op: 'stealAtk', amount: 2, target }, null, deps)).toBe(false);
    expect(deps.random).not.toHaveBeenCalled();
  });
});

async function settle() {
  for (let n = 0; n < 400; n++) {
    await new Promise(resolve => setTimeout(resolve, 0));
    if (!R.busy && !BattleSession.getSnapshot().actionQueueLength) return;
  }
  throw new Error('audit battle queue did not settle');
}
function stealDeps(enemies) {
  const player = { status: {} };
  return { player, combat: Combat, getPlayerStatus: () => player, getAliveFoes: () => enemies,
    getTurn: () => 1, random: vi.fn(() => 0.99), log() {}, esc: String };
}
function stealCard(operation) {
  return { ...plain, rules: { version: 1, battle: {
    target: { side: 'enemy', area: operation.target === 'allEnemies' },
  }, triggers: { onPlay: [operation] } } };
}
