import { expect, it } from 'vitest';
import { frameImpactRemaining, queueCardAction, takeCardAction } from '../game/src/battle/view/battle.action-timing.js';
import { wuTimeline } from '../game/src/battle/view/battle.frame-catalog.js';
import { changwuyuTimeline } from '../game/src/battle/view/battle.frame-catalog-changwuyu.js';
import { threeRoleTimeline } from '../game/src/battle/view/battle.frame-catalog-three-role.js';

it.each([1, 2])('follows delivered contact poses at pace %s instead of a shared windup constant', pace => {
  for (const [role, timeline, contactIndex] of [
    ['wu', wuTimeline('atk', pace), 4], ['changwuyu', changwuyuTimeline('atk', pace), 3],
    ...['baita', 'heixiang', 'xingyue'].map(role => [role, threeRoleTimeline(role, 'atk', pace), 4]),
    ['changwuyu', changwuyuTimeline('cast', pace), 3],
    ...['baita', 'xingyue'].map(role => [role, threeRoleTimeline(role, 'cast', pace), 4]),
  ]) {
    const expected = timeline.dur.slice(0, contactIndex).reduce((a, b) => a + b, 0);
    expect(frameImpactRemaining({ role, timeline, index: 0, nextAt: 1000 + timeline.dur[0], now: 1000 })).toBe(expected);
    expect(frameImpactRemaining({ role, timeline, index: 1, nextAt: 1000 + timeline.dur[0] + timeline.dur[1], now: 1050 })).toBeCloseTo(expected - 50);
    expect(frameImpactRemaining({ role, timeline, index: contactIndex, nextAt: 2000, now: 1100 })).toBe(0);
  }
});

it('uses the filtered playing sequence and declines missing contact and neutral-only casts', () => {
  const timeline = { list: ['sprite-v1/neutral', 'sprite-v1/frame-039'], dur: [42, 80] };
  expect(frameImpactRemaining({ role: 'wu', timeline, index: 0, nextAt: 1042, now: 1010 })).toBe(32);
  expect(frameImpactRemaining({ role: 'wu', timeline: wuTimeline('cast'), index: 0, nextAt: 1800, now: 1000 })).toBeNull();
  expect(frameImpactRemaining({ role: 'missing', timeline, index: 0, nextAt: 1042, now: 1010 })).toBeNull();
});

it('keeps support-card actions and lets a real windup own damage without parsing card rules', () => {
  const body = {}, otherBody = {};
  queueCardAction(body, 'cast');
  expect(takeCardAction(otherBody)).toBeUndefined();
  expect(takeCardAction(body)).toBe('cast');
  expect(takeCardAction(body)).toBeUndefined();
  queueCardAction(body, 'atk');
  expect(takeCardAction(body, [{ cls: 'windupfx', cue: { attacker: 'player-attack' } }])).toBeNull();
  expect(takeCardAction(body)).toBeUndefined();
});
