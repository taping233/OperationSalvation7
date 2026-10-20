// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createEquipmentSemanticOperations } from '../game/src/battle/effects/equipment-semantic-operations.js';

function harness(passives) {
  const runtime = { equipped:passives.map((passive, i) => ({ uid:`eq-${i}`, card:{ name:'可任意改写的装备文案', desc:'', rules:{ equip:{ passive } } } })),
    G:{ hp:10, battleActive:true, log:vi.fn() }, pstat:{ status:{} }, battleState:{ token:1 },
    turn:1, energy:0, hand:[], infuseFuels:0, sealUnlocked:false, playedMovesThisTurn:0, playedMartialThisTurn:0 };
  runtime.set$energy = n => { runtime.energy = n; };
  runtime.set$sealUnlocked = value => { runtime.sealUnlocked = value; };
  const foes = [{ id:'a' }, { id:'b' }], random = vi.fn(() => 0.2), hitFoe = vi.fn(), drawCards = vi.fn(n => n);
  const combat = { TYPES:{ FIXED:'fixed' }, addBlessing:vi.fn() };
  const operations = createEquipmentSemanticOperations({ runtime, combat, random, alive:() => foes, hitFoe, drawCards });
  return { runtime, foes, random, hitFoe, drawCards, combat, ...operations };
}

describe('装备声明的事件语义', () => {
  it('伤害响应保持选敌后再掷抽牌概率的顺序，零伤和致命伤不触发', () => {
    const h = harness([{ damageResponse:{ damage:3, drawChance:0.5, draw:1 } }]);
    h.random.mockReturnValueOnce(0.9).mockReturnValueOnce(0.2);
    h.playerDamaged(2);
    expect(h.hitFoe).toHaveBeenCalledWith(h.foes[1], h.runtime.equipped[0].card, 3, 'fixed', '', { preserveBaseDamage:true });
    expect(h.random).toHaveBeenCalledTimes(2);
    expect(h.drawCards).toHaveBeenCalledWith(1);
    h.playerDamaged(0); h.runtime.G.hp = 0; h.playerDamaged(2);
    expect(h.hitFoe).toHaveBeenCalledOnce();
  });

  it('反击途中换场时不继续为新战斗掷概率或抽牌', () => {
    const h = harness([{ damageResponse:{ damage:3, drawChance:0.5, draw:1 } }]);
    h.hitFoe.mockImplementation(() => { h.runtime.battleState = { token:2 }; });
    h.playerDamaged(1);
    expect(h.random).toHaveBeenCalledOnce();
    expect(h.drawCards).not.toHaveBeenCalled();
  });

  it('交替返能沿穿戴回合锚定，每回合仅第一次对应类型触发', () => {
    const h = harness([{ alternatingRefund:{ types:['武术', '法术'], amount:1 } }]);
    h.runtime.turn = 3; h.registerEquipment(h.runtime.equipped[0]);
    h.cardPlayed({ type:'法术' }); h.cardPlayed({ type:'武术' }); h.cardPlayed({ type:'武术' });
    expect(h.runtime.energy).toBe(1);
    h.runtime.turn = 4; h.cardPlayed({ type:'武术' }); h.cardPlayed({ type:'法术' });
    expect(h.runtime.energy).toBe(2);
    expect(h.runtime.pstat.requestedCards.astrolabes['eq-0']).toEqual({ firstTurn:3, turn:4, triggered:true });
    h.runtime.turn = 5; h.runtime.playedMartialThisTurn = 1; h.runtime.playedMovesThisTurn = 1;
    h.cardPlayed({ type:'武术' });
    expect(h.runtime.energy).toBe(2);
  });

  it('注能解锁读取参数，先占用本场次数，重复检查不重复发放', () => {
    const h = harness([{ infusionUnlock:{ fuel:3, spellPower:2, draw:2 } }]);
    h.runtime.infuseFuels = 2; expect(h.checkInfusionUnlock()).toBe(false);
    h.runtime.infuseFuels = 3; expect(h.checkInfusionUnlock()).toBe(true);
    expect(h.combat.addBlessing).toHaveBeenCalledWith(h.runtime.pstat, 'spellUp', 2);
    expect(h.drawCards).toHaveBeenCalledWith(2);
    expect(h.checkInfusionUnlock()).toBe(false);
    expect(h.drawCards).toHaveBeenCalledOnce();
  });

  it('英雄技能费用由手牌阈值决定，超过阈值保留原技能', () => {
    const h = harness([{ heroSkillCost:{ maxHand:3, cost:0 } }]), skill = { cost:2, hint:'2 费 · 攻击' };
    h.runtime.hand = ['a', 'b', 'c']; expect(h.heroSkillCost(skill)).toEqual({ cost:0, hint:'0 费 · 攻击' });
    h.runtime.hand.push('d'); expect(h.heroSkillCost(skill)).toBe(skill);
  });

  it('两实例相同装备UID的返能记录互不共享', () => {
    const passive = { alternatingRefund:{ types:['武术', '法术'], amount:1 } };
    const a = harness([passive]), b = harness([passive]);
    a.registerEquipment(a.runtime.equipped[0]); b.registerEquipment(b.runtime.equipped[0]);
    a.cardPlayed({ type:'武术' });
    expect(a.runtime.energy).toBe(1); expect(b.runtime.energy).toBe(0);
    b.cardPlayed({ type:'武术' }); expect(b.runtime.energy).toBe(1);
    expect(a.runtime.pstat.requestedCards).not.toBe(b.runtime.pstat.requestedCards);
  });
});
