import { describe, expect, it, vi } from 'vitest';
import { UiSamplePlayer, UI_SAMPLE_CUES } from '../game/src/audio/sound.ui-samples.js';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

function fixture() {
  const sources = [], gains = [];
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: { value: 1 } });
  const ctx = { currentTime: 0, createBufferSource() { const n = node(); sources.push(n); return n; },
    createGain() { const n = node(); gains.push(n); return n; } };
  return { ctx, sources, gains, player: new UiSamplePlayer(ctx, {}) };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('limited CC0 interface samples', () => {
  it('loads four unique files once, preserving exact decoded buffers', async () => {
    const { player } = fixture(), buffer = { samples: [0.1, -0.2] };
    const decode = vi.fn(async () => buffer);
    player.load(decode); player.load(decode); await flush();
    expect(decode).toHaveBeenCalledTimes(4);
    expect([...player.buffers.values()]).toEqual([buffer, buffer, buffer, buffer]);
    expect(buffer.samples).toEqual([0.1, -0.2]);
    expect(Object.keys(UI_SAMPLE_CUES)).toEqual(['click', 'cardSelect', 'confirm', 'gain', 'coin']);
  });
  it('allows original fallback while loading or failed, without delayed replay', async () => {
    const { player, sources } = fixture();
    player.load(async () => { throw new Error('offline'); });
    expect(player.play('confirm')).toBe(false); await flush();
    expect(player.play('click')).toBe(false); expect(sources).toHaveLength(0);
  });
  it('uses conservative gains and caps overlapping UI without invoking fallback', async () => {
    const { player, ctx, sources, gains } = fixture();
    player.load(async () => ({})); await flush();
    expect(player.play('click')).toBe(true);
    expect(player.play('confirm')).toBe(true); expect(sources).toHaveLength(1);
    for (let i = 0; i < 4; i++) { ctx.currentTime += 0.05; expect(player.play('gain')).toBe(true); }
    expect(sources).toHaveLength(3); expect(gains.every(n => n.gain.value <= 0.24)).toBe(true);
    sources[0].onended(); ctx.currentTime += 0.05; player.play('confirm');
    expect(sources).toHaveLength(4); expect(player.play('hit')).toBe(false);
  });
  it('disposes voices and ignores late loads', async () => {
    const { player, sources } = fixture(); player.load(async () => ({})); await flush(); player.play('click');
    player.dispose(); expect(sources[0].stop).toHaveBeenCalledOnce(); expect(player.buffers.size).toBe(0);
    expect(player.play('click')).toBe(false);
    const late = fixture().player; let resolve;
    late.load(() => new Promise(yes => { resolve = yes; })); late.dispose(); resolve({}); await flush();
    expect(late.buffers.size).toBe(0);
  });
  it('keeps all four original files, license and manifest hashes consistent', () => {
    const manifest = JSON.parse(readFileSync('game/assets/asset-manifest.json'));
    for (const file of new Set(Object.values(UI_SAMPLE_CUES).map(cue => cue.file))) {
      const path = `sfx/interface-soft/${file}.ogg`;
      const bytes = readFileSync(`game/assets/${path}`);
      const item = manifest.assets.find(asset => asset.path === path);
      expect(item.bytes).toBe(bytes.length); expect(item.sha256).toBe(createHash('sha256').update(bytes).digest('hex'));
      expect(item.license).toContain('CC0');
    }
    expect(readFileSync('game/assets/sfx/interface-soft/License.txt', 'utf8')).toContain('Creative Commons Zero');
  });
});
