// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createBattleSelectionFlow } from '../game/src/battle/core/battle.selection-flow.js';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';

function fixture() {
  const runtime = createBattleRuntime();
  const session = createBattleExecutionSession();
  const entries = new Map(['a', 'b', 'c'].map(uid => [uid, { uid, card: { id: uid, name: uid, type: '武术' } }]));
  runtime.set$G({ battleActive: true, log: vi.fn() });
  runtime.set$hand(['a', 'b', 'c']);
  runtime.set$foes([{ hp: 100, dead: false }]);
  const queued = [];
  const flow = createBattleSelectionFlow({ runtime, session,
    cards: { all: () => [], isRandomObtainable: () => true, sellPrice: () => 0 },
    random01: () => 0, deny: vi.fn(), requestBattleRender: vi.fn(),
    throwIfActionCancelled: () => {}, findCard: uid => entries.get(uid),
    queueCardExecution: (...args) => { queued.push(args); },
    sweepDead: vi.fn(), finish: vi.fn(),
  });
  function resolveNext() {
    const args = queued.at(-1);
    runtime.set$hand(runtime.hand.filter(uid => uid !== args[0]));
    args[7]?.();
  }
  return { runtime, session, flow, queued, resolveNext };
}

describe('multi-card hand-play selection', () => {
  it('waits for each free play and offers the remaining picks until N cards resolve', () => {
    const { runtime, session, flow, queued, resolveNext } = fixture();
    const onDone = vi.fn();
    session.handSelectQueue.push({ n: 2, type: '武术', act: 'play', onDone });
    flow.processHandSelect();
    flow.pickHandSelect('a');
    expect(queued).toHaveLength(1);
    expect(runtime.handSelecting).toBeNull();
    expect(onDone).not.toHaveBeenCalled();
    resolveNext();
    expect(runtime.handSelecting).toMatchObject({ n: 1, act: 'play' });
    flow.pickHandSelect('b');
    resolveNext();
    expect(queued.map(args => args[0])).toEqual(['a', 'b']);
    expect(runtime.handSelecting).toBeNull();
    expect(onDone).toHaveBeenCalledOnce();
  });

  it('preserves a nested child selection before returning to the remaining parent picks', () => {
    const { runtime, session, flow, resolveNext } = fixture();
    session.handSelectQueue.push({ n: 2, type: '武术', act: 'play' });
    flow.processHandSelect();
    flow.pickHandSelect('a');
    session.handSelectQueue.push({ n: 1, type: '武术', act: 'zero' });
    flow.processHandSelect();
    resolveNext();
    expect(runtime.handSelecting?.act).toBe('zero');
    flow.pickHandSelect('c');
    expect(runtime.handSelecting).toMatchObject({ n: 1, act: 'play' });
  });
});
