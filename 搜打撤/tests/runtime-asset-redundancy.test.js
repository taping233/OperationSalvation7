// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertExcludedRuntimeAssetReferences, assertRuntimeExclusionPlanUnchanged,
  collectReviewedRuntimeAssetExclusions, hasOpaqueAssetPaths,
  planReviewedRuntimeAssetExclusions,
} from '../scripts/runtime-asset-redundancy.mjs';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';

const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const hash = code => createHash('sha256').update(code).digest('hex');
const retirementPlan = JSON.parse(readFileSync(new URL('../docs/evidence/2026-10-19-unused-cleanup/deletion-plan.json', import.meta.url), 'utf8'));
const retirementReceipt = JSON.parse(readFileSync(new URL('../docs/evidence/2026-10-19-unused-cleanup/deletion-receipt.json', import.meta.url), 'utf8'));
function expectRetiredAsset(asset) {
  const file = 'game/assets/' + asset;
  const approved = retirementPlan.files.find(entry => entry.path === file);
  expect(approved, file).toBeDefined();
  expect(retirementReceipt.status).toBe('deleted-approved-files');
  expect(retirementReceipt.count).toBe(203);
  expect(retirementReceipt.planSha256).toBe(hash(readFileSync(new URL('../docs/evidence/2026-10-19-unused-cleanup/deletion-plan.json', import.meta.url))));
  expect(retirementReceipt.files.find(entry => entry.path === file)).toEqual(approved);
  expect(existsSync(new URL(`../${file}`, import.meta.url)), file).toBe(false);
}
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
  it('retains every candidate if the reviewed battle-layer asset consumer changes or loses approval', () => {
    const f = fixture();
    const consumerPath = 'game/src/battle/view/battle.layers.js';
    const code = readFileSync(new URL(`../${consumerPath}`, import.meta.url), 'utf8');
    f.sources[1] = { path: consumerPath, code };
    f.review.opaqueConsumers = { [consumerPath]: RUNTIME_REDUNDANCY_REVIEW.opaqueConsumers[consumerPath] };
    expect(plan(f).warnings).toEqual([]);
    expect(plan(f).excludedAssets.size).toBe(3);

    const warning = `Unreviewed dynamic asset consumer ${consumerPath}; retaining reviewed assets.`;
    expect(code).toContain('assetUrl(source)');
    f.sources[1].code = code.replace('assetUrl(source)', 'assetUrl(source + "?guard-negative")');
    expect(plan(f).excludedAssets.size).toBe(0);
    expect(plan(f).warnings).toContain(warning);

    f.sources[1].code = code;
    delete f.review.opaqueConsumers[consumerPath];
    expect(plan(f).excludedAssets.size).toBe(0);
    expect(plan(f).warnings).toContain(warning);
  });

  it('preserves 195 historical exclusions and adds exactly 91 source-retained images', () => {
    expect(RUNTIME_REDUNDANCY_REVIEW.candidates).toHaveLength(286);
    expect(new Set(RUNTIME_REDUNDANCY_REVIEW.candidates.map(candidate => candidate.path)).size).toBe(286);
    const retained = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => candidate.sourceSha256);
    const historical = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(candidate => !candidate.sourceSha256);
    expect(historical).toHaveLength(195);
    expect(retained).toHaveLength(91);
    const chests = historical.filter(candidate => candidate.category === 'chests');
    expect(chests).toHaveLength(90);
    expect(chests.map(candidate => candidate.path).sort()).toEqual(['small', 'medium', 'large', 'class', 'boss']
      .flatMap(kind => Array.from({ length: 18 }, (_, frame) =>
        `scenes/chests/${kind}-rig-640-v1/frame-${String(frame).padStart(2, '0')}.webp`)).sort());
    const current = collectReviewedRuntimeAssetExclusions(projectRoot);
    expect(current.warnings).toEqual([]);
    expect(current.excludedAssets.size).toBe(286);
    for (const asset of current.excludedAssets) {
      expect(asset).not.toMatch(/sprite-v1\/|portraits\/(?:full|battle|avatars)\/|fonts\/|safe-simple-v7\/|symbol-foreground|map-atmosphere|city-ghost-props|transition-.*-v2/);
      const source = retained.find(candidate => candidate.path === asset);
      if (source) {
        const bytes = readFileSync(new URL(`../game/assets/${asset}`, import.meta.url));
        expect(bytes.length).toBe(source.sourceBytes);
        expect(hash(bytes)).toBe(source.sourceSha256);
      } else expectRetiredAsset(asset);
    }
    expect(retained.filter(candidate => candidate.category === 'chests').map(candidate => candidate.path).sort()).toEqual(
      ['small', 'medium', 'large', 'class', 'boss'].flatMap(kind => Array.from({ length: kind === 'large' ? 14 : 18 },
        (_, frame) => `scenes/chests/${kind}-rig-v1/frame-${String(frame).padStart(2, '0')}.webp`)).sort());
    expect(retained.filter(candidate => candidate.category === 'slot-weather').map(candidate => candidate.path).sort()).toEqual(
      ['partly-cloudy', 'rain', 'snow', 'sunny', 'thunder'].map(kind => `ui/slot-weather/${kind}-v1.webp`).sort());
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
        expectRetiredAsset(asset);
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

  it('accepts only static license URLs and inert raw SVG exports while rejecting restored asset references', () => {
    const excluded = new Set([oldMap]);
    const module = { id: '/game/src/ui/vendor/layers-plus.svg?raw',
      code: `export default ${JSON.stringify('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1" /></svg>')};` };
    expect(() => assertExcludedRuntimeAssetReferences([module], excluded)).not.toThrow();
    const license = { id: '/game/src/ui/vendor/LICENSE.txt?url&no-inline', code: 'export default "assets/LICENSE-review.txt";' };
    expect(() => assertExcludedRuntimeAssetReferences([license], excluded)).not.toThrow();
    expect(() => assertExcludedRuntimeAssetReferences([{ ...license, code: `export default ${JSON.stringify(oldMap)};` }], excluded)).toThrow(/Excluded runtime asset/);
    expect(() => assertExcludedRuntimeAssetReferences([{ ...license, code: 'export default loadText();' }], excluded)).toThrow(/Unsupported runtime source/);
    expect(() => assertExcludedRuntimeAssetReferences([{ ...license, id: '/game/src/ui/vendor/LICENSE.txt?raw' }], excluded)).toThrow(/Unsupported runtime source/);
    const referenced = { ...module, code: `export default ${JSON.stringify(`<svg><desc>${oldMap}</desc></svg>`)};` };
    expect(() => assertExcludedRuntimeAssetReferences([referenced], excluded)).toThrow(/Excluded runtime asset/);
    for (const changed of [
      { ...module, id: '/game/src/icon.svg?url' },
      { ...module, id: '/game/src/new.vue?raw' },
      { ...module, code: 'export default loadDynamicSvg();' },
      ...['<svg><script>load()</script></svg>', '<svg onload="load()"></svg>',
        '<svg><image href="image.webp" /></svg>', '<svg><path style="fill:url(asset)" /></svg>']
        .map(svg => ({ ...module, code: `export default ${JSON.stringify(svg)};` })),
    ]) expect(() => assertExcludedRuntimeAssetReferences([changed], excluded)).toThrow(/Unsupported runtime source/);
  });
});

it('pins indirect URL inputs even when their change has no recognizable asset constructor', () => {
  const f = fixture();
  const dependency = { path: 'game/src/catalog.js', code: 'export const names = ["current"];' };
  f.sources.push(dependency);
  f.review.opaqueConsumerDependencies = { [f.sources[1].path]: { [dependency.path]: hash(dependency.code) } };
  expect(plan(f).excludedAssets.size).toBe(3);
  dependency.code = 'export const names = ["portraits", "frames", "wu", "idle.webp"].join("/");';
  expect(hasOpaqueAssetPaths(dependency.code)).toBe(false);
  expect(plan(f).excludedAssets.size).toBe(0);
  expect(plan(f).warnings.join(' ')).toContain('asset path dependency');
});
it('retains all candidates when an explicit path dependency or its owning consumer is missing', () => {
  const f = fixture();
  const dependency = { path: 'game/src/catalog.js', code: 'export const names = ["current"];' };
  f.sources.push(dependency);
  const consumer = f.sources[1];
  f.review.opaqueConsumerDependencies = { [consumer.path]: { [dependency.path]: hash(dependency.code) } };
  expect(plan(f).warnings).toEqual([]);
  const complete = f.sources;
  for (const missing of [consumer.path, dependency.path]) {
    f.sources = complete.filter(source => source.path !== missing);
    expect(plan(f).excludedAssets.size).toBe(0);
    expect(plan(f).warnings.join(' ')).toContain(missing);
  }
  f.sources = complete; consumer.code += '\n// a later revision';
  expect(plan(f).excludedAssets.size).toBe(0);
});
it('explicit indirect inputs retain normalized CRLF equivalence and invalidate between calls', () => {
  const f = fixture();
  const dependency = { path: 'game/src/catalog.js', code: 'export const names = [];\n' };
  f.sources.push(dependency);
  f.review.opaqueConsumerDependencies = { [f.sources[1].path]: { [dependency.path]: hash(dependency.code) } };
  dependency.code = dependency.code.replaceAll('\n', '\r\n');
  expect(plan(f).excludedAssets.size).toBe(3);
  dependency.code += '// changed';
  expect(plan(f).excludedAssets.size).toBe(0);
});
it('keeps the reviewed sample callback and catalog in the explicit sound path dependency set', () => {
  const dependencies = RUNTIME_REDUNDANCY_REVIEW.opaqueConsumerDependencies['game/src/audio/sound.js'];
  expect(Object.keys(dependencies).sort()).toEqual([
    'game/src/audio/sound.samples.catalog.js', 'game/src/audio/sound.samples.player.js',
  ]);
  for (const [file, expected] of Object.entries(dependencies)) {
    expect(hash(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n'))).toBe(expected);
  }
});


describe('retained high-resolution chest and inline-replaced weather sources', () => {
  const roots = [];
  afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
  const chest = 'scenes/chests/small-rig-v1/frame-00.webp';
  const alias = 'scenes/chests/small-rig-v1/frame-01.webp';
  const weather = 'ui/slot-weather/rain-v1.webp';
  const selectors = ['game/src/run/chest-opening-art.js', 'game/src/ui/slot-emblems.js', 'game/src/ui/game.menu.pages.js'];
  function retainedFixture() {
    const sources = selectors.map((filename, i) => ({ path: filename, code: `export const current = ${i};` }));
    const body = Buffer.from('reviewed image\r\n');
    const candidates = [chest, alias, weather].map(asset => ({ path: asset,
      category: asset === weather ? 'slot-weather' : 'chests', sourceBytes: body.length, sourceSha256: hash(body) }));
    const review = { candidates, consumerFingerprints: {
      chests: { [selectors[0]]: hash(sources[0].code) },
      'slot-weather': Object.fromEntries(sources.slice(1).map(source => [source.path, hash(source.code)])),
    }, opaqueConsumers: {} };
    const sourceAssets = new Map(candidates.map(candidate => [candidate.path,
      { bytes: candidate.sourceBytes, sha256: candidate.sourceSha256 }]));
    return { sources, review, sourceAssets, body };
  }
  const inspect = f => planReviewedRuntimeAssetExclusions(f.sources, {}, f.review, f.sourceAssets);

  it('requires valid fixed source bytes, retains the whole affected family, and leaves other families independent', () => {
    expect(inspect(retainedFixture()).excludedAssets.size).toBe(3);
    for (const mutate of [
      f => { f.sourceAssets.delete(chest); },
      f => { f.sourceAssets.set(chest, { bytes: f.body.length, sha256: hash('redrawn') }); },
      f => { f.sourceAssets.set(chest, { bytes: 1, sha256: hash(f.body) }); },
      f => { delete f.review.candidates[0].sourceSha256; },
      f => { delete f.review.candidates[0].sourceBytes; },
      f => { f.review.candidates[0].sourceBytes = -1; },
      f => { f.review.candidates[0].sourceSha256 = 'not-a-digest'; },
    ]) {
      const f = retainedFixture(); mutate(f);
      expect([...inspect(f).excludedAssets]).toEqual([weather]);
      expect(inspect(f).warnings.join(' ')).toContain('reviewed source bytes for original-chest-rigs');
    }
    const f = retainedFixture(); f.sourceAssets.delete(weather);
    expect([...inspect(f).excludedAssets]).toEqual([chest, alias]);
    for (const sourceAssets of [null, undefined, {}]) {
      expect(planReviewedRuntimeAssetExclusions(f.sources, {}, f.review, sourceAssets).excludedAssets.size).toBe(0);
    }
  });

  it('retains split directory/token references and rejects asset-root arrays, including raw image.src joins', () => {
    for (const code of [
      'const restored = "small-rig-v1";',
      'const restored = [kind, "rig-v1"].join("-");',
      'const restored = ["ui", "slot-weather", weather + "-v1.webp"].join("/");',
      'const restored = "ui/slot-" + "weather/" + weather + "-v1.webp";',
      'image.src = ["assets", "ui", "slot-weather", weather + "-v1.webp"].join("/");',
      'image.src = ["assets", "ui", "slot-" + "weather", name].join("/");',
      'image.src = ["assets", name].join("/");',
    ]) {
      const f = retainedFixture(); f.sources.push({ path: 'game/src/lazy-restored.js', code });
      const p = inspect(f);
      if (code.includes('rig-v1')) {
        expect(p.excludedAssets.has(chest)).toBe(false); expect(p.excludedAssets.has(alias)).toBe(false);
      } else expect(p.excludedAssets.has(weather)).toBe(false);
    }
    expect(hasOpaqueAssetPaths('image.src = ["assets", name].join("/");')).toBe(true);
    expect(hasOpaqueAssetPaths('image.src = ["assets", name]["join"]("/");')).toBe(true);
    for (const root of ['./assets', '../assets', '../../assets', '/assets', '.\\assets', '..\\assets']) {
      const code = `image.src = [${JSON.stringify(root)}, "ui", "slot-" + "weather", name].join("/");`;
      const f = retainedFixture(); f.sources.push({ path: 'game/src/relative-restored.js', code });
      expect(hasOpaqueAssetPaths(code), root).toBe(true);
      expect(inspect(f).excludedAssets.size, root).toBe(0);
      expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/virtual-relative.js', code }], new Set([weather])))
        .toThrow(/Joined asset root/);
    }
    for (const join of ['join("")', 'join(separator)', 'join()']) {
      const code = `image.src = ["./assets/", "ui/", "slot-" + "weather/", name].${join};`;
      const f = retainedFixture(); f.sources.push({ path: 'game/src/joined-restored.js', code });
      expect(hasOpaqueAssetPaths(code), join).toBe(true);
      expect(inspect(f).excludedAssets.size, join).toBe(0);
      expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/virtual-joined.js', code }], new Set([weather])))
        .toThrow(/Joined asset root/);
    }
    expect(hasOpaqueAssetPaths('const label = ["hello", name].join(" ");')).toBe(false);
  });

  it('retains weather after either SVG selector changes/disappears without loosening the chest source guard', () => {
    for (const filename of selectors.slice(1)) {
      for (const missing of [false, true]) {
        const f = retainedFixture();
        f.sources = missing ? f.sources.filter(source => source.path !== filename)
          : f.sources.map(source => source.path === filename ? { ...source, code: source.code + '\n// revision' } : source);
        expect([...inspect(f).excludedAssets]).toEqual([chest, alias]);
      }
    }
  });

  it('rereads binary bytes on every collection; redrawn, missing and unreadable sources restore their family', () => {
    const f = retainedFixture(); const root = mkdtempSync(path.join(tmpdir(), 'asset-source-guard-')); roots.push(root);
    for (const directory of ['game/src', 'game/data', 'game/css']) mkdirSync(path.join(root, directory), { recursive: true });
    for (const source of f.sources) {
      const target = path.join(root, source.path); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, source.code);
    }
    for (const candidate of f.review.candidates) {
      const target = path.join(root, 'game/assets', candidate.path); mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, f.body);
    }
    const collect = () => collectReviewedRuntimeAssetExclusions(root, f.review);
    const target = path.join(root, 'game/assets', chest);
    expect(collect().excludedAssets.size).toBe(3);
    writeFileSync(target, Buffer.from('redrawn image!\r\n'));
    expect([...collect().excludedAssets]).toEqual([weather]);
    writeFileSync(target, f.body); expect(collect().excludedAssets.size).toBe(3);
    // Binary hashes do not inherit the LF/CRLF normalization used for JS selectors.
    writeFileSync(target, f.body.toString().replaceAll('\r\n', '\n'));
    expect([...collect().excludedAssets]).toEqual([weather]);
    rmSync(target); expect([...collect().excludedAssets]).toEqual([weather]);
    mkdirSync(target); expect([...collect().excludedAssets]).toEqual([weather]);
  });

  it('preserves active safe/supply frames and rejects late restored family tokens and root joins in the graph', () => {
    const excluded = new Set([chest, alias, weather]);
    const safe = { id: '/game/src/current.js', code: 'const current = ["safe-simple-v7/frame-00.webp", "supply-opening-v6/small/frame-01.webp"];' };
    expect(() => assertExcludedRuntimeAssetReferences([safe], excluded)).not.toThrow();
    for (const code of ['const rig = "rig-v1";', 'const directory = "slot-weather";',
      'image.src = ["assets", "ui", "slot-" + "weather", name].join("/");']) {
      expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/virtual-lazy.js', code }], excluded))
        .toThrow(/Excluded runtime asset|Joined asset root/);
    }
  });
});
