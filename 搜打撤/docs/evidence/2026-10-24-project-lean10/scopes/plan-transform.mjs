import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import postcss from 'postcss';
import parser from 'postcss-selector-parser';
import { selectorSpecificity } from '@csstools/selector-specificity';

const evidence = 'docs/evidence/2026-10-24-project-lean10/scopes';
const cache = 'node_modules/.cache/project-lean10-scopes-before';
const excluded = /^(?:card-browser|container-store|base-collection-v4|hub-cover-collections|bag-design-system|collection-workspace|base-rooms-v7|photo-studio[^.]*)\.css$/;
const hash = value => createHash('sha256').update(value).digest('hex');
const bytes = value => Buffer.byteLength(value);
const normalized = value => value.replaceAll('\r\n', '\n');
const part = node => node.type === 'combinator' ? (node.value.trim() || ' ')
  : node.clone({ spaces: { before: '', after: '' } }).toString();
const canonical = value => parser().astSync(value).nodes.map(s => s.nodes.map(part).join('')).join(',');
const pseudoElement = node => node.type === 'pseudo'
  && (/^::/.test(node.value) || /^:(before|after|first-line|first-letter)$/i.test(node.value));

function signature(parent) {
  return (parent.nodes || []).flatMap(node => {
    if (node._scoped) return signature(node);
    if (node.type === 'rule') return [['rule', canonical(node.selector), signature(node)]];
    if (node.type === 'atrule') return [['at', node.name, node.params, signature(node)]];
    if (node.type === 'decl' || node.type === 'comment') return [[node.type, node.toString()]];
    return [[node.type, node.toString()]];
  });
}

function transform(source) {
  const root = postcss.parse(source), original = signature(root), examples = [];
  const eol = source.includes('\r\n') ? '\r\n' : '\n';
  let structural = 0, groups = 0, specificityChecks = 0;
  function visit(parent) {
    if (parent.type === 'atrule' && /keyframes$/.test(parent.name)) return;
    const runs = []; let run = [];
    const flush = () => { if (run.length) runs.push(run); run = []; };
    for (const rule of parent.nodes || []) {
      if (rule.type === 'comment') continue;
      if (rule.type === 'rule' && rule.nodes.every(n => ['decl', 'comment'].includes(n.type))
        && !rule.selector.includes('&')) {
        const selectors = parser().astSync(rule.selector).nodes.map(s => ({
          ast: s, nodes: s.nodes, parts: s.nodes.map(part), specificity: selectorSpecificity(s),
        }));
        run.push({ rule, selectors });
      } else { flush(); if (rule.nodes) visit(rule); }
    }
    flush();
    for (const rules of runs) {
      const size = rules.length, dp = Array(size + 1).fill(0), choices = Array(size);
      for (let first = size - 1; first >= 0; first--) {
        dp[first] = dp[first + 1]; let prefix = null, selectorCount = 0;
        for (let last = first; last < size; last++) {
          for (const selector of rules[last].selectors) {
            selectorCount++;
            if (prefix === null) prefix = selector.parts.slice();
            else {
              let shared = 0;
              while (shared < Math.min(prefix.length, selector.parts.length)
                && prefix[shared] === selector.parts[shared]) shared++;
              prefix.length = shared;
            }
          }
          if (!prefix?.length) break;
          let length = prefix.length;
          while (length && (rules[first].selectors[0].nodes[length - 1].type === 'combinator'
            || rules[first].selectors[0].nodes.slice(0, length).some(pseudoElement))) length--;
          if (last === first || !length) continue;
          const name = prefix.slice(0, length).join('');
          const saving = (selectorCount - 1) * bytes(name) - selectorCount - 3;
          if (saving > 0 && saving + dp[last + 1] > dp[first]) {
            dp[first] = saving + dp[last + 1];
            choices[first] = { last, length, saving };
          }
        }
      }
      const selected = [];
      for (let first = 0; first < size;) {
        const choice = choices[first];
        if (choice && dp[first] === choice.saving + dp[choice.last + 1]) {
          selected.push({ first, ...choice }); first = choice.last + 1;
        } else first++;
      }
      for (const group of selected.reverse()) {
        const first = rules[group.first], last = rules[group.last];
        const prefixNodes = first.selectors[0].nodes.slice(0, group.length).map(n => n.clone());
        prefixNodes[0].spaces.before = '';
        const prefixText = prefixNodes.map(n => n.toString()).join('');
        const prefixSpecificity = selectorSpecificity(parser().astSync(prefixText).nodes[0]);
        const from = parent.nodes.indexOf(first.rule), to = parent.nodes.indexOf(last.rule);
        const nodes = parent.nodes.slice(from, to + 1);
        const wrapper = postcss.rule({ selector: prefixText, raws: { before: eol, between: '', after: '' } });
        wrapper._scoped = true;
        for (let index = group.first; index <= group.last; index++) {
          const item = rules[index], result = parser().astSync(item.rule.selector);
          item.rule._oldSelector = item.rule.selector;
          for (let branch = 0; branch < result.nodes.length; branch++) {
            const selector = result.nodes[branch];
            const leading = selector.nodes[0].spaces.before;
            for (let count = 0; count < group.length; count++) selector.nodes[0].remove();
            selector.prepend(parser.nesting({ value: '&', spaces: { before: leading, after: '' } }));
            const specificity = selectorSpecificity(selector, {
              customSpecificity: node => node.type === 'nesting' ? prefixSpecificity : undefined,
            });
            if (JSON.stringify(specificity) !== JSON.stringify(item.selectors[branch].specificity)) {
              throw new Error(`Specificity changed at ${item.rule.source.start.line}`);
            }
            specificityChecks++;
          }
          item.rule.selector = result.toString();
        }
        parent.insertBefore(nodes[0], wrapper);
        for (const node of nodes) wrapper.append(node);
        structural += group.saving; groups++;
        examples.push({ firstLine: first.rule.source.start.line, lastLine: last.rule.source.end.line,
          prefix: prefixText, structuralBytes: group.saving, rules: group.last - group.first + 1 });
      }
    }
  }
  visit(root);
  const output = root.toString(), parsed = postcss.parse(output), beforeRules = [], afterRules = [];
  root.walkRules(rule => beforeRules.push(rule)); parsed.walkRules(rule => afterRules.push(rule));
  if (beforeRules.length !== afterRules.length) throw new Error('Reparse changed rule count');
  for (let index = 0; index < beforeRules.length; index++) {
    const before = beforeRules[index], after = afterRules[index];
    if (before._scoped) after._scoped = true;
    if (before._oldSelector !== undefined) {
      after.selector = parser().astSync(after.selector).nodes.map(selector =>
        before.parent.selector + selector.nodes.slice(1).map(part).join('')).join(',');
    }
  }
  if (JSON.stringify(original) !== JSON.stringify(signature(parsed))) {
    throw new Error('Expanded selector/declaration/comment/at-rule roundtrip changed');
  }
  return { output, structural, groups, specificityChecks, examples };
}

const plan = [];
for (const name of fs.readdirSync('game/css').filter(name => name.endsWith('.css'))) {
  if (excluded.test(name)) continue;
  const file = `game/css/${name}`, input = fs.readFileSync(file, 'utf8'), result = transform(input);
  if (result.structural < 1000) continue;
  const actual = bytes(normalized(input)) - bytes(normalized(result.output));
  plan.push({ file, input, output: result.output, beforeSha256: hash(input), afterSha256: hash(result.output),
    structuralBytes: Math.min(actual, result.structural), normalizedBytes: actual,
    groups: result.groups, specificityChecks: result.specificityChecks, examples: result.examples });
}
const files = plan.map(({ input, output, ...item }) => item);
const manifest = { scope: '52-file selector scope refactor; all features retained',
  status: process.argv.includes('--apply') ? 'applied-uncommitted' : 'read-only-plan',
  excluded: [...fs.readdirSync('game/css').filter(name => excluded.test(name))].sort(),
  totalStructuralBytes: files.reduce((sum, item) => sum + item.structuralBytes, 0),
  totalNormalizedBytes: files.reduce((sum, item) => sum + item.normalizedBytes, 0),
  roundtrip: 'Reparsed output; expanded generated scopes equal original selectors, declaration bytes, comments and at-rule order',
  files };
if (process.argv.includes('--apply')) {
  const expected = JSON.parse(fs.readFileSync(`${evidence}/plan.json`, 'utf8'));
  if (JSON.stringify(expected.files) !== JSON.stringify(files)) throw new Error('Plan/input changed');
  for (const item of plan) {
    if (hash(fs.readFileSync(item.file)) !== item.beforeSha256) throw new Error(`Input changed: ${item.file}`);
  }
  for (const item of plan) {
    const target = path.join(cache, item.file); fs.mkdirSync(path.dirname(target), { recursive: true });
    if (fs.existsSync(target) && hash(fs.readFileSync(target)) !== item.beforeSha256) throw new Error(`Cache differs: ${target}`);
    fs.writeFileSync(target, item.input); fs.writeFileSync(item.file, item.output);
  }
}
fs.mkdirSync(evidence, { recursive: true });
fs.writeFileSync(`${evidence}/${process.argv.includes('--apply') ? 'manifest' : 'plan'}.json`, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: manifest.status, files: files.length,
  structuralBytes: manifest.totalStructuralBytes, normalizedBytes: manifest.totalNormalizedBytes,
  specificityChecks: files.reduce((sum, item) => sum + item.specificityChecks, 0), paths: files.map(item => item.file) }));
