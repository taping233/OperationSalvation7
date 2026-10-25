import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd(),cache=path.join(root,'node_modules/.cache/lean-collections-1024/before');
export default {plugins:[{name:'collection-before',
  resolveId(id){if(id.startsWith('collection-before:'))return '\0'+id;},
  load(id){
    if(!id.startsWith('\0collection-before:'))return;
    const file=id.slice('\0collection-before:'.length);
    return fs.readFileSync(path.join(cache,file),'utf8').replace(/(['"])(\.{1,2}\/[^'"]+)\1/g,(match,quote,relative)=>{
      const absolute=path.resolve(path.dirname(path.join(root,file)),relative),next=path.relative(root,absolute).replaceAll('\\','/');
      return JSON.stringify(fs.existsSync(path.join(cache,next)) ? 'collection-before:'+next : absolute.replaceAll('\\','/'));
    });
  },
}],test:{root,environment:'jsdom',maxWorkers:1,minWorkers:1,include:['docs/evidence/2026-10-24-WF-code-lean-stage1-1024/refactor/collections/*.vitest.js']}};
