// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parse } from 'acorn';

const runtimePath = '../game/src/agent/agent.scenes.runtime.js';
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((accept, fail) => { resolve = accept; reject = fail; });
  return { promise, resolve, reject };
};
const completedReport = { ok: true, pass: true, scene: 'battle', assertions: [] };
const facade = () => import('../game/src/agent/agent.scenes.js');

beforeEach(() => {
  vi.resetModules();
  vi.doUnmock(runtimePath);
});
afterEach(() => {
  vi.doUnmock(runtimePath);
  vi.restoreAllMocks();
});

describe('验收场景按需边界', () => {
  it('启动静态图保留轻量接口，不包含场景驱动实现', () => {
    const seen = new Set();
    const pending = [path.resolve('game/src/main.js')];
    while (pending.length) {
      const file = pending.pop();
      if (seen.has(file) || !file.endsWith('.js')) continue;
      seen.add(file);
      const ast = parse(readFileSync(file, 'utf8'), { sourceType: 'module', ecmaVersion: 'latest' });
      for (const node of ast.body) {
        if (!['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) continue;
        const target = node.source?.value;
        if (target?.startsWith('.')) pending.push(path.resolve(path.dirname(file), target));
      }
    }
    expect(seen.has(path.resolve('game/src/agent/agent.scenes.js'))).toBe(true);
    expect(seen.has(path.resolve('game/src/agent/agent.scenes.catalog.js'))).toBe(true);
    expect(seen.has(path.resolve('game/src/agent/agent.scenes.runtime.js'))).toBe(false);
  });

  it('清单、未启动状态和未知场景立即可用，均不会加载实现', async () => {
    const load = vi.fn(() => ({ executeScene: vi.fn() }));
    vi.doMock(runtimePath, load);
    const scenes = await facade();
    const list = scenes.listScenes();
    expect(list).toHaveLength(10);
    expect(list.find(scene => scene.id === 'fullrun').turboDefault).toBe(true);
    expect(scenes.sceneStatus('battle')).toEqual({ started: false, done: false, report: null });
    expect(scenes.startScene('toString')).toMatchObject({ ok: false, code: 'UNKNOWN_SCENE' });
    expect(await scenes.runScene('unknown')).toMatchObject({ ok: false, pass: false, code: 'UNKNOWN_SCENE' });
    expect(load).not.toHaveBeenCalled();
  });

  it('同步 start 在动态装载及执行期间都阻止重入，完成后保留可轮询报告', async () => {
    const loading = deferred();
    const execution = deferred();
    const executeScene = vi.fn(() => execution.promise);
    const load = vi.fn(async () => { await loading.promise; return { executeScene }; });
    vi.doMock(runtimePath, load);
    const scenes = await facade();
    const options = { turbo: true };
    const start = scenes.startScene('battle', options);
    expect(start).toMatchObject({ ok: true, started: true, name: 'battle' });
    expect(start).not.toBeInstanceOf(Promise);
    expect(scenes.sceneStatus('battle')).toEqual({ started: true, done: false, report: null });
    expect(scenes.startScene('shop')).toMatchObject({ ok: false, code: 'SCENE_BUSY' });
    await vi.waitFor(() => expect(load).toHaveBeenCalledOnce());
    expect(executeScene).not.toHaveBeenCalled();
    loading.resolve();
    await vi.waitFor(() => expect(executeScene).toHaveBeenCalledWith('battle', options));
    expect(scenes.startScene('shop')).toMatchObject({ ok: false, code: 'SCENE_BUSY' });
    execution.resolve(completedReport);
    await vi.waitFor(() => expect(scenes.sceneStatus('battle').done).toBe(true));
    expect(scenes.sceneStatus('battle').report).toBe(completedReport);
    expect(scenes.startScene('shop').ok).toBe(true);
    await vi.waitFor(() => expect(scenes.sceneStatus('shop').done).toBe(true));
    expect(load).toHaveBeenCalledOnce();
  });

  it('装载失败会给出终态报告并释放执行口，下一次入口可以重试', async () => {
    vi.doMock(runtimePath, () => { throw new Error('transient chunk failure'); });
    const scenes = await facade();
    expect(scenes.startScene('battle').ok).toBe(true);
    await vi.waitFor(() => expect(scenes.sceneStatus('battle').done).toBe(true));
    expect(scenes.sceneStatus('battle').report).toMatchObject({
      ok: false, pass: false, scene: 'battle', code: 'SCENE_LOAD_FAILED',
    });
    expect(scenes.sceneStatus('battle').report.message).toEqual(expect.any(String));
    expect(scenes.sceneStatus('battle').report.message.length).toBeLessThanOrEqual(200);
    const executeScene = vi.fn(async () => completedReport);
    vi.doMock(runtimePath, () => ({ executeScene }));
    expect(scenes.startScene('battle').ok).toBe(true);
    await vi.waitFor(() => expect(executeScene).toHaveBeenCalledOnce());
    await vi.waitFor(() => expect(scenes.sceneStatus('battle').report).toBe(completedReport));
  });

  it('run 仍返回 Promise 并等待报告，轮询期间其他入口收到忙碌结果', async () => {
    const execution = deferred();
    const executeScene = vi.fn(() => execution.promise);
    vi.doMock(runtimePath, () => ({ executeScene }));
    const scenes = await facade();
    const pending = scenes.runScene('battle');
    expect(pending).toBeInstanceOf(Promise);
    expect(await scenes.runScene('shop')).toMatchObject({ ok: false, pass: false, code: 'SCENE_BUSY' });
    execution.resolve(completedReport);
    expect(await pending).toBe(completedReport);
  });
});
