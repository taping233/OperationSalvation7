import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { emit, on, reset } from '../game/src/core/event-bus.js';

beforeEach(() => reset());
afterEach(() => { reset(); vi.restoreAllMocks(); });

it('accepts a thenable without catch without misreporting a synchronous subscriber failure', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const completed = vi.fn();
  on('thenable', () => ({ then(resolve) { completed(); resolve(); } }));
  expect(emit('thenable')).toBe(1);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(completed).toHaveBeenCalledOnce();
  expect(error).not.toHaveBeenCalled();
});

it('reports rejected thenables through the asynchronous failure channel and keeps dispatching', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const rejected = new Error('async subscriber failure'), next = vi.fn();
  on('thenable', () => ({ then(_resolve, reject) { reject(rejected); } }));
  on('thenable', next);
  expect(emit('thenable')).toBe(2);
  await new Promise(resolve => setTimeout(resolve, 0));
  expect(next).toHaveBeenCalledOnce();
  expect(error).toHaveBeenCalledWith('[Bus] thenable 异步订阅者异常:', rejected);
});

it('reset during dispatch removes the remaining old callbacks and keeps new callbacks for the next event', () => {
  const old = vi.fn(), fresh = vi.fn();
  on('reset', () => { reset(); on('reset', fresh); });
  on('reset', old);
  expect(emit('reset')).toBe(1);
  expect(old).not.toHaveBeenCalled();
  expect(fresh).not.toHaveBeenCalled();
  expect(emit('reset')).toBe(1);
  expect(fresh).toHaveBeenCalledOnce();
});
