import { expect, it, vi } from 'vitest';
import { createFrameAssets } from '../game/src/battle/view/battle.frame-assets.js';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const owner = () => ({ cancelled: false, controller: new AbortController() });
const cancel = record => { record.cancelled = true; record.controller.abort(); };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

it('settles a cancelled load before its resource finishes and unloads the late texture', async () => {
  const pool = createFrameAssets(), gate = deferred(), record = owner();
  const Assets = { load: vi.fn(() => gate.promise), unload: vi.fn() };
  const pending = pool.load('tail', record, Assets);
  cancel(record); await pool.release(record);
  expect(await pending).toBe(null);
  expect(record.frameAssets.size).toBe(0);
  expect(Assets.unload).not.toHaveBeenCalled();
  gate.resolve({}); await flush();
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('tail');
});

it('keeps a shared pending URL alive for its next owner after the old waiter cancels', async () => {
  const pool = createFrameAssets(), gate = deferred(), old = owner(), next = owner();
  const Assets = { load: vi.fn(() => gate.promise), unload: vi.fn() };
  const first = pool.load('shared', old, Assets), second = pool.load('shared', next, Assets);
  cancel(old); await pool.release(old);
  expect(await first).toBe(null);
  const texture = {}; gate.resolve(texture);
  expect(await second).toBe(texture);
  expect(Assets.load).toHaveBeenCalledExactlyOnceWith('shared');
  expect(Assets.unload).not.toHaveBeenCalled();
  cancel(next); await pool.release(next); await pool.release(next);
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('shared');
});

it('cancels reentry while an earlier texture unload is still pending', async () => {
  const pool = createFrameAssets(), gate = deferred(), old = owner(), next = owner();
  const Assets = { load: vi.fn(() => ({})), unload: vi.fn(() => gate.promise) };
  await pool.load('same', old, Assets); cancel(old);
  const releasing = pool.release(old), pending = pool.load('same', next, Assets);
  cancel(next); await pool.release(next);
  expect(await pending).toBe(null);
  expect(next.frameAssets).toBeUndefined();
  expect(Assets.load).toHaveBeenCalledTimes(1);
  gate.resolve(); await releasing;
  const replacement = owner();
  await pool.load('same', replacement, Assets);
  expect(Assets.load).toHaveBeenCalledTimes(2);
  cancel(replacement); await pool.release(replacement);
});

it.each(['success', 'failure', 'abort'])('removes the abort listener on %s', async result => {
  const pool = createFrameAssets(), gate = deferred(), record = owner();
  const add = vi.spyOn(record.controller.signal, 'addEventListener');
  const remove = vi.spyOn(record.controller.signal, 'removeEventListener');
  const Assets = { load: vi.fn(() => gate.promise), unload: vi.fn() };
  const pending = pool.load('url', record, Assets);
  const assertion = result === 'failure' ? expect(pending).rejects.toThrow('missing') : expect(pending).resolves.toBe(result === 'abort' ? null : 'texture');
  if (result === 'failure') gate.reject(new Error('missing'));
  else if (result === 'abort') cancel(record);
  else gate.resolve('texture');
  await assertion;
  expect(add).toHaveBeenCalledExactlyOnceWith('abort', expect.any(Function), { once: true });
  expect(remove).toHaveBeenCalledExactlyOnceWith('abort', add.mock.calls[0][1]);
  cancel(record); await pool.release(record);
  if (result === 'abort') { gate.reject(new Error('late missing')); await flush(); }
});

it.each([10, 100])('settles all %i superseded owners without restarting the pending shared load', async count => {
  const pool = createFrameAssets(), gate = deferred(), pending = [];
  const Assets = { load: vi.fn(() => gate.promise), unload: vi.fn() };
  for (let i = 0; i < count; i++) {
    const record = owner(); pending.push(pool.load('shared', record, Assets));
    cancel(record); await pool.release(record);
  }
  expect(await Promise.all(pending)).toEqual(Array(count).fill(null));
  expect(Assets.load).toHaveBeenCalledTimes(1);
  gate.resolve({}); await flush();
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('shared');
});

it('does not acquire a URL for a signal that was already aborted', async () => {
  const pool = createFrameAssets(), record = owner(); record.controller.abort();
  const Assets = { load: vi.fn(), unload: vi.fn() };
  expect(await pool.load('unused', record, Assets)).toBe(null);
  expect(Assets.load).not.toHaveBeenCalled(); expect(record.frameAssets).toBeUndefined();
});

it('retries a failed signalled load while preserving controller-free callers', async () => {
  const pool = createFrameAssets(), record = owner(), legacy = {};
  const Assets = { load: vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue('texture'), unload: vi.fn() };
  await expect(pool.load('url', record, Assets)).rejects.toThrow('missing');
  expect(await pool.load('url', record, Assets)).toBe('texture');
  expect(await pool.load('url', legacy, Assets)).toBe('texture');
  cancel(record); await pool.release(record);
  expect(Assets.unload).not.toHaveBeenCalled();
  await pool.release(legacy);
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('url');
});
