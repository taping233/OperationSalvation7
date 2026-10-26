// @vitest-environment node
import { expect, it, vi } from 'vitest';
import { createFrameAssets } from '../game/src/battle/view/battle.frame-assets.js';
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
it('releases settled URLs without waiting for a pending URL, then unloads its late completion', async () => {
  const pool = createFrameAssets(), gate = deferred(), owner = {};
  const Assets = { load: vi.fn(url => url === 'pending' ? gate.promise : {}), unload: vi.fn() };
  await pool.load('ready', owner, Assets);
  const pending = pool.load('pending', owner, Assets);
  owner.cancelled = true;
  await pool.release(owner);
  expect(Assets.unload.mock.calls).toEqual([['ready']]);
  gate.resolve({}); await pending; await flush();
  expect(Assets.unload.mock.calls).toEqual([['ready'], ['pending']]);
});
it('a new owner of an inflight URL protects its shared texture from old cleanup', async () => {
  const pool = createFrameAssets(), gate = deferred(), old = {}, next = {};
  const Assets = { load: vi.fn(() => gate.promise), unload: vi.fn() };
  const first = pool.load('same', old, Assets);
  old.cancelled = true; await pool.release(old);
  const second = pool.load('same', next, Assets);
  const texture = {}; gate.resolve(texture);
  expect(await first).toBe(texture); expect(await second).toBe(texture);
  expect(Assets.load).toHaveBeenCalledTimes(1); expect(Assets.unload).not.toHaveBeenCalled();
  next.cancelled = true; await pool.release(next);
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('same');
});
it('serializes only an unloading URL before reentry and respects cancellation while waiting', async () => {
  const pool = createFrameAssets(), gate = deferred(), old = {}, next = {}, cancelled = {};
  const Assets = { load: vi.fn(() => ({})), unload: vi.fn(() => gate.promise) };
  const first = await pool.load('same', old, Assets);
  old.cancelled = true; const released = pool.release(old);
  const replacement = pool.load('same', next, Assets);
  const aborted = pool.load('same', cancelled, Assets); cancelled.cancelled = true;
  await pool.load('other', next, Assets);
  expect(Assets.load.mock.calls).toEqual([['same'], ['other']]);
  gate.resolve(); await released;
  expect(await replacement).not.toBe(first); expect(await aborted).toBe(null);
  expect(Assets.load.mock.calls).toEqual([['same'], ['other'], ['same']]);
  next.cancelled = true; await pool.release(next);
});
it('failed loads are retryable and repeated release never unloads twice', async () => {
  const pool = createFrameAssets(), owner = {};
  const Assets = { load: vi.fn().mockRejectedValueOnce(new Error('missing')).mockResolvedValue({}), unload: vi.fn() };
  await expect(pool.load('url', owner, Assets)).rejects.toThrow('missing');
  await pool.load('url', owner, Assets);
  owner.cancelled = true; await pool.release(owner); await pool.release(owner);
  expect(Assets.unload).toHaveBeenCalledExactlyOnceWith('url');
});
