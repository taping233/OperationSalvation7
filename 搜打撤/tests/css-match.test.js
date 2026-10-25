import { afterEach, expect, it } from 'vitest';
import { matchesCssSelector } from './helpers/css-match.js';
afterEach(() => document.body.replaceChildren());
it('matches nested alternatives, exclusions and child relationships without changing the DOM', () => {
  document.body.innerHTML = '<div class="card"><span class="item"></span></div><div class="card blocked"><span class="item"></span></div>';
  const before = document.body.innerHTML;
  const selector = '.card:not(:is(.blocked,.disabled)):has(> :where(.item,.other)) > .item';
  expect([...document.querySelectorAll('.item')].map(el => matchesCssSelector(el,selector))).toEqual([true,false]);
  expect(document.body.innerHTML).toBe(before);
});
it('resolves adjacent relationships and still rejects an invalid selector', () => {
  document.body.innerHTML = '<div class="a"></div><div class="b"></div>';
  expect(matchesCssSelector(document.querySelector('.a'),'.a:has(+ .b)')).toBe(true);
  expect(matchesCssSelector(document.querySelector('.b'),'.a:has(+ .b)')).toBe(false);
  expect(() => matchesCssSelector(document.body,'[')).toThrow();
});
