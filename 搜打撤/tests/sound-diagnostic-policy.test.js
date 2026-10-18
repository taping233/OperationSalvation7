import { describe, it, expect } from 'vitest';
import { bgmDiagnosticDisabled } from '../game/src/audio/sound.diagnostic-policy.js';
describe('nonpersistent diagnostic BGM override', () => {
  it('requires DEV, explicit recorder and explicit off', () => {
    expect(bgmDiagnosticDisabled(true, '?flightRecord=1&bgmDiagnostic=off')).toBe(true);
    for (const query of ['', '?bgmDiagnostic=off', '?flightRecord=0&bgmDiagnostic=off', '?flightRecord=1', '?flightRecord=1&bgmDiagnostic=on']) expect(bgmDiagnosticDisabled(true, query)).toBe(false);
    expect(bgmDiagnosticDisabled(false, '?flightRecord=1&bgmDiagnostic=off')).toBe(false);
    expect(bgmDiagnosticDisabled('true', '?flightRecord=1&bgmDiagnostic=off')).toBe(false);
  });
});
