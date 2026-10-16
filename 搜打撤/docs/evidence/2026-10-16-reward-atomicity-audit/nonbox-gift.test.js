// Real grantEventCard and Chests controllers; narrow session/UI/capacity ports.
// Characterization of a still-unfixed, normal-capacity-boundary loss.
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { writeFileSync } from 'node:fs';
const H = vi.hoisted(() => ({ game:{}, saves:[], uid:0 }));
vi.mock('../../../game/src/run/game.session.js', () => ({
  game:H.game, MAP:{ rules:{} }, bagCap:()=>16, usedSlots:()=>H.game.ownedCards.length,
  newUid:()=>`gift-${++H.uid}`, pick:items=>items[0], scaledEnemy:item=>item,
  saveGame:()=>{ H.saves.push(JSON.parse(JSON.stringify(H.game))); return true; },
}));
vi.mock('../../../game/src/hub/game.cardslib.js', () => ({ _set_cardPageOpen(){}, cardHTML:card=>`<span>${card.name}</span>` }));
vi.mock('../../../game/src/hub/game.bag.bridge.js', () => ({ bagSlots:{ showBackpack(){} } }));
const apollo = { id:'tt2-apollo', name:'阿猫的礼物', rarity:'史诗', type:'装备', cost:0 };
const bonus = { id:'bonus', name:'附赠测试卡', rarity:'古朴', type:'法术', cost:0 };
let scenes, Chests, UI, choiceModule;
const acts = {}, logs = [];
beforeAll(async () => {
  UI = { el:{}, act:(name,fn)=>acts[name]=fn,
    showOverlay:(_title,html)=>{ UI.el.ovBody.innerHTML=html; UI.el.overlay.hidden=false; }, hideOverlay:()=>UI.el.overlay.hidden=true,
    refresh(){}, log:message=>logs.push(message), showCardReward(){}, _checkPageBg(){} };
  window.SDT = { game:H.game, UI, Icons:{ rich:html=>html }, Sound:{ sfx(){} }, Meta:{},
    Base:{ slot:1, bagCap:()=>16, isSha:()=>false, data:{} },
    MAP:{ chestKinds:{ small:{ name:'小宝箱' } } },
    Cards:{ all:()=>[apollo,bonus], isRandomObtainable:()=>true, cardHTML:card=>`<span>${card.name}</span>`, rarityOf:card=>card.rarity, sellPrice:()=>1 },
  };
  scenes = await import('../../../game/src/run/game.run.scenes.js');
  choiceModule = await import('../../../game/src/run/event-card-choice.js');
  await import('../../../game/src/run/chests.js'); Chests=window.SDT.Chests;
});
beforeEach(() => {
  vi.useFakeTimers(); document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el={ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody'), ovTitle:document.getElementById('ovTitle') };
  H.saves=[]; H.uid=0; logs.length=0;
  Object.assign(H.game, { seed:7, layerIdx:0, trackPos:1, discoveredPairs:new Set(), ownedCards:Array.from({length:15}, (_,i)=>({ uid:`filler-${i}`, card:{ id:`filler-${i}`, name:`已有不同卡${i}`, type:'法术', rarity:'古朴' } })), state:'modal', coins:0,
    canReceiveCard:()=>H.game.ownedCards.length<16, bagCap:()=>16, usedSlots:()=>H.game.ownedCards.length,
    grantCard:(card,opts)=>scenes.grantEventCard(card,opts), gainCoins:n=>H.game.coins+=n,
    persistSave:()=>{ H.saves.push(Chests.serialize(H.game)); return true; },
  });
});
afterEach(()=>{ vi.clearAllTimers(); vi.useRealTimers(); });

it('quartermaster main choice commits but an Apollo bonus rejected by capacity has no recovery record', () => {
  H.game.nodeRewards={}; H.game.visited={}; H.game.layerData=[{logical:[]}]; H.game.coins=15;
  const controller=choiceModule.createEventCardChoiceController({game:H.game,UI,SDT:window.SDT,
    saveGame:()=>{H.saves.push(JSON.parse(JSON.stringify(H.game)));return true;},getActiveSlot:()=>1,
    nodeShell:spec=>UI.showOverlay(spec.title,`<section>${spec.body}${spec.foot}</section>`),
    grantEventCard:scenes.grantEventCard,consumeCurrentCell:()=>{H.game.visited['0,1']=1;},captureContext:()=>()=>true,
    close:()=>{H.game.state='idle';H.saves.push(JSON.parse(JSON.stringify(H.game)));},
  });
  const input={capacity:16,usedSlots:15,coinsAfterAlreadyPaying3:15,candidateIds:[apollo.id,'other1','other2'],bonusPool:[bonus.id]};
  controller.open('ev19-quartermaster',[apollo,{...bonus,id:'other1',name:'备选一'},{...bonus,id:'other2',name:'备选二'}]);
  acts.eventCardPick({i:0});
  expect(H.game.ownedCards).toHaveLength(16);expect(H.game.ownedCards.some(owned=>owned.card.id===bonus.id)).toBe(false);
  expect(H.game.nodeRewards['0,1']).toMatchObject({taken:0,paidCoins:3});expect(H.game.visited['0,1']).toBe(1);
  expect(Chests.serialize(H.game)).toBeNull();expect(controller.resume()).toBe(false);
  const saved=H.saves.at(-1);H.game.nodeRewards=JSON.parse(JSON.stringify(saved.nodeRewards));
  expect(controller.resume()).toBe(false);
  writeFileSync('docs/evidence/2026-10-16-reward-atomicity-audit/quartermaster-gift-reproduction.json',JSON.stringify({at:new Date().toISOString(),input,finalSaved:saved,chestReward:Chests.serialize(H.game),canResume:controller.resume(),logs,browserUsed:false,playerStorageTouched:false},null,2)+'\n');
});
