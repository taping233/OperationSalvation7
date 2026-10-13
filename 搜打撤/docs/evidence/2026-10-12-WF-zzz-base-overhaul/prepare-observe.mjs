import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const evidence=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(evidence,'../../..');
const snapshot=path.join(repo,'.tmp','zzz-base-observe-1012');
const game=path.join(repo,'game');
await fs.mkdir(snapshot,{recursive:true});
await fs.cp(game,path.join(snapshot,'game'),{recursive:true,filter:source=>{
 const relative=path.relative(game,source).split(path.sep).join('/');
 return !['art-source','tools'].some(dir=>relative===dir||relative.startsWith(dir+'/'));
}});
await fs.writeFile(path.join(snapshot,'server.mjs'),`import {createServer} from 'vite';\nimport path from 'node:path';\nimport {fileURLToPath} from 'node:url';\nconst root=path.dirname(fileURLToPath(import.meta.url));\nconst server=await createServer({configFile:false,root:path.join(root,'game'),server:{host:'127.0.0.1',port:5335,strictPort:true,fs:{allow:[root,path.resolve(root,'../../node_modules')]}},logLevel:'warn'});\nawait server.listen();console.log(JSON.stringify({pid:process.pid,port:5335,root,source:'只复制game运行文件；独立origin；不运行主配置及build'}));\n`);
console.log(JSON.stringify({snapshot,root:path.join(snapshot,'game'),port:5335}));
