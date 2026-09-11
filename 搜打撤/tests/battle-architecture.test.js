import { describe, expect, it } from 'vitest';
import { createActionQueue } from '../game/src/battle.actions.js';
import { createAnimationController } from '../game/src/battle.animation.js';
import { groupHandCards, fanLayout } from '../game/src/battle.hand.js';
import { assertUniqueZones, moveUid, zoneForUid } from '../game/src/battle.piles.js';
import { intentSummary, intentViewModel } from '../game/src/battle.intents.js';
import { actionFeedback, feedbackClass, feedbackDelay } from '../game/src/battle.feedback.js';
import { renderCombatPiles } from '../game/src/battle.piles.view.js';
import { BATTLE_PHASES, beginTargeting, cancelTargeting, createBattleState, transitionBattle } from '../game/src/battle.state.js';

describe('battle architecture foundation', () => {
  it('uses an explicit phase and makes targeting cancellation idempotent', () => {
    const state = transitionBattle(createBattleState(), BATTLE_PHASES.PLAYER);
    const targeting = beginTargeting(state, 'c1', ['e1']);
    expect(targeting.interaction).toMatchObject({ mode: 'targeting', cardUid: 'c1', targetIds: ['e1'] });
    const cancelled = cancelTargeting(targeting);
    expect(cancelTargeting(cancelled)).toEqual(cancelled);
    expect(cancelled.phase).toBe(BATTLE_PHASES.PLAYER);
  });

  it('serializes actions and waits for each action to finish', async () => {
    const queue = createActionQueue();
    const order = [];
    const first = queue.enqueue(async () => { order.push('a:start'); await Promise.resolve(); order.push('a:end'); return 'a'; });
    const second = queue.enqueue(async () => { order.push('b'); return 'b'; });
    await expect(Promise.all([first, second])).resolves.toEqual(['a', 'b']);
    expect(order).toEqual(['a:start', 'a:end', 'b']);
    expect(queue.length).toBe(0);
  });

  it('cancels pending animation waits without leaving active handles', async () => {
    const animations = createAnimationController();
    const pending = animations.wait(1000);
    expect(animations.activeCount).toBe(1);
    pending.cancel();
    await expect(pending.promise).rejects.toThrow('animation cancelled');
    expect(animations.activeCount).toBe(0);
  });

  it('keeps hand grouping/layout independent from battle rules', () => {
    const entries = [
      { uid: 'a', card: { name: '斩', desc: '造成伤害' } },
      { uid: 'b', card: { name: '斩', desc: '造成伤害' } },
      { uid: 'c', card: { name: '盾', desc: '获得护甲' } },
    ];
    expect(groupHandCards(entries).map(group => group.uids)).toEqual([['a', 'b'], ['c']]);
    // 扇形布局：左右对称、边缘外张、中心牌最高；超员整体缩小不换行
    expect(fanLayout(0, 3).x).toBeLessThan(0);
    expect(fanLayout(2, 3).x).toBeGreaterThan(0);
    expect(fanLayout(2, 3).rot).toBeGreaterThan(0);
    expect(fanLayout(1, 3).y).toBeLessThan(fanLayout(0, 3).y);
    expect(fanLayout(0, 3).x).toBe(-fanLayout(2, 3).x);
    expect(fanLayout(0, 12).scale).toBeLessThan(fanLayout(0, 5).scale);
    expect(fanLayout(0, 16).scale).toBeLessThan(fanLayout(0, 12).scale);
  });

  it('moves card UIDs through zones without duplicates', () => {
    const zones = { draw: ['a', 'b'], hand: ['c'], discard: [] };
    expect(moveUid(zones.draw, zones.hand, 'a')).toBe(true);
    expect(zoneForUid(zones, 'a')).toBe('hand');
    expect(assertUniqueZones(zones)).toBe(true);
    expect(() => assertUniqueZones({ hand: ['x'], discard: ['x'] })).toThrow(/multiple zones/);
  });

  it('normalizes one or multiple enemy intents for the view', () => {
    const intents = intentViewModel([{ kind: 'strike', icon: 'x', label: '攻击', damage: 4 }, { kind: 'guard', label: '防御', damage: 0 }]);
    expect(intents).toHaveLength(2);
    expect(intentSummary(intents)).toBe('攻击 · 4 / 防御');
  });

  it('keeps combat feedback timing deterministic per unit', () => {
    const counters = {};
    expect(feedbackDelay('e1', counters)).toBe(0);
    expect(feedbackDelay('e1', counters)).toBe(320);
    expect(feedbackDelay('e2', counters)).toBe(0);
    expect(feedbackClass({ unit: 'self' })).toBe('hurt');
    expect(feedbackClass({ warm: true })).toBe('heal');
    expect(actionFeedback('damage', { unit: 'e1' })).toMatchObject({ type: 'damage', unit: 'e1' });
  });

  it('renders combat pile badges without owning pile state', () => {
    const piles = renderCombatPiles({ mode: 'boss', drawCount: ['a'], discardCount: ['b', 'c'], graveCount: [], pileTip: pile => `${pile.length}张`, cardBackHTML: 'BACK', escAttr: value => value });
    expect(piles.draw).toContain('1张');
    expect(piles.rest).toContain('2张');
    expect(piles.rest).toContain('data-act="btGrave"');
  });
});
