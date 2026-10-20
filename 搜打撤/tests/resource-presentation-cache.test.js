// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import frames from '../game/data/card-frame-layout.json';
const urlSource = readFileSync(new URL('../game/src/core/asset-url.js', import.meta.url), 'utf8').replace('export function', 'function');
const frameSource = readFileSync(new URL('../game/src/cards/card-frame-presentation.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '').replace('export function', 'function');
function urlModule(version = 'dev', aliases = {}) {
  return new Function('__BUILD_VERSION__', '__RUNTIME_ASSET_ALIASES__', `${urlSource}\nreturn { assetUrl, urlMemo };`)(version, aliases);
}
describe('bounded runtime URL calculation cache', () => {
  it('keys complete art revision, prefix, query and fragment without conflation', () => {
    const { assetUrl, urlMemo } = urlModule('166', { 'assets/a.webp': 'assets/b.webp' });
    for (const suffix of ['', '?art=1', '?art=2', '?art=1#x', '#x']) {
      const input = `assets/a.webp${suffix}`;
      expect(assetUrl(input)).toBe(assetUrl(input));
    }
    expect(urlMemo.size).toBe(5);
    expect(assetUrl('assets/a.webp?art=2#x')).toBe('assets/b.webp?art=2&v=166#x');
  });
  it('bounds count and long custom URLs, while evicted inputs recompute correctly', () => {
    const { assetUrl, urlMemo } = urlModule();
    for (let i = 0; i < 1200; i++) assetUrl(`assets/${i}.webp`);
    expect(urlMemo.size).toBe(1024);
    expect(urlMemo.has('assets/0.webp')).toBe(false);
    expect(assetUrl('assets/0.webp')).toBe('assets/0.webp?v=dev');
    const long = `assets/${'x'.repeat(1100)}.webp`;
    expect(assetUrl(long)).toBe(`${long}?v=dev`);
    expect(urlMemo.has(long)).toBe(false);
    expect(urlMemo.size).toBe(1024);
    const largeAlias = urlModule('1', { 'assets/a': long });
    expect(largeAlias.assetUrl('assets/a')).toBe(`${long}?v=1`);
    expect(largeAlias.urlMemo.size).toBe(0);
  });
  it('reinitializes build aliases and version on module replacement; invalid input never poisons cache', () => {
    expect(urlModule('1', { 'assets/a': 'assets/b' }).assetUrl('assets/a')).toBe('assets/b?v=1');
    const next = urlModule('2', { 'assets/a': 'assets/c' });
    expect(next.assetUrl('assets/a')).toBe('assets/c?v=2');
    expect(() => next.assetUrl(null)).toThrow();
    expect(next.urlMemo.size).toBe(1);
  });
});
describe('finite frame presentation cache', () => {
  it('calculates each resolved frame once, while returning independent objects', () => {
    let calls = 0;
    const assetUrl = p => { calls++; return `${p}?v=test`; };
    const present = new Function('frames', 'assetUrl', `${frameSource}\nreturn cardFramePresentation;`)(frames, assetUrl);
    const first = present('稀有');
    const second = present('稀有');
    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    first.style = 'changed'; first.src = 'changed';
    expect(present('稀有')).toEqual(second);
    expect(calls).toBe(1);
    for (let i = 0; i < 1000; i++) present(`unknown-${i}`, `unknown-${i}`);
    expect(calls).toBe(2);
    expect(present('职业', '__proto__').key).toBe('neutral');
    expect(present('constructor').key).toBe('initial');
  });
  it('does not retain a failed URL calculation', () => {
    let attempts = 0;
    const present = new Function('frames', 'assetUrl', `${frameSource}\nreturn cardFramePresentation;`)(frames, p => {
      if (++attempts === 1) throw new Error('temporary');
      return p;
    });
    expect(() => present('古朴')).toThrow('temporary');
    expect(present('古朴').key).toBe('common');
    expect(attempts).toBe(2);
  });
});
