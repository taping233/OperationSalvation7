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

describe('reviewed production-only asset omissions', () => {
  it('contains exactly the 56 independently reviewed paths, never sprite-v1, skins, fonts or active scenery', () => {
    expect(RUNTIME_REDUNDANCY_REVIEW.candidates).toHaveLength(56);
    expect(new Set(RUNTIME_REDUNDANCY_REVIEW.candidates.map(candidate => candidate.path)).size).toBe(56);
    const current = collectReviewedRuntimeAssetExclusions(projectRoot);
    expect(current.warnings).toEqual([]);
    expect(current.excludedAssets.size).toBe(56);
    for (const asset of current.excludedAssets) {
      expect(asset).not.toMatch(/sprite-v1\/|portraits\/(?:full|battle|avatars)\/|fonts\/|symbol-foreground|map-atmosphere|city-ghost-props|transition-.*-v2/);
      expect(readFileSync(new URL(`../game/assets/${asset}`, import.meta.url)).byteLength).toBeGreaterThan(0);
    }
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
