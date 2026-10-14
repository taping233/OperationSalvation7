// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { includeRuntimeThumbnailMetadata } from '../scripts/runtime-asset-publication.mjs';

const oldArt = 'cards/expedition-starters/rations.webp';
const canonicalArt = 'cards/resources/ration.webp';
const makeUrl = aliases => {
  const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../game/src/core/asset-url.js'), 'utf8')
    .replace('export function assetUrl', 'function assetUrl');
  const context = { __BUILD_VERSION__: 'review', __RUNTIME_ASSET_ALIASES__: Object.fromEntries(aliases) };
  runInNewContext(source + '\nthis.assetUrl = assetUrl;', context);
  return context.assetUrl;
};
afterEach(() => {
  for (const module of ['../game/src/core/asset-url.js', '../game/src/generated/thumb-manifest.js', '../game/src/generated/art-manifest.js']) vi.doUnmock(module);
  vi.resetModules();
});
async function art(aliased = true) {
  vi.resetModules();
  const aliases = new Map(aliased ? [
    [`assets/${oldArt}`, `assets/${canonicalArt}`],
    [`assets/thumbs/${oldArt}`, `assets/thumbs/${canonicalArt}`],
  ] : []);
  const relativeAliases = new Map([...aliases].map(([from, to]) => [from.slice('assets/'.length), to.slice('assets/'.length)]));
  const omitted = new Set(relativeAliases.keys());
  const thumbPaths = [oldArt, canonicalArt].filter(file => includeRuntimeThumbnailMetadata(file, omitted, relativeAliases));
  vi.doMock('../game/src/core/asset-url.js', () => ({ assetUrl: makeUrl(aliases) }));
  vi.doMock('../game/src/generated/thumb-manifest.js', () => ({ default: thumbPaths }));
  vi.doMock('../game/src/generated/art-manifest.js', () => ({ default: [aliased ? canonicalArt : oldArt] }));
  await import('../game/src/core/art.js');
  return (await import('../game/src/core/sdt-facade.js')).default.Art;
}
const ration = { id: 'tt-rations', name: '口粮', type: '资源' };
const src = html => /src="([^"]+)"/.exec(html)?.[1];

describe('rations canonical bytes preserve thumbnail selection', () => {
  it('retains the logical old thumbnail key even while only canonical bytes are published', () => {
    const aliases = new Map([[`thumbs/${oldArt}`, `thumbs/${canonicalArt}`]]);
    expect(includeRuntimeThumbnailMetadata(oldArt, new Set(aliases.keys()), aliases)).toBe(true);
    expect(includeRuntimeThumbnailMetadata(oldArt, new Set(aliases.keys()), new Map())).toBe(false);
    expect(includeRuntimeThumbnailMetadata(canonicalArt, new Set(aliases.keys()), aliases)).toBe(true);
  });

  it('renders actual low/deferred cardIcon into the canonical thumbnail, while high/zoom uses the original', async () => {
    const Art = await art();
    expect(src(Art.cardIcon(ration, { low: true }))).toBe(`assets/thumbs/${canonicalArt}?v=review`);
    const deferred = Art.cardIcon(ration, { low: true, defer: true });
    expect(deferred).toContain(`data-lib-src="assets/thumbs/${canonicalArt}?v=review"`);
    expect(src(Art.cardIcon(ration))).toBe(`assets/${canonicalArt}?v=review`);
    expect(src(Art.cardIcon(ration, { low: false }))).toBe(`assets/${canonicalArt}?v=review`);
    expect(Art.collectThumbnailAssets()).toEqual([
      `assets/thumbs/${canonicalArt}?v=review`, `assets/thumbs/${canonicalArt}?v=review`,
    ]);
    expect([...new Set(Art.collectThumbnailAssets())]).toHaveLength(1);
    expect(Art.collectManifestAssets()).toEqual([`assets/${canonicalArt}?v=review`]);
  });

  it('restores independent thumbnail/original paths when the source or canonical bytes diverge', async () => {
    const Art = await art(false);
    expect(src(Art.cardIcon(ration, { low: true }))).toBe(`assets/thumbs/${oldArt}?v=review`);
    expect(src(Art.cardIcon(ration))).toBe(`assets/${oldArt}?v=review`);
    expect(Art.collectThumbnailAssets()).toContain(`assets/thumbs/${oldArt}?v=review`);
  });

  it('retains art-revision queries before the stable build version when aliases are applied', () => {
    const url = makeUrl(new Map([[`assets/${oldArt}`, `assets/${canonicalArt}`]]));
    expect(url(`assets/${oldArt}?art=redraw#zoom`)).toBe(`assets/${canonicalArt}?art=redraw&v=review#zoom`);
  });
});
