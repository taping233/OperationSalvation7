// Seeds memory only. Production item, event, altar and withdrawal controllers own effects.
import '../src/main.js';
import {game,newUid,_set_active_slot,setLobby} from '../src/run/game.session.js';
import {openAltarRitual,openEmergencyModal,openFireRest} from '../src/run/game.run.altar.js';
import {runEventDeck} from '../src/run/game.run.flow.js';
import {bindNodeEvent} from '../src/run/node-reward-state.js';
import {showBackpack} from '../src/hub/game.bag.js';
import {playOutcomeFeedback} from '../src/ui/outcome-feedback.js';
const SDT=window.SDT,UI=SDT.UI;
_set_active_slot(null);
const tools=document.createElement('nav');
tools.style.cssText='position:fixed;left:8px;bottom:8px;z-index:100000;display:flex;flex-wrap:wrap;gap:6px;padding:8px;background:#14212bea;color:#eee;font:13px sans-serif;max-width:calc(100vw - 32px)';
tools.setAttribute('aria-label','统一演出隔离验收');
tools.innerHTML=['背包治疗','背包复原','战地整备','祭坛','紧急撤离','营火','仓库表现','定格','碎片激活'].map((label,index)=>`<button type="button" data-case="${index}">${label}</button>`).join('')+'<output>内存场景，无玩家档位</output>';
document.body.append(tools);
const card=id=>{const found=SDT.Cards.all().find(c=>c.id===id);if(!found)throw new Error(`缺少 ${id}`);return {...found};};
const owned=id=>({uid:newUid(),card:card(id)});
let observedOverlay=null;
function mountTools(){
  const overlay=UI.el.overlay;overlay.append(tools);tools.inert=false;tools.removeAttribute('aria-hidden');
  if(observedOverlay!==overlay){
    observedOverlay=overlay;
    new MutationObserver(()=>{
      if(overlay.hidden && overlay.contains(tools)){document.body.append(tools);tools.inert=false;tools.removeAttribute('aria-hidden');}
    }).observe(overlay,{attributes:true,attributeFilter:['hidden']});
  }
}
function reset(type='fire',layer=0){
  _set_active_slot(null);setLobby(false);UI.hideOverlay({immediate:true});document.getElementById('title').hidden=true;
  Object.assign(game,{state:'idle',runActive:true,battleActive:false,hp:18,maxHp:30,atk:4,coins:9,fragments:0,
    seed:1739,characterId:'heixiang',myClass:'战士',layerIdx:layer,trackPos:0,visited:{},nodeRewards:{},discoveredPairs:new Set(),
    layerData:Array.from({length:4},()=>({logical:[{def:{type}}]})),ownedCards:[],inventory:[],
    usedPocket:['tt3-ice-spike','tt3-holy-shield'].map(id=>({card:card(id),count:1})),
    altarActivated:false,altarRewardPending:false,altarItemSacrificed:false,extractionPending:false,pendingExtraction:null,
    cardOrder:[],eventLog:[],nestActive:false,nestRunes:[],nestEquipped:[]});
  UI.beginRoom();UI.refresh(game);
}
tools.addEventListener('click',async event=>{
  const button=event.target.closest('[data-case]');if(!button)return;
  const mode=Number(button.dataset.case);
  if(mode===7){for(const animation of document.querySelector('.outcome-feedback')?.getAnimations({subtree:true}) || []){animation.pause();animation.currentTime=510;}return;}
  if(document.querySelector('.outcome-feedback'))return;
  if(mode===0||mode===1){reset();game.ownedCards=[owned(mode===0?'starter-emergency-bandage':'tt-crystal')];showBackpack();}
  else if(mode===2){reset('event');bindNodeEvent(game,'cmtn7qttxqo4');await runEventDeck();}
  else if(mode===3){reset('altar',3);game.ownedCards=['tt3-ice-spike','tt3-holy-shield','tt-crystal','starter-emergency-bandage'].map(owned);openAltarRitual();}
  else if(mode===4){reset('emergencyExit',2);game.ownedCards=['tt3-ice-spike','tt3-holy-shield','tt-crystal','starter-emergency-bandage'].map(owned);openEmergencyModal();}
  else if(mode===5){reset();openFireRest();}
  else if(mode===6){
    if(!UI.el.ovBody.querySelector('.sc-fire')){reset();openFireRest();}
    else playOutcomeFeedback(UI.el.ovBody,{kind:'restore',destination:'仓库',cards:[card('tt3-ice-spike'),card('tt3-holy-shield')],cost:'钥匙 −2',source:'基地复原（仅组合呈现）',cardHTML:c=>SDT.Cards.cardHTML(c,'sm')});
  }
  else if(mode===8){reset('altar',3);game.fragments=2;openAltarRitual();}
  mountTools();
});
const report=()=>{tools.querySelector('output').textContent=`生命 ${game.hp}/${game.maxHp} · 随身 ${game.ownedCards?.length || 0} · 消耗 ${game.usedPocket?.reduce((n,c)=>n+c.count,0) || 0} · 碎片 ${game.fragments || 0} · 无玩家档位`;};
document.addEventListener('click',()=>requestAnimationFrame(report));
