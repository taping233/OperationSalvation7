import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: () => false }));
let gateSweep;
let gate;
let arm;
let overlay;
let pending;

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"></div><div id="t1Gate"><div class="t1-arm"></div></div>';
  // No ovBody: exercise the exported production sweep without unrelated navigation observers.
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  ({ gateSweep } = await import('../game/src/ui/transitions-director.js'));
  gate = document.getElementById('t1Gate');
  arm = gate.firstElementChild;
  overlay = document.getElementById('overlay');
  pending = new Set();
  const add = arm.addEventListener.bind(arm);
  const remove = arm.removeEventListener.bind(arm);
  vi.spyOn(arm, 'addEventListener').mockImplementation((type, callback, options) => {
    if (type === 'animationend') pending.add(callback);
    add(type, callback, options);
  });
  vi.spyOn(arm, 'removeEventListener').mockImplementation((type, callback, options) => {
    if (type === 'animationend') pending.delete(callback);
    remove(type, callback, options);
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

const end = () => arm.dispatchEvent(new Event('animationend', { bubbles: true }));

describe('transition gate owns both completion paths', () => {
  it('ignores a child animation ending before the gate sweep', () => {
    const child = document.createElement('span'); arm.append(child);
    gateSweep();
    child.dispatchEvent(new Event('animationend', { bubbles: true }));
    expect(gate.classList.contains('on')).toBe(true);
    end();
    expect(gate.classList.contains('on')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('releases every lost-animation listener after 100 fallback-only navigation cycles', () => {
    for (let cycle = 0; cycle < 100; cycle += 1) {
      gateSweep();
      expect(gate.classList.contains('on')).toBe(true);
      vi.advanceTimersByTime(700);
      expect(gate.classList.contains('on')).toBe(false);
    }
    // Explicit removals track fallback: no animation event fired in these cycles.
    expect.soft(pending.size).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
    const removals = vi.spyOn(gate.classList, 'remove');
    end();
    expect(removals.mock.calls.length).toBe(0);
  });

  it('a finished sweep leaves no timeout that can end the next sweep early', () => {
    gateSweep();
    vi.advanceTimersByTime(550);
    end();
    const timersAfterEnd = vi.getTimerCount();
    gateSweep();
    vi.advanceTimersByTime(150); // The first sweep used to fire its 700ms fallback here.
    expect(gate.classList.contains('on')).toBe(true);
    expect(overlay.classList.contains('gate-live')).toBe(true);
    expect(timersAfterEnd).toBe(0);
    vi.advanceTimersByTime(550);
    expect(gate.classList.contains('on')).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('an already queued old completion cannot release a later sweep', () => {
    gateSweep();
    const oldCompletion = [...pending][0];
    vi.advanceTimersByTime(700);
    gateSweep();
    oldCompletion();
    expect(gate.classList.contains('on')).toBe(true);
    expect(pending.size).toBe(1);
    expect(vi.getTimerCount()).toBe(1);
    end();
    expect(gate.classList.contains('on')).toBe(false);
    expect(pending.size).toBe(0);
  });

  it('does not subscribe twice while busy, and remains reusable after each completion path', () => {
    for (let cycle = 0; cycle < 40; cycle += 1) {
      gateSweep();
      gateSweep();
      expect(pending.size).toBe(1);
      expect(vi.getTimerCount()).toBe(1);
      if (cycle % 2) end();
      else vi.advanceTimersByTime(700);
      expect(pending.size).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
      expect(overlay.classList.contains('gate-squeeze')).toBe(false);
    }
  });
});
