import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const project=path.resolve(root,'../../..');
const sources=JSON.parse(await fs.readFile(path.join(root,'sources.json'),'utf8'));
const allowed=new Map(['reference-board.html','board.css','board.js','README.md','reference-notes.md','sources.json',...sources.map(s=>s.file)].map(f=>[f,path.join(root,f)]));
allowed.set('game/assets/portraits/full/wu.webp',path.join(project,'game/assets/portraits/full/wu.webp'));
allowed.set('game/assets/scenes/base-operations-v5.webp',path.join(project,'game/assets/scenes/base-operations-v5.webp'));
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.md':'text/plain; charset=utf-8','.jpg':'image/jpeg','.png':'image/png','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const pathname=decodeURIComponent(new URL(req.url,'http://127.0.0.1').pathname).replace(/^\//,'') || 'reference-board.html';
  const file=allowed.get(pathname);if(!file){res.writeHead(404);res.end('Not found');return;}
  const data=await fs.readFile(file);res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Content-Length':data.length,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self'; connect-src 'none'; frame-ancestors 'self'; base-uri 'none'"});res.end(req.method==='HEAD'?undefined:data);
 }catch{res.writeHead(500);res.end('Preview error');}
});
server.listen(5319,'127.0.0.1',()=>console.log(JSON.stringify({port:5319,pid:process.pid,root,mode:'只读白名单文件，限本机访问'})));
