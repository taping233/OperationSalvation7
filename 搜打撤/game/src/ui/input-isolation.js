// Reference-count only isolation owned by these components; legacy inert stays untouched.
const claims = new WeakMap();
/** @param {HTMLElement} element */
export function claimInputIsolation(element) {
  if (!element) return () => {};
  let state = claims.get(element);
  if (!state) {
    if (element.inert) return () => {};
    state = { owners:new Set() };
    claims.set(element, state);
  }
  const owner = {};
  state.owners.add(owner);
  element.inert = true;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    state.owners.delete(owner);
    if (state.owners.size || claims.get(element) !== state) return;
    claims.delete(element);
    element.inert = false;
  };
}
