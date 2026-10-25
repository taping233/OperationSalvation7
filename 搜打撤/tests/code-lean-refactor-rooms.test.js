// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createRoomActions } from '../game/src/ui/room-actions.js';

describe('rendered room action ownership', () => {
  it('retained callbacks obey their original room predicate after replacement or a busy transition', () => {
    const callbacks = {}, received = [];
    const UI = { act:(name, fn) => { callbacks[name] = fn; } };
    let page = 'first', busy = false;
    createRoomActions(UI, () => page === 'first' && !busy)('claim', data => received.push(data));
    const previous = callbacks.claim;
    previous('accepted'); busy = true; previous('busy'); busy = false; page = 'second';
    createRoomActions(UI, () => page === 'second')('claim', data => received.push(data));
    previous('stale'); callbacks.claim('current');
    expect(received).toEqual(['accepted','current']);
  });

  it('preserves the data identity and async completion; empty-data compatibility is explicit', async () => {
    const callbacks = {}, UI = { act:(name, fn) => { callbacks[name] = fn; } };
    const pending = Promise.resolve('saved'), input = {i:0};
    createRoomActions(UI, () => true)('receive', data => { expect(data).toBe(input); return pending; });
    expect(callbacks.receive(input)).toBe(pending);
    expect(await callbacks.receive(input)).toBe('saved');
    createRoomActions(UI, () => true)('plain', data => data);
    expect(callbacks.plain()).toBeUndefined();
    createRoomActions(UI, () => true, {emptyData:true})('shop', data => data);
    expect(callbacks.shop(null)).toEqual({});
    expect(callbacks.shop(input)).toBe(input);
  });
});
