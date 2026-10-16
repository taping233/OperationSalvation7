const overlay=document.getElementById('overlay'),ovBody=document.getElementById('ovBody'),ovTitle=document.getElementById('ovTitle'),state=document.getElementById('qaState'),logEl=document.getElementById('log');
const storageBaseline=JSON.stringify({keys:Object.keys(localStorage).sort(),values:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))});
const actions=new Map();
const rich=s=>String(s).replace(/\[\[icon:([^\]]+)\]\]/g,'<span aria-hidden="true">◆</span>');
const qaDisabledActions=new Set(['btBag','btSettings']);
const disableQaActions=html=>[...qaDisabledActions].reduce((out,name)=>out.replace(new RegExp(`(<button\\b[^>]*data-act=["']${name}["'][^>]*)(>)`,'g'),(match,head,end)=>`${head} disabled aria-disabled="true" title="隔离验收页未接入此功能"${end}`),String(html));
const UI={el:{overlay,ovBody,ovTitle},_lastMode:'battle',showOverlay(title,html,mode){overlay.className=mode==='battle'?'room-view':'';overlay.querySelector('.card').className=mode==='battle'?'card room battle':'card';ovTitle.innerHTML=rich(title||'');ovBody.innerHTML=rich(disableQaActions(html));overlay.hidden=false;this._lastMode=mode;},hideOverlay(){overlay.hidden=true;},hideTooltip(){},showTooltip(){},refresh(){updateState();},log(message){logEl.insertAdjacentHTML('beforeend',`<div>${rich(message)}</div>`);},act(name,fn){actions.set(name,qaDisabledActions.has(name)?()=>UI.log('隔离验收页未接入此功能'):fn);}};
ovBody.addEventListener('click',e=>{const el=e.target.closest('[data-act]');if(el&&actions.has(el.dataset.act))actions.get(el.dataset.act)({...el.dataset});});
window.SDT={UI,Icons:{img:()=>'<span aria-hidden="true">◆</span>',rich,TYPE_ART:{}},Sound:{music(){},sfx(){},setDucked(){},setBoss(){},setMusicMuted(){},setSfxMuted(){},musicMuted:false,sfxMuted:false},Art:{has:()=>false,monsterArt:()=>'<span>敌</span>',classArt:()=>'',cutoutFigures(){},decodeIn(){},warm(){},collectCardAssets:()=>[]},Meta:{track(){}},MAP:{rules:{battleEnergy:99,battleHandMax:99,bossDeckSize:10,starterSha:0,battleStartDraw:5,battleTurnDraw:1,diceSides:6},items:{rations:{name:'口粮'},wood:{name:'木材'}}}};
await import('/src/cards/cards.js');
window.SDT.Cards.ensureSha(); window.SDT.Cards.ensureStarters(); window.SDT.Cards.ensureTabletop(); window.SDT.Cards.ensureDmgTypes(); window.SDT.Cards.ensureEffectFields();
const {BattleSession}=await import('/src/battle/core/battle.core.js');
await import('/src/battle/view/battle.view.js');
const {resolveEncounterGroup}=await import('/src/run/encounter-selector.js');
const map=await fetch('/data/map.json').then(r=>r.json());
let fixture=null;
const makeFixture=()=>{const sha={...(window.SDT.Cards.all().find(c=>c.id==='starter-attack')||window.SDT.Cards.SHA)};return{ownedCards:['cmtn1wnhhym','cc-mana-surge'].map((id,i)=>({uid:`qa-result-${i}`,card:{...window.SDT.Cards.all().find(c=>c.id===id)}})),inventory:[],hp:99999,maxHp:99999,atk:4,spellPower:0,coins:0,myClass:'法师',characterId:null,state:'idle',battleActive:false,logs:[],log(m){this.logs.push(String(m));UI.log(m);},heal(n){this.hp=Math.min(this.maxHp,this.hp+n);},addItem(){},onBattleEnd(){updateState('样本结束；点击同一样本即可从初态重开。');}};};
function updateState(extra=''){const snap=BattleSession.getSnapshot();const storageNow=JSON.stringify({keys:Object.keys(localStorage).sort(),values:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)]))});state.textContent=`${extra} HP=${fixture?.hp??'—'}；敌人=${snap.foes?.map(f=>`${f.name}:${f.hp}`).join(' / ')||'—'}；status=${JSON.stringify(snap.pstat?.status||{})}；存储快照=${storageNow===storageBaseline?'未变化':'检测到变化'}`;}
function defs(groupId){const selected=resolveEncounterGroup(map.encounters,map.monsters,groupId);if(!selected.ok)return null;return{foes:selected.value.enemyIds.map(id=>({...map.monsters[id],hp:99999,atk:1})),strategy:selected.value.strategy,id:selected.value.encounterId};}
function start(groupId){if(fixture?.battleActive)BattleSession.commands.flee();actions.clear();logEl.innerHTML='';fixture=makeFixture();window.SDT.game=fixture;const sample=defs(groupId);if(!sample){state.textContent='样本配置缺失';return;}BattleSession.start(fixture,sample.foes,{isBoss:false,risk:'场景验收',strategy:sample.strategy,encounterId:sample.id,encounterKind:'group',devSample:true});updateState('已载入真实 BattleSession + BattleView。点击手牌后点击目标，或拖牌到目标；');}
document.querySelectorAll('[data-sample]').forEach(btn=>btn.addEventListener('click',()=>start(btn.dataset.sample)));
document.getElementById('qaEnd').addEventListener('click',()=>BattleSession.commands.endTurn());
document.getElementById('qaReset').addEventListener('click',()=>{BattleSession.commands.flee?.();overlay.hidden=true;fixture=null;updateState('已退出样本。');});
state.textContent='已就绪：选择样本开始；背包/奖励/存档不在本验收页接线。';



for (const [id,uid] of [['qaAcquire','qa-result-0'],['qaCast','qa-result-1']]) document.getElementById(id).addEventListener('click',()=>{BattleSession.commands.playCard(uid,0);});
