// Read-only source analysis; no Vite config import, build, source rewrite or browser.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
const root = process.cwd();
const require = createRequire(path.join(root, 'package.json'));
const { parse } = require('acorn');
const { full } = require('acorn-walk');
const walk = dir => fs.readdirSync(dir,{withFileTypes:true}).flatMap(e => e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
const rel = f => path.relative(root,f).replaceAll('\\','/');
const files = walk(path.join(root,'game/src')).filter(f=>f.endsWith('.js'));
const nodes = new Map();
for(const file of files){
 const body=fs.readFileSync(file), code=body.toString('utf8'), imports=[], dynamic=[], packages=[];
 const ast=parse(code,{ecmaVersion:'latest',sourceType:'module'});
 for(const n of ast.body) if(['ImportDeclaration','ExportAllDeclaration','ExportNamedDeclaration'].includes(n.type)&&n.source){
   if(n.source.value.startsWith('.')) imports.push(path.resolve(path.dirname(file),n.source.value)); else packages.push(n.source.value);
 }
 full(ast,n=>{if(n.type==='ImportExpression'&&n.source.type==='Literal')dynamic.push(n.source.value);});
 nodes.set(file,{path:rel(file),bytes:body.length,gzipSourceBytes:gzipSync(body).length,imports,dynamic,packages,sha256:createHash('sha256').update(body).digest('hex')});
}
const html = fs.readFileSync(path.join(root,'game/index.html'),'utf8').replace(/<!--[\s\S]*?-->/g,'');
const entries=[...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)].map(m=>path.resolve(root,'game',m[1]));
function reach(cuts=[]){ const seen=new Set(); function visit(f){if(seen.has(f)||!nodes.has(f))return;seen.add(f);for(const x of nodes.get(f).imports) if(!cuts.some(([a,b])=>f.endsWith(a)&&x.endsWith(b)))visit(x);}entries.forEach(visit);return seen; }
const startup=reach();
const metric=set=>({count:set.size,bytes:[...set].reduce((a,f)=>a+nodes.get(f).bytes,0),gzipSourceBytes:[...set].reduce((a,f)=>a+nodes.get(f).gzipSourceBytes,0)});
const cuts=[
 ['boot-agent', [['game/src/game.boot.js','game/src/agent/agent.js']]],
 ['agent-policy', [['game/src/agent/agent.js','game/src/agent/agent.policy.js']]],
 ['agent-data', [['game/src/agent/agent.js','game/src/agent/agent.data.js'],['game/src/run/game.session.js','game/src/agent/agent.data.js']]],
 ['hub-depart', [['game/src/hub/game.hub.js','game/src/hub/game.hub.depart.js']]],
];
const cutResults=cuts.map(([name,c])=>{const after=reach(c),saved=new Set([...startup].filter(x=>!after.has(x)));return{name,cuts:c,...metric(saved),files:[...saved].map(f=>nodes.get(f).path)}});
const cssSources=walk(path.join(root,'game/css')).filter(f=>f.endsWith('.css'));
const cssImportRE=/@import\s+(?:url\(\s*)?["']([^"']+)["']/g;
const cssNodes=new Map(cssSources.map(file=>{const body=fs.readFileSync(file),code=body.toString('utf8');return[file,{path:rel(file),bytes:body.length,gzipSourceBytes:gzipSync(body).length,imports:[...code.matchAll(cssImportRE)].map(m=>path.resolve(path.dirname(file),m[1]))}]}));
const cssRoots=[...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*>/g)].map(m=>path.resolve(root,'game',m[1]));
for(const f of startup)for(const x of nodes.get(f).imports)if(x.endsWith('.css'))cssRoots.push(x);
const cssStartup=new Set();function cssVisit(f){if(cssStartup.has(f)||!cssNodes.has(f))return;cssStartup.add(f);cssNodes.get(f).imports.forEach(cssVisit);}cssRoots.forEach(cssVisit);
const assetRoot=path.join(root,'game/assets');
const assetFiles=walk(assetRoot);
const group=new Map();for(const f of assetFiles){const body=fs.readFileSync(f),hash=createHash('sha256').update(body).digest('hex');if(!group.has(hash))group.set(hash,{bytes:body.length,sha256:hash,files:[]});group.get(hash).files.push(path.relative(assetRoot,f).replaceAll('\\','/'));}
const {collectVerifiedRuntimeAssetAliases}=await import(path.join(root,'scripts/runtime-asset-aliases.mjs'));
const {collectReviewedRuntimeAssetExclusions}=await import(path.join(root,'scripts/runtime-asset-redundancy.mjs'));
const {collectUnreferencedDevelopmentSfxPrefixes}=await import(path.join(root,'scripts/runtime-asset-publication.mjs'));
const aliases=collectVerifiedRuntimeAssetAliases(assetRoot), exclusions=collectReviewedRuntimeAssetExclusions(root);
const allReach=new Set();function allVisit(f){if(allReach.has(f)||!nodes.has(f))return;allReach.add(f);const n=nodes.get(f);n.imports.forEach(allVisit);for(const s of n.dynamic)if(s.startsWith('.'))allVisit(path.resolve(path.dirname(f),s));}entries.forEach(allVisit);
const developmentSfx=collectUnreferencedDevelopmentSfxPrefixes([...allReach].map(f=>({id:f,code:fs.readFileSync(f,'utf8')})),assetRoot);
const publishDirs=['cards/','portraits/','icons/','scenes/','thumbs/','ui/icons/','sfx/'];
const omitted=f=>aliases.has(f)||exclusions.excludedAssets.has(f)||[...developmentSfx].some(p=>f.startsWith(p));
const copyAssets=assetFiles.map(f=>({path:path.relative(assetRoot,f).replaceAll('\\','/'),bytes:fs.statSync(f).size})).filter(a=>publishDirs.some(p=>a.path.startsWith(p))&&!omitted(a.path));
const dirStats=new Map();for(const a of copyAssets){const p=a.path.split('/').slice(0,3).join('/');const s=dirStats.get(p)||{path:p,bytes:0,count:0};s.bytes+=a.bytes;s.count++;dirStats.set(p,s);}
const duplicates=[...group.values()].filter(g=>g.files.length>1).map(g=>({...g,duplicateBytes:g.bytes*(g.files.length-1),likelyCopied:g.files.filter(f=>publishDirs.some(p=>f.startsWith(p))&&!omitted(f))})).sort((a,b)=>b.duplicateBytes-a.duplicateBytes);
const result={analyzedAt:new Date().toISOString(),method:'Acorn static ESM reachability plus source gzip. No bundler/tree-shaking; source gzip is a ranking signal, not predicted build savings. Runtime copy simulation follows reviewed exclusions/aliases and development SFX read-only helpers; emitted static asset references not simulated.',entries:entries.map(rel),startup:metric(startup),largestStartup:[...startup].map(f=>nodes.get(f)).sort((a,b)=>b.bytes-a.bytes).slice(0,65).map(({imports,...n})=>n),startupPackages:[...new Set([...startup].flatMap(f=>nodes.get(f).packages))],cutResults,css:{initialHTMLRoots:cssRoots.filter(f=>!cssRoots.slice(0,cssRoots.indexOf(f)).includes(f)).map(rel),startupFiles:cssStartup.size,startupBytes:[...cssStartup].reduce((a,f)=>a+cssNodes.get(f).bytes,0),startupSourceGzipBytes:[...cssStartup].reduce((a,f)=>a+cssNodes.get(f).gzipSourceBytes,0),largest:[...cssStartup].map(f=>cssNodes.get(f)).sort((a,b)=>b.bytes-a.bytes).map(({imports,...n})=>n),allSourceCSSCount:cssNodes.size},runtimePublication:{reviewedExcludedCount:exclusions.excludedAssets.size,reviewWarnings:exclusions.warnings,aliasCount:aliases.size,developmentSfxExcluded:[...developmentSfx],copiedAssetCount:copyAssets.length,copiedSourceBytes:copyAssets.reduce((a,f)=>a+f.bytes,0),largestCopied:copyAssets.sort((a,b)=>b.bytes-a.bytes).slice(0,45),directories:[...dirStats.values()].sort((a,b)=>b.bytes-a.bytes)},sourceDuplicates:duplicates};
process.stdout.write(JSON.stringify(result,null,2)+'\n');
