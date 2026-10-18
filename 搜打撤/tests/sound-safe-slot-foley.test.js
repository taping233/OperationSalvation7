import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES } from '../game/src/audio/sound.samples.catalog.js';
import { SAMPLE_CUES as BEFORE } from '../docs/evidence/2026-10-18-safe-slot-foley/before/game/src/audio/sound.samples.catalog.js';

const evidence = 'docs/evidence/2026-10-18-safe-slot-foley/';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const expected = {
  safeStore: { files: ['assets/sfx/real-foley/lockbox-turn-06.wav'], gain: 0.18, group: 'ui' },
  safeRetrieve: { files: ['assets/sfx/real-foley/lockbox-unlock-01.wav'], gain: 0.22, group: 'ui' },
};
const pins = [
  { path: 'sfx/real-foley/lockbox-turn-06.wav', original: 'keyhole-lockbox-turn-06.wav', bytes: 123516,
    sha256: '47fba948e9eab77cad4480ce88a75d842ae1fe7e3046fc13446178c4bff5d197' },
  { path: 'sfx/real-foley/lockbox-unlock-01.wav', original: 'keyhole-lockbox-unlock-01.wav', bytes: 131252,
    sha256: '4a8307c941dc56d984fc460b4730b70bf4833252c29922f08457b96d1ce10df0' },
];

describe('safe-slot recorded Foley integration', () => {
  it('changes only safeStore and safeRetrieve, retaining every other cue and old asset', () => {
    expect(readJson(`${evidence}mapping.json`)).toEqual(expected);
    expect(Object.keys(SAMPLE_CUES)).toEqual(Object.keys(BEFORE));
    for (const key of Object.keys(BEFORE)) {
      expect(SAMPLE_CUES[key], key).toEqual(expected[key] || BEFORE[key]);
      for (const file of BEFORE[key].files) expect(existsSync(`game/${file}`)).toBe(true);
    }
    expect(SAMPLE_CUES.gain).toEqual(BEFORE.gain);
    expect(SAMPLE_CUES.hurt).toEqual(BEFORE.hurt);
    expect(SAMPLE_CUES.phaseSelf).toEqual(BEFORE.phaseSelf);
    expect(SAMPLE_CUES.phaseFoe).toEqual(BEFORE.phaseFoe);
  });
  it('adds exactly two pinned original CC0 WAVs without changing previous manifest entries', () => {
    const current = readJson('game/assets/asset-manifest.json');
    const before = readJson(`${evidence}before/game/assets/asset-manifest.json`);
    const receipt = readJson(`${evidence}receipt.json`);
    const paths = pins.map(pin => pin.path);
    expect(receipt.files.map(file => file.path)).toEqual(paths);
    expect(current.assets.filter(item => !paths.includes(item.path))).toEqual(before.assets);
    expect(current.count).toBe(before.count + 2);
    expect(current.count).toBe(current.assets.length);
    for (const pin of pins) {
      const matches = current.assets.filter(item => item.path === pin.path);
      expect(matches).toHaveLength(1);
      expect(matches[0]).toEqual(receipt.files.find(file => file.path === pin.path));
      expect(matches[0]).toMatchObject({ bytes: pin.bytes, sha256: pin.sha256,
        source: 'https://opengameart.org/content/fantasy-accessory-sfx-library',
        original_path: `accessory/sfx/${pin.original}`,
        license: 'CC0 1.0 — Vehicle / Jan Schupke; original recorded Foley',
        processing: 'none; original WAV bytes preserved; runtime gain only' });
      const bytes = readFileSync(`game/assets/${pin.path}`);
      expect(bytes.length).toBe(pin.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(pin.sha256);
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      // Original evidence WAVs stay outside Git; pinned SHA-256 and receipt provenance verify their exact bytes.
    }
  });
  it('retains source licensing and visible credits without claiming listening approval', () => {
    expect(readJson(`${evidence}receipt.json`).listening_verified).toBe(false);
    expect(readFileSync('game/index.html', 'utf8')).toContain('挥动与安全格锁盒：');
    const credits = readFileSync('game/assets/sfx/real-foley/SOURCES.md', 'utf8');
    expect(credits).toContain('keyhole-lockbox-turn-06/unlock-01');
    expect(credits).toContain('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(credits).toContain('本轮未人工耳听');
  });
});
