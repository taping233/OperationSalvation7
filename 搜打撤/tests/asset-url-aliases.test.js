// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../game/src/core/asset-url.js', import.meta.url), 'utf8')
  .replace('export function assetUrl', 'function assetUrl');
const alias = 'assets/portraits/frames/changwuyu/sprite-v1/f000.webp';
const neutral = 'assets/portraits/frames/changwuyu/sprite-v1/neutral.webp';
const canonical = 'assets/portraits/battle/changwuyu.webp';
const createUrl = globals => {
  const context = { ...globals };
  runInNewContext(source + '\nthis.result = assetUrl;', context);
  return context.result;
};

describe('versioned production asset aliases', () => {
  it('keeps dev and unbuilt source URLs, with the existing dev version fallback', () => {
    expect(createUrl({})(alias)).toBe(`${alias}?v=dev`);
    expect(createUrl({ __BUILD_VERSION__: '1', __RUNTIME_ASSET_ALIASES__: {} })(alias)).toBe(`${alias}?v=1`);
  });

  it('maps dynamic animation and neutral fallback URLs to the same verified portrait', () => {
    const aliases = { [alias]: canonical, [neutral]: canonical };
    const url = createUrl({ __BUILD_VERSION__: '1', __RUNTIME_ASSET_ALIASES__: aliases });
    expect(url(alias)).toBe(`${canonical}?v=1`);
    expect(url(neutral)).toBe(`${canonical}?v=1`);
  });

  it('preserves relative/root public-base prefixes, existing queries, and fragment placement', () => {
    const url = createUrl({ __BUILD_VERSION__: 'release', __RUNTIME_ASSET_ALIASES__: { [alias]: canonical } });
    expect(url(`./${alias}`)).toBe(`./${canonical}?v=release`);
    expect(url(`/${alias}?size=large#preview`)).toBe(`/${canonical}?size=large&v=release#preview`);
    expect(url(`${alias}#preview`)).toBe(`${canonical}?v=release#preview`);
    expect(url('assets/unaliased.webp?a=1')).toBe('assets/unaliased.webp?a=1&v=release');
    expect(url(`https://example.test/${alias}`)).toBe(`https://example.test/${alias}?v=release`);
    expect(url(`/other-base/${alias}`)).toBe(`/other-base/${alias}?v=release`);
  });
});
