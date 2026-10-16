// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  assertExcludedRuntimeAssetReferences, assertRuntimeExclusionPlanUnchanged,
  collectReviewedRuntimeAssetExclusions, hasOpaqueAssetPaths,
  planReviewedRuntimeAssetExclusions,
} from '../scripts/runtime-asset-redundancy.mjs';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const hash = code => createHash('sha256').update(code).digest('hex');
const legacy = 'portraits/frames/wu/idle.webp';
const oldMap = 'scenes/map-nodes/battle-security-shard-1011.webp';
const oldTransition = 'scenes/transition-battle-v1.webp';
function fixture() {
  const selector = { path: 'game/src/selector.js', code: 'const current = "sprite-v1/frame-001";' };
  const dynamic = { path: 'game/src/paths.js', code: 'assetUrl(`assets/${kind}/${name}.webp`);' };
  const review = {
    candidates: [
      { path: legacy, category: 'frames', role: 'wu' },
      { path: oldMap, category: 'map' },
      { path: oldTransition, category: 'transitions' },
    ],
    consumerFingerprints: Object.fromEntries(['frames', 'map', 'transitions']
      .map(category => [category, { [selector.path]: hash(selector.code) }])),
    opaqueConsumers: { [dynamic.path]: hash(dynamic.code) },
  };
  return { sources: [selector, dynamic], catalogs: { wu: { sequences: { idle: ['sprite-v1/frame-001'] } } }, review };
}
const plan = f => planReviewedRuntimeAssetExclusions(f.sources, f.catalogs, f.review);

it('keeps reviewed asset decisions identical across Git LF and Windows CRLF sources', () => {
  const f = fixture();
  for (const source of f.sources) source.code += '\n';
  for (const fingerprints of Object.values(f.review.consumerFingerprints)) {
    fingerprints[f.sources[0].path] = hash(f.sources[0].code);
  }
  f.review.opaqueConsumers[f.sources[1].path] = hash(f.sources[1].code);
  const expected = [...plan(f).excludedAssets];
  for (const source of f.sources) source.code = source.code.replaceAll('\n', '\r\n');
  expect(plan(f).warnings).toEqual([]);
  expect([...plan(f).excludedAssets]).toEqual(expected);
});

describe('reviewed production-only asset omissions', () => {
  it('contains 56 previous paths, 90 retired chest frames, 19 retired scenes and 30 shadowed card files', () => {
    expect(RUNTIME_REDUNDANCY_REVIEW.candidates).toHaveLength(195);
    expect(new Set(RUNTIME_REDUNDANCY_REVIEW.candidates.map(candidate => candidate.path)).size).toBe(195);
    const chests = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.category === 'chests');
    expect(chests).toHaveLength(90);
    expect(chests.map(candidate => candidate.path).sort()).toEqual(['small', 'medium', 'large', 'class', 'boss']
      .flatMap(kind => Array.from({ length: 18 }, (_, frame) =>
        `scenes/chests/${kind}-rig-640-v1/frame-${String(frame).padStart(2, '0')}.webp`)).sort());
    const current = collectReviewedRuntimeAssetExclusions(projectRoot);
    expect(current.warnings).toEqual([]);
    expect(current.excludedAssets.size).toBe(195);
    for (const asset of current.excludedAssets) {
      expect(asset).not.toMatch(/sprite-v1\/|portraits\/(?:full|battle|avatars)\/|fonts\/|safe-simple-v7\/|symbol-foreground|map-atmosphere|city-ghost-props|transition-.*-v2/);
      expect(readFileSync(new URL(`../game/assets/${asset}`, import.meta.url)).byteLength).toBeGreaterThan(0);
    }
  });

  it('omits exactly the 15 reviewed shadowed originals and their thumbnails, retaining the four referenced card pairs', () => {
    const stems = ['spell-tt8-curse1', 'spell-tt8-curse2', 'spell-tt8-curse3', 'spell-tt8-curse4',
      'equip-tt3-staff', 'equip-tt3-fate-wheel', 'equip-tt3-wolf-bow', 'equip-tt3-twinwater-mail',
      'equip-tt3-grass-armor', 'equip-tt3-blooddrinker', 'equip-tt8-demonslay', 'equip-tt8-archdemon',
      'equip-tt8-heavensword', 'equip-tt7-arcanescroll', 'equip-tt12-raygun'];
    const reviewed = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.category === 'shadowed-card-art');
    expect(reviewed.map(candidate => candidate.path).sort()).toEqual(stems
      .flatMap(stem => [`cards/${stem}.webp`, `thumbs/cards/${stem}.webp`]).sort());
    expect(Object.keys(RUNTIME_REDUNDANCY_REVIEW.consumerFingerprints['shadowed-card-art']).sort()).toEqual([
      'game/data/art-mapping.json', 'game/src/core/art.js', 'game/src/core/data-loader.js',
    ]);
    const mapping = JSON.parse(readFileSync(new URL('../game/data/art-mapping.json', import.meta.url), 'utf8'));
    const current = collectReviewedRuntimeAssetExclusions(projectRoot);
    for (const stem of stems) {
      const id = stem.replace(/^(spell|equip)-/, '');
      const replacement = mapping.cardArtOverrides[id];
      expect(typeof replacement).toBe('string');
      for (const prefix of ['', 'thumbs/']) {
        const asset = `${prefix}cards/${stem}.webp`;
        expect(current.excludedAssets.has(asset)).toBe(true);
        expect(current.excludedAssets.has(`${prefix}${replacement}`)).toBe(false);
        expect(readFileSync(new URL(`../game/assets/${asset}`, import.meta.url)).byteLength).toBeGreaterThan(0);
        expect(readFileSync(new URL(`../game/assets/${prefix}${replacement}`, import.meta.url)).byteLength).toBeGreaterThan(0);
      }
    }
    for (const stem of ['hero-forbidden', 'spell-tt3-fireball', 'martial-tt3-skewer', 'equip-tt2-frostsword']) {
      for (const prefix of ['cards/', 'thumbs/cards/']) expect(current.excludedAssets.has(`${prefix}${stem}.webp`)).toBe(false);
    }
  });

  it('retains shadowed card files after override, renderer or data-loader changes and rejects restored lazy references', () => {
    const candidates = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.category === 'shadowed-card-art');
    const fingerprints = RUNTIME_REDUNDANCY_REVIEW.consumerFingerprints['shadowed-card-art'];
    const sources = Object.keys(fingerprints).map(filename => ({
      path: filename, code: readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'),
    }));
    const review = { candidates, consumerFingerprints: { 'shadowed-card-art': fingerprints },
      opaqueConsumers: RUNTIME_REDUNDANCY_REVIEW.opaqueConsumers };
    const inspect = records => planReviewedRuntimeAssetExclusions(records, {}, review);
    expect(inspect(sources).excludedAssets.size).toBe(30);
    for (const filename of Object.keys(fingerprints)) {
      const changed = sources.map(source => source.path === filename ? { ...source, code: `${source.code}\n ` } : source);
      expect(inspect(changed).excludedAssets.size).toBe(0);
      expect(inspect(sources.filter(source => source.path !== filename)).excludedAssets.size).toBe(0);
    }
    const restoredMapping = sources.map(source => {
      if (source.path !== 'game/data/art-mapping.json') return source;
      const mapping = JSON.parse(source.code); delete mapping.cardArtOverrides['tt8-curse1'];
      return { ...source, code: JSON.stringify(mapping) };
    });
    expect(inspect(restoredMapping).excludedAssets.size).toBe(0);
    for (const candidate of candidates) {
      const restored = { path: 'game/src/lazy-restored-card.js', code: `assetUrl('assets/${candidate.path}');` };
      expect(inspect([...sources, restored]).excludedAssets.has(candidate.path)).toBe(false);
      expect(() => assertExcludedRuntimeAssetReferences([{ id: `/project/${restored.path}`, code: restored.code }],
        new Set(candidates.map(item => item.path)))).toThrow(/Excluded runtime asset/);
    }
    const generated = { id: '/project/game/src/generated/thumb-manifest.js', code: JSON.stringify([candidates[1].path.slice('thumbs/'.length)]) };
    expect(() => assertExcludedRuntimeAssetReferences([generated], new Set(candidates.map(item => item.path)))).toThrow(/Excluded runtime asset/);
  });

  it('keeps the current safe timeline and restores any referenced or changed retired rig selector', () => {
    const asset = 'scenes/chests/small-rig-640-v1/frame-00.webp';
    const selector = { path: 'game/src/chest-selector.js', code: 'new URL("../assets/scenes/chests/safe-simple-v7/frame-00.webp", import.meta.url);' };
    const review = {
      candidates: [{ path: asset, category: 'chests' }],
      consumerFingerprints: { chests: { [selector.path]: hash(selector.code) } },
      opaqueConsumers: {},
    };
    const inspect = sources => planReviewedRuntimeAssetExclusions(sources, {}, review);
    expect(inspect([selector]).excludedAssets.has(asset)).toBe(true);
    expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/current.js', code: selector.code }], new Set([asset]))).not.toThrow();
    for (const code of [`new URL('../assets/${asset}', import.meta.url);`, 'const restoredRig = "small-rig-640-v1";']) {
      expect(inspect([selector, { path: 'game/src/lazy-restored.js', code }]).excludedAssets.has(asset)).toBe(false);
      expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/lazy-restored.js', code }], new Set([asset]))).toThrow(/Excluded runtime asset/);
    }
    expect(inspect([{ ...selector, code: `${selector.code}\nconst revision = 2;` }]).excludedAssets.has(asset)).toBe(false);
    expect(inspect([]).excludedAssets.has(asset)).toBe(false);
  });

  it('omits only unused reviewed files and retains future static or configured references', () => {
    const f = fixture();
    expect([...plan(f).excludedAssets]).toEqual([legacy, oldMap, oldTransition]);
    f.sources.push({ path: 'game/src/new-lazy-page.js', code: `new URL('../../assets/${oldMap}', import.meta.url);` });
    f.sources.push({ path: 'game/data/new.json', code: '{"cut":"transition-battle-v1"}' });
    expect([...plan(f).excludedAssets]).toEqual([legacy]);
  });

  it('reads all catalog sequence and static fallback names on every decision, including restored legacy frames', () => {
    const f = fixture();
    f.catalogs.wu.sequences.cast = ['idle'];
    expect(plan(f).excludedAssets.has(legacy)).toBe(false);
    delete f.catalogs.wu.sequences.cast;
    f.catalogs.wu.staticFallback = 'idle';
    expect(plan(f).excludedAssets.has(legacy)).toBe(false);
    f.catalogs.wu.staticFallback = 'sprite-v1/neutral';
    expect(plan(f).excludedAssets.has(legacy)).toBe(true);
  });

  it.each([undefined, {}, { sequences: {} }, { sequences: { idle: [] } },
    { sequences: { idle: [0] } }, { sequences: { idle: ['sprite-v1/frame-001'] }, staticFallback: 1 }])(
    'retains legacy files for an absent or unknown catalog: %j', catalog => {
      const f = fixture(); f.catalogs.wu = catalog;
      expect(plan(f).excludedAssets.has(legacy)).toBe(false);
      expect(plan(f).excludedAssets.has(oldMap)).toBe(true);
    });

  it('retains a whole category after a selector changes or disappears', () => {
    const f = fixture(); f.sources[0].code += '\nconst revision = 2;';
    expect(plan(f).excludedAssets.size).toBe(0);
    expect(plan(f).warnings).toHaveLength(3);
    f.sources.shift();
    expect(plan(f).excludedAssets.size).toBe(0);
  });

  it('retains every candidate for new or changed opaque constructors and syntax/read uncertainty', () => {
    for (const code of ['assetUrl(path);', 'new URL(path, import.meta.url);',
      'const url = `assets/${pack}/old.webp`;', 'const url = "assets/" + name;',
      'import { assetUrl as url } from "./asset-url.js"; url(path);']) {
      const f = fixture();
      f.sources.push({ path: 'game/src/new-lazy-page.js', code });
      expect(plan(f).excludedAssets.size).toBe(0);
      expect(plan(f).warnings[0]).toMatch(/Unreviewed dynamic asset consumer/);
    }
    const moduleSource = fixture();
    moduleSource.sources.push({ path: 'game/src/new.mjs', code: 'import { assetUrl as url } from "./asset-url.mjs"; url(path);' });
    expect(plan(moduleSource).excludedAssets.size).toBe(0);
    const inline = fixture();
    inline.sources.push({ path: 'game/new.html', code: '<script>assetUrl(path);</script>' });
    expect(plan(inline).excludedAssets.size).toBe(0);
    const changed = fixture(); changed.sources[1].code += '\nconst pack = "different";';
    expect(plan(changed).excludedAssets.size).toBe(0);
    const invalid = fixture(); invalid.sources.push({ path: 'game/src/broken.js', code: 'const =' });
    expect(plan(invalid).excludedAssets.size).toBe(0);
    expect(planReviewedRuntimeAssetExclusions(null, {}).excludedAssets.size).toBe(0);
    expect(collectReviewedRuntimeAssetExclusions('/definitely-missing-runtime-review').excludedAssets.size).toBe(0);
  });

  it('does not treat ordinary static assets or unrelated template strings as opaque', () => {
    expect(hasOpaqueAssetPaths('assetUrl("assets/scenes/current.webp");')).toBe(false);
    expect(hasOpaqueAssetPaths('new URL("../assets/scenes/current.webp", import.meta.url);')).toBe(false);
    expect(hasOpaqueAssetPaths('const message = `hello ${name}`;')).toBe(false);
  });

  it('checks the complete Rollup graph including async modules and generated manifests', () => {
    const excluded = new Set([legacy, oldMap]);
    expect(() => assertExcludedRuntimeAssetReferences([], excluded)).not.toThrow();
    expect(() => assertExcludedRuntimeAssetReferences(null, excluded)).toThrow(/complete Rollup module graph/);
    for (const module of [
      { id: '/game/src/async.js', code: `assetUrl('assets/${oldMap}');` },
      { id: `/game/assets/${legacy}?url`, code: '' },
      { id: '/game/src/generated/art-manifest.js', code: JSON.stringify([oldMap]) },
    ]) expect(() => assertExcludedRuntimeAssetReferences([module], excluded)).toThrow(/Excluded runtime asset/);
    expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/scripts/new.js', code: 'assetUrl(path);' }], excluded)).toThrow(/Unscanned dynamic/);
    expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/scripts/new.mjs', code: 'assetUrl(path);' }], excluded)).toThrow(/Unscanned dynamic/);
    expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/new.vue', code: '' }], excluded)).toThrow(/Unsupported runtime source/);
    expect(() => assertExcludedRuntimeAssetReferences(null, new Set())).not.toThrow();
  });

  it('rejects a selection change between early manifest generation and final copy', () => {
    expect(() => assertRuntimeExclusionPlanUnchanged(new Set([legacy]), new Set([legacy]))).not.toThrow();
    expect(() => assertRuntimeExclusionPlanUnchanged(new Set([legacy]), new Set())).toThrow(/changed during build/);
    expect(() => assertRuntimeExclusionPlanUnchanged(new Set([legacy]), new Set([oldMap]))).toThrow(/changed during build/);
  });
});
