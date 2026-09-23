import { describe, expect, it } from 'vitest';
import { damageSteps } from '../game/src/effect-steps.damage.js';
import { makeHitFoe } from '../game/src/effect-steps.ctx.js';

function fixture(hpList, attack = 3) {
  const foes = hpList.map((hp, i) => ({ id: `foe-${i}`, name: `敌人${i + 1}`, hp, dead: false, status: {} }));
  const hits = [], logs = [];
  const combat = { TYPES: { ATTACK: 'attack', FIXED: 'fixed', SPELL: 'spell' }, TYPE_NAME: { attack: '攻击', fixed: '固定伤害', spell: '法术伤害' } };
  const s = {
    combat,
    getAlive: () => foes.filter(foe => !foe.dead),
    getPlayerCaster: () => ({ atk: attack }),
    log: (...args) => logs.push(args),
    esc: value => String(value),
    hitFoe: (ctx, foe, amount, type, caster, sequence) => {
      const dealt = amount || caster.atk || 0;
      foe.hp -= dealt;
      if (foe.hp <= 0) foe.dead = true;
      hits.push({ index: foes.indexOf(foe), dealt, type, sequence });
      return { dealt };
    },
  };
  return { foes, hits, logs, steps: damageSteps(s) };
}

const run = (fixture, id, ctx, match = null) => fixture.steps.find(step => step.id === id).run(ctx, match);

describe('文本伤害路径的多段转向', () => {
  it('快意恩仇的攻击段在首敌死亡后转向下一个存活敌人', () => {
    const f = fixture([3, 10, 10]);
    const ctx = { card: { name: '快意恩仇' }, desc: '攻击3次', curseTarget: f.foes[0], did: false };
    run(f, 'dmg.multiAttack', ctx, ['攻击3次', '3']);
    expect(f.hits.map(hit => hit.index)).toEqual([0, 1, 1]);
    expect(f.hits.map(hit => hit.sequence)).toEqual([1, 2, 3]);
    expect(f.foes.map(foe => foe.hp)).toEqual([0, 4, 10]);
    expect(f.logs.some(([message]) => String(message).includes('第 2/3 段'))).toBe(true);
  });

  it('四枪和多次火球均保留总段数并在目标死亡后继续攻击', () => {
    const shots = fixture([1, 10, 10]);
    run(shots, 'dmg.fourShots', { card: { name: '连开四枪' }, desc: '连开四枪' });
    expect(shots.hits.map(hit => hit.index)).toEqual([0, 1, 1, 1]);
    expect(shots.hits.map(hit => hit.sequence)).toEqual([1, 2, 3, 4]);

    const fireballs = fixture([1, 10, 10]);
    run(fireballs, 'dmg.fireballN', { card: { name: '火球连放' }, desc: '施放3次火球', curseTarget: fireballs.foes[0] }, ['', '3']);
    expect(fireballs.hits.map(hit => hit.index)).toEqual([0, 1, 1]);
    expect(fireballs.hits.map(hit => hit.sequence)).toEqual([1, 2, 3]);
  });

  it('全体每人多次火球保持初始敌人数 × 每人次数的计划段数', () => {
    const f = fixture([1, 1, 20]);
    run(f, 'dmg.stormFireball', { card: { name: '火球风暴' }, desc: '全体敌人每人释放2次火球' }, ['', '2']);
    expect(f.hits.map(hit => hit.index)).toEqual([0, 1, 2, 2, 2, 2]);
    expect(f.hits.map(hit => hit.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it('无存活敌人时停止，文本路径伤害飘字带逐段序号', () => {
    const f = fixture([1]);
    run(f, 'dmg.multiAttack', { card: { name: '快意恩仇' }, desc: '攻击3次', curseTarget: f.foes[0], did: false }, ['攻击3次', '3']);
    expect(f.hits).toHaveLength(1);
    expect(f.logs.some(([message]) => String(message).includes('场上已无可攻击的敌人'))).toBe(true);

    const floats = [];
    const hit = makeHitFoe({
      combat: { dealDamage: (_caster, foe) => { foe.hp -= 2; return { dealt: 2 }; } },
      pushFloat: value => floats.push(value), foeIndexOf: () => 0,
    });
    const foe = { hp: 10, dead: false };
    hit({}, foe, 2, 'attack', {}, 3);
    expect(floats[0]).toMatchObject({ label: '第 3 段', sequence: 3 });
  });
});
