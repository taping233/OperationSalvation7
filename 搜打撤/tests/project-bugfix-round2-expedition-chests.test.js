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
async function open() { Chests.open(game, [{ kind: 'small' }], vi.fn(), { onCell: true }); }

it.each([['reward',true],['reward',false],['map',true],['map',false]])('chest return %s save=%s cannot reclaim a newer modal page',async(phase,saved)=>{
  await open();await Promise.resolve();
  let release;const gate=new Promise(resolve=>release=resolve);
  game.persistSave.mockReset().mockReturnValue(true);
  if(phase==='map')game.persistSave.mockReturnValueOnce(true);
  game.persistSave.mockImplementationOnce(()=>gate);
  const returning=actions.chestReturn();
  for(let i=0;i<15;i++)await Promise.resolve();
  UI.showOverlay('new','<main id="replacement">system menu</main>');game.state='modal';
  release(saved);expect(await returning).toBe(false);
  expect(document.getElementById('replacement')?.textContent).toBe('system menu');
  expect(UI.el.overlay.hidden).toBe(false);expect(game.state).toBe('modal');
});

it('old reward save failure cannot overwrite the replacement run state',async()=>{
  await open();await Promise.resolve();let release;game.persistSave.mockReturnValueOnce(new Promise(resolve=>release=resolve));
  const returning=actions.chestReturn();
  game.discoveredPairs=new Set();game.state='title';UI.showOverlay('new','<main id="new-run">new run</main>');
  release(false);expect(await returning).toBe(false);
  expect(game.state).toBe('title');expect(document.getElementById('new-run')?.textContent).toBe('new run');
});


