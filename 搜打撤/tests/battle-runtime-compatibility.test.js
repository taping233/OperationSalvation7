// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';

const slices = ['session', 'piles', 'interaction', 'effects', 'presentation'];
const sliceLoaders = {
 session: () => import('../game/src/battle/runtime/battle.runtime.session.js'),
 piles: () => import('../game/src/battle/runtime/battle.runtime.piles.js'),
 interaction: () => import('../game/src/battle/runtime/battle.runtime.interaction.js'),
 effects: () => import('../game/src/battle/runtime/battle.runtime.effects.js'),
 presentation: () => import('../game/src/battle/runtime/battle.runtime.presentation.js'),
};
const loadSlice = name => sliceLoaders[name]();

// Observe the state-reader/subscriber contract around a real isolated runtime.
// Publishing a field also covers fields without a public setter; ordinary writes
// use the real runtime and its notification bridge.
function observedRuntime() {
  const runtime = createBattleRuntime();
  const fields = Object.keys(runtime).filter(key => Object.getOwnPropertyDescriptor(runtime, key).get);
  const fieldSet = new Set(fields), listeners = new Set(), published = new Map(), reads = [];
  const view = Object.create(null);
  for (const key of Object.keys(runtime)) {
    if (fieldSet.has(key)) {
      Object.defineProperty(view, key, { get: () => published.has(key) ? published.get(key) : runtime[key] });
    } else view[key] = runtime[key];
  }
  view.subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  const state = new Proxy(view, { get(target, key, receiver) {
    if (fieldSet.has(key)) reads.push(key);
    if (!Object.hasOwn(target, key)) {
      reads.push(key);
      throw new Error(`Unexpected state read: ${String(key)}`);
    }
    return Reflect.get(target, key, receiver);
  } });
  const notify = key => { for (const listener of listeners) listener(state, key); };
  runtime.subscribe((_state, key) => { published.delete(key); notify(key); });
  return { runtime, state, fields, reads, notify, subscriberCount: () => listeners.size,
    publish(key, value) { published.set(key, value); notify(key); } };
}

async function load(fixture) {
  vi.resetModules();
  vi.doMock('../game/src/battle/runtime/battle.runtime.default.js', () => ({ defaultBattleRuntime: fixture.state }));
  return Promise.all(slices.map(loadSlice));
}

afterEach(() => {
  vi.doUnmock('../game/src/battle/runtime/battle.runtime.default.js');
  vi.resetModules();
});

it('preserves all 188 public compatibility exports and every method alias identity', async () => {
  const fixture = observedRuntime();
  const modules = await load(fixture);
  const names = modules.flatMap(module => Object.keys(module));
  expect(modules.map(module => Object.keys(module).length)).toEqual([42, 29, 35, 66, 16]);
  expect(new Set(names).size).toBe(188);
  expect([...names].sort()).toEqual(Object.keys(fixture.runtime).filter(key => !['combat', 'subscribe'].includes(key)).sort());
  for (const module of modules) for (const name of Object.keys(module)) {
    expect(module[name], name).toBe(fixture.runtime[name]);
  }
  expect(fixture.subscriberCount()).toBe(5);
});

it('reads each initial state field once in its original slice order', async () => {
  const fixture = observedRuntime();
  // Sequential imports make module evaluation order explicit, independently of
  // a runner's concurrent import scheduling.
  vi.resetModules();
  vi.doMock('../game/src/battle/runtime/battle.runtime.default.js', () => ({ defaultBattleRuntime: fixture.state }));
  for (const slice of slices) await loadSlice(slice);
  expect(fixture.fields).toHaveLength(91);
  expect(fixture.reads).toEqual(fixture.fields);
});

it('keeps all 91 ESM bindings live and reads only the field being published', async () => {
  const fixture = observedRuntime();
  const modules = await load(fixture);
  for (const field of fixture.fields) {
    fixture.reads.length = 0;
    const value = Object.freeze({ field });
    const owners = modules.filter(module => Object.hasOwn(module, field));
    expect(owners, field).toHaveLength(1);
    fixture.publish(field, value);
    expect(owners[0][field], field).toBe(value);
    expect(fixture.reads, field).toEqual([field]);
    fixture.reads.length = 0;
    fixture.publish(field, value);
    expect(owners[0][field], field).toBe(value);
    expect(fixture.reads, field).toEqual([field]);
  }
});

it('keeps adjacent external subscribers and reentrant field writes in their original order', async () => {
  const fixture = observedRuntime(), trace = [];
  vi.resetModules();
  vi.doMock('../game/src/battle/runtime/battle.runtime.default.js', () => ({ defaultBattleRuntime: fixture.state }));
  const session = await loadSlice('session');
  let piles;
  const hand = ['next'], game = { id: 'next-game' };
  fixture.state.subscribe((_state, key) => {
    trace.push(['before-piles', key, session.G, piles.hand]);
    if (key === 'G') fixture.runtime.set$hand(hand);
  });
  piles = await loadSlice('piles');
  const initialHand = piles.hand;
  fixture.state.subscribe((_state, key) => trace.push(['after-piles', key, session.G, piles.hand]));
  for (const slice of slices.slice(2)) await loadSlice(slice);
  fixture.reads.length = 0;
  fixture.runtime.set$G(game);
  expect(trace).toEqual([
    ['before-piles', 'G', game, initialHand],
    ['before-piles', 'hand', game, initialHand],
    ['after-piles', 'hand', game, hand],
    ['after-piles', 'G', game, hand],
  ]);
  expect(fixture.reads).toEqual(['G', 'hand']);
  expect(fixture.subscriberCount()).toBe(7);
});

it('ignores unknown, Symbol and prototype keys without touching state', async () => {
  const fixture = observedRuntime();
  await load(fixture);
  fixture.reads.length = 0;
  for (const key of ['missing', 'constructor', '__proto__', 'toString', 'hasOwnProperty', Symbol('G'), Symbol.toStringTag]) {
    expect(() => fixture.notify(key), String(key)).not.toThrow();
  }
  expect(fixture.reads).toEqual([]);
});

it('keeps earlier compatibility modules bound to their original runtime after another instance loads', async () => {
  const first = observedRuntime(), second = observedRuntime();
  const firstModules = await load(first), secondModules = await load(second);
  first.runtime.set$energy(7);
  expect([firstModules[0].energy, secondModules[0].energy]).toEqual([7, 0]);
  second.runtime.set$energy(3);
  expect([firstModules[0].energy, secondModules[0].energy]).toEqual([7, 3]);
  const counts = { first: 2 };
  firstModules[3].set$handInfuseCounts(counts);
  expect(firstModules[3].handInfuseCounts).toEqual(counts);
  expect(firstModules[3].handInfuseCounts).not.toBe(counts);
  expect(secondModules[3].handInfuseCounts).toEqual({});
});
