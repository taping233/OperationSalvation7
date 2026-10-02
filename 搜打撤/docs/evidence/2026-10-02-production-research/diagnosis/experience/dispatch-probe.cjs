// Dry dispatch probe: evaluates the real sound.js registry in an isolated VM.
// Audio setup and final playback are intentionally bypassed. No network/UI/save access.
const fs=require('fs'),path=require('path'),vm=require('vm'),crypto=require('crypto');
const root=path.resolve(__dirname,'../../../../..'),p=path.join(root,'game/src/audio/sound.js'),raw=fs.readFileSync(p,'utf8');
const results=[];let api;
let source=raw.replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.url',"'https://probe.invalid/game/src/audio/sound.js'").replace(/^export \{ tone \};?\s*$/m,'');
const ensureNeedle='if (!ensure()) return;';
if(source.split(ensureNeedle).length!==3) throw Error('Unexpected ensure guard count; inspect changed source before probing.');
source=source.replaceAll(ensureNeedle,'/* probe: skip real AudioContext setup */');
const dispatchNeedle='const fn = SFX[name];';
if(source.split(dispatchNeedle).length!==2)throw Error('Unexpected dispatch structure');
source=source.replace(dispatchNeedle,"const fn = SFX[name]; probe(name, !!fn); return;");
const sandbox={URL,console,Map,Math,Date,performance:{now:()=>1000},document:{addEventListener(){}},localStorage:{getItem:()=>null},Howl:class{},Howler:{},assetUrl:x=>x,Random:{random:()=>0},WinterSoundscape:class{},shouldPlaySfx:()=>true,sdtDefine:(name,value)=>{if(name==='Sound')api=value;},probe:(name,registered)=>results.push({name,registered})};
vm.runInNewContext(source,sandbox,{filename:p,timeout:2000});
for(const name of ['prepReady','deployStart','extractionSuccess','searchReveal','storyComplete','attackArrow','card','victory','phase']) api.sfx(name);
const out={method:'Isolated real-registry evaluation with AudioContext setup and final playback bypassed. Cold sample pools. Proves registry dispatch, not audible output or cue reachability.',sourceSha256:crypto.createHash('sha256').update(raw).digest('hex'),sceneExported:typeof api.scene==='function',results};
fs.writeFileSync(path.join(__dirname,'dispatch-probe.json'),JSON.stringify(out,null,2)+'\n');console.log(JSON.stringify(out,null,2));
