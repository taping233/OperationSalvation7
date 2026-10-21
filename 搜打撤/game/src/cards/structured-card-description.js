const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const onlyKeys = (value, keys) => isRecord(value) && Object.keys(value).every(key => keys.includes(key));

// Full reviewed sentences only: partial matches would hide conditions or extra effects.
const templates = [
  {
    text: /^你回复 \d+(?:\.\d+)? 点生命，并获得 \d+(?:\.\d+)? 点护甲。$/,
    operations: ['heal', 'armor'],
    render: ([heal, armor]) => `你回复 ${heal} 点生命，并获得 ${armor} 点护甲。`,
  },
  {
    text: /^你获得 \d+(?:\.\d+)? 点护甲，并抽 \d+(?:\.\d+)? 张牌。$/,
    operations: ['armor', 'draw'],
    render: ([armor, draw]) => `你获得 ${armor} 点护甲，并抽 ${draw} 张牌。`,
  },
];

function operationAmount(operation, card) {
  if (!onlyKeys(operation, ['op', 'amountField', 'amount'])) return null;
  const field = operation.op;
  if (operation.amountField !== undefined) {
    if (operation.amount !== undefined || operation.amountField !== field) return null;
    const amount = card[field];
    return Number.isInteger(amount) && amount > 0 ? amount : null;
  }
  const amount = operation.amount;
  if (!Number.isInteger(amount) || amount <= 0) return null;
  // The execution schema also rejects disagreement with an existing numeric field.
  if (card[field] !== undefined && card[field] !== 0 && card[field] !== amount) return null;
  return amount;
}

/** Fill a complete reviewed sentence from a supported self-targeted onPlay declaration.
 * Unknown fields, other timings and conditional/infused cards retain their existing copy.
 * @returns {string | null} */
export function structuredCardDescription(card, reviewedText) {
  if (!isRecord(card) || !['武术', '法术'].includes(card.type) ||
      (card.infuse !== undefined && card.infuse !== 0) || card._registeredTriggers !== undefined) return null;
  const rules = card.rules;
  if (!onlyKeys(rules, ['version', 'battle', 'triggers']) || rules.version !== 1 ||
      !onlyKeys(rules.battle, ['target']) ||
      !onlyKeys(rules.battle.target, ['side', 'area']) ||
      rules.battle.target.side !== 'self' || rules.battle.target.area !== false ||
      !onlyKeys(rules.triggers, ['onPlay'])) return null;
  const operations = rules.triggers.onPlay;
  if (!Array.isArray(operations)) return null;
  const template = templates.find(candidate => candidate.text.test(reviewedText) &&
    operations.length === candidate.operations.length &&
    candidate.operations.every((op, index) => isRecord(operations[index]) && operations[index].op === op));
  if (!template) return null;
  if (['dmg', 'heal', 'armor', 'draw'].some(field =>
    !template.operations.includes(field) && card[field] !== undefined && card[field] !== 0)) return null;
  const amounts = operations.map(operation => operationAmount(operation, card));
  return amounts.includes(null) ? null : template.render(amounts);
}
