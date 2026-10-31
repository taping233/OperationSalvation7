import { syncViewElement } from './view-children-sync.js';

const syncOptions = {
  key: element => element.getAttribute('data-exr-key'),
  // Card identity is keyed on the containing row; retain its rendered face.
  preserveNode: element => element.classList.contains('exr-card-face'),
  preserveAttribute: (element, next, name) => !next.hasAttribute(name)
    && (name.startsWith('data-surface') || name.startsWith('data-ui') || name === 'style'),
};

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
  for (const selector of ['.exr-section-title', '.exr-notice', '.exr-store', '.exr-footer']) {
    const live = root.querySelector(selector), desired = next.querySelector(selector);
    if (live && desired) syncViewElement(live, desired, syncOptions);
  }
  const scroll = root.querySelector('.exr-card-scroll');
  const grid = scroll?.querySelector(':scope > .exr-card-grid');
  const nextGrid = next.querySelector('.exr-card-scroll > .exr-card-grid');
  if (grid && nextGrid) syncViewElement(grid, nextGrid, syncOptions);
  const shelf = scroll?.querySelector(':scope > .exr-saved-shelf');
  const nextShelf = next.querySelector('.exr-saved-shelf');
  if (shelf && nextShelf) syncViewElement(shelf, nextShelf, syncOptions);
  else if (scroll && nextShelf) scroll.append(nextShelf.cloneNode(true));
  else if (shelf) shelf.remove();
  return true;
}
