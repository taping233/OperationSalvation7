// @vitest-environment node
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { serializeAssetManifest } from '../scripts/asset-manifest-source.mjs';

const evaluate = source => Array.from(runInNewContext(source.replace('export default ', 'globalThis.result = ')));

describe('asset manifest source', () => {
  it.each([
    [],
    ['plain.webp'],
    ['cards/a.webp', 'scenes/b.png', 'cards/a.webp', 'cards/c.webp'],
    ['cards/中文.webp', 'cards/quote".webp', 'cards/slash\\.png', 'cards/new\nline.gif'],
    Array.from({ length: 20 }, (_, i) => `portraits/frames/hero/sprite-v1/frame-${i}.webp`),
  ].map(files => ({ files })))('preserves the complete ordered array and duplicate entries ($files)', ({ files }) => {
    expect(evaluate(serializeAssetManifest(files))).toEqual(files);
  });

  it('keeps complete filenames visible to the asset exclusion guard', () => {
    const files = Array.from({ length: 20 }, (_, i) => `portraits/frames/hero/sprite-v1/frame-${i}.webp`);
    const source = serializeAssetManifest(files, { header: '// generated source\n' });
    expect(source.startsWith('// generated source\n')).toBe(true);
    for (const file of files) expect(source).toContain(JSON.stringify(file.split('/').at(-1)));
    expect(source.length).toBeLessThan(`export default ${JSON.stringify(files, null, 2)};\n`.length);
    expect(files).toHaveLength(20);
  });
});
