import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expandComponentScopes } from '../scripts/css-component-scopes.mjs';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { revealTransition } from '../game/src/ui/transition-handoff.js';
import { cancelPageVisual, stagePageVisual } from '../game/src/ui/page-visual-ready.js';

const heldMarkup = '<div class="city-run-transition flow-transition resume-hold"><div class="camp-entry-cut page-cut-waiting"><div class="camp-entry-scenery"><img alt=""></div><div class="transition-heading"><h2>旅途继续</h2><i class="expedition-cut-rule"></i></div></div></div>';

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(() => callback(performance.now()), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
});
afterEach(() => {
  cancelPageVisual();
  vi.useRealTimers(); vi.unstubAllGlobals();
  document.body.replaceChildren(); document.body.className = '';
  document.querySelector('[data-held-test-style]')?.remove();
});

it('held node artwork and title are settled while the original and inherited cuts wait', () => {
  const style = document.createElement('style');
  style.dataset.heldTestStyle = '1';
  // jsdom does not implement native CSS nesting; lower it as the browser does.
  style.textContent = expandComponentScopes(['camp-entry', 'expedition-transitions', 'transition-heading', 'page-visual-ready', 'transition-handoff']
    .map(name => readFileSync(resolve(process.cwd(), 'game/css', `${name}.css`), 'utf8')).join('\n'));
  document.head.append(style);
  const overlay = document.getElementById('overlay');
  overlay.insertAdjacentHTML('beforeend', heldMarkup);
  const original = overlay.lastElementChild;
  const inherited = document.createElement('div');
  inherited.className = 'page-visual-scene'; inherited.append(original.cloneNode(true)); overlay.append(inherited);
  for (const root of [original, inherited]) {
    const cut = getComputedStyle(root.querySelector('.camp-entry-cut'));
    const art = getComputedStyle(root.querySelector('.camp-entry-scenery'));
    const title = getComputedStyle(root.querySelector('h2'));
    expect(cut.animation).toBe('none'); expect(cut.transform).toBe('none');
    expect(art.animation).toBe('none'); expect(art.opacity).toBe('1');
    expect(title.animation).toBe('none'); expect(title.opacity).toBe('1');
  }
});

it('slow readiness retains one illustration then finishes its single fade without a second rich entrance', async () => {
  const cover = document.createElement('div'); cover.innerHTML = heldMarkup;
  document.getElementById('overlay').append(cover);
  let resolveReady;
  const onReveal = vi.fn();
  let settled = false;
  const done = revealTransition(cover, { painted:true, ready:() => new Promise(resolve => { resolveReady = resolve; }), onReveal })
    .then(result => { settled = true; return result; });
  await vi.advanceTimersByTimeAsync(500);
  expect(cover.classList.contains('leaving')).toBe(false); expect(onReveal).not.toHaveBeenCalled();
  expect(cover.classList.contains('transition-handoff-rich')).toBe(false);
  resolveReady(true);
  await vi.advanceTimersByTimeAsync(16);
  expect(onReveal).toHaveBeenCalledOnce(); expect(cover.classList.contains('leaving')).toBe(true);
  expect(cover.style.getPropertyValue('--motion-handoff')).toBe('680ms');
  expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(680);
  expect(settled).toBe(true); expect(await done).toBe(true);
});

it('a late battle readiness result cannot reveal or close a newer destination', async () => {
  const overlay = document.getElementById('overlay'), body = document.getElementById('ovBody');
  const ui = { _overlayRevision:1, el:{ overlay, ovBody:body } };
  body.innerHTML = '<div class="battle-stage" data-battle-entry="loading"></div>';
  const stage = body.firstElementChild;
  const oldReveal = vi.fn(), nextReveal = vi.fn();
  const scene = document.createElement('div'); scene.innerHTML = heldMarkup;
  stagePageVisual(ui, oldReveal, { scene:scene.firstElementChild });
  await vi.advanceTimersByTimeAsync(48);
  expect(overlay.querySelectorAll('.page-visual-handoff')).toHaveLength(1);
  body.innerHTML = '<main>新目的页</main>'; ui._overlayRevision++;
  ui._pageBgReady = Promise.resolve();
  stagePageVisual(ui, nextReveal);
  stage.dataset.battleEntry = 'ready';
  await vi.runAllTimersAsync();
  expect(oldReveal).not.toHaveBeenCalled(); expect(nextReveal).toHaveBeenCalledOnce();
  expect(body.textContent).toBe('新目的页'); expect(overlay.hidden).toBe(false);
});

it('dedicated camp and photo cuts retain their full rich choreography', async () => {
  const cover = document.createElement('div'); cover.innerHTML = '<div class="camp-entry-cut"></div>';
  document.getElementById('overlay').append(cover);
  let settled = false;
  const done = revealTransition(cover, { painted:true, duration:980 }).then(value => { settled = true; return value; });
  await vi.advanceTimersByTimeAsync(196);
  expect(cover.classList.contains('transition-handoff-rich')).toBe(true); expect(settled).toBe(false);
  await vi.advanceTimersByTimeAsync(800);
  expect(await done).toBe(true);
});

it('reduced motion still waits for readiness and skips the held fade', async () => {
  document.body.classList.add('reduce-motion');
  const cover = document.createElement('div'); cover.innerHTML = heldMarkup;
  document.getElementById('overlay').append(cover);
  let resolveReady;
  const onReveal = vi.fn();
  const done = revealTransition(cover, { painted:true, ready:() => new Promise(resolve => { resolveReady = resolve; }), onReveal });
  await vi.advanceTimersByTimeAsync(100);
  expect(onReveal).not.toHaveBeenCalled(); resolveReady(true);
  await vi.advanceTimersByTimeAsync(16);
  expect(await done).toBe(true); expect(onReveal).toHaveBeenCalledOnce();
});
