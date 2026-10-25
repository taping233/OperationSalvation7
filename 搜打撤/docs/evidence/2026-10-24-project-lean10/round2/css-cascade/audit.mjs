import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { componentScopesPlugin } from '../../../../../scripts/css-component-scopes.mjs';

// Read-only audit. Every transformation is applied to an in-memory clone only.
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../../..');
const cssDirectory = path.join(root, 'game/css');
const sha = value => createHash('sha256').update(value).digest('hex');
const size = value => Buffer.byteLength(value);
const normalize = value => value.replaceAll('\r\n', '\n');
const phases = ['duplicateDeclarations', 'adjacentDeclarationBlocks', 'adjacentMediaBlocks', 'declarationBlocksAfterMedia'];
let allowVariableValues = false;
let allowDifferentValues = false;

function filesIn(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? filesIn(absolute) : entry.name.endsWith('.css') ? [absolute] : [];
  });
}

function commentsOf(root) {
  const comments = [];
  root.walkComments(comment => comments.push(comment.toString()));
  return comments;
}

function contextOf(node) {
  const path = [];
  for (let parent = node.parent; parent && parent.type !== 'root'; parent = parent.parent) {
    if (parent.type === 'atrule') {
      // Named/anonymous layers, scope, starting-style, keyframes and unknown
      // wrappers deliberately remain outside the equivalence claim.
      if (!['media', 'supports', 'container'].includes(parent.name.toLowerCase())
        || parent.params.includes('/*')) return null;
      path.unshift(['at', parent.name, parent.params]);
    } else if (parent.type === 'rule') path.unshift(['rule', parent.selector]);
    else return null;
  }
  return path;
}

function safeDeclaration(declaration) {
  return declaration.type === 'decl' && /^-?[a-z][a-z0-9-]*$/.test(declaration.prop)
    && declaration.prop !== 'all' && !declaration.toString().includes('/*')
    && !/[\\]/.test(declaration.toString())
    && (allowVariableValues || !/\b(?:var|env|attr)\s*\(/i.test(declaration.value))
    && !/\brevert(?:-layer)?\b/i.test(declaration.value)
    && /^\s*$/.test(declaration.raws.before || '')
    && /^\s*:\s*$/.test(declaration.raws.between || ':');
}

function leafRule(rule) {
  return rule.type === 'rule' && rule.nodes?.every(node => ['decl', 'comment'].includes(node.type));
}

function declarationKey(declaration) {
  return JSON.stringify([declaration.prop, allowDifferentValues ? null : declaration.value, !!declaration.important]);
}

function removeNewEmptyParents(node) {
  while (node && node.type !== 'root' && node.nodes?.length === 0
    && (node.type === 'rule' || (node.type === 'atrule' && ['media', 'supports'].includes(node.name.toLowerCase())))) {
    const parent = node.parent;
    node.remove();
    node = parent;
  }
}

function duplicateDeclarations(root, operations, later = new Map()) {
  // Compare selectors in the already-verified finite component expansion too:
  // differently grouped wrappers can still denote the same original selector.
  const expanded = root.clone();
  componentScopesPlugin().Once(expanded);
  const selectorKeys = new Map();
  expanded.walkRules(rule => {
    const context = contextOf(rule);
    if (leafRule(rule) && context) selectorKeys.set(rule.source.start.offset,
      JSON.stringify([...context, ['rule', rule.selector]]));
  });
  const rules = [];
  root.walkRules(rule => { if (leafRule(rule)) rules.push(rule); });
  for (const rule of rules.reverse()) {
    const selectorKey = selectorKeys.get(rule.source.start.offset);
    if (!selectorKey) continue;
    if (!later.has(selectorKey)) later.set(selectorKey, new Map());
    const declarations = later.get(selectorKey);
    for (const declaration of [...rule.nodes].reverse()) {
      if (!safeDeclaration(declaration)) continue;
      const key = declarationKey(declaration), covering = declarations.get(key);
      if (covering) {
        operations.push({ type: 'duplicateDeclaration', line: declaration.source.start.line,
          laterLine: covering.source.start.line, selector: rule.selector,
          property: declaration.prop, value: declaration.value, important: !!declaration.important });
        declaration.remove();
      } else declarations.set(key, declaration);
    }
    if (!rule.nodes.length) removeNewEmptyParents(rule);
  }
}

function listCanMerge(selector) {
  if (selector.includes('\\') || selector.includes('/*')) return false;
  try {
    const ast = selectorParser().astSync(selector);
    let safe = true;
    ast.walk(node => {
      if (!['selector', 'class', 'id', 'tag', 'universal', 'combinator', 'attribute', 'nesting'].includes(node.type)) safe = false;
      if (node.type === 'attribute' && (node.insensitive || node.namespace !== undefined)) safe = false;
      if (node.type === 'nesting' && node.parent.nodes[0] !== node) safe = false;
    });
    return safe;
  } catch { return false; }
}

function declarationBlockKey(rule) {
  if (!leafRule(rule) || !rule.nodes.length || !rule.nodes.every(safeDeclaration)) return null;
  return JSON.stringify(rule.nodes.map(node => [node.prop, node.value, !!node.important]));
}

function adjacentDeclarationBlocks(root, operations) {
  root.walk(container => {
    if (!container.nodes || !['root', 'rule', 'atrule'].includes(container.type)) return;
    mergeChildren(container);
  });
  mergeChildren(root);
  function mergeChildren(container) {
    for (let index = 0; index + 1 < container.nodes.length;) {
      const first = container.nodes[index], second = container.nodes[index + 1];
      const key = declarationBlockKey(first);
      if (key && key === declarationBlockKey(second) && contextOf(first)
        && listCanMerge(first.selector) && listCanMerge(second.selector)) {
        operations.push({ type: 'adjacentDeclarationBlocks', line: first.source.start.line,
          laterLine: second.source.start.line, firstSelector: first.selector, secondSelector: second.selector,
          declarations: first.nodes.length });
        first.selector += `,\n${second.selector}`;
        second.remove();
      } else index++;
    }
  }
}

function adjacentMediaBlocks(root, operations) {
  const containers = [root];
  root.walk(node => { if (node.nodes) containers.push(node); });
  for (const container of containers) {
    for (let index = 0; index + 1 < container.nodes.length;) {
      const first = container.nodes[index], second = container.nodes[index + 1];
      if (first.type === 'atrule' && second.type === 'atrule'
        && ['media', 'supports'].includes(first.name.toLowerCase())
        && first.name === second.name && first.params === second.params && first.nodes && second.nodes
        && !first.params.includes('/*') && !first.raws.afterName?.includes('/*')
        && !second.raws.afterName?.includes('/*') && contextOf(first)) {
        operations.push({ type: 'adjacentConditionalBlocks', name: first.name, params: first.params,
          line: first.source.start.line, laterLine: second.source.start.line });
        first.append(...second.nodes);
        second.remove();
      } else index++;
    }
  }
}

const rows = [];
const allSources = [];
let variableReadUpperBoundBytes = 0;
let differentValueUnprovenUpperBoundBytes = 0;
for (const absolute of filesIn(cssDirectory).sort()) {
  const source = readFileSync(absolute, 'utf8'), tree = postcss.parse(source, { from: absolute, map: false });
  const comments = commentsOf(tree), operations = [], metrics = {};
  const passes = [duplicateDeclarations, adjacentDeclarationBlocks, adjacentMediaBlocks, adjacentDeclarationBlocks];
  let before = source;
  for (let index = 0; index < passes.length; index++) {
    const priorOperations = operations.length;
    passes[index](tree, operations);
    const after = tree.toString();
    metrics[phases[index]] = { savedBytes: size(before) - size(after),
      savedNormalizedBytes: size(normalize(before)) - size(normalize(after)),
      operations: operations.length - priorOperations };
    before = after;
  }
  assert.deepEqual(commentsOf(tree), comments, `Comment content/order: ${absolute}`);
  const file = path.relative(root, absolute).replaceAll('\\', '/');
  allSources.push({ file, source });
  // Diagnostic upper bound only. These extra candidates are deliberately not
  // included in the strict result; they require a separate variable audit.
  const relaxed = postcss.parse(source, { from: absolute, map: false }), relaxedOperations = [];
  allowVariableValues = true;
  duplicateDeclarations(relaxed, relaxedOperations);
  adjacentDeclarationBlocks(relaxed, relaxedOperations);
  adjacentMediaBlocks(relaxed, relaxedOperations);
  adjacentDeclarationBlocks(relaxed, relaxedOperations);
  allowVariableValues = false;
  variableReadUpperBoundBytes += size(normalize(source)) - size(normalize(relaxed.toString()));
  const unsafe = postcss.parse(source, { from: absolute, map: false }), unsafeOperations = [];
  allowVariableValues = true;
  allowDifferentValues = true;
  duplicateDeclarations(unsafe, unsafeOperations);
  adjacentDeclarationBlocks(unsafe, unsafeOperations);
  adjacentMediaBlocks(unsafe, unsafeOperations);
  adjacentDeclarationBlocks(unsafe, unsafeOperations);
  allowVariableValues = false;
  allowDifferentValues = false;
  differentValueUnprovenUpperBoundBytes += size(normalize(source)) - size(normalize(unsafe.toString()));
  rows.push({ file, sha256: sha(source), bytes: size(source), afterBytes: size(before),
    savedBytes: size(source) - size(before), savedNormalizedBytes: size(normalize(source)) - size(normalize(before)),
    commentCount: comments.length, metrics, operations });
  assert.equal(sha(readFileSync(absolute)), sha(source), `Concurrent modification: ${file}`);
}
const affected = rows.filter(row => row.savedBytes > 0).sort((a, b) => b.savedBytes - a.savedBytes);
function unprovenCrossFileUpperBound(differentValues) {
  const later = new Map();
  let saved = 0;
  allowVariableValues = true;
  allowDifferentValues = differentValues;
  for (const { file, source } of [...allSources].reverse()) {
    const tree = postcss.parse(source, { from: path.join(root, file), map: false });
    duplicateDeclarations(tree, [], later);
    saved += size(normalize(source)) - size(normalize(tree.toString()));
  }
  allowVariableValues = false;
  allowDifferentValues = false;
  return saved;
}
const total = field => rows.reduce((sum, row) => sum + row[field], 0);
const summary = {
  status: 'read-only in-memory audit; no CSS written; no browser or full cascade oracle run',
  generatedAt: new Date().toISOString(), files: rows.length, bytes: total('bytes'),
  affectedFiles: affected.length, savedBytes: total('savedBytes'), savedNormalizedBytes: total('savedNormalizedBytes'),
  withVariableReadsRelaxedUpperBoundNormalizedBytes: variableReadUpperBoundBytes,
  differentValueUnprovenUpperBoundNormalizedBytes: differentValueUnprovenUpperBoundBytes,
  allFilesLoadedTogetherUnprovenExactValueUpperBoundNormalizedBytes: unprovenCrossFileUpperBound(false),
  allFilesLoadedTogetherUnprovenDifferentValueUpperBoundNormalizedBytes: unprovenCrossFileUpperBound(true),
  phases: Object.fromEntries(phases.map(phase => [phase, rows.reduce((acc, row) => {
    for (const field of ['savedBytes', 'savedNormalizedBytes', 'operations']) acc[field] += row.metrics[phase][field];
    return acc;
  }, { savedBytes: 0, savedNormalizedBytes: 0, operations: 0 })])),
  meaningfulFilesAtLeast1KB: affected.filter(row => row.savedNormalizedBytes >= 1024).map(row => ({ file: row.file,
    savedNormalizedBytes: row.savedNormalizedBytes })),
  topFiles: affected.slice(0, 20).map(row => ({ file: row.file, savedNormalizedBytes: row.savedNormalizedBytes })),
};
writeFileSync(path.join(directory, 'measurement.json'), JSON.stringify({ summary, rows }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
