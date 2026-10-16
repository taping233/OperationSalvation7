import fs from 'node:fs';import path from 'node:path';import {createRequire}from'node:module';import{gzipSync}from'node:zlib';import{createHash}from'node:crypto';
const root=process.cwd(),require=createRequire(path.join(root,'package.json')),{parse}=require('acorn'),{full}=require('acorn-walk');
const bundleFile='/workspace/shared/cloud-iteration-verification-r4-20261016/snapshot/搜打撤/desktop-app/game/assets/js/index-BGYbVOUG.js';
const code=fs.readFileSync(bundleFile,'utf8'),ast=parse(code,{sourceType:'module',ecmaVersion:'latest'});
function decls(ast){return ast.body.flatMap(s=>{if(s.type==='ExportNamedDeclaration')s=s.declaration;if(!s)return[];if(s.type==='FunctionDeclaration')return[{name:s.id.name,node:s}];if(s.type==='VariableDeclaration')return s.declarations.map(n=>({name:n.id.name,node:n}));return[]})}
function literals(n){const out=new Set();full(n,n=>{if(n.type==='Literal'&&typeof n.value==='string'&&n.value.length>=8)out.add(n.value);if(n.type==='TemplateElement'&&n.value.cooked?.length>=8)out.add(n.value.cooked);});return[...out]}
const targetDecls=decls(ast).map(d=>({...d,literals:literals(d.node)}));
const groups={};
for(const file of ['game/src/ui/comm-feed.js','game/src/cards/card-description-text.js','game/src/run/lab.ending.js']){
 const source=fs.readFileSync(file,'utf8'),sourceAst=parse(source,{sourceType:'module',ecmaVersion:'latest'}),symbols=[];
 for(const sourceDecl of decls(sourceAst)){
  const anchors=literals(sourceDecl.node).sort((a,b)=>b.length-a.length);let matched=null;
  for(const anchor of anchors){const candidates=targetDecls.filter(d=>d.literals.includes(anchor));if(candidates.length===1){matched={name:sourceDecl.name,anchor,emittedName:candidates[0].name,node:candidates[0].node};break}}
  if(matched)symbols.push(matched);
 }
 const unique=[...new Map(symbols.map(s=>[s.node.start,s])).values()].sort((a,b)=>a.node.start-b.node.start);
 let stripped=code;for(const s of [...unique].reverse())stripped=stripped.slice(0,s.node.start)+stripped.slice(s.node.end);
 groups[file]={sourceBytes:Buffer.byteLength(source),sourceGzip:gzipSync(source).length,sha256:createHash('sha256').update(source).digest('hex'),symbols:symbols.map(({node,...s})=>({...s,start:node.start,end:node.end,bytes:Buffer.byteLength(code.slice(node.start,node.end)),gzip:gzipSync(code.slice(node.start,node.end)).length})),emittedBytes:unique.reduce((sum,s)=>sum+Buffer.byteLength(code.slice(s.node.start,s.node.end)),0),ablationEntryGzipDelta:gzipSync(code).length-gzipSync(stripped).length,concatenatedGzip:gzipSync(unique.map(s=>code.slice(s.node.start,s.node.end)).join('')).length};
}
console.log(JSON.stringify({method:'Unique literal anchors map source top-level declarations to frozen R4 emitted declarations. Only mapped spans are counted. Gzip ablation is diagnostic, not a production rebuild.',bundleFile,groups},null,2));
