import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root = path.dirname(fileURLToPath(import.meta.url));
const refs = JSON.parse(await fs.readFile(path.join(root,'sources.json'),'utf8'));
await fs.mkdir(path.join(root,'images'),{recursive:true});
let failed = false;
for (let i=0;i<refs.length;i+=4) {
 const batch = await Promise.allSettled(refs.slice(i,i+4).map(async r=>{
  const response = await fetch(r.url,{headers:{'User-Agent':'Mozilla/5.0'},signal:AbortSignal.timeout(45000)});
  if(!response.ok) throw new Error(`${r.id}: HTTP ${response.status}`);
  const mime = response.headers.get('content-type') || '';
  if(!mime.startsWith('image/')) throw new Error(`${r.id}: unexpected ${mime}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const ext=mime.includes('png')?'png':mime.includes('webp')?'webp':'jpg';
  r.file=`images/${r.id}.${ext}`; r.bytes=bytes.length; r.sha256=createHash('sha256').update(bytes).digest('hex'); r.mime=mime; r.acquired='2026-10-12；公开页面/图片搜索核对的截图地址，原始字节下载；未裁切未重绘';
  await fs.writeFile(path.join(root,r.file),bytes);
  return {id:r.id,bytes:r.bytes,file:r.file};
 }));
 for(const result of batch){if(result.status==='rejected'){failed=true;console.error(String(result.reason));}else console.log(JSON.stringify(result.value));}
}
await fs.writeFile(path.join(root,'sources.json'),JSON.stringify(refs,null,2)+'\n');
if(failed) process.exitCode=1;
