import {readFileSync,writeFileSync} from 'node:fs';
const dir='node_modules/.cache/photo-perf-opt/';
const stages=['before-fixed','after-final','before-confirm'];
const data=Object.fromEntries(stages.map(id=>[id,JSON.parse(readFileSync(dir+id+'.json','utf8'))]));
const median=values=>{const s=[...values].sort((a,b)=>a-b);return (s[Math.floor((s.length-1)/2)]+s[Math.ceil((s.length-1)/2)])/2};
const valid=Object.values(data).every(s=>s.actions.length===15&&s.actions.every(a=>a.viewport.width===683&&a.viewport.height===956&&Math.abs(a.viewport.dpr-1.25)<0.000001));
if(!valid)throw new Error('Display parameters differ');
const before=[...data['before-fixed'].actions,...data['before-confirm'].actions],after=data['after-final'].actions;
const rows=['btnCardLib','libType1','libType0'].map(action=>{
 const a=before.filter(x=>x.action===action),b=after.filter(x=>x.action===action);
 const old=median(a.map(x=>x.presentMs)),next=median(b.map(x=>x.presentMs));
 return {action,beforeN:a.length,afterN:b.length,beforeMedianMs:old,afterMedianMs:next,reductionPercent:(old-next)/old*100,beforeRangeMs:[Math.min(...a.map(x=>x.presentMs)),Math.max(...a.map(x=>x.presentMs))],afterRangeMs:[Math.min(...b.map(x=>x.presentMs)),Math.max(...b.map(x=>x.presentMs))]};
});
const beforeAnimations=[...data['before-fixed'].animations,...data['before-confirm'].animations];
const visualAnimationParametersUnchanged=data['after-final'].animations.every(a=>beforeAnimations.some(b=>JSON.stringify(a)===JSON.stringify(b)));
const afterSlowFilterReads=data['after-final'].reads.filter(r=>r.read!=='_checkPageBg'&&data['after-final'].actions.some(a=>a.action!=='btnCardLib'&&r.start>=a.start&&r.start<a.end));
const result={displayParametersMatch:valid,viewport:{width:683,height:956,dpr:1.25},rows,visualAnimationParametersUnchanged,afterSlowFilterReads,observedLongTasks:{beforeAcross30Actions:data['before-fixed'].longTasks.length+data['before-confirm'].longTasks.length,afterAcross15Actions:data['after-final'].longTasks.length},notes:['presentMs is trusted click to two rAF callbacks after DOM update, not hardware screen presentation or FPS','Cold module load and explicit warmup are excluded; five reopen/filter rounds per batch','Two earlier pairs had DPR mismatch and are excluded; intermediate implementation after-fixed is diagnostic only','Sequential before/after/before batches; no randomised order or statistical significance claim']};
writeFileSync(dir+'comparison.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
