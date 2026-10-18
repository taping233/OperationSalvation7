// Presentation destinations only; these predicates never alter card ownership or execution.
const QUEUED_CAST_SOURCES = new Set(['pouch', 'discover-cast', 'effect-cast']);
export const isQueuedCastSource = source => QUEUED_CAST_SOURCES.has(source);
export const isHandArrivalEvent = event => event?.kind === 'draw' && !isQueuedCastSource(event.source);
