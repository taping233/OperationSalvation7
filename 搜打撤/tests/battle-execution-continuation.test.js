// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';
import { createBattleActionRunner } from '../game/src/battle/runtime/battle.action-runner.js';
import { BATTLE_PHASES, createBattleState } from '../game/src/battle/runtime/battle.state.js';

describe('battle execution continuation ownership', () => {
  it('waits for modal completion, then resumes once even under reentrant checks', () => {
    const session = createBattleExecutionSession();
    let modalOpen = true;
    const resume = vi.fn(() => session.resumeTurnEnd());
    expect(session.deferTurnEnd(resume, () => !modalOpen)).toBe(true);
    expect(session.deferTurnEnd(vi.fn(), () => true)).toBe(false);
    expect(session.resumeTurnEnd()).toBe(false);
    modalOpen = false;
    expect(session.resumeTurnEnd()).toBe(true);
    expect(session.resumeTurnEnd()).toBe(false);
    expect(session.turnEndPending).toBe(false);
    expect(resume).toHaveBeenCalledOnce();
  });

  it('waits for the queued child and staged resolution depth', async () => {
    const session = createBattleExecutionSession();
    let releaseChild;
    const resume = vi.fn();
    session.deferTurnEnd(resume, () => true);
    const parent = session.actionQueue.enqueue(() => {
      session.actionQueue.enqueue(() => new Promise(resolve => { releaseChild = resolve; }));
    });
    await parent;
    expect(session.actionQueue.length).toBe(0);
    expect(session.actionQueue.running).toBe(true);
    expect(session.resumeTurnEnd()).toBe(false);
    releaseChild();
    await session.actionQueue.idle();
    session.stagedResolutionDepth = 1;
    expect(session.resumeTurnEnd()).toBe(false);
    session.stagedResolutionDepth = 0;
    expect(session.resumeTurnEnd()).toBe(true);
    expect(resume).toHaveBeenCalledOnce();
  });

  it.each(['reset', 'abort'])('%s cancels the old generation without consuming the next continuation', method => {
    const session = createBattleExecutionSession();
    const old = vi.fn();
    const next = vi.fn();
    session.deferTurnEnd(old, () => true);
    const generation = session.generation;
    session[method]();
    expect(session.generation).toBe(generation + 1);
    expect(session.resumeTurnEnd()).toBe(false);
    session.deferTurnEnd(next, () => true);
    expect(session.resumeTurnEnd()).toBe(true);
    expect(old).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
  });

  it('action-runner idle transfers busy/phase ownership before ordinary player cleanup', async () => {
    const session = createBattleExecutionSession();
    let state = createBattleState({ phase: BATTLE_PHASES.PLAYER });
    let busy = false;
    let signal = null;
    const game = { battleActive: true, persistSave: vi.fn() };
    const resumed = vi.fn(() => { state = { ...state, phase: BATTLE_PHASES.ENEMY }; busy = true; });
    session.deferTurnEnd(resumed, () => true);
    const queueAction = createBattleActionRunner({
      session, getBattleState: () => state, setBattleState: next => { state = next; },
      getGame: () => game, setBusy: value => { busy = value; },
      getActiveActionSignal: () => signal, setActiveActionSignal: value => { signal = value; },
      getLastPersistAt: () => 0, setLastPersistAt: () => {}, render: vi.fn(),
      actionCancellationError: () => new Error('cancelled'), throwIfActionCancelled: () => {},
      onIdle: () => session.resumeTurnEnd(),
    });
    queueAction(async () => {});
    await session.actionQueue.idle();
    for (let i = 0; i < 8; i++) await Promise.resolve();
    expect(resumed).toHaveBeenCalledOnce();
    expect(state.phase).toBe(BATTLE_PHASES.ENEMY);
    expect(busy).toBe(true);
    expect(game.persistSave).not.toHaveBeenCalled();
  });
});
it('throwing cancellation does not prevent generation cleanup or queue clearing', () => {
  const session=createBattleExecutionSession(), error=vi.spyOn(console,'error').mockImplementation(()=>{});
  session.deferTurnEnd(vi.fn(),()=>false,()=>{throw new Error('cancel failed');});
  session.handSelectQueue.push({}); session.choiceQueue.push({}); session.stagedResolutionDepth=3;
  session.reset(); expect(session.turnEndPending).toBe(false); expect(session.handSelectQueue).toEqual([]);
  expect(session.choiceQueue).toEqual([]); expect(session.stagedResolutionDepth).toBe(0); expect(session.generation).toBe(1);
  expect(error).toHaveBeenCalledOnce(); error.mockRestore();
});
