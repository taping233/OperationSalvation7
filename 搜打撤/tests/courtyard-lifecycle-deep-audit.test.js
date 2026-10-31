import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { courtyardV3HTML, readCourtyardPreferences, saveCourtyardPreferences } from '../game/src/hub/hub.courtyard-v3.js';
import { mountCourtyardV3 } from '../game/src/hub/hub.courtyard-runtime.js';
// Real courtyard runtime + real rain and koi engines. Only browser canvas/audio/RAF APIs are fakes.
let releases, frames, observers, media, audio, add, remove, hidden, mutations;
const context = () => new Proxy({}, { get(target, key) { return target[key] ??= String(key).startsWith('create') ? () => ({ addColorStop() {} }) : vi.fn(); } });
beforeEach(() => {
  releases = []; frames = new Map(); observers = []; mutations = []; let next = 0;
  vi.stubGlobal('requestAnimationFrame', callback => { frames.set(++next, callback); return next; });
  vi.stubGlobal('cancelAnimationFrame', id => frames.delete(id));
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  vi.stubGlobal('matchMedia', () => media);
  vi.stubGlobal('ResizeObserver', class { constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); observers.push(this); } observe() {} });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(context);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 500, top: 0, left: 0 });
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const NativeMutationObserver = window.MutationObserver;
  vi.stubGlobal('MutationObserver', class extends NativeMutationObserver { constructor(callback) { super(callback); mutations.push(this); vi.spyOn(this, 'disconnect'); } });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 0 }, frequency: { value: 0 } });
  audio = { sampleRate: 100, destination: {}, currentTime: 0, createBuffer: () => ({ getChannelData: () => new Float32Array(200) }), createBufferSource: node, createBiquadFilter: node, createGain: node, suspend: vi.fn(() => Promise.resolve()), resume: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()) };
  vi.stubGlobal('AudioContext', vi.fn(function () { return audio; }));
  add = vi.spyOn(document, 'addEventListener'); remove = vi.spyOn(document, 'removeEventListener');
  window.SDT = { Icons: { rich: value => value }, Sound: { sfx() {}, scene() {} }, Motion: { overlayIn() {} } };
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
});
afterEach(() => { for (const release of releases) release(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); document.body.className = ''; });
async function open() {
  const { overlayMethods } = await import('../game/src/ui/overlay.js');
  const ui = { ...overlayMethods, el: { overlay: document.getElementById('overlay'), ovTitle: document.getElementById('ovTitle'), ovBody: document.getElementById('ovBody') }, _canCancelOverlay: () => false, _isolateOverlayBackground() {}, hideTooltip() {}, _resolveOverlayInitialFocus: () => null };
  ui.showOverlay('', courtyardV3HTML(), 'page');
  const host = document.querySelector('[data-courtyard]');
  const observerCount = mutations.length;
  const previousFrames = new Set(frames.keys());
  releases.push(mountCourtyardV3(host, { read:readCourtyardPreferences, write:saveCourtyardPreferences }));
  const ownedFrames = [...frames.keys()].filter(frame => !previousFrames.has(frame));
  return { ui, host, ownedFrames, ownedObservers: mutations.slice(observerCount), canvas: host.querySelector('.courtyard-v3-canvas') };
}
describe('courtyard owner lifecycle regression', () => {
  it.each(['paused', 'reduced-motion', 'document-hidden', 'active'])('replacing a %s courtyard releases canvas, observers and document/media listeners', async mode => {
    if (mode === 'reduced-motion') document.body.classList.add('reduce-motion');
    const { ui, host, canvas, ownedFrames, ownedObservers } = await open();
    if (mode === 'paused') host.querySelector('[data-courtyard-control="pause"]').click();
    if (mode === 'document-hidden') { hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange')); }
    // Other-page entry, e.g. the supported Alt+0 settings or Alt+7 photo shortcut.
    ui.showOverlay('', '<section class="settings-page">settings</section>', 'page');
    await Promise.resolve(); await Promise.resolve();
    expect(host.isConnected).toBe(false);
    expect(canvas.width).toBe(1);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(ownedObservers).toHaveLength(3); // local subtree, blocking ancestors, and connection ownership
    expect(ownedObservers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
    expect(ownedFrames.every(frame => !frames.has(frame))).toBe(true);
    const handler = add.mock.calls.find(([type]) => type === 'visibilitychange')?.[1];
    expect(handler).toBeTypeOf('function');
    expect(remove.mock.calls.some(([type, fn]) => type === 'visibilitychange' && fn === handler)).toBe(true);
    expect(media.removeEventListener).toHaveBeenCalledOnce();
    // A later retained owner release remains idempotent.
    releases.pop()();
    expect(canvas.width).toBe(1);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(media.removeEventListener).toHaveBeenCalledOnce();
  });
  it('reduced-motion courtyard rain closes once when settings replaces it', async () => {
    document.body.classList.add('reduce-motion');
    const { ui, host } = await open();
    host.querySelector('[data-courtyard-control="sound"]').click();
    expect(audio.resume).toHaveBeenCalledOnce();
    ui.showOverlay('', '<section class="settings-page">settings</section>', 'page');
    await Promise.resolve(); await Promise.resolve();
    expect(audio.close).toHaveBeenCalledOnce();
    const prior = audio.resume.mock.calls.length;
    document.dispatchEvent(new Event('visibilitychange'));
    expect(audio.resume.mock.calls.length).toBe(prior); // departed room no longer handles global event
    releases.pop()();
    expect(audio.close).toHaveBeenCalledOnce();
  });
});

describe('owner visibility and active-room invariants', () => {
  it.each(['hidden', 'closing', 'data-ui-closing', 'removed'])('releases a static room when overlay owner becomes %s', async mode => {
    document.body.classList.add('reduce-motion');
    const { ui, canvas, ownedObservers } = await open();
    if (mode === 'hidden') ui.el.overlay.hidden = true;
    if (mode === 'closing') ui.el.overlay.classList.add('closing');
    if (mode === 'data-ui-closing') ui.el.overlay.setAttribute('data-ui-closing', '1');
    if (mode === 'removed') ui.el.overlay.remove();
    await Promise.resolve(); await Promise.resolve();
    expect(canvas.width).toBe(1);
    expect(observers[0].disconnect).toHaveBeenCalledOnce();
    expect(ownedObservers).toHaveLength(3); // local subtree, blocking ancestors, and connection ownership
    expect(ownedObservers.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
  });
  it('keeps attached room alive through preference, pause, and visibility changes', async () => {
    const { host, canvas } = await open();
    expect(canvas.width).toBe(900);
    document.body.classList.add('reduce-motion');
    await Promise.resolve(); await Promise.resolve();
    expect(host.classList.contains('is-still')).toBe(true);
    expect(observers[0].disconnect).not.toHaveBeenCalled();
    document.body.classList.remove('reduce-motion');
    await Promise.resolve(); await Promise.resolve();
    expect(host.classList.contains('is-still')).toBe(false);
    host.querySelector('[data-courtyard-control="pause"]').click();
    hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    expect(host.querySelector('[data-courtyard-control="pause"]').textContent).toBe('继续');
    expect(canvas.width).toBe(900);
    expect(observers[0].disconnect).not.toHaveBeenCalled();
    releases.pop()();
    expect(canvas.width).toBe(1);
  });
});
