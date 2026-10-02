const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../../../../..');
function walk(dir) { return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]); }
const rel = p => path.relative(root,p).replaceAll('\\','/');
const soundPath=path.join(root,'game/src/audio/sound.js'), sound=fs.readFileSync(soundPath,'utf8');
function keys(a,b) { return [...sound.slice(sound.indexOf(a),sound.indexOf(b,sound.indexOf(a))).matchAll(/^\s{4}(\w+)\s*:/gm)].map(m=>m[1]); }
const playable=[...new Set([...keys('const SFX = {','/* ---------- jsfxr'),...keys('const BATTLE_URLS = {','const BATTLE_GAIN'),...keys('const JSFX_URLS = {','let jsfxBuffers')])].sort();
const calls=[]; const imports=[]; const dynamic=[];
for(const p of walk(path.join(root,'game/src')).filter(p=>p.endsWith('.js'))){
 const text=fs.readFileSync(p,'utf8');
 text.split('\n').forEach((line,i)=>{ if(/import.*sound\.bank|new SampleSfxBank/.test(line)) imports.push({file:rel(p),line:i+1,text:line.trim()}); });
 for(const m of text.matchAll(/(?:SDT\.Sound|window\.SDT\.Sound)\.sfx\(\s*['"]([^'"]+)['"]/g)) calls.push({name:m[1],file:rel(p),line:text.slice(0,m.index).split('\n').length,playable:playable.includes(m[1])});
 for(const m of text.matchAll(/(?:SDT\.Sound|window\.SDT\.Sound)\.sfx\(\s*([^'"\s][^\n]*)/g)) dynamic.push({file:rel(p),line:text.slice(0,m.index).split('\n').length,expression:m[1]});
}
const catalogPath=path.join(root,'game/assets/sfx/alternatives/arknights-runtime/library.json');
const catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
const cues=catalog.cues.map(c=>({id:c.id,loop:!!c.loop,variants:c.variants.map(v=>{const p=path.join(root,'game',v.src);return {src:v.src,exists:fs.existsSync(p),bytes:fs.existsSync(p)?fs.statSync(p).size:null};})}));
const audioFiles=walk(path.join(root,'game/assets')).filter(p=>/\.(ogg|mp3|wav)$/.test(p));
const groups={}; for(const p of audioFiles){const key=rel(p).split('/').slice(0,-1).join('/');groups[key]??={count:0,bytes:0}; groups[key].count++;groups[key].bytes+=fs.statSync(p).size;}
const missing=calls.filter(c=>!c.playable), names=[...new Set(calls.map(c=>c.name))].sort();
const result={timestamp:new Date().toISOString(),method:'Read-only static route audit. Literal sfx call sites only; dynamic expressions listed separately. Not playback, decoding, listening, or current browser verification.',source:{file:rel(soundPath),sha256:crypto.createHash('sha256').update(sound).digest('hex')},runtime:{playableKeys:playable,literalCallSites:calls.length,literalUniqueCueNames:names.length,unhandledCallSites:missing.length,unhandledUniqueCueNames:[...new Set(missing.map(c=>c.name))].sort(),bankIntegrationReferences:imports,sceneExported:/\bscene\s*[,:(]/.test(sound.slice(sound.indexOf("sdtDefine('Sound'")))},calls,dynamic,catalog:{path:rel(catalogPath),name:catalog.name,version:catalog.version,cueCount:cues.length,loopCount:cues.filter(c=>c.loop).length,variants:cues.reduce((n,c)=>n+c.variants.length,0),missingFiles:cues.flatMap(c=>c.variants.filter(v=>!v.exists).map(v=>({id:c.id,...v}))),cues},disk:{audioFileCount:audioFiles.length,groups}};
fs.writeFileSync(path.join(__dirname,'audio-audit.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({runtime:result.runtime,catalog:{cueCount:result.catalog.cueCount,loopCount:result.catalog.loopCount,variants:result.catalog.variants,missingFiles:result.catalog.missingFiles},disk:result.disk},null,2));
