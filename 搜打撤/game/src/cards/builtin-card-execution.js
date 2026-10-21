import { isBuiltinExecutableCard } from './builtin-card-identities.js';
import { BUILTIN_PREVIOUS_RULES } from './builtin-card-previous-rules.js';
import { BUILTIN_EQUIPMENT_REVISIONS, BUILTIN_EQUIPMENT_PREVIOUS_RULES } from './builtin-equipment-execution.js';
import { BUILTIN_CHOICE_REVISIONS, BUILTIN_CHOICE_PREVIOUS_RULES } from './builtin-choice-execution.js';
import { BUILTIN_PREVIOUS_VARIANTS } from './builtin-card-previous-variants.js';

const selfTarget = { side: 'self', area: false };
const enemyTarget = { side: 'enemy', area: false };
const noTarget = { side: null, area: false };
/** @param {object[]} ops @param {object} target @param {object} extra */
const playRules = (ops, target = selfTarget, extra = {}) => ({ version: 1,
  battle: { target }, triggers: { onPlay: ops, ...extra } });

// These are executable data. None of their values comes from a display string.
/** @type {Record<string, { fields?: object, rules: object }>} */
export const BUILTIN_EXECUTION_REVISIONS = {
  ...BUILTIN_EQUIPMENT_REVISIONS,
  ...BUILTIN_CHOICE_REVISIONS,
  'tt3-qi-wave': { fields: { dmgType: 'fixed' }, rules: playRules([
    { op: 'draw', amount: 1 }, { op: 'damage', perTargetPrice: true, target: 'allEnemies' },
  ], { side: 'enemy', area: true }) },
  'tt7-marchrush': { rules: playRules([
    { op: 'draw', amountField: 'draw' }, { op: 'armor', amountField: 'armor' },
  ], selfTarget, { replay: { on: 'lastHand', times: 1 } }) },
  'tt7-arcanebolt': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'draw', amount: 1 },
  ], enemyTarget) },
  'tt7-provoke': { rules: playRules([{ op: 'foeFight', pick: 'two' }], enemyTarget) },
  'tt3-chaos-eye': { rules: { version: 1, equip: { onEquip: [], battleStart: [
    { op: 'maxHp', n: 10 }, { op: 'deckCap', n: 5 },
  ] } } },
  'tt3-silver-runesword': { rules: { version: 1, equip: { onEquip: [], passive: { aura: { atk: 2 } } },
    triggers: { onTurnStart: [{ op: 'heal', selfDamage: 2 }] } } },
  'tt2-frostsword': { rules: { version: 1,
    equip: { onEquip: [], passive: { cond: { vsFreeze: 2 } } } } },
  'tt8-hero-mage': { rules: playRules([{ op: 'blessing', key: 'spellUp', stacks: 1 }], noTarget, {
    onTurnStart: [{ op: 'acquire', n: 1, pool: { kind: '随机' }, dest: 'discover' }],
  }) },
  'tt8-hero-assassin': { rules: playRules([
    { op: 'cleanse', target: 'self' }, { op: 'blessing', key: 'stealth', duration: 2 },
    { op: 'registerRule', rule: 'stealthStrike' },
  ]) },
  'tt8-hero-descender': { rules: playRules([
    { op: 'blessing', key: 'spellUp', stacks: 1 }, { op: 'registerRule', rule: 'consumeFireball' },
  ], noTarget) },
  'cc-poison-burst': { rules: playRules([
    { op: 'adjustCurse', curse: 'poison', burst: 2, target: 'chosenEnemy' },
  ], enemyTarget) },
  'tt3sp-flowerzhen': { rules: playRules([
    { op: 'adjustCurse', curse: 'poison', multiply: 2, burst: 1, target: 'chosenEnemy' },
  ], enemyTarget) },
  'tt13-spring': { rules: playRules([{ op: 'restoreHeroSkill' }, { op: 'draw', amount: 1 }]) },
  'tt13-mind-control': { rules: playRules([
    { op: 'recruitEnemy', target: 'chosenEnemy', wounded: true, excludeBoss: true },
  ], enemyTarget) },
  'tt8-hero-ranger': { rules: playRules([
    { op: 'insertCards', ids: ['tt8-heavensword', 'tt8-demonslay'], shuffle: true },
  ], noTarget) },
  'tt8-hero-warlock': { rules: playRules([
    { op: 'insertCards', ids: ['tt8-curse1', 'tt8-curse2', 'tt8-curse3', 'tt8-curse4'], shuffle: true },
    { op: 'draw', amount: 2 },
  ], noTarget) },
  'tt8-hero-priest': { rules: playRules([{ op: 'fillHand', untilHandN: 6, perSpellHeal: 3 }]) },
  'cc-mana-surge': { rules: playRules([{ op: 'castRandomSpells', count: 4, infused: true }], noTarget) },
  'tt8-hero-guardian': { rules: { ...playRules([{ op: 'energyCap', n: 1 }]),
    battle: { target: noTarget, ownedEquipCapacity: 1 } } },
  'tt3-frostfall': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'handSelect', n: 1, type: '武术', act: 'play' },
  ], enemyTarget) },
  'tt8-hero-warrior': { rules: playRules([{ op: 'transform', what: 'starterAttacks', into: '青龙偃月斩' }], noTarget) },
  'cmtn1lbhbqi4': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' }, { op: 'registerRule', rule: 'growth' },
  ], enemyTarget) },
  'tt8-abyss-sovereign': { rules: playRules([
    { op: 'draw', untilHandN: 6 }, { op: 'energyCap', n: 1 },
    { op: 'blessing', key: 'spellUp', stacks: 1 }, { op: 'registerRule', rule: 'playerCurseImmune' },
    { op: 'registerRule', rule: 'allSpellsInfused' },
    { op: 'summon', name: '封印肢体', count: 4, statless: true },
  ]) },
  'tt3sp-silverthorn': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', infuseBonus: 3 },
  ], enemyTarget) },
  'tt3sp-bloodstorm': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'allEnemies', lifesteal: true },
    { op: 'damage', amountField: 'dmg', target: 'allEnemies', lifesteal: true, when: { infused: true } },
  ], { side: 'enemy', area: true }) },
  'tt7-holyheal': { rules: { ...playRules([
    { op: 'heal', perFuelCost: 2, when: { infused: true } },
  ]), battle: { target: selfTarget, requirements: [{ kind: 'infused' }] } } },
  'tt7-meteorstrong': { rules: { ...playRules([
    { op: 'execute', what: 'fireball', count: 3, when: { infused: true } },
  ]), battle: { target: enemyTarget, requirements: [{ kind: 'infused' }] } } },
  'tt12-raydragon': { fields: { dmg: 11, dmgType: 'spell' }, rules: { ...playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', when: { infused: true } },
  ], enemyTarget), battle: { target: enemyTarget, requirements: [{ kind: 'infused' }] } } },
  'tt12-felguard': { rules: { ...playRules([
    { op: 'draw', amount: 3, when: { infused: true } },
    { op: 'blessing', key: 'immune', duration: 1, when: { infused: true } },
    { op: 'registerRule', rule: 'playerCurseImmune', duration: 1, when: { infused: true } },
  ]), battle: { target: selfTarget, requirements: [{ kind: 'infused' }] } } },
  'tt3-fatal-pierce': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', bonus: { amount: 2, if: { foeStatus: 'bleed' } } },
    { op: 'curse', curse: 'abreak', duration: 1, target: 'chosenEnemy', when: { targetStatus: 'bleed' } },
  ], enemyTarget) },
  'tt7-ghostblade': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', bonus: { amount: 2, if: { playerStealthed: true } } },
    { op: 'draw', amount: 2, when: { brokeStealth: true } },
  ], enemyTarget) },
  'tt7-bloodpoison': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'bleed', stacks: 1, target: 'chosenEnemy', bindTarget: 'prevDamage' },
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', pick: 'new' },
    { op: 'curse', curse: 'poison', stacks: 1, target: 'chosenEnemy', pick: 'new' },
  ], enemyTarget) },
  'cmtn233trmeg': { rules: { ...playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
  ], enemyTarget), battle: { target: enemyTarget, keepInHand: true, fuelAllowed: false } } },
  'cc-rot-seed': { rules: playRules([
    { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy' },
    { op: 'markEnemy', event: 'death', target: 'chosenEnemy', status: 'poison', multiplier: 1, dmgType: 'true', dest: 'allEnemies' },
  ], enemyTarget) },
  'tt12-freezeray': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy' },
    { op: 'curse', curse: 'freeze', duration: 1, target: 'chosenEnemy', when: { targetUndamagedBeforeCast: true } },
  ], enemyTarget) },
  'tt13-snipe': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', onKill: { energy: 1 } },
  ], enemyTarget) },
  'tt13-guard': { rules: playRules([{ op: 'armor', amount: 6, bonus: { amount: 4, if: 'noEnemyDamageThisTurn' } }]) },
  'tt13-bitter-rain': { rules: playRules([
    { op: 'curse', curse: 'poison', stacks: 2, target: 'chosenEnemy', missingBonusIfCursed: true },
  ], enemyTarget) },
  'tt13-soul-contract': { rules: playRules([
    { op: 'markEnemy', event: 'damaged', target: 'chosenEnemy', amount: 2, dmgType: 'true', dest: 'randomOtherEnemy', recursive: false },
  ], enemyTarget) },
  'tt13-mercy': { rules: playRules([
    { op: 'damage', amountField: 'dmg', target: 'chosenEnemy', nonLethal: true },
  ], enemyTarget) },
  'tt3-mystery-potion': { rules: { ...playRules([{ op: 'schedule', delay: 1, ops: [
    { op: 'acquire', n: 1, pool: { kind: 'types', types: ['武术', '法术'], randomEligible: true }, dest: 'hand', act: 'zeroCost' },
  ] }], noTarget), battle: { target: noTarget, ignoresSilence: true } } },
  'tt7-stratagem': { rules: { ...playRules([{ op: 'castStored', count: 1 }], noTarget),
    equip: { container: { slots: 3, accepts: '法术' } } } },
  'tt8-hero-sword': { rules: playRules([{ op: 'draw', amount: 5 }, { op: 'castDrawn', type: '武术' }], noTarget) },
  'cmtn1ntxzoc4': { rules: playRules([
    { op: 'registerInfusionBonus', every: 2, key: 'spellUp', stacks: 1 }, { op: 'blessing', key: 'spellUp', stacks: 1 },
  ]) },
  'cmtn1wnhhym': { rules: playRules([
    { op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'hand', expire: 'nextTurnStart' },
  ], noTarget) },
  'tt13-chaos-deck': { rules: playRules([
    { op: 'transformCards', source: 'drawPile', raritySteps: 1, ceiling: '传说', swapCosts: true },
    { op: 'consumeHand', all: true, trigger: false },
  ]) },
  'tt3-dig-treasure': { rules: playRules([
    { op: 'acquire', n: 3, pool: { kind: '牌库底' }, dest: 'discover' }, { op: 'armor', priceOf: 'discovered' },
  ]) },
  'tt7-imitate': { rules: { version: 1, triggers: { onPlay: [] },
    battle: { handTransform: { afterType: '武术', cost: 1 } } } },
  'tt8-hero-sealer': { rules: { version: 1, triggers: { onPlay: [] }, battle: {
    requirements: [{ kind: 'unplayable' }], setup: { mode: 'boss',
      injectIds: ['tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'],
      collection: { ids: ['tt8-hero-sealer', 'tt8-curseimmune', 'tt8-energycap', 'tt8-nofocus', 'tt8-healplus'], into: 'tt8-abyss-sovereign' },
    },
  } } },
  'tt13-stellar-divination': { rules: playRules([{ op: 'discoverCopies', type: '法术', count: 1, copies: 2, castOnDraw: true }]) },
};

/** @param {unknown} value @returns {unknown} */
function freezeBuiltinData(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeBuiltinData);
    Object.freeze(value);
  }
  return value;
}
freezeBuiltinData(BUILTIN_EXECUTION_REVISIONS);
freezeBuiltinData(BUILTIN_PREVIOUS_RULES);
freezeBuiltinData(BUILTIN_EQUIPMENT_PREVIOUS_RULES);
freezeBuiltinData(BUILTIN_CHOICE_PREVIOUS_RULES);
freezeBuiltinData(BUILTIN_PREVIOUS_VARIANTS);

// Missing native points are explicitly inert. Custom/unknown cards and native
// declarations still awaiting migration retain the separate legacy adapter.
/** @template TOperation @param {import('./card-execution-plan.types').ExecutionCard<TOperation> | null | undefined} card */
export function ownsBuiltinExecutionDomain(card) {
  return !!card && isBuiltinExecutableCard(card) && !!card.rules
    && !card.rules?.battle?.hosted?.length;
}

/** @template {object} T @param {T & {id?:string, rules?:unknown}} card */
export function migrateBuiltinExecutionCard(card) {
  const revision = BUILTIN_EXECUTION_REVISIONS[card?.id || ''];
  const previous = /** @type {Record<string, unknown>} */ ({ ...BUILTIN_PREVIOUS_RULES, ...BUILTIN_EQUIPMENT_PREVIOUS_RULES, ...BUILTIN_CHOICE_PREVIOUS_RULES });
  const variants = /** @type {Record<string, unknown[]>} */ (BUILTIN_PREVIOUS_VARIANTS);
  const expected = [previous[card.id || ''], ...(variants[card.id || ''] || [])];
  if (!revision || !expected.some(rules => JSON.stringify(card.rules) === JSON.stringify(rules))) return card;
  return { ...card, ...revision.fields, rules: JSON.parse(JSON.stringify(revision.rules)) };
}
