import { energyCapGrantsCurrent } from './card-energy-policy.js';
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => isRecord(value) && Object.keys(value).every(key => keys.includes(key));

// Full reviewed sentences only: partial matches would hide conditions or extra effects.
const templates = [
  {
    text: /^你回复 \d+(?:\.\d+)? 点生命。$/,
    operations: ['heal'],
    render: (/** @type {number[]} */ [heal]) => `你回复 ${heal} 点生命。`,
  },
  {
    text: /^抽 \d+(?:\.\d+)? 张牌。$/,
    operations: ['draw'],
    render: (/** @type {number[]} */ [draw]) => `抽 ${draw} 张牌。`,
  },
  {
    text: /^你获得 \d+(?:\.\d+)? 点能量。$/,
    operations: ['energy'],
    render: (/** @type {number[]} */ [energy]) => `你获得 ${energy} 点能量。`,
  },
  {
    text: /^本场战斗中，你的能量上限增加 \d+(?:\.\d+)? 点。$/,
    operations: ['energyCap'],
    render: (/** @type {number[]} */ [energy], card) => energyCapGrantsCurrent(card)
      ? `本场战斗中，你的能量上限增加 ${energy} 点；你获得 ${energy} 点能量。`
      : `本场战斗中，你的能量上限增加 ${energy} 点。`,
  },
  {
    text: /^你回复 \d+(?:\.\d+)? 点生命，并净化自身。$/,
    operations: ['heal', 'cleanse'],
    render: (/** @type {number[]} */ [heal]) => `你回复 ${heal} 点生命，并净化自身。`,
  },
  {
    text: /^你回复 \d+(?:\.\d+)? 点生命，并获得 \d+(?:\.\d+)? 点护甲。$/,
    operations: ['heal', 'armor'],
    render: (/** @type {number[]} */ [heal, armor]) => `你回复 ${heal} 点生命，并获得 ${armor} 点护甲。`,
  },
  {
    text: /^你获得 \d+(?:\.\d+)? 点护甲，并抽 \d+(?:\.\d+)? 张牌。$/,
    operations: ['armor', 'draw'],
    render: (/** @type {number[]} */ [armor, draw]) => `你获得 ${armor} 点护甲，并抽 ${draw} 张牌。`,
  },
];

function descriptionOperations(card) {
  const rules = card.rules;
  if (!isRecord(rules) || rules.version !== 1) return null;
  if (card.type === '道具') {
    if (!onlyKeys(rules, ['version', 'bag']) || !onlyKeys(rules.bag, ['use'])) return null;
    const operations = rules.bag.use;
    return Array.isArray(operations) && operations.length === 1 && ['heal', 'draw'].includes(operations[0]?.op)
      ? operations : null;
  }
  if (!['武术', '法术'].includes(card.type) ||
      !onlyKeys(rules, ['version', 'battle', 'triggers']) ||
      !onlyKeys(rules.battle, ['target']) ||
      !onlyKeys(rules.battle.target, ['side', 'area']) ||
      rules.battle.target.side !== 'self' || rules.battle.target.area !== false ||
      !onlyKeys(rules.triggers, ['onPlay'])) return null;
  return rules.triggers.onPlay;
}

function operationAmount(operation, card) {
  // Resource commands execute n directly, independently of legacy numeric fields.
  if (['energy', 'energyCap'].includes(operation.op)) {
    return onlyKeys(operation, ['op', 'n']) && Number.isInteger(operation.n) && operation.n > 0
      ? operation.n : null;
  }
  if (!onlyKeys(operation, ['op', 'amountField', 'amount'])) return null;
  const field = operation.op;
  if (operation.amountField !== undefined) {
    if (operation.amount !== undefined || operation.amountField !== field) return null;
    const amount = card[field];
    return Number.isInteger(amount) && amount > 0 ? amount : null;
  }
  const amount = operation.amount;
  if (!Number.isInteger(amount) || amount <= 0) return null;
  // onPlay validates numeric-field agreement; bag use executes its explicit amount.
  if (card.type !== '道具' && card[field] !== undefined && card[field] !== 0 && card[field] !== amount) return null;
  return amount;
}

/** Fill reviewed self-targeted onPlay sentences or a sole bag heal/draw declaration.
 * Conditional, additional or context-dependent effects retain their reviewed copy.
 * @returns {string | null} */
export function structuredCardDescription(card, reviewedText) {
  if (!isRecord(card) ||
      (card.infuse !== undefined && card.infuse !== 0) || card._registeredTriggers !== undefined) return null;
  const operations = descriptionOperations(card);
  if (!Array.isArray(operations)) return null;
  const template = templates.find(candidate => candidate.text.test(reviewedText) &&
    operations.length === candidate.operations.length &&
    candidate.operations.every((op, index) => isRecord(operations[index]) && operations[index].op === op));
  if (!template) return null;
  if (['dmg', 'heal', 'armor', 'draw'].some(field =>
    !template.operations.includes(field) && card[field] !== undefined && card[field] !== 0)) return null;
  if (operations.some(operation => operation.op === 'cleanse' &&
      (!onlyKeys(operation, ['op', 'target']) || operation.target !== 'self'))) return null;
  const amounts = operations.filter(operation => operation.op !== 'cleanse')
    .map(operation => operationAmount(operation, card));
  return amounts.includes(null) ? null : template.render(amounts, card);
}
