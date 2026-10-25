import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const before = 'node_modules/.cache/lean-refactor-1024/before/';
const schemaPath = 'game/src/cards/card-rules.schema.js';
const moduleAt = file => import(pathToFileURL(path.join(root, file)).href);
const trigger = await moduleAt('game/src/cards/card-trigger-contract.js');
const semantic = await moduleAt('game/src/cards/card-semantic-contract.js');
const execution = await moduleAt('game/src/cards/card-execution-plan.js');
const metadata = await moduleAt('game/src/cards/card-healing-program.js');
const bindings = { ...trigger, ...semantic, ...execution, ...metadata };
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
function evaluate(source, ports, expression) {
  return new Function(...Object.keys(ports), source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + '\nreturn ' + expression)(...Object.values(ports));
}
const old = evaluate(read(before + schemaPath), bindings, '({ validateCardRules, ON_PLAY_OPERATION_KEYS, PENDING_ONPLAY_OPS })');
const now = evaluate(read(schemaPath), bindings, '({ validateCardRules, ON_PLAY_OPERATION_KEYS, PENDING_ONPLAY_OPS, OPERATION_SCHEMAS })');
assert.deepEqual([...now.ON_PLAY_OPERATION_KEYS].sort(), [...old.ON_PLAY_OPERATION_KEYS].sort());
assert.deepEqual([...now.PENDING_ONPLAY_OPS].sort(), [...old.PENDING_ONPLAY_OPS].sort());
const values = [undefined, null, NaN, Infinity, -Infinity, -1, 0, .5, 1, 2, Number.MAX_SAFE_INTEGER, true, false, '', '1', 'self', 'chosenEnemy', [], {}, { unknown: true }];
const counts = {};
let expectedThrows = 0;
const result = (fn, card) => {
  try { return { result: fn(card) }; }
  catch (error) { return { throws: error.name, message: error.message }; }
};
function compare(card, group) {
  const expected = result(old.validateCardRules, card);
  assert.deepEqual(result(now.validateCardRules, card), expected, group + ': ' + String(card?.id));
  if (expected.throws) expectedThrows += 1;
  counts[group] = (counts[group] || 0) + 1;
}
const cardWith = operation => ({ id: 'operation-probe', type: '法术', dmg: 2, dmgType: 'spell',
  rules: { version: 1, battle: { target: { side: 'enemy', area: false } }, triggers: { onPlay: [operation] } } });
for (const [op, [keys]] of now.OPERATION_SCHEMAS) {
  for (const key of keys) for (const value of values) for (const extra of [{}, { unknown: true }]) {
    compare(cardWith({ op, [key]: value, ...extra }), 'operationFields');
  }
}
for (const kind of ['movesPlayedDiscount', 'martialPlayedDiscount', 'consumedSpellDiscount', 'previousCardTypeFree', 'armorZeroFree', 'unknown', '__proto__']) {
  for (const amount of values) for (const type of values) {
    const entry = { kind, amount, type, amountField: undefined, unknown: true };
    compare({ id: 'modifiers', rules: { version: 1, battle: { costModifiers: [entry, { ...entry }] } } }, 'costModifiers');
  }
}
for (const kind of ['unplayable', 'deckOnly', 'infused', 'handCards', 'unknown', '__proto__']) {
  for (const count of values) for (const type of values) {
    const entry = { kind, count, type };
    compare({ id: 'requirements', rules: { version: 1, battle: { requirements: [entry, { ...entry }] } } }, 'requirements');
  }
}
for (const value of values) {
  for (const operation of [
    { op: 'damage', amount: 2, cond: value }, { op: 'damage', amount: 2, onKill: value },
    { op: 'damage', amount: 2, bonus: value }, { op: 'damage', amount: 2, hits: value },
    { op: 'damage', amount: 2, recast: value }, { op: 'damage', amount: 2, graveyard: value },
    { op: 'draw', amount: 2, filter: value }, { op: 'draw', amount: 2, handOps: value },
    { op: 'execute', cap: value }, { op: 'acquire', n: 1, pool: { kind: 'all' }, filter: value },
  ]) compare(cardWith(operation), 'nestedRecords');
  for (const equip of [value, { passive: value }, { passive: { aura: value } }, { passive: { cond: value } }]) {
    compare({ id: 'equipment', rules: { version: 1, equip } }, 'equipment');
  }
  for (const key of ['coins', 'armor', 'energy']) compare(cardWith({ op: 'damage', amount: 2, onKill: { [key]: value } }), 'nestedFields');
  for (const key of ['atk', 'maxHpBelow', 'wounded']) compare(cardWith({ op: 'execute', cap: { [key]: value } }), 'nestedFields');
}
// Use the real catalog resolver on the real JSON; no browser or live storage is modified.
const sync = JSON.parse(read('game/data/cards-sync.json'));
const catalog = evaluate(read('game/src/cards/cards.catalog.js'), { DATA: { cardsSync: sync } }, 'resolveCardCatalog');
const snapshot = await moduleAt('game/src/cards/hosted-rule-snapshot.js');
const data = evaluate(read('game/src/cards/cards.data.js'), { resolveCardCatalog: catalog, ...snapshot }, 'dataSlice');
const cards = [...sync.cards, ...Object.values(data).filter(Array.isArray).flat()];
for (const card of cards) {
  compare(card, 'builtinCards');
  for (const value of [undefined, null, {}, [], { version: 1 }, { version: 1, triggers: { onPlay: [] } }]) {
    compare({ ...card, rules: value }, 'builtinDeclarations');
  }
}
const { sourceCardLibrary } = await moduleAt('scripts/sync-cards-from-live.mjs');
// The production loader uses private sandbox storage; it does not save files.
for (const card of sourceCardLibrary()) compare(card, 'migratedBuiltinCards');
for (const operations of [[], [null], [{ op: 'heal', amount: 1 }, { op: 'draw', amount: 2 }], [{ op: 'damage', amount: 2 }, { op: 'curse', curse: 'bleed', stacks: 1, target: 'self' }]]) {
  for (const side of [undefined, null, 'self', 'enemy']) for (const area of [undefined, false, true]) {
    const card = cardWith(null);
    card.rules.triggers.onPlay = operations;
    card.rules.battle.target = { side, area };
    compare(card, 'mixedTargets');
  }
}
console.log(JSON.stringify({ passed: true, counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0), expectedThrows, globalKeySetEquivalent: true, pendingSetEquivalent: true }, null, 2));
