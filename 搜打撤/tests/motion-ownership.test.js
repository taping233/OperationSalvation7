import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/core/motion.js', () => ({ reduceMotion: () => false }));

let listeners;
let observers;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  document.body.className = '';
  document.body.innerHTML = '<div id="overlay" class="room-view" hidden><div class="card"><div id="ovBody"></div></div></div>';
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  listeners = [];
  observers = [];
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((type, callback, options) => {
      listeners.push([target, type, callback, options]);
      add(type, callback, options);
    });
  }
  const Observer = MutationObserver;
  vi.stubGlobal('MutationObserver', class extends Observer {
    constructor(callback) { super(callback); observers.push(this); }
  });
});

afterEach(() => {
  for (const observer of observers) observer.disconnect();
  for (const [target, type, callback, options] of listeners) target.removeEventListener(type, callback, options);
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
  document.body.className = '';
  document.head.querySelectorAll('[data-interface-motion]').forEach(link => link.remove());
});

async function installInterface() {
  const overlay = document.getElementById('overlay');
  const body = document.getElementById('ovBody');
  const ui = {
    el: { overlay, ovBody: body },
    showOverlay(_heading, html, mode) { body.innerHTML = html; overlay.hidden = false; this._lastMode = mode; },
    hideOverlay() { overlay.hidden = true; body.replaceChildren(); },
  };
  window.SDT = { UI: ui };
  await import('../game/src/ui/interface-motion.js');
  return { ui, overlay, body };
}

it('the installed interface controller prevents the legacy gate from scheduling a second transition', async () => {
  const { ui, overlay } = await installInterface();
  const { gateSweep } = await import('../game/src/ui/transitions-director.js');
  ui.showOverlay('', '<main class="scene flow-transition"><button data-act="flowContinue">Continue</button></main>', 'page');
  document.querySelector('[data-act="flowContinue"]').click();
  gateSweep();
  await Promise.resolve();
  expect(document.getElementById('t1Gate')).toBeNull();
  expect(overlay.classList.contains('gate-live')).toBe(false);
  expect(overlay.classList.contains('gate-squeeze')).toBe(false);
});

it('base content owns its shell until navigation chooses another page profile', async () => {
  const { ui, overlay } = await installInterface();
  ui.showOverlay('', '<main id="hubMain" class="base-camp"><section class="hub-page">Base</section></main>', 'page');
  expect(overlay.dataset.uiShell).toBe('content');
  expect(overlay.dataset.uiEnter).toBeUndefined();
  ui.showOverlay('', '<main class="settings-page"><section class="settings-content">Settings</section></main>', 'page');
  expect(overlay.dataset.uiShell).toBe('surface');
});

it('a standalone legacy host still animates hub to departure navigation', async () => {
  const body = document.getElementById('ovBody');
  body.innerHTML = '<main id="hubMain"></main>';
  await import('../game/src/ui/transitions-director.js');
  body.innerHTML = '<main id="depMain"></main>';
  await Promise.resolve();
  expect(document.getElementById('t1Gate')?.classList.contains('on')).toBe(true);
});
