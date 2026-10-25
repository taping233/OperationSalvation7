import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import postcss from 'postcss';

const evidence = 'docs/evidence/2026-10-24-WF-code-lean-stage1-1024/styles';
const manifest = JSON.parse(fs.readFileSync(`${evidence}/changes.json`, 'utf8'));
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
// Preserve source order for every individual property and selector. At-rules
// remain hard boundaries, including separate occurrences of identical media.
function canonical(container) {
  const output = [];
  let properties = new Map();
  function flush() {
    output.push(['properties', [...properties.entries()].sort(([a], [b]) => a.localeCompare(b))]);
    properties = new Map();
  }
  for (const node of container.nodes || []) {
    if (node.type === 'comment') continue;
    if (node.type !== 'rule' || node.nodes.some(child => !['decl', 'comment'].includes(child.type))) {
      flush();
      output.push(node.nodes ? [node.type, node.name, node.params, node.selector, canonical(node)] : [node.type, node.toString()]);
      continue;
    }
    for (const selector of postcss.list.comma(node.selector)) {
      for (const declaration of node.nodes.filter(child => child.type === 'decl')) {
        const entries = properties.get(declaration.prop) || [];
        entries.push([selector, declaration.value, !!declaration.important]);
        properties.set(declaration.prop, entries);
      }
    }
  }
  flush();
  return output;
}
const results = [];
for (const file of manifest.files) {
  const before = fs.readFileSync(`${manifest.baseline}/${file.file}`, 'utf8');
  const after = fs.readFileSync(file.file, 'utf8');
  assert.equal(sha(before), file.before.sha256, `Frozen fingerprint: ${file.file}`);
  assert.equal(sha(after), file.after.sha256, `Current fingerprint: ${file.file}`);
  const beforeRoot = postcss.parse(before, { from: file.file });
  const afterRoot = postcss.parse(after, { from: file.file });
  const comments = root => { const list = []; root.walkComments(node => list.push(node.text)); return list; };
  assert.deepEqual(comments(afterRoot), comments(beforeRoot), `Retained comments: ${file.file}`);
  assert.deepEqual(canonical(afterRoot), canonical(beforeRoot), `Expanded property order: ${file.file}`);
  // Full-block merges never reorder declarations across property families.
  // Only these two reductions move declarations between otherwise intact rules.
  for (const operation of file.operations.filter(operation => operation.kind === 'adjacent-equal-block')) {
    const support = selector => [...new Set(selector.match(/:(?:has|is|where|not)\(|:(?:focus-visible|focus-within)\b/g) || [])].sort();
    assert.deepEqual(support(operation.selectors[0]), support(operation.selectors[1]), `Selector support conditions: ${file.file}`);
    assert.equal(/::?-\w+/.test(operation.selectors.join(',')), false, `Vendor pseudo fallback: ${file.file}`);
  }
  for (const operation of file.operations.filter(operation => operation.kind !== 'adjacent-equal-block')) {
    if (operation.kind === 'shared-pseudo-ornament') {
      const rules = beforeRoot.nodes.filter(node => node.type === 'rule' && ['.slot-page .slot-deck::before', '.slot-page .slot-deck::after'].includes(node.selector));
      assert.deepEqual(rules.map(rule => rule.nodes.map(node => node.prop)), [
        ['left', 'background', 'filter'],
        ['right', 'transform', 'background', 'filter', 'animation-delay'],
      ]);
      // background and filter cannot reset left/right/transform/animation-delay;
      // ::before and ::after also represent distinct pseudo-elements.
    } else if (operation.kind === 'shared-slot-art') {
      const rules = beforeRoot.nodes.filter(node => node.type === 'rule' && operation.selectors.includes(node.selector));
      assert.equal(rules.length, 5);
      for (const rule of rules) assert.deepEqual(rule.nodes.map(node => node.prop), ['background-image', 'background-size', 'background-position']);
      // All three are distinct longhands. No background shorthand is crossed.
    } else throw new Error(`Unknown factoring proof: ${operation.kind}`);
  }
  results.push({ file: file.file, syntax: 'pass', expandedPropertyOrder: 'identical', beforeDigest: sha(JSON.stringify(canonical(beforeRoot))), afterDigest: sha(JSON.stringify(canonical(afterRoot))), factoringCommutation: 'pass' });
}
console.log(JSON.stringify({ status: 'pass', files: results }, null, 2));
