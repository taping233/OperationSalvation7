import postcss from 'postcss';
import selectorParser from 'postcss-selector-parser';

const LEGACY_PSEUDO_ELEMENTS = new Set([':before', ':after', ':first-line', ':first-letter']);

function selectorAst(rule) {
  try { return selectorParser().astSync(rule.selector); }
  catch (error) { throw rule.error(`Invalid component selector: ${error.message}`); }
}

function fail(rule, message) {
  throw rule.error(`Unsupported component scope: ${message}`);
}

// This is deliberately narrower than a general native-nesting compiler. One
// parent selector avoids :is() list specificity; pseudo-elements cannot be &.
function expansion(scope) {
  const parent = selectorAst(scope);
  if (parent.nodes.length !== 1) fail(scope, 'the parent must have exactly one selector');
  parent.walkNesting(() => fail(scope, 'a parent cannot contain &'));
  parent.walkPseudos(pseudo => {
    const name = pseudo.value.toLowerCase();
    if (name.includes('\\')) fail(scope, 'escaped parent pseudo names require a separate audit');
    if (name.startsWith('::') || LEGACY_PSEUDO_ELEMENTS.has(name)) {
      fail(scope, 'a parent cannot contain a pseudo-element');
    }
  });
  for (let ancestor = scope.parent; ancestor; ancestor = ancestor.parent) {
    if (ancestor.type === 'rule') fail(scope, 'multiple nested scope levels');
    if (ancestor.type === 'atrule' && /keyframes$/i.test(ancestor.name)) {
      fail(scope, 'a scope cannot occur inside keyframes');
    }
  }
  const prefix = scope.selector.trim();
  const children = scope.nodes.map(child => {
    if (child.type === 'comment') return child.clone();
    if (child.type !== 'rule' || child.nodes.some(node => !['decl', 'comment'].includes(node.type))) {
      fail(scope, 'a parent can contain only comments and declaration-only child rules');
    }
    const ast = selectorAst(child);
    const positions = [];
    for (const selector of ast.nodes) {
      const first = selector.nodes[0];
      let nestingCount = 0;
      selector.walkNesting(() => { nestingCount++; });
      if (first?.type !== 'nesting' || nestingCount !== 1) {
        fail(child, 'each child selector must begin with its only &');
      }
      if (['tag', 'universal'].includes(selector.nodes[1]?.type)) {
        fail(child, 'a type selector cannot be concatenated with &');
      }
      positions.push(first.sourceIndex);
    }
    let selector = child.selector;
    for (const position of positions.reverse()) {
      selector = selector.slice(0, position) + prefix + selector.slice(position + 1);
    }
    return child.clone({ selector });
  });
  if (children[0]) children[0].raws.before = scope.raws.before;
  return children;
}

function expandRoot(root, { strict = false } = {}) {
  const replacements = [];
  if (strict) root.walkAtRules('nest', rule => fail(rule, '@nest is outside the supported scope syntax'));
  root.walkRules(rule => {
    const hasChildren = rule.nodes.some(node => node.type === 'rule' || node.type === 'atrule');
    if (hasChildren) {
      try { replacements.push([rule, expansion(rule)]); }
      catch (error) { if (strict || error.name !== 'CssSyntaxError') throw error; }
    } else if (strict && rule.parent.type !== 'rule') {
      selectorAst(rule).walkNesting(() => fail(rule, '& has no supported parent scope'));
    }
  });
  // Validate everything before mutating the PostCSS tree, including later scopes.
  for (const [scope, children] of replacements) scope.replaceWith(...children);
  return replacements.length > 0;
}

export function expandComponentScopes(css, { from, strict = false } = {}) {
  // String expansion never consumes source maps; the caller that owns emitted
  // maps composes them separately if this function reports a changed string.
  const root = postcss.parse(css, { from, map: false });
  return expandRoot(root, { strict }) ? root.toString() : css;
}

// Unknown existing native syntax belongs to the existing CSS pipeline. Strict
// mode audits a newly generated scope in isolation without taking over that CSS.
export function componentScopesPlugin(options = {}) {
  return { postcssPlugin: 'css-component-scopes', Once: root => expandRoot(root, options) };
}
