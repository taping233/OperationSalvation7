import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,'../../../..');
const snapshot='/workspace/shared/cloud-iteration-verification-r5-20261016/snapshot/搜打撤';
const out=path.join(snapshot,'desktop-app/game/assets');
const req=createRequire(path.join(root,'package.json'));
const postcss=req('postcss');
const {transform}=req('esbuild');
const old=JSON.parse(fs.readFileSync(path.join(here,'../measurements.json'),'utf8'));
const sha=s=>createHash('sha256').update(s).digest('hex');
const gzip=s=>gzipSync(s).length;
const min=async s=>(await transform(s,{loader:'css',charset:'utf8',target:['chrome87','edge88','firefox78','safari14'],minify:true,legalComments:'inline'})).code;
const norm=s=>s.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/g,'url(ASSET)').replace(/;}/g,'}');
const initialCss=old.initialCss;
function expand(f,trail=[]){if(trail.includes(f))throw Error('cycle');const ast=postcss.parse(fs.readFileSync(path.join(snapshot,f),'utf8'));ast.walkAtRules('import',n=>{const m=n.params.match(/^(?:url\(\s*)?['"]?(\.\.?\/[^'"\s)]+)['"]?\s*\)?$/);if(!m)throw Error(n.params);n.replaceWith(postcss.parse(expand(path.posix.normalize(path.posix.join(path.posix.dirname(f),m[1])),[...trail,f])).nodes);});return ast.toString();}
const files=fs.readdirSync(out).filter(f=>f.endsWith('.css')).sort();
const data=files.map(file=>{const text=fs.readFileSync(path.join(out,file),'utf8');return{file,text,bytes:Buffer.byteLength(text),gzip:gzip(text),sha256:sha(text),ast:postcss.parse(text)};});
const index=data.find(f=>f.file.startsWith('index-'));
const builtKeys=index.ast.nodes.map(n=>norm(n.toString()));
const mappings=[];
for(const file of initialCss){const text=await min(expand(file));const nodes=postcss.parse(text).nodes;const keys=nodes.map(n=>norm(n.toString()));if(!keys.length){mappings.push({file,rules:0});continue;}const hits=[];for(let i=0;i<=builtKeys.length-keys.length;i++)if(keys.every((k,j)=>k===builtKeys[i+j]))hits.push(i);if(hits.length===1)mappings.push({file,rules:keys.length,start:index.ast.nodes[hits[0]].source.start.offset,end:index.ast.nodes[hits[0]+keys.length-1].source.end.offset});else mappings.push({file,rules:keys.length,hits:hits.length});}
const owner=n=>mappings.find(m=>m.start<=n.source.start.offset&&m.end>=n.source.end.offset)?.file||'unmapped';
const context=r=>{const keys=[];for(let p=r.parent;p&&p.type!=='root';p=p.parent){if(p.type!=='atrule'||!['media','supports','container','layer'].includes(p.name))return null;keys.unshift('@'+p.name+' '+p.params);}return keys.join(' / ');};
const getDecls=r=>(r.nodes||[]).filter(n=>n.type==='decl');
const item=(f,r,d,later)=>({file:f.file,source:f===index?owner(r):f.file,selector:r.selector,context:context(r),property:d.prop,value:d.value,important:!!d.important,offset:d.source.start.offset,laterValue:later.value,laterOffset:later.source.start.offset});
const controls=await Promise.all(data.map(async f=>({file:f.file,original:f.gzip,recompressed:gzip(await min(f.text))})));
const modes={exact:[],shadow:[],branchExact:[],branchShadow:[]};
const totals={};
for(const mode of Object.keys(modes)){
 let sum=0;const per=[];
 for(const f of data){const ast=f.ast.clone();const seen=new Map(),remove=[];const rules=[];ast.walkRules(r=>{if(context(r)!==null)rules.push(r);});
 for(const r of rules.reverse()){
  const c=context(r);const sel=r.selector;const decls=getDecls(r);
  for(const d of decls.reverse()){
   if(d.prop.startsWith('--')||d.prop==='all')continue;
   const sels=mode.startsWith('branch')?postcss.list.comma(sel):[sel];
   const matches=sels.map(s=>seen.get(JSON.stringify([c,s,d.prop,!!d.important])));
   const isShadow=mode.toLowerCase().includes('shadow');
   if(matches.every(l=>l&&(isShadow||l.value===d.value))){remove.push(d);modes[mode].push(item(f,r,d,matches[0]));}
   for(const s of sels){const key=JSON.stringify([c,s,d.prop,!!d.important]);if(!seen.has(key))seen.set(key,d);}
  }
 }
 for(const d of remove)d.remove();ast.walkRules(r=>{if(!r.nodes.length)r.remove();});const text=await min(ast.toString());sum+=gzip(text);per.push({file:f.file,before:f.gzip,after:gzip(text),saving:f.gzip-gzip(text),removed:remove.length});
 }
 totals[mode]={gzip:sum,savingVsOriginal:data.reduce((s,f)=>s+f.gzip,0)-sum,savingVsRecompressed:controls.reduce((s,f)=>s+f.recompressed,0)-sum,per};
}
// Strict adjacent blocks only, no regrouping across intervening cascade rules or conditions.
let adjacentTotal=0;const adjacent=[];
for(const f of data){const ast=f.ast.clone();const candidates=[];function merge(p){for(const n of p.nodes||[])if(n.type==='atrule')merge(n);let i=0;while(i<(p.nodes||[]).length-1){const a=p.nodes[i],b=p.nodes[i+1];if(a.type==='rule'&&b.type==='rule'&&context(a)!==null&&getDecls(a).length===a.nodes.length&&getDecls(b).length===b.nodes.length&&a.nodes.map(n=>n.toString()).join(';')===b.nodes.map(n=>n.toString()).join(';')){candidates.push({selectors:[a.selector,b.selector],source:f===index?owner(a):f.file,offset:a.source.start.offset,rawSaving:Buffer.byteLength(b.nodes.map(n=>n.toString()).join(';'))});a.selector+=','+b.selector;b.remove();}else i++;}}merge(ast);const text=await min(ast.toString());adjacentTotal+=gzip(text);adjacent.push({file:f.file,before:f.gzip,after:gzip(text),saving:f.gzip-gzip(text),candidates});}
const fingerprints=old.fingerprints.map(i=>i.file).filter(f=>fs.existsSync(path.join(root,f))&&fs.existsSync(path.join(snapshot,f))).map(file=>({file,currentSha:sha(fs.readFileSync(path.join(root,file))),snapshotSha:sha(fs.readFileSync(path.join(snapshot,file)))}));
const perSource=mode=>Object.entries(modes[mode].reduce((a,r)=>{const k=r.source;const v=a[k]||{declarations:0,rawBytes:0};v.declarations++;v.rawBytes+=Buffer.byteLength(r.property+':'+r.value+(r.important?'!important':'')+';');a[k]=v;return a;},{})).sort((a,b)=>b[1].rawBytes-a[1].rawBytes);
const blockInventory=[];index.ast.walkRules(r=>{if(context(r)===null)return;const body=r.nodes.map(n=>n.toString()).join(';');blockInventory.push({body,selector:r.selector,source:owner(r),context:context(r),offset:r.source.start.offset});});
const grouped=new Map();for(const r of blockInventory){const k=JSON.stringify([r.context,r.body]);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(r);}
const repeatBlocks=[...grouped.values()].filter(x=>x.length>1).map(x=>({count:x.length,body:x[0].body,rawUpperBound:Buffer.byteLength(x[0].body)*(x.length-1),rules:x.map(({body,...rest})=>rest)})).sort((a,b)=>b.rawUpperBound-a.rawUpperBound);
const summary={method:'Read-only PostCSS parse and in-memory esbuild transforms of retained R5 output. No build or production edit. Shadow mode is an upper bound, not approved deletion.',checkedAt:new Date().toISOString(),snapshot,node:process.version,esbuild:req('esbuild/package.json').version,baseline:{files:data.map(({ast,text,...rest})=>rest),gzip:data.reduce((s,f)=>s+f.gzip,0),budget:136*1024,gap:data.reduce((s,f)=>s+f.gzip,0)-136*1024},controls,mappings,sourceFingerprintMismatches:fingerprints.filter(f=>f.currentSha!==f.snapshotSha),totals,adjacent:{gzip:adjacentTotal,saving:data.reduce((s,f)=>s+f.gzip,0)-adjacentTotal,per:adjacent},perSource:Object.fromEntries(Object.keys(modes).map(k=>[k,perSource(k)])),declarations:modes,repeatBlocks};
fs.writeFileSync(path.join(here,'measurements.json'),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({baseline:summary.baseline,unmapped:mappings.filter(f=>f.hits!==undefined),sourceMismatch:summary.sourceFingerprintMismatches,totals,adjacentSaving:summary.adjacent.saving,topExact:summary.perSource.exact.slice(0,15),topShadow:summary.perSource.shadow.slice(0,15),repeatBlocks:repeatBlocks.slice(0,8)},null,2));
