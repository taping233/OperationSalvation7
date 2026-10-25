// Static AST/data comparison only. Neither source module is imported or executed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const evidence = __dirname;
const root = path.resolve(evidence, '../../../../..');
const beforeSource = fs.readFileSync(path.join(evidence, 'runtime-asset-redundancy-review.mjs.before'), 'utf8');
const afterPath = path.join(root, 'scripts/runtime-asset-redundancy-review.mjs');
const afterSource = fs.readFileSync(afterPath, 'utf8');
const parse = source => acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const strip = node => JSON.parse(JSON.stringify(node, (key, value) => ['start', 'end', 'raw'].includes(key) ? undefined : value));
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const baseline = JSON.parse(fs.readFileSync(path.join(evidence, 'template-before.json'), 'utf8').replace(/^\uFEFF/, ''));
if (hash(beforeSource).toUpperCase() !== baseline.sha256) throw new Error('Original byte fingerprint changed');

const expectedHelper = parse("const retiredChest640Frames = ['small', 'medium', 'large', 'class', 'boss'].flatMap(kind =>\n"
  + '  Array.from({ length: 18 }, (_, index) => ({\n'
  + "    path: `scenes/chests/${kind}-rig-640-v1/frame-${String(index).padStart(2, '0')}.webp`,\n"
  + "    category: 'chests',\n"
  + '  })));').body[0];
const beforeAST = parse(beforeSource), afterAST = parse(afterSource);
const helper = afterAST.body.find(node => node.type === 'VariableDeclaration'
  && node.declarations[0]?.id.name === 'retiredChest640Frames');
if (!equal(strip(helper), strip(expectedHelper))) throw new Error('Helper differs from the audited fixed template');

// Enumerate only the audited template, not any expressions from the source file.
const frames = ['small', 'medium', 'large', 'class', 'boss'].flatMap(kind =>
  Array.from({ length: 18 }, (_, index) => ({
    path: `scenes/chests/${kind}-rig-640-v1/frame-${String(index).padStart(2, '0')}.webp`,
    category: 'chests',
  })));
function literal(node, spreads = false) {
  if (node.type === 'Literal') return node.value;
  if (node.type === 'ObjectExpression') return Object.fromEntries(node.properties.map(property => {
    if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init') throw new Error('Non-data property');
    return [property.key.name || property.key.value, literal(property.value, spreads)];
  }));
  if (node.type === 'ArrayExpression') return node.elements.flatMap(element => {
    if (element.type !== 'SpreadElement') return [literal(element, spreads)];
    if (!spreads || element.argument.type !== 'Identifier' || element.argument.name !== 'retiredChest640Frames') throw new Error('Unaudited spread');
    return frames;
  });
  throw new Error(`Non-literal data node: ${node.type}`);
}
function review(ast) {
  const declaration = ast.body.find(node => node.type === 'ExportNamedDeclaration');
  const value = declaration?.declaration?.declarations?.[0];
  if (value?.id.name !== 'RUNTIME_REDUNDANCY_REVIEW' || value.init?.callee?.object?.name !== 'Object'
    || value.init?.callee?.property?.name !== 'freeze') throw new Error('Public review contract changed');
  return value.init.arguments[0];
}
const before = literal(review(beforeAST)), after = literal(review(afterAST), true);
if (before.candidates.length !== 286 || after.candidates.length !== 286 || frames.length !== 90) throw new Error('Candidate count changed');
if (!equal(before.candidates.slice(0, 90), frames)) throw new Error('First 90 candidate values or order changed');
if (!equal(before, after)) throw new Error('Expanded review data or property order changed');
const report = {
  method: 'Static AST shape check, literal data decode, fixed audited template enumeration; no module execution',
  sourceBeforeSha256: hash(beforeSource), sourceAfterSha256: hash(afterSource),
  candidateCount: after.candidates.length, templatedRows: frames.length,
  expandedFirst90Sha256: hash(JSON.stringify(frames)),
  expandedReviewBeforeSha256: hash(JSON.stringify(before)),
  expandedReviewAfterSha256: hash(JSON.stringify(after)),
  propertyFingerprints: Object.fromEntries(Object.keys(before).map(key => [key, {
    beforeSha256: hash(JSON.stringify(before[key])), afterSha256: hash(JSON.stringify(after[key])),
  }])),
  exactFullDataAndOrderEqual: true,
};
fs.writeFileSync(path.join(evidence, 'template-equivalence.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
