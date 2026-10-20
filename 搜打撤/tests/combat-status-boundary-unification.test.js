import { afterEach, describe, expect, it, vi } from 'vitest';
import * as Combat from '../game/src/battle/core/combat.js';
import { createEffectExecutor } from '../game/src/battle/effects/battle.effects.js';
import { handMoveCurses, resolveFoeFight } from '../game/src/battle/effects/effect-steps.m2.js';
import { set$hand } from '../game/src/battle/runtime/battle.runtime.piles.js';

afterEach(() => { set$hand([]); });

function textBattle({ poison = 0, healban = 0, silence = 0, random = 0 } = {}) {
  const player = Combat.ensureStatus({ hp: 10, maxHp: 30, status: { healban, silence } });
  const target = Combat.ensureStatus({ name: '目标', hp: 30, status: { poison } });
  const heal = vi.fn(amount => { player.hp = Math.min(player.maxHp, player.hp + amount); });
  const draw = vi.fn();
  const execute = createEffectExecutor({
    combat: Combat, getPlayerStatus: () => player, getPlayerDefense: () => player.defense,
    getAlive: () => [target], getMode: () => 'boss', escapeHtml: String, log() {},
    heal, drawCards: draw, grantStarterAttack() {}, pushFloat() {},
    random01: () => random, burstPoison: unit => Combat.tickPoison(unit),
  });
  return { player, target, heal, draw, execute };
}

describe('伤害与状态效果公共边界', () => {
  it.each(['attack', 'spell', 'fixed', 'true'])('%s负伤害不补充生命或防御', type => {
    const target = Combat.ensureStatus({ hp: 20, defense: { shield: 3, armor: 4 } });
    const result = Combat.dealDamage({ atk: 0, spellPower: 0 }, target, -1, type);
    expect(result.dealt).toBe(0);
    expect(result.absorbed).toBe(0);
    expect([target.hp, target.defense.shield, target.defense.armor]).toEqual([20, 3, 4]);
  });

  it('负卡面先与攻击加成相加，再结算防御', () => {
    const target = Combat.ensureStatus({ hp: 20, defense: { shield: 1, armor: 1 } });
    const result = Combat.dealDamage({ atk: 5 }, target, -1, Combat.TYPES.ATTACK);
    expect(result.dealt).toBe(2);
    expect([target.hp, target.defense.shield, target.defense.armor]).toEqual([18, 0, 0]);
  });

  it.each([0, 2])('花鸩文本从%s层中毒翻倍，不制造缺省层数', poison => {
    const { target, execute } = textBattle({ poison });
    const desc = '中毒层数翻倍并立即触发1次毒伤';
    execute({ id: 'tt3sp-flowerzhen', name: '花鸩', type: '法术', desc }, desc, target);
    expect(target.status.poison).toBe(poison * 2);
    expect(target.hp).toBe(30 - poison * 2);
  });

  it.each([0, 2])('旧神秘药水回复分支遵守禁疗%s', healban => {
    const { player, target, heal, execute } = textBattle({ healban });
    const desc = '随机神秘效果';
    execute({ id: 'legacy-mystery', name: '神秘药水', type: '道具', desc }, desc, target);
    expect(player.hp).toBe(healban ? 10 : 18);
    expect(heal).toHaveBeenCalledTimes(healban ? 0 : 1);
  });

  it('禁疗不吞掉神秘药水抽牌分支', () => {
    const { target, heal, draw, execute } = textBattle({ healban: 2, random: 0.5 });
    const desc = '随机神秘效果';
    execute({ id: 'legacy-mystery', name: '神秘药水', type: '道具', desc }, desc, target);
    expect(heal).not.toHaveBeenCalled();
    expect(draw).toHaveBeenCalledWith(2);
  });

  it('沉默中的混合触发仅造成伤害，不顺带抽牌', () => {
    const { target, draw, execute } = textBattle({ silence: 2 });
    const desc = '造成 3 点固定伤害，并抽 2 张牌';
    execute({ name: '混合触发', type: '法术', desc }, desc, target, { triggered: true });
    expect(target.hp).toBe(27);
    expect(draw).not.toHaveBeenCalled();
  });

  it('沉默中的伤害与诅咒枚举只保留伤害', () => {
    const { target, execute } = textBattle({ silence: 2 });
    const desc = '3′冰冻、中毒';
    execute({ name: '枚举触发', type: '法术', desc }, desc, target, { triggered: true });
    expect(target.hp).toBe(27);
    expect([target.status.freeze, target.status.poison]).toEqual([0, 0]);
  });

  it.each([
    ['注能(2)：造成 3 点固定伤害', 2, 30],
    ['诅咒状态下：造成 3 点固定伤害', 0, 30],
    ['诅咒状态下：造成 3 点固定伤害', 2, 27],
  ])('触发前置条件%s，沉默%s本身也属于诅咒', (desc, silence, hp) => {
    const { target, execute } = textBattle({ silence });
    execute({ name: '有条件触发', type: '法术', desc }, desc, target, { triggered: true });
    expect(target.hp).toBe(hp);
  });

  it.each([false, true])('手牌诅咒聚合按onPlay声明拥有域%s，其他时点保留文本', declared => {
    const card = { type: '法术', desc: '附加 2 层中毒',
      rules: { triggers: declared ? { onPlay: [] } : { onDraw: [] } } };
    set$hand(['curse-card']);
    const specs = handMoveCurses({ findCard: () => ({ card }), combat: Combat });
    expect(specs).toEqual(declared ? [] : [{ kind: 'poison', amount: 2 }]);
  });

  it.each([2, 20])('结构化扰敌后手生命%s：死亡者不能反击', hp => {
    const first = Combat.ensureStatus({ name: '先手', hp: 20, atk: 5 });
    const second = Combat.ensureStatus({ name: '后手', hp, atk: 4 });
    const hit = vi.fn((attacker, target, amount) => Combat.dealDamage(attacker, target, amount, 'attack'));
    resolveFoeFight({ name: '扰敌' }, {}, { getAliveFoes: () => [first, second],
      foeDealDamage: hit, log() {}, esc: String, sweepDead() {} });
    expect(hit).toHaveBeenCalledTimes(hp <= 5 ? 1 : 2);
    expect(first.hp).toBe(hp <= 5 ? 20 : 16);
  });
});
