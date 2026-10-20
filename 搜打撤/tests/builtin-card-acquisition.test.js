import { describe, expect, it, vi } from 'vitest';
import { createCardSemanticOperations } from '../game/src/battle/effects/card-semantic-operations.js';

describe('temporary random acquisition preserves its declared battle pool', () => {
  it.each(['normal', 'boss'])('%s uses original ordered candidates and exactly one random draw per card', mode => {
    const item = { id: 'item', name: '道具', type: '道具' };
    const first = { id: 'first', name: '第一张招式', type: '法术' };
    const second = { id: 'second', name: '第二张招式', type: '武术' };
    const excluded = { id: 'excluded', type: '法术', unrandom: true };
    const random = vi.fn().mockReturnValueOnce(0).mockReturnValueOnce(0.49).mockReturnValueOnce(0.99);
    const selected = [], jobs = [];
    const discover = vi.fn(() => { throw Error('temporary acquisition must not use the discovery pool'); });
    const resolve = createCardSemanticOperations({ runtime: { mode }, combat: {} });
    const step = resolve({ name: '临时获取' }, { op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'hand', expire: 'nextTurnStart' }, null, {
      getAllCards: () => [item, first, excluded, second], isRandomObtainable: candidate => !candidate.unrandom,
      randomBattle: random, randomDiscoverCard: discover,
      addTempCard: card => { selected.push(card.id); return `generated-${selected.length}`; },
      addDelayed: job => jobs.push(job), log() {}, esc: String,
    });
    expect(step.next()).toEqual({ value: true, done: true });
    expect(selected).toEqual(mode === 'normal' ? ['item', 'first', 'second'] : ['first', 'first', 'second']);
    expect(random).toHaveBeenCalledTimes(3); expect(discover).not.toHaveBeenCalled();
    expect(jobs).toEqual([{ special: 'consumeTemps', uids: ['generated-1', 'generated-2', 'generated-3'], cardName: '临时获取' }]);
  });
  it('an empty boss pool produces no cards, scheduled work or random draws', () => {
    const random = vi.fn(), add = vi.fn(), delay = vi.fn();
    const resolve = createCardSemanticOperations({ runtime: { mode: 'boss' }, combat: {} });
    const step = resolve({ name: '临时获取' }, { op: 'acquire', n: 3, pool: { kind: '随机' }, dest: 'hand', expire: 'nextTurnStart' }, null, {
      getAllCards: () => [{ type: '道具' }], isRandomObtainable: () => true,
      randomBattle: random, addTempCard: add, addDelayed: delay, log() {},
    });
    expect(step.next()).toEqual({ value: false, done: true });
    expect(random).not.toHaveBeenCalled(); expect(add).not.toHaveBeenCalled(); expect(delay).not.toHaveBeenCalled();
  });
});
