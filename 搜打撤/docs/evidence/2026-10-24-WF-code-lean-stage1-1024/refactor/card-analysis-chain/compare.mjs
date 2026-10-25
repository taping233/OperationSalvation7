import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const at = file => import(pathToFileURL(path.resolve(file)).href);
const schema = await at('game/src/cards/card-rules.schema.js');
const execution = await at('game/src/cards/card-execution-plan.js');
const semantic = await at('game/src/cards/card-semantic-contract.js');
const trigger = await at('game/src/cards/card-trigger-contract.js');
const { KEY } = await at('game/src/cards/cards.consts.js');
const { sameCardSnapshot: sameSnapshot } = await at('game/src/cards/card-snapshot.js');
const { canonicalTables } = await at('game/src/cards/card-rule-definitions.js');
const before = 'node_modules/.cache/lean-refactor-1024/card-analysis-chain/before/';
const read = file => fs.readFileSync(file, 'utf8');
const evaluate = (source, bindings, expression) => new Function(...Object.keys(bindings),
  source.replace(/^import .*;\r?\n/gm, '').replaceAll('export ', '') + '\nreturn ' + expression)(...Object.values(bindings));
const ports = { ...schema, ...execution, ...semantic, ...trigger };

function load(prefix, calls) {
  const validateCardRules = card => {
    calls.push({ id: card?.id, root: !!card?.rules?.equip, input: JSON.stringify(card) });
    return schema.validateCardRules(card);
  };
  const capability = evaluate(read(prefix + 'game/src/cards/card-rules.capability.js'),
    { ...ports, validateCardRules }, '({ inspectCardRuleCapability, analyzeCardRules: typeof analyzeCardRules === "function" ? analyzeCardRules : undefined })');
  const createRuleBackfiller = evaluate(read(prefix + 'game/src/cards/cards.sync.backfiller.js'),
    { KEY, validateCardRules, ...capability, sameSnapshot }, 'createRuleBackfiller');
  return { ...capability, createRuleBackfiller };
}

function m7(prefix) {
  const calls = [];
  const loaded = load(prefix, calls);
  const migrate = evaluate(read('game/src/cards/cards.sync.m7.js'),
    { createRuleBackfiller: loaded.createRuleBackfiller, canonicalTables }, 'ensureM7EquipRules');
  const fixture = evaluate(read('tests/m7-data.test.js').split("describe('M7")[0], { KEY }, 'makeHarness(fresh())');
  migrate(fixture);
  const roots = new Map();
  for (const call of calls.filter(call => call.root)) roots.set(call.input, (roots.get(call.input) || 0) + 1);
  return { calls, roots, cards: fixture.cards(), saves: fixture.library.saves,
    stored: fixture.storage.getItem(KEY), marker: fixture.storage.getItem('sdt-cards-m7-equip-rules-v1-seeded') };
}
const oldM7 = m7(before), newM7 = m7('');
assert.deepEqual(newM7.cards, oldM7.cards);
assert.equal(newM7.stored, oldM7.stored);
assert.equal(newM7.marker, '1');
assert.equal(newM7.saves, oldM7.saves);
assert.equal(oldM7.calls.length, 49);
assert.equal(newM7.calls.length, 34);
assert.equal(oldM7.roots.size, 15);
assert.equal(newM7.roots.size, 15);
assert.deepEqual([...newM7.roots.keys()], [...oldM7.roots.keys()]);
assert([...oldM7.roots.values()].every(count => count === 2));
assert([...newM7.roots.values()].every(count => count === 1));
assert.equal(oldM7.calls.filter(call => !call.root).length, 19);
assert.equal(newM7.calls.filter(call => !call.root).length, 19);

const old = load(before, []), now = load('', []);
const outcome = operation => {
  try { return operation(); }
  catch (error) { return { throws: error.name, message: error.message }; }
};
const values = [undefined, null, false, 0, NaN, -1, 1, 2, '', 'wrong', [], {}, { unknown: true }];
let parityCases = 0;
function compare(card) {
  assert.deepEqual(outcome(() => now.inspectCardRuleCapability(card)), outcome(() => old.inspectCardRuleCapability(card)));
  assert.deepEqual(outcome(() => now.analyzeCardRules(card)), outcome(() => {
    const validation = schema.validateCardRules(card);
    return { validation, capability: validation.ok ? old.inspectCardRuleCapability(card)
      : { kind: 'invalid', ok: false, issues: validation.errors } };
  }));
  parityCases += 1;
}
for (const value of values) compare(value);
for (const op of ['damage', 'heal', 'armor', 'draw', 'acquire', 'curse', 'execute', 'unknown']) {
  for (const amount of values) for (const registered of values) {
    const card = { id: 'parity', type: '法术', rules: { version: 1,
      battle: { target: { side: 'self', area: false } }, triggers: { onPlay: [{ op, amount }] } } };
    if (registered !== undefined) card._registeredTriggers = registered;
    compare(card);
  }
}
for (const card of newM7.cards) compare(card);
console.log(JSON.stringify({ passed: true, measurement: 'One real M7 15-card fixture, not all catalogs',
  before: { schemaCalls: 49, rootInputs: 15, rootCallsPerInput: 2, isolatedViewCalls: 19 },
  after: { schemaCalls: 34, rootInputs: 15, rootCallsPerInput: 1, isolatedViewCalls: 19 },
  schemaCallReductionPercent: 15 / 49 * 100, saves: newM7.saves, savedOutputEquivalent: true,
  publicInspectAndCombinedPipelineParityCases: parityCases }, null, 2));
