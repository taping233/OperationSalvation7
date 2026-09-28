import { describe, expect, it } from 'vitest';
import { RULE_CONFIG, validateRuleConfig } from '../game/src/core/rule-config.js';

const copy = () => structuredClone(RULE_CONFIG);
const setPath = (value, path, next) => {
  const keys = path.split('.');
  const key = keys.pop();
  const parent = keys.reduce((node, part) => node[part], value);
  parent[key] = next;
  return value;
};

describe('pure rule configuration', () => {
  it('exports deeply frozen gameplay defaults including the two probability rules', () => {
    expect(Object.isFrozen(RULE_CONFIG)).toBe(true);
    for (const group of Object.values(RULE_CONFIG)) expect(Object.isFrozen(group)).toBe(true);
    expect(RULE_CONFIG.extraction.pocketKeepChance).toBeCloseTo(1 / 3);
    expect(RULE_CONFIG.rewards.beastLegendaryChance).toBe(0.3);
    expect(validateRuleConfig(RULE_CONFIG)).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['map.stepMs', 0], ['map.emergencyExitCost', -1], ['map.fireHeal', 1.5],
    ['map.fireClassCardChance', 1.01], ['battle.energy', 0], ['battle.startDraw', -1],
    ['battle.turnDraw', 0.5], ['battle.handMax', 0], ['battle.bossDeckSize', 2.5],
    ['battle.starterAttack', -1], ['backpack.start', 0], ['backpack.max', 2.5],
    ['backpack.upgradeWood', 0], ['backpack.safeStart', -1], ['backpack.safeMax', -1],
    ['backpack.safeUpgradeRations', 0], ['base.stashStart', 0], ['base.stashMax', 2.5],
    ['base.stashUpgradeWood', 0], ['base.stashUpgradeSlots', 0], ['base.stashRuneSlotCost', -1],
    ['base.stashRuneSlotFrom', 0], ['growth.playerMaxHp', 0], ['growth.playerAtk', -1],
    ['extraction.pocketKeepChance', -0.01], ['extraction.pocketKeepChance', 1.01],
    ['extraction.pocketKeepChance', Number.NaN], ['rewards.beastLegendaryChance', Infinity],
    ['rewards.beastLegendaryChance', '0.3'],
  ])('rejects an out-of-range value at %s', (path, value) => {
    const result = validateRuleConfig(setPath(copy(), path, value));
    expect(result.ok).toBe(false);
    expect(result.errors.some(error => error.startsWith(`${path}:`))).toBe(true);
  });

  it.each([
    ['backpack.max', 15, 'backpack.max: must be >= backpack.start'],
    ['backpack.safeMax', 1, 'backpack.safeMax: must be >= backpack.safeStart'],
    ['base.stashMax', 24, 'base.stashMax: must be >= base.stashStart'],
  ])('rejects invalid capacity relation at %s', (path, value, message) => {
    const result = validateRuleConfig(setPath(copy(), path, value));
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(message);
  });

  it('reports missing groups and non-object configurations without throwing', () => {
    expect(validateRuleConfig(null).ok).toBe(false);
    const invalid = copy();
    delete invalid.battle;
    expect(validateRuleConfig(invalid).errors).toContain('battle: expected an object');
  });

  it('allows independent safe-grid capacity and rune thresholds outside current stash capacity', () => {
    const independentCapacities = setPath(setPath(copy(), 'backpack.safeMax', 31), 'base.stashRuneSlotFrom', 101);
    expect(validateRuleConfig(independentCapacities)).toEqual({ ok: true, errors: [] });
  });
});
