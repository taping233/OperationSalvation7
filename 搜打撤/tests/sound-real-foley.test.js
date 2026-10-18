import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES } from '../game/src/audio/sound.samples.catalog.js';
import { SAMPLE_CUES as BEFORE } from '../docs/evidence/2026-10-17-real-foley-batch/before/sound.samples.catalog.js';
const evidence = 'docs/evidence/2026-10-17-real-foley-batch/';
const readJson = path => JSON.parse(readFileSync(path, 'utf8'));
const mapping = readJson(`${evidence}mapping.json`);
const receipt = readJson(`${evidence}receipt.json`);
const nextEvidence = 'docs/evidence/2026-10-18-safe-slot-foley/';
const nextMapping = readJson(`${nextEvidence}mapping.json`);
const nextReceipt = readJson(`${nextEvidence}receipt.json`);
const changed = ['coin', 'tradeSell', 'tradeBuy', 'searchStart', 'recodeStart', 'click', 'cardSelect', 'characterSelect', 'foeLunge'];

describe('recorded Vehicle library integration', () => {
  it('preserves nine original cues with exactly two later safe-slot changes', () => {
    expect(Object.keys(SAMPLE_CUES)).toEqual(Object.keys(BEFORE));
    expect(Object.keys(mapping)).toEqual(changed);
    expect(Object.keys(nextMapping)).toEqual(['safeStore', 'safeRetrieve']);
    for (const key of Object.keys(BEFORE)) {
      expect(SAMPLE_CUES[key], key).toEqual(changed.includes(key) ? mapping[key] : nextMapping[key] || BEFORE[key]);
      for (const file of BEFORE[key].files) expect(existsSync(`game/${file}`)).toBe(true);
    }
    expect(SAMPLE_CUES.foeLunge.maxDuration).toBe(0.22);
    expect(SAMPLE_CUES.draw).toEqual(BEFORE.draw);
  });
  it('preserves six original WAV entries and the two explicit safe-slot additions', () => {
    const current = readJson('game/assets/asset-manifest.json');
    const before = readJson(`${evidence}before/asset-manifest.json`);
    const paths = receipt.files.map(item => item.path);
    expect(paths).toHaveLength(6);
    const nextPaths = ['sfx/real-foley/lockbox-turn-06.wav', 'sfx/real-foley/lockbox-unlock-01.wav'];
    expect(nextReceipt.files.map(item => item.path)).toEqual(nextPaths);
    expect(current.assets.filter(item => ![...paths, ...nextPaths].includes(item.path))).toEqual(before.assets);
    expect(current.count).toBe(before.count + 8);
    for (const file of receipt.files) {
      expect(current.assets.find(item => item.path === file.path)).toEqual(file);
      const bytes = readFileSync(`game/assets/${file.path}`);
      expect(bytes.length).toBe(file.bytes);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256);
      expect(bytes.subarray(0, 4).toString()).toBe('RIFF');
      expect(file.license).toContain('CC0 1.0');
    }
  });
  it('records provenance, gives visible credits, and does not claim listening approval', () => {
    expect(receipt.listening_verified).toBe(false);
    expect(readFileSync('game/index.html', 'utf8')).toContain('Vehicle / Jan Schupke — Fantasy SFX Libraries');
    const sources = readFileSync('game/assets/sfx/real-foley/SOURCES.md', 'utf8');
    expect(sources).toContain('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(sources).toContain('本轮未人工耳听');
  });
});
