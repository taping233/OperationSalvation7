import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { parse } from 'acorn';
import { simple } from 'acorn-walk';

// Compare function bodies independently of formatting, comments, and AST offsets.
// This is read-only review evidence; equality does not prove injected wiring.
const parseFunctions = source => {
  const functions = new Map();
  simple(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }), {
    FunctionDeclaration(node) { functions.set(node.id.name, node); },
  });
  return functions;
};
const structuralBody = (node, normalizeEquipmentPort = false) => JSON.stringify(node.body, (key, value) => {
  if (['start', 'end', 'loc', 'raw'].includes(key)) return undefined;
  // Projection now receives this exact equipment query as an injected callback.
  if (normalizeEquipmentPort && value?.type === 'MemberExpression' && !value.computed
    && value.object?.name === 'equipment' && value.property?.name === 'isBattleStartEquip') {
    return { type: 'Identifier', name: 'isBattleStartEquip' };
  }
  return value;
});
const prior = path => parseFunctions(execFileSync('git', ['show', `HEAD:搜打撤/${path}`], { encoding: 'utf8' }));
const current = path => parseFunctions(readFileSync(path, 'utf8'));
const cases = [
  ['game/src/battle/core/battle.engine.factory.domain.js', 'game/src/battle/core/battle.setup-mechanics.domain.js',
    ['injectSealCards', 'checkSealTransformation', 'applyNestRunes', 'applyVoidRune']],
  ['game/src/battle/core/battle.engine.factory.domain.js', 'game/src/battle/core/battle.snapshot-projection.domain.js',
    ['captureSnapshotInput', 'snapshotSignature', 'getSnapshot']],
  ['game/src/battle/core/battle.resolution.domain.js', 'game/src/battle/effects/battle.acquire-operation.domain.js',
    ['resolveAcquireOperation']],
  ['game/src/battle/core/battle.resolution.domain.js', 'game/src/battle/effects/battle.status-operations.domain.js',
    ['resolveCurseOperation', 'resolveBlessingOperation']],
];
const results = [];
for (const [beforePath, afterPath, names] of cases) {
  const before = prior(beforePath), after = current(afterPath);
  for (const name of names) {
    const oldNode = before.get(name), newNode = after.get(name);
    const identicalBodyAst = !!oldNode && !!newNode && structuralBody(oldNode) === structuralBody(newNode);
    const matchesInjectedEquipmentPort = name === 'captureSnapshotInput' && !!oldNode && !!newNode
      && structuralBody(oldNode, true) === structuralBody(newNode);
    results.push({ name, beforePath, afterPath, present: !!oldNode && !!newNode,
      identicalBodyAst, matchesInjectedEquipmentPort });
  }
}
console.log(JSON.stringify({ results }, null, 2));
if (results.some(result => !result.present || !result.identicalBodyAst && !result.matchesInjectedEquipmentPort)) process.exitCode = 1;
