import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../../../..');
const frozen = path.join(root, 'node_modules/.cache/project-lean10-round2-before');
const baseline = JSON.parse(readFileSync(path.join(directory, '../baseline.json'), 'utf8'));
const hashes = new Map(baseline.files.map(file => [file.file, file.sha256]));
const slices = ['session', 'piles', 'interaction', 'effects', 'presentation'];
const files = slices.map(name => `game/src/battle/runtime/battle.runtime.${name}.js`);
const helper = 'game/src/core/live-bindings.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const { createBattleRuntime } = await import(pathToFileURL(path.join(root,
  'game/src/battle/runtime/battle.runtime.factory.js')).href);

for (const file of [...files, helper]) {
  assert.equal(sha(readFileSync(path.join(frozen, file))), hashes.get(file), `Frozen source SHA: ${file}`);
}

function fixture() {
  const runtime = createBattleRuntime();
  runtime.set$battleState({ ...runtime.battleState, token: 91 });
  const fields = Object.keys(runtime).filter(key => Object.getOwnPropertyDescriptor(runtime, key).get);
  const fieldSet = new Set(fields), overrides = new Map(), listeners = new Set(), reads = [];
  const target = Object.create(null);
  for (const key of Object.keys(runtime)) {
    if (fieldSet.has(key)) Object.defineProperty(target, key, {
      get: () => overrides.has(key) ? overrides.get(key) : runtime[key],
    });
    else target[key] = runtime[key];
  }
  target.subscribe = listener => { listeners.add(listener); return () => listeners.delete(listener); };
  const state = new Proxy(target, { get(object, key, receiver) {
    reads.push(typeof key === 'symbol' ? String(key) : key);
    if (!Object.hasOwn(object, key)) throw new Error(`Unexpected read: ${String(key)}`);
    return Reflect.get(object, key, receiver);
  } });
  const notify = key => { for (const listener of listeners) listener(state, key); };
  runtime.subscribe((_state, key) => { overrides.delete(key); notify(key); });
  return { runtime, state, fields, fieldSet, reads, notify, subscribers: () => listeners.size,
    publish(key, value) { overrides.set(key, value); notify(key); } };
}

function normalize(value) {
  if (typeof value === 'function') return { function: value.name, length: value.length,
    prototype: Object.hasOwn(value, 'prototype') };
  if (value instanceof Map) return { map: [...value].map(normalize) };
  if (value instanceof Set) return { set: [...value].map(normalize) };
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  return value;
}

async function oracle(sourceRoot) {
  const f = fixture(), modules = [], trace = [];
  const globalKey = `__runtime_compat_oracle_${randomUUID()}`;
  globalThis[globalKey] = f;
  let reenter = false;
  const capture = () => Object.fromEntries(modules.flatMap(module => Object.keys(module)
    .filter(key => f.fieldSet.has(key)).map(key => [key, normalize(module[key])])));
  try {
    for (let index = 0; index < files.length; index++) {
      let source = readFileSync(path.join(sourceRoot, files[index]), 'utf8');
      const defaultImport = "import { defaultBattleRuntime as runtime } from './battle.runtime.default.js';";
      assert.ok(source.includes(defaultImport));
      source = source.replace(defaultImport, `const runtime = globalThis[${JSON.stringify(globalKey)}].state;`)
        .replace("from '../../core/live-bindings.js'", `from '${pathToFileURL(path.join(root, helper)).href}'`);
      source += `\n// ${globalKey} ${index}`;
      modules.push(await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`));
      // Probes are interleaved between compatibility modules, rather than all
      // appended after the barrel has finished importing.
      f.state.subscribe((_state, key) => {
        trace.push({ observer: index, key: String(key), values: capture() });
        if (reenter && index === 0 && key === 'G') f.runtime.set$hand(['nested-hand']);
      });
    }
  } finally { delete globalThis[globalKey]; }
  assert.equal(f.subscribers(), 10);
  const initialReads = [...f.reads], initialValues = capture();
  const exports = modules.map(module => Object.keys(module).map(key => ({ key,
    aliasIdentity: f.fieldSet.has(key) ? null : module[key] === f.runtime[key],
    shape: typeof module[key] === 'function' ? normalize(module[key]) : null,
    descriptor: { ...Object.getOwnPropertyDescriptor(module, key), value: undefined },
  })));
  assert.deepEqual(exports.map(entries => entries.length), [42, 29, 35, 66, 16]);
  for (const entries of exports) for (const entry of entries) assert.notEqual(entry.aliasIdentity, false);
  const fieldChecks = [];
  for (const field of f.fields) {
    const value = Object.freeze({ changedField: field });
    const owners = modules.filter(module => Object.hasOwn(module, field));
    assert.equal(owners.length, 1, field);
    for (let iteration = 0; iteration < 2; iteration++) {
      f.reads.length = 0;
      f.publish(field, value);
      assert.equal(owners[0][field], value, field);
      assert.deepEqual(f.reads, [field], field);
      fieldChecks.push({ field, iteration, reads: [...f.reads] });
    }
  }
  f.reads.length = 0;
  for (const key of ['missing', 'constructor', '__proto__', 'toString', 'hasOwnProperty', Symbol('G'), Symbol.toStringTag]) f.notify(key);
  assert.deepEqual(f.reads, []);
  for (const field of f.fields) f.publish(field, f.runtime[field]);
  f.reads.length = 0;
  trace.length = 0;
  reenter = true;
  f.runtime.set$G({ id: 'next-game' });
  const reentrantTrace = [...trace], reentrantReads = [...f.reads];
  assert.deepEqual(reentrantReads, ['G', 'hand']);
  const firstObserver = reentrantTrace.find(entry => entry.observer === 0 && entry.key === 'G');
  assert.deepEqual(firstObserver.values.hand, []);
  const nextObserver = reentrantTrace.find(entry => entry.observer === 1 && entry.key === 'G');
  assert.deepEqual(nextObserver.values.hand, ['nested-hand']);
  return { initialReads, initialValues, exports, fieldChecks, reentrantTrace, reentrantReads,
    finalValues: capture(), subscribers: f.subscribers() };
}

const before = await oracle(frozen), after = await oracle(root);
assert.deepEqual(after, before);
const summary = {
  status: 'passed', frozenSource: path.relative(root, frozen).replaceAll('\\', '/'),
  fields: before.fieldChecks.length / 2, fieldPublications: before.fieldChecks.length,
  methodAliases: 97, compatibilitySubscribers: 5, interleavedExternalSubscribers: 5,
  unknownKeyChecks: 7, exports: before.exports.reduce((count, entries) => count + entries.length, 0),
  reentrantTraceEntries: before.reentrantTrace.length, oracleSha256: sha(JSON.stringify(before)),
  files: [...files, helper].map(file => ({ file, beforeSha256: hashes.get(file),
    afterSha256: sha(readFileSync(path.join(root, file))) })),
};
writeFileSync(path.join(directory, 'differential-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
