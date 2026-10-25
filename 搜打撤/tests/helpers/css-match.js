import selectorParser from 'postcss-selector-parser';

let sequence = 0;
// jsdom's selector engine cannot parse nested :is/:has lists. Resolve their
// membership against the same DOM; cascade tests retain authored specificity.
export function matchesCssSelector(element, input) {
  const selector = typeof input === 'string' ? selectorParser().astSync(input) : input.clone();
  const document = element.ownerDocument, hosts = [...document.querySelectorAll('*')], marked = [];
  const mark = (host, attribute) => { host.setAttribute(attribute, ''); marked.push([host, attribute]); };
  const resolve = container => {
    for (const node of [...(container.nodes || [])]) {
      resolve(node);
      if (node.type !== 'pseudo' || ![':is', ':where', ':not', ':has'].includes(node.value)) continue;
      const attribute = `data-css-match-${sequence++}`;
      const queries = node.nodes.map(child => child.toString().trim());
      for (const host of hosts) {
        let matches;
        if (node.value === ':has') {
          const scope = `data-css-scope-${sequence++}`;
          host.setAttribute(scope, '');
          try { matches = queries.some(query => document.querySelector(`[${scope}] ${query}`)); }
          finally { host.removeAttribute(scope); }
        } else {
          matches = queries.some(query => host.matches(query));
          if (node.value === ':not') matches = !matches;
        }
        if (matches) mark(host, attribute);
      }
      node.replaceWith(selectorParser.attribute({ attribute }));
    }
  };
  try { resolve(selector); return element.matches(selector.toString().trim()); }
  finally { for (const [host, attribute] of marked) host.removeAttribute(attribute); }
}
