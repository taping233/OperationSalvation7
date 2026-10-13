import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const project = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const target = path.join(project, '.tmp', 'WF-battle-ui-runtime');
const relative = path.relative(project, target);
if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('preview path outside project');
fs.mkdirSync(path.join(target, 'game'), { recursive: true });
for (const name of ['src', 'css', 'data']) {
  fs.cpSync(path.join(project, 'game', name), path.join(target, 'game', name), { recursive: true });
}
for (const name of ['index.html', 'version.json']) {
  fs.copyFileSync(path.join(project, 'game', name), path.join(target, 'game', name));
}
let linked = 0;
function linkAssets(source, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const a = path.join(source, entry.name), b = path.join(dest, entry.name);
    if (entry.isDirectory()) linkAssets(a, b);
    else if (entry.isFile() && !fs.existsSync(b)) { fs.linkSync(a, b); linked++; }
  }
}
linkAssets(path.join(project, 'game/assets'), path.join(target, 'game/assets'));
fs.writeFileSync(path.join(target, 'package.json'), JSON.stringify({type:'module',private:true}));
fs.writeFileSync(path.join(target, 'serve.mjs'), `import {createServer} from ${JSON.stringify(pathToFileURL(path.join(project, 'node_modules/vite/dist/node/index.js')).href)};\nconst server=await createServer({configFile:false,root:${JSON.stringify(path.join(target, 'game').split(path.sep).join('/'))},cacheDir:${JSON.stringify(path.join(project, 'node_modules/.cache/WF-battle-vite').split(path.sep).join('/'))},server:{host:'127.0.0.1',port:5346,strictPort:true,fs:{allow:[${JSON.stringify(project.split(path.sep).join('/'))}]}}});\nawait server.listen();server.printUrls();\n`);
fs.writeFileSync(path.join(target, 'snapshot.json'), JSON.stringify({source:project,target,port:5346,preparedAt:new Date().toISOString(),linkedAssets:linked,note:'源码与样式独立复制；素材只读硬链接；不用主线HMR、不运行build或编译'},null,2));
console.log(JSON.stringify({target,linkedAssets:linked}));
