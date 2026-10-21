/* Pure game-rule configuration: no browser globals or registration side effects. */

const DEFAULT_RULE_CONFIG = {
  map: { stepMs: 340, emergencyExitCost: 10, fireHeal: 8, fireClassCardChance: 0.3 },
  battle: { energy: 2, startDraw: 5, turnDraw: 1, handMax: 8, bossDeckSize: 15, starterAttack: 5 },
  backpack: { start: 16, max: 30, upgradeWood: 2, safeStart: 2, safeMax: 6, safeUpgradeRations: 2 },
  base: { stashStart: 25, stashMax: 100, stashUpgradeWood: 2, stashUpgradeSlots: 3, stashRuneSlotCost: 2, stashRuneSlotFrom: 50 },
  growth: { playerMaxHp: 30, playerAtk: 4 },
  extraction: { pocketKeepChance: 1 / 3 },
  rewards: {
    beastLegendaryChance: 0.3,
    petEggBaseChance: 0.007,
  },
};

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * Validate an unknown rule object without assuming the input shape.
 * @param {unknown} config
 * @returns {{ ok: boolean, errors: string[] }}
 */
function validateRuleConfig(config) {
  const errors = [];
  if (!isRecord(config)) return { ok: false, errors: ['rules: expected an object'] };

  /** @param {string} name @returns {Record<string, unknown>} */
  const group = name => {
    const value = config[name];
    if (!isRecord(value)) {
      errors.push(`${name}: expected an object`);
      return {};
    }
    return value;
  };
  /**
   * @param {Record<string, unknown>} values
   * @param {string} groupName
   * @param {string} key
   * @param {{ min?: number, max?: number, integer?: boolean }} [options]
   * @returns {unknown}
   */
  const number = (values, groupName, key, { min = 0, max = Infinity, integer = false } = {}) => {
    const value = values[key];
    const path = `${groupName}.${key}`;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
      const kind = integer ? 'integer' : 'number';
      const upper = Number.isFinite(max) ? ` and <= ${max}` : '';
      errors.push(`${path}: expected a finite ${kind} >= ${min}${upper}`);
    }
    return value;
  };

  const map = group('map');
  number(map, 'map', 'stepMs', { min: 1, integer: true });
  number(map, 'map', 'emergencyExitCost', { integer: true });
  number(map, 'map', 'fireHeal', { integer: true });
  number(map, 'map', 'fireClassCardChance', { max: 1 });

  const battle = group('battle');
  number(battle, 'battle', 'energy', { min: 1, integer: true });
  number(battle, 'battle', 'startDraw', { integer: true });
  number(battle, 'battle', 'turnDraw', { integer: true });
  number(battle, 'battle', 'handMax', { min: 1, integer: true });
  number(battle, 'battle', 'bossDeckSize', { min: 1, integer: true });
  number(battle, 'battle', 'starterAttack', { integer: true });

  const backpack = group('backpack');
  const bagStart = number(backpack, 'backpack', 'start', { min: 1, integer: true });
  const bagMax = number(backpack, 'backpack', 'max', { min: 1, integer: true });
  const safeStart = number(backpack, 'backpack', 'safeStart', { integer: true });
  const safeMax = number(backpack, 'backpack', 'safeMax', { integer: true });
  number(backpack, 'backpack', 'upgradeWood', { min: 1, integer: true });
  number(backpack, 'backpack', 'safeUpgradeRations', { min: 1, integer: true });
  if (typeof bagStart === 'number' && Number.isFinite(bagStart) && typeof bagMax === 'number' && Number.isFinite(bagMax) && bagMax < bagStart) errors.push('backpack.max: must be >= backpack.start');
  if (typeof safeStart === 'number' && Number.isFinite(safeStart) && typeof safeMax === 'number' && Number.isFinite(safeMax) && safeMax < safeStart) errors.push('backpack.safeMax: must be >= backpack.safeStart');

  const base = group('base');
  const stashStart = number(base, 'base', 'stashStart', { min: 1, integer: true });
  const stashMax = number(base, 'base', 'stashMax', { min: 1, integer: true });
  number(base, 'base', 'stashRuneSlotFrom', { min: 1, integer: true });
  number(base, 'base', 'stashUpgradeWood', { min: 1, integer: true });
  number(base, 'base', 'stashUpgradeSlots', { min: 1, integer: true });
  number(base, 'base', 'stashRuneSlotCost', { integer: true });
  if (typeof stashStart === 'number' && Number.isFinite(stashStart) && typeof stashMax === 'number' && Number.isFinite(stashMax) && stashMax < stashStart) errors.push('base.stashMax: must be >= base.stashStart');

  const growth = group('growth');
  number(growth, 'growth', 'playerMaxHp', { min: 1, integer: true });
  number(growth, 'growth', 'playerAtk', { integer: true });

  const extraction = group('extraction');
  number(extraction, 'extraction', 'pocketKeepChance', { max: 1 });
  const rewards = group('rewards');
  number(rewards, 'rewards', 'beastLegendaryChance', { max: 1 });
  number(rewards, 'rewards', 'petEggBaseChance', { max: 1 });

  return { ok: errors.length === 0, errors };
}

/** @template T @param {T} value @returns {T} */
function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const validation = validateRuleConfig(DEFAULT_RULE_CONFIG);
if (!validation.ok) throw new TypeError(`Invalid default game rules: ${validation.errors.join('; ')}`);

/** @type {typeof DEFAULT_RULE_CONFIG & {stashRuneSlotFrom?:number,stashRuneSlotCost?:number}} */
const RULE_CONFIG = deepFreeze(DEFAULT_RULE_CONFIG);

export { RULE_CONFIG, validateRuleConfig };
