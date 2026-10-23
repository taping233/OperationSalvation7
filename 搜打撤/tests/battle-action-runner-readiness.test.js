import { expect, it, vi } from 'vitest';
import { createBattleActionRunner } from '../game/src/battle/runtime/battle.action-runner.js';
import { createBattleExecutionSession } from '../game/src/battle/runtime/battle.execution-session.js';
import { createBattleState } from '../game/src/battle/runtime/battle.state.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
function harness(preparePresentation) {
  const session = createBattleExecutionSession();
  let state = createBattleState({ phase: 'player' }), busy = false, activeSignal = null;
  const game = { battleActive: true }, render = vi.fn();
  const cancelled = signal => Object.assign(new Error(String(signal?.reason || 'battle presentation departed')), { name: 'BattleActionCancelledError' });
  const queue = createBattleActionRunner({
    session, getBattleState: () => state, setBattleState: next => { state = next; },
    getGame: () => game, setBusy: value => { busy = value; },
    getActiveActionSignal: () => activeSignal, setActiveActionSignal: value => { activeSignal = value; },
    getLastPersistAt: () => 0, setLastPersistAt() {}, render, preparePresentation,
    actionCancellationError: cancelled,
    throwIfActionCancelled: signal => { if (signal.aborted) throw cancelled(signal); },
  });
  return { queue, session, game, render, get state() { return state; }, get busy() { return busy; }, get activeSignal() { return activeSignal; },
    replaceBattle() { state = createBattleState({ phase: 'player' }); } };
}

it('mounts the busy presentation and waits for true readiness before cost, RNG and every hit', async () => {
  const resource = deferred(), prepare = vi.fn(() => resource.promise), h = harness(prepare);
  const beats = [], cost = vi.fn(), random = vi.fn();
  h.queue(async () => { cost(); random(); for (const hit of [1, 2, 3]) { beats.push(hit); await Promise.resolve(); } });
  await flush();
  expect(h.busy).toBe(true); expect(h.state.phase).toBe('resolving'); expect(h.render).toHaveBeenCalledTimes(1);
  expect(prepare).toHaveBeenCalledTimes(1); expect(cost).not.toHaveBeenCalled(); expect(random).not.toHaveBeenCalled();
  expect(beats).toEqual([]);
  resource.resolve(true); await h.session.actionQueue.idle(); await flush();
  expect(cost).toHaveBeenCalledTimes(1); expect(random).toHaveBeenCalledTimes(1); expect(beats).toEqual([1, 2, 3]);
  expect(h.busy).toBe(false); expect(h.state.phase).toBe('player');
});

it('returns a completion promise through execution and queue idle cleanup', async () => {
  const resource=deferred(), effect=deferred(), h=harness(() => resource.promise);
  const completion=h.queue(() => effect.promise);
  expect(typeof completion?.then).toBe('function');
  let settled=false;
  completion.then(() => { settled=true; });
  await flush(); expect(settled).toBe(false);
  resource.resolve(true); await flush(); expect(settled).toBe(false);
  effect.resolve('completed');
  await expect(completion).resolves.toBe('completed');
  expect(h.busy).toBe(false); expect(h.activeSignal).toBeNull();
  expect(h.session.actionQueue.running).toBe(false);
});

it('a returned cancelled completion settles without reviving a replacement generation', async () => {
  const resource=deferred(), h=harness(() => resource.promise), execute=vi.fn();
  const completion=h.queue(execute);
  h.session.reset('replacement battle'); h.replaceBattle();
  await expect(completion).resolves.toBeUndefined();
  const rendered=h.render.mock.calls.length;
  resource.resolve(true); await flush();
  expect(execute).not.toHaveBeenCalled();
  expect(h.render).toHaveBeenCalledTimes(rendered);
  expect(h.state.phase).toBe('player');
});

it('releases an aborted queue while readiness is unresolved and cannot revive the action later', async () => {
  const resource = deferred(), h = harness(() => resource.promise), execute = vi.fn();
  h.queue(execute); await flush();
  h.session.abort('battle departed');
  await flush(); expect(h.session.actionQueue.running).toBe(false); expect(execute).not.toHaveBeenCalled();
  resource.resolve(true); await flush(); expect(execute).not.toHaveBeenCalled();
});

it.each(['false', 'new-token', 'inactive'])('does not execute after presentation becomes %s', async outcome => {
  const resource = deferred(), h = harness(() => resource.promise), execute = vi.fn();
  h.queue(execute); await flush();
  if (outcome === 'new-token') h.replaceBattle();
  if (outcome === 'inactive') h.game.battleActive = false;
  resource.resolve(outcome !== 'false'); await h.session.actionQueue.idle(); await flush();
  expect(execute).not.toHaveBeenCalled();
  expect(h.activeSignal).toBeNull();
  if (outcome === 'false') { expect(h.busy).toBe(false); expect(h.render).toHaveBeenCalledTimes(1); }
});

it('preserves synchronous execution for headless renderers without a readiness promise', () => {
  const h = harness(() => undefined), execute = vi.fn();
  h.queue(execute); expect(execute).toHaveBeenCalledTimes(1);
});

it.each(['throw', 'reject'])('cleans up busy and the active signal after preparation %s', async kind => {
  const error = new Error('presentation preparation failed'), warning = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const h = harness(() => { if (kind === 'throw') throw error; return Promise.reject(error); }), execute = vi.fn();
    h.queue(execute); await h.session.actionQueue.idle(); await flush();
    expect(execute).not.toHaveBeenCalled(); expect(h.busy).toBe(false); expect(h.state.phase).toBe('player');
    expect(h.activeSignal).toBeNull(); expect(warning).toHaveBeenCalledTimes(1);
  } finally { warning.mockRestore(); }
});

it('serializes consecutive actions while only the first fresh-stage preparation waits for resources', async () => {
  const resource = deferred(), prepare = vi.fn().mockReturnValueOnce(resource.promise).mockReturnValue(true);
  const h = harness(prepare), events = [];
  h.queue(() => events.push('first')); h.queue(() => events.push('second')); await flush();
  expect(prepare).toHaveBeenCalledTimes(1); expect(events).toEqual([]); expect(h.busy).toBe(true);
  resource.resolve(true); await h.session.actionQueue.idle(); await flush();
  expect(prepare).toHaveBeenCalledTimes(2); expect(events).toEqual(['first', 'second']);
  expect(h.busy).toBe(false); expect(h.activeSignal).toBeNull();
});
