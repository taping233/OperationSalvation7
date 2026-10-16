// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL(`../${file}`, import.meta.url));
const json = file => JSON.parse(read(file));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = json('game/assets/asset-manifest.json');

describe('lossless runtime encoding receipts', () => {
  it('binds the NAI room derivative and unchanged PNG to the verified same-pixel receipt', () => {
    const receipt = json('docs/evidence/2026-10-16-WF-cloud-room-lossless/receipt.json');
    const bytes = read(`game/assets/${receipt.path}`);
    expect(hash(read(receipt.source))).toBe(receipt.sourceSha256);
    expect(hash(bytes)).toBe(receipt.sha256);
    expect(bytes.length).toBe(receipt.bytes);
    expect(receipt.sameRGBA && receipt.sameAlpha).toBe(true);
    expect(receipt.size).toEqual([1216, 832]);
    expect(receipt.savedBytes).toBe(424413);
    expect(manifest.assets.find(item => item.path === receipt.path)).toMatchObject({ bytes: bytes.length, sha256: hash(bytes) });
    const source = read('game/src/home/home.visuals.js').toString();
    expect(source).toContain('home-prototype/room-direction-candidate.webp');
    expect(source).not.toContain('room-direction-candidate.png');
    expect(read('game/css/photo-studio-mounts.css').toString()).toContain('frame-atelier-v1.png');
  });

  it('binds every changed sprite byte to a strict size reduction and unchanged pixel/alpha proof', () => {
    const receipt = json('docs/evidence/2026-10-16-WF-cloud-sprite-lossless/receipt.json');
    expect(receipt.count).toBe(263);
    expect(receipt.savedBytes).toBe(5160770);
    expect(receipt.encoder).toMatchObject({ lossless: true, exact: true, method: 6 });
    for (const item of receipt.files) {
      const bytes = read(`game/assets/${item.path}`);
      expect(item.newBytes).toBeLessThan(item.oldBytes);
      expect(item.sameRGBA && item.sameAlpha).toBe(true);
      expect(item.rgbaSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(item.alphaSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(bytes.length).toBe(item.newBytes);
      expect(hash(bytes)).toBe(item.newSha256);
      expect(manifest.assets.find(asset => asset.path === item.path)).toMatchObject({ bytes: item.newBytes, sha256: item.newSha256 });
    }
  });
});
