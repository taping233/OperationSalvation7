import { overlayElements, chestMocks } from './helpers/environment-fixtures.js';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

let Chests, game, UI, actions, drawn;
const cards = [1, 2].map(i => ({ id: `reward${i}`, name: `奖励${i}`, type: '法术', rarity: '古朴' }));
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  document.body.innerHTML = '<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  actions = {}; drawn = vi.fn(seen => seen.has(cards[0].id) ? cards[1] : cards[0]);
  UI = { el: { ...overlayElements() },
    showOverlay(title, html) { this.el.ovBody.innerHTML = html; this.el.overlay.hidden = false; }, hideOverlay() { this.el.overlay.hidden = true; },
    act: (name, fn) => actions[name] = fn, refresh() {}, log() {},
  };
  game = { seed: 7, discoveredPairs: new Set(), layerIdx: 0, trackPos: 1, state: 'idle', ownedCards: [], myClass: '',
    usedSlots: () => game.ownedCards.length, bagCap: () => 16, canReceiveCard: () => true,
    grantCard: vi.fn(card => { game.ownedCards.push({ card }); return true; }), gainCoins: vi.fn(), persistSave: vi.fn(() => true),
  };
  window.SDT = { game, UI, ...chestMocks(cards, () => vi, () => drawn),
  };
  await import('../game/src/run/chests.js'); Chests = window.SDT.Chests;
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); delete window.SDT; });
const saved = () => Chests.serialize(game);
it('三箱直接衔接：只生成当前箱，收币一次；三次领取加一次完成',async()=>{
  const done=vi.fn();Chests.open(game,Array.from({length:3},()=>({kind:'small'})),done,{onCell:true});
  let clicks=0;
  for(let i=0;i<3;i++){
    expect(game.gainCoins).toHaveBeenCalledTimes(i+1);
    if(i<2)expect(saved().queue[i+1].reward).toBeUndefined();
    await Promise.resolve();
    const oldTake=actions.chestTake;await oldTake();clicks++;await oldTake();
    expect(game.grantCard).toHaveBeenCalledTimes((i+1)*2);
  }
  expect(game.gainCoins.mock.calls).toEqual([[2],[2],[2]]);
  expect(saved().queue.every(slot=>slot.reward.coinsReceived)).toBe(true);
  expect(UI.el.ovBody.querySelector('.cqo-overview')).toBeNull();
  expect(UI.el.ovBody.querySelectorAll('.reward-unit-state.is-received')).toHaveLength(2);
  await actions.chestContinue();clicks++;
  expect(done).toHaveBeenCalledOnce();expect(clicks).toBe(4);
});
it('恢复双箱已收币进度，不补抽或重发，公共回执只报实际结果',async()=>{
  Chests.open(game,[{kind:'small'},{kind:'small'}],vi.fn(),{onCell:true});
  await Promise.resolve();await actions.chestTake();await Promise.resolve();await actions.chestTake();
  const checkpoint=saved(),drawsBefore=drawn.mock.calls.length;
  expect(Chests.restore(game,checkpoint,vi.fn())).toBe(true);
  expect(drawn).toHaveBeenCalledTimes(drawsBefore);expect(game.gainCoins.mock.calls).toEqual([[2],[2]]);
  expect(saved().queue.every(slot=>slot.reward.coinsReceived)).toBe(true);
  expect(UI.el.ovBody.querySelectorAll('.reward-unit-state.is-received')).toHaveLength(2);
  expect(UI.el.ovBody.querySelector('[data-act="chestContinue"]')).not.toBeNull();
});
