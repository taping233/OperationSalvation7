// Legacy arrays retain their original settlement categories. This projection is
// the shared current location from which card effects may retrieve an existing UID.
const sourcePiles = ['played', 'consumed', 'discard', 'grave'];
const uidsIn = value => Array.isArray(value) ? value : [];

export function readConsumedPile(state, excludedUids = []) {
  if (!state) return [];
  const unavailable = new Set([
    ...uidsIn(state.hand), ...uidsIn(state.drawPile), ...excludedUids,
  ]);
  const seen = new Set();
  const result = [];
  for (const name of sourcePiles) {
    for (const uid of uidsIn(state[name])) {
      if (seen.has(uid) || unavailable.has(uid)) continue;
      seen.add(uid);
      result.push(uid);
    }
  }
  return result;
}

/** Move the original UID; draw means the top of drawPile (drawCards uses pop).
 * A successful retrieval removes that UID's old spent bookkeeping. Its next play
 * or consumption will enter the existing settlement categories again.
 * @param {object} state
 * @param {string} uid
 * @param {'hand' | 'draw'} destination
 * @param {Iterable<string>} excludedUids
 * @returns {boolean} */
export function takeConsumedCard(state, uid, destination, excludedUids = []) {
  const target = destination === 'hand' ? state?.hand : destination === 'draw' ? state?.drawPile : null;
  if (!Array.isArray(target) || !readConsumedPile(state, excludedUids).includes(uid)) return false;
  for (const name of sourcePiles) {
    const pile = uidsIn(state[name]);
    for (let index = pile.length - 1; index >= 0; index--)
      if (pile[index] === uid) pile.splice(index, 1);
  }
  target.push(uid);
  return true;
}
