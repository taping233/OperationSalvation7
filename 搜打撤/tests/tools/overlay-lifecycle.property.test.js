import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fc from 'fast-check';

vi.hoisted(() => { window.SDT = { Icons: { rich: value => value }, Sound: { sfx() {}, scene() {} }, Motion: { overlayIn() {} } }; });
import { overlayMethods } from '../../game/src/ui/overlay.js';
let UI, closed;
function setup() {
  document.body.className = '';
  document.body.innerHTML = '<main><button id="opener">打开</button><div id="overlay" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  UI = { ...overlayMethods, _overlayInerted: [], _overlayRevision: 0, _roomActive: false,
    el: Object.fromEntries(['overlay', 'ovTitle', 'ovBody'].map(id => [id, document.getElementById(id)])),
    hideTooltip: vi.fn(), _cancelPageBg: vi.fn(),
  };
}
beforeEach(() => { vi.useFakeTimers(); closed = vi.fn(); document.addEventListener('sdt-overlay-close', closed); setup(); });
afterEach(() => { document.removeEventListener('sdt-overlay-close', closed); vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });
const open = () => UI.showOverlay('操作', '<button data-cancel="true">返回</button>', 'page');

it('hidden and repeated fade-out close calls have no extra close event or revision', () => {
  UI.hideOverlay(); expect(closed).not.toHaveBeenCalled(); expect(UI._overlayRevision).toBe(0);
  open(); UI.hideOverlay(); const revision = UI._overlayRevision;
  UI.hideOverlay(); expect(closed).toHaveBeenCalledTimes(1); expect(UI._overlayRevision).toBe(revision);
  vi.advanceTimersByTime(225); expect(UI.el.overlay.hidden).toBe(true);
});
it('immediate escalation finishes the existing close once and cannot tear down a newly opened page', () => {
  open(); UI.hideOverlay(); const revision = UI._overlayRevision;
  UI.hideOverlay({ immediate: true });
  expect(UI.el.overlay.hidden).toBe(true); expect(closed).toHaveBeenCalledTimes(1);
  expect(UI._overlayRevision).toBe(revision);
  open(); vi.advanceTimersByTime(500);
  expect(UI.el.overlay.hidden).toBe(false); expect(UI.el.ovBody.textContent).toBe('返回');
});
it('generated open/close/immediate/tick sequences preserve model state and one close event per transition', () => {
  fc.assert(fc.property(fc.array(fc.constantFrom('open', 'close', 'immediate', 'tick'), { minLength: 1, maxLength: 35 }), actions => {
    vi.clearAllTimers(); setup(); closed.mockClear();
    let state = 'hidden', closeCount = 0, revision = 0;
    for (const action of actions) {
      if (action === 'open') { open(); state = 'open'; revision++; }
      else if (action === 'tick') { vi.advanceTimersByTime(250); if (state === 'closing') state = 'hidden'; }
      else {
        const immediate = action === 'immediate';
        if (state === 'open') { closeCount++; revision++; state = immediate ? 'hidden' : 'closing'; }
        else if (state === 'closing' && immediate) state = 'hidden';
        UI.hideOverlay({ immediate });
      }
      expect(UI.el.overlay.hidden, JSON.stringify({ action, state, html: UI.el.overlay.outerHTML, timer: UI._hideTimer })).toBe(state === 'hidden');
      expect(closed).toHaveBeenCalledTimes(closeCount);
      expect(UI._overlayRevision).toBe(revision);
      if (state === 'open') expect(UI.el.ovBody.textContent).toBe('返回');
      if (state === 'hidden') expect(UI._hideTimer == null).toBe(true);
    }
  }), { seed: 20261019, numRuns: 200 });
});

it('reopen during fade remains visible', () => { open(); UI.hideOverlay(); open(); expect(UI.el.overlay.hidden).toBe(false); vi.advanceTimersByTime(300); expect(UI.el.overlay.hidden).toBe(false); });

it('a real close advances the return token once and cancels owned feedback once', () => {
  open();
  const zoom = document.createElement('div'); zoom.id = 'cardZoom'; zoom._closeCardZoom = vi.fn(); document.body.appendChild(zoom);
  UI._cancelPageBg.mockClear(); UI.hideTooltip.mockClear();
  const before = UI._overlayRevision;
  UI.hideOverlay(); UI.hideOverlay(); UI.hideOverlay({ immediate: true });
  expect(UI._overlayRevision).toBe(before + 1);
  expect(UI._cancelPageBg).toHaveBeenCalledTimes(1); expect(UI.hideTooltip).toHaveBeenCalledTimes(1);
  expect(zoom._closeCardZoom).toHaveBeenCalledExactlyOnceWith(true);
});
it('optional background, tooltip and zoom handlers may be absent during close', () => {
  open(); UI._cancelPageBg = null; UI.hideTooltip = undefined;
  const zoom = document.createElement('div'); zoom.id = 'cardZoom'; document.body.appendChild(zoom);
  expect(() => UI.hideOverlay({ immediate: true })).not.toThrow();
  expect(UI.el.overlay.hidden).toBe(true);
});
