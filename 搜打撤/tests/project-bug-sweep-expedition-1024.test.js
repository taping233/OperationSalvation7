import { afterEach, expect, it, vi } from 'vitest';
import { createRunResourceController } from '../game/src/run/game.run.resources.js';
import { createShopController } from '../game/src/run/game.run.shop.js';
import { Random, SeededRandomService, setRandomService } from '../game/src/core/random.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function surface() {
  const host = document.createElement('main'); document.body.append(host);
  const acts = {};
  const UI = { el:{ ovBody:host, overlay:host }, act:(name, handler) => { acts[name] = handler; },
    showOverlay:(_title, html) => { host.innerHTML = html; }, hideOverlay:vi.fn(), log:vi.fn(),
    refresh:vi.fn(), registerHelp(){}, helpBtn:() => '' };
  return { host, UI, acts };
}

it.each([true, false])('resource opening checkpoint=%s cannot replace the system menu opened while saving', async saved => {
  const h = surface(), gate = deferred();
  h.host.innerHTML = '<section class="flow-transition">抵达物资点</section>';
  const card = { id:'wood', name:'木材', type:'资源', rarity:'古朴' };
  const game = { state:'modal', seed:3, layerIdx:0, trackPos:2, ownedCards:[], nodeRewards:{}, canReceiveCard:() => true };
  const controller = createRunResourceController({ game, UI:h.UI, dom:document, getCards:() => ({
    all:() => [card], DROP_WEIGHTS:{ 古朴:1 }, isRandomObtainable:() => true, cardHTML:() => '' }),
    rich:html => html, saveGame:() => gate.promise, captureRunContext:() => () => true,
    grantEventCard:() => true, consumeCurrentCell(){}, setBagReturnHook(){}, bagSlots:{} });
  const opening = controller.openResourcePick(() => {});
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  gate.resolve(saved); await opening;
  expect(h.host.firstElementChild).toBe(menu);
  expect(game.nodeRewards['0,2'].cardIds).toEqual(['wood']);
});

it.each([true, false])('shop close checkpoint=%s cannot close or repaint a replacement system menu', async saved => {
  const h = surface(), gate = deferred(); let save = () => false;
  const card = { id:'shop-card', name:'货物', type:'法术', rarity:'古朴' };
  const game = { state:'idle', seed:3, layerIdx:0, trackPos:2, coins:10, ownedCards:[],
    canReceiveCard:() => true, shopStocks:{ one:[{ card, price:2, sold:false }] } };
  const SDT = { Base:{ slot:1 }, Cards:{ isSellable:() => false, sellPrice:() => 0 },
    Icons:{ rich:html => html }, Sound:{ sfx(){} } };
  const onClose = vi.fn();
  const controller = createShopController({ UI:h.UI, SDT, game, saveGame:() => save(), bagCap:() => 20,
    usedSlots:() => game.ownedCards.length, cardHTML:() => '', newUid:() => 'purchased', setCardPageOpen(){} });
  controller.openShop('one', onClose);
  await h.acts.buyCard({ i:0 });
  save = () => gate.promise;
  const closing = h.acts.closeShop();
  h.UI.showOverlay('', '<section class="leave-run-panel">系统菜单</section>');
  const menu = h.host.firstElementChild;
  gate.resolve(saved); await closing;
  expect(h.host.firstElementChild).toBe(menu);
  expect(h.UI.hideOverlay).not.toHaveBeenCalled();
  expect(onClose).not.toHaveBeenCalled();
  expect(game.coins).toBe(8);
  expect(game.ownedCards).toHaveLength(1);
});

it('shop generated fixed healing supply never duplicates another shelf slot', async () => {
  window.SDT = { Icons:{ img:() => '', TYPE_ART:{} } };
  const { Cards } = await import('../game/src/cards/cards.js');
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const h = surface(), game = { state:'idle', coins:20, ownedCards:[], canReceiveCard:() => true };
  const SDT = { Cards, Base:{ slot:1 }, Icons:{ rich:html => html }, Sound:{ sfx(){} } };
  const controller = createShopController({ UI:h.UI, SDT, game, saveGame:() => true, bagCap:() => 20,
    usedSlots:() => 0, cardHTML:() => '', newUid:() => 'purchase', setCardPageOpen(){} });
  const before = Random.snapshot();
  try {
    for (let seed = 0; seed < 150; seed++) {
      setRandomService(new SeededRandomService(seed)); controller.openShop(`shelf-${seed}`);
      const cards = game.shopStock.filter(slot => slot.card).map(slot => slot.card.name);
      expect(new Set(cards).size, `seed ${seed}`).toBe(cards.length);
    }
  } finally { const service = new SeededRandomService(before.seed); service.restore(before); setRandomService(service); }
});
