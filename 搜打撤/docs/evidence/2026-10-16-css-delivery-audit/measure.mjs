import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readModuleSources, buildModuleGraph } from '../../../scripts/architecture-graph.mjs';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const req = createRequire(path.join(root, 'package.json'));
const postcss = req('postcss');
const { transform } = req('esbuild');
const snapshot = process.env.CSS_AUDIT_SNAPSHOT || '/workspace/shared/cloud-iteration-verification-r3-20261016/snapshot/搜打撤';
const output = path.join(snapshot, 'desktop-app/game');
const read = f => readFileSync(path.join(root, f), 'utf8');
const sha = x => createHash('sha256').update(x).digest('hex');
const stats = x => ({ bytes: Buffer.byteLength(x), gzip: gzipSync(x).length, sha256: sha(x) });
const sources = readModuleSources(path.join(root, 'game/src'));
const graph = buildModuleGraph(sources);
const html = read('game/index.html').replace(/<!--[\s\S]*?-->/g, '');
const roots = [...html.matchAll(/<script\b[^>]*type="module"[^>]*src="(?:\.\/)?src\/([^"?]+)"/g)].map(m => m[1]);
const initial = new Set(), complete = new Set();
function visit(id, set, dynamic) {
  if (set.has(id)) return;
  set.add(id);
  for (const dep of graph.get(id)?.dependencies || []) if (dynamic || dep.kind !== 'dynamic') visit(dep.target, set, dynamic);
}
roots.forEach(id => { visit(id, initial, false); visit(id, complete, true); });
const cssOwners = new Map();
for (const [id, node] of graph) for (const edge of node.imports) if (/\.css(?:$|\?)/.test(edge.specifier)) {
  const f = path.posix.normalize(path.posix.join('game/src', path.posix.dirname(id), edge.specifier.split(/[?#]/)[0]));
  if (!cssOwners.has(f)) cssOwners.set(f, []);
  cssOwners.get(f).push({ module: id, kind: edge.kind, line: edge.line, initial: initial.has(id), reachable: complete.has(id) });
}
const urls = [];
for (const [id, source] of sources) for (const m of source.matchAll(/new URL\(\s*['"]([^'"]+\.css)['"]\s*,\s*import\.meta\.url\s*\)/g)) {
  urls.push({ file: path.posix.normalize(path.posix.join('game/src', path.posix.dirname(id), m[1])), module: id, initial: initial.has(id), reachable: complete.has(id) });
}
const htmlCss = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"?]+)"/g)].map(m => 'game/' + m[1]);
const initialCss = [...new Set([...htmlCss, ...[...cssOwners].filter(([, owners]) => owners.some(o => o.initial)).map(([f]) => f)])];
const allCss = [...new Set([...initialCss, ...[...cssOwners].filter(([, owners]) => owners.some(o => o.reachable)).map(([f]) => f), ...urls.filter(o => o.reachable).map(o => o.file)])];
const expansions = new Map();
function expand(f, trail = []) {
  if (trail.includes(f)) throw Error('CSS @import cycle: ' + f);
  if (expansions.has(f)) return expansions.get(f);
  const ast = postcss.parse(read(f), { from: f });
  ast.walkAtRules('import', node => {
    const m = node.params.match(/^(?:url\(\s*)?['"]?(\.\.?\/[^'"\s)]+)['"]?\s*\)?$/);
    if (!m) throw Error(`Unsupported @import ${f}: ${node.params}`);
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(f), m[1]));
    node.replaceWith(postcss.parse(expand(target, [...trail, f]), { from: target }).nodes);
  });
  const s = ast.toString(); expansions.set(f, s); return s;
}
const minify = async source => (await transform(source, { loader:'css', charset:'utf8', target:['chrome87','edge88','firefox78','safari14'], minify: true, legalComments:'inline' })).code;
const minified = new Map();
for (const f of allCss) minified.set(f, await minify(expand(f)));
const sourceStats = allCss.map(f => ({ file:f, source:stats(read(f)), expanded:stats(expand(f)), minified:stats(minified.get(f)), htmlOrder:htmlCss.indexOf(f), owners:cssOwners.get(f) || [], urlOwners:urls.filter(o => o.file === f) }));
const artifactCss = readdirSync(path.join(output, 'assets')).filter(f => f.endsWith('.css')).map(f => ({ file:'assets/' + f, ...stats(readFileSync(path.join(output, 'assets', f))) }));
const artifactIndex = artifactCss.find(f => /^assets\/index-/.test(f.file));
const built = readFileSync(path.join(output, artifactIndex.file), 'utf8');
const builtAst = postcss.parse(built);
// Compare exact minified top-level statements after normalizing only rewritten asset URLs.
const norm = s => s.replace(/url\((?:[^()"']|"[^"]*"|'[^']*')*\)/g, 'url(ASSET)').replace(/;}/g, '}');
const builtKeys = builtAst.nodes.map(n => norm(n.toString()));
const findRuns = keys => {
  const result=[];
  for(let i=0;i<=builtKeys.length-keys.length;i++) if(keys.every((key,j)=>key===builtKeys[i+j])) result.push(i);
  return result;
};
const matches = [];
for (const f of initialCss) {
  const ast=postcss.parse(minified.get(f));
  const keys=ast.nodes.map(n=>norm(n.toString()));
  const runs=keys.length ? findRuns(keys) : [];
  if (!keys.length) { matches.push({ file:f, matched:true, ruleCount:0, start:0, end:0, note:'Comment-only stylesheet has no emitted CSS' }); continue; }
  if(runs.length===1) {
    const start=builtAst.nodes[runs[0]].source.start.offset;
    const end=builtAst.nodes[runs[0]+keys.length-1].source.end.offset;
    matches.push({ file:f, matched:true, ruleCount:keys.length, start, end });
  } else matches.push({ file:f, matched:false, ruleCount:keys.length, runCount:runs.length });
}
const facadeStyles = (graph.get('hub/game.hub.js')?.imports || []).filter(e=>e.specifier.endsWith('.css')).map(e=>path.posix.normalize(path.posix.join('game/src/hub', e.specifier)));
const exclusive = facadeStyles.filter(f => !(cssOwners.get(f)||[]).some(o => o.initial && o.module !== 'hub/game.hub.js'));
const groups = {
  hubFacadeExclusive: exclusive,
  hubFacadeIncludingShared: facadeStyles,
  htmlBaseCamp: ['game/css/base-camp.css', 'game/css/base-camp-compact.css'],
  htmlMenuPages: ['game/css/page-slot-select.css','game/css/page-settings.css','game/css/page-datapage.css','game/css/page-ach.css'],
  htmlBattle: ['game/css/battle.css','game/css/expedition-battle.css','game/css/page-battle-ui.css','game/css/battle-stage.css'],
};
groups.phase1Hub = [...new Set([...exclusive, ...groups.htmlBaseCamp])];
groups.recommendedSuffix = ['base-reward-feedback','base-collection-v4','base-courtyard-v3','base-panel-layout','base-cohesion-v5','base-framework-v7','base-rooms-v7','base-personnel-v12','base-logistics-trade-v12','base-archive-facilities-v12','base-page-motion-v7','base-home-v7','departure-selected','roster-reference','base-shop-v3','base-archive-v3'].map(f=>'game/css/'+f+'.css');
groups.extendedHubClass = groups.phase1Hub.filter(f=>f!=='game/css/card-browser.css');
groups.extendedAll = [...groups.extendedHubClass,...groups.htmlMenuPages,...groups.htmlBattle];
groups.phase2HtmlMenuBattle = [...groups.htmlMenuPages,...groups.htmlBattle];
const baselineMin=await minify(initialCss.map(f=>expand(f)).join('\n'));
const measures={};
const builtControl=await minify(built);
for(const [name,files] of Object.entries(groups)) {
  const matched=matches.filter(m=>files.includes(m.file) && m.matched).sort((a,b)=>b.start-a.start);
  let stripped=built;
  for(const m of matched) stripped=stripped.slice(0,m.start)+stripped.slice(m.end);
  postcss.parse(stripped);
  const strippedMin=await minify(stripped);
  const intervals=matched.filter(m=>m.ruleCount).sort((a,b)=>a.start-b.start);
  const slotRanges=[];
  for(const m of intervals) { const last=slotRanges.at(-1); if(last && m.start===last.end) { last.end=m.end; last.files.push(m.file); } else slotRanges.push({start:m.start,end:m.end,files:[m.file]}); }
  for(const range of slotRanges) postcss.parse(built.slice(range.start,range.end));
  const slotCss=await Promise.all(slotRanges.map(async range=>({...range,...stats(await minify(built.slice(range.start,range.end)))})));
  const criticalRanges=[]; let cursor=0;
  for(const range of slotRanges) { if(range.start>cursor) criticalRanges.push({start:cursor,end:range.start}); cursor=range.end; }
  if(cursor<built.length) criticalRanges.push({start:cursor,end:built.length});
  const criticalSlots=await Promise.all(criticalRanges.filter(r=>built.slice(r.start,r.end).trim()).map(async range=>({...range,...stats(await minify(built.slice(range.start,range.end)))})));
  const pieces=[]; cursor=0; for(const range of slotRanges) { pieces.push(built.slice(cursor,range.start),built.slice(range.start,range.end)); cursor=range.end; } pieces.push(built.slice(cursor));
  if(pieces.join('')!==built) throw Error('CSS interval reconstruction differs');
  const orderedInitialGzip=criticalSlots.reduce((sum,s)=>sum+s.gzip,0);
  const orderedDeferredGzip=slotCss.reduce((sum,s)=>sum+s.gzip,0);
  const omittedRuleBytes=intervals.reduce((sum,m)=>sum+Buffer.byteLength(built.slice(m.start,m.end)),0);
  const removedMin=await minify(files.map(f=>expand(f)).join('\n'));
  const remainingMin=await minify(initialCss.filter(f=>!files.includes(f)).map(f=>expand(f)).join('\n'));
  measures[name]={ files, matchedFiles:matched.map(m=>m.file), unmatchedFiles:files.filter(f=>!matched.some(m=>m.file===f)),
    sourceGroup:stats(files.map(f=>read(f)).join('\n')), minifiedGroup:stats(removedMin), retainedArtifactSlots:slotCss, orderedDeliverySimulation: matched.length===files.length ? {criticalSlots,initialGzip:orderedInitialGzip,initialGzipReduction:gzipSync(builtControl).length-orderedInitialGzip,deferredGzip:orderedDeferredGzip,totalGzipDelta:orderedInitialGzip+orderedDeferredGzip-gzipSync(builtControl).length,exactIntervalReconstruction:true}:null, omittedArtifactCssBytes:omittedRuleBytes,
    sourceSimulation:{ initialBase:stats(baselineMin), initialRemaining:stats(remainingMin), gzipReduction:gzipSync(baselineMin).length-gzipSync(remainingMin).length, separateGroupGzip:gzipSync(removedMin).length, totalGzipDelta:gzipSync(remainingMin).length+gzipSync(removedMin).length-gzipSync(baselineMin).length },
    artifactSimulation: matched.length===files.length?{ initialBase:stats(builtControl), original:stats(built), initialRemaining:stats(strippedMin), gzipReduction:gzipSync(builtControl).length-gzipSync(strippedMin).length, deferredSlotsGzip:slotCss.reduce((sum,s)=>sum+s.gzip,0), totalGzipDelta:gzipSync(strippedMin).length+slotCss.reduce((sum,s)=>sum+s.gzip,0)-gzipSync(builtControl).length, note:'Static production CSS interval subtraction and re-minification; not a new Vite build' }:null };
}
const mismatches=[];
const fingerprintFiles=[...new Set([...allCss,...expansions.keys(),'game/index.html','game/src/main.js','game/src/hub/game.hub.js','vite.config.js','scripts/perf-budget.cjs','scripts/css-asset-minification.mjs'])];
const fingerprints=fingerprintFiles.map(f=>{
 const bytes=readFileSync(path.join(root,f)); const snap=path.join(snapshot,f);
 const match=existsSync(snap)&&sha(bytes)===sha(readFileSync(snap)); if(!match)mismatches.push(f);
 return {file:f,...stats(bytes),snapshotMatch:match};
});
const duplicateGroups=[];
for (const asset of artifactCss) { const ast=postcss.parse(readFileSync(path.join(output,asset.file),'utf8')); const seen=new Map(); const duplicate=[]; ast.walkRules(rule=>{ let ancestry=[]; for(let p=rule.parent;p&&p.type!=='root';p=p.parent) ancestry.unshift(p.type==='atrule'?'@'+p.name+' '+p.params:p.selector); const key=JSON.stringify([ancestry,rule.toString()]); if(seen.has(key))duplicate.push({selector:rule.selector,chars:rule.toString().length,firstOffset:seen.get(key),offset:rule.source.start.offset}); else seen.set(key,rule.source.start.offset); }); duplicateGroups.push({file:asset.file,exactRuleRepeatCount:duplicate.length,rawRepeatChars:duplicate.reduce((n,r)=>n+r.chars,0)}); }
const result={ checkedAt:new Date().toISOString(), method:'Read-only source/retained R3 artifact analysis; esbuild in-memory transforms only; no Vite build, service, browser, or production write',
  snapshot, node:process.version, esbuild:req('esbuild/package.json').version, vite:req('vite/package.json').version,
  initialRoots:roots, moduleCounts:{initial:initial.size,complete:complete.size}, initialCss, initialCssCount:initialCss.length, htmlCss, htmlCssCount:htmlCss.length, urls,
  cssStats:sourceStats, retainedArtifactCss:artifactCss, retainedArtifactCssTotalGzip:artifactCss.reduce((n,f)=>n+f.gzip,0), artifactInitialCssGzip:artifactIndex.gzip,
  fingerprintMismatches:mismatches, fingerprints, duplicateRuleInventory:duplicateGroups, artifactMatches:matches, measurements:measures,
  cssBudget:{bytes:136*1024, scope:'sum gzip of all emitted .css, including async and new URL CSS',gap:artifactCss.reduce((n,f)=>n+f.gzip,0)-136*1024},
};
writeFileSync(path.join(here,'measurements.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({ initialCssCount:result.initialCssCount,htmlCssCount:result.htmlCssCount,artifactGzip:result.retainedArtifactCssTotalGzip,initialArtifactGzip:result.artifactInitialCssGzip,cssBudget:result.cssBudget,fingerprintMismatches:mismatches,artifactMatches:matches.map(m=>({file:m.file,matched:m.matched,start:m.start})),groups:Object.fromEntries(Object.entries(measures).map(([name,m])=>[name,{files:m.files.length,unmatched:m.unmatchedFiles,sourceGzipReduction:m.sourceSimulation.gzipReduction,splitTotalDelta:m.sourceSimulation.totalGzipDelta,artifactGzipReduction:m.artifactSimulation?.gzipReduction,artifactRemainingGzip:m.artifactSimulation?.initialRemaining.gzip,slotCount:m.retainedArtifactSlots.length,artifactSplitTotalDelta:m.artifactSimulation?.totalGzipDelta,orderedDelivery:m.orderedDeliverySimulation}]))},null,2));
