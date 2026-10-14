// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { minifyStandaloneCssAssets } from '../scripts/css-asset-minification.mjs';

function cssAsset(source, fileName = 'assets/runtime-abc.css') {
  return { type: 'asset', fileName, originalFileNames: ['css/runtime.css'], source };
}

async function runPlugin(bundle, build = {}) {
  const plugin = minifyStandaloneCssAssets();
  plugin.configResolved({ build: {
    cssTarget: ['chrome87', 'edge88', 'firefox78', 'safari14'], ...build,
  } });
  await plugin.generateBundle.handler.call({ warn() {} }, {}, bundle);
  return bundle;
}

describe('standalone CSS asset whitespace minification', () => {
  it('preserves selectors, fallback/cascade order, animation names, relative URLs and legal comments', async () => {
    const source = `/*! @license Example MIT */
      /* ordinary implementation notes */
      @import url("../theme.css?version=2");
      .panel { display: block; display: flex; background: url("../art/sprite.webp?x=1#view"); }
      .panel { color: #ffffff; animation: unchanged-name 1s linear; }
      .panel { color: #000000; }
      @keyframes unchanged-name { from { opacity: 0; } to { opacity: 1; } }
      @media (prefers-reduced-motion: reduce) { .panel { animation: none; } }`;
    const asset = cssAsset(source);
    const bundle = { [asset.fileName]: asset };
    await runPlugin(bundle);
    expect(asset.fileName).toBe('assets/runtime-abc.css');
    expect(asset.source).toContain('/*! @license Example MIT */');
    expect(asset.source).not.toContain('ordinary implementation notes');
    expect(asset.source).toContain('../theme.css?version=2');
    expect(asset.source).toContain('../art/sprite.webp?x=1#view');
    expect(asset.source).toContain('display:block;display:flex');
    expect(asset.source).toContain('color:#ffffff');
    expect(asset.source.indexOf('color:#ffffff')).toBeLessThan(asset.source.indexOf('color:#000000'));
    expect(asset.source).toContain('@keyframes unchanged-name');
    expect(asset.source).toContain('@media(prefers-reduced-motion:reduce)');
  });

  it('handles byte assets while preserving custom property values and inline image data', async () => {
    const svg = 'data:image/svg+xml,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22/%3E';
    const asset = cssAsset(Buffer.from(`.panel { --art-label: "原画"; mask: url("${svg}"); }`));
    await runPlugin({ [asset.fileName]: asset });
    expect(asset.source).toContain('--art-label: "原画"');
    expect(asset.source).toContain(svg);
  });

  it('leaves mapped, non-CSS, already-bundled and unmarked-license assets unchanged', async () => {
    const withMap = cssAsset('.panel { color: red; }', 'assets/mapped.css');
    const inlineMap = cssAsset('.panel { color: red; } /*# sourceMappingURL=data:application/json;base64,e30= */', 'assets/inline.css');
    const externalMap = cssAsset('.panel { color: red; } /*# sourceMappingURL=elsewhere.map */', 'assets/external.css');
    const license = cssAsset('/* Copyright Example; MIT License */ .panel { color: red; }', 'assets/license.css');
    const bundled = { ...cssAsset('.panel { color: red; }', 'assets/index.css'), originalFileNames: ['index.html'] };
    const image = { type: 'asset', fileName: 'assets/art.svg', originalFileNames: ['art.svg'], source: '<svg />' };
    const chunk = { type: 'chunk', fileName: 'assets/main.js', code: 'unchanged' };
    const assets = [withMap, inlineMap, externalMap, license, bundled, image, chunk];
    const before = assets.map(asset => ({ ...asset }));
    const bundle = Object.fromEntries(assets.map(asset => [asset.fileName, asset]));
    bundle['assets/mapped.css.map'] = { type: 'asset', fileName: 'assets/mapped.css.map', source: '{}' };
    await runPlugin(bundle);
    expect(assets).toEqual(before);
  });

  it.each([{ sourcemap: true }, { sourcemap: 'hidden' }, { cssMinify: false }])(
    'respects build debugging settings %j', async (build) => {
      const asset = cssAsset('.panel { color: red; }');
      await runPlugin({ [asset.fileName]: asset }, build);
      expect(asset.source).toBe('.panel { color: red; }');
    },
  );

  it('reduces actual runtime CSS payload without changing any source files', async () => {
    let before = 0;
    let after = 0;
    for (const name of ['home-polish', 'motion-transitions', 'home-menu-motion', 'home-layers', 'interface-motion']) {
      const source = readFileSync(new URL(`../game/css/${name}.css`, import.meta.url), 'utf8');
      const asset = { ...cssAsset(source, `assets/${name}-test.css`), originalFileNames: [`css/${name}.css`] };
      await runPlugin({ [asset.fileName]: asset });
      expect(readFileSync(new URL(`../game/css/${name}.css`, import.meta.url), 'utf8')).toBe(source);
      before += gzipSync(source).length;
      after += gzipSync(asset.source).length;
    }
    expect(after).toBeLessThan(before);
  });
});
