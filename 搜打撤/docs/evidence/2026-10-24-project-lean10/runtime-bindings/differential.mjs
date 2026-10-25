import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as acorn from 'acorn';

const root = process.cwd();
const before = path.join(root, 'node_modules/.cache/project-lean10/runtime-bindings/before');
const manifest = JSON.parse(fs.readFileSync(path.join(before, 'manifest.json'), 'utf8'));
const dataUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`;

async function loadSource(code, file, mocks = {}) {
  const ast = acorn.parse(code, { ecmaVersion:'latest', sourceType:'module' });
  const replacements = ast.body.filter(node => node.type === 'ImportDeclaration').map(node => ({
    start:node.source.start, end:node.source.end,
    value:mocks[node.source.value] || pathToFileURL(path.resolve(path.dirname(file), node.source.value)).href,
  }));
  for (const edit of replacements.reverse()) {
    code = code.slice(0, edit.start) + JSON.stringify(edit.value) + code.slice(edit.end);
  }
  return import(dataUrl(code));
}

function functionFacts(fn) {
  return {
    name:fn.name, length:fn.length, keys:Object.keys(fn), ownKeys:Object.getOwnPropertyNames(fn),
    prototype:Object.hasOwn(fn, 'prototype'), ownConstructor:fn.prototype?.constructor === fn,
    descriptors:Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(fn)).map(([key, item]) => [key, {
      enumerable:item.enumerable, configurable:item.configurable, writable:item.writable,
    }])),
  };
}

function apiFacts(api) {
  return Object.entries(Object.getOwnPropertyDescriptors(api)).map(([key, item]) => ({
    key, enumerable:item.enumerable, configurable:item.configurable, writable:item.writable,
    getter:item.get ? functionFacts(item.get) : null,
    setter:item.set ? functionFacts(item.set) : null,
    value:typeof item.value === 'function' ? functionFacts(item.value) : typeof item.value,
  }));
}

const normalized = value => value instanceof Map ? [...value].map(normalized)
  : value instanceof Set ? [...value].map(normalized)
  : Array.isArray(value) ? value.map(normalized)
  : typeof value === 'function' ? { function:value.name }
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalized(item)])) : value;

function runtimeFacts(createRuntime) {
  const runtime = createRuntime(), events = [];
  const tokenIncrement = createRuntime().battleState.token - runtime.battleState.token;
  runtime.subscribe((state, key) => {
    events.push(['first', key, state.energy, state.busy]);
    if (key === 'energy') state.set$busy(true);
  });
  runtime.subscribe((state, key) => events.push(['second', key, state.energy, state.busy]));
  runtime.set$energy(7);
  const setters = [];
  for (const name of Object.keys(runtime).filter(key => key.startsWith('set$'))) {
    const test = createRuntime(), field = name.slice(4), initial = test[field];
    const input = name === 'set$handInfuseCounts' ? { uid:2 }
      : Array.isArray(initial) ? ['uid'] : initial instanceof Set ? new Set(['uid'])
      : typeof initial === 'number' ? 9 : typeof initial === 'boolean' ? true
      : typeof initial === 'string' ? 'marker' : { marker:field };
    const observed = [];
    test.subscribe((state, key) => observed.push([key, state === test, normalized(state[field])]));
    test[name](input);
    setters.push({ name, value:normalized(test[field]), sameReference:test[field] === input, observed });
  }
  const aggregate = createRuntime(), writes = [];
  aggregate.subscribe((_state, key) => writes.push(key));
  // The shared state module deliberately allocates monotonically increasing
  // identity tokens. Compare the increment, then use one explicit fixture ID.
  aggregate.set$battleState({ token:91, phase:'start', round:1 });
  aggregate.restoreBattleSession({ hp:10 }, { opts:{ isBoss:false }, turn:3, energy:2, mode:'normal' }, 5);
  aggregate.resetBattlePlayerState(5);
  aggregate.restoreBattleCombatants({ foes:[{ id:'foe', name:'foe', hp:9, maxHp:9 }] }, () => ({ kind:'wait' }));
  aggregate.restoreBattlePiles({ hand:['hand'], drawPile:['draw'], consumed:['used'] });
  aggregate.set$handInfuseCounts({ hand:2 });
  aggregate.recordHandInfusion(['hand', 'hand']);
  for (const kind of ['time', 'arrow', 'unyield', 'ash', 'infinite', 'holy', 'shield', 'swift', 'fireball', 'frozen', 'spacetime']) {
    aggregate.applyRuneFlag(kind);
  }
  aggregate.resetBattleEffectFlags();
  aggregate.clearBattlePresentation();
  const state = Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(aggregate))
    .filter(([, descriptor]) => descriptor.get).map(([key]) => [key, normalized(aggregate[key])]));
  return { frozen:Object.isFrozen(runtime), tokenIncrement, api:apiFacts(runtime), events, setters, writes, state };
}

async function engineFacts(code, file) {
  const mocks = {
    './battle.engine.factory.js':dataUrl('export const createBattleEngine = ports => ports.fixture;'),
    './battle.default-context.js':dataUrl('export const createDefaultBattleContext = ports => ({ audio:{}, ...ports });'),
  };
  const engine = await loadSource(code, file, mocks);
  const methods = Object.keys(engine).filter(name => name !== 'configureBattleEngine');
  const fixture = id => {
    const target = Object.fromEntries(methods.map(name => [name, function (...args) {
      return { id, name, args, receiver:this === target };
    }]));
    target.canReconfigure = () => true;
    target.resolveCard.steps = (...args) => ({ id, name:'steps', args });
    return target;
  };
  let initialFailure;
  try { engine.getSnapshot(); } catch (error) { initialFailure = error.message; }
  engine.configureBattleEngine({ fixture:fixture('first'), sound() {} });
  const first = methods.map(name => [name, engine[name]('uid')]);
  const stepsFirst = engine.resolveCard.steps('card');
  engine.configureBattleEngine({ fixture:fixture('second'), sound() {} });
  const second = methods.map(name => [name, engine[name]('uid')]);
  const stepsSecond = engine.resolveCard.steps('card');
  let invalidFailure;
  try { engine.configureBattleEngine({ fixture:{ canReconfigure:() => false }, sound() {} }); }
  catch (error) { invalidFailure = error.message; }
  return { api:apiFacts(engine), initialFailure, first, second, stepsFirst, stepsSecond,
    invalidFailure, afterInvalid:engine.getSnapshot() };
}

for (const row of manifest) {
  const old = fs.readFileSync(path.join(before, row.file), 'utf8');
  assert.equal(createHash('sha256').update(old).digest('hex'), row.sha256);
  const current = fs.readFileSync(row.file, 'utf8');
  const oldModule = row.file.includes('runtime.factory') ? await loadSource(old, row.file) : null;
  const newModule = oldModule ? await loadSource(current, row.file) : null;
  const previous = oldModule ? runtimeFacts(oldModule.createBattleRuntime) : await engineFacts(old, row.file);
  const next = newModule ? runtimeFacts(newModule.createBattleRuntime) : await engineFacts(current, row.file);
  assert.deepEqual(next, previous, row.file);
  console.log(JSON.stringify({ file:row.file, status:'equivalent', publicKeys:next.api.length,
    setterCases:next.setters?.length, beforeSha256:row.sha256,
    afterSha256:createHash('sha256').update(current).digest('hex') }));
}
