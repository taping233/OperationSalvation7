// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const runtimePath = '../game/src/agent/agent.scenes.runtime.js';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
beforeEach(() => { vi.resetModules(); vi.doUnmock(runtimePath); });
afterEach(() => { vi.doUnmock(runtimePath); vi.restoreAllMocks(); });

it('an awaited scene keeps its own completed report when the same scene restarts before the polling tick', async () => {
  const first = deferred(), second = deferred();
  const firstReport = { ok:true, scene:'battle', pass:true, attempt:1 };
  const secondReport = { ok:true, scene:'battle', pass:false, attempt:2 };
  const executeScene = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  vi.doMock(runtimePath, () => ({ executeScene }));
  const scenes = await import('../game/src/agent/agent.scenes.js');
  const waiting = scenes.runScene('battle');
  await vi.waitFor(() => expect(executeScene).toHaveBeenCalledTimes(1));
  first.resolve(firstReport);
  await vi.waitFor(() => expect(scenes.sceneStatus('battle').done).toBe(true));
  expect(scenes.startScene('battle').ok).toBe(true);
  second.resolve(secondReport);
  await vi.waitFor(() => expect(scenes.sceneStatus('battle').report).toBe(secondReport));
  expect(await waiting).toBe(firstReport);
});

it('a failed awaited execution cannot inherit the success report from a later retry', async () => {
  const first = deferred();
  const failed = { ok:false, scene:'shop', pass:false, attempt:1 };
  const retried = { ok:true, scene:'shop', pass:true, attempt:2 };
  const executeScene = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(retried);
  vi.doMock(runtimePath, () => ({ executeScene }));
  const scenes = await import('../game/src/agent/agent.scenes.js');
  const waiting = scenes.runScene('shop');
  await vi.waitFor(() => expect(executeScene).toHaveBeenCalledTimes(1));
  first.resolve(failed);
  await vi.waitFor(() => expect(scenes.sceneStatus('shop').done).toBe(true));
  expect(scenes.startScene('shop').ok).toBe(true);
  await vi.waitFor(() => expect(scenes.sceneStatus('shop').report).toBe(retried));
  expect(await waiting).toBe(failed);
});
