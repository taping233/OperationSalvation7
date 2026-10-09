import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {sourceCardLibrary} from '../../../scripts/sync-cards-from-live.mjs';
import {RETIRE_TT10,RETIRE_TT11} from '../../../game/src/cards/cards.consts.js';
const root='D:/素材/代号柒', out=path.dirname(fileURLToPath(import.meta.url));
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',maxBuffer:80*1024*1024,stdio:['pipe','pipe','pipe']});
const current=sourceCardLibrary();
const sync=JSON.parse(fs.readFileSync(path.join(root,'搜打撤/game/data/cards-sync.json'),'utf8'));
const sources=[], failures=[], all=new Map();
const fields=['name','type','cost','rarity','cls','desc','dmg','dmgType','draw','heal','armor','infuse','value','sellable','unrandom','tokenOf'];
function add(c,source){if(!c||typeof c.id!=='string'||typeof c.name!=='string'||!c.type)return; if(!all.has(c.id))all.set(c.id,{id:c.id,versions:new Map()}); const e=all.get(c.id),face=Object.fromEntries(fields.filter(k=>c[k]!==undefined).map(k=>[k,c[k]])), key=JSON.stringify(face);if(!e.versions.has(key))e.versions.set(key,{card:c,sources:[]});e.versions.get(key).sources.push(source);}
function scan(text,source,json=false){let count=0;if(json){const walk=v=>{if(!v||typeof v!=='object')return;if(v.id&&v.name&&v.type){add(v,source);count++;}for(const x of Object.values(v))if(x&&typeof x==='object')walk(x);};walk(JSON.parse(text));}else{
 const starts=[...text.matchAll(/\{\s*id\s*:\s*['"]/g)].map(m=>m.index);
 for(const start of starts){let depth=0,quote=null,escape=false,end=-1;for(let i=start;i<text.length;i++){const c=text[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c===quote)quote=null;continue;}if(c==='"'||c==="'"||c==='`'){quote=c;continue;}if(c==='{')depth++;if(c==='}'&&--depth===0){end=i+1;break;}}if(end<0)continue;try{const c=vm.runInNewContext('('+text.slice(start,end)+')',{SDT:{Icons:{img:n=>'[[icon:'+n+']]'}}},{timeout:100});if(c.id&&c.name&&c.type){add(c,source);count++;}}catch(e){failures.push({source,start,error:e.message,snippet:text.slice(start,start+130)});}}
 }sources.push({source,count});}
const files=[...new Set(git('log','--all','--format=','--name-only','--','*cards.js','*cards.data.js','*cards-sync.json','*cards.json').split(/\r?\n/).filter(p=>p&&!p.includes('/fixture-')))];
for(const file of files){const logs=git('log','--all','--format=%H %ad','--date=iso-strict','--',file).trim().split(/\r?\n/).filter(Boolean).reverse();const seen=new Set();for(const row of logs){const [sha,date]=row.split(' ');let blob;try{blob=git('rev-parse',sha+':'+file).trim();}catch{continue;}if(seen.has(blob))continue;seen.add(blob);scan(git('show',sha+':'+file),date+' '+sha.slice(0,10)+' '+file,file.endsWith('.json'));}const abs=path.join(root,file);if(fs.existsSync(abs))scan(fs.readFileSync(abs,'utf8'),'工作区 '+file,file.endsWith('.json'));}
for(const c of current)add(c,'2026-10-09 当前装配卡库');
for(const id of sync.retire)if(!all.has(id))all.set(id,{id,versions:new Map()});
const active=new Map(current.map(c=>[c.id,c])), retired=new Set([...sync.retire,...RETIRE_TT10,...RETIRE_TT11]);
const cards=[...all.values()].map(e=>{const versions=[...e.versions.values()];let status=active.has(e.id)?'现役':retired.has(e.id)||versions.some(v=>v.card.name==='新兵操典')?'明确退役':e.id==='builtin-sha'||e.id==='builtin-jinchuangyao'?'旧ID迁移或合并':'仅历史存在';const statusReason=active.has(e.id)?'当前装配卡库':sync.retire.includes(e.id)?'cards-sync v35 retire':RETIRE_TT10.includes(e.id)?'RETIRE_TT10':RETIRE_TT11.includes(e.id)?'RETIRE_TT11':versions.some(v=>v.card.name==='新兵操典')?'ensureTabletopSync11 按名称清理新兵操典':e.id==='builtin-sha'?'ensureSha 迁移至 starter-attack':e.id==='builtin-jinchuangyao'?'ensureItemRenames 合并并清理旧 ID':'当前未在册，尚未找到整卡退役依据';return {id:e.id,status,statusReason,current:active.get(e.id)||null,versions};});
const report={generatedAt:'2026-10-09',head:git('rev-parse','HEAD').trim(),syncVersion:sync.version,retire:sync.retire,retireTT10:RETIRE_TT10,retireTT11:RETIRE_TT11,statusCounts:Object.fromEntries(['现役','明确退役','旧ID迁移或合并','仅历史存在'].map(s=>[s,cards.filter(c=>c.status===s).length])),currentCount:current.length,totalCount:cards.length,versionCount:cards.reduce((n,c)=>n+c.versions.length,0),sources,failures,cards};
fs.writeFileSync(path.join(out,'catalog.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({current:current.length,total:cards.length,versions:report.versionCount,sources:sources.length,failures:failures.length,retired:cards.filter(c=>c.status==='明确退役').map(c=>({id:c.id,name:c.versions.at(-1)?.card.name})),historical:cards.filter(c=>c.status==='仅历史存在').map(c=>({id:c.id,name:c.versions.at(-1)?.card.name}))}));
