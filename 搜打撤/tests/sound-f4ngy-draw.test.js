// Historical credit assertions use the fixed pre-replacement page, alongside before.catalog.js.
// Historical integration provenance; current runtime replacement is covered by sound-web-library.test.js.
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { SAMPLE_CUES } from '../docs/evidence/2026-10-18-web-sfx-replacement/before.catalog.js';
import { SAMPLE_CUES as BEFORE } from '../docs/evidence/2026-10-17-f4ngy-draw/before/sound.samples.catalog.js';

describe('single attributed card draw sample', () => {
  it('preserves the attributed draw cue after later sound-library updates', () => {
    expect(Object.keys(SAMPLE_CUES)).toEqual(Object.keys(BEFORE));
    expect(SAMPLE_CUES.draw).toEqual({ files: ['assets/sfx/f4ngy/dealing-card-240777-hq.mp3'], gain: 0.26, group: 'combat' });
    for (const file of BEFORE.draw.files) expect(existsSync(`game/${file}`)).toBe(true);
  });
  it('retains exactly one f4ngy asset record and visible BY credits', () => {
    const current = JSON.parse(readFileSync('game/assets/asset-manifest.json', 'utf8'));
    const previous = JSON.parse(readFileSync('docs/evidence/2026-10-17-f4ngy-draw/before/asset-manifest.json', 'utf8'));
    const addedPath = 'sfx/f4ngy/dealing-card-240777-hq.mp3';
    for (const asset of previous.assets.filter(item => item.path.startsWith('sfx/'))) expect(current.assets.find(item => item.path === asset.path)).toEqual(asset);
    expect(current.assets.filter(asset => asset.path === addedPath)).toHaveLength(1);
    expect(current.count).toBe(current.assets.length);
    const html = readFileSync('docs/evidence/2026-10-18-web-sfx-replacement/before.index.html', 'utf8');
    expect(html).toContain('Dealing Card — f4ngy（Freesound）');
    expect(html).toContain('https://creativecommons.org/licenses/by/4.0/');
    expect(html).toContain('音频文件未处理，仅降低播放音量');
  });
  it('retains the downloaded bytes and attribution without admitting NC audio', () => {
    const receipt = JSON.parse(readFileSync('docs/evidence/2026-10-17-f4ngy-draw/receipt.json', 'utf8'));
    const bytes = readFileSync(`game/${SAMPLE_CUES.draw.files[0]}`);
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(receipt.source_sha256);
    const credits = readFileSync('game/assets/sfx/f4ngy/SOURCES.md', 'utf8');
    expect(credits).toContain('https://creativecommons.org/licenses/by/4.0/');
    expect(credits).toContain('f4ngy');
    expect(SAMPLE_CUES.draw.files[0]).not.toMatch(/noncommercial|Robinhood|poker-deal-NC/);
  });
});
