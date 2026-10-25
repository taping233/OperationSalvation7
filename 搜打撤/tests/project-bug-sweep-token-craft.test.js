import { describe, expect, it, vi } from 'vitest';
import { craftInventoryToken } from '../game/src/hub/bag-inventory-commands.js';

const gold = { id: 'tt-token-gold', name: '员工通行证B', type: '道具' };
const color = { id: 'tt-token-color', name: '员工通行证A', type: '道具' };
const final = { id: 'cmtmvq6ss84l', name: '觉醒通行证', type: '道具' };
const other = { id: 'unrelated', name: '无关卡', type: '装备' };
const craft = (state, kind, extra = {}) => craftInventoryToken(state, { kind }, {
  cards: () => [color, final], newUid: () => 'new', ...extra,
});

describe('通行证合成按计划条目消耗', () => {
  it.each([undefined, 'duplicate'])('UID=%s 时只扣三张B，安全格/容器/额外B均保留', uid => {
    const entry = (card, flags = {}) => ({ ...(uid ? { uid } : {}), card, ...flags });
    const survivors = [entry(other, { safe: 1 }), entry(other, { stored: 1 }), entry(other, { stored: 1, pouchOf: 'tt7-stratagem' }), entry(gold)];
    const state = { ownedCards: [...Array.from({ length: 3 }, () => entry(gold)), ...survivors], fragments: 3 };
    expect(craft(state, 'gold').ok).toBe(true);
    expect(state.ownedCards).toEqual([...survivors, { uid: 'new', card: color }]);
    expect(state.fragments).toBe(3);
  });
  it('碎片合成只消耗第一张同UID的A，保留另一张A与无关卡', () => {
    const original = { uid: 'duplicate', card: color }, kept = { uid: 'duplicate', card: color, safe: 1 };
    const unrelated = { uid: 'duplicate', card: other, stored: 1 };
    const state = { ownedCards: [unrelated, original, kept], fragments: 2 };
    expect(craft(state, 'fragments').ok).toBe(true);
    expect(state.ownedCards).toEqual([unrelated, kept, { uid: 'new', card: final }]);
    expect(state.fragments).toBe(0);
  });
  it('正常UID仍扣三张，不足三张不变且不分配产物UID', () => {
    const sources = Array.from({ length: 3 }, (_, i) => ({ uid: `b${i}`, card: gold }));
    const state = { ownedCards: sources.slice(0, 2) }, before = structuredClone(state), newUid = vi.fn(() => 'new');
    expect(craft(state, 'gold', { newUid })).toMatchObject({ ok: false, code: 'recipe' });
    expect(state).toEqual(before); expect(newUid).not.toHaveBeenCalled();
    state.ownedCards = sources;
    expect(craft(state, 'gold', { newUid }).ok).toBe(true);
    expect(state.ownedCards).toEqual([{ uid: 'new', card: color }]);
  });
});

describe('合成产物遵守去除原料后的普通背包容量', () => {
  it.each(['gold', 'fragments'])('满包且%s原料在安全格时拒绝，源牌/碎片均不动', kind => {
    const sources = Array.from({ length: kind === 'gold' ? 3 : 1 }, (_, i) => ({ uid: `s${i}`, card: kind === 'gold' ? gold : color, safe: 1 }));
    const state = { ownedCards: [{ uid: 'equipment', card: other }, ...sources], inventory: [], fragments: 2 };
    const before = structuredClone(state), newUid = vi.fn(() => 'new');
    expect(craft(state, kind, { newUid, baseCap: () => 1 })).toMatchObject({ ok: false, code: 'bag-full' });
    expect(state).toEqual(before); expect(newUid).not.toHaveBeenCalled();
  });
  it('原料释放普通背包格后允许产物占用，不能用合成前已满误拒', () => {
    const state = { ownedCards: Array.from({ length: 3 }, (_, i) => ({ uid: `b${i}`, card: gold })), inventory: [] };
    expect(craft(state, 'gold', { baseCap: () => 1 }).ok).toBe(true);
    expect(state.ownedCards).toEqual([{ uid: 'new', card: color }]);
  });
  it('满包时产物可并入已有未满的同名叠，资源专用扩展格不可收普通产物', () => {
    const sources = Array.from({ length: 3 }, (_, i) => ({ uid: `b${i}`, card: gold, safe: 1 }));
    const state = { ownedCards: [{ uid: 'a', card: color }, ...sources], inventory: [] };
    expect(craft(state, 'gold', { baseCap: () => 1 }).ok).toBe(true);
    expect(state.ownedCards).toHaveLength(2);
    const expanded = { ownedCards: [{ uid: 'box', card: { id: 'tt2-pearlbox', name: '珍珠盒', type: '道具' } }, ...sources], inventory: [] };
    const before = structuredClone(expanded);
    expect(craft(expanded, 'gold', { baseCap: () => 1 })).toMatchObject({ ok: false, code: 'bag-full' });
    expect(expanded).toEqual(before);
  });
});
