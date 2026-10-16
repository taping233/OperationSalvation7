import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { hasOpaqueAssetPaths, collectReviewedRuntimeAssetExclusions, planReviewedRuntimeAssetExclusions, assertExcludedRuntimeAssetReferences } from '../../../scripts/runtime-asset-redundancy.mjs';
import { RUNTIME_REDUNDANCY_REVIEW } from '../../../scripts/runtime-asset-redundancy-review.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const input = '/workspace/shared/published-asset-audit-20261016/shadowed-card-art-candidates.json';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const textSha = code => sha(code.replaceAll('\r\n', '\n'));
const read = rel => readFileSync(path.join(root, rel), 'utf8');
const mapping = JSON.parse(read('game/data/art-mapping.json'));
const candidates = JSON.parse(readFileSync(input, 'utf8'));
const sources = [];
function scan(relative) {
  for (const entry of readdirSync(path.join(root, relative), { withFileTypes: true })) {
    const next = `${relative}/${entry.name}`;
    if (next === 'game/src/generated' || next.endsWith('.d.ts')) continue;
    if (entry.isDirectory()) scan(next);
    else if (/\.(?:[cm]?js|jsx|tsx?|json|css)$/.test(next)) sources.push({path: next, code: read(next)});
  }
}
for (const dir of ['game/src', 'game/data', 'game/css']) scan(dir);
for (const entry of readdirSync(path.join(root, 'game'), {withFileTypes:true})) {
  if (entry.isFile() && entry.name.endsWith('.html')) sources.push({path:`game/${entry.name}`,code:read(`game/${entry.name}`)});
}
const primary = candidates.filter(c => c.literalReferenceFiles.length === 0);
const primaryPaths = primary.flatMap(c => [c.shadowed, `thumbs/${c.shadowed}`]);
const buildInputs = ['/workspace/shared/cloud-iteration-verification-r2-20261016/build-output-manifest.json', '/workspace/shared/cloud-iteration-verification-r3-20261016/build-output-manifest.json'];
const buildManifests = buildInputs.filter(existsSync).map(file => ({file, sha256:sha(readFileSync(file)), records:new Map(JSON.parse(readFileSync(file,'utf8')).map(item=>[item.path,item]))}));
const artifact = relative => {
  const file = path.join(root, 'game/assets', relative);
  if (!existsSync(file)) return {path:relative, exists:false};
  const bytes = readFileSync(file);
  return {path:relative, exists:true, bytes:bytes.length, sha256:sha(bytes), published:buildManifests.map(manifest=>{
    const published = manifest.records.get(`assets/${relative}`);
    return {manifest:manifest.file, present:!!published, bytes:published?.bytes, sha256:published?.sha256, matchesSource:!!published && published.bytes===bytes.length && published.sha256===sha(bytes)};
  })};
};
const records = candidates.map(candidate => {
  const stem = path.posix.basename(candidate.shadowed, '.webp');
  const refs = sources.filter(source => source.code.includes(stem));
  const oldOriginal = artifact(candidate.shadowed);
  const oldThumb = artifact(`thumbs/${candidate.shadowed}`);
  const replacement = artifact(candidate.override);
  const replacementThumb = artifact(`thumbs/${candidate.override}`);
  const selectorSet = candidate.shadowed.startsWith('cards/spell-')?'spellCardArt':candidate.shadowed.startsWith('cards/martial-')?'martialCardArt':candidate.shadowed.startsWith('cards/equip-')?'equipCardArt':'heroCardArt';
  const decision = refs.length===0?'primary-30':candidate.cardId==='tt2-frostsword'?'retain-original-demo-reference':'semantic-followup-only';
  return {...candidate, decision, mappingOverrideMatches:mapping.cardArtOverrides[candidate.cardId]===candidate.override,
    shadowSelectorSet:selectorSet, shadowSelectorContainsCard:Array.isArray(mapping[selectorSet])?mapping[selectorSet].includes(candidate.cardId):mapping[selectorSet]?.[candidate.cardId]===stem,
    original:oldOriginal, thumbnail:oldThumb, replacement, replacementThumbnail:replacementThumb,
    runtimeStemReferences:refs.map(source=>({path:source.path, lines:source.code.split('\n').map((line,index)=>line.includes(stem)?{line:index+1,code:line.trim()}:null).filter(Boolean)}))};
});
const fingerprints = Object.fromEntries([
  'game/src/core/art.js','game/src/core/data-loader.js','game/data/art-mapping.json',
  'game/src/cards/cards.view.js','game/src/core/asset-url.js','game/css/card-v3.css',
  'game/battle-redesign-demo.html','vite.config.js','scripts/runtime-asset-redundancy.mjs',
  'scripts/runtime-asset-redundancy-review.mjs','scripts/runtime-asset-publication.mjs',
  'game/src/generated/art-manifest.js','game/src/generated/thumb-manifest.js',
].map(file=>[file,{sha256:sha(readFileSync(path.join(root,file))),normalizedSha256:textSha(read(file))}]));
const opaque = sources.filter(source=> /\.(?:[cm]?js|jsx|tsx?)$/.test(source.path)&&hasOpaqueAssetPaths(source.code));
const proposedReview = {
  candidates:[...RUNTIME_REDUNDANCY_REVIEW.candidates,...primaryPaths.map(asset=>({path:asset,category:'shadowed-card-art'}))],
  consumerFingerprints:{...RUNTIME_REDUNDANCY_REVIEW.consumerFingerprints,'shadowed-card-art':Object.fromEntries([
    'game/src/core/art.js','game/src/core/data-loader.js','game/data/art-mapping.json',
  ].map(file=>[file,textSha(read(file))]))},
  opaqueConsumers:RUNTIME_REDUNDANCY_REVIEW.opaqueConsumers,
};
const catalogs=Object.fromEntries(['wu','changwuyu','baita','heixiang','xingyue'].map(role=>[role,JSON.parse(read(`game/assets/portraits/frames/${role}/sprite-v1/animations.json`))]));
const current=collectReviewedRuntimeAssetExclusions(root);
const proposed=planReviewedRuntimeAssetExclusions(sources,catalogs,proposedReview);
const graphGuardSamples={};
for(const asset of primaryPaths){
  try{assertExcludedRuntimeAssetReferences([{id:'/project/game/src/new-lazy.js',code:`assetUrl('assets/${asset}');`}],new Set(primaryPaths));graphGuardSamples[asset]=false;}
  catch(error){graphGuardSamples[asset]=/Excluded runtime asset/.test(error.message);}
}
const primaryCount = decision => primaryPaths.filter(asset=>decision.excludedAssets.has(asset)).length;
const withSource = (relative,code) => sources.map(source=>source.path===relative?{...source,code}:source);
const guardExperiments = {};
for(const [name,relative,code] of [
  ['override-removed','game/data/art-mapping.json',JSON.stringify({...mapping,cardArtOverrides:{...mapping.cardArtOverrides,'tt8-curse1':undefined}})],
  ['selector-changed','game/src/core/art.js',read('game/src/core/art.js')+'\n// selector changed'],
  ['data-freeze-loader-changed','game/src/core/data-loader.js',read('game/src/core/data-loader.js')+'\n// loader changed'],
]) {
  const decision=planReviewedRuntimeAssetExclusions(withSource(relative,code),catalogs,proposedReview);
  guardExperiments[name]={primaryExcluded:primaryCount(decision),warnings:decision.warnings};
}
for(const [name,code] of [['new-opaque-consumer','assetUrl(`assets/${folder}/${name}.webp`);'],['new-syntax-error','const =']]){
  const decision=planReviewedRuntimeAssetExclusions([...sources,{path:'game/src/audit-new-lazy.js',code}],catalogs,proposedReview);
  guardExperiments[name]={totalExcluded:decision.excludedAssets.size,primaryExcluded:primaryCount(decision),warnings:decision.warnings};
}
const missingSource=planReviewedRuntimeAssetExclusions(sources.filter(source=>source.path!=='game/src/core/art.js'),catalogs,proposedReview);
guardExperiments['missing-selector']={primaryExcluded:primaryCount(missingSource),warnings:missingSource.warnings};
const restored = planReviewedRuntimeAssetExclusions([...sources,{path:'game/src/audit-restored.js',code:`assetUrl('assets/${primaryPaths[0]}');`}],catalogs,proposedReview);
guardExperiments['restored-static-path']={originalRetained:!restored.excludedAssets.has(primaryPaths[0]),thumbnailRetained:!restored.excludedAssets.has(primaryPaths[1]),warnings:restored.warnings};
const result={
  auditTime:new Date().toISOString(), input:{path:input,sha256:sha(readFileSync(input))},
  sourceCount:sources.length, sourceSnapshot:sources.map(source=>({path:source.path,normalizedSha256:textSha(source.code)})),
  candidateCardCount:records.length, candidateFileCount:records.length*2,
  primaryCardCount:primary.length, primaryFileCount:primaryPaths.length,
  primaryAssetBytes:records.filter(item=>item.decision==='primary-30').reduce((sum,item)=>sum+item.original.bytes+item.thumbnail.bytes,0),
  primaryPaths, allCandidateBytes:records.reduce((sum,item)=>sum+item.original.bytes+item.thumbnail.bytes,0),
  buildManifests:buildManifests.map(({file,sha256})=>({path:file,sha256})), fingerprints,
  opaqueConsumers:opaque.map(source=>({path:source.path,normalizedSha256:textSha(source.code),reviewMatches:RUNTIME_REDUNDANCY_REVIEW.opaqueConsumers[source.path]===textSha(source.code)})),
  currentPlan:{count:current.excludedAssets.size,warnings:current.warnings},
  proposedInMemoryPlan:{count:proposed.excludedAssets.size,addedPrimaryCount:primaryPaths.filter(asset=>proposed.excludedAssets.has(asset)).length,warnings:proposed.warnings,primaryPaths:primaryPaths.filter(asset=>proposed.excludedAssets.has(asset))},
  graphGuardSamples, guardExperiments, records,
};
writeFileSync(path.join(here,'audit-result.json'),JSON.stringify(result,null,2)+'\n');
writeFileSync(path.join(here,'publication-proposal.json'),JSON.stringify({
  status:'proposal-only-not-implemented',category:'shadowed-card-art',fileCount:primaryPaths.length,assetBytes:result.primaryAssetBytes,
  candidates:primaryPaths.map(asset=>({path:asset,category:'shadowed-card-art'})),
  consumerFingerprints:proposedReview.consumerFingerprints['shadowed-card-art'],
  retainNonPrimary:candidates.filter(candidate=>!primary.includes(candidate)).flatMap(candidate=>[candidate.shadowed,`thumbs/${candidate.shadowed}`]),
},null,2)+'\n');
console.log(JSON.stringify({sourceCount:result.sourceCount,candidateCardCount:result.candidateCardCount,primaryFileCount:result.primaryFileCount,primaryAssetBytes:result.primaryAssetBytes,currentPlan:result.currentPlan,proposedInMemoryPlan:result.proposedInMemoryPlan,allAssetSourceHashesMatchR3:records.every(r=>[r.original,r.thumbnail,r.replacement,r.replacementThumbnail].every(a=>a.published.find(p=>p.manifest.includes('-r3-'))?.matchesSource)),allGraphGuardSamplesReject:Object.values(graphGuardSamples).every(Boolean)},null,2));
