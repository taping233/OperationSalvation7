import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { presentVictory } from '../game/src/battle/view/battle.victory.js';

let stage, resolveAnimation, cancel;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage sts"></div></div>';
  stage = document.querySelector('.battle-stage'); stage._battleToken = 'one';
  window.SDT = { Motion: { reduceMotion: () => false } };
  cancel = vi.fn();
  Element.prototype.animate = vi.fn(() => ({ finished: new Promise(resolve => { resolveAnimation = resolve; }), cancel }));
});
afterEach(() => { delete Element.prototype.animate; });

it('keeps the battle mounted and deduplicates feedback until its animation finishes', async () => {
  const first = presentVictory();
  expect(presentVictory()).toBe(first);
  expect(stage.inert).toBe(true);
  expect(document.querySelectorAll('.battle-victory-feedback')).toHaveLength(1);
  resolveAnimation();
  expect(await first).toBe(true);
  expect(stage.isConnected).toBe(true);
  expect(stage.inert).toBe(false);
  expect(stage.querySelector('.battle-victory-feedback')).toBeNull();
});

it('cancels a closed battle without advancing its settlement', async () => {
  const result = presentVictory();
  document.getElementById('overlay').hidden = true;
  expect(await result).toBe(false);
  expect(cancel).toHaveBeenCalledOnce();
});

it('does not clear a later battle loading guard when the DOM changes owners', async () => {
  const result = presentVictory();
  stage._battleToken = 'two'; stage.inert = true;
  stage.appendChild(document.createElement('div'));
  expect(await result).toBe(false);
  expect(stage.inert).toBe(true);
});

it('adds no wait for reduced motion', async () => {
  window.SDT.Motion.reduceMotion = () => true;
  expect(await presentVictory()).toBe(true);
  expect(Element.prototype.animate).not.toHaveBeenCalled();
});
