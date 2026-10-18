import { createRequire } from 'node:module';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const require = createRequire(path.join(root, 'package.json'));
const postcss = require('postcss');
const bundle = path.join(root, '.tmp/page-perf-1018/exe-build/project/desktop-app/game/assets');
const temporary = path.join(root, '.tmp/perf-budgets-1018/css');
mkdirSync(temporary, { recursive: true });
const hash = value => createHash('sha256').update(value).digest('hex');
const measured = text => ({ bytes: Buffer.byteLength(text), gzip: gzipSync(text).length });
const plain = node => node.type === 'rule' && node.nodes.every(child => child.type === 'decl');
const declarations = node => JSON.stringify(node.nodes.map(({ prop, value, important }) => [prop, value, !!important]));
const ordinaryContext = parent => parent.type === 'root' || parent.type === 'atrule'
  && ['media', 'supports', 'container', 'document'].includes(parent.name.toLowerCase());
function safeParents(tree, callback) {
  const visit = parent => {
    if (!ordinaryContext(parent)) return;
    callback(parent);
    for (const child of parent.nodes || []) if (child.type === 'atrule' && child.nodes) visit(child);
  };
  visit(tree);
}
function deduplicate(tree, removed) {
  safeParents(tree, parent => {
    const seen = new Map();
    for (const node of [...parent.nodes].reverse()) {
      if (!plain(node)) continue;
      const signature = JSON.stringify([node.selector, declarations(node)]);
      if (seen.has(signature)) {
        removed.push({ selector: node.selector, bytes: Buffer.byteLength(node.toString()), context: parent.type === 'root' ? 'root' : `@${parent.name} ${parent.params}` });
        node.remove();
      } else seen.set(signature, node);
    }
  });
}
// No pseudo-classes/elements, namespaces or escaped identifiers: combining
// selectors cannot introduce an unsupported selector that invalidates a list.
const legacySelector = selector => /^[a-zA-Z0-9_.#*\s>+~,\[\]="'\-]+$/.test(selector);
function mergeAdjacent(tree, merged) {
  safeParents(tree, parent => {
    for (let i = 1; i < parent.nodes.length;) {
      const previous = parent.nodes[i - 1], node = parent.nodes[i];
      if (plain(previous) && plain(node) && legacySelector(previous.selector) && legacySelector(node.selector)
        && declarations(previous) === declarations(node)) {
        merged.push({ before: [previous.selector, node.selector], bytes: Buffer.byteLength(node.nodes.map(child => child.toString()).join(';')) });
        node.selector = `${previous.selector},${node.selector}`;
        previous.remove();
      } else i++;
    }
  });
}
const names = readdirSync(bundle).filter(name => name.endsWith('.css')).sort();
const report = { date: '2026-10-18', input: path.relative(root, bundle).replaceAll('\\', '/'), budget: 136 * 1024, files: [], experiments: {} };
for (const name of names) {
  const source = readFileSync(path.join(bundle, name), 'utf8');
  const tree = postcss.parse(source);
  let declarationsBytes = 0, selectorBytes = 0, fontFaceBytes = 0, keyframesBytes = 0, layers = 0, rules = 0;
  tree.walkRules(node => { rules++; selectorBytes += Buffer.byteLength(node.selector); });
  tree.walkDecls(node => { declarationsBytes += Buffer.byteLength(node.toString()); });
  tree.walkAtRules(node => {
    if (node.name === 'font-face') fontFaceBytes += Buffer.byteLength(node.toString());
    if (/keyframes$/i.test(node.name)) keyframesBytes += Buffer.byteLength(node.toString());
    if (node.name === 'layer') layers++;
  });
  report.files.push({ name, sha256: hash(source), ...measured(source), rules, selectorBytes, declarationsBytes, fontFaceBytes, keyframesBytes, layers });
  for (const experiment of ['same-parent-exact-duplicates', 'adjacent-identical-declarations', 'both']) {
    const changed = tree.clone(), removed = [], merged = [];
    if (experiment !== 'adjacent-identical-declarations') deduplicate(changed, removed);
    if (experiment !== 'same-parent-exact-duplicates') mergeAdjacent(changed, merged);
    const output = changed.toString();
    const group = report.experiments[experiment] ||= { files: [], removed: [], merged: [] };
    group.files.push({ name, ...measured(output), sha256: hash(output) });
    group.removed.push(...removed.map(row => ({ file: name, ...row })));
    group.merged.push(...merged.map(row => ({ file: name, ...row })));
    const directory = path.join(temporary, experiment); mkdirSync(directory, { recursive: true });
    writeFileSync(path.join(directory, name), output, 'utf8');
  }
}
report.total = { bytes: report.files.reduce((sum, file) => sum + file.bytes, 0), gzip: report.files.reduce((sum, file) => sum + file.gzip, 0) };
report.excess = report.total.gzip - report.budget;
for (const group of Object.values(report.experiments)) {
  group.total = { bytes: group.files.reduce((sum, file) => sum + file.bytes, 0), gzip: group.files.reduce((sum, file) => sum + file.gzip, 0) };
  group.saved = { bytes: report.total.bytes - group.total.bytes, gzip: report.total.gzip - group.total.gzip };
}
writeFileSync(new URL('./audit.json', import.meta.url), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ baseline: report.total, budget: report.budget, excess: report.excess, files: report.files.map(({ name, bytes, gzip, fontFaceBytes, keyframesBytes }) => ({ name, bytes, gzip, fontFaceBytes, keyframesBytes })), experiments: Object.fromEntries(Object.entries(report.experiments).map(([name, group]) => [name, { saved: group.saved, total: group.total, removed: group.removed.length, merged: group.merged.length }])) }, null, 2));
