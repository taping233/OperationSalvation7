import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { installImmediateWebLocks } from './helpers/web-locks.js';
const ctx = new Proxy({}, { get: () => () => ctx, set: () => true });
window.HTMLCanvasElement.prototype.getContext = () => ctx;
document.body.innerHTML = '<canvas id="game"></canvas><div id="title"></div><div id="exitScr"></div>';
window.SDT = { Icons: { img: () => '', TYPE_ART: {} }, Sound: { music() {}, sfx() {}, setDucked() {} }, FX: { feedback() {} } };
await import('../game/src/cards/cards.js'); await import('../game/src/ui/ui.js'); await import('../game/src/hub/base.js');
const session = await import('../game/src/run/game.session.js');
const { Random } = await import('../game/src/core/random.js');
const { RunStorage } = await import('../game/src/hub/game.storage.js');
const Base = window.SDT.Base;
beforeAll(() => {
  Object.assign(window.SDT.UI, { log() {}, refresh() {}, clearLog() {}, hideOverlay() {}, hideScreen() {}, showScreen() {}, showOverlay() {}, act() {}, registerHelp() {}, helpBtn() { return ''; } });
  window.SDT.Meta = { setXpMul() {}, track() {} }; window.SDT.Nest = { renderNestMap() {} };
});
let slot = 0;
beforeEach(() => { installImmediateWebLocks(); localStorage.clear(); slot++; Base.use(slot); session._set_active_slot(slot); });
afterEach(() => vi.restoreAllMocks());
describe('真实Base→newRun稳定身份与失败前置', () => {
  it.each(['card:second:foil', 'explicit-instance'])('选择%s只扣匹配堆，实际ownedCards得到该卡且Base只写一次', async key => {
    const first = { id: 'first', name: '同名牌', rarity: '稀有' }, second = { id: 'second', name: '同名牌', rarity: '稀有', variantKey: 'foil' };
    Base.data.stash = [{ card: first, count: 2 }, { card: second, count: 2, ...(key === 'explicit-instance' ? { stackKey: key } : {}) }];
    Base.data.pocket = [{ card: first, count: 1 }]; expect((await Base.save())).toBe(true);
    const original = Storage.prototype.setItem, writes = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) { return original.call(this, name, value); });
    expect(await session.newRun('standard', { [key]: 1 }, { skipClassChoice: true })).toBeUndefined();
    expect(Base.data.stash.map(stack => [stack.card.id, stack.count])).toEqual([['first', 2], ['second', 1]]); expect(Base.data.pocket).toEqual([]);
    expect(session.game.ownedCards.filter(owned => owned.card.id === 'second').map(owned => owned.card)).toEqual([second]);
    expect(session.game.ownedCards.some(owned => owned.card.id === 'first')).toBe(false);
    expect(writes.mock.calls.filter(([name]) => name === Base.SLOT_KEY(slot))).toHaveLength(1);
  });
  it('真实Base写盘失败，稳定key选择不扣仓、不建Run、不消费任何随机流', async () => {
    Base.data.stash = [{ card: { id: 'a', name: '卡', rarity: '稀有' }, count: 2 }, { card: { id: 'b', name: '卡', rarity: '稀有', variantKey: 'foil' }, count: 2 }];
    Base.data.pocket = [{ card: { id: 'p', name: '口袋' }, count: 1 }]; expect((await Base.save())).toBe(true);
    const before = structuredClone(Base.data), raw = localStorage.getItem(Base.SLOT_KEY(slot)), random = Random.snapshot();
    const owned = session.game.ownedCards, layers = session.game.layerData, seed = session.game.seed;
    const original = Storage.prototype.setItem; vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (name, value) { if (name === Base.SLOT_KEY(slot)) throw new Error('review write failure'); return original.call(this, name, value); });
    expect(await session.newRun('standard', { 'card:b:foil': 1 }, { skipClassChoice: true })).toBe(false);
    expect(Base.data).toEqual(before); expect(localStorage.getItem(Base.SLOT_KEY(slot))).toBe(raw); expect(Random.snapshot()).toEqual(random);
    expect(session.game.ownedCards).toBe(owned); expect(session.game.layerData).toBe(layers); expect(session.game.seed).toBe(seed); expect(localStorage.getItem(RunStorage.key(slot))).toBeNull();
  });
});
