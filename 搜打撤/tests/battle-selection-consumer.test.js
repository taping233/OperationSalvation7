// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createBattleSelectionFlow } from '../game/src/battle/core/battle.selection-flow.js';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
const runtime = createBattleRuntime();

afterEach(() => {
  runtime.set$G(null); runtime.set$hand([]); runtime.set$consumed([]); runtime.set$foes([]); runtime.cardAnims.length = 0;
  runtime.set$handSelecting(null); runtime.set$choosing(null); runtime.set$discovering(null); runtime.set$discoverQueue([]);
  runtime.zeroFeeUntil.clear();
});

function fixture(overrides = {}) {
  const entries = new Map([
    ['a', { card: { id: 'a', name: '甲', type: '武术' } }],
    ['b', { card: { id: 'b', name: '乙', type: '武术' } }],
    ['wrong', { card: { id: 'wrong', name: '法术', type: '法术' } }],
    ['stale', { card: { id: 'stale', name: '非手牌', type: '武术' } }],
  ]);
  const session = createBattleExecutionSession();
  const fireConsumeTriggers = vi.fn();
  const queueCardExecution = vi.fn();
  const addTempCard = vi.fn(() => 'copy');
  runtime.set$G({ battleActive: true, log: vi.fn() });
  runtime.set$hand(['a', 'b', 'wrong']);
  runtime.set$consumed([]); runtime.cardAnims.length = 0; runtime.set$foes([{ hp: 100, dead: false }]);
  const flow = createBattleSelectionFlow({ runtime,
    session, cards: { all: () => [], isRandomObtainable: () => true, sellPrice: () => 0 },
    deny: vi.fn(), random01: () => 0, throwIfActionCancelled: () => {},
    findCard: uid => entries.get(uid), requestBattleRender: vi.fn(),
    addTempCard, queueCardExecution, fireConsumeTriggers, fireCatGift: vi.fn(),
    sweepDead: vi.fn(), finish: vi.fn(),
    ...overrides,
  });
  return { flow, session, fireConsumeTriggers, queueCardExecution, addTempCard };
}

describe('effect-selection live candidate and completion boundaries', () => {
  it('rejects stale, wrong-type and repeated consumed UIDs before effects or completion', () => {
    // Generic consumer contract: no retired catalog/equipment producer is reintroduced.
    const { flow, session, fireConsumeTriggers } = fixture();
    const onDone = vi.fn();
    const resume = vi.fn();
    session.handSelectQueue.push({ n: 2, type: '武术', act: 'consume', mandatory: true, onDone });
    flow.processHandSelect();
    session.deferTurnEnd(resume, () => !runtime.handSelecting && !session.handSelectQueue.length);
    flow.pickHandSelect('wrong');
    flow.pickHandSelect('stale');
    expect(runtime.handSelecting.n).toBe(2);
    expect(runtime.consumed).toEqual([]);
    flow.pickHandSelect('a');
    flow.pickHandSelect('a');
    expect(runtime.consumed).toEqual(['a']);
    expect(runtime.hand).toEqual(['b', 'wrong']);
    expect(runtime.handSelecting.n).toBe(1);
    expect(fireConsumeTriggers).toHaveBeenCalledOnce();
    expect(onDone).not.toHaveBeenCalled();
    expect(resume).not.toHaveBeenCalled();
    flow.pickHandSelect('b');
    flow.pickHandSelect('b');
    expect(runtime.consumed).toEqual(['a', 'b']);
    expect(fireConsumeTriggers).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledOnce();
    expect(runtime.handSelecting).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('preserves a nested selection opened by the consumed card instead of clearing it', () => {
    let flow;
    let session;
    const fireConsumeTriggers = vi.fn(() => {
      session.handSelectQueue.push({ n: 1, type: '武术', act: 'copy' });
      flow.processHandSelect();
    });
    ({ flow, session } = fixture({ fireConsumeTriggers }));
    const resume = vi.fn();
    session.handSelectQueue.push({ n: 1, type: '武术', act: 'consume' });
    flow.processHandSelect();
    session.deferTurnEnd(resume, () => !runtime.handSelecting && !session.handSelectQueue.length);
    flow.pickHandSelect('a');
    expect(runtime.handSelecting?.act).toBe('copy');
    expect(runtime.consumed).toEqual(['a']);
    expect(resume).not.toHaveBeenCalled();
    flow.pickHandSelect('b');
    expect(runtime.handSelecting).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('rejects stale/wrong-type free-play picks and submits a live pick only once', () => {
    const { flow, session, queueCardExecution } = fixture();
    session.handSelectQueue.push({ n: 1, type: '武术', act: 'play' });
    flow.processHandSelect();
    flow.pickHandSelect('wrong'); flow.pickHandSelect('stale');
    expect(queueCardExecution).not.toHaveBeenCalled();
    expect(runtime.handSelecting).not.toBeNull();
    flow.pickHandSelect('a'); flow.pickHandSelect('a');
    expect(queueCardExecution).toHaveBeenCalledOnce();
    expect(queueCardExecution.mock.calls[0][0]).toBe('a');
  });

  it.each(['zero', 'discover'])('resumes after a %s selection which does not enqueue an action', act => {
    const { flow, session } = fixture();
    const resume = vi.fn();
    session.deferTurnEnd(resume, () => !runtime.handSelecting && !runtime.discovering);
    if (act === 'zero') {
      session.handSelectQueue.push({ n: 1, type: '武术', act });
      flow.processHandSelect();
      flow.pickHandSelect('a');
      expect(runtime.zeroFeeUntil.has('a')).toBe(true);
    } else {
      runtime.set$discoverQueue([{ n: 1, explicit: [{ id: 'discovered', name: '发现牌', type: '武术' }] }]);
      flow.processDiscoverQueue();
      flow.pickDiscover(0);
      expect(runtime.discovering).toBeNull();
    }
    expect(resume).toHaveBeenCalledOnce();
  });

  it('settles the parent continuation when selected child preflight refuses to queue', () => {
    const queueCardExecution = vi.fn(() => false);
    const { flow, session } = fixture({ queueCardExecution });
    const resume = vi.fn();
    session.handSelectQueue.push({ n: 1, type: '武术', act: 'play' });
    flow.processHandSelect();
    session.deferTurnEnd(resume, () => !runtime.handSelecting);
    flow.pickHandSelect('a');
    expect(queueCardExecution).toHaveBeenCalledOnce();
    expect(runtime.hand).toContain('a');
    expect(resume).toHaveBeenCalledOnce();
  });

  it('drains empty discovery jobs to the next decision instead of stranding the continuation', () => {
    const { flow, session } = fixture();
    const resume = vi.fn();
    runtime.set$discoverQueue([
      { n: 1 }, { n: 1 }, { n: 1 },
      { n: 1, explicit: [{ id: 'next', name: '下一张', type: '武术' }] },
    ]);
    session.deferTurnEnd(resume, () => !runtime.discovering);
    flow.processDiscoverQueue();
    expect(runtime.discovering.options.map(card => card.id)).toEqual(['next']);
    expect(resume).not.toHaveBeenCalled();
    flow.pickDiscover(0);
    expect(runtime.discovering).toBeNull();
    expect(resume).toHaveBeenCalledOnce();
  });

  it('keeps an invalid choice pending and ignores terminal hand/choice callbacks', () => {
    const { flow, session, queueCardExecution } = fixture();
    session.choiceQueue.push({ cardName: '选择', options: ['继续'] });
    flow.processChoice();
    const choice = runtime.choosing;
    for (const index of [-1, 1, 0.5, NaN]) flow.pickChoice(index);
    expect(runtime.choosing).toBe(choice);
    session.handSelectQueue.push({ n: 1, type: '武术', act: 'play' });
    flow.processHandSelect();
    const selection = runtime.handSelecting;
    runtime.set$G({ battleActive: false, log: vi.fn() });
    flow.pickHandSelect('a'); flow.pickChoice(0);
    expect(runtime.handSelecting).toBe(selection);
    expect(runtime.choosing).toBe(choice);
    expect(queueCardExecution).not.toHaveBeenCalled();
  });
});
