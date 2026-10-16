import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => readFileSync(path.join(root,relative), 'utf8');
const mapping = JSON.parse(read('game/data/art-mapping.json'));
const candidates = JSON.parse(readFileSync('/workspace/shared/published-asset-audit-20261016/shadowed-card-art-candidates.json', 'utf8'));
const audited = JSON.parse(read('docs/evidence/2026-10-16-shadowed-card-audit/audit-result.json'));
const originals = JSON.parse(read('game/src/generated/art-manifest.js').match(/export default ([\s\S]*);/)[1]);
const thumbnails = JSON.parse(read('game/src/generated/thumb-manifest.js').match(/export default ([\s\S]*);/)[1]);
const primary = new Set(audited.primaryPaths);
const oldPaths = new Set(candidates.flatMap(candidate => [candidate.shadowed, `thumbs/${candidate.shadowed}`]));
const urlPath = html => /(?:src|data-lib-src)="([^"]+)"/.exec(html)?.[1].split('?')[0];
const cardFor = candidate => ({id:candidate.cardId, name:candidate.cardId, type:candidate.shadowed.includes('/spell-')?'法术':candidate.shadowed.includes('/martial-')?'武术':candidate.shadowed.includes('/equip-')?'装备':'能力卡'});

beforeEach(() => {
  vi.resetModules(); vi.useFakeTimers();
  window.SDT = { Icons: { img: () => '', TYPE_ART: {} } };
  localStorage.clear();
  vi.stubGlobal('scheduler', {postTask:vi.fn(()=>Promise.resolve())});
  vi.stubGlobal('requestIdleCallback', vi.fn());
});
afterEach(() => {
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
  vi.doUnmock('../../../game/src/generated/art-manifest.js');
  vi.doUnmock('../../../game/src/generated/thumb-manifest.js');
});
async function load({omitOld=false,omitReplacementThumbs=false}={}) {
  const artManifest = omitOld ? originals.filter(asset=>!primary.has(asset)) : [...originals];
  const replacementSet = new Set(candidates.map(candidate=>candidate.override));
  const thumbManifest = thumbnails.filter(asset=>(!omitOld||!primary.has(`thumbs/${asset}`))&&(!omitReplacementThumbs||!replacementSet.has(asset)));
  vi.doMock('../../../game/src/generated/art-manifest.js',()=>({default:artManifest}));
  vi.doMock('../../../game/src/generated/thumb-manifest.js',()=>({default:thumbManifest}));
  await import('../../../game/src/cards/cards.js');
  await import('../../../game/src/core/art.js');
  const {DATA} = await import('../../../game/src/core/data-loader.js');
  const {Cards,Art} = window.SDT;
  Cards.ensureSha(); Cards.ensureStarters(); Cards.ensureTabletop();
  window.SDT.Icons.TYPE_ART = Cards.TYPE_ART;
  return {Art,Cards,DATA};
}

describe('shadowed card art: read-only production proposal',()=>{
  it('has exactly 15 proven zero-stem cards and 30 published files whose SHA matches R3',()=>{
    expect(audited.sourceCount).toBe(527);
    expect(audited.primaryCardCount).toBe(15); expect(audited.primaryFileCount).toBe(30);
    expect(audited.primaryAssetBytes).toBe(1291352);
    for(const record of audited.records.filter(record=>record.decision==='primary-30')){
      expect(record.runtimeStemReferences).toEqual([]);
      expect(record.mappingOverrideMatches).toBe(true);
      expect(record.shadowSelectorContainsCard).toBe(true);
      for(const artifact of [record.original,record.thumbnail,record.replacement,record.replacementThumbnail]){
        expect(artifact.exists).toBe(true);
        expect(artifact.published.find(item=>item.manifest.includes('-r3-'))?.matchesSource).toBe(true);
      }
    }
    expect(audited.currentPlan).toEqual({count:165,warnings:[]});
    expect(audited.proposedInMemoryPlan.count).toBe(195);
    expect(audited.proposedInMemoryPlan.addedPrimaryCount).toBe(30);
    expect(audited.proposedInMemoryPlan.warnings).toEqual([]);
    expect(Object.values(audited.graphGuardSamples).every(Boolean)).toBe(true);
  });

  it('fails closed if override data, selectors, data freezing or dynamic-source certainty changes',()=>{
    for(const name of ['override-removed','selector-changed','data-freeze-loader-changed','new-opaque-consumer','new-syntax-error','missing-selector']){
      expect(audited.guardExperiments[name].primaryExcluded).toBe(0);
      expect(audited.guardExperiments[name].warnings.length).toBeGreaterThan(0);
    }
    expect(audited.guardExperiments['restored-static-path']).toMatchObject({originalRetained:true,thumbnailRetained:true});
  });

  it('renders every candidate and incomplete historical card through its override in all full/low/deferred modes',async()=>{
    const {Art,Cards,DATA}=await load();
    const all=Cards.all();
    for(const candidate of candidates){
      const active=all.find(card=>card.id===candidate.cardId);
      expect(active,`missing current card ${candidate.cardId}`).toBeTruthy();
      for(const card of [active, {id:candidate.cardId}, {...cardFor(candidate),cls:null,art:candidate.shadowed}, {...cardFor(candidate),type:'生物'}]){
        for(const low of [false,true])for(const defer of [false,true]){
          const html=Art.cardIcon(card,{low,defer});
          expect(urlPath(html)).toBe(`assets/${low?'thumbs/':''}${candidate.override}`);
          expect(html).toContain(`data-asset-key="card-${candidate.cardId}"`);
          expect(html).not.toContain(candidate.shadowed);
          if(defer)expect(html).toContain('data-lib-src=');
        }
      }
    }
    expect(Object.isFrozen(DATA.art)).toBe(true);
    expect(Object.isFrozen(DATA.art.cardArtOverrides)).toBe(true);
    expect(Object.isFrozen(DATA.art.heroCardArt)).toBe(true);
  });

  it('does not render any shadowed original or thumbnail for any live catalog card',async()=>{
    const {Art,Cards}=await load();
    const all=Cards.all(); expect(all.length).toBeGreaterThan(200);
    for(const card of all)for(const low of [false,true]){
      const renderedPath=urlPath(Art.cardIcon(card,{low}));
      expect(oldPaths.has(renderedPath?.replace(/^assets\//,'')),`${card.id}: ${renderedPath}`).toBe(false);
    }
    expect(Art.collectCardAssets(all).some(url=>oldPaths.has(url.split('?')[0].replace(/^assets\//,'')))).toBe(false);
  });

  it('removing just the 30 old manifest entries preserves all candidate rendered URLs and live target metadata',async()=>{
    const {Art,Cards}=await load({omitOld:true});
    const manifestURLs=new Set(Art.collectManifestAssets().map(url=>url.split('?')[0]));
    const thumbURLs=new Set(Art.collectThumbnailAssets().map(url=>url.split('?')[0]));
    for(const asset of primary)expect([...manifestURLs,...thumbURLs]).not.toContain(`assets/${asset}`);
    for(const candidate of candidates){
      expect(manifestURLs.has(`assets/${candidate.override}`)).toBe(true);
      expect(thumbURLs.has(`assets/thumbs/${candidate.override}`)).toBe(true);
      const card=Cards.all().find(item=>item.id===candidate.cardId);
      expect(urlPath(Art.cardIcon(card))).toBe(`assets/${candidate.override}`);
      expect(urlPath(Art.cardIcon(card,{low:true}))).toBe(`assets/thumbs/${candidate.override}`);
      expect(Cards.cardHTML(card)).toContain(`assets/${candidate.override}`);
      expect(Cards.cardHTML(card,'',{low:true})).toContain(`assets/thumbs/${candidate.override}`);
    }
  });

  it('without replacement thumbnail metadata low mode falls back to the replacement original, never the shadowed original',async()=>{
    const {Art}=await load({omitOld:true,omitReplacementThumbs:true});
    for(const candidate of candidates){
      const html=Art.cardIcon(cardFor(candidate),{low:true});
      expect(urlPath(html)).toBe(`assets/${candidate.override}`);
      expect(html).not.toContain(candidate.shadowed);
      expect(html).not.toContain('onerror=');
    }
  });

  it('proves baseline manifests currently still prefetch the 30 files and therefore must be filtered with publication',async()=>{
    const {Art}=await load();
    const prefetchedPaths=new Set([...Art.collectManifestAssets(),...Art.collectThumbnailAssets()].map(url=>url.split('?')[0].replace(/^assets\//,'')));
    for(const asset of primary)expect(prefetchedPaths.has(asset)).toBe(true);
  });

  it('retains all eight non-primary assets, including the demo original and inert CSS/legacy-map cases',async()=>{
    const {Art}=await load({omitOld:true});
    const paths=new Set([...Art.collectManifestAssets(),...Art.collectThumbnailAssets()].map(url=>url.split('?')[0].replace(/^assets\//,'')));
    const nonPrimary=[...oldPaths].filter(asset=>!primary.has(asset));expect(nonPrimary).toHaveLength(8);
    for(const asset of nonPrimary)expect(paths.has(asset)).toBe(true);
    expect(read('game/battle-redesign-demo.html')).toContain('assets/cards/equip-tt2-frostsword.webp');
    expect(read('game/css/card-v3.css')).not.toMatch(/url\([^)]*(?:martial-tt3-skewer|spell-tt3-fireball)/);
    expect(mapping.heroCardArt['tt8-hero-warlock']).toBe('hero-forbidden');
  });
});
