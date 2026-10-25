// @vitest-environment jsdom
// Common semantic assertions; metrics are observations, never baseline-as-bug expectations.
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const calls = vi.hoisted(() => ({ entries: [] }));
vi.mock('../game/src/ui/surface-motion.js', () => ({
  enterSurface: (...args) => calls.entries.push(args), clearSurface() {}, leaveSurface() {},
}));
vi.mock('../game/src/ui/camp-entry.js', () => ({ captureArchiveExit() {}, enterCamp() {}, clearCampEntry() {} }));
vi.mock('../game/src/ui/archive-motion.js', () => ({ enterArchive() {}, clearArchiveMotion() {} }));
vi.mock('../game/src/ui/page-visual-ready.js', () => ({ stagePageVisual: (_ui, reveal) => reveal(), stageMapReturn() {}, cancelPageVisual() {} }));
vi.mock('../game/src/ui/target-motion.js', () => ({ hasVisualMotion: () => false, installTargetMotionLifecycle() {} }));
vi.mock('../game/src/ui/card-state-motion.js', () => ({ installCardStateMotion() {} }));
vi.mock('../game/src/ui/selection-state-motion.js', () => ({ installSelectionStateMotion() {} }));
let observers, listeners;
beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers(); calls.entries.length = 0;
  observers = []; listeners = [];
  const Observer = MutationObserver;
  vi.stubGlobal('MutationObserver', class extends Observer {
    constructor(callback) { super(callback); observers.push(this); }
  });
  for (const target of [document, window]) {
    const add = target.addEventListener.bind(target);
    vi.spyOn(target, 'addEventListener').mockImplementation((...args) => { listeners.push([target, args]); add(...args); });
  }
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
});
afterEach(() => {
  observers.forEach(observer => observer.disconnect());
  listeners.forEach(([target, args]) => target.removeEventListener(...args));
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  delete window.SDT;
  document.body.replaceChildren(); document.body.className = '';
  document.head.querySelectorAll('[data-interface-motion]').forEach(link => link.remove());
});
const hub = (room, view) => `<main id="hubMain" class="base-camp" data-page="${room}"><button class="hub-tab on" data-tab="${room}"></button><section class="hub-page" data-view="${view}"></section></main>`;
async function fixture() {
  const overlay = document.getElementById('overlay');
  let phase = 'before';
  const counts = { before: 0, after: 0, allQueries: 0, allQueryLists: 0 };
  const query = Element.prototype.querySelector;
  vi.spyOn(Element.prototype, 'querySelector').mockImplementation(function (selector) {
    counts.allQueries++;
    if (this.id === 'ovBody' && selector === '#hubMain') counts[phase]++;
    return query.call(this, selector);
  });
  const queryAll = Element.prototype.querySelectorAll;
  vi.spyOn(Element.prototype, 'querySelectorAll').mockImplementation(function (selector) {
    counts.allQueryLists++; return queryAll.call(this, selector);
  });
  const ui = {
    _lastMode: 'page', _motionHeading: 'Base',
    el: { overlay, get ovBody() { return document.getElementById('ovBody'); } },
    showOverlay(_heading, html, mode, options) {
      phase = 'after';
      if (options?.rebuild) {
        const replacement = document.createElement('div'); replacement.id = 'ovBody';
        this.el.ovBody.replaceWith(replacement);
      }
      this.el.ovBody.innerHTML = html; overlay.hidden = false; this._lastMode = mode;
      options?.hook?.(this.el.ovBody);
      return 'shown';
    },
    hideOverlay() { overlay.hidden = true; this.el.ovBody.replaceChildren(); },
  };
  window.SDT = { UI: ui };
  const originalShow = ui.showOverlay;
  await import('../game/src/ui/interface-motion.js');
  expect(ui.showOverlay).not.toBe(originalShow);
  expect(document.body.classList.contains('interface-motion')).toBe(true);
  return { ui, counts, reset() { phase = 'before'; for (const key in counts) counts[key] = 0; calls.entries.length = 0; } };
}
it('reuses hub roots within each read group, refreshing after every synchronous show/hook and DOM rebuild', async () => {
  const f = await fixture();
  for (const rebuild of [false, true, false]) {
    f.ui.el.ovBody.innerHTML = hub('shop', 'shop/goods');
    f.reset();
    expect(f.ui.showOverlay('Base', hub('stash', 'stash/cards'), 'page', {
      rebuild, hook: body => { body.innerHTML = hub('classes', 'classes/profile'); },
    })).toBe('shown');
    console.log('HUB_METRIC ' + JSON.stringify({ arm: process.env.QUERY_ARM, scenario: 'hook-rebuild', rebuild, ...f.counts }));
    expect(calls.entries.at(-1)?.[1]?.navigation).toMatchObject({ changed: true, detail: false, direction: -1 });
    expect(f.ui.el.overlay.dataset.uiShell).toBe('content');
    expect(f.ui.el.ovBody.querySelector('#hubMain').dataset.page).toBe('classes');
  }
});
it('keeps the no-hub battle return path and performs fresh reads on repeated calls', async () => {
  const f = await fixture();
  for (let i = 0; i < 2; i++) {
    f.ui.el.ovBody.innerHTML = '<main class="bt-settings">Rules</main>';
    f.reset();
    f.ui.showOverlay('', '<main class="battle-stage">Battle</main>', 'battle');
    console.log('HUB_METRIC ' + JSON.stringify({ arm: process.env.QUERY_ARM, scenario: 'no-hub-return', repetition: i, ...f.counts }));
    expect(f.ui.el.overlay.dataset.uiMotion).toBe('fast');
    expect(f.ui.el.ovBody.textContent).toBe('Battle');
  }
});

it('reacquires roots after A/B/A slot-shaped content, pending close/reopen and throwing hook', async () => {
  const f = await fixture();
  for (const slot of ['A','B','A']) {
    f.ui.showOverlay('Base', hub('stash', `stash/${slot}`), 'page');
    expect(f.ui.el.ovBody.querySelector('.hub-page').dataset.view).toBe(`stash/${slot}`);
  }
  f.ui.el.overlay.classList.add('room-view');
  f.ui.hideOverlay();
  expect(f.ui.el.overlay.hidden).toBe(false);
  const action = () => {};
  f.ui._acts = { fresh: action };
  f.ui.showOverlay('Base', hub('classes', 'classes/profile'), 'page');
  vi.runOnlyPendingTimers();
  expect(f.ui.el.overlay.hidden).toBe(false);
  expect(f.ui._acts.fresh).toBe(action);
  expect(f.ui.el.ovBody.querySelector('#hubMain').dataset.page).toBe('classes');
  const error = new Error('hook interrupted');
  expect(() => f.ui.showOverlay('Base', hub('shop','shop/goods'), 'page', { hook: () => { throw error; } })).toThrow(error);
  f.ui.hideOverlay({ immediate: true });
  expect(f.ui.el.overlay.hidden).toBe(true);
  f.ui.showOverlay('Base', hub('stash','stash/cards'), 'page');
  expect(f.ui.el.overlay.hidden).toBe(false);
  expect(f.ui.el.ovBody.querySelector('#hubMain').dataset.page).toBe('stash');
});
