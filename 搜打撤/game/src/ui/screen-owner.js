// Active presentation ownership is separate from game state and save data.
const owners = [];
export function currentScreenOwner() {
  for (let i = owners.length - 1; i >= 0; i--) {
    const owner = owners[i];
    let current = true;
    try { if (owner.isCurrent) current = owner.isCurrent(); } catch { current = false; }
    if (!owner.root.isConnected || owner.root.hidden || !current) owners.splice(i, 1);
  }
  // Covered owners remain registered and resume when the covering dialog releases them.
  return owners.filter(owner => !owner.root.closest('[inert],[hidden],[aria-hidden="true"]'))
    .sort((a, b) => b.priority - a.priority || b.order - a.order)[0] || null;
}
let order = 0;
// Optional validity readers are quick and side-effect-free; stale owners never consume input.
export function registerScreenOwner({ root, onBack, priority = 10, allowNavigation = false, isCurrent = null }) {
  const owner = { root, onBack, priority, allowNavigation, isCurrent, order: ++order };
  owners.push(owner);
  return () => { const at = owners.indexOf(owner); if (at >= 0) owners.splice(at, 1); };
}
export function gameplayInputAllowed() { return !currentScreenOwner(); }
export function pageNavigationAllowed() { const owner = currentScreenOwner(); return !owner || owner.allowNavigation; }
document.addEventListener('keydown', event => {
  if (event.defaultPrevented || event.isComposing || event.keyCode === 229) return;
  const owner = currentScreenOwner();
  if (!owner) return;
  if (event.target instanceof Element && event.target.closest('[data-key-listening="true"]')) return;
  if (event.key === 'Escape' && owner.onBack) {
    event.preventDefault(); event.stopImmediatePropagation();
    if (!event.repeat) owner.onBack();
  }
}, true);
