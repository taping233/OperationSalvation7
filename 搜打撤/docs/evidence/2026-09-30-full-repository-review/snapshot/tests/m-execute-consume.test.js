import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveExecute, resolveFoeFight } from '../game/src/battle/effects/effect-steps.m2.js';
import { resolveDrawHandOps } from '../game/src/battle/effects/effect-steps.m1.js';
import { set$hand, set$consumed, consumed } from '../game/src/battle/runtime/battle.runtime.piles.js';

const card = { id: 'source', name: '测试', type: '武术' };
function deps(foes) {
  return { getAliveFoes: () => foes.filter(foe => !foe.dead),
    combat: { CURSES: ['poison', 'bleed', 'freeze'] }, esc: value => value, log: vi.fn(),
    hitFoe: vi.fn((foe, _card, amount, type) => { foe.hp -= amount + (type === 'attack' ? 5 : 0); foe.dead = foe.hp <= 0; }) };
}
beforeEach(() => { set$hand([]); set$consumed([]); });
describe('M repeated execution and consumption', () => {
  it('casts all three fireballs at the chosen enemy, not once per available enemy', () => {
    const a = { hp: 100 }, b = { hp: 100 };
    const d = deps([a, b]);
    resolveExecute(card, { what: 'fireball', count: 3 }, b, d);
    expect(d.hitFoe).toHaveBeenCalledTimes(3);
    expect(a.hp).toBe(100);
    expect(b.hp).toBe(88);
  });
  it('stops repeated casts after their target dies', () => {
    const a = { hp: 4 }, b = { hp: 100 };
    const d = deps([a, b]);
    resolveExecute(card, { what: 'fireball', count: 3 }, a, d);
    expect(d.hitFoe).toHaveBeenCalledTimes(1);
    expect(b.hp).toBe(100);
  });
  it('counts curse layers and adds player attack exactly once per starter attack', () => {
    const foe = { hp: 100, status: { poison: 3, bleed: 2 } };
    const d = deps([foe]);
    resolveExecute(card, { what: 'starterAttack', perCurseStacks: true }, foe, d);
    expect(d.hitFoe).toHaveBeenCalledTimes(5);
    expect(foe.hp).toBe(75);
    expect(d.hitFoe.mock.calls.every(call => call[2] === 0)).toBe(true);
  });
  it('casts zero times when the enemy has no curse layers', () => {
    const foe = { hp: 100, status: {} };
    const d = deps([foe]);
    resolveExecute(card, { what: 'starterAttack', perCurseStacks: true }, foe, d);
    expect(d.hitFoe).not.toHaveBeenCalled();
  });
  it('runs consumption hooks once for each consumed card after removing the hand', () => {
    const cards = { a: { id: 'a' }, b: { id: 'b' } };
    set$hand(['a', 'b']);
    const onHandConsumed = vi.fn();
    [...resolveDrawHandOps(card, [{ op: 'consumeHand' }], {
      esc: value => value, log() {}, findCard: uid => ({ card: cards[uid] }), onHandConsumed,
    })];
    expect(consumed).toEqual(['a', 'b']);
    expect(onHandConsumed.mock.calls).toEqual([[cards.a, 'a'], [cards.b, 'b']]);
  });
  it('sweeps defeated foes even when the combat port only changes hp', () => {
    const a = { hp: 1, atk: 2 }, b = { hp: 2, atk: 2 };
    const sweepDead = vi.fn();
    resolveFoeFight(card, {}, { getAliveFoes: () => [a, b], esc: value => value, log() {},
      foeDealDamage: (attacker, target) => { target.hp -= attacker.atk; }, sweepDead });
    expect(sweepDead).toHaveBeenCalledTimes(1);
    expect(b.hp).toBe(0);
  });
});
