// Read-only Acorn + emitted R4 AST analysis; never imports Vite configuration or game modules.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const root=process.cwd();
const frozen='/workspace/shared/cloud-iteration-verification-r4-20261016/snapshot/搜打撤';
const require=createRequire(path.join(root,'package.json'));
const {parse}=require('acorn'); const {full}=require('acorn-walk');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const hash=b=>createHash('sha256').update(b).digest('hex');
const rel=f=>path.relative(root,f).replaceAll('\\','/');
const nodes=new Map();
for(const f of walk(path.join(root,'game/src')).filter(f=>f.endsWith('.js'))){
 const code=fs.readFileSync(f,'utf8'),ast=parse(code,{sourceType:'module',ecmaVersion:'latest'}),imports=[],dynamic=[];
 for(const n of ast.body)if(n.source?.value?.startsWith('.'))imports.push(path.resolve(path.dirname(f),n.source.value));
 full(ast,n=>{if(n.type==='ImportExpression'&&n.source.type==='Literal')dynamic.push(n.source.value)});
 nodes.set(f,{path:rel(f),bytes:Buffer.byteLength(code),gzip:gzipSync(code).length,sha256:hash(code),imports,dynamic});
}
const html=fs.readFileSync(path.join(root,'game/index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'');
const entries=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m=>path.resolve(root,'game',m[1]));
const reach=(cuts=[])=>{const seen=new Set();const visit=f=>{if(seen.has(f)||!nodes.has(f))return;seen.add(f);for(const d of nodes.get(f).imports)if(!cuts.some(([a,b])=>f.endsWith(a)&&d.endsWith(b)))visit(d)};entries.forEach(visit);return seen;};
const startup=reach();
const cut=c=>{const after=reach(c),saved=[...startup].filter(f=>!after.has(f)).map(f=>nodes.get(f));return{files:saved.map(({imports,dynamic,...n})=>n),bytes:saved.reduce((s,n)=>s+n.bytes,0),gzipSourceSum:saved.reduce((s,n)=>s+n.gzip,0)}};
const agentFiles=[...nodes.values()].filter(n=>n.path.startsWith('game/src/agent/')).map(n=>({...n,imports:n.imports.map(rel),eager:startup.has(path.join(root,n.path))}));
const sourceDeclarations={};
for(const basename of ['agent.runner.js','agent.policy.js','agent.llm.js','agent.data.js','agent.stats.js']){
 const file=path.join(root,'game/src/agent',basename),code=fs.readFileSync(file,'utf8'),ast=parse(code,{sourceType:'module',ecmaVersion:'latest'});
 sourceDeclarations[basename]=ast.body.flatMap(n=>{if(n.type==='ExportNamedDeclaration'&&n.declaration)n=n.declaration;if(n.type==='FunctionDeclaration')return[{name:n.id.name,start:n.start,end:n.end,bytes:Buffer.byteLength(code.slice(n.start,n.end)),gzip:gzipSync(code.slice(n.start,n.end)).length}];if(n.type==='VariableDeclaration')return n.declarations.filter(d=>d.id.type==='Identifier').map(d=>({name:d.id.name,start:d.start,end:d.end,bytes:Buffer.byteLength(code.slice(d.start,d.end)),gzip:gzipSync(code.slice(d.start,d.end)).length}));return[]});
}
const out=path.join(frozen,'desktop-app/game'),bundleFile=walk(path.join(out,'assets/js')).find(f=>/^index-.*\.js$/.test(path.basename(f)));
const bundle=fs.readFileSync(bundleFile,'utf8'),ast=parse(bundle,{sourceType:'module',ecmaVersion:'latest'});
let agentObject=null;
full(ast,n=>{if(n.type==='ObjectExpression'&&['observe','act','step','autoRun','waitSettle','stopRun','policies','recorder','stats'].every(k=>n.properties.some(p=>p.key?.name===k||p.key?.value===k)))agentObject=n});
const bindings={};for(const p of agentObject.properties){const key=p.key.name||p.key.value;if(p.value.type==='Identifier')bindings[key]=p.value.name;else if(p.value.type==='CallExpression'&&p.value.arguments[0]?.type==='ObjectExpression'){bindings[key]=Object.fromEntries(p.value.arguments[0].properties.map(x=>[x.key.name||x.key.value,x.value.name||x.value.type]))}}
const top=new Map();for(const n of ast.body){if(n.type==='FunctionDeclaration')top.set(n.id.name,n);if(n.type==='VariableDeclaration')for(const d of n.declarations)if(d.id.type==='Identifier')top.set(d.id.name,d);}
const flatBindings=Object.fromEntries(Object.entries(bindings).flatMap(([k,v])=>typeof v==='string'?[[k,v]]:Object.entries(v).map(([a,b])=>[`${k}.${a}`,b])));
const candidates=Object.fromEntries(Object.entries(flatBindings).filter(([,v])=>typeof v==='string').map(([key,name])=>{const n=top.get(name);if(!n)return[key,{name,found:false}];const code=bundle.slice(n.start,n.end);return[key,{name,type:n.type,start:n.start,end:n.end,bytes:Buffer.byteLength(code),gzip:gzipSync(code).length,ablationEntryGzipDelta:gzipSync(bundle).length-gzipSync(bundle.slice(0,n.start)+bundle.slice(n.end)).length,sha256:hash(code)}]}));
const groupedAblation={};
for(const [key,keys] of Object.entries({runnerAsync:['step','autoRun','waitSettle'],policies:['policies.greedy','policies.random','policies.strategic'],llmPublic:['llm.decide','llm.loadConfig','llm.saveConfig','llm.isEnabled']})){
 const spans=keys.map(k=>candidates[k]).filter(s=>s?.start!=null).sort((a,b)=>a.start-b.start);
 const fragments=spans.map(s=>bundle.slice(s.start,s.end));let stripped=bundle;for(const s of [...spans].reverse())stripped=stripped.slice(0,s.start)+stripped.slice(s.end);
 groupedAblation[key]={keys,emittedBytes:fragments.reduce((s,v)=>s+Buffer.byteLength(v),0),concatenatedGzip:gzipSync(fragments.join('')).length,ablationEntryGzipDelta:gzipSync(bundle).length-gzipSync(stripped).length};
}
const dependencyPaths={}; const allParents=new Map();for(const [f,n]of nodes)for(const d of n.imports){if(!allParents.has(d))allParents.set(d,[]);allParents.get(d).push(f)};
for(const file of ['agent.js','agent.runner.js','agent.policy.js','agent.console.js','agent.recorder.js','agent.data.js']){const f=path.join(root,'game/src/agent',file);dependencyPaths[file]=(allParents.get(f)||[]).map(rel);}
const result={createdAt:new Date().toISOString(),method:'Acorn static ESM graph and frozen R4 emitted AST. Gzip ablation is a diagnostic counterfactual, not a rebuild result. Removing spans leaves invalid/unresolved references and must not be shipped.',root,frozen,bundle:{path:bundleFile,bytes:Buffer.byteLength(bundle),gzip:gzipSync(bundle).length,sha256:hash(bundle)},entries:entries.map(rel),startupModules:startup.size,largestStartup:[...startup].map(f=>nodes.get(f)).sort((a,b)=>b.bytes-a.bytes).map(({imports,dynamic,...n})=>n),agentFiles,dependencyPaths,cuts:{commDemo:cut([['game/src/ui/transitions-director.js','game/src/ui/comm-feed.js']]),labEnding:cut([['game/src/run/game.nest.js','game/src/run/lab.ending.js']]),bootAgent:cut([['game/src/game.boot.js','game/src/agent/agent.js']]),runnerOnly:cut([['game/src/agent/agent.js','game/src/agent/agent.runner.js']]),policyBothPaths:cut([['game/src/agent/agent.js','game/src/agent/agent.policy.js'],['game/src/agent/agent.llm.js','game/src/agent/agent.policy.js']])},sourceDeclarations,emitted:{bindings,candidates,groupedAblation}};
console.log(JSON.stringify(result,null,2));
