
import SDT,{sdtDefine} from '/src/core/sdt-facade.js';
import '/src/core/icons-bitmap.js';
import '/src/core/art.js';
import '/src/ui/ui-scale.js';
sdtDefine('Sound',{sfx(){},music(){},setDucked(){},setBoss(){}});
sdtDefine('Meta',{track(){}});
sdtDefine('Motion',{reduceMotion:()=>false});
sdtDefine('MAP',{rules:{battleEnergy:9,battleHandMax:99,bossDeckSize:15,starterSha:0,battleStartDraw:1,battleTurnDraw:1},items:{}});
const {UI}=await import('/src/ui/ui.js');
UI.el={overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#ovBody'),ovTitle:document.querySelector('#ovTitle')};
UI.refresh=()=>{}; UI.log=()=>{};
UI.el.ovBody.addEventListener('click',event=>{const button=event.target.closest('[data-act]');if(button&&!button.disabled&&!button.closest('[inert]')) UI._acts[button.dataset.act]?.(button.dataset);});
await import('/src/cards/cards.js');
SDT.Cards.ensureSha(); SDT.Cards.ensureStarters(); SDT.Cards.ensureTabletop(); SDT.Cards.ensureDmgTypes(); SDT.Cards.ensureEffectFields();
const {BattleSession}=await import('/src/battle/core/battle.core.js');
await import('/src/battle/view/battle.view.js?infusion-review=r3');

const C=SDT.Cards.all();
const ids=['tt3-ice-spike','tt7-holyheal','tt3sp-bloodstorm','tt3sp-silverthorn','tt12-raydragon','cmtn233trmeg','tt3-azure-sword'];
let game, generation=0, samples=[], inputLog=[], start=0;
const output=document.querySelector('#timingOutput');
function reset(){
 generation++; samples=[];inputLog=[];delete output.dataset.record;delete output.dataset.inputs;output.textContent='按抽牌按钮记录4秒DOM动画；真实鼠标输入单独记载。不会写入存档。';
 game={ownedCards:ids.map((id,i)=>({uid:'draw-'+i,card:C.findLast(c=>c.id===id)})),inventory:[],usedPocket:[],hp:30,maxHp:30,atk:4,spellPower:0,coins:0,myClass:null,state:'idle',battleActive:false,log(){},heal(){},addItem(){},onBattleEnd(){}};
 game.log=message=>document.querySelector('#fixtureResult').textContent=String(message).replace(/<[^>]+>/g,'');
 sdtDefine('game',game); BattleSession.start(game,[{id:'foe-a',name:'低血靶',hp:4,atk:1},{id:'foe-b',name:'训练靶',hp:100,atk:1}],{isBoss:true,directBossStart:true});
}
function draw(n){
 const token=++generation; start=performance.now();samples=[];inputLog=[];delete output.dataset.record;delete output.dataset.inputs;
 BattleSession.commands.dev('draw',n);
 function sample(){
 if(token!==generation)return;
 const t=Math.round(performance.now()-start);
 samples.push({t,slots:[...document.querySelectorAll('.bt-slot')].map(el=>{const r=el.getBoundingClientRect();return {uid:el.dataset.uid,x:Math.round(r.x),y:Math.round(r.y),animations:el.getAnimations().map(a=>({time:Math.round(Number(a.currentTime)),duration:a.effect.getTiming().duration,delay:a.effect.getTiming().delay,state:a.playState})),opacity:getComputedStyle(el).opacity};})});
 output.textContent=JSON.stringify({elapsed:t,samples:samples.length,latest:samples.at(-1),inputs:inputLog},null,1);
 if(t<4000)requestAnimationFrame(sample);else output.dataset.record=JSON.stringify({n,samples,inputs:inputLog});
 } requestAnimationFrame(sample);
}
document.querySelector('#fixtureReset').onclick=reset;
document.querySelectorAll('[data-draw]').forEach(el=>el.onclick=()=>draw(Number(el.dataset.draw)));
for(const type of ['pointerdown','pointerup','click'])document.querySelector('#ovBody').addEventListener(type,e=>{inputLog.push({t:Math.round(performance.now()-start),type,uid:e.target.closest('[data-uid]')?.dataset.uid,act:e.target.closest('[data-act]')?.dataset.act});output.dataset.inputs=JSON.stringify(inputLog);},true);
reset();
