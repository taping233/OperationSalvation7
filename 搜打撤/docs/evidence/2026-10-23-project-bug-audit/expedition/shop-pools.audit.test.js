import { afterEach, expect, it, vi } from 'vitest';
import { createShopController } from '../../../../game/src/run/game.run.shop.js';
import { Random, SeededRandomService, setRandomService } from '../../../../game/src/core/random.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function fixture(Cards, game) {
  const host = document.createElement('main'); document.body.append(host);
  const acts = {};
  const UI = { el:{ ovBody:host, overlay:host }, act:(name,handler) => { acts[name]=handler; },
    showOverlay:(_title,html) => { host.innerHTML=html; }, hideOverlay(){}, log(){}, refresh(){}, registerHelp(){}, helpBtn:()=>'' };
  const SDT = { Cards, Base:{slot:1}, Sound:{sfx(){}}, Icons:{rich:x=>x} };
  let uid=0;
  const controller = createShopController({ UI, SDT, game, saveGame:()=>true, bagCap:()=>100,
    usedSlots:()=>game.ownedCards.length, cardHTML:()=>'', newUid:()=>`shop-proof-${uid++}`, setCardPageOpen(){} });
  return { controller, acts };
}

it('E4 proof: actual fresh catalog contains banned cards eligible for mystery stock', async () => {
  window.SDT = { Icons:{img:()=>'',TYPE_ART:{}} };
  const { Cards } = await import('../../../../game/src/cards/cards.js');
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const lib = Cards.all().filter(card => card.rarity !== '衍生' && !card.unrandom && card.id !== 'tt-token-color');
  const banned = lib.filter(card => !Cards.isRandomObtainable(card));
  console.log('E4 eligible-but-banned:', JSON.stringify(banned.map(({id,name,type,rarity,cls})=>({id,name,type,rarity,cls}))));
  expect(banned.length).toBeGreaterThan(0);
  const before=Random.snapshot();
  try {
    const game={state:'idle',coins:10,ownedCards:[],canReceiveCard:()=>true};
    const h=fixture(Cards,game); let found=null;
    for(let seed=0;seed<200;seed++) {
      setRandomService(new SeededRandomService(seed));
      h.controller.openShop(`pool-proof-${seed}`);
      const slot=game.shopStock.at(-1);
      if(slot.card && (slot.card.cls || ['能力卡','生物'].includes(slot.card.type))
        && !Cards.isRandomObtainable(slot.card)) { found={seed,id:slot.card.id,name:slot.card.name}; break; }
    }
    expect(found).not.toBeNull();
    console.log('E4 ordinary seeded reproduction:',JSON.stringify(found));
    await h.acts.buyCard({i:game.shopStock.length-1});
    expect(game.coins).toBe(7);
    expect(game.ownedCards.some(entry=>entry.card.id===found.id)).toBe(true);
  } finally { const service=new SeededRandomService(before.seed); service.restore(before); setRandomService(service); }
});

it('E5 proof: mystery purchase of Cat Gift bypasses acquire hook', async () => {
  const cat={id:'tt2-apollo',name:'阿猫的礼物',type:'装备',rarity:'史诗'};
  const grant=vi.fn();
  const game={state:'idle',coins:3,ownedCards:[],grantCard:grant,canReceiveCard:()=>true,
    shopStocks:{one:[{card:cat,mystery:true,price:3,sold:false}]}};
  const h=fixture({isSellable:()=>false,sellPrice:()=>0},game);
  h.controller.openShop('one'); await h.acts.buyCard({i:0});
  expect(game.ownedCards.map(entry=>entry.card.id)).toEqual(['tt2-apollo']);
  expect(grant).not.toHaveBeenCalled();
});
