import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('../game/src/battle/view/battle.presentation-ready.js',()=>({
  createBattleEntryGate:()=>({begin(){},wait(){},cancel(){},dispose(){},pending:()=>false,ready:()=>true}),
  waitForBattleImages:()=>({promise:Promise.resolve(true),cancel(){}}),
}));
vi.mock('../game/src/battle/view/battle.frames.js',()=>({
  attach:()=>Promise.resolve(false),hide(){},cacheStats:()=>({}),play(){},setPaused(){},presentDeath(){},isLiveBattleFigure:()=>false,
}));
const rich=value=>String(value||'').replace(/\[\[icon:[^\]]+\]\]/g,'');
const UI={el:{},_lastMode:null,hideTooltip(){},showTooltip(){},refresh(){},log(){},act(){},
  showOverlay(title,html,mode){this.el.ovBody.innerHTML=rich(html);this.el.overlay.hidden=false;this._lastMode=mode;},
  hideOverlay(){this.el.overlay.hidden=true;document.dispatchEvent(new Event('sdt-overlay-close'));},
};
window.SDT={UI,Icons:{img:()=>'',rich,TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){}},
  Art:{has:()=>false,monsterArt:()=>'',classArt:()=>'',cutoutFigures(){},decodeIn(){},warm(){},collectCardAssets:()=>[]},
  Meta:{track(){}},Motion:{reduceMotion:()=>false},
  MAP:{rules:{battleEnergy:9,battleHandMax:99,bossDeckSize:15,starterSha:5,battleStartDraw:5,battleTurnDraw:1},items:{}},
};
await import('../game/src/cards/cards.js');
const {BattleSession,commands}=await import('../game/src/battle/core/battle.core.js');
const Runtime=await import('../game/src/battle/runtime/battle.runtime.js');
const {render}=await import('../game/src/battle/view/battle.view.js');
const {clearFeedback}=await import('../game/src/battle/view/battle.feedback.js');
const Cards=window.SDT.Cards;
Cards.ensureSha();Cards.ensureStarters();Cards.ensureTabletop();Cards.ensureDmgTypes();Cards.ensureEffectFields();
const catalog=Cards.all();
let game,frames=[];
const originalAnimate=Element.prototype.animate;
function flush(){const pending=frames;frames=[];pending.forEach(callback=>callback(performance.now()));}
async function settle(){for(let i=0;i<100;i++){flush();await new Promise(resolve=>setTimeout(resolve,0));if(!Runtime.busy&&!BattleSession.getSnapshot().actionQueueLength&&!frames.length)return;}throw new Error('Battle did not settle');}
const card=id=>game.ownedCards.find(entry=>entry.card.id===id);
const wrapper=id=>document.querySelector(`.bt-card[data-uid="${card(id).uid}"]`);
const face=id=>wrapper(id)?.querySelector('.hs-card');
async function start(ids){
  game={ownedCards:ids.map((id,i)=>({uid:`card-${i}`,card:structuredClone(catalog.find(card=>card.id===id))})),inventory:[],usedPocket:[],hp:60,maxHp:80,atk:4,spellPower:1,coins:0,myClass:'战士',state:'idle',battleActive:false,log(){},heal(n){this.hp=Math.min(this.maxHp,this.hp+n)},addItem(){},onBattleEnd(){}};
  window.SDT.game=game;
  BattleSession.start(game,[0,1].map(i=>({id:`foe-${i}`,name:'训练靶',hp:120,atk:3})),{isBoss:false});await settle();
}
beforeEach(()=>{
  frames=[];
  vi.spyOn(window,'requestAnimationFrame').mockImplementation(callback=>{frames.push(callback);return frames.length;});
  Element.prototype.animate=()=>({finished:Promise.resolve(),cancel(){},onfinish:null});
  document.body.innerHTML='<div id="overlay"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div>';
  UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody'),ovTitle:document.getElementById('ovTitle')};
  UI._lastMode=null;
});
afterEach(async()=>{clearFeedback();if(game?.battleActive)commands.flee();if(game)await settle();frames=[];Element.prototype.animate=originalAnimate;vi.restoreAllMocks();});

it('retains another card face and focus through real busy and ready renders',async()=>{
  await start(['tt3-blood-arrow','tt3-skewer','tt3-bandage']);
  const kept=face('tt3-skewer');kept.focus();
  const result=commands.submitCardPlay(card('tt3-blood-arrow').uid,0,true);
  expect(result.status).toBe('queued');
  expect(face('tt3-skewer')).toBe(kept);expect(document.activeElement).toBe(kept);
  expect(kept.getAttribute('aria-disabled')).toBe('true');
  expect(wrapper('tt3-skewer').querySelector('.bt-rulehint')?.textContent).toContain('当前动作正在结算');
  await settle();
  expect(face('tt3-skewer')).toBe(kept);expect(document.activeElement).toBe(kept);
  expect(kept.getAttribute('aria-disabled')).toBe('false');
  expect(wrapper('tt3-skewer').textContent).not.toContain('当前动作正在结算');
  expect(BattleSession.getSnapshot().hand).not.toContain(card('tt3-blood-arrow').uid);
});

it('updates energy availability hints without rebuilding the card face',async()=>{
  await start(['tt3-skewer','tt3-bandage']);
  const kept=face('tt3-skewer');
  Runtime.set$energy(0);render();
  expect(face('tt3-skewer')).toBe(kept);expect(kept.getAttribute('aria-disabled')).toBe('true');
  expect(wrapper('tt3-skewer').querySelectorAll('.bt-rulehint')).toHaveLength(1);
  expect(wrapper('tt3-skewer').querySelector('.bt-rulehint').textContent).toContain('能量不足');
  Runtime.set$energy(9);render();
  expect(face('tt3-skewer')).toBe(kept);expect(kept.getAttribute('aria-disabled')).toBe('false');
  expect(wrapper('tt3-skewer').textContent).not.toContain('能量不足');
  Runtime.set$energy(0);render();
  expect(face('tt3-skewer')).toBe(kept);expect(wrapper('tt3-skewer').querySelectorAll('.bt-rulehint')).toHaveLength(1);
});

it('rebuilds the face for changed damage or cost and keeps the latest block hint',async()=>{
  await start(['tt3-fireball','tt3-bandage']);
  const original=face('tt3-fireball');
  game.spellPower+=3;render();
  const stronger=face('tt3-fireball');expect(stronger).not.toBe(original);expect(stronger.outerHTML).not.toBe(original.outerHTML);
  const current=card('tt3-fireball');const originalCost=current.card.cost;
  Runtime.cardOverrides.set(current.uid,{...current.card,cost:originalCost+2,_baseCost:originalCost});Runtime.set$energy(0);render();await settle();
  expect(face('tt3-fireball')).not.toBe(stronger);
  expect(wrapper('tt3-fireball').querySelector('.bt-rulehint').textContent).toContain(`需要 ${originalCost+2}`);
  expect(face('tt3-fireball').getAttribute('aria-disabled')).toBe('true');
});

it('refreshes target restrictions and the original ready hint as enemies change',async()=>{
  await start(['tt7-provoke','tt3-bandage']);
  const kept=face('tt7-provoke');expect(kept.getAttribute('aria-disabled')).toBe('false');
  Runtime.foes[1].dead=true;render();
  expect(face('tt7-provoke')).toBe(kept);expect(kept.getAttribute('aria-disabled')).toBe('true');
  expect(wrapper('tt7-provoke').querySelector('.bt-rulehint').textContent).toContain('场上敌人不足两名');
  Runtime.foes[1].dead=false;render();
  expect(face('tt7-provoke')).toBe(kept);expect(kept.getAttribute('aria-disabled')).toBe('false');
  expect(wrapper('tt7-provoke').textContent).not.toContain('场上敌人不足两名');
});

it('updates per-played-move hints without replacing the base description or face',async()=>{
  await start(['cc-rapid-fire','tt3-bandage']);
  const kept=face('cc-rapid-fire');const desc=kept.querySelector('.hsc-desc');
  Runtime.set$playedMovesThisTurn(3);render();
  expect(face('cc-rapid-fire')).toBe(kept);expect(kept.querySelector('.hsc-desc')).toBe(desc);
  expect(desc.querySelector('.bt-rulehint').textContent).toContain('当前 3 段');
  Runtime.set$energy(0);render();expect(desc.querySelector('.bt-rulehint').textContent).toContain('能量不足');
  Runtime.set$energy(9);render();expect(desc.querySelectorAll('.bt-rulehint')).toHaveLength(1);
  expect(desc.querySelector('.bt-rulehint').textContent).toContain('当前 3 段');
});

it('refreshes rule-only reading hints while retaining the unchanged face',async()=>{
  await start(['cc-cursed-blade','tt3-toxin','tt3-bandage']);
  const kept=face('cc-cursed-blade');
  expect(wrapper('cc-cursed-blade').querySelector('.bt-rulehint').textContent).toContain('中毒');
  Runtime.set$hand(Runtime.hand.filter(uid=>uid!==card('tt3-toxin').uid));render();
  expect(face('cc-cursed-blade')).toBe(kept);
  expect(wrapper('cc-cursed-blade').querySelector('.bt-rulehint').textContent).toContain('当前手牌无可附加诅咒');
  expect(wrapper('cc-cursed-blade').querySelectorAll('.bt-rulehint')).toHaveLength(1);
});

it('rebuilds stack counts and discards cached hint state on a new battle',async()=>{
  await start(['tt3-skewer','tt3-skewer','tt3-bandage']);
  const original=face('tt3-skewer');expect(wrapper('tt3-skewer').querySelector('.bt-count').textContent).toBe('×2');
  Runtime.set$hand(Runtime.hand.filter(uid=>uid!==game.ownedCards[1].uid));render();
  expect(face('tt3-skewer')).not.toBe(original);expect(wrapper('tt3-skewer').querySelector('.bt-count')).toBeNull();
  Runtime.set$energy(0);render();expect(wrapper('tt3-skewer').textContent).toContain('能量不足');
  commands.flee();await settle();await start(['tt3-skewer','tt3-bandage']);
  expect(face('tt3-skewer')).not.toBe(original);expect(wrapper('tt3-skewer').textContent).not.toContain('能量不足');
});

it.each(['settlement', 'deck overlay'])('does not revive a press begun during %s after the unchanged hand becomes ready',async(mode)=>{
  await start(['tt3-skewer','tt3-bandage']);
  Runtime.set$busy(true);render();
  const kept=wrapper('tt3-skewer');
  const pointer=(type)=>{
    const event=new MouseEvent(type,{bubbles:true,cancelable:true,button:0,detail:1});
    Object.defineProperties(event,{pointerId:{value:1},pointerType:{value:'mouse'},isPrimary:{value:true}});
    kept.dispatchEvent(event);
  };
  pointer('pointerdown');
  if(mode==='deck overlay'){
    Runtime.set$viewingDeck(true);render();
    expect(document.querySelector('.battle-secondary-layer')).not.toBeNull();
    Runtime.set$viewingDeck(false);
  }
  Runtime.set$busy(false);render();
  expect(wrapper('tt3-skewer')).toBe(kept);
  pointer('click');
  const Aim=await import('../game/src/battle/view/battle.aim.js');
  expect(Aim.clickSelectedUid).toBeNull();
  expect(BattleSession.getSnapshot().pendingTarget).toBeFalsy();
});
