import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let showIntentLegend;

beforeEach(async () => {
  localStorage.clear();
  document.body.innerHTML = '<div id="overlay"></div>';
  window.SDT = { UI: {} };
  vi.useFakeTimers();
  ({ showIntentLegend } = await import('../game/src/battle/battle.layers.js'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('battle intent legend storage isolation', () => {
  it('shows for a player once and remembers the preference', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    expect(showIntentLegend({ devSample: false, battleToken: 'player-1' })).toBe(true);
    expect(document.querySelectorAll('.sts-intent-legend')).toHaveLength(1);
    expect(localStorage.getItem('sdt-intent-legend')).toBe('1');
    expect(showIntentLegend({ devSample: false, battleToken: 'player-2' })).toBe(false);
    expect(document.querySelectorAll('.sts-intent-legend')).toHaveLength(1);
    expect(setItem).toHaveBeenCalledWith('sdt-intent-legend', '1');
  });

  it('skips when the player preference is already recorded', () => {
    localStorage.setItem('sdt-intent-legend', '1');
    expect(showIntentLegend({ devSample: false, battleToken: 'player-seen' })).toBe(false);
    expect(document.querySelector('.sts-intent-legend')).toBeNull();
  });

  it('shows isolated samples without reading or writing player storage and remembers only in-session', () => {
    localStorage.setItem('sdt-intent-legend', '1');
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    getItem.mockClear();
    setItem.mockClear();

    expect(showIntentLegend({ devSample: true, battleToken: 'sample-1' })).toBe(true);
    expect(document.querySelectorAll('.sts-intent-legend')).toHaveLength(1);
    document.querySelector('.sts-intent-legend').remove();
    expect(showIntentLegend({ devSample: true, battleToken: 'sample-1' })).toBe(false);
    expect(showIntentLegend({ devSample: true, battleToken: 'sample-2' })).toBe(true);
    expect(getItem).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.getItem('sdt-intent-legend')).toBe('1');
  });

  it('does not let a QA token suppress the player legend with the same token', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    expect(showIntentLegend({ devSample: true, battleToken: 'shared-token-qa-player' })).toBe(true);
    document.querySelector('.sts-intent-legend').remove();
    expect(showIntentLegend({ devSample: false, battleToken: 'shared-token-qa-player' })).toBe(true);
    expect(setItem).toHaveBeenCalledWith('sdt-intent-legend', '1');
    expect(localStorage.getItem('sdt-intent-legend')).toBe('1');
  });

  it('keeps the legend visible when browser storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    expect(() => showIntentLegend({ devSample: false, battleToken: 'private-mode' })).not.toThrow();
    expect(document.querySelector('.sts-intent-legend')).not.toBeNull();
    document.querySelector('.sts-intent-legend').remove();
    expect(showIntentLegend({ devSample: false, battleToken: 'private-mode' })).toBe(false);
  });
});
