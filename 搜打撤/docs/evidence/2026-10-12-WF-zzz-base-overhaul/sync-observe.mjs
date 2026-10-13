import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const evidence=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(evidence,'../../..');
const phase=process.argv[2] || 'round2';
if(!/^round[1-9]$/.test(phase))throw new Error('expected round1..round9');
const files=JSON.parse(await fs.readFile(path.join(evidence,'round1-source.json'),'utf8')).map(r=>r.path);
files.push('game/src/hub/hub.presentation.js');
const result=[];
for(const name of files){
 const bytes=await fs.readFile(path.join(repo,name));
 const target=path.join(repo,'.tmp/zzz-base-observe-1012',name);
 await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,bytes);
 result.push({path:name,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
await fs.writeFile(path.join(evidence,`${phase}-source.json`),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({phase,files:files.length,origin:'http://127.0.0.1:5335',sourceMatches:true}));
