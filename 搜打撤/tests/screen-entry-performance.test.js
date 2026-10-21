import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { pageMotionProfile } from '../game/src/ui/page-motion-profiles.js';
import { stagePageVisual, cancelPageVisual } from '../game/src/ui/page-visual-ready.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', vi.fn(fn => setTimeout(fn, 16)));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
});
afterEach(() => { cancelPageVisual(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren(); });
const body = () => document.getElementById('ovBody');
const ui = () => ({ _overlayRevision: 1, el: { overlay: document.getElementById('overlay'), ovBody: body() }, _pageBgReady: Promise.resolve() });

it('identifies a late-priority large page with one root scan on cold and repeated calls', () => {
  body().innerHTML = `<main class="pg card-library-page"><div class="lib-grid">${'<article><button>卡牌</button></article>'.repeat(600)}</div></main>`;
  const one = vi.spyOn(body(), 'querySelector'), all = vi.spyOn(body(), 'querySelectorAll');
  for (let i = 0; i < 4; i++) expect(pageMotionProfile(body()).key).toBe('photo-studio');
  expect(one).not.toHaveBeenCalled(); expect(all).toHaveBeenCalledTimes(4);
});
it('preserves profile priority before document order and first matching root within a profile', () => {
  body().innerHTML = '<main class="pg card-library-page"></main><section class="settings-page" id="first"></section><section class="settings-page" id="second"></section>';
  expect(pageMotionProfile(body()).page.id).toBe('first');
  document.getElementById('second').className = 'bag-v2';
  expect(pageMotionProfile(body()).key).toBe('backpack');
  document.getElementById('second').remove();
  expect(pageMotionProfile(body()).key).toBe('settings');
  body().replaceChildren(); expect(pageMotionProfile(body())).toBeNull(); expect(pageMotionProfile(null)).toBeNull();
});
it('keeps complex selector semantics and excludes the supplied container itself', () => {
  body().className = 'bag-v2';
  body().innerHTML = '<main class="pg hub"><div class="dt-grid"></div></main>';
  expect(pageMotionProfile(body()).key).toBe('data');
  body().querySelector('.dt-grid').remove(); expect(pageMotionProfile(body()).key).toBe('other-page');
  body().innerHTML = '<main class="pg flow-transition"></main>'; expect(pageMotionProfile(body())).toBeNull();
});
it('ready pages reveal after readiness measurement and presentation frames, with the shared handoff presentation frame', async () => {
  body().innerHTML = '<main class="settings-page">设置</main>';
  const reveal = vi.fn(); stagePageVisual(ui(), reveal);
  await vi.advanceTimersByTimeAsync(16); expect(reveal).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(32); expect(reveal).toHaveBeenCalledOnce();
  expect(requestAnimationFrame).toHaveBeenCalledTimes(3);
});
it('cold visible images and backgrounds still gate reveal, while lazy images do not decode', async () => {
  body().innerHTML = '<main><img src="/portrait.webp"><img src="/lazy.webp" loading="lazy"></main>';
  const [image, lazy] = body().querySelectorAll('img');
  let decodeReady, backgroundReady;
  image.decode = vi.fn(() => new Promise(resolve => { decodeReady = resolve; }));
  lazy.decode = vi.fn(() => Promise.resolve());
  Object.defineProperty(image, 'naturalWidth', { value: 200 });
  image.getBoundingClientRect = () => ({width:200,height:200,top:0,left:0,right:200,bottom:200});
  const state = ui(); state._pageBgReady = new Promise(resolve => { backgroundReady = resolve; });
  const reveal = vi.fn(); stagePageVisual(state, reveal);
  await vi.advanceTimersByTimeAsync(80); expect(image.decode).toHaveBeenCalledOnce(); expect(lazy.decode).not.toHaveBeenCalled(); expect(reveal).not.toHaveBeenCalled();
  decodeReady(); await vi.advanceTimersByTimeAsync(32); expect(reveal).not.toHaveBeenCalled();
  backgroundReady(); await vi.advanceTimersByTimeAsync(32); expect(reveal).toHaveBeenCalledOnce();
});
