// Diagnostic only: never persisted and never enabled by production URLs.
export function bgmDiagnosticDisabled(dev, search) {
  if (dev !== true) return false;
  const query = new URLSearchParams(search || '');
  return query.get('flightRecord') === '1' && query.get('bgmDiagnostic') === 'off';
}
