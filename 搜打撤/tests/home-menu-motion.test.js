import { afterEach, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('returns the visible homepage after the base clears its original menu route', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  document.body.innerHTML = '<div id="title"><button id="mStart">Start</button></div>'
    + '<div id="overlay" hidden><div id="ovBody"></div></div>';
  await import('../game/src/ui/home-menu-motion.js');
  const title = document.getElementById('title');
  const overlay = document.getElementById('overlay');
  await vi.advanceTimersByTimeAsync(520);
  document.getElementById('mStart').click();
  overlay.hidden = false;
  document.getElementById('ovBody').innerHTML = '<div id="hubMain"></div>';
  document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
  await Promise.resolve();
  expect(overlay.dataset.homeRoute).toBeUndefined();
  expect(title.dataset.homePhase).toBe('out');

  // Closing the base leaves the title visible: its hidden attribute does not change.
  overlay.hidden = true;
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(520);
  expect(title.dataset.homePhase).toBe('rest');

  // The restored menu can start its next route and recover through the regular close path.
  document.getElementById('mStart').click();
  overlay.hidden = false;
  await Promise.resolve();
  expect(overlay.dataset.homeRoute).toBe('mStart');
  overlay.hidden = true;
  await Promise.resolve();
  await vi.advanceTimersByTimeAsync(520);
  expect(title.dataset.homePhase).toBe('rest');
});
