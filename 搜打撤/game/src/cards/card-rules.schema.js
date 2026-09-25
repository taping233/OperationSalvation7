const BATTLE_KEYS = new Set(['target', 'requirements', 'costModifiers']);
const RULE_KEYS = new Set(['version', 'battle', 'triggers', 'base', 'bag', 'equip']);
const TARGET_KEYS = new Set(['side', 'area']);
const REQUIREMENT_KEYS = new Set(['kind', 'count', 'type']);
const COST_MODIFIER_KEYS = new Set(['kind', 'type', 'amount']);
const BASE_KEYS = new Set(['material']);
const BASE_MATERIAL_KEYS = new Set(['kind', 'amount']);
const BAG_KEYS = new Set(['use']);
// v2（G13 时点触发器）：onPlay 之外新增 5 个时点容器——键位先行（schema 放行），
// 解释器（battle.resolution.js resolveCardSteps）遇到即 throw，防止静默错结算。
const TRIGGER_KEYS = new Set(['onPlay', 'onTurnStart', 'onBattleStart', 'onConsume', 'onDraw', 'onKill']);
// v2 onPlay 全量键白名单（逐键参数校验在各 op 分支内完成）。
const ON_PLAY_OPERATION_KEYS = new Set([
  // v1
  'op', 'amountField', 'target', 'hitCount', 'retarget', 'status', 'duration', 'count', 'pool', 'costDecayPerTurn',
  // v2 —— G1 伤害泛化
  'amount', 'range', 'cond', 'bonus', 'lifesteal', 'graveyard',
  // v2 —— G6 多段与重复
  'hits', 'recast', 'schedule',
  // v2 —— G2 诅咒族
  'curse', 'stacks', 'randomKinds', 'double', 'burst', 'extend',
  // v2 —— G7 生命操作
  'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal',
  // v2 —— G6 防御 / G10 抽牌手牌
  'guard', 'decayAtTurnEnd', 'untilHandN', 'handOps',
  // v2 —— pending 操作族参数（G3/G4/G9/G11/G12/G14）
  'n', 'name', 'atk', 'hp', 'statless', 'taunt', 'cap', 'onKill', 'what', 'into', 'keepInHand', 'rule',
  'key', 'dest', 'act', 'filter',
]);
const DISCOVER_POOL_KEYS = new Set(['kind', 'cost']);
const SUPPORTED_DAMAGE_TYPES = new Set(['attack', 'spell', 'fixed', 'true']);
// v2 —— 各操作族允许键集（白名单内的组合约束在此逐键收口）
const DAMAGE_ALLOWED_KEYS = new Set(['op', 'amountField', 'amount', 'range', 'target', 'hitCount', 'retarget',
  'hits', 'cond', 'bonus', 'lifesteal', 'graveyard', 'recast', 'schedule']);
const CURSE_ALLOWED_KEYS = new Set(['op', 'curse', 'stacks', 'duration', 'target', 'randomKinds', 'double', 'burst', 'extend']);
const HEAL_ALLOWED_KEYS = new Set(['op', 'amountField', 'amount', 'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal']);
const ARMOR_ALLOWED_KEYS = new Set(['op', 'amountField', 'amount', 'guard', 'decayAtTurnEnd']);
const DRAW_ALLOWED_KEYS = new Set(['op', 'amountField', 'amount', 'untilHandN', 'handOps']);
const STATUS_ALLOWED_KEYS = new Set(['op', 'status', 'target', 'duration']);
const DISCOVER_ALLOWED_KEYS = new Set(['op', 'count', 'pool', 'costDecayPerTurn']);
// v2 —— G2 诅咒枚举（与 combat.js CURSES / CURSE_META 对齐）
const CURSE_KEYS = new Set(['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn']);
const STACKING_CURSE_KEYS = new Set(['bleed', 'poison']);
const CONDITION_KEYS = new Set(['foeHpBelow', 'foeHpHalf', 'foeStatus', 'foeFullHp']);
const DAMAGE_TARGET_KEYS = new Set(['chosenEnemy', 'allEnemies', 'randomEnemy']);
const CURSE_TARGET_KEYS = new Set(['chosenEnemy', 'allEnemies', 'randomEnemy', 'self']);
// v2 —— 键位已定的操作族（schema 放行 + 逐键校验）。解释器进度：acquire/blessing/
// energy/energyCap/maxHp/deckCap/coins 已接线（A3 G3/G4 批，battle.resolution.js）；
// execute/summon/transform/registerRule/extraTurn 仍 pending throw（后续批）。
// 集合名保留 PENDING_ 前缀为兼容（路由到 validatePendingOperation 的键校验分支）。
const PENDING_ONPLAY_OPS = new Set(['acquire', 'blessing', 'energy', 'energyCap', 'maxHp', 'deckCap',
  'execute', 'summon', 'transform', 'registerRule', 'extraTurn', 'coins']);
const PENDING_OP_ALLOWED_KEYS = new Map([
  ['acquire', new Set(['op', 'n', 'pool', 'dest', 'act', 'filter'])],
  ['blessing', new Set(['op', 'key', 'stacks', 'duration'])],
  ['energy', new Set(['op', 'n'])],
  ['energyCap', new Set(['op', 'n'])],
  ['maxHp', new Set(['op', 'n'])],
  ['deckCap', new Set(['op', 'n'])],
  ['execute', new Set(['op', 'cap', 'count', 'onKill'])],
  ['summon', new Set(['op', 'name', 'atk', 'hp', 'count', 'statless', 'taunt'])],
  ['transform', new Set(['op', 'what', 'into', 'cost', 'keepInHand'])],
  ['registerRule', new Set(['op', 'rule'])],
  ['extraTurn', new Set(['op'])],
  ['coins', new Set(['op', 'n'])],
]);
const BLESSING_KEYS = new Set(['atkUp', 'spellUp', 'stealth', 'immune', 'dodge', 'reduce']);
const REGISTER_RULE_KEYS = new Set(['consumeFireball', 'allSpellsInfused', 'growth']);
const HAND_OP_KEYS = new Set(['consumeHand', 'dumpHand', 'copyRandom', 'keepInHand', 'noInfuse']);
// v2 —— G5 装备域（键位设计先行，全部 pending；消费点在 battle.equipment.js，A3 B9 落地）
const EQUIP_KEYS = new Set(['onEquip', 'passive', 'battleStart', 'skill', 'container']);
const EQUIP_PASSIVE_KEYS = new Set(['aura', 'cond']);
const EQUIP_AURA_KEYS = new Set(['atk', 'spellPower']);
const EQUIP_COND_KEYS = new Set(['hasCurse', 'vsFreeze']);
const EQUIP_SKILL_KEYS = new Set(['oncePerBattle', 'ops']);
const EQUIP_CONTAINER_KEYS = new Set(['slots', 'accepts']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

function isPositiveInteger(value) {
  return Number.isInteger(value) && value >= 1;
}

function isNonnegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function isRangePair(value) {
  return Array.isArray(value) && value.length === 2 &&
    isNonnegativeInteger(value[0]) && isNonnegativeInteger(value[1]) && value[0] <= value[1];
}

function cardLabel(card) {
  return String(card?.id ?? '<missing id>');
}

// v2 —— 条件对象（damage.cond / bonus.if 共用形状）：键集与取值逐键校验
function validateCondition(record, path, error) {
  if (!isRecord(record) || !hasOnlyKeys(record, CONDITION_KEYS) || Object.keys(record).length === 0) {
    error(path, "must be a non-empty object with keys among 'foeHpBelow', 'foeHpHalf', 'foeStatus', 'foeFullHp'");
    return;
  }
  if (record.foeHpBelow !== undefined && !isPositiveInteger(record.foeHpBelow)) {
    error(`${path}.foeHpBelow`, 'must be a positive integer');
  }
  if (record.foeHpHalf !== undefined && record.foeHpHalf !== true) {
    error(`${path}.foeHpHalf`, 'must equal true when provided');
  }
  if (record.foeFullHp !== undefined && record.foeFullHp !== true) {
    error(`${path}.foeFullHp`, 'must equal true when provided');
  }
  if (record.foeStatus !== undefined && !CURSE_KEYS.has(record.foeStatus)) {
    error(`${path}.foeStatus`, "must be one of 'bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'");
  }
}

function validateDamageOperation(operation, card, path, error) {
  for (const key of Object.keys(operation)) {
    if (!DAMAGE_ALLOWED_KEYS.has(key)) error(`${path}.${key}`, 'is not accepted for damage operations');
  }
  const sources = ['amountField', 'amount', 'range'].filter(field => operation[field] !== undefined);
  if (sources.length !== 1) {
    error(path, "must specify exactly one damage source among 'amountField', 'amount', 'range'");
  }
  if (operation.amountField !== undefined) {
    if (operation.amountField !== 'dmg') {
      error(`${path}.amountField`, "must reference card field 'dmg'");
    }
    if (typeof card?.dmg !== 'number' || !Number.isFinite(card.dmg) || (card.dmg < 0 && card.dmgType !== 'attack')) {
      error(`${path}.amountField`, 'card.dmg must be finite; negative attack modifiers require dmgType attack');
    }
  }
  if (operation.amount !== undefined) {
    if (!isPositiveInteger(operation.amount)) {
      error(`${path}.amount`, 'must be a positive integer');
    } else if (typeof card?.dmg === 'number' && Number.isFinite(card.dmg) && Number(card.dmg) !== operation.amount) {
      error(`${path}.amount`, `must equal card.dmg (${card.dmg}) when the field is declared, so battle preview stays truthful`);
    }
  }
  if (operation.range !== undefined) {
    if (!isRangePair(operation.range)) {
      error(`${path}.range`, 'must be a two-element [min, max] pair of nonnegative integers with min <= max');
    } else if (typeof card?.dmg === 'number' && Number.isFinite(card.dmg) &&
        (card.dmg < operation.range[0] || card.dmg > operation.range[1])) {
      error(`${path}.range`, `must contain card.dmg (${card.dmg}) when the field is declared, so battle preview stays truthful`);
    }
  }
  if (operation.target !== undefined && !DAMAGE_TARGET_KEYS.has(operation.target)) {
    error(`${path}.target`, "must be 'chosenEnemy', 'allEnemies', or 'randomEnemy'");
  }
  const hasScalarHitCount = operation.hitCount !== undefined;
  const hasHits = operation.hits !== undefined;
  if (hasScalarHitCount && hasHits) {
    error(`${path}.hits`, "cannot be combined with the v1 scalar 'hitCount'");
  }
  if (hasScalarHitCount && (!Number.isInteger(operation.hitCount) || operation.hitCount < 1)) {
    error(`${path}.hitCount`, 'must be a positive integer');
  }
  if (hasHits) {
    if (!isRecord(operation.hits) || !hasOnlyKeys(operation.hits, new Set(['count', 'range', 'perFoe'])) ||
        ['count', 'range', 'perFoe'].filter(key => operation.hits[key] !== undefined).length !== 1) {
      error(`${path}.hits`, "must specify exactly one of 'count', 'range', 'perFoe'");
    } else {
      if (operation.hits.count !== undefined && !isPositiveInteger(operation.hits.count)) {
        error(`${path}.hits.count`, 'must be a positive integer');
      }
      if (operation.hits.range !== undefined && !isRangePair(operation.hits.range)) {
        error(`${path}.hits.range`, 'must be a two-element [min, max] pair of nonnegative integers with min <= max');
      }
      // perFoe（每人释放一次）语义落在 B2 后续批次，schema 先放行、解释器 throw
    }
  }
  if (operation.retarget !== undefined && operation.retarget !== 'livingFoes') {
    error(`${path}.retarget`, "must be 'livingFoes'");
  }
  if (operation.retarget === 'livingFoes') {
    const countSource = operation.hitCount ?? operation.hits?.count;
    if (operation.target !== 'chosenEnemy' || countSource === undefined) {
      error(`${path}.retarget`, 'requires chosenEnemy and a hit count (hitCount or hits.count)');
    }
  }
  if (operation.cond !== undefined) validateCondition(operation.cond, `${path}.cond`, error);
  if (operation.bonus !== undefined) {
    const bonus = operation.bonus;
    if (!isRecord(bonus) || !hasOnlyKeys(bonus, new Set(['amount', 'pct', 'if']))) {
      error(`${path}.bonus`, "must be an object with keys among 'amount', 'pct', 'if'");
    } else {
      const bonusSources = ['amount', 'pct'].filter(field => bonus[field] !== undefined);
      if (bonusSources.length !== 1) {
        error(`${path}.bonus`, "must specify exactly one of 'amount' (flat) or 'pct' (percent)");
      }
      if (bonus.amount !== undefined && !isPositiveInteger(bonus.amount)) {
        error(`${path}.bonus.amount`, 'must be a positive integer');
      }
      if (bonus.pct !== undefined && !isPositiveInteger(bonus.pct)) {
        error(`${path}.bonus.pct`, 'must be a positive integer percent');
      }
      if (bonus.if !== undefined) validateCondition(bonus.if, `${path}.bonus.if`, error);
    }
  }
  if (operation.lifesteal !== undefined && operation.lifesteal !== true) {
    error(`${path}.lifesteal`, 'must equal true when provided');
  }
  if (operation.graveyard !== undefined) {
    const grave = operation.graveyard;
    if (!isRecord(grave) || !hasOnlyKeys(grave, new Set(['type', 'perCard'])) ||
        !['武术', '法术', '装备', '道具', '资源'].includes(grave.type) ||
        !isPositiveInteger(grave.perCard)) {
      error(`${path}.graveyard`, "must specify { type: '武术'|'法术'|'装备'|'道具'|'资源', perCard: positive integer }");
    }
  }
  if (operation.recast !== undefined) {
    const recast = operation.recast;
    if (!isRecord(recast) || !hasOnlyKeys(recast, new Set(['on', 'times'])) ||
        recast.on !== 'kill' || !isPositiveInteger(recast.times)) {
      error(`${path}.recast`, "must specify { on: 'kill', times: positive integer }");
    }
  }
  if (operation.schedule !== undefined && operation.schedule !== 'nextTurn') {
    error(`${path}.schedule`, "must equal 'nextTurn'");
  }
}

function validateCurseOperation(operation, path, error) {
  for (const key of Object.keys(operation)) {
    if (!CURSE_ALLOWED_KEYS.has(key)) error(`${path}.${key}`, 'is not accepted for curse operations');
  }
  const hasCurseKey = operation.curse !== undefined;
  const hasRandomKinds = operation.randomKinds !== undefined;
  if (hasCurseKey === hasRandomKinds) {
    error(path, "must specify exactly one of 'curse' (named curse) or 'randomKinds' (random curse kinds)");
  }
  if (hasCurseKey) {
    if (!CURSE_KEYS.has(operation.curse)) {
      error(`${path}.curse`, "must be one of 'bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'burn'");
    } else if (STACKING_CURSE_KEYS.has(operation.curse)) {
      if (!isPositiveInteger(operation.stacks)) {
        error(`${path}.stacks`, 'must be a positive integer for stacking curses (bleed/poison)');
      }
      if (operation.duration !== undefined) {
        error(`${path}.duration`, 'is not accepted for stacking curses (bleed/poison) — declare stacks instead');
      }
    } else if (!isPositiveInteger(operation.duration)) {
      error(`${path}.duration`, 'must be a positive integer for timed curses');
    } else if (operation.stacks !== undefined) {
      error(`${path}.stacks`, 'is not accepted for timed curses — declare duration instead');
    }
  }
  if (hasRandomKinds) {
    if (!isPositiveInteger(operation.randomKinds)) {
      error(`${path}.randomKinds`, 'must be a positive integer');
    }
    if (operation.stacks !== undefined || operation.duration !== undefined) {
      error(`${path}.stacks`, 'randomKinds applies one stack of each drawn kind; stacks/duration are not accepted');
    }
  }
  if (!CURSE_TARGET_KEYS.has(operation.target)) {
    error(`${path}.target`, "must be 'chosenEnemy', 'allEnemies', 'randomEnemy', or 'self'");
  }
  if (operation.double !== undefined && operation.double !== true) {
    error(`${path}.double`, 'must equal true when provided');
  }
  if (operation.burst !== undefined && !isPositiveInteger(operation.burst)) {
    error(`${path}.burst`, 'must be a positive integer');
  }
  if (operation.extend !== undefined && !isPositiveInteger(operation.extend)) {
    error(`${path}.extend`, 'must be a positive integer');
  }
}

function validateEffectOperation(operation, card, path, op, error) {
  const allowed = op === 'heal' ? HEAL_ALLOWED_KEYS : op === 'armor' ? ARMOR_ALLOWED_KEYS : DRAW_ALLOWED_KEYS;
  for (const key of Object.keys(operation)) {
    if (!allowed.has(key)) error(`${path}.${key}`, `is not accepted for ${op} operations`);
  }
  if (op === 'heal') {
    const sources = ['amountField', 'amount', 'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal']
      .filter(field => operation[field] !== undefined);
    if (sources.length !== 1) {
      error(path, "must specify exactly one source among 'amountField', 'amount', 'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal'");
    }
    if (operation.amountField !== undefined) {
      if (operation.amountField !== 'heal') {
        error(`${path}.amountField`, "must reference card field 'heal'");
      }
      if (typeof card?.heal !== 'number' || !Number.isFinite(card.heal) || card.heal <= 0) {
        error(`${path}.amountField`, 'card.heal must be a finite positive number');
      }
    }
    if (operation.amount !== undefined) {
      if (!isPositiveInteger(operation.amount)) {
        error(`${path}.amount`, 'must be a positive integer');
      } else if (typeof card?.heal === 'number' && Number.isFinite(card.heal) && Number(card.heal) !== operation.amount) {
        error(`${path}.amount`, `must equal card.heal (${card.heal}) when the field is declared`);
      }
    }
    if (operation.upTo !== undefined && !isPositiveInteger(operation.upTo)) {
      error(`${path}.upTo`, 'must be a positive integer');
    }
    if (operation.selfDamage !== undefined && !isPositiveInteger(operation.selfDamage)) {
      error(`${path}.selfDamage`, 'must be a positive integer');
    }
    if (operation.perFuelCost !== undefined && !isPositiveInteger(operation.perFuelCost)) {
      error(`${path}.perFuelCost`, 'must be a positive integer');
    }
    if (operation.perSpellHeal !== undefined && !isPositiveInteger(operation.perSpellHeal)) {
      error(`${path}.perSpellHeal`, 'must be a positive integer');
    }
    return;
  }
  if (op === 'armor') {
    const sources = ['amountField', 'amount'].filter(field => operation[field] !== undefined);
    if (sources.length > 1) {
      error(path, "must specify at most one of 'amountField', 'amount'");
    }
    if (sources.length === 0 && operation.guard === undefined) {
      error(path, "must declare an amount (amountField/amount) or guard: true");
    }
    if (operation.amountField !== undefined) {
      if (operation.amountField !== 'armor') {
        error(`${path}.amountField`, "must reference card field 'armor'");
      }
      if (typeof card?.armor !== 'number' || !Number.isFinite(card.armor) || card.armor <= 0) {
        error(`${path}.amountField`, 'card.armor must be a finite positive number');
      }
    }
    if (operation.amount !== undefined) {
      if (!isPositiveInteger(operation.amount)) {
        error(`${path}.amount`, 'must be a positive integer');
      } else if (typeof card?.armor === 'number' && Number.isFinite(card.armor) && Number(card.armor) !== operation.amount) {
        error(`${path}.amount`, `must equal card.armor (${card.armor}) when the field is declared`);
      }
    }
    if (operation.guard !== undefined && operation.guard !== true) {
      error(`${path}.guard`, 'must equal true when provided');
    }
    if (operation.decayAtTurnEnd !== undefined && !isPositiveInteger(operation.decayAtTurnEnd)) {
      error(`${path}.decayAtTurnEnd`, 'must be a positive integer');
    }
    return;
  }
  // draw
  const sources = ['amountField', 'amount', 'untilHandN'].filter(field => operation[field] !== undefined);
  if (sources.length !== 1) {
    error(path, "must specify exactly one source among 'amountField', 'amount', 'untilHandN'");
  }
  if (operation.amountField !== undefined) {
    if (operation.amountField !== 'draw') {
      error(`${path}.amountField`, "must reference card field 'draw'");
    }
    if (typeof card?.draw !== 'number' || !Number.isFinite(card.draw) || card.draw <= 0) {
      error(`${path}.amountField`, 'card.draw must be a finite positive number');
    }
  }
  if (operation.amount !== undefined) {
    if (!isPositiveInteger(operation.amount)) {
      error(`${path}.amount`, 'must be a positive integer');
    } else if (typeof card?.draw === 'number' && Number.isFinite(card.draw) && Number(card.draw) !== operation.amount) {
      error(`${path}.amount`, `must equal card.draw (${card.draw}) when the field is declared`);
    }
  }
  if (operation.untilHandN !== undefined && !isPositiveInteger(operation.untilHandN)) {
    error(`${path}.untilHandN`, 'must be a positive integer');
  }
  if (operation.handOps !== undefined) {
    const handOps = operation.handOps;
    if (!Array.isArray(handOps) || handOps.length === 0 ||
        !handOps.every(entry => isRecord(entry) && HAND_OP_KEYS.has(entry.op))) {
      error(`${path}.handOps`, `must be a non-empty array of { op } objects with op among ${[...HAND_OP_KEYS].map(k => `'${k}'`).join(', ')}`);
    }
  }
}

function validatePendingOperation(operation, path, op, error) {
  const allowed = PENDING_OP_ALLOWED_KEYS.get(op);
  for (const key of Object.keys(operation)) {
    if (!allowed.has(key)) error(`${path}.${key}`, `is not accepted for ${op} operations`);
  }
  if (op === 'acquire') {
    if (!isPositiveInteger(operation.n)) error(`${path}.n`, 'must be a positive integer');
    if (!isRecord(operation.pool) || typeof operation.pool.kind !== 'string' || !operation.pool.kind.trim()) {
      error(`${path}.pool`, "must be an object with a non-empty 'kind' string");
    }
    if (operation.dest !== undefined && !['hand', 'deck', 'discover'].includes(operation.dest)) {
      error(`${path}.dest`, "must be 'hand', 'deck', or 'discover'");
    }
    if (operation.act !== undefined && !['play', 'playKeep', 'dup', 'zeroCost', 'decay', 'noInfuse'].includes(operation.act)) {
      error(`${path}.act`, "must be 'play', 'playKeep', 'dup', 'zeroCost', 'decay', or 'noInfuse'");
    }
    if (operation.filter !== undefined && !isRecord(operation.filter)) {
      error(`${path}.filter`, 'must be an object when provided');
    }
    return;
  }
  if (op === 'blessing') {
    if (!BLESSING_KEYS.has(operation.key)) {
      error(`${path}.key`, "must be one of 'atkUp', 'spellUp', 'stealth', 'immune', 'dodge', 'reduce'");
    }
    if (operation.stacks !== undefined && !isPositiveInteger(operation.stacks)) {
      error(`${path}.stacks`, 'must be a positive integer');
    }
    if (operation.duration !== undefined && !isPositiveInteger(operation.duration)) {
      error(`${path}.duration`, 'must be a positive integer');
    }
    return;
  }
  if (['energy', 'energyCap', 'maxHp', 'deckCap', 'coins'].includes(op)) {
    if (!isPositiveInteger(operation.n)) error(`${path}.n`, 'must be a positive integer');
    return;
  }
  if (op === 'execute') {
    if (operation.cap !== undefined) {
      const cap = operation.cap;
      if (!isRecord(cap) || !hasOnlyKeys(cap, new Set(['atk', 'maxHpBelow'])) || Object.keys(cap).length === 0 ||
          (cap.atk !== undefined && !isPositiveInteger(cap.atk)) ||
          (cap.maxHpBelow !== undefined && !isPositiveInteger(cap.maxHpBelow))) {
        error(`${path}.cap`, "must be a non-empty object with positive integer 'atk' and/or 'maxHpBelow'");
      }
    }
    if (operation.count !== undefined && !isPositiveInteger(operation.count)) {
      error(`${path}.count`, 'must be a positive integer');
    }
    if (operation.onKill !== undefined && !isRecord(operation.onKill)) {
      error(`${path}.onKill`, 'must be an object when provided');
    }
    return;
  }
  if (op === 'summon') {
    if (typeof operation.name !== 'string' || !operation.name.trim()) {
      error(`${path}.name`, 'must be a non-empty string');
    }
    if (!isPositiveInteger(operation.count)) error(`${path}.count`, 'must be a positive integer');
    if (operation.atk !== undefined && !isNonnegativeInteger(operation.atk)) {
      error(`${path}.atk`, 'must be a nonnegative integer');
    }
    if (operation.hp !== undefined && !isPositiveInteger(operation.hp)) {
      error(`${path}.hp`, 'must be a positive integer');
    }
    if (operation.statless !== undefined && operation.statless !== true) {
      error(`${path}.statless`, 'must equal true when provided');
    }
    if (operation.taunt !== undefined && operation.taunt !== true) {
      error(`${path}.taunt`, 'must equal true when provided');
    }
    return;
  }
  if (op === 'transform') {
    if (!['sha', 'self', 'handCard'].includes(operation.what)) {
      error(`${path}.what`, "must be 'sha', 'self', or 'handCard'");
    }
    if (operation.into !== undefined && !isRecord(operation.into)) {
      error(`${path}.into`, 'must be an object when provided');
    }
    if (operation.cost !== undefined && !isNonnegativeInteger(operation.cost)) {
      error(`${path}.cost`, 'must be a nonnegative integer');
    }
    if (operation.keepInHand !== undefined && operation.keepInHand !== true) {
      error(`${path}.keepInHand`, 'must equal true when provided');
    }
    return;
  }
  if (op === 'registerRule') {
    if (!REGISTER_RULE_KEYS.has(operation.rule)) {
      error(`${path}.rule`, "must be one of 'consumeFireball', 'allSpellsInfused', 'growth'");
    }
  }
}

function validateOperation(operation, card, path, error) {
  if (!isRecord(operation)) {
    error(path, 'expected an operation object');
    return;
  }
  if (!hasOnlyKeys(operation, ON_PLAY_OPERATION_KEYS)) error(path, 'contains an unknown parameter');
  if (typeof operation.op !== 'string' ||
      (!['damage', 'armor', 'heal', 'draw', 'status', 'discover', 'curse'].includes(operation.op) &&
        !PENDING_ONPLAY_OPS.has(operation.op))) {
    error(`${path}.op`, 'unknown onPlay operation');
    return;
  }
  if (operation.op === 'damage') validateDamageOperation(operation, card, path, error);
  else if (operation.op === 'curse') validateCurseOperation(operation, path, error);
  else if (operation.op === 'status') {
    for (const key of Object.keys(operation)) {
      if (!STATUS_ALLOWED_KEYS.has(key)) error(`${path}.${key}`, 'is not accepted for status operations');
    }
    if (operation.status !== 'freeze') error(`${path}.status`, "must equal 'freeze'");
    if (operation.target !== 'allEnemies') error(`${path}.target`, "must equal 'allEnemies'");
    if (!Number.isInteger(operation.duration) || operation.duration < 1) {
      error(`${path}.duration`, 'must be a positive integer');
    }
  } else if (operation.op === 'discover') {
    for (const key of Object.keys(operation)) {
      if (!DISCOVER_ALLOWED_KEYS.has(key)) error(`${path}.${key}`, 'is not accepted for discover operations');
    }
    if (!Number.isInteger(operation.count) || operation.count < 1) error(`${path}.count`, 'must be a positive integer');
    if (!isRecord(operation.pool) || !hasOnlyKeys(operation.pool, DISCOVER_POOL_KEYS) ||
        operation.pool.kind !== 'moves' || !Number.isInteger(operation.pool.cost) || operation.pool.cost < 0) {
      error(`${path}.pool`, "must specify { kind: 'moves', cost: nonnegative integer }");
    }
    if (!Number.isInteger(operation.costDecayPerTurn) || operation.costDecayPerTurn < 1) {
      error(`${path}.costDecayPerTurn`, 'must be a positive integer');
    }
  } else if (PENDING_ONPLAY_OPS.has(operation.op)) {
    validatePendingOperation(operation, path, operation.op, error);
  } else {
    validateEffectOperation(operation, card, path, operation.op, error);
  }
}

// v2 —— 装备域（G5）形状校验：键位先行，全部 pending，解释器遇到即 throw
function validateOperationArray(operations, card, path, error) {
  if (!Array.isArray(operations)) {
    error(path, 'expected an operation array');
    return;
  }
  operations.forEach((operation, index) => validateOperation(operation, card, `${path}[${index}]`, error));
}

function validateEquipRules(equip, card, error) {
  if (!isRecord(equip) || !hasOnlyKeys(equip, EQUIP_KEYS) || Object.keys(equip).length === 0) {
    error('rules.equip', `expected a non-empty object with fields among ${[...EQUIP_KEYS].map(k => `'${k}'`).join(', ')}`);
    return;
  }
  if (equip.onEquip !== undefined) validateOperationArray(equip.onEquip, card, 'rules.equip.onEquip', error);
  if (equip.battleStart !== undefined) validateOperationArray(equip.battleStart, card, 'rules.equip.battleStart', error);
  if (equip.passive !== undefined) {
    const passive = equip.passive;
    if (!isRecord(passive) || !hasOnlyKeys(passive, EQUIP_PASSIVE_KEYS) || Object.keys(passive).length === 0) {
      error('rules.equip.passive', "expected a non-empty object with fields among 'aura', 'cond'");
    } else {
      if (passive.aura !== undefined) {
        const aura = passive.aura;
        if (!isRecord(aura) || !hasOnlyKeys(aura, EQUIP_AURA_KEYS) || Object.keys(aura).length === 0 ||
            (aura.atk !== undefined && !Number.isInteger(aura.atk)) ||
            (aura.spellPower !== undefined && !Number.isInteger(aura.spellPower))) {
          error('rules.equip.passive.aura', "must be a non-empty object with integer 'atk' and/or 'spellPower'");
        }
      }
      if (passive.cond !== undefined) {
        const cond = passive.cond;
        if (!isRecord(cond) || !hasOnlyKeys(cond, EQUIP_COND_KEYS) || Object.keys(cond).length === 0 ||
            (cond.hasCurse !== undefined && cond.hasCurse !== true) ||
            (cond.vsFreeze !== undefined && cond.vsFreeze !== true)) {
          error('rules.equip.passive.cond', "must be a non-empty object with 'hasCurse: true' and/or 'vsFreeze: true'");
        }
      }
    }
  }
  if (equip.skill !== undefined) {
    const skill = equip.skill;
    if (!isRecord(skill) || !hasOnlyKeys(skill, EQUIP_SKILL_KEYS) || !Array.isArray(skill.ops)) {
      error('rules.equip.skill', "expected an object with an 'ops' operation array (optional 'oncePerBattle')");
    } else {
      if (skill.oncePerBattle !== undefined && skill.oncePerBattle !== true) {
        error('rules.equip.skill.oncePerBattle', 'must equal true when provided');
      }
      validateOperationArray(skill.ops, card, 'rules.equip.skill.ops', error);
    }
  }
  if (equip.container !== undefined) {
    const container = equip.container;
    if (!isRecord(container) || !hasOnlyKeys(container, EQUIP_CONTAINER_KEYS) ||
        !isPositiveInteger(container.slots)) {
      error('rules.equip.container', "must specify { slots: positive integer } (optional 'accepts' string)");
    } else if (container.accepts !== undefined && (typeof container.accepts !== 'string' || !container.accepts.trim())) {
      error('rules.equip.container.accepts', 'must be a non-empty string when provided');
    }
  }
}

/**
 * Validate card.rules against the v2 merged schema.
 *
 * v2 是 v1 的严格增量超集：v1 键集与校验语义原样保留（既有 21 张 v1 卡数据全部继续通过），
 * 新增键位逐键进白名单并做参数校验。`rules.version` 仍必须等于 1——v2 以「合并校验器 +
 * 解释器 pending 守卫」承担兼容，版本字段留给未来破坏性 v3（取舍见设计文档）。
 * 键位已定的操作族在校验层放行并逐键校验；解释器接线进度随 A3 各批次推进
 * （已接线的在 battle.resolution.js，仍 pending 的遇卡即 throw 防静默错结算）。
 * Returns { ok, errors, pending }. No DOM or game runtime state is read.
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
      for (const triggerKey of Object.keys(triggers)) {
        if (triggerKey !== 'onPlay') {
          // G13 时点触发器：op 形状先校验，运行时由 resolveCardSteps 守卫（pending throw）
          validateOperationArray(triggers[triggerKey], card, `rules.triggers.${triggerKey}`, error);
        }
      }
      if (Object.hasOwn(triggers, 'onPlay')) {
        if (!Array.isArray(triggers.onPlay)) {
          error('rules.triggers.onPlay', 'expected an operation array');
        } else {
          const operations = triggers.onPlay;
          operations.forEach((operation, index) => {
            validateOperation(operation, card, `rules.triggers.onPlay[${index}]`, error);
          });
          const damageOperations = operations.filter(operation => isRecord(operation) && operation.op === 'damage');
          const effectOperations = operations.filter(operation => isRecord(operation) && ['heal', 'armor', 'draw'].includes(operation.op));
          const statusOperations = operations.filter(operation => isRecord(operation) && operation.op === 'status');
          const discoverOperations = operations.filter(operation => isRecord(operation) && operation.op === 'discover');
          const curseOperations = operations.filter(operation => isRecord(operation) && operation.op === 'curse');
          const pendingOperations = operations.filter(operation => isRecord(operation) && PENDING_ONPLAY_OPS.has(operation.op));
          // v1 契约保留：status / discover 仍必须单独声明（泛化由 curse / acquire 承接）
          if (statusOperations.length && operations.length !== 1) {
            error('rules.triggers.onPlay', 'status operations must be declared alone');
          }
          if (discoverOperations.length && operations.length !== 1) {
            error('rules.triggers.onPlay', 'discover operations must be declared alone');
          }
          // 重复 op 检查（v1 保留 + curse 同名去重）
          const operationKinds = new Set();
          const curseKinds = new Set();
          operations.forEach((operation, index) => {
            if (!isRecord(operation)) return;
            if (['heal', 'armor', 'draw'].includes(operation.op)) {
              if (operationKinds.has(operation.op)) error(`rules.triggers.onPlay[${index}].op`, 'duplicate operation kind is unsupported');
              operationKinds.add(operation.op);
            }
            if (operation.op === 'curse' && operation.curse !== undefined) {
              if (curseKinds.has(operation.curse)) error(`rules.triggers.onPlay[${index}].curse`, 'duplicate curse kind is unsupported');
              curseKinds.add(operation.curse);
            }
          });
          // v1 契约保留：amountField 锚定的效果操作不与 damage 混排；
          // v2 字面量效果操作（amount/upTo/selfDamage/guard/untilHandN）解除该限制。
          const fieldAnchoredEffectOps = effectOperations.filter(operation => operation.amountField !== undefined);
          if (damageOperations.length && fieldAnchoredEffectOps.length) {
            error('rules.triggers.onPlay', 'damage cannot be combined with heal, armor, or draw');
          }
          if (fieldAnchoredEffectOps.length && (curseOperations.length || pendingOperations.length)) {
            error('rules.triggers.onPlay', 'field-anchored heal/armor/draw cannot be combined with v2 operations');
          }
          // —— 卡面字段一致性 ——
          // 注能字段在任何结构化 onPlay 中都不允许保留（v1 约定延续：注能门由描述句承担）
          if (card?.infuse !== undefined && Number(card.infuse) !== 0) {
            error('rules.triggers.onPlay', 'onPlay cannot preserve card.infuse');
          }
          const declaresField = (op, field) => operations.some(operation => isRecord(operation) && operation.op === op &&
            (operation.amountField === field ||
              (operation.amount !== undefined && typeof card?.[field] === 'number' && Number(card[field]) === operation.amount)));
          for (const field of ['heal', 'armor', 'draw']) {
            if (card?.[field] !== undefined && Number(card[field]) !== 0 && !declaresField(field, field)) {
              error('rules.triggers.onPlay', `onPlay must declare card.${field}`);
            }
          }
          if (!damageOperations.length && card?.dmg !== undefined && Number(card.dmg) !== 0) {
            error('rules.triggers.onPlay', 'onPlay without a damage operation cannot preserve card.dmg');
          }
          if (!damageOperations.length && card?.dmgType === 'attack' &&
              (effectOperations.length || curseOperations.length || pendingOperations.length)) {
            error('rules.triggers.onPlay', 'heal/armor/draw onPlay cannot preserve implicit attack damage');
          }
          if (damageOperations.length &&
              (!SUPPORTED_DAMAGE_TYPES.has(card?.dmgType) || !['武术', '法术'].includes(card?.type))) {
            error('rules.triggers.onPlay', 'damage requires a supported dmgType and a damage-capable card type');
          }
          // —— battle.target 交叉契约（v1 保留 + curse / randomEnemy 扩展）——
          const declaredTarget = rules.battle?.target;
          for (const operation of operations) {
            if (!isRecord(operation)) continue;
            if (operation.op === 'damage' || operation.op === 'curse') {
              const operationTarget = operation.target;
              if (operationTarget === 'chosenEnemy' || operationTarget === 'randomEnemy') {
                if (declaredTarget?.side !== 'enemy') error('rules.battle.target.side', `${operationTarget} requires side 'enemy'`);
                if (declaredTarget?.area !== false) error('rules.battle.target.area', `${operationTarget} requires area false`);
              } else if (operationTarget === 'allEnemies') {
                if (declaredTarget?.area !== true) error('rules.battle.target.area', 'allEnemies requires area true');
                if (!['enemy', null].includes(declaredTarget?.side)) {
                  error('rules.battle.target.side', "allEnemies requires side 'enemy' or null");
                }
              } else if (operationTarget === 'self') {
                if (declaredTarget?.side !== 'self') error('rules.battle.target.side', 'self requires side self');
                if (declaredTarget?.area !== false) error('rules.battle.target.area', 'self requires area false');
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
        }
      }
    }
  }

  if (Object.hasOwn(rules, 'equip')) {
    validateEquipRules(rules.equip, card, error);
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
        // G8 扩充种类（typeCostRule / movesPlayedDiscount / handMorphZeroFee）按设计文档仅做键位设计，
        // 本波不进白名单：消费点 battle.card-cost.js 不在本波属地内，放行会造成静默不生效。
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
