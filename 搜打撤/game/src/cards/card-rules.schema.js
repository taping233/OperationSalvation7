import { SELF_EFFECT_DEFINITIONS } from './card-healing-program.js';
import { BATTLE_TRIGGER_POINTS } from './card-trigger-contract.js';
import { isSemanticOperation, validateSemanticOperation } from './card-semantic-contract.js';
import { createCardRuleExecutionView } from './card-execution-plan.js';

// M3：keepInHand——打出后回手（不朽斩「永远被保留在手牌中」，exec-play 保留通道结构化）
const BATTLE_KEYS = new Set(['target', 'requirements', 'costModifiers', 'keepInHand', 'fuelAllowed', 'ignoresSilence', 'ownedEquipCapacity', 'setup', 'handTransform', 'hosted']);
// Hosted names are executable integration points bound to stable card identities.
export const HOSTED_CARD_RULES = Object.freeze({
  'tt13-poor-meal': 'batch13-poor-meal',
  'tt13-spring': 'batch13-spring',
  'tt13-magazine': 'batch13-magazine',
  'tt13-snipe': 'batch13-snipe',
  'tt13-guard': 'batch13-guard',
  'tt13-bitter-rain': 'batch13-bitter-rain',
  'tt13-mind-control': 'batch13-mind-control',
  'tt13-flame-staff': 'batch13-flame-staff',
  'tt13-scale-armor': 'batch13-scale-armor',
  'tt13-astrolabe': 'batch13-astrolabe',
  'tt13-soul-contract': 'batch13-soul-contract',
  'tt13-stellar-divination': 'batch13-stellar-divination',
  'tt13-chaos-deck': 'batch13-chaos-deck',
  'tt13-mercy': 'batch13-mercy',
  'cmtn1ntxzoc4': 'batch13-flame-form',
  'tt7-imitate': 'imitate', 'cc-mana-surge': 'mana-surge', 'cc-rot-seed': 'rot-seed',
  'cmtn1lbhbqi4': 'charge-fireball', 'tt7-stratagem': 'pouch-container',
  'tt2-pearlbox': 'pearl-container', 'tt2-venomstaff': 'venom-staff',
  'tt3-element-seal': 'element-seal', 'tt3eq-mistbox': 'cost-swap',
  'tt7-darkfort': 'dark-fort', 'tt7-naturestaff': 'nature-staff',
  'tt8-demonslay': 'ranger-chain', 'tt8-heavensword': 'ranger-chain',
  'tt8-abyss-sovereign': 'sovereign', 'tt8-hero-assassin': 'assassin',
  'tt8-hero-descender': 'consume-fireball', 'tt8-hero-sealer': 'seal-chain',
  'tt8-hero-summoner': 'gate-choices', 'tt8-hero-warrior': 'kill-transform',
  'tt3-mystery-potion': 'mystery-potion', 'tt8-hero-guardian': 'guardian',
  'tt8-hero-mage': 'mage', 'tt8-hero-priest': 'priest',
  'tt8-hero-ranger': 'ranger', 'tt8-hero-sword': 'sword', 'tt8-hero-warlock': 'warlock',
  'tt2-frostsword': 'frost-sword', 'tt3-crimson-pouch': 'crimson-pouch',
  'tt3-fate-wheel': 'fate-wheel', 'tt3eq-boiler': 'boiler',
  'tt3-azure-sword': 'azure-sword', 'tt3-chaos-eye': 'chaos-eye',
  'tt3-immortal-blade': 'immortal-blade', 'tt3-master-staff': 'master-staff',
  'tt3-silver-runesword': 'silver-runesword', 'tt3-sapper-bomb': 'sapper-bomb',
  'tt3-wolf-bow': 'wolf-bow', 'tt3-reverse-bow': 'reverse-bow',
  'tt3-twinwater-mail': 'twinwater-mail',
  'cmtn1wnhhym': 'temporary-hand-cards', 'cmtn233trmeg': 'keep-self-in-hand',
  'tt3-fatal-pierce': 'bleed-gated-armor-break', 'tt3-frostfall': 'choose-and-cast-melee',
  'tt3-qi-wave': 'draw-and-price-damage', 'tt7-bloodpoison': 'double-target-poison-daggers',
  'tt7-ghostblade': 'stealth-break-bonus', 'tt7-marchrush': 'last-hand-repeat-all',
  'cc-poison-burst': 'burst-existing-poison', 'tt12-felguard': 'infused-immune-spell',
  'tt12-freezeray': 'untouched-target-freeze', 'tt12-raydragon': 'infused-ray',
  'tt3-magic-lamp': 'three-choice-lamp', 'tt7-holyheal': 'infused-price-heal',
  'tt7-meteorstrong': 'infused-fireball-burst', 'tt3sp-bloodstorm': 'infused-repeating-lifesteal',
  'tt3sp-flowerzhen': 'double-and-burst-poison', 'tt3sp-silverthorn': 'infused-damage-bonus',
  'tt-token-color': 'class-ability-acquire', 'tt-medneedle': 'delayed-heal-item',
  'tt7-arcanebolt': 'damage-and-draw', 'tt7-provoke': 'foe-fight-select',
});
/** @type {Set<string>} */
export const HOSTED_BATTLE_RULES = new Set(Object.values(HOSTED_CARD_RULES));
// M3：bag.use 支持的 op 集（战斗侧 battle.bag 结构化分派 + 地图侧 game.bag useStructuredBagRule）。
// 单源定义处（capability.js 侧 import 消费，2026-10-02 审计 A 档消双写漂移面）。
export const BAG_SUPPORTED_OPS = new Set(['heal', 'restoreConsumed', 'energy', 'blessing', 'curse', 'draw', 'damage',
  'execute', 'acquire', 'discover', 'flee']);
const RULE_KEYS = new Set(['version', 'battle', 'triggers', 'base', 'bag', 'equip']);
const TARGET_KEYS = new Set(['side', 'area']);
const REQUIREMENT_KEYS = new Set(['kind', 'count', 'type']);
const COST_MODIFIER_KEYS = new Set(['kind', 'type', 'amount']);
const BASE_KEYS = new Set(['material']);
const BASE_MATERIAL_KEYS = new Set(['kind', 'amount']);
const BAG_KEYS = new Set(['use']);
// v2（G13 时点触发器）：onPlay 之外新增时点容器——键位先行（schema 放行），
// 解释器（battle.triggers.m2.js runner）逐时点接线；未接线时点由 capability 收口。
// M2（2026-09-27）七时点全量接线：onTurnStart/onTurnEnd/onBattleStart/onConsume/onDraw/
// onKill/onDamaged/onPlayCard；容器级 duration = 该卡 trigger 持续 N 次触发后过期。
const TRIGGER_KEYS = new Set([...BATTLE_TRIGGER_POINTS, 'duration', 'replay']);
// v2 onPlay 全量键白名单（逐键参数校验在各 op 分支内完成）。

const DISCOVER_POOL_KEYS = new Set(['kind', 'cost']);
const SUPPORTED_DAMAGE_TYPES = new Set(['attack', 'spell', 'fixed', 'true']);
// v2 —— 各操作族允许键集（白名单内的组合约束在此逐键收口）

// M1：draw 增加 range（随机张数区间，摸索「抽2-3张牌」）——与 amountField/amount/untilHandN 四选一
// M2：perCurseKinds 按目标诅咒种类数抽牌 / filter 牌库定向抽取（deckDraw type）

// M1：净化（Wave1 仅支持自身——卡面先例：治愈/净化箭/圣杖/白梅落影均为净化自身）

// M2：偷取攻击（影噬「偷取至 1 点」/ 禁咒「夺取 1 点攻击力」）——amount 固定量 / capTo 压至阈值二选一

// M3：敌对敌互殴（扰敌「选择 2 名敌人，迫使其相互攻击一次」）/ 随机复制一张手牌（刀剑形态）

// v2 —— G2 诅咒枚举（与 combat.js CURSES / CURSE_META 对齐；M2 加 atkDown 攻击降低）
const CURSE_KEYS = new Set(['bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'atkDown']);
const STACKING_CURSE_KEYS = new Set(['bleed', 'poison']);
const CONDITION_KEYS = new Set(['foeHpBelow', 'foeHpHalf', 'foeStatus', 'foeFullHp',
  // M2：目标身负任意诅咒（暗影射击「若对手处于诅咒状态」）
  'anyCurse', 'playerStealthed']);
const DAMAGE_TARGET_KEYS = new Set(['chosenEnemy', 'allEnemies', 'randomEnemy']);
const CURSE_TARGET_KEYS = new Set(['chosenEnemy', 'allEnemies', 'randomEnemy', 'self']);
// v2 —— 键位已定的操作族（schema 放行 + 逐键校验）。解释器进度：acquire/blessing/
// energy/energyCap/maxHp/deckCap/coins 已接线（A3 G3/G4 批，battle.resolution.js）；
// execute/summon/transform/registerRule/extraTurn 仍 pending throw（后续批）。
// 集合名保留 PENDING_ 前缀；成员从下方统一操作定义中派生。

const BLESSING_KEYS = new Set(['atkUp', 'spellUp', 'stealth', 'immune', 'dodge', 'reduce']);
// M1：acquire.filter 键位（type 卡牌类型 / cost 费用等于 / costMax 费用上限）。
// 键位先行全部放行并逐键校验；解释器消费进度由 capability 表收口（Wave1 只消费
// cost/costMax——type 过滤与池名词 parsePoolNoun 重叠，E6 回归锁定未消费 filter 必拒）。
const ACQUIRE_FILTER_KEYS = new Set(['type', 'cost', 'costMax', 'exceptIds']);
// M2：registerRule 持续规则旗标扩键（bleedAmp 流血伤害翻倍 / meleeCost1 所有武术 1 费 /
// spellCost1 所有法术 1 费——消费点 combat/enemy-phase 流血结算与 battle.card-cost 既有旗标；
// moveCost1 所有招式（=武术+法术）1 费，2026-10-06 银河之旅改版，执行时双旗标同落）
const REGISTER_RULE_KEYS = new Set(['consumeFireball', 'allSpellsInfused', 'growth', 'bleedAmp', 'meleeCost1', 'spellCost1', 'moveCost1',
  'discoverPlus', 'doubleNextSpell', 'poisonLegacy', 'playerCurseImmune', 'stealthStrike']);
const HAND_OP_KEYS = new Set(['consumeHand', 'dumpHand', 'copyRandom', 'keepInHand', 'noInfuse']);
// v2 —— G5 装备域（键位设计先行，全部 pending；消费点在 battle.equipment.js，A3 B9 落地）
const EQUIP_KEYS = new Set(['onEquip', 'passive', 'battleStart', 'skill', 'container']);
const EQUIP_PASSIVE_KEYS = new Set(['aura', 'cond', 'heroSkillCost', 'damageResponse', 'alternatingRefund', 'infusionUnlock']);
const EQUIP_AURA_KEYS = new Set(['atk', 'spellPower', 'deckCap',
  // M2：focus 专注——每回合开始额外获得 N 点能量（回合管线经 triggers runner 结算）
  'focus']);
const EQUIP_COND_KEYS = new Set(['hasCurse', 'vsFreeze']);
const EQUIP_SKILL_KEYS = new Set(['oncePerBattle', 'ops']);
const EQUIP_CONTAINER_KEYS = new Set(['slots', 'accepts']);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasOnlyKeys(value, allowed) {
  return Object.keys(value).every(key => allowed.has(key));
}

function isNonemptyRecord(value, allowed) {
  return isRecord(value) && hasOnlyKeys(value, allowed) && Object.keys(value).length > 0;
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

function validateOptionalPositiveInteger(record, field, path, error) {
  if (record[field] !== undefined && !isPositiveInteger(record[field])) {
    error(`${path}.${field}`, 'must be a positive integer');
  }
}

function validateOptionalNonnegativeInteger(record, field, path, error) {
  if (record[field] !== undefined && !isNonnegativeInteger(record[field])) {
    error(`${path}.${field}`, 'must be a nonnegative integer');
  }
}

function validateOptionalTrue(record, field, path, error) {
  if (record[field] !== undefined && record[field] !== true) {
    error(`${path}.${field}`, 'must equal true when provided');
  }
}

function validateOperationKeys(operation, allowed, path, op, error) {
  for (const key of Object.keys(operation)) {
    if (!allowed.has(key)) error(`${path}.${key}`, `is not accepted for ${op} operations`);
  }
}

// v2 —— 条件对象（damage.cond / bonus.if 共用形状）：键集与取值逐键校验

/** @typedef {[(value: any) => boolean, string?]} FieldConstraint
 * @typedef {[string, FieldConstraint, boolean?, string?]} FieldRule
 * @typedef {(key: string, rule: FieldConstraint, required?: boolean, override?: string) => void} FieldChecker
 * @typedef {[Set<string>, ((operation: any, card: any, path: string, error: any, op: string) => void) | FieldRule[], boolean]} OperationSchema
 * @typedef {((record: any, path: string, error: any) => void) | FieldRule[]} KindCheck
 * @typedef {[Set<string>, string, Map<string, KindCheck>]} KindSchema */
// Each field rule owns its scalar predicate, error message and requiredness.
// Checks run in declaration order and distinguish absent/undefined from null.
/** @type {FieldConstraint} */
const POSITIVE = [isPositiveInteger, 'must be a positive integer'];
/** @type {FieldConstraint} */
const NONNEGATIVE = [isNonnegativeInteger, 'must be a nonnegative integer'];
/** @type {FieldConstraint} */
const TRUE = [value => value === true, 'must equal true when provided'];
/** @type {FieldConstraint} */
const TEXT = [value => typeof value === 'string' && !!value.trim(), 'must be a non-empty string'];
/** @type {FieldConstraint} */
const RANGE = [isRangePair, 'must be a two-element [min, max] pair of nonnegative integers with min <= max'];
/** @returns {FieldConstraint} */
function equalField(value, message) {
  return [actual => actual === value, message];
}
/** @returns {FieldConstraint} */
function oneOfFields(values, message) {
  return [value => values.includes(value), message];
}
function fieldsMatch(record, fields) {
  return fields.every(([key, [test], required = false]) => (!required && record[key] === undefined) || test(record[key]));
}
function recordShape(keys, fields, nonempty = true) {
  const allowed = new Set(keys);
  return record => isRecord(record) && hasOnlyKeys(record, allowed) &&
    (!nonempty || Object.keys(record).length > 0) && fieldsMatch(record, fields);
}
/** @type {FieldConstraint} */
const INTEGER = [Number.isInteger];
const KILL_REWARDS = recordShape(['coins', 'armor', 'energy'], [
  ['coins', POSITIVE], ['armor', POSITIVE], ['energy', POSITIVE],
]);
const EXECUTION_CAP = recordShape(['atk', 'maxHpBelow', 'wounded'], [
  ['atk', POSITIVE], ['maxHpBelow', POSITIVE], ['wounded', TRUE],
]);
const EQUIPMENT_AURA = recordShape([...EQUIP_AURA_KEYS], [
  ['atk', INTEGER], ['spellPower', INTEGER], ['deckCap', INTEGER], ['focus', NONNEGATIVE],
]);
const EQUIPMENT_CONDITION = recordShape([...EQUIP_COND_KEYS], [
  ['hasCurse', TRUE], ['vsFreeze', POSITIVE],
]);
const DRAW_FILTER = recordShape(['type'], [['type', TEXT]]);
/** @returns {FieldChecker} */
function fieldValidator(record, path, error) {
  return (key, [test, message], required = false, override = message) => {
    if ((required || record[key] !== undefined) && !test(record[key])) error(`${path}.${key}`, override);
  };
}
function validateCondition(record, path, error) {
  const field = fieldValidator(record, path, error);
  if (!isNonemptyRecord(record, CONDITION_KEYS)) {
    error(path, "must be a non-empty object with keys among 'foeHpBelow', 'foeHpHalf', 'foeStatus', 'foeFullHp'");
    return;
  }
  field("foeHpBelow", POSITIVE);
  field("foeHpHalf", TRUE);
  field("foeFullHp", TRUE);
  if (record.foeStatus !== undefined && !CURSE_KEYS.has(record.foeStatus)) {
    error(`${path}.foeStatus`, "must be one of 'bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban'");
  }
  field("anyCurse", TRUE);
  field("playerStealthed", TRUE, false, "must equal true");
}

function validateDamageOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);

  // M2：perTargetPrice——伤害动态锚定参照牌价格（气功波「抽 1 张牌，对全体敌人造成等同于其价格的固定伤害」，
  // 参照=同一 onPlay 中前一获取段入手的牌；engine getPriceOfLastDrawn 口径）
  const sources = ['amountField', 'amount', 'range', 'perTargetPrice'].filter(field => operation[field] !== undefined);
  if (sources.length !== 1) {
    error(path, "must specify exactly one damage source among 'amountField', 'amount', 'range', 'perTargetPrice'");
  }
  field("perTargetPrice", TRUE);
  if (operation.amountField !== undefined) {
    field("amountField", equalField('dmg', "must reference card field 'dmg'"), true);
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
    // M2：hits.perPlayedMoves——段数动态源「本回合已打出的招式数」（连续射击）
    if (!isRecord(operation.hits) || !hasOnlyKeys(operation.hits, new Set(['count', 'range', 'perFoe', 'perPlayedMoves'])) ||
        ['count', 'range', 'perFoe', 'perPlayedMoves'].filter(key => operation.hits[key] !== undefined).length !== 1) {
      error(`${path}.hits`, "must specify exactly one of 'count', 'range', 'perFoe', 'perPlayedMoves'");
    } else {
      validateOptionalPositiveInteger(operation.hits, 'count', `${path}.hits`, error);
      if (operation.hits.range !== undefined && !isRangePair(operation.hits.range)) {
        error(`${path}.hits.range`, 'must be a two-element [min, max] pair of nonnegative integers with min <= max');
      }
      validateOptionalTrue(operation.hits, 'perPlayedMoves', `${path}.hits`, error);
      // perFoe（每人释放一次）语义落在 B2 后续批次，schema 先放行、解释器 throw
    }
  }
  // M3：pick:'new'——该段结算前重新点选目标（血毒双镖双目标）
  field("pick", equalField('new', "must equal 'new' when provided"));
  field("retarget", equalField('livingFoes', "must be 'livingFoes'"));
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
      validateOptionalPositiveInteger(bonus, 'amount', `${path}.bonus`, error);
      if (bonus.pct !== undefined && !isPositiveInteger(bonus.pct)) {
        error(`${path}.bonus.pct`, 'must be a positive integer percent');
      }
      if (bonus.if !== undefined) validateCondition(bonus.if, `${path}.bonus.if`, error);
    }
  }
  field("lifesteal", TRUE);
  if (operation.graveyard !== undefined) {
    const grave = operation.graveyard;
    if (!isRecord(grave) || !hasOnlyKeys(grave, new Set(['type', 'perCard'])) ||
        !['武术', '法术', '装备', '道具', '资源'].includes(grave.type) ||
        !isPositiveInteger(grave.perCard)) {
      error(`${path}.graveyard`, "must specify { type: '武术'|'法术'|'装备'|'道具'|'资源', perCard: positive integer }");
    }
  }
  if (operation.recast !== undefined) {
    // M2：recast.on 扩 'lastHand'——本牌为最后一张手牌时再施放 N 次（急行军/破釜沉舟族）
    const recast = operation.recast;
    if (!isRecord(recast) || !hasOnlyKeys(recast, new Set(['on', 'times'])) ||
        !['kill', 'lastHand'].includes(recast.on) || !isPositiveInteger(recast.times)) {
      error(`${path}.recast`, "must specify { on: 'kill' | 'lastHand', times: positive integer }");
    }
  }
  field("schedule", oneOfFields(['nextTurn', 'nextTurnStart'], "must equal 'nextTurn' or 'nextTurnStart' (deferred to the next turn start)"));
  // —— M2 动态加成与奖励键 ——
  field("perInfusedInHand", POSITIVE);
  field("infuseBonus", POSITIVE);
  if (operation.spellPowerMul !== undefined && (!Number.isInteger(operation.spellPowerMul) || operation.spellPowerMul < 2)) {
    error(`${path}.spellPowerMul`, 'must be an integer >= 2');
  }
  if (operation.onKill !== undefined) {
    const onKill = operation.onKill;
    if (!KILL_REWARDS(onKill)) {
      error(`${path}.onKill`, "must be a non-empty object with positive integer 'coins' and/or 'armor'");
    }
  }
  field("nonLethal", TRUE, false, "must be true");
}

function validateCurseOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);

  // M2：source:'handMoves'——聚合手牌中招式自带的全部诅咒（诅咒之刃），与具名/随机三选一
  const hasCurseKey = operation.curse !== undefined;
  const hasRandomKinds = operation.randomKinds !== undefined;
  const hasSource = operation.source !== undefined;
  if ((+hasCurseKey) + (+hasRandomKinds) + (+hasSource) !== 1) {
    error(path, "must specify exactly one of 'curse' (named curse), 'randomKinds' (random curse kinds), or 'source: handMoves'");
  }
  if (hasSource) {
    field("source", equalField('handMoves', "must equal 'handMoves'"), true);
    if (operation.stacks !== undefined || operation.duration !== undefined) {
      error(`${path}.source`, 'handMoves applies each curse at its face default; stacks/duration are not accepted');
    }
    if (operation.amount !== undefined) error(`${path}.amount`, 'is not accepted for handMoves');
  }
  if (hasCurseKey) {
    if (!CURSE_KEYS.has(operation.curse)) {
      error(`${path}.curse`, "must be one of 'bleed', 'poison', 'freeze', 'silence', 'abreak', 'healban', 'atkDown'");
    } else if (STACKING_CURSE_KEYS.has(operation.curse)) {
      field("stacks", POSITIVE, true, "must be a positive integer for stacking curses (bleed/poison)");
      if (operation.duration !== undefined) {
        error(`${path}.duration`, 'is not accepted for stacking curses (bleed/poison) — declare stacks instead');
      }
    } else if (operation.curse === 'atkDown') {
      // M2：atkDown 计时型 + amount 扣减量必填（割蚀「降低 2 攻，持续 3 回合」）
      field("duration", POSITIVE, true, "must be a positive integer for atkDown");
      field("amount", POSITIVE, true, "must be a positive integer attack reduction for atkDown");
      if (operation.stacks !== undefined) {
        error(`${path}.stacks`, 'is not accepted for atkDown — declare duration and amount instead');
      }
    } else if (!isPositiveInteger(operation.duration)) {
      error(`${path}.duration`, 'must be a positive integer for timed curses');
    } else if (operation.stacks !== undefined) {
      error(`${path}.stacks`, 'is not accepted for timed curses — declare duration instead');
    }
  }
  if (hasRandomKinds) {
    field("randomKinds", POSITIVE, true);
    if (operation.stacks !== undefined || operation.duration !== undefined) {
      error(`${path}.stacks`, 'randomKinds applies one stack of each drawn kind; stacks/duration are not accepted');
    }
  }
  field("pick", equalField('new', "must equal 'new' when provided"));
  if (!hasSource && operation.bindTarget === undefined && !CURSE_TARGET_KEYS.has(operation.target)) {
    error(`${path}.target`, "must be 'chosenEnemy', 'allEnemies', 'randomEnemy', or 'self'");
  }
  field("double", TRUE);
  field("burst", POSITIVE);
  field("extend", POSITIVE);
}

function validateEffectAmount(operation, card, path, field, error) {
  if (operation.amountField !== undefined) {
    if (operation.amountField !== field) {
      error(`${path}.amountField`, `must reference card field '${field}'`);
    }
    if (typeof card?.[field] !== 'number' || !Number.isFinite(card[field]) || card[field] <= 0) {
      error(`${path}.amountField`, `card.${field} must be a finite positive number`);
    }
  }
  if (operation.amount !== undefined) {
    if (!isPositiveInteger(operation.amount)) {
      error(`${path}.amount`, 'must be a positive integer');
    } else if (typeof card?.[field] === 'number' && Number.isFinite(card[field]) && Number(card[field]) !== operation.amount
      && Number(card[field]) !== 0) {
      error(`${path}.amount`, `must equal card.${field} (${card[field]}) when the field is declared`);
    }
  }
}

function validateEffectOperation(operation, card, path, error, op) {
  const field = fieldValidator(operation, path, error);

  if (op === 'heal') {
    const sources = SELF_EFFECT_DEFINITIONS.heal.sources
      .filter(field => operation[field] !== undefined);
    if (sources.length !== 1) {
      error(path, "must specify exactly one source among 'amountField', 'amount', 'upTo', 'selfDamage', 'perFuelCost', 'perSpellHeal'");
    }
    validateEffectAmount(operation, card, path, 'heal', error);
    field("upTo", POSITIVE);
    field("selfDamage", POSITIVE);
    field("perFuelCost", POSITIVE);
    field("perSpellHeal", POSITIVE);
    return;
  }
  if (op === 'armor') {
    const sources = SELF_EFFECT_DEFINITIONS.armor.sources.filter(field => operation[field] !== undefined);
    if (sources.length > 1) {
      error(path, "must specify at most one of 'amountField', 'amount', 'priceOf'");
    }
    if (sources.length === 0 && operation.guard === undefined) {
      error(path, "must declare an amount (amountField/amount/priceOf) or guard: true");
    }
    field("priceOf", equalField('discovered', "must equal 'discovered' (armor equals the discovered card's price)"));
    field("consumeEquip", TRUE);
    validateEffectAmount(operation, card, path, 'armor', error);
    field("guard", TRUE);
    field("decayAtTurnEnd", POSITIVE);
    return;
  }
  // draw：M1 起四源选一（amountField / amount / untilHandN / range 区间随机张数）
  // M2：perCurseKinds 第五源——按目标身负诅咒种类数抽牌（深渊诅咒）；filter 牌库定向抽取
  const sources = SELF_EFFECT_DEFINITIONS.draw.sources.filter(field => operation[field] !== undefined);
  if (sources.length !== 1) {
    error(path, "must specify exactly one source among 'amountField', 'amount', 'untilHandN', 'range', 'perCurseKinds'");
  }
  field("perCurseKinds", TRUE);
  if (operation.filter !== undefined) {
    // M2：draw.filter——牌库定向抽取（武装「从牌库中抽取 2 张装备牌」，deckDraw type 口径）
    const drawFilter = operation.filter;
    if (!DRAW_FILTER(drawFilter)) {
      error(`${path}.filter`, "must be { type: non-empty card type }");
    }
  }
  validateEffectAmount(operation, card, path, 'draw', error);
  field("untilHandN", POSITIVE);
  field("range", RANGE);
  if (operation.handOps !== undefined) {
    const handOps = operation.handOps;
    if (!Array.isArray(handOps) || handOps.length === 0 ||
        !handOps.every(entry => isRecord(entry) && HAND_OP_KEYS.has(entry.op))) {
      error(`${path}.handOps`, `must be a non-empty array of { op } objects with op among ${[...HAND_OP_KEYS].map(k => `'${k}'`).join(', ')}`);
    }
  }
}

// Operation declarations own accepted keys and their ordered field constraints.
// Complex rules share this dispatch with scalar operations; shape errors always
// precede field errors. This registry also owns operation and global key allowlists.
/** @param {string} keys @param {OperationSchema[1]} [validate] @returns {OperationSchema} */
const operationSchema = (keys, validate = [], pending = false) => [new Set(['op', ...keys.split(' ').filter(Boolean)]), validate, pending];
const NUMERIC_OPERATION = operationSchema('n', [['n', POSITIVE, true]], true);
/** @type {Map<string, OperationSchema>} */
const OPERATION_SCHEMAS = new Map([
  ['damage', operationSchema('amountField amount range target hitCount retarget hits cond bonus lifesteal graveyard recast schedule onKill perInfusedInHand infuseBonus spellPowerMul perTargetPrice pick nonLethal', validateDamageOperation)],
  ['curse', operationSchema('curse stacks duration target randomKinds double burst extend source bindTarget amount pick', validateCurseOperation)],
  ['cleanse', operationSchema('target', [['target', equalField('self', "must be 'self' (cleanse only supports purifying yourself in wave 1)"), true]])],
  ['stealAtk', operationSchema('target amount capTo duration pick', validateStealOperation)],
  ['noDrawNext', operationSchema('')],
  ['foeFight', operationSchema('pick', [['pick', equalField('two', 'must be two')]])],
  ['copyRandom', operationSchema('')],
  ['status', operationSchema('status target duration', [
    ['status', equalField('freeze', "must equal 'freeze'"), true],
    ['target', equalField('allEnemies', "must equal 'allEnemies'"), true],
    ['duration', POSITIVE, true],
  ])],
  ['discover', operationSchema('count pool costDecayPerTurn', validateDiscoverOperation)],
  ['heal', operationSchema(SELF_EFFECT_DEFINITIONS.heal.keys.join(' '), validateEffectOperation)],
  ['armor', operationSchema(SELF_EFFECT_DEFINITIONS.armor.keys.join(' '), validateEffectOperation)],
  ['draw', operationSchema(SELF_EFFECT_DEFINITIONS.draw.keys.join(' '), validateEffectOperation)],
  ['acquire', operationSchema('n pool dest act filter', validateAcquireOperation, true)],
  ['blessing', operationSchema('key stacks duration', [
    ['key', memberField(BLESSING_KEYS, "must be one of 'atkUp', 'spellUp', 'stealth', 'immune', 'dodge', 'reduce'"), true],
    ['stacks', POSITIVE], ['duration', POSITIVE],
  ], true)],
  ...['energy', 'energyCap', 'maxHp', 'deckCap', 'coins'].map(/** @returns {[string, OperationSchema]} */ op => [op, NUMERIC_OPERATION]),
  ['refillEnergy', operationSchema('', [], true)],
  ['execute', operationSchema('cap count onKill perCurseKinds perCurseStacks what', validateExecuteOperation, true)],
  ['summon', operationSchema('name atk hp count statless taunt', [
    ['name', TEXT, true], ['count', POSITIVE, true], ['atk', NONNEGATIVE],
    ['hp', POSITIVE], ['statless', TRUE], ['taunt', TRUE],
  ], true)],
  ['transform', operationSchema('what into cost keepInHand', [
    ['what', oneOfFields(['sha', 'self', 'handCard'], "must be 'sha', 'self', or 'handCard'"), true],
    ['into', [ isRecord, 'must be an object when provided' ]],
    ['cost', NONNEGATIVE], ['keepInHand', TRUE],
  ], true)],
  ['registerRule', operationSchema('rule', [['rule', memberField(REGISTER_RULE_KEYS, "must be one of 'consumeFireball', 'allSpellsInfused', 'growth'"), true]], true)],
  ['extraTurn', operationSchema('', [], true)],
]);
const PENDING_ONPLAY_OPS = new Set([...OPERATION_SCHEMAS].filter(([, schema]) => schema[2]).map(([name]) => name));
// Legacy global allowance differs from per-operation shape: cleanse remains a
// recognized parameter and transform.cost still produces the global error.
const ON_PLAY_OPERATION_KEYS = new Set([...OPERATION_SCHEMAS.values()].flatMap(([keys]) => [...keys]).filter(key => key !== 'cost').concat('cleanse'));

/** @returns {FieldConstraint} */
function memberField(values, message) {
  return [value => values.has(value), message];
}
/** @param {OperationSchema} schema */
function validateKnownOperation(operation, card, path, error, op, schema) {
  const [keys, validate] = schema;
  validateOperationKeys(operation, keys, path, op, error);
  if (typeof validate === 'function') validate(operation, card, path, error, op);
  else {
    const field = fieldValidator(operation, path, error);
    for (const rule of validate) field(...rule);
  }
}
function validateAcquireOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);
  field("n", POSITIVE, true);
  if (!isRecord(operation.pool) || typeof operation.pool.kind !== 'string' || !operation.pool.kind.trim()) {
    error(`${path}.pool`, "must be an object with a non-empty 'kind' string");
  }
  field("dest", oneOfFields(['hand', 'deck', 'discover'], "must be 'hand', 'deck', or 'discover'"));
  field("act", oneOfFields(['play', 'playKeep', 'dup', 'zeroCost', 'costMinusOne', 'decay', 'noInfuse'], "must be 'play', 'playKeep', 'dup', 'zeroCost', 'costMinusOne', 'decay', or 'noInfuse'"));
  if (operation.filter !== undefined) {
    // M1：filter 基础扩展——在池谓词上叠加约束（类型 / 费用等于 / 费用上限）。
    // 键位先行放行并逐键校验；消费进度由 capability 表收口（Wave1 只消费
    // cost/costMax），未知键仍拒绝防静默不生效。
    const filter = operation.filter;
    if (!isNonemptyRecord(filter, ACQUIRE_FILTER_KEYS)) {
      error(`${path}.filter`, `must be a non-empty object with keys among ${[...ACQUIRE_FILTER_KEYS].map(k => `'${k}'`).join(', ')}`);
    } else {
      if (filter.type !== undefined && (typeof filter.type !== 'string' || !filter.type.trim())) {
        error(`${path}.filter.type`, 'must be a non-empty card type when provided');
      }
      validateOptionalNonnegativeInteger(filter, 'cost', `${path}.filter`, error);
      validateOptionalNonnegativeInteger(filter, 'costMax', `${path}.filter`, error);
      if (filter.exceptIds !== undefined && (!Array.isArray(filter.exceptIds) || !filter.exceptIds.length ||
          filter.exceptIds.some(id => typeof id !== 'string' || !id.trim()))) {
        error(`${path}.filter.exceptIds`, 'must be a non-empty array of card ids');
      }
    }
  }
}
function validateExecuteOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);
  // M3：what——对选中目标施放指定攻击而非消灭（'fireball' 火球 / 'starterAttack' 初始攻击）
  field("what", oneOfFields(['fireball', 'starterAttack'], "must be 'fireball' or 'starterAttack'"));
  if (operation.cap !== undefined) {
    const cap = operation.cap;
    if (!EXECUTION_CAP(cap)) {
      error(`${path}.cap`, "must be a non-empty object with positive integer 'atk' and/or 'maxHpBelow'");
    }
  }
  field("count", POSITIVE);
  // M2：perCurseKinds——消灭数量动态锚定目标诅咒种类数（深渊诅咒同款计数口径）
  field("perCurseKinds", TRUE);
  field("perCurseStacks", TRUE);
  if (operation.perCurseKinds === true && operation.perCurseStacks === true) {
    error(path, 'perCurseKinds and perCurseStacks are mutually exclusive');
  }
  if (operation.onKill !== undefined && !isRecord(operation.onKill)) {
    error(`${path}.onKill`, 'must be an object when provided');
  }
}
function validateStealOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);
  // M2：偷取攻击——amount 固定夺取量 / capTo 压至阈值（影噬「偷取攻击力至 1 点」）二选一；
  // duration 缺省 1（1 回合后归还，enemy-phase 既有偷取归还管线）
  const stealSources = ['amount', 'capTo'].filter(field => operation[field] !== undefined);
  if (stealSources.length !== 1) {
    error(path, "must specify exactly one of 'amount' (flat steal) or 'capTo' (reduce to threshold)");
  }
  field('amount', POSITIVE);
  field('capTo', NONNEGATIVE);
  field('duration', POSITIVE);

}
function validateDiscoverOperation(operation, card, path, error) {
  const field = fieldValidator(operation, path, error);
  field('count', POSITIVE, true);
  if (!isRecord(operation.pool) || !hasOnlyKeys(operation.pool, DISCOVER_POOL_KEYS) ||
      operation.pool.kind !== 'moves' || !Number.isInteger(operation.pool.cost) || operation.pool.cost < 0) {
    error(`${path}.pool`, "must specify { kind: 'moves', cost: nonnegative integer }");
  }
  field('costDecayPerTurn', POSITIVE, true);

}

function validateOperation(operation, card, path, error) {
  if (!isRecord(operation)) {
    error(path, 'expected an operation object');
    return;
  }
  if (Object.hasOwn(operation, 'when')) {
    const { when, ...effect } = operation;
    if (!isRecord(when) || !hasOnlyKeys(when, new Set(['infused', 'brokeStealth', 'targetStatus', 'targetUndamagedBeforeCast'])) ||
      Object.keys(when).length < 1 || Object.entries(when).some(([key, value]) => key === 'targetStatus'
        ? !CURSE_KEYS.has(value) : typeof value !== 'boolean')) error(`${path}.when`, 'requires finite execution predicates');
    validateOperation(effect, card, path, error);
    return;
  }
  if (isSemanticOperation(operation)) {
    validateSemanticOperation(operation, path, error, (ops, childPath) => validateOperationArray(ops, card, childPath, error));
    return;
  }
  if (!hasOnlyKeys(operation, ON_PLAY_OPERATION_KEYS)) error(path, 'contains an unknown parameter');
  const schema = OPERATION_SCHEMAS.get(operation.op);
  if (typeof operation.op !== 'string' || !schema) error(`${path}.op`, 'unknown onPlay operation');
  else validateKnownOperation(operation, card, path, error, operation.op, schema);
}

// v2 —— 装备域（G5）形状校验：键位先行，全部 pending，解释器遇到即 throw
/** A trigger or equipment action executes only its own operations and referenced fields.
 * This pure view is shared by capability preflight and the battle executors. */
export { createCardRuleExecutionView };

function validateOperationArray(operations, card, path, error) {
  if (!Array.isArray(operations)) {
    error(path, 'expected an operation array');
    return;
  }
  // Each registered point owns its numeric inputs. A literal consume/draw effect
  // must not be forced to equal the unrelated onPlay damage field (e.g. a bomb).
  const scoped = createCardRuleExecutionView(card, operations);
  for (const field of ['dmg', 'heal', 'armor', 'draw']) {
    if (operations.some(operation => operation?.amountField === field)) scoped[field] = card?.[field];
  }
  operations.forEach((operation, index) => validateOperation(operation, scoped, `${path}[${index}]`, error));
}

function validateEquipRules(equip, card, error) {
  if (!isNonemptyRecord(equip, EQUIP_KEYS)) {
    error('rules.equip', `expected a non-empty object with fields among ${[...EQUIP_KEYS].map(k => `'${k}'`).join(', ')}`);
    return;
  }
  if (equip.onEquip !== undefined) validateOperationArray(equip.onEquip, card, 'rules.equip.onEquip', error);
  if (equip.battleStart !== undefined) validateOperationArray(equip.battleStart, card, 'rules.equip.battleStart', error);
  if (equip.passive !== undefined) {
    const passive = equip.passive;
    if (!isNonemptyRecord(passive, EQUIP_PASSIVE_KEYS)) {
      error('rules.equip.passive', "expected a non-empty object with fields among 'aura', 'cond'");
    } else {
      if (passive.aura !== undefined) {
        const aura = passive.aura;
        if (!EQUIPMENT_AURA(aura)) {
          error('rules.equip.passive.aura', "must contain integer atk/spellPower/deckCap values or a nonnegative integer focus");
        }
      }
      if (passive.cond !== undefined) {
        const cond = passive.cond;
        // M3：vsFreeze 数值化——对冰冻目标伤害加成量（寒冰剑「对冰冻角色伤害 +2」）
        if (!EQUIPMENT_CONDITION(cond)) {
          error('rules.equip.passive.cond', "must be a non-empty object with 'hasCurse: true' and/or a positive integer 'vsFreeze' bonus");
        }
      }
      for (const [key, fields] of Object.entries({
        heroSkillCost: ['maxHand', 'cost'], damageResponse: ['damage', 'drawChance', 'draw'],
        alternatingRefund: ['types', 'amount'], infusionUnlock: ['fuel', 'spellPower', 'draw'],
      })) {
        if (passive[key] === undefined) continue;
        const rule = passive[key];
        if (!isRecord(rule) || !hasOnlyKeys(rule, new Set(fields)) || fields.some(field => rule[field] === undefined)) {
          error(`rules.equip.passive.${key}`, `requires exactly ${fields.join(', ')}`); continue;
        }
        for (const field of fields) {
          if (field === 'types') {
            if (!Array.isArray(rule.types) || rule.types.length !== 2 || new Set(rule.types).size !== 2 ||
              rule.types.some(type => !['武术', '法术'].includes(type))) error(`rules.equip.passive.${key}.types`, 'requires both martial and spell types');
          } else if (field === 'drawChance') {
            if (!Number.isFinite(rule[field]) || rule[field] < 0 || rule[field] > 1) error(`rules.equip.passive.${key}.${field}`, 'requires probability 0..1');
          } else if (!isNonnegativeInteger(rule[field])) error(`rules.equip.passive.${key}.${field}`, 'requires nonnegative integer');
        }
      }
    }
  }
  if (equip.skill !== undefined) {
    const skill = equip.skill;
    if (!isRecord(skill) || !hasOnlyKeys(skill, EQUIP_SKILL_KEYS) || !Array.isArray(skill.ops)) {
      error('rules.equip.skill', "expected an object with an 'ops' operation array (optional 'oncePerBattle')");
    } else {
      if (skill.oncePerBattle !== undefined && typeof skill.oncePerBattle !== 'boolean') {
        error('rules.equip.skill.oncePerBattle', 'must be a boolean when provided');
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

/** @type {FieldConstraint} */
const FORBIDDEN = [() => false, 'is not accepted for this kind'];
/** @type {FieldRule[]} */
const NUMERIC_COST = [['type', FORBIDDEN], ['amount', POSITIVE, true]];
const noRequirementParameters = (record, path, error) => {
  if (Object.keys(record).some(key => key !== 'kind')) error(path, `${record.kind} does not accept parameters`);
};
/** @param {[string, KindCheck][]} entries */
const kindMap = entries => new Map(entries);
/** @type {KindSchema} */
const REQUIREMENT_SCHEMA = [REQUIREMENT_KEYS, 'unknown requirement kind', kindMap([
  ...['unplayable', 'deckOnly', 'infused'].map(/** @returns {[string, (record: any, path: string, error: any) => void]} */ kind => [kind, noRequirementParameters]),
  ['handCards', [['count', POSITIVE, true], ['type', TEXT, false, 'must be a non-empty string when provided']]],
])];
/** @type {KindSchema} */
const COST_SCHEMA = [COST_MODIFIER_KEYS, 'unknown cost modifier kind', kindMap([
  ['previousCardTypeFree', [['type', TEXT, true, 'must be a non-empty card type'], ['amount', FORBIDDEN]]],
  ['armorZeroFree', (record, path, error) => {
    if (record.type !== undefined || record.amount !== undefined) error(path, 'armorZeroFree does not accept parameters');
  }],
  ...['martialPlayedDiscount', 'consumedSpellDiscount', 'movesPlayedDiscount'].map(/** @returns {[string, FieldRule[]]} */ kind => [kind, NUMERIC_COST]),
])];
/** @param {KindSchema} schema */
function validateKindList(records, path, schema, error) {
  const [keys, unknown, kinds] = schema;
  if (records === undefined) return;
  if (!Array.isArray(records)) { error(path, 'expected an array'); return; }
  const seen = new Set();
  records.forEach((record, index) => {
    const childPath = `${path}[${index}]`;
    if (!isRecord(record)) { error(childPath, 'expected an object'); return; }
    if (Object.hasOwn(record, 'amountField')) error(`${childPath}.amountField`, 'is not supported by the current runtime');
    if (!hasOnlyKeys(record, keys)) error(childPath, 'contains an unknown field');
    if (typeof record.kind === 'string') {
      if (seen.has(record.kind)) error(`${childPath}.kind`, 'duplicate kind is unsupported');
      seen.add(record.kind);
    }
    const validate = kinds.get(record.kind);
    if (!validate) { error(`${childPath}.kind`, unknown); return; }
    if (typeof validate === 'function') validate(record, childPath, error);
    else {
      const field = fieldValidator(record, childPath, error);
      for (const rule of validate) field(...rule);
    }
  });
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
        if (triggerKey === 'duration') {
          // M2：容器级 duration——非 onPlay trigger 持续 N 次触发后过期（花瓣法阵「持续 3 回合」）
          if (!isPositiveInteger(triggers.duration)) error('rules.triggers.duration', 'must be a positive integer');
          continue;
        }
        if (triggerKey === 'replay') {
          // M3：容器级 replay——打出后整卡重跑（急行军「效果触发 2 次」规则化）
          const replay = triggers.replay;
          if (!isRecord(replay) || !hasOnlyKeys(replay, new Set(['on', 'times'])) ||
              !['lastHand'].includes(replay.on) || !isPositiveInteger(replay.times)) {
            error('rules.triggers.replay', "must be { on: 'lastHand', times: positive integer }");
          }
          continue;
        }
        if (triggerKey !== 'onPlay') {
          // G13 时点触发器：op 形状先校验，运行时由 battle.triggers.m2.js runner 结算
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
          if (triggers.replay && damageOperations.some(operation => operation.recast?.on === 'lastHand')) {
            error('rules.triggers.replay', 'cannot combine whole-card lastHand replay with damage lastHand recast');
          }
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
            if (['heal', 'armor', 'draw', 'cleanse'].includes(operation.op)) {
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
          if (fieldAnchoredEffectOps.length && (curseOperations.length || pendingOperations.some(operation => operation.op !== 'refillEnergy'))) {
            error('rules.triggers.onPlay', 'field-anchored heal/armor/draw cannot be combined with v2 operations');
          }
          // —— 卡面字段一致性 ——
          // 空 onPlay 明确声明「打出时无效果，其他触发点承接」；字段仍须由同卡
          // onTurnStart/equip 等真实消费器声明，不能借空数组保留未消费的卡面字段。
          // 注能字段在任何结构化 onPlay 中都不允许保留（v1 约定延续：注能门由描述句承担）
          const ownsInfusion = rules.battle?.requirements?.some(rule => rule.kind === 'infused') ||
            operations.some(operation => operation?.infuseBonus !== undefined || operation?.when?.infused !== undefined);
          if (card?.infuse !== undefined && Number(card.infuse) !== 0 && !ownsInfusion) {
            error('rules.triggers.onPlay', 'onPlay cannot preserve card.infuse');
          }
          // M3：动态源豁免——draw 的 range/perCurseKinds/untilHandN 也是「声明消费了卡面字段」的
          // 合法形态（摸索「抽2-3张牌」/深渊诅咒「每有1种诅咒抽1张」），不再强制 amount 精确匹配
          const otherTriggerOps = Object.entries(triggers).filter(([key]) => key !== 'onPlay')
            .flatMap(([, value]) => Array.isArray(value) ? value : []);
          const equip = rules.equip;
          const equipOps = isRecord(equip) ? ['onEquip', 'battleStart'].flatMap(key =>
            Array.isArray(equip[key]) ? equip[key] : []).concat(
              isRecord(equip.skill) && Array.isArray(equip.skill.ops) ? equip.skill.ops : []) : [];
          const expandOperations = entries => entries.flatMap(operation => isRecord(operation)
            ? [operation, ...expandOperations(Array.isArray(operation.ops) ? operation.ops : []),
              ...expandOperations(Array.isArray(operation.options) ? operation.options.flatMap(option => Array.isArray(option?.ops) ? option.ops : []) : [])]
            : [operation]);
          const declaringOperations = expandOperations([...operations, ...otherTriggerOps, ...equipOps]);
          const declaresField = (op, field) => declaringOperations.some(operation => isRecord(operation) && (
            (operation.op === op && (operation.amountField === field ||
              (operation.amount !== undefined && typeof card?.[field] === 'number' && Number(card[field]) === operation.amount) ||
              (field === 'draw' && (operation.range !== undefined || operation.perCurseKinds !== undefined ||
                operation.untilHandN !== undefined)))) ||
            (field === 'armor' && operation.op === 'damage' && operation.onKill?.armor === card?.armor) ||
            (field === 'heal' && operation.op === 'fillHand' && operation.perSpellHeal === card?.heal)));
          for (const field of ['heal', 'armor', 'draw']) {
            if (card?.[field] !== undefined && Number(card[field]) !== 0 && !declaresField(field, field)
              && !operations.some(operation => operation?.op === 'choice')) {
              error('rules.triggers.onPlay', `onPlay must declare card.${field}`);
            }
          }
          const hasDamageDeclaration = declaringOperations.some(operation => isRecord(operation) && operation.op === 'damage');
          if (!hasDamageDeclaration && card?.dmg !== undefined && Number(card.dmg) !== 0) {
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
          // —— battle.target 交叉契约（v1 保留 + curse / randomEnemy 扩展 + M1 混合放行）——
          // M1 混合目标契约（孢子城墙/恶魔之力/坚冰结界式「敌方 op + 自身字面量效果 op」）：
          // battle.target 按主体效果声明 side:'enemy'，自身域效果 op（heal/armor/draw 的字面量
          // 源与 cleanse）在混排时免 side/area 强制——结算本就自指（heal/armor/draw/cleanse
          // 恒作用于玩家自身），解释器无需分支。field-anchored 效果 op 不参与放行（沿用上方
          // 「damage 不能与 heal/armor/draw 混排」的 v1/v2 口径）。
          const declaredTarget = rules.battle?.target;
          const enemyDomainOps = operations.filter(operation => isRecord(operation) &&
            (['damage', 'stealAtk', 'execute', 'foeFight'].includes(operation.op) ||
              (operation.op === 'curse' && operation.target !== 'self')));
          const selfLiteralOps = operations.filter(operation => isRecord(operation) &&
            ((operation.op === 'curse' && operation.target === 'self') ||
              operation.op === 'cleanse' || operation.op === 'noDrawNext' || operation.op === 'extraTurn' ||
              operation.op === 'registerRule' || operation.op === 'summon' ||
              (['heal', 'armor', 'draw'].includes(operation.op) && operation.amountField === undefined)));
          const untargetedRefill = declaredTarget?.side === null
            && operations.some(operation => operation?.op === 'refillEnergy')
            && operations.every(operation => ['draw', 'refillEnergy'].includes(operation?.op));
          const mixedSelfEffects = declaredTarget?.side === 'enemy' && enemyDomainOps.length > 0 &&
            selfLiteralOps.length > 0;
          for (const operation of operations) {
            if (!isRecord(operation)) continue;
            if (operation.op === 'damage' || operation.op === 'curse' || operation.op === 'stealAtk') {
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
                if (!mixedSelfEffects) {
                  if (declaredTarget?.side !== 'self') error('rules.battle.target.side', 'self requires side self');
                  if (declaredTarget?.area !== false) error('rules.battle.target.area', 'self requires area false');
                }
              }
            } else if (['heal', 'armor', 'draw'].includes(operation.op)) {
              if (!mixedSelfEffects) {
                if (declaredTarget?.side !== 'self' && !(operation.op === 'draw' && (untargetedRefill || declaredTarget?.side === null))) error('rules.battle.target.side', `${operation.op} requires side 'self'`);
                if (declaredTarget?.area !== false) error('rules.battle.target.area', `${operation.op} requires area false`);
              }
            } else if (operation.op === 'cleanse') {
              if (!mixedSelfEffects) {
                if (declaredTarget?.side !== 'self') error('rules.battle.target.side', 'cleanse requires side self');
                if (declaredTarget?.area !== false) error('rules.battle.target.area', 'cleanse requires area false');
              }
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
      } else if (!Array.isArray(bag.use) || bag.use.length === 0) {
        error('rules.bag.use', 'expected a non-empty operation array');
      } else {
        // M3：bag.use 扩为多操作数组（恢复药水=heal+energy），复用 onPlay op 校验；
        // op 支持集由 capability 收口（战斗/地图双消费端按 op 语义各自承载）
        const BAG_OP_KEYS = new Set(['op', 'target', 'amountField', 'amount', 'range', 'upTo', 'curse', 'stacks',
          'duration', 'key', 'n', 'pool', 'dest', 'cap', 'count', 'perCurseKinds', 'what', 'schedule', 'dmgType']);
        bag.use.forEach((operation, index) => {
          const path = `rules.bag.use[${index}]`;
          if (!isRecord(operation)) {
            error(path, 'expected an operation object');
            return;
          }
          if (typeof operation.op !== 'string' || !BAG_SUPPORTED_OPS.has(operation.op)) {
            error(`${path}.op`, `unknown bag use operation (supported: ${[...BAG_SUPPORTED_OPS].join(', ')})`);
            return;
          }
          validateOperationKeys(operation, BAG_OP_KEYS, path, "bag use", error);
          if (operation.dmgType !== undefined && (operation.op !== 'damage' || !SUPPORTED_DAMAGE_TYPES.has(operation.dmgType))) {
            error(`${path}.dmgType`, 'requires a damage operation and a supported damage type');
          }
          if (operation.op === 'heal') {
            if (operation.amountField !== undefined && operation.amountField !== 'heal') {
              error(`${path}.amountField`, "must reference card field 'heal'");
            }
            // amountField 引用形态要求卡面字段存在（道具卡 heal 字段）
            if (operation.amountField === 'heal' && operation.amount === undefined &&
                (typeof card?.heal !== 'number' || !Number.isFinite(card.heal) || card.heal <= 0)) {
              error(`${path}.amountField`, 'card.heal must be a finite positive number');
            }
            if (operation.amountField !== undefined && operation.amount !== undefined) {
              error(path, "specify either amountField or amount, not both");
            }
          }
          if (operation.op === 'restoreConsumed' && (!Number.isInteger(operation.amount) || operation.amount <= 0)) {
            error(`${path}.amount`, 'must be a positive integer');
          }
        });
        if (card?.type !== '道具') error('rules.bag.use', "bag use requires card.type to equal '道具'");
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
  if (battle.keepInHand !== undefined && typeof battle.keepInHand !== 'boolean') {
    error('rules.battle.keepInHand', 'must be a boolean when provided');
  }
  if (battle.fuelAllowed !== undefined && typeof battle.fuelAllowed !== 'boolean') error('rules.battle.fuelAllowed', 'must be a boolean');
  if (battle.ignoresSilence !== undefined && battle.ignoresSilence !== true) error('rules.battle.ignoresSilence', 'must be true');
  if (battle.ownedEquipCapacity !== undefined && !isPositiveInteger(battle.ownedEquipCapacity)) error('rules.battle.ownedEquipCapacity', 'requires positive integer');
  if (battle.handTransform !== undefined) {
    const rule = battle.handTransform;
    if (!isRecord(rule) || !hasOnlyKeys(rule, new Set(['afterType', 'cost'])) || rule.afterType !== '武术' || !isNonnegativeInteger(rule.cost)) error('rules.battle.handTransform', 'requires martial event and copy cost');
  }
  if (battle.setup !== undefined) {
    const rule = battle.setup;
    const idList = value => Array.isArray(value) && value.length > 0 && value.every(id => typeof id === 'string' && id);
    if (!isRecord(rule) || !hasOnlyKeys(rule, new Set(['mode', 'injectIds', 'collection'])) || rule.mode !== 'boss' || !idList(rule.injectIds) ||
      !isRecord(rule.collection) || !hasOnlyKeys(rule.collection, new Set(['ids', 'into'])) || !idList(rule.collection.ids) || typeof rule.collection.into !== 'string') error('rules.battle.setup', 'requires boss setup identities and hand collection transformation');
  }

  if (battle.hosted !== undefined) {
    if (!Array.isArray(battle.hosted) || battle.hosted.length === 0) {
      error('rules.battle.hosted', 'expected a non-empty array of hosted rule names');
    } else {
      const seenHosted = new Set();
      battle.hosted.forEach((name, index) => {
        if (typeof name !== 'string' || !HOSTED_BATTLE_RULES.has(name) || HOSTED_CARD_RULES[card?.id] !== name) {
          error(`rules.battle.hosted[${index}]`, `unknown hosted rule '${String(name)}'`);
        } else if (seenHosted.has(name)) {
          error(`rules.battle.hosted[${index}]`, 'duplicate hosted rule name');
        }
        seenHosted.add(name);
      });
    }
  }

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

  validateKindList(battle.requirements, 'rules.battle.requirements', REQUIREMENT_SCHEMA, error);
  validateKindList(battle.costModifiers, 'rules.battle.costModifiers', COST_SCHEMA, error);

  return { ok: errors.length === 0, errors, pending };
}
