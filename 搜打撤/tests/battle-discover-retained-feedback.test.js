import { it, expect, afterEach } from 'vitest';
import { createBattleDiscoverFlow } from '../game/src/battle/effects/battle.discover-flow.js';
import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { clearCardFeedback } from '../game/src/battle/view/battle.card-feedback.js';
afterEach(() => clearCardFeedback());
function stage() { document.body.innerHTML='<div id="overlay"><div class="battle-stage"><div class="sts-hand"></div></div></div>';const s=document.querySelector('.battle-stage'); s._battleToken=1; return s; }
it.each(['play','potion','playKeep'].flatMap(act=>[[act,true],[act,false]]))('%s rejected=%s preserves actual retained or queued presentation', (act,rejected) => {
 const card={id:'pure',name:'纯注能',desc:'注能（1）：回复7点生命',infuse:1};
 let selection={ options:[card], n:1, act, tempUids:[] }; const events=[];
 const flow=createBattleDiscoverFlow({cards:{all:()=>[card],isRandomObtainable:()=>true,sellPrice:()=>1,findByUid:()=>({card}),addTempCard:(c,p)=>{events.push({kind:'draw',acquired:true,uid:'new',name:c.name,card:c,...p});return 'new';},queueCardExecution:()=>!rejected,directPlayReason:()=>rejected?'需要先注能':'',fireCatGift:()=>{}},interaction:{getJobs:()=>[],get:()=>selection,set:s=>selection=s,requestRender:()=>{}},random:{next:()=>0},battle:{currentClass:()=>null,firstAliveTarget:()=>null,hasAliveFoes:()=>true,sweepDead:()=>{},finishVictory:()=>{}},effects:{},output:{log:()=>{}}});
 flow.pickDiscover(0); const s=stage(); showBattleCardResults(s,events);
 expect(events[0].source).toBe(rejected?undefined:'discover-cast');
 expect(s.textContent).toContain(rejected?'置入手牌':'排队施放');
 expect(s.textContent).not.toContain(rejected?'排队施放':'置入手牌');
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(rejected?1:0);
});
