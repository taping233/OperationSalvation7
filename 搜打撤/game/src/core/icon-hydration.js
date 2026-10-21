// One frame scans each connected subtree at most once. Attribute changes only
// clean the changed element; changing a label must not rescan an entire page.
export function observeIconHydration(body, { hydrate, scrubAttrs, hasTokens }) {
  const dirtyRoots = new Set();
  let queued = false;
  const flush = () => {
    queued = false;
    const roots = new Set([...dirtyRoots].filter(root => root.isConnected));
    dirtyRoots.clear();
    for (const root of roots) {
      let parent = root.parentElement;
      while (parent && !roots.has(parent)) parent = parent.parentElement;
      if (!parent) hydrate(root);
    }
  };
  const schedule = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : setTimeout;
  const observer = new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'attributes') {
        scrubAttrs(record.target);
        continue;
      }
      for (const node of record.addedNodes) {
        if (node.nodeType === Node.TEXT_NODE && !hasTokens(node.nodeValue)) continue;
        if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE) continue;
        // Generated bitmap icons have no text or token-bearing attributes.
        if (node.nodeType === Node.ELEMENT_NODE && (/** @type {Element} */ (node)).matches('img.ic')) {
          scrubAttrs(node);
          continue;
        }
        const root = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        if (root) dirtyRoots.add(root);
      }
    }
    if (queued || !dirtyRoots.size) return;
    queued = true;
    schedule(flush);
  });
  observer.observe(body, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['title', 'placeholder', 'aria-label'] });
  return observer;
}
