// @vitest-environment node
import { expect, it } from 'vitest';
import { transitionDiagnosticPlain, usePlainBattleTransition } from '../game/src/ui/transition-diagnostic-policy.js';
const query = '?perfProbe=1&flightRecord=1&transitionDiagnostic=plain';
it('requires DEV and all exact explicit query values', () => {
  expect(transitionDiagnosticPlain(true, query)).toBe(true);
  expect(transitionDiagnosticPlain(false, query)).toBe(false);
  for (const search of ['', '?transitionDiagnostic=plain', query.replace('perfProbe=1','perfProbe=0'),
    query.replace('flightRecord=1','flightRecord=true'), query.replace('plain','static')]) {
    expect(transitionDiagnosticPlain(true, search)).toBe(false);
  }
});
it('only changes battle/boss city-cut, never other presentations', () => {
  for (const tone of ['battle','boss']) expect(usePlainBattleTransition(true,query,tone,'city-cut')).toBe(true);
  for (const tone of ['field','shop','camp']) expect(usePlainBattleTransition(true,query,tone,'city-cut')).toBe(false);
  expect(usePlainBattleTransition(true,query,'battle','node-cut')).toBe(false);
});
