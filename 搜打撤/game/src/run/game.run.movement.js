/**
 * Pure run movement transitions. Animation may update position between these
 * transitions, while persistence continues to accept only stable run states.
 */
export function beginRunMove({ from, to, seq }) {
  return {
    state: 'moving',
    moveTarget: { li: to.li, idx: to.idx, seq, progress: 0, moving: true },
    pos: { ...from },
  };
}

export function interpolateRunPosition(from, to, progress) {
  const t = Math.max(0, Math.min(1, progress));
  const eased = 1 - Math.pow(1 - t, 3);
  return { x: from.x + (to.x - from.x) * eased, y: from.y + (to.y - from.y) * eased };
}

export function commitRunMove(state, { to, layerBounds, geometryVersion }) {
  return {
    pos: { ...to.pos },
    layerIdx: to.li,
    trackPos: to.idx,
    hop: 0,
    moveTarget: null,
    turn: state.turn + 1,
    activeLayerBounds: layerBounds || null,
    geometryVersion: state.geometryVersion || geometryVersion,
  };
}

export function cancelRunMove(origin) {
  return {
    state: origin.state,
    pos: { ...origin.pos },
    layerIdx: origin.layerIdx,
    trackPos: origin.trackPos,
    turn: origin.turn,
    hop: origin.hop,
    moveTarget: origin.moveTarget ?? null,
  };
}
