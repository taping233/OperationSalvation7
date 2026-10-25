// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
import { decideConfigured } from '../game/src/agent/agent.llm.runtime.js';

afterEach(() => vi.unstubAllGlobals());
const config = { baseUrl: 'http://unused.invalid', apiKey: 'test', model: 'fixture', temperature: 0, maxTokens: 100 };
function replies(...actions) {
  let i = 0;
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: {
    content: JSON.stringify(actions[Math.min(i++, actions.length - 1)]),
  } }] }) }));
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

it.each([
  [{ type: 'ui', name: 'buy', params: { item: 'old' } }, { type: 'ui', name: 'buy', params: { item: 'new' } }],
  [{ type: 'battle', name: 'playCard', args: ['old', 0] }, { type: 'battle', name: 'playCard', args: ['new', 0] }],
  [{ type: 'move', li: 1, idx: 9 }, { type: 'move', li: 1, idx: 2 }],
  [{ type: 'sys', name: 'discardCard', args: ['old'] }, { type: 'sys', name: 'noop' }],
])('retries a well-shaped action absent from the current action list (%j)', async (unavailable, available) => {
  const fetch = replies(unavailable, available), fallback = vi.fn();
  const action = await decideConfigured({ actions: [available] }, config, fallback, {}, null);
  expect(action).toMatchObject(available);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fallback).not.toHaveBeenCalled();
  expect(JSON.parse(fetch.mock.calls[1][1].body).messages.at(-1).content).toContain('ACTION_UNAVAILABLE');
});

it('falls back after three unavailable replies instead of dispatching a stale purchase', async () => {
  const fetch = replies({ type: 'ui', name: 'buy', params: { item: 'sold' } });
  const fallback = vi.fn(() => ({ type: 'sys', name: 'noop' })), onFallback = vi.fn();
  expect(await decideConfigured({ actions: [{ type: 'ui', name: 'leave' }] }, config, fallback, { onFallback }, null))
    .toEqual({ type: 'sys', name: 'noop' });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fallback).toHaveBeenCalledOnce();
  expect(onFallback).toHaveBeenCalledWith(expect.stringContaining('ACTION_UNAVAILABLE'));
});

it('matches reordered params without treating observation labels as command fields', async () => {
  const available = { type: 'ui', name: 'buy', params: { item: 'card', count: '1' }, id: 'ui:buy', label: '购买' };
  replies({ type: 'ui', name: 'buy', params: { count: '1', item: 'card' } });
  expect(await decideConfigured({ actions: [available] }, config, vi.fn(), {}, null))
    .toEqual({ type: 'ui', name: 'buy', params: { item: 'card', count: '1' } });
});
