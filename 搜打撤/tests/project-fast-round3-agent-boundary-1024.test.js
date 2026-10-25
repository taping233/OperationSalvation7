import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({ game: {} }));
vi.mock('../game/src/run/game.session.js', () => ({ game: fixture.game, getActiveSlot: () => 1, startNewGame: vi.fn() }));
vi.mock('../game/src/run/game.run.flow.js', () => ({ moveTo: vi.fn(), reenterCell: vi.fn() }));
vi.mock('../game/src/agent/agent.state.js', () => ({ markUiFailure() {} }));
import { act } from '../game/src/agent/agent.action-router.js';
import { collectUiActions } from '../game/src/agent/agent.surface.js';
import { bindDataActions } from '../game/src/agent/agent.data.js';
import { decideConfigured } from '../game/src/agent/agent.llm.runtime.js';

beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><button data-act="dataClear">清空记录</button></div></div>';
  window.SDT = { game: fixture.game, UI: { _acts: {}, log: vi.fn(), act(name, handler) { this._acts[name] = handler; } } };
  localStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

it('an old observed action cannot confirm the real data-clear handler after normalization', () => {
  localStorage.setItem('sdt-run-records', JSON.stringify([{ id: 'retained', outcome: 'clear' }]));
  const render = vi.fn(); bindDataActions(render);
  const old = collectUiActions().find(action => action.name === 'dataClear');
  expect(act(old)).toMatchObject({ ok: true });
  expect(document.querySelector('[data-act="dataClear"]').dataset.confirm).toBe('1');
  expect(act(old)).toMatchObject({ ok: false, code: 'UI_ACTION_UNAVAILABLE' });
  expect(JSON.parse(localStorage.getItem('sdt-run-records'))).toHaveLength(1);
  expect(render).not.toHaveBeenCalled();
  const fresh = collectUiActions().find(action => action.name === 'dataClear');
  expect(act(fresh)).toMatchObject({ ok: true });
  expect(localStorage.getItem('sdt-run-records')).toBeNull();
  expect(render).toHaveBeenCalledOnce();
});

it('LLM UI scalar params obey the same dataset equality as the actual action router', async () => {
  document.getElementById('ovBody').innerHTML = '<button data-act="buy" data-i="0" data-confirm="true">购买</button>';
  const buy = window.SDT.UI._acts.buy = vi.fn(() => true);
  const reply = { type: 'ui', name: 'buy', params: { i: 0, confirm: true } };
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }] }) }));
  vi.stubGlobal('fetch', fetch);
  const fallback = vi.fn(() => ({ type: 'sys', name: 'noop' }));
  const action = await decideConfigured({ actions: collectUiActions() }, { baseUrl: 'http://unused.invalid', apiKey: 'test', model: 'fixture' }, fallback, {}, null);
  expect(fetch).toHaveBeenCalledOnce();
  expect(fallback).not.toHaveBeenCalled();
  const button = document.querySelector('[data-act="buy"]');
  button.dataset.extra = 'changed-after-observation';
  expect(act(action)).toMatchObject({ ok: false, code: 'UI_ACTION_UNAVAILABLE' });
  expect(buy).not.toHaveBeenCalled();
  delete button.dataset.extra;
  expect(act(action)).toMatchObject({ ok: true });
  expect(buy).toHaveBeenCalledOnce();
  expect(buy.mock.calls[0][0]).toMatchObject({ i: '0', confirm: 'true' });
});

it.each([
  { offered: { type: 'ui', name: 'buy', params: { i: '0', confirm: 'true' } }, reply: { type: 'ui', name: 'buy', params: { i: 1, confirm: true } } },
  { offered: { type: 'ui', name: 'buy', params: { i: '0', confirm: 'true' } }, reply: { type: 'ui', name: 'buy', params: { i: 0 } } },
  { offered: { type: 'battle', name: 'playCard', args: ['card', 0] }, reply: { type: 'battle', name: 'playCard', args: ['card', '0'] } },
])('still rejects changed values, missing UI params and different battle argument types (%j)', async ({ offered, reply }) => {
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(reply) } }] }) }));
  vi.stubGlobal('fetch', fetch);
  const fallback = vi.fn(() => ({ type: 'sys', name: 'noop' }));
  expect(await decideConfigured({ actions: [offered] }, { baseUrl: 'http://unused.invalid', apiKey: 'test', model: 'fixture' }, fallback, {}, null))
    .toEqual({ type: 'sys', name: 'noop' });
  expect(fetch).toHaveBeenCalledTimes(3);
  expect(fallback).toHaveBeenCalledOnce();
});

it.each([
  ['ui', 'UI_NAME_INVALID'], ['battle', 'BATTLE_COMMAND_UNKNOWN'], ['sys', 'SYS_COMMAND_UNKNOWN'],
])('invalid JSON name in %s is rejected and retried without throwing', async (type, code) => {
  const invalid = { type, name: { toString: null, valueOf: null } };
  const valid = { type: 'sys', name: 'noop' };
  expect(act(invalid)).toMatchObject({ ok: false, code });
  let count = 0;
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: {
    content: JSON.stringify(count++ ? valid : invalid),
  } }] }) }));
  vi.stubGlobal('fetch', fetch);
  const fallback = vi.fn();
  expect(await decideConfigured({ actions: [valid] }, { baseUrl: 'http://unused.invalid', apiKey: 'test', model: 'fixture' }, fallback, {}, null))
    .toMatchObject(valid);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fallback).not.toHaveBeenCalled();
});

it('invalid JSON type is rejected and retried without coercion exceptions', async () => {
  const invalid = { type: { toString: null, valueOf: null } }, valid = { type: 'sys', name: 'noop' };
  expect(act(invalid)).toMatchObject({ ok: false, code: 'ACTION_TYPE_UNKNOWN' });
  let count = 0;
  const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ choices: [{ message: {
    content: JSON.stringify(count++ ? valid : invalid),
  } }] }) }));
  vi.stubGlobal('fetch', fetch);
  const fallback = vi.fn();
  expect(await decideConfigured({ actions: [valid] }, { baseUrl: 'http://unused.invalid', apiKey: 'test', model: 'fixture' }, fallback, {}, null))
    .toMatchObject(valid);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(fallback).not.toHaveBeenCalled();
});
