import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {writeFileSync} from 'node:fs';
const root=dirname(fileURLToPath(import.meta.url));
const evidence=fileURLToPath(new URL('../../../../docs/evidence/2026-10-05-WF-wu-parts-full/',import.meta.url));
function saveRoute(server,route,directory,pattern,signature){
 server.middlewares.use(route,(req,res)=>{
  const name=new URL(req.url,'http://127.0.0.1').searchParams.get('name');
  if(req.method!=='POST'||!pattern.test(name||'')){res.statusCode=400;res.end('invalid');return;}
  const chunks=[];let bytes=0;
  req.on('data',chunk=>{bytes+=chunk.length;if(bytes>10*1024*1024){req.destroy();return;}chunks.push(chunk);});
  req.on('end',()=>{const buffer=Buffer.concat(chunks);if(!signature(buffer)){res.statusCode=400;res.end('bad format');return;}writeFileSync(join(directory,name),buffer);res.end('saved');});
 });
}
export default defineConfig({root,publicDir:false,server:{host:'127.0.0.1',port:5348,strictPort:true},plugins:[{name:'save-own-rig-evidence',configureServer(server){
 saveRoute(server,'/save-frame',root,/^render-(static|idle|attack|hit)-\d{3}(-(light|dark|checker|transparent))?\.png$/,b=>b.length>=8&&b.readUInt32BE(0)===0x89504e47);
 saveRoute(server,'/save-proof',evidence,/^browser-(static|idle|attack|hit)-\d{3}\.(jpg|png)$/,b=>b.length>=3&&((b[0]===255&&b[1]===216&&b[2]===255)||(b.length>=8&&b.readUInt32BE(0)===0x89504e47)));
}}]});
