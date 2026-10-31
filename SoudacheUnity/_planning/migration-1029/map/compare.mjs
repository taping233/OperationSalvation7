import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const {generateExplorationMap}=await import(pathToFileURL(path.resolve(import.meta.dirname,'../../../../搜打撤/game/src/run/map-generator-v7.js')));
let failed=0;const checked=[];
for(const seed of process.argv.slice(2).length?process.argv.slice(2):['0','1','42','1029']){
 checked.push(seed);
 const cs=JSON.parse(fs.readFileSync(path.join(import.meta.dirname,'bin/Debug/net8.0',seed+'.json'),'utf8'));
 const js=generateExplorationMap(seed);
 const normalize=m=>m.layers.map(l=>({entry:l.entry,exit:l.exit,nodes:l.nodes.map(n=>[n.id,n.idx,n.x,n.row,n.type,n.name,n.next.map(e=>Array.isArray(e)?e:[e.li,e.idx])]),doors:l.doors.map(d=>[d.pair,d.at,d.toLayer,d.arriveAt,d.exit])}));
 const a=JSON.stringify(normalize(cs)),b=JSON.stringify(normalize(js));
 if(a!==b){failed++;fs.writeFileSync(path.join(import.meta.dirname,seed+'-expected.json'),JSON.stringify(js,null,2));console.log(seed+': mismatch');} else console.log(seed+': identical');
}
fs.writeFileSync(path.join(import.meta.dirname,'comparison-result.json'),JSON.stringify({passed:failed===0,seeds:checked,matched:checked.length-failed,failed,scope:'entry/exit; ordered id/index/x/row/type/name/next; doors'},null,2));
process.exitCode=failed?1:0;
