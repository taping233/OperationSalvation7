import { it, expect, afterEach } from 'vitest';
import { createBattleDiscoverFlow } from '../game/src/battle/effects/battle.discover-flow.js';
import { showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { clearCardFeedback } from '../game/src/battle/view/battle.card-feedback.js';
afterEach(() => clearCardFeedback());
function stage() { document.body.innerHTML='<div id="overlay"><div class="battle-stage"><div class="sts-hand"></div></div></div>';const s=document.querySelector('.battle-stage'); s._battleToken=1; return s; }
// 反馈#5b（2026-10-21 老板定版）：「直接释放/直接施放」词条对注能卡一律视为已注能——
// 即使直释路径报告注能缺口，也按「排队施放」呈现并直接释放，不再保留「置入手牌等待注能」分支。
it.each(['play','potion','playKeep'])('%s 注能卡直释仍排队施放（视为已注能，不再置入手牌等待注能）', (act) => {
 const card={id:'pure',name:'纯注能',desc:'注能（1）：回复7点生命',infuse:1};
 let selection={ options:[card], n:1, act, tempUids:[] }; const events=[];
 const flow=createBattleDiscoverFlow({cards:{all:()=>[card],isRandomObtainable:()=>true,sellPrice:()=>1,findByUid:()=>({card}),addTempCard:(c,p)=>{events.push({kind:'draw',acquired:true,uid:'new',name:c.name,card:c,...p});return 'new';},queueCardExecution:()=>true,directPlayReason:()=>'需要先注能',fireCatGift:()=>{}},interaction:{getJobs:()=>[],get:()=>selection,set:s=>selection=s,requestRender:()=>{}},random:{next:()=>0},battle:{currentClass:()=>null,firstAliveTarget:()=>null,hasAliveFoes:()=>true,sweepDead:()=>{},finishVictory:()=>{}},effects:{},output:{log:()=>{}}});
 flow.pickDiscover(0); const s=stage(); showBattleCardResults(s,events);
 expect(events[0].source).toBe('discover-cast');
 expect(document.querySelectorAll('.fx-art-draw')).toHaveLength(1);
 showBattleCardResults(s,events);expect(document.querySelectorAll('.fx-art-draw')).toHaveLength(1);
 expect(s.textContent).toBe('');
 expect(document.querySelectorAll('.bt-card-reveal')).toHaveLength(0);
});
