import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {SAMPLE_CUES} from '../../../game/src/audio/sound.samples.catalog.js';
import {CUE_LABELS} from '../../../game/src/audio/sfx-review.labels.js';
import {SOURCE_INFO} from '../../../game/src/audio/sfx-review.sources.js';

const base=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(base,'../../..');
const before=JSON.parse(readFileSync(path.join(base,'before.json'),'utf8'));
const receipt=JSON.parse(readFileSync(path.join(base,'receipt.json'),'utf8'));
const byKey=Object.fromEntries(receipt.files.map(file=>[file.key,file]));
const silent=['open','safeEnter','altarEnter','doorEnter','shopEnter','extractionEnter'];
const choices={close:['close'],energyDown:['status-down'],buffDown:['status-down'],curseEnd:['curse-end'],parry:['parry','parry-muted'],curse:['curse'],attackIce:['ice'],heal:['heal'],cardRestore:['heal']};
const selection=[...silent,...Object.keys(choices)];
if(selection.length!==15 || before.selection.some(id=>!selection.includes(id))) throw Error('Selection must be exactly the requested 15 cues');
for(const [id,cue] of Object.entries(before.catalog)) if(JSON.stringify(cue)!==JSON.stringify(SAMPLE_CUES[id])) throw Error('Mapping changed since capture: '+id);
const changes={},pending=[];
for(const id of selection) changes[id]=silent.includes(id)?{...SAMPLE_CUES[id],files:[],gain:0,silent:true}:{...SAMPLE_CUES[id],files:choices[id].map(key=>byKey[key].path)};
function edit(relative,fn){const filename=path.join(root,relative),text=readFileSync(filename,'utf8');pending.push({relative,filename,before:text,after:fn(text)});}
edit('game/src/audio/sound.samples.catalog.js',text=>{
 let next=text.replace('// 按老板清单替换32项；其余74项保持原映射。来源见各素材目录SOURCES.md。','// 最新点选15项：6项取消音效、9项换音；其余91项保留。来源见各素材目录SOURCES.md。');
 for(const [id,cue] of Object.entries(changes)){
  const line=next.split(/\r?\n/).find(line=>line.startsWith(`  ${id}: `));
  if(!line) throw Error('Cue line missing: '+id);
  next=next.replace(line,`  ${id}: ${JSON.stringify(cue)},`);
 }
 return next;
});
const info={...SOURCE_INFO};
for(const f of receipt.files){
 const id=Object.keys(choices).find(id=>choices[id].includes(f.key));
 info[f.path]={provider:f.provider==='Sound Effect Lab'?'効果音ラボ':f.provider,title:CUE_LABELS[id]+(f.key==='parry-muted'?'（闷音变体）':''),page:f.page,seconds:f.seconds,revision:'selected15-r2-1018',license:f.license};
}
edit('game/src/audio/sfx-review.sources.js',()=> '// 审听页来源资料；运行映射由sound.samples.catalog.js维护。\nexport const SOURCE_INFO = {\n'+Object.entries(info).map(([key,value])=>'  '+JSON.stringify(key)+': '+JSON.stringify(value)+',').join('\n')+'\n};\n');
edit('game/sfx-review.html',text=>{
 const old='已按清单替换32个触发场景，其他74项保留。新来源：OtoLogic与効果音ラボ；可用「只看要更换的」沿用你的标记试听。';
 if(!text.includes(old)) throw Error('Review page changed');
 return text.replace(old,'本轮15项已处理：6个界面进入音取消，9项重新换音，其余91项保留。静音项会标明「已取消音效」，勾选和备注沿用。');
});
edit('game/assets/sfx/original-ui-1018/library.json',text=>{
 const data=JSON.parse(text);data.name='当前运行音效 · 第二轮15项更新';data.version='SELECTED15 R2';data.featuredIds=before.selection;data.featuredLabel='本轮15项';data.featuredTitle='6项已静音，9项重新换音';
 for(const item of data.cues) if(changes[item.id]){
  const cue=changes[item.id];item.gain=cue.gain;item.silent=Boolean(cue.silent);item.label=CUE_LABELS[item.id];
  item.note=cue.silent?'老板要求：进入界面不播放音效':'第二轮点选替换 · '+info[cue.files[0]].provider;
  item.variants=cue.files.map(file=>({src:'./'+file,seconds:info[file].seconds}));
 }
 return JSON.stringify(data,null,2)+'\n';
});
edit('game/assets/asset-manifest.json',text=>{
 const data=JSON.parse(text),items=receipt.files.map(f=>({path:f.path.replace(/^assets\//,''),ext:'wav',license:f.license,source:f.page,license_url:f.license_url,bytes:f.bytes,sha256:f.sha256,original_path:f.local_source,processing:'Source excerpt, mild rate/filter, attenuation and fade; see docs/evidence/2026-10-18-selected15-sfx-r2/receipt.json'}));
 if(items.some(item=>data.assets.some(old=>old.path===item.path))) throw Error('Asset already registered');
 const eol=text.includes('\r\n')?'\r\n':'\n',marker='"assets": [',at=text.indexOf(marker);if(at<0)throw Error('Asset array missing');
 const addition=items.map(item=>JSON.stringify(item,null,2).split('\n').map(line=>'    '+line).join(eol)).join(','+eol)+',';
 return (text.slice(0,at+marker.length)+eol+addition+text.slice(at+marker.length)).replace(`  "count": ${data.count},`,`  "count": ${data.assets.length+items.length},`);
});
for(const item of pending){if(readFileSync(item.filename,'utf8')!==item.before)throw Error('Concurrent edit: '+item.relative);if(item.after===item.before)throw Error('Expected change missing: '+item.relative);}
for(const item of pending)writeFileSync(item.filename,item.after,'utf8');
writeFileSync(path.join(base,'mapping.json'),JSON.stringify({selection:before.selection,silent_cues:silent,replaced_cues:Object.keys(choices),changed_count:15,preserved_count:91,changes:Object.entries(changes).map(([id,after])=>({id,label:CUE_LABELS[id],before:before.catalog[id],after})),files:pending.map(item=>({path:item.relative,sha256:createHash('sha256').update(item.after).digest('hex')})),tests_run:false,build_run:false,browser_verification:false,listening_verified:false},null,2)+'\n');
const sourceLines=['# 第二轮15项音效处理','', '本轮6个进入界面事件不加载或播放声音；其余9个触发使用8份新WAV。没有将任何音效署名加回制作名单。', '', 'Kenney — Interface Sounds / Impact Sounds，CC0 1.0：https://creativecommons.org/publicdomain/zero/1.0/ ；官网：https://kenney.nl/assets/interface-sounds 和 https://kenney.nl/assets/impact-sounds 。', '', '另含効果音ラボ：https://soundeffect-lab.info ，免费商业游戏使用、允许修改，禁止独立素材再分发及AI训练。许可：https://soundeffect-lab.info/agreement/ 。', '', '均经裁切、轻度变速/滤波、仅衰减配平及淡入淡出，转换为48kHz/16bit立体声WAV。文件转换不代表恢复压缩格式已损失的信息。', '', '| 文件 | 来源 | 原件 |','| --- | --- | --- |',...receipt.files.map(f=>`| ${f.key}.wav | ${f.provider} | ${f.original_title} |`),'', '获取方法、原始/运行SHA256与处理参数：docs/evidence/2026-10-18-selected15-sfx-r2/receipt.json；对应15项变更：同目录mapping.json。音频与源包不进Git；未运行测试、build、浏览器或听感验收。',''];
writeFileSync(path.join(root,'game/assets/sfx/selected15-r2-1018/SOURCES.md'),sourceLines.join('\n'),'utf8');
console.log('Applied 15 selected changes: 6 silent entry cues, 9 replaced cues, 8 new WAV assets; 91 other cue definitions preserved.');
