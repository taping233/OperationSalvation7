import { afterEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/ui/interface-motion.js', () => ({ interfaceReducedMotion: () => false }));

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

it('returns the visible homepage after the base clears its original menu route', async () => {
  vi.useFakeTimers();
  vi.resetModules();
  document.body.innerHTML = '<div id="title" class="home-composed"><div class="home-brand"></div>'
    + '<nav class="home-primary"><button id="mStart" class="home-plate">Start</button></nav>'
    + '<nav class="home-secondary"><button id="btnTitleExit" class="home-plate">Exit</button></nav></div>'
    + '<div id="overlay" hidden><div id="ovBody"></div></div>';
  await import('../game/src/ui/home-menu-motion.js');
  const title = document.getElementById('title');
  const overlay = document.getElementById('overlay');
  await vi.runOnlyPendingTimersAsync();
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
  // The slower return must remain alive until its last plate has arrived.
  await vi.advanceTimersByTimeAsync(900);
  expect(title.dataset.homePhase).toBe('in');
  await vi.runOnlyPendingTimersAsync();
  expect(title.dataset.homePhase).toBe('rest');

  // The restored menu can start its next route and recover through the regular close path.
  document.getElementById('mStart').click();
  overlay.hidden = false;
  await Promise.resolve();
  expect(overlay.dataset.homeRoute).toBe('mStart');
  overlay.hidden = true;
  await Promise.resolve();
  await vi.runOnlyPendingTimersAsync();
  expect(title.dataset.homePhase).toBe('rest');
});

it.each([false, true])('a cancelled cold entry permits the next homepage action (observer flushed: %s)', async flushObserver => {
  vi.useFakeTimers();
  vi.resetModules();
  document.body.innerHTML = '<div id="title"><button id="btnCardLib">Library</button><button id="mStart">Start</button></div>'
    + '<div id="overlay" hidden><div id="ovBody"></div></div>';
  await import('../game/src/ui/home-menu-motion.js');
  const title = document.getElementById('title');
  const cover = document.createElement('section');
  cover.className = 'page-loading';
  document.getElementById('btnCardLib').addEventListener('click', () => document.body.appendChild(cover));
  const start = vi.fn(() => {
    document.getElementById('overlay').hidden = false;
    document.getElementById('ovBody').innerHTML = '<section class="slot-page">Slots</section>';
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode', { detail: 'page' }));
  });
  document.getElementById('mStart').addEventListener('click', start);
  document.getElementById('btnCardLib').click();
  await Promise.resolve();
  expect(title.dataset.homePhase).toBe('out');
  document.getElementById('mStart').click();
  expect(start).not.toHaveBeenCalled();
  cover.remove();
  if (flushObserver) {
    await Promise.resolve();
    expect(title.dataset.homePhase).toBe('in');
  }
  document.getElementById('mStart').click();
  expect(start).toHaveBeenCalledOnce();
  expect(document.querySelector('.slot-page')).not.toBeNull();
});
