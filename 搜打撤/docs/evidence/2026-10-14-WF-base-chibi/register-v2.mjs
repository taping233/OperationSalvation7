import { readFileSync,writeFileSync,statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const root=process.cwd(),sha=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const names=['setup','body-underpaint','legs-underpaint'];
const sources=names.map((name,index)=>({path:`game/art-source/characters/wu-chibi-v2-20261014/${index?'': 'setup-'}${index?name:'master'}.png`}));
for (const item of sources) { const absolute=resolve(root,item.path); item.bytes=statSync(absolute).size; item.sha256=sha(absolute); item.acquisition='本聊天Codex内置image_gen；本地原稿按.gitignore保留，不进Git'; }
const entries=names.map(name=>{const path=`chibi/wu-v2/${name}.webp`,absolute=resolve(root,'game/assets',path);return {path,ext:'webp',bytes:statSync(absolute).size,sha256:sha(absolute),license:'老板授权项目角色素材；Codex内置image_gen生成及透明无损编码',source:'docs/evidence/2026-10-14-WF-base-chibi/README.md'};});
const file=resolve(root,'game/assets/asset-manifest.json'),original=readFileSync(file,'utf8'),manifest=JSON.parse(original);
if (entries.some(item=>manifest.assets.some(old=>old.path===item.path))) throw new Error('v2素材已经登记，拒绝覆盖');
const marker='"assets": [',offset=original.indexOf(marker);
if(offset<0)throw new Error('清单结构缺失');
const inserted=entries.map(entry=>JSON.stringify(entry,null,2).split('\n').map(line=>'    '+line).join('\n')).join(',\n');
let next=original.slice(0,offset+marker.length)+'\n'+inserted+','+original.slice(offset+marker.length);
next=next.replace(`"count": ${manifest.count}`,`"count": ${manifest.assets.length+entries.length}`);
const check=JSON.parse(next);if(check.count!==check.assets.length)throw new Error('清单数量不一致');
writeFileSync(file,next);
writeFileSync(new URL('./v2-receipt.json',import.meta.url),JSON.stringify({sources,runtime:entries,canvas:[1024,1536],runtimeCanvas:[768,1152],channel:'Codex内置image_gen',reference:'game/assets/portraits/full/wu.webp',referenceSha256:sha(resolve(root,'game/assets/portraits/full/wu.webp'))},null,2)+'\n');
console.log('v2三张素材登记完成，原稿及参考哈希已记录。');
