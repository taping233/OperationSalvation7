import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parse } from 'acorn';
import * as walk from 'acorn-walk';

// Static source comparison only: this script never imports or executes game code.
const root = process.cwd();
const evidence = path.join(root, 'docs/evidence/2026-10-23-backend-audit/phase6/storage');
const source = path.join(root, 'game/src/hub/base.js');
const beforePath = path.join(evidence, 'base.js.before.txt');
const original = fs.readFileSync(beforePath);
const current = fs.readFileSync(source);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex').toUpperCase();
assert.equal(sha256(original), '6C81008034E007C142377A7B31A3D460CCB6AD892DAFF6CCB6467E7C1B396237');
const parseSource = bytes => parse(bytes.toString('utf8'), { ecmaVersion: 'latest', sourceType: 'module' });
const before = parseSource(original);
const after = parseSource(current);
function clean(value) {
  if (Array.isArray(value)) return value.map(clean);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !['start', 'end', 'loc', 'range', 'raw'].includes(key))
    .map(([key, item]) => [key, clean(item)]));
  return value;
}
function functions(tree) {
  const result = new Map();
  walk.simple(tree, { FunctionDeclaration(node) {
    const name = node.id?.name;
    if (name && ['commitUpgrade', 'upgradeBag', 'upgradePet', 'upgradeStash', 'upgradeNestBag'].includes(name)) {
      assert(!result.has(name), `Duplicate declaration ${name}`);
      result.set(name, node);
    }
  } });
  return result;
}
const oldFunctions = functions(before);
const newFunctions = functions(after);
assert.equal(oldFunctions.size, 4);
assert.equal(newFunctions.size, 5);
const helper = newFunctions.get('commitUpgrade');
const expectedHelper = parseSource(`function commitUpgrade(allowed, prepare) {
  if (!allowed) return false;
  const ok = mutate(draft => { prepare(draft); return true; });
  if (ok) sfxLevelup();
  return ok;
}`).body[0];
assert.deepStrictEqual(clean(helper), clean(expectedHelper));

const expanded = new Map();
const results = [];
for (const name of ['upgradeBag', 'upgradePet', 'upgradeStash', 'upgradeNestBag']) {
  const previous = oldFunctions.get(name);
  const next = newFunctions.get(name);
  assert(previous && next);
  assert.equal(next.body.body.length, 1);
  const returnStatement = next.body.body[0];
  assert.equal(returnStatement.type, 'ReturnStatement');
  const call = returnStatement.argument;
  assert.equal(call.type, 'CallExpression');
  assert.equal(call.callee.name, 'commitUpgrade');
  assert.equal(call.arguments.length, 2);
  const [eligibility, preparation] = call.arguments;
  assert.equal(preparation.type, 'ArrowFunctionExpression');
  assert.equal(preparation.async, false);
  assert.equal(preparation.expression, false);
  const declaration = clean(next);
  declaration.body.body = clean(helper.body.body);
  declaration.body.body[0].test.argument = clean(eligibility);
  const mutation = declaration.body.body[1].declarations[0].init.arguments[0];
  assert.deepStrictEqual(mutation.params, clean(preparation.params));
  const successReturn = mutation.body.body[1];
  assert.equal(successReturn.type, 'ReturnStatement');
  assert.equal(successReturn.argument.value, true);
  mutation.body.body = [...clean(preparation.body.body), successReturn];
  // This compares the complete original function, not just its mutation body.
  assert.deepStrictEqual(declaration, clean(previous), `Expanded AST changed ${name}`);
  expanded.set(name, declaration);
  results.push({ function: name, fullExpandedFunctionAstEqual: true,
    eligibility: 'same expression, once, before mutate',
    preparation: 'same complete ordered statement list inside mutate callback',
    failure: 'returns false before mutate or preparation',
    success: 'same ok truthiness, level-up sound, returned value' });
}

function inlineTree(value) {
  if (Array.isArray(value)) return value.filter(item => !(item?.type === 'FunctionDeclaration' && item.id?.name === 'commitUpgrade')).map(inlineTree);
  if (value && typeof value === 'object') {
    if (value.type === 'FunctionDeclaration' && expanded.has(value.id?.name)) return expanded.get(value.id.name);
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, inlineTree(item)]));
  }
  return value;
}
assert.deepStrictEqual(inlineTree(clean(after)), clean(before), 'Other source AST changed');

const run = args => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.error) throw result.error;
  assert([0, 1].includes(result.status), result.stderr);
  return result;
};
const diff = run(['diff', '--no-index', '--', beforePath, source]);
assert.equal(diff.status, 1);
const hunk = diff.stdout.indexOf('@@ ');
assert(hunk >= 0);
fs.writeFileSync(path.join(evidence, 'base.js.patch'),
  'diff --git a/搜打撤/game/src/hub/base.js b/搜打撤/game/src/hub/base.js\n' +
  '--- a/搜打撤/game/src/hub/base.js\n+++ b/搜打撤/game/src/hub/base.js\n' + diff.stdout.slice(hunk));
const numstat = run(['diff', '--no-index', '--numstat', '--', beforePath, source]);
const [added, removed] = numstat.stdout.trim().split('\t').map(Number);
assert.equal(added, 11);
assert.equal(removed, 20);
const measure = bytes => {
  const text = bytes.toString('utf8');
  return { bytes: bytes.length, lines: (text.match(/\n/g) || []).length,
    crlf: (text.match(/\r\n/g) || []).length, bareLf: (text.match(/(?<!\r)\n/g) || []).length,
    sha256: sha256(bytes) };
};
const manifest = { source: 'game/src/hub/base.js', before: measure(original), after: measure(current),
  delta: { added, removed, netRemoved: removed - added }, checks: {
    helperAstMatchesDeclaredSkeleton: true, functions: results,
    wholeFileAstEqualAfterInliningHelper: true,
    scope: 'Static syntax/AST/diff only; game source was not imported or executed.' } };
fs.writeFileSync(path.join(evidence, 'ast-equivalence.json'), JSON.stringify(manifest, null, 2) + '\n');
process.stdout.write(JSON.stringify(manifest, null, 2) + '\n');
