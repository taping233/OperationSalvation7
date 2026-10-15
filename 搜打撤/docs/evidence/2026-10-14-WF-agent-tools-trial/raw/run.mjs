import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import path from 'node:path';
const root=process.cwd(), out=path.join(root,'node_modules/.cache/agent-tools-trial');
const executables=JSON.parse(readFileSync(path.join(out,'executables.json'),'utf8').replace(/^\uFEFF/,''));
const lean=executables.find(p=>p.includes('c1fcf7089634e7d8'));
const smoke=executables.find(p=>p.includes('13c8f15e04497dd0'));
const metrics=[];
function run(id,command,args){
 const start=performance.now(); const result=spawnSync(command,args,{cwd:root,encoding:'utf8',maxBuffer:40*1024*1024,timeout:180000,windowsHide:true});
 writeFileSync(path.join(out,id+'.stdout'),result.stdout||''); writeFileSync(path.join(out,id+'.stderr'),result.stderr||'');
 const record={id,command,args,seconds:+((performance.now()-start)/1000).toFixed(3),exit:result.status,error:result.error?.message,bytes:Buffer.byteLength(result.stdout||'')}; metrics.push(record); console.log(JSON.stringify(record));
 writeFileSync(path.join(out,process.argv[2]+'-metrics.json'),JSON.stringify(metrics,null,2));
 if(result.status!==0) throw new Error(id+' failed: '+(result.stderr||result.error||result.status));
 return result.stdout;
}
const common=['--root',root,'--database',path.join(out,'leantoken.sqlite'),'--tokenizer','o200k_base','--index-include','game/src/**','--index-include','game/tools/**','--index-include','tests/**'];
if(process.argv[2]==='index') run('lean-index',lean,[...common,'index','--json']);
if(process.argv[2]==='scan') run('smoke-scan',process.execPath,[smoke,'scan','game/src','--format','json','--max-findings','80','--non-interactive']);
if(process.argv[2]==='query') {
 const tasks=[
 ['save','Trace base save mutation commitBaseMutation and localStorage persistence failure handling'],
 ['render','Find map render scheduler requestAnimationFrame invalidation and full screen overlay pause'],
 ['agent','Trace Agent observe legal actions and runner settleSignature cache invalidation']
 ];
 for(const [id,task] of tasks) run('lean-'+id,lean,[...common,'context','--task',task,'--budget','1800','--max-response-tokens','4200','--max-fragments','8','--response-profile','compact','--json']);
 run('lean-coverage',lean,[...common,'coverage','--json']);
 run('lean-savings',lean,[...common,'savings','--json']);
}
if(process.argv[2]==='compare') {
 const queries=[['save','commitBaseMutation|localStorage.setItem|SAVE_FAILED','game/src/hub/base.js','game/src/hub/base-mutation.js','tests/base-mutation.test.js'],['render','renderScheduler|shouldDraw|covered|requestAnimationFrame','game/src/game.boot.js','game/src/core/render-scheduler.js','tests/render-scheduler.test.js'],['agent','function observe|function settleSignature|bustSigCache|collectUiActions','game/src/agent/agent.state.js','game/src/agent/agent.runner.js','game/src/agent/agent.surface.js']];
 for(const [id,pattern,...files] of queries)run('rg-'+id,'rg',['-n',pattern,...files]);
 run('lean-save-focused',lean,[...common,'context','--task','base localStorage save failure commitBaseMutation','--focus','game/src/hub/base.js','--focus','game/src/hub/base-mutation.js','--strict-focus-paths','--budget','1800','--max-response-tokens','4200','--response-profile','compact','--json']);
 run('lean-render-focused',lean,[...common,'context','--task','renderScheduler shouldDraw covered requestAnimationFrame','--focus','game/src/game.boot.js','--focus','game/src/core/render-scheduler.js','--strict-focus-paths','--budget','1800','--max-response-tokens','4200','--response-profile','compact','--json']);
 run('lean-chinese',lean,[...common,'context','--task','地图被全屏页面覆盖时如何暂停绘制，关闭页面后如何恢复','--budget','1800','--max-response-tokens','4200','--response-profile','compact','--json']);
}
if(process.argv[2]==='native-discovery') {
 for(const [id,pattern] of [['save','commitBaseMutation|SAVE_FAILED'],['render','renderScheduler|shouldDraw'],['agent','settleSignature|bustSigCache|collectUiActions']])run('rg-discovery-'+id,'rg',['-l',pattern,'game/src','game/tools','tests']);
}
