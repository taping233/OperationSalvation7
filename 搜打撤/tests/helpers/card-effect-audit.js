export function compareEffectAuditFindings(actual, fixture, availableCardIds) {
  const keyOf = ({ id, clause }) => JSON.stringify([id, clause]);
  const actualKeys = new Set(actual.map(keyOf));
  const knownByKey = new Map(fixture.known.map(item => [keyOf(item), item]));
  const allowedMissing = new Set(fixture.allowMissingCardIds || []);

  return {
    unknown: actual.filter(item => !knownByKey.has(keyOf(item))),
    stale: fixture.known.filter(item => !actualKeys.has(keyOf(item))
      && (availableCardIds.has(item.id) || !allowedMissing.has(item.id))),
  };
}
