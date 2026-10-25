// Static source inspection only; the target module is never imported or evaluated.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const originalBytes = fs.readFileSync(path.join(__dirname, 'runtime-asset-redundancy-review.mjs.before'));
const currentBytes = fs.readFileSync(path.join(__dirname, 'runtime-asset-redundancy-review.mjs.after'));
const beforeSource = originalBytes.toString('utf8'), afterSource = currentBytes.toString('utf8');
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'before.json'), 'utf8'));
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const strip = node => JSON.parse(JSON.stringify(node, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value));
const parse = source => acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
if (hash(originalBytes) !== baseline.sha256) throw new Error('Original byte fingerprint changed');
const beforeAST = parse(beforeSource), afterAST = parse(afterSource);
const helperOf = (ast, name) => ast.body.find(node => node.type === 'VariableDeclaration' && node.declarations[0]?.id.name === name);
const expectedHelper = parse([
  'const shadowedCardArt = [',
  ...baseline.names.map(name => `  '${name}',`),
  "].flatMap(name => ['cards/', 'thumbs/cards/'].map(prefix => ({",
  '  path: `${prefix}${name}.webp`,',
  "  category: 'shadowed-card-art',",
  '})));',
].join('\n')).body[0];
const helper = helperOf(afterAST, 'shadowedCardArt');
if (!helper || helperOf(beforeAST, 'shadowedCardArt') || !equal(strip(helper), strip(expectedHelper))) throw new Error('New helper shape differs from the audited fixed 15 names/two prefixes/new object expression');
const chestBefore = helperOf(beforeAST, 'retiredChest640Frames'), chestAfter = helperOf(afterAST, 'retiredChest640Frames');
if (beforeSource.slice(chestBefore.start, chestBefore.end) !== afterSource.slice(chestAfter.start, chestAfter.end)) throw new Error('Five-round chest template source changed');
const frames = ['small', 'medium', 'large', 'class', 'boss'].flatMap(kind => Array.from({ length: 18 }, (_, index) => ({
  path: `scenes/chests/${kind}-rig-640-v1/frame-${String(index).padStart(2, '0')}.webp`, category: 'chests',
})));
const paired = baseline.names.flatMap(name => ['cards/', 'thumbs/cards/'].map(prefix => ({ path: `${prefix}${name}.webp`, category: 'shadowed-card-art' })));
if (baseline.names.length !== 15 || new Set(baseline.names).size !== 15 || paired.length !== 30 || new Set(paired).size !== 30) throw new Error('Fixed name or distinct object enumeration changed');
const spreads = new Map([['retiredChest640Frames', frames], ['shadowedCardArt', paired]]);
function literal(node, allowCardArt) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(property => {
    if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init') throw new Error('Nondata property');
    return [property.key.name || property.key.value, literal(property.value, allowCardArt)];
  }));
  if (node.type === 'ArrayExpression') return node.elements.flatMap(element => {
    if (element.type !== 'SpreadElement') return [literal(element, allowCardArt)];
    const name = element.argument.type === 'Identifier' && element.argument.name;
    if (!spreads.has(name) || (!allowCardArt && name === 'shadowedCardArt')) throw new Error('Unaudited spread');
    return spreads.get(name);
  });
  throw new Error('Nonliteral data node: ' + node.type);
}
function publicReview(ast) {
  const node = ast.body.find(item => item.type === 'ExportNamedDeclaration');
  const declaration = node?.declaration?.declarations?.[0];
  if (declaration?.id.name !== 'RUNTIME_REDUNDANCY_REVIEW' || declaration.init?.callee?.object?.name !== 'Object'
    || declaration.init?.callee?.property?.name !== 'freeze') throw new Error('Public review contract changed');
  return declaration.init.arguments[0];
}
const beforeReview = publicReview(beforeAST), afterReview = publicReview(afterAST);
const before = literal(beforeReview, false), after = literal(afterReview, true);
if (before.candidates.length !== 286 || after.candidates.length !== 286 || !equal(before, after)) {
  const changed = Object.keys(before).filter(key => !equal(before[key], after[key]));
  throw new Error('Expanded whole review data or property order changed: ' + JSON.stringify({ before: before.candidates.length, after: after.candidates.length, changed }));
}
const oldPairs = before.candidates.filter(row => row.category === 'shadowed-card-art');
if (!equal(oldPairs, paired) || hash(JSON.stringify(oldPairs)) !== baseline.selectedRowsSha256) throw new Error('Selected 30 rows changed');
const bodySkeleton = ast => ast.body.filter(node => node !== helperOf(ast, 'shadowedCardArt')).map(node => {
  const copy = strip(node);
  if (copy.type === 'ExportNamedDeclaration') {
    copy.declaration.declarations[0].init.arguments[0].properties.find(property => property.key.name === 'candidates').value = null;
  }
  return copy;
});
if (!equal(bodySkeleton(beforeAST), bodySkeleton(afterAST))) throw new Error('Noncandidate source AST changed');
const report = {
  method: 'Static AST shape check, literal decode, exact fixed template enumeration; no target module execution',
  sourceBeforeSha256: hash(originalBytes), sourceAfterSha256: hash(currentBytes), beforeBytes: originalBytes.length, afterBytes: currentBytes.length,
  savedBytes: originalBytes.length - currentBytes.length, candidates: after.candidates.length, templatedRows: paired.length,
  names: baseline.names.length, fixedPrefixes: ['cards/', 'thumbs/cards/'], distinctPairedObjects: new Set(paired).size,
  fiveRoundChestHelperByteIdentical: true, otherSourceASTEqual: true, exactFullDataAndOrderEqual: true,
  pairedRowsSha256: hash(JSON.stringify(paired)),
  expandedReviewBeforeSha256: hash(JSON.stringify(before)), expandedReviewAfterSha256: hash(JSON.stringify(after)),
  propertyFingerprints: Object.fromEntries(Object.keys(before).map(key => [key, { beforeSha256: hash(JSON.stringify(before[key])), afterSha256: hash(JSON.stringify(after[key])) }])),
};
fs.writeFileSync(path.join(__dirname, 'template-equivalence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
