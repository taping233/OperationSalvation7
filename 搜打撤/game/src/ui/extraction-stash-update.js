// Keep the live extraction surface and unchanged card images through deposits.
// The caller supplies the same rich HTML as the first full overlay render.
export function updateExtractionStash(root, html) {
  const template = root.ownerDocument.createElement('template');
  template.innerHTML = html;
  const next = template.content.querySelector('#exMain');
  if (!next) return false;
  // Do not reconcile the page shell: motion owns its attributes and inline styles.
  root.dataset.reveal = 'false';
  root.dataset.unclaimedCards = next.dataset.unclaimedCards;
  root.removeAttribute('aria-busy');
  const help = root.querySelector('.exr-header button');
  const nextHelp = next.querySelector('.exr-header button');
  if (help && nextHelp) help.disabled = nextHelp.disabled;
  for (const selector of ['.exr-section-title', '.exr-notice', '.exr-store', '.exr-footer']) {
    const live = root.querySelector(selector), desired = next.querySelector(selector);
    if (live && desired) syncElement(live, desired);
  }
  const scroll = root.querySelector('.exr-card-scroll');
  const grid = scroll?.querySelector(':scope > .exr-card-grid');
  const nextGrid = next.querySelector('.exr-card-scroll > .exr-card-grid');
  if (grid && nextGrid) syncElement(grid, nextGrid);
  const shelf = scroll?.querySelector(':scope > .exr-saved-shelf');
  const nextShelf = next.querySelector('.exr-saved-shelf');
  if (shelf && nextShelf) syncElement(shelf, nextShelf);
  else if (scroll && nextShelf) scroll.append(nextShelf.cloneNode(true));
  else if (shelf) shelf.remove();
  return true;
}

function compatible(current, next) {
  return current?.nodeType === next.nodeType && current.nodeName === next.nodeName;
}

function syncElement(current, next) {
  const keepOpen = current.tagName === 'DETAILS' && current.open;
  for (const attr of [...current.attributes]) {
    if (attr.name.startsWith('data-surface') || attr.name.startsWith('data-ui') || attr.name === 'style') continue;
    if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
  }
  for (const attr of next.attributes) {
    if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  }
  if (keepOpen) current.open = true;
  // Card identity is keyed on the containing row; its face needs no reload.
  if (current.classList.contains('exr-card-face')) return;
  const previous = [...current.childNodes];
  const keyed = new Map(previous.filter(node => node.nodeType === 1 && node.hasAttribute('data-exr-key'))
    .map(node => [node.getAttribute('data-exr-key'), node]));
  const used = new Set();
  let cursor = current.firstChild;
  [...next.childNodes].forEach((desired, index) => {
    const key = desired.nodeType === 1 ? desired.getAttribute('data-exr-key') : null;
    let live = key !== null ? keyed.get(key) : previous[index];
    if (!compatible(live, desired) || used.has(live)
      || (key === null && live.nodeType === 1 && live.hasAttribute('data-exr-key'))) live = null;
    if (!live) live = desired.cloneNode(true);
    else if (live.nodeType === 1) syncElement(live, desired);
    else if (live.nodeValue !== desired.nodeValue) live.nodeValue = desired.nodeValue;
    used.add(live);
    if (live !== cursor) current.insertBefore(live, cursor);
    cursor = live.nextSibling;
  });
  while (cursor) { const obsolete = cursor; cursor = cursor.nextSibling; obsolete.remove(); }
}
