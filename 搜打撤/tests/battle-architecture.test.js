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

  it('keeps the action chain locked until a nested action has finished', async () => {
    const queue = createActionQueue();
    let releaseChild;
    let unlocked = false;
    const parent = queue.enqueue(() => {
      queue.enqueue(() => new Promise(resolve => { releaseChild = resolve; }));
    });
    const settled = parent.finally(async () => {
      await queue.idle();
      if (!queue.length && !queue.running) unlocked = true;
    });

    await parent;
    await Promise.resolve();
    expect(queue.length).toBe(0); // 子动作已开始，因此不再计入待执行数
    expect(queue.running).toBe(true);
    expect(unlocked).toBe(false);

    releaseChild();
    await settled;
    expect(unlocked).toBe(true);
  });

  it('aborts the running action and rejects queued actions when the battle ends', async () => {
    const queue = createActionQueue();
    const first = queue.enqueue(signal => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), { once: true });
    }));
    const second = queue.enqueue(() => 'never runs');
    queue.clear('battle ended');
    await expect(first).rejects.toThrow('battle ended');
    await expect(second).rejects.toThrow('battle ended');
    await queue.idle();
  });

  it('resolves every idle waiter after the queue becomes idle', async () => {
    const queue = createActionQueue();
    let release;
    const action = queue.enqueue(() => new Promise(resolve => { release = resolve; }));
    const idleA = queue.idle();
    const idleB = queue.idle();
    release('done');
    await expect(action).resolves.toBe('done');
    await expect(Promise.all([idleA, idleB])).resolves.toEqual([undefined, undefined]);
  });

  it('keeps same-stat timed buffs on independent expiry clocks', async () => {
    const combat = await import('../game/src/combat.js');
    const target = { status: {} };
    combat.addBlessing(target, 'atkUp', 2, 1);
    combat.addBlessing(target, 'atkUp', 3, 3);
    expect(target.status.atkUp).toBe(5);
    combat.tickDurations(target);
    expect(target.status.atkUp).toBe(3);
    combat.tickDurations(target);
    expect(target.status.atkUp).toBe(3);
    combat.tickDurations(target);
    expect(target.status.atkUp).toBe(0);
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
    // 平行布局（2026-09-13 留言：不再扇形）：左右对称、无旋转、同高；
    // 超员收紧密度（间距递减）+ >14 张自动分两行
    expect(fanLayout(0, 3).x).toBeLessThan(0);
    expect(fanLayout(2, 3).x).toBeGreaterThan(0);
    expect(fanLayout(2, 3).rot).toBe(0);   // 平行：无旋转
    expect(fanLayout(1, 3).y).toBe(fanLayout(0, 3).y);   // 同一水平线
    expect(fanLayout(0, 3).x).toBe(-fanLayout(2, 3).x);
    expect(fanLayout(0, 3).scale).toBe(1);   // 不再整排缩放
    // 重叠度递增：单张间距（12 张口径）小于 5 张口径
    const spread5 = fanLayout(1, 5).x - fanLayout(0, 5).x;
    const spread12 = fanLayout(1, 12).x - fanLayout(0, 12).x;
    expect(spread12).toBeLessThan(spread5);
    // 两行：15 张时第二行在上方（y < 0）
    expect(fanLayout(14, 15).y).toBeLessThan(0);
    expect(fanLayout(0, 15).y).toBe(0);
  });

  it('does not merge different card ids just because their visible text matches', () => {
    const entries = [
      { uid: 'a', card: { id: 'variant-a', name: '同名牌', cost: 1, desc: '相同描述' } },
      { uid: 'b', card: { id: 'variant-b', name: '同名牌', cost: 1, desc: '相同描述' } },
    ];
    expect(groupHandCards(entries).map(group => group.uids)).toEqual([['a'], ['b']]);
  });

  it('moves card UIDs through zones without duplicates', () => {
    const zones = { draw: ['a', 'b'], hand: ['c'], discard: [] };
    expect(moveUid(zones.draw, zones.hand, 'a')).toBe(true);
    expect(zoneForUid(zones, 'a')).toBe('hand');
    expect(assertUniqueZones(zones)).toBe(true);
    expect(() => assertUniqueZones({ hand: ['x'], discard: ['x'] })).toThrow(/multiple zones/);
  });

  it('normalizes one or multiple enemy intents for the view', () => {
    const intents = intentViewModel([{ kind: 'strike', icon: 'x', label: '攻击', damage: 4, hits: 2 }, { kind: 'guard', label: '防御', damage: 0 }]);
    expect(intents).toHaveLength(2);
    expect(intents[0]).toMatchObject({ damage: 4, hits: 2, totalDamage: 8 });
    expect(intentSummary(intents)).toBe('攻击 · 4 ×2（共8） / 防御');
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
