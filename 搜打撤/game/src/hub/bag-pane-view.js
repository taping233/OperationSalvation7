// Reconcile only the mounted backpack presentation; inventory rules stay in its callers.
function syncAttributes(current, next) {
  for (const { name } of [...current.attributes]) if (!next.hasAttribute(name)) current.removeAttribute(name);
  for (const { name, value } of next.attributes) if (current.getAttribute(name) !== value) current.setAttribute(name, value);
}
function syncTile(current, next) {
  syncAttributes(current, next);
  // The card face is an opaque rendered child. Keep it only when its full DOM is
  // equal; count/status siblings can change without remounting unchanged artwork.
  const wanted = [...next.childNodes];
  wanted.forEach((node, index) => {
    const old = current.childNodes[index];
    if (!old) current.append(node);
    else if (!old.isEqualNode(node)) old.replaceWith(node);
  });
  while (current.childNodes.length > wanted.length) current.lastChild.remove();
}
const tileKey = tile => JSON.stringify([tile.dataset.paneKey ?? null, tile.dataset.stack ?? null, tile.dataset.supply ?? null]);
function reconcileGrid(current, next) {
  const byKey = new Map();
  for (const tile of current.children) {
    const key = tileKey(tile);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(tile);
  }
  const tiles = [...next.children].map(wanted => {
    const tile = byKey.get(tileKey(wanted))?.shift();
    if (!tile) return wanted;
    syncTile(tile, wanted);
    return tile;
  });
  tiles.forEach((tile, index) => { if (current.children[index] !== tile) current.insertBefore(tile, current.children[index] || null); });
  while (current.children.length > tiles.length) current.lastElementChild.remove();
}
function replacePart(root, nextRoot, selector, before) {
  const current = root.querySelector(selector), next = nextRoot.querySelector(selector);
  if (current && next) { if (!current.isEqualNode(next)) current.replaceWith(next); }
  else if (current) current.remove();
  else if (next) root.insertBefore(next, before || null);
}

export function patchBackpackPane(UI, SDT, markup, bagZone, refreshOnly) {
  const mountedBag = refreshOnly && UI.el.ovBody?.querySelector('.bag-v2');
  if (!mountedBag || UI.el.overlay.hidden || UI.el.overlay.classList?.contains('closing')) return false;
  const template = document.createElement('template');
  template.innerHTML = SDT.Icons.rich(markup);
  const next = template.content.querySelector('.bag-col');
  const previous = mountedBag.querySelector('.bag-col');
  const board = previous?.querySelector('.bag-board'), grid = board?.querySelector('.bag-grid');
  const nextBoard = next?.querySelector('.bag-board'), nextGrid = nextBoard?.querySelector('.bag-grid');
  if (!previous || !next || !board || !grid || !nextBoard || !nextGrid) return false;
  const sameZone = grid.dataset.zone === bagZone;
  const scroll = board.scrollTop;
  const focused = previous.contains(document.activeElement) ? document.activeElement : null;
  const focusData = focused ? { ...focused.dataset } : null;
  const focusIndex = focused ? [...grid.children].indexOf(focused) : -1;
  if (!sameZone) previous.replaceWith(next);
  else {
    reconcileGrid(grid, nextGrid);
    replacePart(previous, next, '.bag-head2', board);
    replacePart(previous, next, '.bag-tools', board);
    replacePart(board, nextBoard, '.bag-receipt', grid);
    replacePart(board, nextBoard, '.bag-empty2');
    if (focused && document.activeElement !== focused) {
      const equivalent = focusIndex < 0 && focusData.act && [...previous.querySelectorAll('[data-act]')].find(node =>
        node.dataset.act === focusData.act && node.dataset.f === focusData.f && node.dataset.help === focusData.help);
      const fallback = focusIndex >= 0 ? grid.children[Math.min(focusIndex, grid.children.length - 1)] : null;
      (focused.isConnected && previous.contains(focused) ? focused : equivalent || fallback || mountedBag.querySelector(`.bag-rz[data-zone="${bagZone}"]`))?.focus({ preventScroll:true });
    }
    board.scrollTop = scroll;
  }
  for (const button of mountedBag.querySelectorAll('.bag-rz')) {
    const zone = button.dataset.zone;
    const source = template.content.querySelector('.bag-rz[data-zone="' + zone + '"]');
    if (button.classList.contains('on') !== (zone === bagZone)) button.classList.toggle('on', zone === bagZone);
    if (button.getAttribute('aria-pressed') !== String(zone === bagZone)) button.setAttribute('aria-pressed', String(zone === bagZone));
    if (button.getAttribute('aria-label') !== source.getAttribute('aria-label')) button.setAttribute('aria-label', source.getAttribute('aria-label'));
    const badge = button.querySelector('.bag-bdg'), text = source.querySelector('.bag-bdg').textContent;
    if (badge.textContent !== text) badge.textContent = text;
  }
  return true;
}
