import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

beforeAll(async () => {
  window.SDT ||= {};
  await import('../game/src/ui/term-tips.js');
});
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue([{ x:0, y:0, width:80, height:20 }]);
  document.body.insertAdjacentHTML('beforeend', '<span id="term" data-term="poison">中毒</span>');
});
afterEach(() => {
  document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
  pointer(document, 'pointerup', 1);
  pointer(document, 'pointercancel', 1);
  document.getElementById('term')?.remove();
  vi.restoreAllMocks();
});

function pointer(target, type, pointerId = 1) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId, pointerType: 'touch', button: 0 });
  target.dispatchEvent(event);
}
const tip = () => document.querySelector('.term-tip');

describe('term tooltip pointer lifecycle', () => {
  it('does not accumulate release listeners across ordinary presses or cancellations', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const term = document.getElementById('term');
    for (let i = 0; i < 20; i++) {
      pointer(term, 'pointerdown');
      pointer(document, i % 2 ? 'pointerup' : 'pointercancel');
      expect(tip().hidden).toBe(true);
    }
    expect(add.mock.calls.filter(([type]) => type === 'pointerup' || type === 'pointercancel')).toHaveLength(0);
  });

  it('only releases the current pointer when another finger ends', () => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 1);
    pointer(term, 'pointerdown', 2);
    pointer(document, 'pointerup', 1);
    expect(tip().hidden).toBe(false);
    pointer(document, 'pointercancel', 2);
    expect(tip().hidden).toBe(true);
  });

  it('forgets a cancelled press on navigation, so its late release cannot hide a new hover', () => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 1);
    document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
    expect(tip().hidden).toBe(true);
    pointer(term, 'pointerover', 2);
    pointer(document, 'pointercancel', 1);
    expect(tip().hidden).toBe(false);
    window.dispatchEvent(new Event('blur'));
    expect(tip().hidden).toBe(true);
  });

  it.each(['pointerup', 'pointercancel'])('releases a long press even after its term is removed (%s)', type => {
    const term = document.getElementById('term');
    pointer(term, 'pointerdown', 7);
    expect(tip().hidden).toBe(false);
    term.remove();
    pointer(document, type, 7);
    expect(tip().hidden).toBe(true);
  });
});
