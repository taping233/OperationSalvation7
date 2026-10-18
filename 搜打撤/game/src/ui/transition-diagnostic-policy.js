// Session-local visual comparison only; production and ordinary URLs are unchanged.
export function transitionDiagnosticPlain(dev, search) {
  if (dev !== true) return false;
  const query = new URLSearchParams(search || '');
  return query.get('perfProbe') === '1' && query.get('flightRecord') === '1'
    && query.get('transitionDiagnostic') === 'plain';
}
export function usePlainBattleTransition(dev, search, tone, presentation) {
  return (tone === 'battle' || tone === 'boss') && presentation === 'city-cut'
    && transitionDiagnosticPlain(dev, search);
}
