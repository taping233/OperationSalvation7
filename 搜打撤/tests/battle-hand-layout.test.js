import { expect, it } from 'vitest';
import { handDisplayLayout } from '../game/src/battle/view/battle.hand-layout.js';

it.each([1,2,3,4,5,6,7,8,9])('keeps %i hand groups inside the 1920 canvas and their identity strips separated', count => {
  const width = 1920 * .74;
  const row = Array.from({ length: count }, (_, index) => handDisplayLayout(index, count, width));
  row.forEach((slot, index) => {
    expect(Math.abs(slot.x) + 110).toBeLessThanOrEqual(width / 2);
    expect(Math.abs(slot.rot)).toBeLessThanOrEqual(3);
    expect(slot.y).toBeLessThanOrEqual(27);
    expect(slot.visibleWidth).toBeGreaterThanOrEqual(120);
    if (index < count - 1) expect(slot.x + 8 + slot.visibleWidth + 6).toBeLessThan(row[index + 1].x + 8);
  });
  expect(row[0].x + row.at(-1).x).toBe(0);
  expect(row[0].y).toBe(row.at(-1).y);
});

it('supports a centered card and rejects groups outside the one-page contract', () => {
  expect(handDisplayLayout(0, 1, 1420).x).toBe(0);
  expect(() => handDisplayLayout(0, 10, 1420)).toThrow(RangeError);
});
