import { describe, expect, it, vi } from 'vitest';
import { createLegacyBagUse } from '../game/src/hub/bag-legacy-use.js';
import { discardInventoryCard, transferContainerStack } from '../game/src/hub/bag-inventory-commands.js';
import { deriveBagRenderState } from '../game/src/core/bag-render-derivation.js';
import { createSafeTransfer } from '../game/src/hub/game.bag.safe-transfer.js';
import { stackCapOf } from '../game/src/core/card-capacity.js';
import { openBagLegendaryDiscovery } from '../game/src/hub/game.bag.rules.js';
const restore = { id: 'restore', name: '复原药水', type: '道具' };
const spell = { id: 'spell', name: '法术牌', type: '法术' };
const pearl = { id: 'tt2-pearlbox', name: '珍珠盒', type: '道具' };
const entry = (uid, card, extra = {}) => ({ uid, card, ...extra });
function harness({ structured = false, base = 2, owned, pocket = [], context = () => true }) {
  const source = structured ? { ...restore, rules: { bag: { use: [{ op: 'restoreConsumed', amount: 2 }] } } } : restore;
  const game = { runActive: true, battleActive: false, state: 'modal', hp: 5, maxHp: 10,
    ownedCards: owned(source), inventory: [], usedPocket: pocket };
  const usedSlots = () => deriveBagRenderState(game, base).used, bagCap = () => deriveBagRenderState(game, base).cap;
  const UI = { log: vi.fn(), showLegendGet: vi.fn() }, saveGame = vi.fn(() => true);
  let nonce = 0;
  const showBackpack = vi.fn(), setBagReceipt = vi.fn();
  const use = createLegacyBagUse({ UI, game, readCards: () => ({ all: () => [], classPool: () => [], isRandomObtainable: () => true }),
    baseCap: () => base, items: {}, Random: { random: () => 0 }, newUid: () => `out-${++nonce}`,
    saveGame, showBackpack, usedSlots, bagCap, captureContext: () => context, setBagReceipt });
  return { game, use, saveGame, usedSlots, showBackpack, setBagReceipt, UI };
}
describe('复原批量接收遵守真实卡叠与资源扩展格', () => {
  it.each([false, true])('满格时仍可并入已有未满同名叠（structured=%s）', async structured => {
    const h = harness({ structured, owned: source => [entry('source', source), entry('source2', source), entry('spell', spell)],
      pocket: [{ card: spell, count: 2 }] });
    await h.use.useOwnedCard('source');
    expect(h.game.ownedCards.filter(e => e.card.id === 'spell')).toHaveLength(3);
    expect(h.game.usedPocket).toEqual([]); expect(h.usedSlots()).toBe(2);
  });
  it.each([false, true])('普通牌不能借用珍珠盒资源扩展格（structured=%s）', async structured => {
    const h = harness({ structured, base: 1, owned: source => [entry('source', source), entry('source2', source), entry('pearl', pearl, { safe: true })],
      pocket: [{ card: spell, count: 1 }] });
    await h.use.useOwnedCard('source');
    expect(h.game.ownedCards.map(e => e.uid)).toEqual(['source', 'source2', 'pearl']);
    expect(h.game.usedPocket).toHaveLength(1); expect(h.usedSlots()).toBe(1);
  });
});

it('按名字丢可见背包牌时不误删珍珠盒/锦囊内同名牌', () => {
  const state = { ownedCards: [entry('stored', spell, { stored: 1 }), entry('bag', spell)] };
  expect(discardInventoryCard(state, { name: spell.name, fromSafe: false }, { id: 'sha', name: '初始攻击' }).ok).toBe(true);
  expect(state.ownedCards.map(e => e.uid)).toEqual(['stored']);
});

it.each(['false', 'reject'])('结构化纯复原保存%s时退回原道具和消耗区数量', async failure => {
  const h = harness({ structured: true, base: 4, owned: source => [entry('source', source)], pocket: [{ card: spell, count: 2 }] });
  const before = structuredClone(h.game);
  h.saveGame.mockImplementation(() => failure === 'false' ? false : Promise.reject(new Error('disk failed')));
  await h.use.useOwnedCard('source');
  await Promise.resolve();
  expect(h.game.ownedCards).toEqual(before.ownedCards);
  expect(h.game.usedPocket).toEqual(before.usedPocket);
});

it.each(['log', 'receipt', 'view'])('复原已经保存成功后%s异常不能退回可重复使用的源牌', async display => {
  const h = harness({ structured: true, base: 4, owned: source => [entry('source', source)], pocket: [{ card: spell, count: 2 }] });
  const fail = () => { throw new Error('display failed'); };
  if (display === 'log') h.UI.log.mockImplementation(fail);
  if (display === 'receipt') h.setBagReceipt.mockImplementation(fail);
  if (display === 'view') h.showBackpack.mockImplementation(fail);
  await expect(h.use.useOwnedCard('source')).resolves.toBe(true);
  expect(h.game.ownedCards.map(item => item.uid)).toEqual(['out-1', 'out-2']);
  expect(h.game.usedPocket).toEqual([]); expect(h.saveGame).toHaveBeenCalledOnce();
});

it('结构化复原保存等待时拒绝重复消费，失败后可以原样重试', async () => {
  const h = harness({ structured: true, base: 4, owned: source => [entry('source', source)], pocket: [{ card: spell, count: 2 }] });
  let complete; h.saveGame.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = h.use.useOwnedCard('source');
  expect(h.use.useOwnedCard('source')).toBe(false); expect(h.saveGame).toHaveBeenCalledOnce();
  complete(false); expect(await pending).toBe(false);
  expect(await h.use.useOwnedCard('source')).toBe(true);
  expect(h.game.ownedCards).toHaveLength(2); expect(h.game.usedPocket).toEqual([]);
  expect(h.saveGame).toHaveBeenCalledTimes(2);
});

it.each(['arrays', 'context'])('结构化复原晚失败不影响新局（%s）', async change => {
  let sameRun = true;
  const h = harness({ structured: true, base: 4, owned: source => [entry('source', source)], pocket: [{ card: spell, count: 2 }], context: () => sameRun });
  let complete; h.saveGame.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
  const pending = h.use.useOwnedCard('source'), fresh = entry('fresh', spell);
  if (change === 'arrays') { h.game.ownedCards = [fresh]; h.game.usedPocket = []; }
  else { sameRun = false; h.game.ownedCards.splice(0, h.game.ownedCards.length, fresh); h.game.usedPocket.length = 0; }
  complete(false); expect(await pending).toBe(false);
  expect(h.game.ownedCards).toEqual([fresh]); expect(h.game.usedPocket).toEqual([]);
  expect(h.showBackpack).not.toHaveBeenCalled(); expect(h.UI.log).not.toHaveBeenCalled();
});

it.each([false, true])('直接安全格转移也立即提交检查点（toSafe=%s）', toSafe => {
  const game = { ownedCards: [entry('moving', spell, { safe: !toSafe })], inventory: [], runActive: true, battleActive: false, state: 'modal' };
  const state = () => deriveBagRenderState(game, 2), save = vi.fn();
  const transfer = createSafeTransfer({ game, UI: { log: vi.fn() }, shaName: '初始攻击',
    bagCap: () => state().cap, baseCap: () => 2, safeCap: () => 2, usedSlots: () => state().used,
    safeUsed: () => state().safeStacks.length, refresh: vi.fn(), save,
    sound: vi.fn(), receipt: vi.fn(), captureContext: () => () => true });
  expect(transfer.move(spell.name, toSafe)).toBe(true);
  expect(save).toHaveBeenCalledOnce();
});

it('直接安全格转移等待保存时重复同向操作不重存，晚失败不改动新局', async () => {
  const game = { ownedCards: [entry('moving', spell)], inventory: [], runActive: true, battleActive: false, state: 'modal' };
  let complete; const save = vi.fn(() => new Promise(resolve => { complete = resolve; })), refresh = vi.fn();
  const state = () => deriveBagRenderState(game, 2);
  const transfer = createSafeTransfer({ game, UI: { log: vi.fn() }, shaName: '初始攻击',
    bagCap: () => state().cap, baseCap: () => 2, safeCap: () => 2, usedSlots: () => state().used,
    safeUsed: () => state().safeStacks.length, refresh, save, sound: vi.fn(), receipt: vi.fn(), captureContext: () => () => true });
  expect(transfer.move(spell.name, true)).toBe(true); expect(transfer.move(spell.name, true)).toBe(false);
  expect(save).toHaveBeenCalledOnce(); expect(refresh).toHaveBeenCalledOnce();
  const fresh = entry('fresh', spell); game.ownedCards = [fresh];
  complete(false); await Promise.resolve();
  expect(game.ownedCards).toEqual([fresh]); expect(refresh).toHaveBeenCalledOnce();
});

it.each([undefined, 'duplicate'])('旧档 UID=%s 时容器只移动当前可见的一叠，不误选其他区域', uid => {
  const resource = { id: 'wood', name: '木材', type: '资源' };
  const visible = Array.from({ length: 4 }, () => entry(uid, resource));
  const safe = entry(uid, resource, { safe: true }), stored = entry(uid, resource, { stored: 1 });
  const game = { ownedCards: [entry('pearl', pearl), safe, stored, ...visible], inventory: [] };
  const state = () => deriveBagRenderState(game, 4);
  const result = transferContainerStack(game, { kind: 'pearl', take: false, name: resource.name },
    { stackCapOf, usedSlots: () => state().used, bagCap: () => state().cap, baseCap: () => 4 });
  expect(result).toMatchObject({ ok: true, count: 3 });
  expect(safe.stored).toBeUndefined(); expect(visible[3].stored).toBeUndefined();
  expect(visible.slice(0, 3).every(item => item.stored)).toBe(true);
});

it.each([undefined, 'duplicate'])('旧档 UID=%s 时安全格交换按所选格中的对象定位', async uid => {
  const incoming = entry(uid, spell), outgoing = entry(uid, { id: 'guard', name: '格挡', type: '武术' }, { safe: true });
  const game = { ownedCards: [incoming, outgoing], inventory: [], runActive: true, battleActive: false, state: 'modal' };
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"><section></section></div></div>';
  const acts = {}, UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') },
    log: vi.fn(), act: (name, fn) => { acts[name] = fn; }, showOverlay: (_title, html) => { UI.el.ovBody.innerHTML = html; } };
  const state = () => deriveBagRenderState(game, 1), save = vi.fn();
  const transfer = createSafeTransfer({ game, UI, shaName: '初始攻击',
    bagCap: () => state().cap, baseCap: () => 1, safeCap: () => 1, usedSlots: () => state().used,
    safeUsed: () => state().safeStacks.length, refresh: vi.fn(), save, sound: vi.fn(), receipt: vi.fn(),
    beforeSelection: vi.fn(), closeZoom: vi.fn(), cardHTML: card => card.name, captureContext: () => () => true });
  expect(transfer.move(spell.name, true)).toBe(false);
  expect(acts.safeSwapPick).toBeTypeOf('function'); acts.safeSwapPick({ i: '0' });
  expect(await acts.safeSwapConfirm()).toBe(true);
  expect(incoming.safe).toBe(true); expect(outgoing.safe).toBe(false); expect(save).toHaveBeenCalledOnce();
});

function discoveryHarness() {
  const source = entry('source', { id: 'tt4-shine-token', name: '通行证', type: '道具' });
  source.bagDiscover = { version: 1, cardIds: ['legend'] };
  const reward = { id: 'legend', name: '传说', rarity: '传说', type: '法术' };
  const game = { ownedCards: [source], battleActive: false, runActive: true };
  document.body.innerHTML = '<div id="overlay"><div id="ovBody"></div></div>';
  const acts = {};
  const UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody') },
    log: vi.fn(), act: (name, fn) => { acts[name] = fn; },
    showOverlay: (_title, html) => { UI.el.ovBody.innerHTML = html; } };
  let complete, sameRun = true;
  const saveGame = vi.fn(() => new Promise(resolve => { complete = resolve; }));
  const showBackpack = vi.fn();
  openBagLegendaryDiscovery(source.card, 0, { game, UI,
    SDT: { Base: { bagCap: () => 4 }, Cards: { all: () => [reward], isRandomObtainable: () => true, cardHTML: card => card.name } },
    Random: { random: () => 0 }, newUid: () => 'reward', saveGame, showBackpack, usedSlots: () => 1, bagCap: () => 4,
    captureContext: () => () => sameRun });
  return { game, source, acts, saveGame, showBackpack, finish: value => complete(value), expire: () => { sameRun = false; } };
}

it('发现保存等待期间奖励被移走，失败回滚不能删除后来获得的无关卡', async () => {
  const h = discoveryHarness();
  h.acts.bagDiscoverPick({ i: '0' }); const pending = h.acts.bagDiscoverConfirm();
  expect(await h.acts.bagDiscoverConfirm()).toBe(false);
  h.game.ownedCards.splice(0, 1);
  const later = entry('later', spell); h.game.ownedCards.push(later);
  h.finish(false); expect(await pending).toBe(false);
  expect(h.game.ownedCards).toEqual([h.source, later]);
  expect(h.saveGame).toHaveBeenCalledOnce();
});

it('发现保存等待期间换局，即使复用背包数组也不能回填旧局通行证', async () => {
  const h = discoveryHarness();
  h.acts.bagDiscoverPick({ i: '0' }); const pending = h.acts.bagDiscoverConfirm();
  h.expire(); const fresh = entry('fresh', spell); h.game.ownedCards.splice(0, 1, fresh);
  h.finish(false); expect(await pending).toBe(false);
  expect(h.game.ownedCards).toEqual([fresh]); expect(h.showBackpack).not.toHaveBeenCalled();
});
