// Execute the current source player's actual timeline functions without a browser renderer.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath,pathToFileURL } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const project = path.resolve(here, '../../..');
const game = path.resolve(project, '../搜打撤/game');
const sourcePath = path.join(game, 'src/battle/view/battle.frames.js');
const source = fs.readFileSync(sourcePath, 'utf8');
const {frameImpactRemaining}=await import(pathToFileURL(path.join(game,'src/battle/view/battle.action-timing.js')));
const {createStagedPlayback}=await import(pathToFileURL(path.join(game,'src/battle/runtime/battle.playback.js')));
const {impactProfile}=await import(pathToFileURL(path.join(game,'src/battle/view/battle.attack-profiles.js')));
const player = source.slice(source.indexOf('function buildTimeline('), source.indexOf('// Reuse the existing hide/release path'));
const catalogs = Object.fromEntries(['wu','changwuyu','baita','heixiang','xingyue'].map(role =>
  [role, JSON.parse(fs.readFileSync(path.join(game, `assets/portraits/frames/${role}/sprite-v1/animations.json`),'utf8'))]));
const catalogCode = ['battle.frame-catalog.js','battle.frame-catalog-changwuyu.js','battle.frame-catalog-three-role.js']
  .map(file => fs.readFileSync(path.join(game,'src/battle/view',file),'utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('export ',''))
  .join('\n');
const vectors = [];
for (const [role,catalog] of Object.entries(catalogs)) for (const pace of [1,2]) for (const action of Object.keys(catalog.sequences)) {
  const times = new Set([0, 1, 10000]); let total = 0;
  if (action !== 'idle') for (const ms of catalog.timings[action]) {
    total += ms/pace; times.add(total-.01); times.add(total); times.add(total+.01);
  }
  for (const time of [...times].sort((a,b)=>a-b)) {
    const context = {wu:catalogs.wu,changwuyu:catalogs.changwuyu,baita:catalogs.baita,
      heixiang:catalogs.heixiang,xingyue:catalogs.xingyue, now:0, role, pace, action, time,
      fixedFrameRole:()=>true, getPace:()=>pace, document:{getElementById:()=>({dataset:{}})},
      performance:{now:()=>0}, pausedAt:0, Random:{random:()=>0},
      applyFrame:name=>{context.painted=name;}, cur:{role,seqs:new Map([['idle',catalog.sequences.idle]]),
        set:new Set(Object.values(catalog.sequences).flat()), resumeAfter:null}};
    vm.createContext(context);
    vm.runInContext(catalogCode+'\n'+player+`\nplaySeq(action); advance(time);`,context);
    vectors.push({role,pace,action,time,expected:{action:context.cur.action,frame:context.painted,
      index:context.cur.fi,running:!!context.cur.play,impact:frameImpactRemaining({role,timeline:context.cur.play,index:context.cur.fi,nextAt:context.cur.tNext,now:time})}});
  }
}
const hashes = Object.fromEntries([sourcePath, ...Object.keys(catalogs).map(role=>path.join(game,`assets/portraits/frames/${role}/sprite-v1/animations.json`))]
 .map(file=>[path.relative(game,file).replaceAll('\\','/'),crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const timingVectors=[];
const paceText=fs.readFileSync(path.join(game,'src/battle/runtime/battle.pace.js'),'utf8');
for(const pace of [1,2])for(const replay of [false,true])for(const contact of [null,0,12,111])for(const windupMs of [90,130,200,240]){
 const scope={pace};vm.createContext(scope);vm.runInContext(paceText.slice(paceText.indexOf('function demoMs('),paceText.indexOf('export {')),scope);
 const demo=ms=>scope.demoMs(ms),delays=[],foe={dead:false},floats=[];
 const session={generation:0,stagedDeathFx:new Set(),stagedResolutionDepth:0};
 const run=createStagedPlayback({session,getBattleToken:()=>1,getFloats:()=>floats,foeIdx:()=>0,render(){},finish(){},presentation:{clearFeedback(){},waitForFeedback:async()=>{},waitForRenderedFrame:async()=>{},waitMs:async ms=>delays.push(ms),demoMs:demo,actionImpactRemaining:()=>contact}});
 function* steps(){if(replay)yield{kind:'windup',targets:[foe],cue:{attacker:'player-attack',windupMs}};yield{kind:'windup',targets:[foe],cue:{attacker:'player-attack',windupMs}};}
 await run(steps(),new AbortController().signal);
 timingVectors.push({pace,replay,contact,windupMs,expected:delays.at(-1)});
}
const stops=[];
for(const profile of ['light','heavy','spell','combo'])for(const amount of [0,2,9,10,40])for(const kill of [false,true])for(const reduced of [false,true])
 stops.push({profile,amount,kill,reduced,expected:impactProfile({profile},amount,{kill,reduced}).stopMs});
fs.writeFileSync(path.join(here,'source-vectors.json'),JSON.stringify({hashes,vectors,timingVectors,stops},null,2)+'\n');
console.log(JSON.stringify({vectors:vectors.length,sourceFunctions:['buildTimeline','playSeq','advance']}));
