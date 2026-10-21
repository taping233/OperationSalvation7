// Data contracts for operations whose semantics do not depend on card identity or text.
export const SEMANTIC_OPERATION_TARGETS = Object.freeze(/** @type {const} */ ({
  adjustCurse: ['chosenEnemy', 'allEnemies', 'randomEnemy'],
  restoreHeroSkill: [], recruitEnemy: ['chosenEnemy'], insertCards: [],
  fillHand: [], castRandomSpells: [], equipCapacity: [],
  transform: [], release: [], consumeHand: [], handSelect: [], swapDiscoverCosts: [],
  markEnemy: ['chosenEnemy'],
  schedule: [], castDrawn: [], castStored: [], registerInfusionBonus: [], transformCards: [],
  choice: [], randomCurse: ['allEnemies'], randomBlessing: ['allAllies'], freezeFirstEnemies: [],
  discoverCopies: [],
}));

/** @param {unknown} operation @returns {boolean} */
export function isSemanticOperation(operation) {
  if (!operation || typeof operation !== 'object') return false;
  const op = Reflect.get(operation, 'op');
  if (op === 'acquire') return ['ids', 'types'].includes(Reflect.get(operation, 'pool')?.kind)
    || Reflect.get(operation, 'expire') !== undefined;
  if (op === 'armor') return Reflect.get(operation, 'bonus')?.if === 'noEnemyDamageThisTurn';
  if (op === 'curse') return Reflect.get(operation, 'missingBonusIfCursed') === true;
  if (op === 'transform') return Reflect.get(operation, 'what') === 'starterAttacks';
  if (op === 'registerRule') return ['poisonOnSpell', 'deathSave'].includes(Reflect.get(operation, 'rule'))
    || Reflect.get(operation, 'rule') === 'playerCurseImmune' && Reflect.get(operation, 'duration') !== undefined;
  return typeof op === 'string' && Object.hasOwn(SEMANTIC_OPERATION_TARGETS, op);
}

/** @param {Record<string, unknown>} operation @param {string} path
 * @param {(path:string, message:string)=>void} error
 * @param {(ops:unknown, path:string)=>void} validateOps */
export function validateSemanticOperation(operation, path, error, validateOps) {
  const sets = {
    adjustCurse: ['op', 'target', 'curse', 'multiply', 'burst'],
    restoreHeroSkill: ['op'], recruitEnemy: ['op', 'target', 'wounded', 'excludeBoss'],
    insertCards: ['op', 'ids', 'shuffle'], fillHand: ['op', 'untilHandN', 'perSpellHeal'],
    castRandomSpells: ['op', 'count', 'infused'], equipCapacity: ['op', 'n'],
    transform: ['op', 'what', 'into'], release: ['op', 'key', 'source', 'max', 'all', 'eachDraw'],
    consumeHand: ['op', 'all', 'trigger'], handSelect: ['op', 'n', 'type', 'act'], swapDiscoverCosts: ['op', 'count'],
    registerRule: ['op', 'rule', 'n', 'duration'],
    acquire: ['op', 'n', 'pool', 'dest', 'act', 'expire'],
    armor: ['op', 'amount', 'bonus'], curse: ['op', 'target', 'curse', 'stacks', 'missingBonusIfCursed'],
    markEnemy: ['op', 'target', 'event', 'status', 'multiplier', 'amount', 'dmgType', 'dest', 'recursive'],
    schedule: ['op', 'delay', 'ops'], castDrawn: ['op', 'type'], castStored: ['op', 'count'],
    registerInfusionBonus: ['op', 'every', 'key', 'stacks'],
    transformCards: ['op', 'source', 'raritySteps', 'ceiling', 'swapCosts'],
    choice: ['op', 'options', 'otherAfterTurns'], randomCurse: ['op', 'target', 'curses', 'stacks', 'preferMissing'],
    randomBlessing: ['op', 'target', 'choices', 'preferMissing'], freezeFirstEnemies: ['op', 'count', 'duration'],
    discoverCopies: ['op', 'type', 'count', 'copies', 'castOnDraw'],
  };
  const keys = /** @type {Record<string, string[]>} */ (sets)[String(operation.op)];
  for (const key of Object.keys(operation)) if (!keys.includes(key)) error(`${path}.${key}`, 'unknown semantic parameter');
  const positive = (/** @type {string} */ key) => {
    if (!Number.isInteger(operation[key]) || Number(operation[key]) < 1) error(`${path}.${key}`, 'must be a positive integer');
  };
  if (operation.op === 'discoverCopies') {
    positive('count'); positive('copies');
    if (operation.type !== '法术' || operation.castOnDraw !== true) error(path, 'requires spell copies with on-draw casting');
  } else if (operation.op === 'choice') {
    if (!Array.isArray(operation.options) || operation.options.length < 2) error(`${path}.options`, 'requires at least two choices');
    else operation.options.forEach((option, index) => {
      if (!option || typeof option !== 'object' || Object.keys(option).some(key => !['label', 'ops', 'repeat'].includes(key)) || typeof option.label !== 'string') {
        error(`${path}.options[${index}]`, 'requires label and operations'); return;
      }
      if (option.repeat !== undefined && option.repeat !== 'turnStart') error(`${path}.options[${index}].repeat`, 'requires turnStart');
      validateOps(option.ops, `${path}.options[${index}].ops`);
    });
    if (operation.otherAfterTurns !== undefined && operation.otherAfterTurns !== 2) error(`${path}.otherAfterTurns`, 'supports two-turn delayed alternate choice');
  } else if (operation.op === 'randomCurse') {
    positive('stacks');
    if (!Array.isArray(operation.curses) || !operation.curses.length || operation.curses.some(key => !['bleed','poison','freeze','silence','abreak','healban'].includes(key))) error(`${path}.curses`, 'requires supported curse keys');
    if (operation.preferMissing !== true) error(`${path}.preferMissing`, 'must be true');
  } else if (operation.op === 'randomBlessing') {
    if (!Array.isArray(operation.choices) || !operation.choices.length || operation.choices.some(key => !['stealth','atkUp','spellUp','reduce','armor','purify'].includes(key))) error(`${path}.choices`, 'requires supported blessing keys');
    if (operation.preferMissing !== true) error(`${path}.preferMissing`, 'must be true');
  } else if (operation.op === 'freezeFirstEnemies') {
    positive('count'); positive('duration');
  } else if (operation.op === 'schedule') {
    positive('delay'); validateOps(operation.ops, `${path}.ops`);
  } else if (operation.op === 'castDrawn') {
    if (!['武术', '法术'].includes(String(operation.type))) error(`${path}.type`, 'requires martial or spell');
  } else if (operation.op === 'castStored') {
    if (operation.count !== 1) error(`${path}.count`, 'stored cards select one');
  } else if (operation.op === 'registerInfusionBonus') {
    positive('every'); positive('stacks');
    if (operation.key !== 'spellUp') error(`${path}.key`, 'requires spellUp');
  } else if (operation.op === 'transformCards') {
    if (operation.source !== 'drawPile' || operation.raritySteps !== 1 || operation.ceiling !== '传说' || operation.swapCosts !== true) error(path, 'requires one-step same-type deck promotion and cost permutation');
  } else if (operation.op === 'markEnemy') {
    if (operation.dmgType !== 'true') error(`${path}.dmgType`, 'mark damage currently requires true damage');
    if (operation.event === 'death') {
      if (operation.status !== 'poison' || operation.dest !== 'allEnemies') error(path, 'death marks require poison source and allEnemies');
      positive('multiplier');
    } else if (operation.event === 'damaged') {
      positive('amount');
      if (operation.dest !== 'randomOtherEnemy' || operation.recursive !== false) error(path, 'damage echoes require nonrecursive other-enemy targeting');
    } else error(`${path}.event`, 'requires death or damaged');
  } else if (operation.op === 'armor') {
    positive('amount');
    const bonus = /** @type {{amount?:unknown,if?:unknown}} */ (operation.bonus);
    if (!bonus || Object.keys(bonus).some(key => !['amount', 'if'].includes(key)) ||
      !Number.isInteger(bonus.amount) || Number(bonus.amount) < 1) error(`${path}.bonus`, 'requires positive bonus amount and damage history condition');
  } else if (operation.op === 'curse') {
    if (operation.curse !== 'poison') error(`${path}.curse`, 'conditional missing-kind bonus requires poison');
    positive('stacks');
  } else if (operation.op === 'acquire') {
    positive('n');
    const pool = /** @type {{kind?:unknown,ids?:unknown,types?:unknown,randomEligible?:unknown}} */ (operation.pool);
    if (pool?.kind === 'ids') {
      if (Object.keys(pool).some(key => !['kind', 'ids'].includes(key)) || !Array.isArray(pool.ids) || !pool.ids.length || !pool.ids.every(id => typeof id === 'string' && id)) error(`${path}.pool`, 'requires explicit card identities');
    } else if (pool?.kind === 'types') {
      if (Object.keys(pool).some(key => !['kind', 'types', 'randomEligible'].includes(key)) || !Array.isArray(pool.types) || !pool.types.length || pool.types.some(type => !['武术', '法术'].includes(type)) || pool.randomEligible !== true) error(`${path}.pool`, 'requires eligible move types');
    } else if (operation.expire !== 'nextTurnStart' || pool?.kind !== '随机') error(`${path}.pool`, 'requires a defined pool');
    if (operation.dest !== 'hand') error(`${path}.dest`, 'explicit pool currently requires hand');
    if (operation.act !== undefined && operation.act !== 'zeroCost') error(`${path}.act`, 'explicit pool supports only zeroCost');
    if (operation.expire !== undefined && operation.expire !== 'nextTurnStart') error(`${path}.expire`, 'requires nextTurnStart');
  } else if (operation.op === 'adjustCurse') {
    if (operation.curse !== 'poison') error(`${path}.curse`, 'only stacking poison supports burst');
    if (operation.multiply === undefined && operation.burst === undefined) error(path, 'requires multiply or burst');
    if (operation.multiply !== undefined) positive('multiply');
    if (operation.burst !== undefined) positive('burst');
  } else if (operation.op === 'recruitEnemy') {
    if (operation.wounded !== true || operation.excludeBoss !== true) error(path, 'requires wounded non-boss selection');
  } else if (operation.op === 'insertCards') {
    if (!Array.isArray(operation.ids) || !operation.ids.length || !operation.ids.every(id => typeof id === 'string' && id)) {
      error(`${path}.ids`, 'requires a non-empty array of card identities');
    }
    if (operation.shuffle !== true) error(`${path}.shuffle`, 'must be true');
  } else if (operation.op === 'fillHand') {
    positive('untilHandN');
    if (operation.perSpellHeal !== undefined) positive('perSpellHeal');
  } else if (operation.op === 'castRandomSpells') {
    positive('count');
    if (operation.infused !== true) error(`${path}.infused`, 'must be true');
  } else if (operation.op === 'equipCapacity') positive('n');
  else if (operation.op === 'transform') {
    if (typeof operation.into !== 'string' || !operation.into) error(`${path}.into`, 'requires a named card template');
  } else if (operation.op === 'release') {
    if (typeof operation.key !== 'string' || !operation.key) error(`${path}.key`, 'requires a card family');
    if (operation.source !== undefined && !['hand', 'generated'].includes(String(operation.source))) error(`${path}.source`, 'requires hand or generated');
    if (operation.source === 'generated' && (operation.key !== '初始攻击' || operation.max !== 1)) error(path, 'generated release supports one starter attack');
    if (operation.max !== undefined) positive('max');
    if (operation.eachDraw !== undefined) positive('eachDraw');
    if (operation.all !== undefined && operation.all !== true) error(`${path}.all`, 'must be true');
  } else if (operation.op === 'consumeHand') {
    if (operation.all !== true) error(`${path}.all`, 'must be true');
    if (operation.trigger !== undefined && typeof operation.trigger !== 'boolean') error(`${path}.trigger`, 'must be boolean');
  } else if (operation.op === 'handSelect') {
    positive('n');
    if (!['copy', 'zeroNext', 'play'].includes(String(operation.act))) error(`${path}.act`, 'unsupported hand action');
    if (operation.type !== undefined && typeof operation.type !== 'string') error(`${path}.type`, 'requires a card type');
  } else if (operation.op === 'swapDiscoverCosts') {
    if (operation.count !== 2) error(`${path}.count`, 'requires two discovered cards');
  } else if (operation.op === 'registerRule' && operation.rule === 'deathSave') positive('n');
  else if (operation.op === 'registerRule' && operation.rule === 'playerCurseImmune' && operation.duration !== 1) {
    error(`${path}.duration`, 'temporary immunity supports this turn only');
  }
}
