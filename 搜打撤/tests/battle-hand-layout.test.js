// @vitest-environment node
import { expect, it } from 'vitest';
import { handDisplayLayout } from '../game/src/battle/view/battle.hand-layout.js';

it.each([1,2,3,4,5,6,7,8,9])('keeps %i hand groups inside the 1920 canvas and their identity strips separated', count => {
  const width = 1920 * .74;
  const row = Array.from({ length: count }, (_, index) => handDisplayLayout(index, count, width));
  row.forEach((slot, index) => {
    expect(Math.abs(slot.x) + 130 * slot.scale).toBeLessThanOrEqual(width / 2 + 1);
    expect(Math.abs(slot.rot)).toBeLessThanOrEqual(3);
    expect(slot.y).toBeLessThanOrEqual(27);
    expect(slot.scale).toBe(1);
    expect(slot.rest).toBe(64);
    expect(slot.visibleWidth).toBeGreaterThanOrEqual(96);
    if (index < count - 1) expect(slot.x + 8 + slot.visibleWidth + 6).toBeLessThan(row[index + 1].x + 8);
  });
  expect(row[0].x + row.at(-1).x).toBe(0);
  expect(row[0].y).toBe(row.at(-1).y);
});

it('keeps the resting hand in the lower scene with its full printed name and a visible focused face', () => {
  const slot = handDisplayLayout(0, 6, 1290);
  const height = 1080, cardHeight = 390, bottom = 92;
  const restingTop = height - bottom - cardHeight + slot.rest;
  expect(restingTop).toBeGreaterThanOrEqual(height * .60);
  expect(height - restingTop).toBeGreaterThanOrEqual(150);
  const focusedTop = height - bottom - cardHeight * 1.05;
  expect(focusedTop).toBeGreaterThan(0);
  expect(focusedTop + cardHeight * 1.05).toBeLessThan(height);
});

it('fits dense hands by overlap while keeping a readable card size', () => {
  const row = Array.from({ length: 9 }, (_, index) => handDisplayLayout(index, 9, 1290));
  expect(row[0].scale).toBe(handDisplayLayout(0, 1, 1290).scale);
  expect(row[0].x - 130).toBeGreaterThanOrEqual(-646);
  expect(row.at(-1).x + 130).toBeLessThanOrEqual(646);
});

it('supports a centered card and rejects groups outside the one-page contract', () => {
  expect(handDisplayLayout(0, 1, 1420).x).toBe(0);
  expect(() => handDisplayLayout(0, 10, 1420)).toThrow(RangeError);
});
