import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url));
const source=JSON.parse(fs.readFileSync(path.join(dir,'current-catalog.json'),'utf8')).cards;
const compiled=JSON.parse(fs.readFileSync(path.join(dir,'compiled-catalog.json'),'utf8'));
const fields=['id','name','type','cost','rarity','dmg','dmgType','heal','armor','draw','infuse','desc','cls','hero','tokenOf','unrandom','rules'];
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const norm=(c,k)=>k==='unrandom'?!!c[k]:c[k]??null;
const differences=[];
for(const c of source){const actual=compiled.find(x=>x.id===c.id);if(!actual){differences.push({id:c.id,missing:true});continue;}for(const field of fields)if(JSON.stringify(canonical(norm(c,field)))!==JSON.stringify(canonical(norm(actual,field))))differences.push({id:c.id,field,source:c[field],compiled:actual[field]});}
const summary={sourceCount:source.length,compiledCount:compiled.length,fieldsPerCard:fields.length,structuredOperations:JSON.parse(fs.readFileSync(path.join(dir,'current-catalog-summary.json'),'utf8')).operations,differences};
fs.writeFileSync(path.join(dir,'catalog-comparison.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({source:source.length,compiled:compiled.length,fields:fields.length,differences}));
