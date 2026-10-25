// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { createBattleRuntime } from '../game/src/battle/runtime/battle.runtime.factory.js';

afterEach(() => {
  vi.doUnmock('../game/src/battle/core/battle.engine.factory.js');
  vi.doUnmock('../game/src/battle/core/battle.default-context.js');
});

it('keeps getter/setter metadata, frozen descriptors and the original public key order', () => {
  const runtime = createBattleRuntime();
  const keys = Object.keys(runtime);
  expect(keys.slice(0, 5)).toEqual(['combat', 'subscribe', 'battleState', 'G', 'foes']);
  expect(keys.indexOf('set$G')).toBe(93);
  expect(keys.slice(keys.indexOf('set$G'), keys.indexOf('set$G') + 5))
    .toEqual(['set$G', 'set$opts', 'set$mode', 'set$battleState', 'set$foes']);
  expect(Object.isFrozen(runtime)).toBe(true);
  let getterCount = 0, setterCount = 0;
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(runtime))) {
    expect(descriptor.enumerable).toBe(true);
    expect(descriptor.configurable).toBe(false);
    if (descriptor.get) {
      getterCount++;
      expect(descriptor.set).toBeUndefined();
      expect(descriptor.get.name).toBe(`get ${key}`);
      expect(descriptor.get.length).toBe(0);
      expect(Object.hasOwn(descriptor.get, 'prototype')).toBe(false);
    } else if (key.startsWith('set$')) {
      setterCount++;
      expect(descriptor.writable).toBe(false);
      expect(descriptor.value.name).toBe(key);
      expect(descriptor.value.length).toBe(1);
      expect(Object.hasOwn(descriptor.value, 'prototype')).toBe(true);
    }
  }
  expect([getterCount, setterCount]).toEqual([91, 66]);
  expect(() => { runtime.energy = 99; }).toThrow(TypeError);
});

it('preserves synchronous reentrant notification order and isolated state', () => {
  const runtime = createBattleRuntime(), other = createBattleRuntime();
  const events = [];
  runtime.subscribe((state, key) => {
    events.push(['first', key, state.energy, state.busy]);
    if (key === 'energy') state.set$busy(true);
  });
  const stop = runtime.subscribe((state, key) => events.push(['second', key, state.energy, state.busy]));
  runtime.set$energy(7);
  expect(events).toEqual([
    ['first', 'energy', 7, false], ['first', 'busy', 7, true],
    ['second', 'busy', 7, true], ['second', 'energy', 7, true],
  ]);
  stop();
  runtime.set$busy(false);
  expect(events.at(-1)).toEqual(['first', 'busy', 7, false]);
  expect([other.energy, other.busy]).toEqual([0, false]);
});

it('retains the copying setter while ordinary collection setters preserve input identity', () => {
  const runtime = createBattleRuntime();
  const counts = { first: 2 }, hand = ['first'];
  runtime.set$handInfuseCounts(counts);
  runtime.set$hand(hand);
  expect(runtime.handInfuseCounts).toEqual(counts);
  expect(runtime.handInfuseCounts).not.toBe(counts);
  expect(runtime.hand).toBe(hand);
  counts.first = 9;
  expect(runtime.handInfuseCounts.first).toBe(2);
  runtime.recordHandInfusion(['first', 'first']);
  expect(runtime.handInfuseCounts.first).toBe(3);
});

it('keeps every compatibility command late-bound after reconfiguration, including steps and rejection', async () => {
  vi.resetModules();
  vi.doMock('../game/src/battle/core/battle.engine.factory.js', () => ({ createBattleEngine: ports => ports.fixture }));
  vi.doMock('../game/src/battle/core/battle.default-context.js', () => ({
    createDefaultBattleContext: ports => ({ audio: {}, ...ports }),
  }));
  const engine = await import('../game/src/battle/core/battle.engine.js');
  expect(() => engine.getSnapshot()).toThrow('Battle engine has not been configured');
  const methods = Object.keys(engine).filter(name => name !== 'configureBattleEngine');
  const fixture = id => {
    const target = Object.fromEntries(methods.map(name => [name, function (...args) {
      return { id, name, args, receiver: this === target };
    }]));
    target.canReconfigure = () => true;
    target.resolveCard.steps = (...args) => ({ id, name:'steps', args });
    return target;
  };
  engine.configureBattleEngine({ fixture:fixture('first'), sound() {} });
  const savedCommands = methods.map(name => [name, engine[name]]);
  for (const [name, command] of savedCommands) {
    expect(command.name).toBe(name);
    expect(command.length).toBe(name === 'cancelDiscover' ? 1 : 0);
    expect(Object.hasOwn(command, 'prototype')).toBe(false);
    expect(command('uid')).toMatchObject({ id:'first', name, receiver:true });
  }
  expect(engine.resolveCard.steps('card')).toEqual({ id:'first', name:'steps', args:['card'] });
  engine.configureBattleEngine({ fixture:fixture('second'), sound() {} });
  for (const [name, command] of savedCommands) {
    expect(engine[name]).toBe(command);
    expect(command('uid')).toMatchObject({ id:'second', name, receiver:true });
  }
  expect(engine.resolveCard.steps('card')).toEqual({ id:'second', name:'steps', args:['card'] });
  expect(() => engine.configureBattleEngine({ fixture:{ canReconfigure:() => false }, sound() {} }))
    .toThrow('Cannot configure an active battle engine');
  expect(engine.getSnapshot()).toMatchObject({ id:'second' });
});
