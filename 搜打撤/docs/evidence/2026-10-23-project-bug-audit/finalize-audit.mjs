import { readFileSync, writeFileSync, statSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const root=process.cwd(), dir='docs/evidence/2026-10-23-project-bug-audit';
const json=name=>JSON.parse(readFileSync(path.join(dir,name),'utf8'));
const expected=new Map();
for(const [file,hash] of Object.entries(json('battle/reproduction-results.json').sources))expected.set('game/src/battle/'+file,hash.toLowerCase());
for(const [file,hash] of Object.entries(json('persistence/verification.json').sourceSha256))expected.set(file,hash.toLowerCase());
for(const record of json('expedition/source-receipt.json'))if(record.path.startsWith('game/'))expected.set(record.path,record.sha256.toLowerCase());
const files=[...new Set([...expected.keys(),'game/src/agent/agent.policy.js','game/src/agent/agent.stats.js','game/src/agent/agent.state.js',
  'game/src/ui/menu-slots.js','game/src/ui/save-management.js','game/src/battle/effects/battle.discover-flow.js',
  'game/src/battle/effects/battle.discover-preview.js','game/src/run/game.session.js'])];
const sources=files.map(file=>{const hash=createHash('sha256').update(readFileSync(file)).digest('hex');
  return {path:file,sha256:hash,mtime:statSync(file).mtime.toISOString(),matchesDomainReceipt:expected.has(file)?hash===expected.get(file):null};});
const drift=sources.filter(file=>file.matchesDomainReceipt===false);
const status=execFileSync('git',['status','--porcelain=v1','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const result={takenAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  status:{entries:status.length,tracked:status.filter(x=>!x.startsWith('??')).length,untracked:status.filter(x=>x.startsWith('??')).length},
  findings:{new:14,knownReconfirmed:6,total:20},
  validation:{existingTestFileExecutions:110,existingAssertionsPassed:1369,syntaxFiles:675,lintFiles:1543,lintErrors:0,typeCheckExitCode:1,typeDistinctLocations:9,assetErrors:0,unchangedAssetWarnings:570,docsCheckExitCode:0},
  sourceDrift:drift,sources};
writeFileSync(path.join(dir,'final-receipt.json'),JSON.stringify(result,null,2)+'\n');
const walk=folder=>readdirSync(folder,{withFileTypes:true}).flatMap(item=>item.isDirectory()?walk(path.join(folder,item.name)):[path.join(folder,item.name)]);
const broken=[],large=[];
for(const file of walk(dir)){
  if(statSync(file).size>1_000_000)large.push(file);
  if(!file.endsWith('.md'))continue;
  for(const match of readFileSync(file,'utf8').matchAll(/\[[^\]]+\]\(([^)]+)\)/g)){
    const target=match[1].split('#')[0];
    if(!target||/^https?:/.test(target))continue;
    if(!existsSync(path.resolve(path.dirname(file),target)))broken.push({file,target});
  }
}
console.log(JSON.stringify({sources:sources.length,domainReceiptsCompared:expected.size,drift,brokenEvidenceLinks:broken,filesOver1MB:large,status:result.status}));
if(drift.length||broken.length||large.length)process.exitCode=1;
