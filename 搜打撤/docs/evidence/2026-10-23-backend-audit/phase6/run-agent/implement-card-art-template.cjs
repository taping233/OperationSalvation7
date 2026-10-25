// Narrow source edit with a byte fingerprint guard; does not execute the target module.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../../../../..');
const target = path.join(root, 'scripts/runtime-asset-redundancy-review.mjs');
const bytes = fs.readFileSync(target), source = bytes.toString('utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const expected = '49555694de08ddaae990ab4d3ac2db950726f41f34f52a8716a9aabc0e54be83';
if (hash(bytes) !== expected) throw new Error('Source changed since exact scope review');
const names = [
  'spell-tt8-curse1',
  'spell-tt8-curse2',
  'spell-tt8-curse3',
  'spell-tt8-curse4',
  'equip-tt3-staff',
  'equip-tt3-fate-wheel',
  'equip-tt3-wolf-bow',
  'equip-tt3-twinwater-mail',
  'equip-tt3-grass-armor',
  'equip-tt3-blooddrinker',
  'equip-tt8-demonslay',
  'equip-tt8-archdemon',
  'equip-tt8-heavensword',
  'equip-tt7-arcanescroll',
  'equip-tt12-raygun',
];
const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const publicNode = ast.body.find(node => node.type === 'ExportNamedDeclaration');
const review = publicNode.declaration.declarations[0].init.arguments[0];
const rows = review.properties.find(property => property.key.name === 'candidates').value.elements;
const selected = rows.filter(row => row.type === 'ObjectExpression'
  && row.properties.some(property => property.key.value === 'category' && property.value.value === 'shadowed-card-art'));
const actual = selected.map(row => Object.fromEntries(row.properties.map(property => [property.key.value, property.value.value])));
const expectedRows = names.flatMap(name => ['cards/', 'thumbs/cards/'].map(prefix => ({ path: `${prefix}${name}.webp`, category: 'shadowed-card-art' })));
if (JSON.stringify(actual) !== JSON.stringify(expectedRows) || selected.length !== 30) throw new Error('Pairs or property order changed');
const first = rows.indexOf(selected[0]);
if (!selected.every((row, index) => rows[first + index] === row)) throw new Error('Nonconsecutive selected rows');
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const from = source.lastIndexOf('\n', selected[0].start) + 1;
const to = source.indexOf('\n', selected.at(-1).end) + 1;
const helper = [
  'const shadowedCardArt = [',
  ...names.map(name => `  '${name}',`),
  "].flatMap(name => ['cards/', 'thumbs/cards/'].map(prefix => ({",
  '  path: `${prefix}${name}.webp`,',
  "  category: 'shadowed-card-art',",
  '})));',
  '',
].join(newline);
const original = path.join(__dirname, 'runtime-asset-redundancy-review.mjs.before');
fs.writeFileSync(original, bytes, { flag: 'wx' });
if (hash(fs.readFileSync(original)) !== expected) throw new Error('Original byte snapshot mismatch');
fs.writeFileSync(path.join(__dirname, 'before.json'), JSON.stringify({ file: 'scripts/runtime-asset-redundancy-review.mjs', bytes: bytes.length,
  lines: source.split('\n').length - Number(source.endsWith('\n')), sha256: expected, selectedRows: selected.length,
  selectedRowsSha256: hash(JSON.stringify(actual)), names }, null, 2) + '\n', { flag: 'wx' });
let after = source.slice(0, from) + '    ...shadowedCardArt,' + newline + source.slice(to);
after = after.replace('export const RUNTIME_REDUNDANCY_REVIEW', helper + newline + 'export const RUNTIME_REDUNDANCY_REVIEW');
acorn.parse(after, { ecmaVersion: 'latest', sourceType: 'module' });
if (hash(fs.readFileSync(target)) !== expected) throw new Error('Source changed before write');
fs.writeFileSync(target, after);
console.log(JSON.stringify({ beforeBytes: bytes.length, afterBytes: Buffer.byteLength(after), beforeSha256: expected, afterSha256: hash(after),
  selectedRows: selected.length, names: names.length }, null, 2));
