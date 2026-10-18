import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let Chests, game, UI, actions, drawn;
const cards = [1, 2].map(i => ({ id: `reward${i}`, name: `奖励${i}`, type: '法术', rarity: '古朴' }));
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  actions = {}; drawn = vi.fn(seen => seen.has(cards[0].id) ? cards[1] : cards[0]);
  UI = { el: { overlay: document.getElementById('overlay'), ovBody: document.getElementById('ovBody'), ovTitle: document.getElementById('ovTitle') },
    showOverlay(title, html) { this.el.ovBody.innerHTML = html; this.el.overlay.hidden = false; }, hideOverlay() { this.el.overlay.hidden = true; },
    act: (name, fn) => actions[name] = fn, refresh() {}, log() {},
  };
  game = { seed: 7, discoveredPairs: new Set(), layerIdx: 0, trackPos: 1, state: 'idle', ownedCards: [], myClass: '',
    usedSlots: () => game.ownedCards.length, bagCap: () => 16, canReceiveCard: () => true,
    grantCard: vi.fn(card => { game.ownedCards.push({ card }); return true; }), gainCoins: vi.fn(), persistSave: vi.fn(() => true),
  };
  window.SDT = { game, UI, Icons: { rich: html => html }, Sound: { sfx: vi.fn() },
    MAP: { chestKinds: { small: { name: '小箱', cards: 2, coins: [2, 2] } } },
    Cards: { RARITIES: ['古朴', '稀有', '史诗', '传说'], all: () => cards, randomDropCard: drawn, pickOfRarity: () => cards[0],
      classPool: () => [], rarityOf: card => card.rarity, sellPrice: () => 1, cardHTML: card => `<span>${card.name}</span>` },
    Base: { slot: 1, data: {}, save() {}, petEggDropChance: () => 0, recordPetEggChestResult() {}, bagCap: () => 16, isSha: () => false },
  };
  await import('../game/src/run/chests.js'); Chests = window.SDT.Chests;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete window.SDT; });
const coinText = () => UI.el.ovBody.querySelector('.cqo-coins').textContent;
const saved = () => Chests.serialize(game);
it('双箱懒生成：可先独立收币，后箱开箱一并收币且不重复', () => {
  Chests.open(game, [{ kind:'small' }, { kind:'small' }], vi.fn(), { onCell:true });
  const firstDraws = drawn.mock.calls.length;
  expect(saved().queue[1].reward).toBeUndefined();
  expect(coinText()).toContain('待领 2 · 已领 0');
  actions.chestOverviewCoins();
  expect(coinText()).toContain('待领 0 · 已领 2');
  expect(coinText()).not.toContain('已领取');
  expect(game.gainCoins.mock.calls).toEqual([[2]]);
  expect(saved().queue[1].reward).toBeUndefined();
  expect(drawn).toHaveBeenCalledTimes(firstDraws);
  actions.chestNext(); actions.chestReveal(); actions.chestTake();
  expect(saved().queue[0].reward.coinsReceived).toBe(true);
  expect(saved().queue[1].reward).toBeUndefined();
  expect(coinText()).toContain('待领 0 · 已领 2');
  actions.chestNext(); actions.chestReveal(); actions.chestTake();
  expect(saved().queue[0].reward.coinsReceived).toBe(true);
  expect(saved().queue[1].reward.coinsReceived).toBe(true);
  expect(coinText()).toContain('待领 0 · 已领 4');
  expect(game.gainCoins.mock.calls).toEqual([[2], [2]]);
  const claim = actions.chestOverviewCoins; claim(); claim();
  expect(coinText()).toContain('待领 0 · 已领 4');
  expect(UI.el.ovBody.querySelector('[data-act="chestOverviewCoins"]')).toBeNull();
  expect(saved().queue.every(slot => slot.reward.coinsReceived)).toBe(true);
  expect(game.gainCoins.mock.calls).toEqual([[2], [2]]);
});
it('恢复双箱已收币进度，不补抽或重发', () => {
  Chests.open(game, [{ kind:'small' }, { kind:'small' }], vi.fn(), { onCell:true });
  actions.chestOverviewCoins();
  actions.chestNext(); actions.chestReveal(); actions.chestTake();
  actions.chestNext(); actions.chestReveal(); actions.chestTake();
  const checkpoint = saved(), drawsBefore = drawn.mock.calls.length;
  expect(Chests.restore(game, checkpoint, vi.fn())).toBe(true);
  expect(coinText()).toContain('待领 0 · 已领 4');
  expect(drawn).toHaveBeenCalledTimes(drawsBefore);
  expect(game.gainCoins.mock.calls).toEqual([[2], [2]]);
});

it('真实箱全部领取后总览使用结果数量，不保留可全部领取的静态规则', () => {
  Chests.open(game, [{kind:'small'}], vi.fn(), {onCell:true});
  expect(UI.el.ovBody.querySelector('.cqo-box-rule').textContent).toContain('可全部领取');
  actions.chestNext(); actions.chestReveal(); actions.chestTake();
  expect(UI.el.ovBody.querySelector('.cqo-box-rule').textContent).toBe('已领取 2 张');
  expect(UI.el.ovBody.querySelector('.cqo-box-status').textContent).toBe('已结束');
  expect(saved().queue[0].reward.taken).toHaveLength(2);
});

it('三箱只需逐箱打开与领卡再完成，金币随各箱一次收取，不预生成下一箱',()=>{
  const done=vi.fn();Chests.open(game,Array.from({length:3},()=>({kind:'small'})),done,{onCell:true});
  let clicks=0;
  for(let i=0;i<3;i++){
    expect(game.gainCoins).toHaveBeenCalledTimes(i);
    if(i<2)expect(saved().queue[i+1].reward).toBeUndefined();
    const oldOpen=actions.chestNext;oldOpen();clicks++;oldOpen();
    expect(game.gainCoins).toHaveBeenCalledTimes(i+1);
    actions.chestReveal(); // Animation skip is optional; not a required reward operation.
    actions.chestTake();clicks++;
  }
  expect(game.gainCoins.mock.calls).toEqual([[2],[2],[2]]);
  actions.chestFinish();clicks++;
  expect(done).toHaveBeenCalledOnce();expect(clicks).toBe(7);
});
