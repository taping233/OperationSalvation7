// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const animate = vi.hoisted(() => vi.fn());
vi.mock('../game/src/ui/home-linked-interactions.js', () => ({ linkedAnimate:animate }));
import { animateBaseRefresh, bindBaseMotion } from '../game/src/hub/base-motion-v4.js';

let root;
beforeEach(() => {
  document.body.className = '';
  document.body.innerHTML = `<section id="hubMain"><button data-browser-page="next">下一页</button><button class="base-command"><span class="base-command-arrow">→</span></button><input data-warehouse-filter="type"><div class="card-browser-track"></div></section>`;
  root = document.getElementById('hubMain');
  vi.stubGlobal('matchMedia', () => ({ matches:false }));
  animate.mockReset().mockImplementation(() => ({ cancel:vi.fn(), finished:new Promise(() => {}) }));
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

it('commands preserve their business click without replaying the retired arrow motion', () => {
  const action = vi.fn();
  const command = root.querySelector('.base-command');
  command.addEventListener('click', action);
  bindBaseMotion(root); bindBaseMotion(root);
  command.click();
  expect(action).toHaveBeenCalledOnce();
  expect(animate).not.toHaveBeenCalled();
});

it('rapid same-page refreshes cancel the previous feedback instead of accumulating animations', () => {
  const track = root.querySelector('.card-browser-track');
  animateBaseRefresh(track);
  const previous = animate.mock.results[0].value;
  animateBaseRefresh(track);
  expect(previous.cancel).toHaveBeenCalledOnce();
  expect(animate.mock.calls[1][0]).toBe(track);
});

it('detail and room slides keep their configured duration', () => {
  const track = root.querySelector('.card-browser-track');
  animateBaseRefresh(track, 0, { detail:true, duration:380, x:64 });
  expect(animate.mock.calls[0][2].duration).toBe(380);
  animateBaseRefresh(track, 0, { detail:false, duration:440, x:112 });
  expect(animate.mock.calls[1][2].duration).toBe(440);
});

it('system and in-game reduced motion bypass decorative feedback while actions remain available', () => {
  bindBaseMotion(root);
  vi.stubGlobal('matchMedia', () => ({ matches:true }));
  root.querySelector('button').click();
  animateBaseRefresh(root.querySelector('.card-browser-track'));
  vi.stubGlobal('matchMedia', () => ({ matches:false }));
  document.body.className = 'reduce-motion';
  root.querySelector('button').click();
  animateBaseRefresh(root.querySelector('.card-browser-track'));
  expect(animate).not.toHaveBeenCalled();
  expect(root.querySelector('button').disabled).toBe(false);
});

it('disabled commands do not respond', () => {
  bindBaseMotion(root);
  const command = root.querySelector('.base-command'); command.disabled = true;
  command.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  expect(animate).not.toHaveBeenCalled();

});
