// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createShopController } from '../game/src/run/game.run.shop.js';

const originalAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
afterEach(() => {
  vi.useRealTimers(); vi.restoreAllMocks(); document.body.replaceChildren();
  if (originalAnimate) Object.defineProperty(Element.prototype, 'animate', originalAnimate);
  else delete Element.prototype.animate;
});
function fixture({ mystery = false, width = 100 } = {}) {
  vi.useFakeTimers();
  const animations = [];
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width, height: 100 });
  Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: vi.fn(() => {
    const animation = { onfinish: null, cancel: vi.fn() }; animations.push(animation); return animation;
  }) });
  const host = document.createElement('main'); document.body.append(host);
  const acts = {}, card = { id: 'carry', name: '商品', type: '法术', rarity: '古朴' };
  const game = { state: 'idle', coins: 10, ownedCards: [], canReceiveCard: () => true,
    shopStocks: { one: [{ card, price: 3, mystery, sold: false }] } };
  const UI = { act: (key, fn) => { acts[key] = fn; }, showOverlay: (_, html) => { host.innerHTML = html; },
    hideOverlay: () => host.replaceChildren(), log: vi.fn(), refresh: vi.fn(), registerHelp: vi.fn(), helpBtn: () => '' };
  const SDT = { Base: { slot: 1 }, Cards: { isSellable: () => false, cardHTML: () => '<div class="hs-card">商品</div>' },
    Icons: { rich: text => text }, Sound: { sfx: vi.fn() } };
  const saveGame = vi.fn();
  createShopController({ UI, SDT, game, saveGame, bagCap: () => 20, cardHTML: SDT.Cards.cardHTML,
    newUid: () => 'carry-owned', usedSlots: () => 0, setCardPageOpen: vi.fn() }).openShop('one');
  return { acts, game, animations, saveGame };
}
const flyingNodes = () => [...document.body.children].filter(node => node.style.position === 'fixed');

it('removes a mystery reveal when the player leaves before its delayed flight', () => {
  const { acts, game, animations, saveGame } = fixture({ mystery: true });
  acts.buyCard({ i: 0 });
  expect(flyingNodes()).toHaveLength(1);
  acts.closeShop();
  animations[0].onfinish();
  vi.advanceTimersByTime(3000);
  expect(flyingNodes()).toHaveLength(0);
  expect(game.coins).toBe(7); expect(game.ownedCards).toHaveLength(1); expect(saveGame).toHaveBeenCalledOnce();
});

it('removes the mystery clone when animation finish never arrives', () => {
  const { acts, animations } = fixture({ mystery: true });
  acts.buyCard({ i: 0 }); vi.advanceTimersByTime(3000);
  expect(flyingNodes()).toHaveLength(0);
  animations[0].onfinish();
  expect(flyingNodes()).toHaveLength(0);
});

it('does not leak a normal flying clone for a zero-width source', () => {
  const { acts } = fixture({ width: 0 });
  acts.buyCard({ i: 0 }); vi.advanceTimersByTime(3000);
  expect(flyingNodes()).toHaveLength(0);
});

it('keeps a normal mystery reveal and carry while cleaning every temporary node', () => {
  const { acts, animations, game, saveGame } = fixture({ mystery: true });
  acts.buyCard({ i: 0 }); animations[0].onfinish();
  expect(flyingNodes()).toHaveLength(1);
  vi.advanceTimersByTime(720);
  animations[2].onfinish();
  vi.advanceTimersByTime(3000);
  expect(flyingNodes()).toHaveLength(0);
  expect(game.coins).toBe(7); expect(game.ownedCards).toHaveLength(1); expect(saveGame).toHaveBeenCalledOnce();
});

it('cleans the clone when animation creation throws without changing the purchase', () => {
  const { acts, game } = fixture();
  Element.prototype.animate.mockImplementation(() => { throw new Error('animation fixture'); });
  acts.buyCard({ i: 0 });
  expect(flyingNodes()).toHaveLength(0);
  expect(game.coins).toBe(7); expect(game.ownedCards).toHaveLength(1);
});
