// 只校验恢复消费者的结构前提；不查卡库、不修剪资产、不改变标量默认。
const record = value => value !== null && typeof value === 'object' &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
const bad = path => ({ ok: false, code: 'INVALID_RUN_STRUCTURE', message: `对局存档字段 ${path} 结构无效`, preserveRun: true });

function arrayField(value, path, itemCheck, nullable = true) {
  if (value === undefined || (nullable && value === null)) return null;
  if (!Array.isArray(value)) return bad(path);
  for (let i = 0; i < value.length; i++) {
    const issue = itemCheck?.(value[i], `${path}[${i}]`);
    if (issue) return issue;
  }
  return null;
}
const recordItem = (value, path) => record(value) ? null : bad(path);
const cardItem = (value, path) => recordItem(value, path) || recordItem(value.card, `${path}.card`);
const runeItem = (value, path) => recordItem(value, path) ||
  (!Array.isArray(value.attrs) ? bad(`${path}.attrs`) : null);
const entryItem = (value, path) => Array.isArray(value) && value.length >= 2 ? null : bad(path);
const shopItem = (value, path) => recordItem(value, path) ||
  (value.card != null || (!value.empty && !value.sold && !value.mystery) ? recordItem(value.card, `${path}.card`) : null);

function runFields(data, prefix = '', checkpoint = false) {
  const collections = {
    inventory: recordItem, ownedCards: cardItem, usedPocket: cardItem, cardBox: recordItem,
    cardOrder: null, eventLog: null, discovered: null,
  };
  for (const [key, check] of Object.entries(collections)) {
    const issue = arrayField(data[key], prefix + key, check, !checkpoint);
    if (issue) return issue;
  }
  for (const key of ['visited', 'seen', 'shopStocks']) {
    if (data[key] != null && !record(data[key])) return bad(prefix + key);
  }
  for (const [key, stock] of Object.entries(data.shopStocks || {})) {
    const issue = arrayField(stock, `${prefix}shopStocks.${key}`, shopItem);
    if (issue) return issue;
  }
  // 与地图恢复相同：仅严格 true 进入龙巢；字符串 "false" 仍走普通图。
  if (data.nestActive === true || checkpoint) {
    for (const key of ['nestRunes', 'nestEquipped', 'pendingRunePick']) {
      const issue = arrayField(data[key], prefix + key, runeItem, !checkpoint || key === 'pendingRunePick');
      if (issue) return issue;
    }
  }
  return null;
}

function battleFields(data) {
  if (data == null) return null;
  if (!record(data)) return bad('battle');
  if (data.opts != null && !record(data.opts)) return bad('battle.opts');
  if (data.opts?.nest != null) {
    if (!record(data.opts.nest)) return bad('battle.opts.nest');
    const issue = arrayField(data.opts.nest.runes, 'battle.opts.nest.runes', runeItem);
    if (issue) return issue;
  }
  if (data.restartVersion === 1 && data.enemyDefs != null) {
    const enemies = arrayField(data.enemyDefs, 'battle.enemyDefs', recordItem);
    if (enemies) return enemies;
  }
  if (data.restartVersion === 1 && Array.isArray(data.enemyDefs) && data.opts) {
    if (data.run != null) {
      if (!record(data.run)) return bad('battle.run');
      const issue = runFields(data.run, 'battle.run.', true);
      if (issue) return issue;
    }
    return arrayField(data.selectedDeck, 'battle.selectedDeck');
  }
  // 旧格式 restore 直接展开这些牌区、构造 Map/Set，再逐个访问参战者。
  for (const key of ['hand', 'drawPile', 'discard', 'grave', 'played', 'consumed', 'lastDrawnUids', 'growthNames']) {
    const issue = arrayField(data[key], `battle.${key}`);
    if (issue) return issue;
  }
  for (const key of ['foes', 'allies', 'delayed']) {
    const issue = arrayField(data[key], `battle.${key}`, recordItem);
    if (issue) return issue;
  }
  const granted = arrayField(data.granted, 'battle.granted', cardItem);
  if (granted) return granted;
  for (const key of ['zeroFeeUntil', 'cardOverrides']) {
    const issue = arrayField(data[key], `battle.${key}`, entryItem);
    if (issue) return issue;
  }
  return null;
}

export function validateRunSave(data) {
  if (!record(data)) return bad('run');
  return runFields(data) || battleFields(data.battle) || { ok: true };
}
