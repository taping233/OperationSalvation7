// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { RUNTIME_REDUNDANCY_REVIEW } from '../scripts/runtime-asset-redundancy-review.mjs';
import { assertExcludedRuntimeAssetReferences, planReviewedRuntimeAssetExclusions } from '../scripts/runtime-asset-redundancy.mjs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url));
const hash = text => createHash('sha256').update(text).digest('hex');
const receipt = JSON.parse(read('docs/evidence/2026-10-16-WF-cloud-retired-scenes/receipt.json'));
const deletionPlan = JSON.parse(read('docs/evidence/2026-10-19-unused-cleanup/deletion-plan.json'));
const deletionReceipt = JSON.parse(read('docs/evidence/2026-10-19-unused-cleanup/deletion-receipt.json'));
const candidates = RUNTIME_REDUNDANCY_REVIEW.candidates.filter(item => item.category === 'retired-scenes');
const active = [
  ...['00', '01', '02', '03'].map(frame => `scenes/chests/safe-simple-v7/frame-${frame}.webp`),
  'scenes/chests/safe-simple-v7/burst.webp', 'scenes/entry/modern-winter-entry-1011-v2.webp',
  'scenes/battle/stage-reset-1015/backdrop.webp', 'scenes/battle/stage-reset-1015/ground.webp',
  'scenes/battle/stage-reset-1015/foreground.webp', 'scenes/battle/winter-street-1011-v2.webp',
  'scenes/battle/frozen-ruins-1015.webp', 'scenes/battle/contaminated-core-1015.webp',
];
function fixture() {
  const selector = { path: 'game/src/selector.js', code: `const current = ${JSON.stringify(active)};` };
  const mapping = { path: 'game/data/art-mapping.json', code: '{"eventCardArt":{"current":"event-current"}}' };
  return { sources: [selector, mapping], review: { candidates,
    consumerFingerprints: { 'retired-scenes': { [selector.path]: hash(selector.code), [mapping.path]: hash(mapping.code) } },
    opaqueConsumers: {} } };
}
const inspect = f => planReviewedRuntimeAssetExclusions(f.sources, {}, f.review);

describe('exact retired scene publication review', () => {
  it('registers exactly the 19 retired R2 paths and verifies their approved deletion fingerprints', () => {
    expect(candidates).toHaveLength(19);
    expect(candidates.map(item => `assets/${item.path}`)).toEqual(receipt.files.map(item => item.path));
    expect(receipt.bytes).toBe(3428566);
    for (const item of receipt.files) {
      const file = `game/${item.path}`;
      const approved = deletionPlan.files.find(entry => entry.path === file);
      expect(approved, file).toBeDefined();
      expect(approved.bytes).toBe(item.bytes);
      expect(approved.sha256).toBe(item.sha256);
      expect(deletionReceipt.status).toBe('deleted-approved-files');
      expect(deletionReceipt.planSha256).toBe(hash(read('docs/evidence/2026-10-19-unused-cleanup/deletion-plan.json')));
      expect(deletionReceipt.files.find(entry => entry.path === file)).toEqual(approved);
      expect(existsSync(new URL(`../${file}`, import.meta.url)), file).toBe(false);
    }
  });

  it('fingerprints the scene constructors and DATA mapping, preserving all current scene variants', () => {
    const fingerprints = RUNTIME_REDUNDANCY_REVIEW.consumerFingerprints['retired-scenes'];
    expect(fingerprints['game/data/art-mapping.json']).toBeDefined();
    expect(fingerprints['game/src/core/art.js']).toBeDefined();
    for (const [file, fingerprint] of Object.entries(fingerprints)) {
      expect(hash(read(file).toString().replaceAll('\r\n', '\n')), file).toBe(fingerprint);
    }
    const omitted = inspect(fixture()).excludedAssets;
    expect(omitted.size).toBe(19);
    for (const asset of active) {
      expect(read(`game/assets/${asset}`).length).toBeGreaterThan(0);
      expect(omitted.has(asset)).toBe(false);
    }
    expect(() => assertExcludedRuntimeAssetReferences([{ id: '/game/src/current.js', code: JSON.stringify(active) }], omitted)).not.toThrow();
  });

  it('restores new static references and rejects them in the complete async module graph', () => {
    for (const { path: asset } of candidates) {
      const f = fixture();
      const module = { id: '/game/src/lazy-restored.js', code: `new URL('../assets/${asset}', import.meta.url);` };
      f.sources.push({ path: 'game/src/lazy-restored.js', code: module.code });
      expect(inspect(f).excludedAssets.has(asset)).toBe(false);
      expect(() => assertExcludedRuntimeAssetReferences([module], new Set([asset]))).toThrow(/Excluded runtime asset/);
    }
  });

  it('retains the category for changed mappings or selectors and all assets for new opaque consumers', () => {
    for (const index of [0, 1]) {
      const f = fixture(); f.sources[index].code += '\n ';
      expect(inspect(f).excludedAssets.size).toBe(0);
      expect(inspect(f).warnings[0]).toMatch(/Changed\/missing retired-scenes selector/);
    }
    const f = fixture();
    f.sources.push({ path: 'game/src/new.js', code: 'assetUrl(`assets/scenes/${name}.webp`);' });
    expect(inspect(f).excludedAssets.size).toBe(0);
    expect(inspect(f).warnings[0]).toMatch(/Unreviewed dynamic asset consumer/);
  });
});
