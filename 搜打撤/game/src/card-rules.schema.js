const BATTLE_KEYS = new Set(['target', 'requirements', 'costModifiers']);
const RULE_KEYS = new Set(['version', 'battle', 'triggers', 'base', 'bag']);
const TARGET_KEYS = new Set(['side', 'area']);
const REQUIREMENT_KEYS = new Set(['kind', 'count', 'type']);
const COST_MODIFIER_KEYS = new Set(['kind', 'type', 'amount']);
const BASE_KEYS = new Set(['material']);
const BASE_MATERIAL_KEYS = new Set(['kind', 'amount']);
const BAG_KEYS = new Set(['use']);
const TRIGGER_KEYS = new Set(['onPlay']);
const ON_PLAY_OPERATION_KEYS = new Set(['op', 'amountField', 'target', 'hitCount', 'retarget', 'status', 'duration', 'count', 'pool', 'costDecayPerTurn']);
const DISCOVER_POOL_KEYS = new Set(['kind', 'cost']);
const SUPPORTED_DAMAGE_TYPES = new Set(['attack', 'spell', 'fixed', 'true']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

function cardLabel(card) {
  return String(card?.id ?? '<missing id>');
}

/**
 * Validate the currently supported card.rules v1 subset.
 *
 * Returns { ok, errors, pending }. Unsupported rule areas are errors; pending
 * remains an empty compatibility field until a deliberately deferred schema
 * is introduced. No DOM or game runtime state is read.
 */
export function validateCardRules(card) {
  const errors = [];
  const pending = [];
  const id = cardLabel(card);
  const error = (path, message) => errors.push({ cardId: id, path, message });
  const rules = card?.rules;

  if (rules === undefined) return { ok: true, errors, pending };
  if (!isRecord(rules)) {
    error('rules', 'expected an object');
    return { ok: false, errors, pending };
  }
  if (!hasOnlyKeys(rules, RULE_KEYS)) error('rules', 'contains an unknown field');
  if (rules.version !== 1) error('rules.version', 'must equal 1');

  if (Object.hasOwn(rules, 'triggers')) {
    const triggers = rules.triggers;
    if (!isRecord(triggers)) {
      error('rules.triggers', 'expected an object');
    } else {
      if (!hasOnlyKeys(triggers, TRIGGER_KEYS)) error('rules.triggers', 'contains an unknown trigger');
      if (Object.hasOwn(triggers, 'onPlay')) {
        if (!Array.isArray(triggers.onPlay)) {
          error('rules.triggers.onPlay', 'expected an operation array');
        } else {
          const operations = triggers.onPlay;
          triggers.onPlay.forEach((operation, index) => {
            const path = `rules.triggers.onPlay[${index}]`;
            if (!isRecord(operation)) {
              error(path, 'expected an operation object');
              return;
            }
            if (!hasOnlyKeys(operation, ON_PLAY_OPERATION_KEYS)) error(path, 'contains an unknown parameter');
            if (!['damage', 'armor', 'heal', 'draw', 'status', 'discover'].includes(operation.op)) {
              error(`${path}.op`, 'unknown onPlay operation');
              return;
            }
            if (operation.op === 'damage') {
              if (operation.amountField !== 'dmg') {
                error(`${path}.amountField`, "must reference card field 'dmg'");
              }
              if (typeof card?.dmg !== 'number' || !Number.isFinite(card.dmg) || (card.dmg < 0 && card.dmgType !== 'attack')) {
                error(`${path}.amountField`, 'card.dmg must be finite; negative attack modifiers require dmgType attack');
              }
              if (!['chosenEnemy', 'allEnemies'].includes(operation.target)) {
                error(`${path}.target`, "must be 'chosenEnemy' or 'allEnemies'");
              }
              if (operation.hitCount !== undefined && (!Number.isInteger(operation.hitCount) || operation.hitCount < 1)) {
                error(`${path}.hitCount`, 'must be a positive integer');
              }
              if (operation.retarget !== undefined && operation.retarget !== 'livingFoes') {
                error(`${path}.retarget`, "must be 'livingFoes'");
              }
              if (operation.retarget === 'livingFoes' && (operation.target !== 'chosenEnemy' || operation.hitCount === undefined)) {
                error(`${path}.retarget`, 'requires chosenEnemy and hitCount');
              }
              for (const field of ['status', 'duration', 'count', 'pool', 'costDecayPerTurn']) {
                if (Object.hasOwn(operation, field)) error(`${path}.${field}`, 'is not accepted for damage operations');
              }
            } else if (operation.op === 'status') {
              if (operation.status !== 'freeze') error(`${path}.status`, "must equal 'freeze'");
              if (operation.target !== 'allEnemies') error(`${path}.target`, "must equal 'allEnemies'");
              if (!Number.isInteger(operation.duration) || operation.duration < 1) {
                error(`${path}.duration`, 'must be a positive integer');
              }
              for (const field of ['amountField', 'hitCount', 'retarget', 'count', 'pool', 'costDecayPerTurn']) {
                if (Object.hasOwn(operation, field)) error(`${path}.${field}`, 'is not accepted for status operations');
              }
            } else if (operation.op === 'discover') {
              if (!Number.isInteger(operation.count) || operation.count < 1) error(`${path}.count`, 'must be a positive integer');
              if (!isRecord(operation.pool) || !hasOnlyKeys(operation.pool, DISCOVER_POOL_KEYS) ||
                  operation.pool.kind !== 'moves' || !Number.isInteger(operation.pool.cost) || operation.pool.cost < 0) {
                error(`${path}.pool`, "must specify { kind: 'moves', cost: nonnegative integer }");
              }
              if (!Number.isInteger(operation.costDecayPerTurn) || operation.costDecayPerTurn < 1) {
                error(`${path}.costDecayPerTurn`, 'must be a positive integer');
              }
              for (const field of ['amountField', 'target', 'hitCount', 'retarget', 'status', 'duration']) {
                if (Object.hasOwn(operation, field)) error(`${path}.${field}`, 'is not accepted for discover operations');
              }
            } else {
              const field = operation.op;
              if (operation.amountField !== field) {
                error(`${path}.amountField`, `must reference card field '${field}'`);
              }
              if (typeof card?.[field] !== 'number' || !Number.isFinite(card[field]) || card[field] <= 0) {
                error(`${path}.amountField`, `card.${field} must be a finite positive number`);
              }
              if (Object.hasOwn(operation, 'target')) {
                error(`${path}.target`, `${operation.op} does not accept a target`);
              }
              for (const field of ['hitCount', 'retarget', 'status', 'duration', 'count', 'pool', 'costDecayPerTurn']) {
                if (Object.hasOwn(operation, field)) error(`${path}.${field}`, `is not accepted for ${operation.op} operations`);
              }
            }
          });
          const damageOperations = operations.filter(operation => isRecord(operation) && operation.op === 'damage');
          const effectOperations = operations.filter(operation => isRecord(operation) && ['heal', 'armor', 'draw'].includes(operation.op));
          const statusOperations = operations.filter(operation => isRecord(operation) && operation.op === 'status');
          if (statusOperations.length && operations.length !== 1) {
            error('rules.triggers.onPlay', 'status operations must be declared alone');
          }
          const discoverOperations = operations.filter(operation => isRecord(operation) && operation.op === 'discover');
          if (discoverOperations.length && operations.length !== 1) {
            error('rules.triggers.onPlay', 'discover operations must be declared alone');
          }
          const operationKinds = new Set();
          operations.forEach((operation, index) => {
            if (!isRecord(operation) || !['heal', 'armor', 'draw'].includes(operation.op)) return;
            if (operationKinds.has(operation.op)) error(`rules.triggers.onPlay[${index}].op`, 'duplicate operation kind is unsupported');
            operationKinds.add(operation.op);
          });
          if (damageOperations.length && effectOperations.length) {
            error('rules.triggers.onPlay', 'damage cannot be combined with heal, armor, or draw');
          }
          const declaredTarget = rules.battle?.target;
          for (const operation of operations) {
            if (!isRecord(operation)) continue;
            if (operation.op === 'damage' && operation.target === 'chosenEnemy') {
              if (declaredTarget?.side !== 'enemy') error('rules.battle.target.side', "chosenEnemy requires side 'enemy'");
              if (declaredTarget?.area !== false) error('rules.battle.target.area', 'chosenEnemy requires area false');
            } else if (operation.op === 'damage' && operation.target === 'allEnemies') {
              if (declaredTarget?.area !== true) error('rules.battle.target.area', 'allEnemies requires area true');
              if (!['enemy', null].includes(declaredTarget?.side)) {
                error('rules.battle.target.side', "allEnemies requires side 'enemy' or null");
              }
            } else if (['heal', 'armor', 'draw'].includes(operation.op)) {
              if (declaredTarget?.side !== 'self') error('rules.battle.target.side', `${operation.op} requires side 'self'`);
              if (declaredTarget?.area !== false) error('rules.battle.target.area', `${operation.op} requires area false`);
            } else if (operation.op === 'status') {
              if (declaredTarget?.side !== null) error('rules.battle.target.side', 'status requires side null');
              if (declaredTarget?.area !== true) error('rules.battle.target.area', 'status requires area true');
            } else if (operation.op === 'discover') {
              if (declaredTarget?.side !== null) error('rules.battle.target.side', 'discover requires side null');
              if (declaredTarget?.area !== false) error('rules.battle.target.area', 'discover requires area false');
            }
          }
          if (damageOperations.length && (!SUPPORTED_DAMAGE_TYPES.has(card?.dmgType) || !['武术', '法术'].includes(card?.type))) {
            error('rules.triggers.onPlay', 'damage requires a supported dmgType and a damage-capable card type');
          }
          if (damageOperations.length) {
            for (const field of ['infuse', 'heal', 'armor', 'draw']) {
              if (card?.[field] !== undefined && Number(card[field]) !== 0) {
                error('rules.triggers.onPlay', `damage-only onPlay cannot preserve card.${field}`);
              }
            }
          }
          if (effectOperations.length) {
            if (card?.dmgType === 'attack') {
              error('rules.triggers.onPlay', 'heal/armor/draw onPlay cannot preserve implicit attack damage');
            }
            for (const field of ['dmg', 'infuse']) {
              if (card?.[field] !== undefined && Number(card[field]) !== 0) {
                error('rules.triggers.onPlay', `heal/armor/draw onPlay cannot preserve card.${field}`);
              }
            }
            for (const field of ['heal', 'armor', 'draw']) {
              if (card?.[field] !== undefined && Number(card[field]) !== 0 && !operationKinds.has(field)) {
                error('rules.triggers.onPlay', `onPlay must declare card.${field}`);
              }
            }
          }
          if (statusOperations.length || discoverOperations.length) {
            for (const field of ['dmg', 'infuse', 'heal', 'armor', 'draw']) {
              if (card?.[field] !== undefined && Number(card[field]) !== 0) {
                error('rules.triggers.onPlay', `${statusOperations.length ? 'status' : 'discover'} onPlay cannot preserve card.${field}`);
              }
            }
          }
        }
      }
    }
  }

  if (Object.hasOwn(rules, 'base')) {
    const base = rules.base;
    if (!isRecord(base)) {
      error('rules.base', 'expected an object');
    } else {
      for (const key of Object.keys(base)) {
        if (!BASE_KEYS.has(key)) error(`rules.base.${key}`, 'unknown base field');
      }
      if (Object.hasOwn(base, 'material')) {
        const material = base.material;
        if (!isRecord(material)) {
          error('rules.base.material', 'expected an object');
        } else {
          for (const key of Object.keys(material)) {
            if (!BASE_MATERIAL_KEYS.has(key)) error(`rules.base.material.${key}`, 'unknown material field');
          }
          if (!['wood', 'rations', 'keys'].includes(material.kind)) {
            error('rules.base.material.kind', 'must be wood, rations, or keys');
          }
          if (!Number.isInteger(material.amount) || material.amount <= 0) {
            error('rules.base.material.amount', 'must be a positive integer');
          }
          if (card?.type !== '资源') {
            error('rules.base.material', "material rules require card.type to equal '资源'");
          }
        }
      }
    }
  }

  if (Object.hasOwn(rules, 'bag')) {
    const bag = rules.bag;
    if (!isRecord(bag)) {
      error('rules.bag', 'expected an object');
    } else {
      if (!hasOnlyKeys(bag, BAG_KEYS)) error('rules.bag', 'contains an unknown field');
      if (!Object.hasOwn(bag, 'use')) {
        error('rules.bag.use', 'is required when rules.bag is declared');
      } else if (!Array.isArray(bag.use)) {
        error('rules.bag.use', 'expected a single-operation array');
      } else if (bag.use.length !== 1) {
        error('rules.bag.use', 'must contain exactly one operation');
      } else {
        const operation = bag.use[0];
        const path = 'rules.bag.use[0]';
        if (!isRecord(operation)) {
          error(path, 'expected an operation object');
        } else if (operation.op === 'heal') {
          if (!hasOnlyKeys(operation, new Set(['op', 'amountField']))) error(path, 'contains an unknown parameter');
          if (operation.amountField !== 'heal') error(`${path}.amountField`, "must reference card field 'heal'");
          if (card?.type !== '道具') error('rules.bag.use', "bag use requires card.type to equal '道具'");
          if (typeof card?.heal !== 'number' || !Number.isFinite(card.heal) || card.heal <= 0) {
            error(`${path}.amountField`, 'card.heal must be a finite positive number');
          }
        } else if (operation.op === 'restoreConsumed') {
          if (!hasOnlyKeys(operation, new Set(['op', 'amount']))) error(path, 'contains an unknown parameter');
          if (card?.type !== '道具') error('rules.bag.use', "bag use requires card.type to equal '道具'");
          if (!Number.isInteger(operation.amount) || operation.amount <= 0) {
            error(`${path}.amount`, 'must be a positive integer');
          }
        } else {
          error(`${path}.op`, 'unknown bag use operation');
        }
      }
    }
  }

  if (rules.battle === undefined) {
    return { ok: errors.length === 0, errors, pending };
  }
  if (!isRecord(rules.battle)) {
    error('rules.battle', 'expected an object');
    return { ok: false, errors, pending };
  }
  const battle = rules.battle;
  if (!hasOnlyKeys(battle, BATTLE_KEYS)) error('rules.battle', 'contains an unknown field');

  if (battle.target !== undefined) {
    const target = battle.target;
    if (!isRecord(target)) {
      error('rules.battle.target', 'expected an object');
    } else {
      if (!hasOnlyKeys(target, TARGET_KEYS)) error('rules.battle.target', 'contains an unknown field');
      if (!['enemy', 'self', null].includes(target.side)) {
        error('rules.battle.target.side', "must be 'enemy', 'self', or null");
      }
      if (typeof target.area !== 'boolean') error('rules.battle.target.area', 'must be a boolean');
    }
  }

  if (battle.requirements !== undefined) {
    if (!Array.isArray(battle.requirements)) {
      error('rules.battle.requirements', 'expected an array');
    } else {
      const seenKinds = new Set();
      battle.requirements.forEach((requirement, index) => {
        const path = `rules.battle.requirements[${index}]`;
        if (!isRecord(requirement)) {
          error(path, 'expected an object');
          return;
        }
        if (Object.hasOwn(requirement, 'amountField')) {
          error(`${path}.amountField`, 'is not supported by the current runtime');
        }
        if (!hasOnlyKeys(requirement, REQUIREMENT_KEYS)) error(path, 'contains an unknown field');
        if (typeof requirement.kind === 'string') {
          if (seenKinds.has(requirement.kind)) error(`${path}.kind`, 'duplicate kind is unsupported');
          seenKinds.add(requirement.kind);
        }
        if (!['unplayable', 'deckOnly', 'handCards'].includes(requirement.kind)) {
          error(`${path}.kind`, 'unknown requirement kind');
          return;
        }
        if (requirement.kind === 'unplayable' || requirement.kind === 'deckOnly') {
          if (Object.keys(requirement).some(key => key !== 'kind')) {
            error(path, `${requirement.kind} does not accept parameters`);
          }
          return;
        }
        if (!Number.isInteger(requirement.count) || requirement.count < 1) {
          error(`${path}.count`, 'must be a positive integer');
        }
        if (requirement.type !== undefined && (typeof requirement.type !== 'string' || !requirement.type.trim())) {
          error(`${path}.type`, 'must be a non-empty string when provided');
        }
      });
    }
  }

  if (battle.costModifiers !== undefined) {
    if (!Array.isArray(battle.costModifiers)) {
      error('rules.battle.costModifiers', 'expected an array');
    } else {
      const seenKinds = new Set();
      battle.costModifiers.forEach((modifier, index) => {
        const path = `rules.battle.costModifiers[${index}]`;
        if (!isRecord(modifier)) {
          error(path, 'expected an object');
          return;
        }
        if (Object.hasOwn(modifier, 'amountField')) {
          error(`${path}.amountField`, 'is not supported by the current runtime');
        }
        if (!hasOnlyKeys(modifier, COST_MODIFIER_KEYS)) error(path, 'contains an unknown field');
        if (typeof modifier.kind === 'string') {
          if (seenKinds.has(modifier.kind)) error(`${path}.kind`, 'duplicate kind is unsupported');
          seenKinds.add(modifier.kind);
        }
        if (!['previousCardTypeFree', 'martialPlayedDiscount', 'armorZeroFree', 'consumedSpellDiscount'].includes(modifier.kind)) {
          error(`${path}.kind`, 'unknown cost modifier kind');
          return;
        }
        if (modifier.kind === 'previousCardTypeFree') {
          if (typeof modifier.type !== 'string' || !modifier.type.trim()) {
            error(`${path}.type`, 'must be a non-empty card type');
          }
          if (modifier.amount !== undefined) error(`${path}.amount`, 'is not accepted for this kind');
          return;
        }
        if (modifier.kind === 'armorZeroFree') {
          if (modifier.type !== undefined || modifier.amount !== undefined) {
            error(path, 'armorZeroFree does not accept parameters');
          }
          return;
        }
        if (modifier.type !== undefined) error(`${path}.type`, 'is not accepted for this kind');
        if (!Number.isInteger(modifier.amount) || modifier.amount < 1) {
          error(`${path}.amount`, 'must be a positive integer');
        }
      });
    }
  }

  return { ok: errors.length === 0, errors, pending };
}
