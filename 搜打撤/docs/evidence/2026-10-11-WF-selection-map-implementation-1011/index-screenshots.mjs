import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
function jpegSize(bytes){
  if(bytes[0]!==0xff||bytes[1]!==0xd8)throw new Error('Not JPEG');
  let at=2;
  while(at<bytes.length){
    if(bytes[at]!==0xff){at++;continue;}
    while(bytes[at]===0xff)at++;
    const marker=bytes[at++];
    if(marker===0xd9||marker===0xda)break;
    if(marker===0x01||(marker>=0xd0&&marker<=0xd8))continue;
    const n=bytes.readUInt16BE(at);
    if([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker))return{width:bytes.readUInt16BE(at+5),height:bytes.readUInt16BE(at+3)};
    at+=n;
  }
  throw new Error('No JPEG dimensions');
}
const frames=readdirSync(path.join(here,'current-window')).filter(name=>name.endsWith('.jpg')).sort().map(name=>{
  const absolute=path.join(here,'current-window',name),bytes=readFileSync(absolute);
  const transient=['03-preparation.jpg','11-map-fixed.jpg'].includes(name);
  return{file:name,encoding:'JPEG',...jpegSize(bytes),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),capturedAtFileMtime:statSync(absolute).mtime.toISOString(),surface:'Codex IAB current-window',transient,viewportOverride:false};
});
writeFileSync(path.join(here,'current-window','screenshots.json'),JSON.stringify({schemaVersion:1,description:'逐张记录实际输出尺寸；窗口在app布局过程中自然改变，无viewport覆盖。截图mtime仅为落盘时间。01为主线初验，其余为5337隔离副本。临时转场不作为稳定通过证据。',frames},null,2)+'\n');
console.log(JSON.stringify({frames:frames.length,over1MB:frames.filter(f=>f.bytes>1048576).map(f=>f.file)}));
