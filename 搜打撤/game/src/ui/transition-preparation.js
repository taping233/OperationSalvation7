// Advisory preparation starts under an already mounted transition. The actual
// destination retains authoritative error/fallback handling; failures are data.
export function prepareTransition(prepare, { signal, isCurrent }) {
  const cancelled = { ok: false, cancelled: true };
  if (signal?.aborted || !isCurrent()) return Promise.resolve(cancelled);
  let cancel;
  const aborted = new Promise(resolve => { cancel = () => resolve(cancelled); });
  signal?.addEventListener('abort', cancel, { once: true });
  /** @typedef {{ok: boolean, value?: unknown, error?: unknown, cancelled?: boolean}} PreparationResult */
  const work = Promise.resolve().then(/** @returns {PreparationResult | Promise<PreparationResult>} */ () => {
    if (signal?.aborted || !isCurrent()) return cancelled;
    return Promise.resolve(prepare?.(signal)).then(value => ({ ok: true, value }), error => ({ ok: false, error }));
  }).catch(error => ({ ok: false, error }));
  return Promise.race([work, aborted]).finally(() => signal?.removeEventListener('abort', cancel));
}
