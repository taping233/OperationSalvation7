// Recover the independently recorded post-edit bytes from the shared source plus
// separately observed concurrent fingerprint updates. Never writes project source.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const acorn = require('acorn');
const root = path.resolve(__dirname, '../../../../..');
const before = fs.readFileSync(path.join(__dirname, 'runtime-asset-redundancy-review.mjs.before'), 'utf8');
const current = fs.readFileSync(path.join(root, 'scripts/runtime-asset-redundancy-review.mjs'), 'utf8');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const ownAfterSha256 = '3d16b41f173ec4640dc93f6d1f39ac2d7033e4b42b5296b24ff40b3843cb8db4';
function opaque(source) {
  const ast = acorn.parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  return ast.body.find(node => node.type === 'ExportNamedDeclaration').declaration.declarations[0].init.arguments[0]
    .properties.find(property => property.key.name === 'opaqueConsumers').value.properties;
}
const old = new Map(opaque(before).map(property => [property.key.value, property.value.value]));
const concurrent = opaque(current).filter(property => property.value.value !== old.get(property.key.value));
const allowed = ['game/src/hub/hub.presentation.js', 'game/src/ui/card-zoom-controller.js'];
if (concurrent.length !== 2 || concurrent.some(property => !allowed.includes(property.key.value))) throw new Error('Unexpected concurrent changes');
let recovered = current;
for (const property of concurrent.toSorted((a, b) => b.start - a.start)) {
  recovered = recovered.slice(0, property.value.start) + JSON.stringify(old.get(property.key.value)) + recovered.slice(property.value.end);
}
if (hash(recovered) !== ownAfterSha256) throw new Error('Recovered bytes differ from originally recorded after fingerprint');
fs.writeFileSync(path.join(__dirname, 'runtime-asset-redundancy-review.mjs.after'), recovered);
const report = { owner: 'WF-frontend-six-residuals-clean-1023', registryReference: 'docs/PARALLEL-REGISTRY.md:41',
  registryScope: '资源复审仅更新2个原指纹已匹配的消费者', ownAfterSha256, observedSharedSourceSha256: hash(current), sourceUntouched: true,
  concurrentFingerprintChanges: concurrent.map(property => ({ file: property.key.value, before: old.get(property.key.value), current: property.value.value })) };
fs.writeFileSync(path.join(__dirname, 'parallel-observed.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
