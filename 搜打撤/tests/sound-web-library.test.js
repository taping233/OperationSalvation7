// @vitest-environment node
// Historical 19:58 integration snapshot; superseded by the Mixkit selection.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES } from '../docs/evidence/2026-10-18-premium-ui-sfx/before.catalog.js';
import { SAMPLE_CUES as BEFORE } from '../docs/evidence/2026-10-18-web-sfx-replacement/before.catalog.js';

const evidence = 'docs/evidence/2026-10-18-web-sfx-replacement/';
const json = file => JSON.parse(readFileSync(file, 'utf8'));
const receipt = json(`${evidence}receipt.json`);

describe('new online sound library integration', () => {
  it('replaces every event and retains phase routing, groups and lunge cap', () => {
    expect(Object.keys(SAMPLE_CUES)).toEqual(Object.keys(BEFORE));
    expect(SAMPLE_CUES).toEqual(json(`${evidence}mapping.json`));
    const oldHashes = new Set(Object.values(BEFORE).flatMap(cue => cue.files).map(file => createHash('sha256').update(readFileSync(`game/${file}`)).digest('hex')));
    for (const [id, cue] of Object.entries(SAMPLE_CUES)) {
      expect(cue.group).toBe(BEFORE[id].group);
      for (const file of cue.files) {
        expect(file).toMatch(/^assets\/sfx\/web-foley-1018\//);
        expect(oldHashes.has(createHash('sha256').update(readFileSync(`game/${file}`)).digest('hex'))).toBe(false);
      }
    }
    expect(SAMPLE_CUES.foeLunge.maxDuration).toBe(.22);
    expect(SAMPLE_CUES.shieldUp.maxDuration).toBe(.42);
    expect(SAMPLE_CUES.attackSlash.files).not.toEqual(SAMPLE_CUES.attackArrow.files);
    expect(SAMPLE_CUES.attackBlunt.files).not.toEqual(SAMPLE_CUES.attackPierce.files);
  });
  it('keeps clicks short and routine rewards separate from rare and victory cues', () => {
    const click = receipt.files.find(file => `assets/${file.path}` === SAMPLE_CUES.click.files[0]);
    expect(click.duration).toBeLessThanOrEqual(.1);
    const ids = ['click', 'gain', 'coin', 'ding', 'legend', 'victory'];
    expect(new Set(ids.map(id => SAMPLE_CUES[id].files.join(','))).size).toBe(ids.length);
    expect(SAMPLE_CUES.hover.gain).toBeLessThan(SAMPLE_CUES.click.gain);
  });
  it('pins downloaded source and runtime bytes and retains prior audio records', () => {
    const manifest = json('game/assets/asset-manifest.json');
    const before = json(`${evidence}before.manifest.json`);
    for (const asset of before.assets.filter(item => item.path.startsWith('sfx/'))) expect(manifest.assets.find(item => item.path === asset.path)).toEqual(asset);
    expect(manifest.count).toBe(manifest.assets.length);
    for (const file of receipt.files) {
      const bytes = readFileSync(`game/assets/${file.path}`);
      expect(bytes.length).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      expect(file.source).toMatch(/^https:\/\/opengameart.org\//);
      expect(file.source_sha256).toMatch(/^[a-f0-9]{64}$/);
      expect(file.license).toContain('CC0 1.0');
      expect(file.peak_dbfs).toBeLessThan(-7);
      expect(file.duration).toBeLessThanOrEqual(1);
    }
    expect(receipt.listening_verified).toBe(false);
  });
});
