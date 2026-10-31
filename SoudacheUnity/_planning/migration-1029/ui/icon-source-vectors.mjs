import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
const game=fileURLToPath(new URL('../../../../搜打撤/game/',import.meta.url));
const {Icons}=await import(pathToFileURL(game+'src/core/icons-bitmap.js').href);
const source=readFileSync(game+'src/core/icons-bitmap.js','utf8');
const inputs=[...Icons.NAMES].map(key=>'[[icon:'+key+']]');
for(const match of source.matchAll(/add\('([^']+)',\[([^\]]+)\]\)/g))for(const code of match[2].split(','))inputs.push(String.fromCodePoint(Number(code)));
inputs.push('生命 [[icon:heart]] 20 · [[icon:coin]] 30','<b>卡牌 [[icon:cards]]</b>\n<color=red>危险 [[icon:skull]]</color>',
 '<size=32>[[icon:shield]]护甲</size> [[icon:bolt]]','A<color=red>[[icon:archive]]</color>B','🦄','[[icon:unregistered]]','没有图标','');
const vectors=inputs.map(input=>({input,keys:[...Icons.rich(input).matchAll(/data-asset-key="icon-([a-z-]+)"/g)].map(match=>match[1])}));
const sources=Object.fromEntries([...Icons.NAMES].map(key=>[key,Icons.url(key).split('?')[0].replace(/^assets\//,'')]));
writeFileSync(new URL('icon-source-vectors.json',import.meta.url),JSON.stringify({sources,vectors},null,2));
console.log(JSON.stringify({registered:Icons.NAMES.size,vectors:vectors.length}));
