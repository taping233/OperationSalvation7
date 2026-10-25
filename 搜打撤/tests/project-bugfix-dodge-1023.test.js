// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';

describe('dodge consumption and expiry 1023',()=>{
  it('a spent short-lived grant cannot expire a later longer-lived grant',()=>{
    const combat=createCombatRuntime(),unit={hp:30};
    combat.addBlessing(unit,'dodge',1,1);combat.dealDamage({},unit,4,'fixed');
    combat.addBlessing(unit,'dodge',1,2);combat.tickDurations(unit);
    expect(unit.status.dodge).toBe(1);expect(unit.__timedBuffs).toEqual([{key:'dodge',amount:1,turns:1}]);
    expect(combat.dealDamage({},unit,4,'fixed').dodged).toBe(true);expect(unit.hp).toBe(30);
  });
  it('spends earliest expiry regardless of insertion order and preserves permanent layers',()=>{
    const combat=createCombatRuntime(),unit={hp:30};
    combat.addBlessing(unit,'dodge',2);combat.addBlessing(unit,'dodge',2,3);combat.addBlessing(unit,'dodge',1,1);
    combat.dealDamage({},unit,4,'fixed');combat.tickDurations(unit);
    expect(unit.status.dodge).toBe(4);expect(unit.__timedBuffs).toEqual([{key:'dodge',amount:2,turns:2}]);
    combat.dealDamage({},unit,4,'fixed');combat.dealDamage({},unit,4,'fixed');
    combat.tickDurations(unit);combat.tickDurations(unit);
    expect(unit.status.dodge).toBe(2);expect(unit.__timedBuffs).toBeNull();
  });
  it('only unspent timed layers expire while permanent dodge and other timed blessings stay independent',()=>{
    const combat=createCombatRuntime(),unit={hp:30};
    combat.addBlessing(unit,'dodge',2);combat.addBlessing(unit,'dodge',2,1);combat.addBlessing(unit,'reduce',3,2);
    combat.dealDamage({},unit,4,'true');combat.tickDurations(unit);
    expect(unit.status.dodge).toBe(2);expect(unit.status.reduce).toBe(3);
    combat.tickDurations(unit);expect(unit.status.dodge).toBe(2);expect(unit.status.reduce).toBe(0);
  });
});
