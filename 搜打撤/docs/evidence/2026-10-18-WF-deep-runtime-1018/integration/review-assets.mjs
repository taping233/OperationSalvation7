import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {parse} from 'acorn';
import {full} from 'acorn-walk';
const head='a3df7fabb1b6075d5197eae30be3f17c01031ecb';
const files=['game/src/core/renderer.js','game/src/battle/view/battle.layers.js','game/src/audio/sound.js'];
const normalize=text=>text.replaceAll('\r\n','\n'),hash=text=>createHash('sha256').update(text).digest('hex');
function footprint(text){
  const result=[];
  full(parse(text,{ecmaVersion:'latest',sourceType:'module'}),node=>{
    if(node.type==='ImportDeclaration'||node.type==='NewExpression'&&node.callee.name==='URL'
      ||node.type==='CallExpression'&&(node.callee.name==='assetUrl'||['glob','decodeIn','collectCardAssets','cardHTML'].includes(node.callee.property?.name))
      ||node.type==='FunctionDeclaration'&&node.id?.name==='assetUrl'
      ||node.type==='Literal'&&typeof node.value==='string'&&/(?:assets\/|\.(?:webp|png|jpg|wav|ogg|mp3|svg)(?:$|[?#]))/.test(node.value)
      ||node.type==='TemplateLiteral'&&node.quasis.some(q=>/(?:assets\/|\.(?:webp|png|jpg|wav|ogg|mp3|svg))/.test(q.value.raw)))result.push(text.slice(node.start,node.end));
  });
  return result;
}
const reviewPath='scripts/runtime-asset-redundancy-review.mjs';
let review=fs.readFileSync(reviewPath,'utf8');
const entries=[];
for(const file of files){
  const before=normalize(execFileSync('git',['show',`${head}:搜打撤/${file}`],{encoding:'utf8'}));
  const after=normalize(fs.readFileSync(file,'utf8'));
  if(JSON.stringify(footprint(before))!==JSON.stringify(footprint(after)))throw Error('Asset contract delta: '+file);
  const oldDigest=hash(before),newDigest=hash(after),needle=`"${file}": "${oldDigest}"`;
  if(oldDigest===newDigest||review.split(needle).length!==2)throw Error('Fingerprint baseline mismatch: '+file);
  review=review.replace(needle,`"${file}": "${newDigest}"`);
  entries.push({file,oldDigest,newDigest,assetContractEntries:footprint(after).length,
    review:'Full source delta reviewed: map endpoint-dependent cache invalidation; hand face versus reading hint DOM diff; muted/SFX-off input guard. Asset selector functions, URLs, imports, decode/card rendering inputs unchanged.'});
}
fs.writeFileSync(reviewPath,review);
fs.mkdirSync('docs/evidence/2026-10-18-WF-deep-runtime-1018/integration',{recursive:true});
fs.writeFileSync('docs/evidence/2026-10-18-WF-deep-runtime-1018/integration/asset-consumer-review.json',JSON.stringify({at:new Date().toISOString(),base:head,entries},null,2)+'\n');
console.log(JSON.stringify({entries}));
