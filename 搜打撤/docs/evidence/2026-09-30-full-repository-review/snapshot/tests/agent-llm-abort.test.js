// @vitest-environment node
// 本文件必须跑 node 环境：被测代码把 AbortSignal 传给 fetch 做真取消，而 vitest
// jsdom 环境里 fetch 来自 Node(undici)、AbortController 来自 jsdom，跨 realm 品牌
// 校验直接 TypeError（undici: "Expected signal to be an instance of AbortSignal"）。
// 浏览器与 Node 无头批跑均为同 realm，生产行为不受影响。
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { decide } = await import('../game/src/agent/agent.llm.js');

const obs = { phase: 'title', turn: 0, actions: [], ui: { actions: [] }, run: null, battle: null };
const LLM_CONFIG = { baseUrl: 'https://llm.test/v1', apiKey: 'k', model: 'm' };

beforeEach(() => {
  // node 环境没有 localStorage：供给 decide 配置读写的最小桩
  const store = new Map([['sdt-agent-llm', JSON.stringify(LLM_CONFIG)]]);
  vi.stubGlobal('localStorage', {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, v),
    removeItem: (k) => store.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('agent.llm decide 取消链', () => {
  it('正常路径：fetch 收到信号、返回动作 JSON', async () => {
    const fetchMock = vi.fn(async () => new Response(
      JSON.stringify({ choices: [{ message: { content: '{"type":"sys","name":"noop"}' } }] }),
      { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const action = await decide({ timeoutMs: 200 })(obs);
    expect(action).toEqual({ type: 'sys', name: 'noop', args: [] });
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(init.signal.aborted).toBe(false);
  });

  it('外部 signal 已 abort：不再发起 fetch，直接退化', async () => {
    const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    controller.abort();
    await decide({ timeoutMs: 200 })(obs, { signal: controller.signal });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('stopRun 外部 signal 中途 abort：在途 fetch 收到中止，decide 退化不挂死', async () => {
    let fetchSignal = null;
    const fetchMock = vi.fn(async (_url, init) => new Promise((_, reject) => {
      fetchSignal = init.signal;
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();
    const pending = decide({ timeoutMs: 5000 })(obs, { signal: controller.signal });
    await vi.waitFor(() => expect(fetchSignal).toBeTruthy());
    controller.abort();
    const action = await pending;   // 关键：不再等服务端，立刻落回贪心
    expect(fetchSignal.aborted).toBe(true);
    // 必须以协议动作 resolve（退化贪心），不能 reject 也不返回 undefined
    expect(action && typeof action).toBe('object');
    expect(['ui', 'move', 'battle', 'sys']).toContain(action.type);
  });

  it('墙钟超时：fetch 永不返回时按时退化，fetch 信号被中止', async () => {
    let fetchSignal = null;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => new Promise((_, reject) => {
      fetchSignal = init.signal;
      init.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    })));
    const t0 = Date.now();
    const action = await decide({ timeoutMs: 25 })(obs);
    expect(Date.now() - t0).toBeLessThan(2000);
    expect(fetchSignal.aborted).toBe(true);
    expect(action && typeof action).toBe('object');
    expect(['ui', 'move', 'battle', 'sys']).toContain(action.type);
  });
});
