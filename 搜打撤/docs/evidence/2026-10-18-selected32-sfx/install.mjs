import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES } from '../../../game/src/audio/sound.samples.catalog.js';
import { CUE_LABELS } from '../../../game/src/audio/sfx-review.labels.js';
import { SOURCE_INFO } from '../../../game/src/audio/sfx-review.sources.js';

const base = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(base,'../../..');
const baseline = JSON.parse(readFileSync(path.join(base,'before.json'),'utf8'));
const receipt = JSON.parse(readFileSync(path.join(base,'receipt.json'),'utf8'));
const byKey = Object.fromEntries(receipt.files.map(file=>[file.key,file]));
const choices = {
  safeStore:['safe-store'],open:['open'],safeEnter:['open'],close:['close'],safeRetrieve:['safe-retrieve'],
  drop:['discard'],discard:['discard'],energyUp:['status-up'],buffUp:['status-up'],
  energyDown:['status-down'],buffDown:['status-down'],curseEnd:['curse-end'],
  scene:['transition'],eventEnter:['transition'],layerEnter:['transition'],altarEnter:['altar-enter'],
  doorEnter:['open'],shopEnter:['shop-enter'],extractionEnter:['open'],deployStart:['deploy-start'],
  battleEnter:['battle-enter'],flee:['transition'],parry:['parry','parry-soft'],curse:['curse'],
  attackFire:['fire'],attackIce:['ice'],attackLightning:['lightning'],attackPsychic:['psychic'],
  heal:['heal'],cardRestore:['heal'],shieldUp:['shield'],burn:['burn'],
};
const keys = Object.keys(choices);
if (keys.length!==32 || baseline.selection.some(id=>!choices[id]) || keys.some(id=>!baseline.selection.includes(id))) throw Error('Selection must match exactly 32 user-selected cue IDs');
for (const [id,cue] of Object.entries(baseline.catalog)) if (JSON.stringify(SAMPLE_CUES[id])!==JSON.stringify(cue)) throw Error('Runtime mapping changed since capture: '+id);
for (const files of Object.values(choices)) for (const key of files) if (!byKey[key]) throw Error('Source missing: '+key);

const updates = {}, changes = [];
for (const [id,files] of Object.entries(choices)) {
  updates[id] = {...SAMPLE_CUES[id],files:files.map(key=>byKey[key].path),gain:SAMPLE_CUES[id].group==='transition'?.55:.65};
  changes.push({id,label:CUE_LABELS[id],before:SAMPLE_CUES[id],after:updates[id]});
}
const pending = [];
function edit(relative, transform) {
  const filename = path.join(root,relative), before = readFileSync(filename,'utf8');
  pending.push({relative,filename,before,after:transform(before)});
}
edit('game/src/audio/sound.samples.catalog.js',text=>{
  let next = text.replace('// 按钮/奖励使用老板认可的原创三样，其余沿用Mixkit；来源见各素材目录SOURCES.md。','// 按老板清单替换32项；其余74项保持原映射。来源见各素材目录SOURCES.md。');
  for (const [id,value] of Object.entries(updates)) {
    const lines = next.split(/\r?\n/), index = lines.findIndex(line=>line.startsWith(`  ${id}: `));
    if(index<0) throw Error('Cue line missing: '+id);
    const original = lines[index]; next = next.replace(original,`  ${id}: ${JSON.stringify(value)},`);
  }
  return next;
});

const info = {...SOURCE_INFO};
for (const source of receipt.files) {
  const match = Object.entries(choices).find(([,names])=>names.includes(source.key));
  info[source.path] = {provider:source.provider==='Sound Effect Lab'?'効果音ラボ':source.provider,title:`${CUE_LABELS[match[0]]}${source.key==='parry-soft'?'（轻变体）':''}`,page:source.page,seconds:source.seconds,revision:'selected32-1018',license:source.license};
}
edit('game/src/audio/sfx-review.sources.js',()=> '// 审听页来源资料；运行映射由sound.samples.catalog.js维护。\nexport const SOURCE_INFO = {\n'+Object.entries(info).map(([key,value])=>'  '+JSON.stringify(key)+': '+JSON.stringify(value)+',').join('\n')+'\n};\n');
edit('game/sfx-review.html',text=>text.replace('当前来源：项目原创三样 + Mixkit。刚才的 B 组尚未接入。','已按清单替换32个触发场景，其他74项保留。新来源：OtoLogic与効果音ラボ；可用「只看要更换的」沿用你的标记试听。'));

edit('game/assets/sfx/original-ui-1018/library.json',text=>{
  const data=JSON.parse(text);
  data.name='当前运行音效 · 点选32项更新'; data.version='SELECTED32 10.18';
  data.featuredLabel='本轮更换32项'; data.featuredTitle='按老板清单更新的32个触发'; data.featuredIds=keys;
  for (const cue of data.cues) if (updates[cue.id]) {
    const value=updates[cue.id]; cue.gain=value.gain; cue.group=value.group; cue.label=CUE_LABELS[cue.id]||cue.label;
    cue.note='本轮点选替换 · '+info[value.files[0]].provider;
    cue.variants=value.files.map(file=>({src:'./'+file,seconds:info[file].seconds}));
  }
  return JSON.stringify(data,null,2)+'\n';
});

edit('game/assets/asset-manifest.json',text=>{
  const data=JSON.parse(text), additions=receipt.files.map(file=>({path:file.path.replace(/^assets\//,''),ext:'wav',license:file.license,source:file.page,license_url:file.license_url,bytes:file.bytes,sha256:file.sha256,original_path:file.local_source,processing:'Short excerpt, rate/filters, attenuation only, 4ms fade in and 40ms fade out; detailed receipt in docs/evidence/2026-10-18-selected32-sfx/receipt.json'}));
  if(additions.some(item=>data.assets.some(old=>old.path===item.path))) throw Error('New asset entries already exist; inspect before applying again');
  const eol=text.includes('\r\n')?'\r\n':'\n', marker='"assets": [';
  const at=text.indexOf(marker); if(at<0) throw Error('Asset array missing');
  const insert=additions.map(item=>JSON.stringify(item,null,2).split('\n').map(line=>'    '+line).join(eol)).join(','+eol)+',';
  const next=text.slice(0,at+marker.length)+eol+insert+text.slice(at+marker.length);
  return next.replace(`  "count": ${data.count},`,`  "count": ${data.assets.length+additions.length},`);
});
edit('game/index.html',text=>text.replace('Sound Effects Free License</a>。</p>','Sound Effects Free License</a>。本轮点选替换另含 <a href="https://otologic.jp" target="_blank" rel="noopener noreferrer">OtoLogic</a>（<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>，已剪辑与调音）及<a href="https://soundeffect-lab.info" target="_blank" rel="noopener noreferrer">効果音ラボ</a>（免费商用许可，已剪辑与调音）。</p>'));

for (const item of pending) {
  if (readFileSync(item.filename,'utf8')!==item.before) throw Error('Concurrent file edit: '+item.relative);
  if(item.after===item.before) throw Error('Expected edit was not applied: '+item.relative);
}
for (const item of pending) writeFileSync(item.filename,item.after,'utf8');
writeFileSync(path.join(base,'mapping.json'),JSON.stringify({selection:baseline.selection,changed_count:changes.length,preserved_count:Object.keys(SAMPLE_CUES).length-changes.length,changes,files:pending.map(item=>({path:item.relative,sha256:createHash('sha256').update(item.after).digest('hex')})),tests_run:false,build_run:false,browser_verification:false,listening_verified:false},null,2)+'\n');
console.log('Applied exactly 32 selected cue replacements; 74 other cue definitions preserved. No tests, build, or browser/listening verification.');
