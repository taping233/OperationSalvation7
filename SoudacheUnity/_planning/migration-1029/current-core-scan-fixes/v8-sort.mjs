import fs from 'node:fs';
import crypto from 'node:crypto';
import {SeededRandomService} from '../../../../搜打撤/game/src/core/random-service.js';
const pool=['bleed','poison','freeze','silence','abreak','healban'];
const vectors=[];
for(let seed=0;seed<10000;seed++){
 const a=new SeededRandomService(seed),b=new SeededRandomService(seed);const trace=[],trace2=[];
 const actual=[...pool].sort((x,y)=>{const value=a.random('battle','generation')-.5;trace.push([x,y,value]);return value});
 const result=[...pool];const cmp=(x,y)=>{const value=b.random('battle','generation')-.5;trace2.push([x,y,value]);return value};
 let run=2;const descending=cmp(result[1],result[0])<0;
 while(run<result.length){const less=cmp(result[run],result[run-1])<0;if(descending?!less:less)break;run++}
 if(descending)result.splice(0,run,...result.slice(0,run).reverse());
 for(let start=run;start<result.length;start++){const pivot=result[start];let left=0,right=start;while(left<right){const mid=left+Math.floor((right-left)/2);if(cmp(pivot,result[mid])<0)right=mid;else left=mid+1;}for(let i=start;i>left;i--)result[i]=result[i-1];result[left]=pivot;}
 if(JSON.stringify(actual)!==JSON.stringify(result)||JSON.stringify(trace)!==JSON.stringify(trace2))throw Error('sort divergence seed '+seed);
 vectors.push({seed,actual,trace,rng:a.snapshot()});
}
const digest=crypto.createHash('sha256').update(vectors.map(v=>`${v.seed}|${v.actual.join(',')}|${v.rng.streams.generation}\n`).join('')).digest('hex');
fs.writeFileSync('v8-sort-vectors.json',JSON.stringify({node:process.version,v8:process.versions.v8,verified:vectors.length,digest,vectors:vectors.filter(v=>[0,1,2,123,999].includes(v.seed))},null,2));
console.log('10000 V8 exact comparator traces verified');
