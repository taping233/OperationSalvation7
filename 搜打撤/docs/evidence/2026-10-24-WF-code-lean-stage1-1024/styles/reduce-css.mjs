import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import postcss from 'postcss';

const directory = 'game/css';
const evidence = 'docs/evidence/2026-10-24-WF-code-lean-stage1-1024/styles';
const baseline = 'node_modules/.cache/lean-stage1-1024/before';
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const declarations = rule => rule.nodes.map(node => [node.type, node.prop, node.value, !!node.important]);
const plainRule = node => node.type === 'rule' && node.nodes.every(child => child.type === 'decl');
const conditionalParent = parent => parent.type === 'root' ||
  (parent.type === 'atrule' && /^(media|supports|container|layer)$/.test(parent.name) && conditionalParent(parent.parent));
// A newly unsupported arm must not invalidate a previously independent fallback.
const support = selector => [...new Set(selector.match(/:(?:has|is|where|not)\(|:(?:focus-visible|focus-within)\b/g) || [])].sort().join('|');
const stats = text => {
  const root = postcss.parse(text);
  let rules = 0;
  let decls = 0;
  root.walkRules(() => rules++);
  root.walkDecls(() => decls++);
  return { sha256: sha(text), bytes: Buffer.byteLength(text), normalizedBytes: Buffer.byteLength(text.replace(/\r\n/g, '\n')), lines: text.split('\n').length, rules, declarations: decls };
};
const changes = [];
for (const name of fs.readdirSync(directory).filter(name => name.endsWith('.css'))) {
  // The existing audio-retry contract deliberately checks two standalone rules.
  if (name === 'settings-audio.css') continue;
  const file = `${directory}/${name}`;
  const before = fs.readFileSync(file, 'utf8');
  const frozen = fs.readFileSync(path.join(baseline, file), 'utf8');
  if (before !== frozen) throw new Error(`Input changed since batch freeze: ${file}`);
  const root = postcss.parse(before, { from: file });
  const operations = [];
  root.walkRules(rule => {
    if (!plainRule(rule) || !conditionalParent(rule.parent)) return;
    let next = rule.next();
    while (next && plainRule(next) &&
      JSON.stringify(declarations(rule)) === JSON.stringify(declarations(next)) &&
      support(rule.selector) === support(next.selector) &&
      !/::?-\w+/.test(rule.selector + next.selector)) {
      operations.push({ kind: 'adjacent-equal-block', line: rule.source.start.line, selectors: [rule.selector, next.selector], declarations: declarations(rule) });
      rule.selector += `,\n${next.selector}`;
      const following = next.next();
      next.remove();
      next = following;
    }
  });
  if (name === 'page-slot-select.css') {
    const rules = [...root.nodes].filter(node => node.type === 'rule');
    const shared = rules.find(rule => rule.selector === '.slot-page .slot-deck::before,\n.slot-page .slot-deck::after');
    const beforeRule = rules.find(rule => rule.selector === '.slot-page .slot-deck::before');
    const afterRule = rules.find(rule => rule.selector === '.slot-page .slot-deck::after');
    if (!shared || shared.next() !== beforeRule || beforeRule.next() !== afterRule) throw new Error('Slot ornament rules moved');
    for (const prop of ['background', 'filter']) {
      const first = beforeRule.nodes.find(node => node.prop === prop);
      const second = afterRule.nodes.find(node => node.prop === prop);
      if (!first || first.value !== second?.value || first.important !== second.important) throw new Error(`Slot ${prop} mismatch`);
      shared.append(first.clone());
      first.remove();
      second.remove();
    }
    operations.push({ kind: 'shared-pseudo-ornament', selectors: [shared.selector], properties: ['background', 'filter'], independentProperties: ['left', 'right', 'transform', 'animation-delay'] });
  }
  if (name === 'winter.css') {
    const rules = [1, 2, 3, 4, 5].map(index => root.nodes.find(node => node.type === 'rule' && node.selector === `.slot-card.slot-art-${index} .slot-card-bg`));
    if (rules.some(rule => !rule) || rules.slice(1).some((rule, index) => rules[index].next() !== rule)) throw new Error('Slot art rules moved');
    const shared = postcss.rule({ selector: rules.map(rule => rule.selector).join(',\n') });
    for (const prop of ['background-image', 'background-size']) {
      const matches = rules.map(rule => rule.nodes.find(node => node.prop === prop));
      if (matches.some(node => !node || node.value !== matches[0].value || node.important !== matches[0].important)) throw new Error(`Slot art ${prop} mismatch`);
      shared.append(matches[0].clone());
      matches.forEach(node => node.remove());
    }
    rules[0].before(shared);
    operations.push({ kind: 'shared-slot-art', selectors: rules.map(rule => rule.selector), properties: ['background-image', 'background-size'], independentProperties: ['background-position'] });
  }
  if (!operations.length) continue;
  const after = root.toString();
  fs.writeFileSync(file, after);
  changes.push({ file, before: stats(before), after: stats(after), operations });
}
fs.writeFileSync(`${evidence}/changes.json`, `${JSON.stringify({ baseline, files: changes }, null, 2)}\n`);
console.log(JSON.stringify({ files: changes.length, operations: changes.reduce((n, f) => n + f.operations.length, 0), savedBytes: changes.reduce((n, f) => n + f.before.bytes - f.after.bytes, 0), savedDeclarations: changes.reduce((n, f) => n + f.before.declarations - f.after.declarations, 0) }));
