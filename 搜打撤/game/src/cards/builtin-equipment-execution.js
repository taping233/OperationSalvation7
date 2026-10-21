export { BUILTIN_EQUIPMENT_PREVIOUS_RULES } from './builtin-equipment-previous-rules.js';

/** @param {object} fields @param {object} triggers */
const equip = (fields = {}, triggers = {}) => ({ version:1, equip:{ onEquip:[], ...fields }, triggers });
/** @param {object[]} ops */
const skill = ops => ({ oncePerBattle:true, ops });
const arrowIds = ['tt2-swiftarrow', 'tt2-comboarrow', 'tt2-piercearrow', 'tt2-forestarrow',
  'tt3-blood-arrow', 'tt3-purify-arrow', 'tt3-arrow-rain', 'tt3-life-arrow', 'tt3-venom-arrow', 'tt7-meteorrain'];
const gunIds = ['tt2-shoot', 'tt3-noon-duel', 'tt3-double-shot', 'cc-rapid-fire', 'tt13-snipe'];

// Explicit operations own each execution point. Text is free to change without
// changing equipment behavior; previous-rule fingerprints protect custom edits.
export const BUILTIN_EQUIPMENT_REVISIONS = {
  'tt2-pearlbox': { rules:equip({ container:{ slots:9, accepts:'资源' } }) },
  'tt2-venomstaff': { rules:equip({ onEquip:[{ op:'registerRule', rule:'poisonOnSpell' }] }) },
  'tt3-immortal-blade': { rules:equip({ battleStart:[{ op:'transform', what:'starterAttacks', into:'不朽斩' }] }) },
  'tt3-azure-sword': { rules:equip({}, {
    onConsume:[{ op:'release', source:'generated', key:'初始攻击', max:1 }],
  }) },
  'tt3-fate-wheel': { rules:equip({ skill:skill([
    { op:'consumeHand', all:true }, { op:'extraTurn' },
  ]) }) },
  'tt3-crimson-pouch': { rules:equip({ skill:skill([{ op:'handSelect', n:1, act:'copy' }]) }) },
  'tt3-wolf-bow': { rules:equip({}, {
    onTurnStart:[{ op:'acquire', n:1, pool:{ kind:'ids', ids:arrowIds }, dest:'hand', act:'zeroCost' }],
  }) },
  'tt3-sapper-bomb': { fields:{ dmgType:'fixed' }, rules:equip({}, {
    onConsume:[{ op:'damage', amount:4, target:'chosenEnemy' }],
  }) },
  'tt3-element-seal': { rules:equip({ passive:{ infusionUnlock:{ fuel:3, spellPower:2, draw:2 } } }) },
  'tt3-reverse-bow': { rules:equip({ skill:skill([
    { op:'release', source:'hand', key:'箭', all:true, eachDraw:1 },
  ]) }) },
  'tt3eq-mistbox': { rules:equip({ skill:skill([{ op:'swapDiscoverCosts', count:2 }]) }) },
  'tt8-demonslay': { fields:{ dmgType:'attack' }, rules:equip({}, {
    onDraw:[{ op:'damage', amountField:'dmg', target:'allEnemies' }],
  }) },
  'tt8-heavensword': { rules:equip({}, { onDraw:[{ op:'draw', amountField:'draw' }] }) },
  'tt7-naturestaff': { rules:equip({ skill:skill([{ op:'handSelect', n:1, act:'zeroNext' }]) }) },
  'tt7-darkfort': { rules:equip({ onEquip:[{ op:'registerRule', rule:'deathSave', n:1 }] }) },
  'tt13-poor-meal': { rules:equip({ passive:{ heroSkillCost:{ maxHand:3, cost:0 } } }) },
  'tt13-magazine': { rules:equip({ skill:skill([
    { op:'acquire', n:2, pool:{ kind:'ids', ids:gunIds }, dest:'hand' },
  ]) }) },
  'tt13-scale-armor': { rules:equip({ passive:{ damageResponse:{ damage:3, drawChance:0.5, draw:1 } } }) },
  'tt13-astrolabe': { rules:equip({ passive:{ alternatingRefund:{ types:['武术', '法术'], amount:1 } } }) },
};
