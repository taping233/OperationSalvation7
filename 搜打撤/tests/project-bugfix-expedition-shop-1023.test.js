import { afterEach, expect, it, vi } from 'vitest';
import { createShopController } from '../game/src/run/game.run.shop.js';
import { Random, SeededRandomService, setRandomService } from '../game/src/core/random.js';
import { restoreChestReward } from '../game/src/run/chest-reward-save.js';

afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });

function fixture(Cards, game, saveGame=()=>true) {
  const host = document.createElement('main'); document.body.append(host);
  const acts = {};
  const UI = { el:{ ovBody:host, overlay:host }, act:(name,handler) => { acts[name]=handler; },
    showOverlay:(_title,html) => { host.innerHTML=html; }, hideOverlay(){}, log(){}, refresh(){}, registerHelp(){}, helpBtn:()=>'' };
  const SDT = { Cards, Base:{slot:1}, Sound:{sfx(){}}, Icons:{rich:x=>x} };
  let uid=0;
  const controller = createShopController({ UI, SDT, game, saveGame, bagCap:()=>100,
    usedSlots:()=>game.ownedCards.length, cardHTML:()=>'', newUid:()=>`shop-proof-${uid++}`, setCardPageOpen(){} });
  return { controller, acts };
}

it('E4: ordinary seeds never put banned catalog cards in random shop slots', async () => {
  window.SDT = { Icons:{img:()=>'',TYPE_ART:{}} };
  const { Cards } = await import('../game/src/cards/cards.js');
  Cards.ensureStarters(); Cards.ensureSha(); Cards.ensureTabletop(); Cards.ensureDmgTypes(); Cards.ensureEffectFields();
  const lib = Cards.all().filter(card => card.rarity !== '衍生' && !card.unrandom && card.id !== 'tt-token-color');
  const banned = lib.filter(card => !Cards.isRandomObtainable(card));
  expect(banned.length).toBeGreaterThan(0);
  const before=Random.snapshot();
  try {
    const game={state:'idle',coins:10,ownedCards:[],canReceiveCard:()=>true};
    const h=fixture(Cards,game);
    for(let seed=0;seed<40;seed++) {
      setRandomService(new SeededRandomService(seed));
      h.controller.openShop(`pool-proof-${seed}`);
      for(const slot of [...game.shopStock.slice(0,6),game.shopStock.at(-1)]) {
        if(slot.card) expect(Cards.isRandomObtainable(slot.card)).toBe(true);
      }
    }
  } finally { const service=new SeededRandomService(before.seed); service.restore(before); setRandomService(service); }
});

it.each([true,false,'throw'])('E5: mystery Cat Gift saves exactly one deferred extra with saved=%s', async saved => {
  const cat={id:'tt2-apollo',name:'阿猫的礼物',type:'装备',rarity:'史诗'};
  const extra={id:'gift-extra',name:'礼物附赠',type:'法术',rarity:'古朴'};
  const snapshots=[];
  const game={seed:12,layerIdx:0,trackPos:3,state:'idle',coins:3,ownedCards:[],canReceiveCard:()=>game.ownedCards.length===0,
    shopStocks:{one:[{card:cat,mystery:true,price:3,sold:false}]}};
  const h=fixture({isSellable:()=>false,sellPrice:()=>0,all:()=>[cat,extra],isRandomObtainable:()=>true},game,
    ()=>{snapshots.push(JSON.parse(JSON.stringify(game)));if(saved==='throw')throw new Error('disk');return saved;});
  h.controller.openShop('one'); const buy=h.acts.buyCard; await buy({i:0}); await buy({i:0});
  expect(game.ownedCards.map(entry=>entry.card.id)).toEqual(['tt2-apollo']);
  expect(game.coins).toBe(0);expect(game.shopStock[0].sold).toBe(true);
  expect(snapshots).toHaveLength(1);
  expect(snapshots[0].nodeChestRewards['0,3'].current.cards.map(c=>c.id)).toEqual(['gift-extra']);
  expect(game.nodeChestRewards['0,3'].current.taken).toEqual([]);
  expect(restoreChestReward(game,game.nodeChestRewards['0,3'])).not.toBeNull();
});

it('E5: deferred extra appends to an existing reward without overwriting its claim state', async () => {
  const cat={id:'tt2-apollo',name:'阿猫的礼物',type:'装备',rarity:'史诗'};
  const extra={id:'extra',name:'附赠',type:'法术',rarity:'古朴'};
  const prior={kind:'small',cards:[{id:'prior',name:'原奖励'}],coins:0,coinsReceived:false,taken:[0],lost:[],source:'原奖励'};
  const game={seed:2,layerIdx:0,trackPos:1,state:'idle',coins:3,ownedCards:[],canReceiveCard:()=>true,
    nodeChestRewards:{'0,1':{version:1,seed:2,layerIdx:0,trackPos:1,queue:[{kind:'small',reward:prior}],index:1,context:{onCell:true},current:prior,screen:'cards'}},
    shopStocks:{one:[{card:cat,mystery:true,price:3,sold:false}]}};
  const h=fixture({isSellable:()=>false,sellPrice:()=>0,all:()=>[cat,extra],isRandomObtainable:()=>true},game);
  h.controller.openShop('one');await h.acts.buyCard({i:0});
  const restored=restoreChestReward(game,game.nodeChestRewards['0,1']);
  expect(restored.current.taken.has(0)).toBe(true);expect(restored.queue).toHaveLength(2);
  expect(restored.queue[1].reward.cards.map(card=>card.id)).toEqual(['extra']);
});

