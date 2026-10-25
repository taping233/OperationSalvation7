import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';
import { selectorSpecificity } from '@csstools/selector-specificity';
import { expandComponentScopes } from '../../scripts/css-component-scopes.mjs';

// Pure selector/stylesheet reachability checks; no historical evidence or filesystem input.
export function createCssReachability(retiredTokens) {
const missing = new Set(retiredTokens);
const canonicalPart = n => n.type === 'combinator' ? (n.value.trim() || ' ')
  : n.clone({ spaces: { before: '', after: '' } }).toString();
const canonical = text => selectorParser().astSync(text).nodes
  .map(s => s.nodes.map(canonicalPart).join('')).join(',');

function required(node) {
  if (['class', 'id'].includes(node.type) && missing.has(node.value)) return [node.value];
  if (node.type === 'pseudo' && [':is', ':where', ':has'].includes(node.value.toLowerCase()) && node.nodes?.length) {
    const alternatives = node.nodes.map(s => s.nodes.flatMap(required));
    if (alternatives.every(branch => branch.length)) return [...new Set(alternatives.flat())];
  }
  return []; // :not and unknown pseudo arguments are never treated as required DOM.
}
const reasons = selector => [...new Set(selectorParser().astSync(selector).nodes.flatMap(s => s.nodes.flatMap(required)))];

function contextual(selector, parent) {
  return selectorParser().astSync(selector).nodes.map(selector => {
    const clone = selector.clone(); let count = 0;
    clone.walkNesting(node => { count++; node.replaceWith(selectorParser().astSync(`:is(${parent})`).first.first.clone()); });
    return parent && !count ? `:is(${parent}) ${clone.toString()}` : clone.toString();
  });
}

function liveProjection(root) {
  const records = [], comments = [];
  root.walkComments(comment => comments.push(comment.toString()));
  function visit(parent, selectors = [], conditions = []) {
    for (const node of parent.nodes || []) {
      if (node.type === 'rule') {
        const full = contextual(node.selector, selectors.join(','));
        visit(node, full, conditions);
      } else if (node.type === 'atrule') visit(node, selectors, [...conditions, [node.name, node.params]]);
      else if (node.type === 'decl') {
        const live = selectors.filter(s => !reasons(s).length);
        if (!selectors.length || live.length) records.push({ conditions, selectors: live.map(canonical),
          specificity: live.flatMap(s => selectorParser().astSync(s).nodes.map(selectorSpecificity)),
          declaration: node.toString() });
      }
    }
  }
  visit(root); return { records, comments };
}

function retire(before, file) {
  const root = postcss.parse(before, { from: file }), original = liveProjection(root), operations = [];
  function visit(parent, inherited = '') {
    for (const rule of [...(parent.nodes || [])]) {
      if (rule.type === 'atrule') { if (!/keyframes$/i.test(rule.name)) visit(rule, inherited); continue; }
      if (rule.type !== 'rule') continue;
      const own = selectorParser().astSync(rule.selector), full = contextual(rule.selector, inherited);
      const proofs = full.map(reasons), oldSelector = rule.selector;
      const hadNested = rule.nodes.some(n => ['rule', 'atrule'].includes(n.type));
      if (hadNested) visit(rule, full.join(','));
      if (!rule.nodes.some(n => ['rule', 'atrule'].includes(n.type)) && proofs.every(p => p.length)) {
        operations.push({ kind: 'remove-rule', line: rule.source.start.line, endLine: rule.source.end.line,
          oldSelector, effectiveSelectors: full, requiredMissingTokens: [...new Set(proofs.flat())],
          producerProof: 'consumer-proof.json tokens: no current HTML/JS/JSON production or dynamic prefix',
          declarations: rule.nodes.filter(n => n.type === 'decl').length });
        rule.replaceWith(...rule.nodes.filter(n => n.type === 'comment')); continue;
      }
      if (!hadNested && proofs.some(p => p.length)) {
        const removed = [];
        for (let index = own.nodes.length - 1; index >= 0; index--) if (proofs[index].length) {
          removed.push({ oldSelector: own.nodes[index].toString(), effectiveSelector: full[index],
            requiredMissingTokens: proofs[index], producerProof: 'consumer-proof.json' });
          own.nodes[index].remove();
        }
        rule.selector = own.toString();
        operations.push({ kind: 'prune-top-level-branches', line: rule.source.start.line, oldSelector,
          newSelector: rule.selector, removed, liveSpecificity: 'Verified by strict complete live projection' });
      }
      if (hadNested && rule.nodes.every(n => n.type === 'comment')) rule.replaceWith(...rule.nodes.map(n => n.clone()));
    }
  }
  visit(root);
  const after = root.toString(), parsed = postcss.parse(after, { from: file });
  if (JSON.stringify(original) !== JSON.stringify(liveProjection(parsed))) throw new Error(`Live declarations/order/specificity/comments changed: ${file}`);
  const expandedBefore = postcss.parse(expandComponentScopes(before, { from: file }));
  const expandedAfter = postcss.parse(expandComponentScopes(after, { from: file }));
  if (JSON.stringify(liveProjection(expandedBefore)) !== JSON.stringify(liveProjection(expandedAfter))) {
    throw new Error(`Compiled live projection changed: ${file}`);
  }
  return { after, operations, liveDeclarations: original.records.length, comments: original.comments.length };
}
return { required, contextual, liveProjection, retire };
}
