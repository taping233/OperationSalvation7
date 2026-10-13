// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const animate = vi.hoisted(() => vi.fn());
vi.mock('../game/src/ui/home-linked-interactions.js', () => ({ linkedAnimate:animate }));
import { animateBaseRefresh, bindBaseMotion } from '../game/src/hub/base-motion-v4.js';

let root;
beforeEach(() => {
  document.body.className = '';
  document.body.innerHTML = `<section id="hubMain"><button data-browser-page="next">下一页</button><button class="base-command"><span class="base-command-arrow">→</span></button><input data-warehouse-filter="type"><div class="card-browser-track"></div><details class="warehouse-more-filters"><summary>筛选</summary><div>条件</div></details></section>`;
  root = document.getElementById('hubMain');
  vi.stubGlobal('matchMedia', () => ({ matches:false }));
  animate.mockReset().mockImplementation(() => ({ cancel:vi.fn(), finished:new Promise(() => {}) }));
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

it('repeated binding keeps one command feedback and preserves the business click', () => {
  const action = vi.fn();
  const command = root.querySelector('.base-command');
  command.addEventListener('click', action);
  bindBaseMotion(root); bindBaseMotion(root);
  command.click();
  expect(action).toHaveBeenCalledOnce();
  expect(animate).toHaveBeenCalledOnce();
  expect(animate.mock.calls[0][0]).toBe(command.querySelector('.base-command-arrow'));
});

it('rapid same-page refreshes cancel the previous feedback instead of accumulating animations', () => {
  const track = root.querySelector('.card-browser-track');
  animateBaseRefresh(track);
  const previous = animate.mock.results[0].value;
  animateBaseRefresh(track);
  expect(previous.cancel).toHaveBeenCalledOnce();
  expect(animate.mock.calls[1][0]).toBe(track);
});

it('system and in-game reduced motion bypass decorative feedback while actions remain available', () => {
  bindBaseMotion(root);
  vi.stubGlobal('matchMedia', () => ({ matches:true }));
  root.querySelector('button').click();
  vi.stubGlobal('matchMedia', () => ({ matches:false }));
  document.body.className = 'reduce-motion';
  root.querySelector('button').click();
  expect(animate).not.toHaveBeenCalled();
  expect(root.querySelector('button').disabled).toBe(false);
});

it('disabled commands do not respond and opening filters reveals only their content', () => {
  bindBaseMotion(root);
  const command = root.querySelector('.base-command'); command.disabled = true;
  command.dispatchEvent(new MouseEvent('click', { bubbles:true }));
  expect(animate).not.toHaveBeenCalled();
  const details = root.querySelector('details'); details.open = true;
  details.dispatchEvent(new Event('toggle'));
  expect(animate.mock.calls[0][0]).toBe(details.querySelector('div'));
});
