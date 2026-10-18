import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { SAMPLE_CUES, resolveSampleCue } from '../game/src/audio/sound.samples.catalog.js';
import { SampleOnlyPlayer } from '../game/src/audio/sound.samples.player.js';

function fixture(catalog = SAMPLE_CUES) {
  const sources = [];
  const param = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => ({ connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), gain: param(), frequency: param(), playbackRate: param() });
  const ctx = { state: 'running', currentTime: 0, createBufferSource() { const n = node(); sources.push(n); return n; },
    createGain: node, createBiquadFilter: node,
    createOscillator() { throw Error('No synthesis allowed'); }, createBuffer() { throw Error('No generated buffers allowed'); } };
  return { ctx, sources, player: new SampleOnlyPlayer(ctx, {}, { catalog }) };
}
const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };

describe('sample-only runtime', () => {
  it.each(Object.keys(SAMPLE_CUES))('%s plays exactly one decoded sample and releases it', async id => {
    const { player, sources } = fixture(); const buffer = { duration: 1 };
    player.load(async () => buffer); await flush();
    if (!SAMPLE_CUES[id].files.length) {
      expect(player.play(id)).toBe(false); expect(sources).toHaveLength(0); return;
    }
    expect(player.play(id)).toBe(true);
    expect(sources).toHaveLength(1); expect(sources[0].buffer).toBe(buffer);
    expect(sources[0].start).toHaveBeenCalledOnce(); sources[0].onended();
    expect(player.voices.size).toBe(0); expect(sources[0].disconnect).toHaveBeenCalledOnce();
  });
  it('silently drops all unavailable events and never replays after late loading', async () => {
    const { player, sources } = fixture(); const pending = [];
    player.load(() => new Promise(resolve => pending.push(resolve)));
    for (const id of Object.keys(SAMPLE_CUES)) expect(player.play(id)).toBe(false);
    pending.forEach(resolve => resolve({ duration: 1 })); await flush(); expect(sources).toHaveLength(0);
    expect(player.play('confirm')).toBe(true);
  });
  it('does not synthesize or play on total download failure', async () => {
    const { player, sources } = fixture(); player.load(async () => { throw Error('offline'); }); await flush();
    for (const id of Object.keys(SAMPLE_CUES)) expect(player.play(id)).toBe(false);
    expect(sources).toHaveLength(0);
  });
  it('does not play while suspended or queue a replay on unlock', async () => {
    const { player, sources, ctx } = fixture(); player.load(async () => ({ duration: 1 })); await flush();
    ctx.state = 'suspended'; expect(player.play('hit')).toBe(false); ctx.state = 'running';
    expect(sources).toHaveLength(0); expect(player.play('hit')).toBe(true);
  });
  it('caps total voices, protects priority and disposes all nodes once', async () => {
    const { player, sources } = fixture(); player.load(async () => ({ duration: 1 })); await flush();
    for (let i = 0; i < 15; i++) player.play('hit'); expect(player.voices.size).toBe(10);
    player.play('danger'); expect(player.voices.size).toBe(10); expect(sources[0].stop).toHaveBeenCalledOnce();
    player.dispose(); player.dispose(); expect(player.voices.size).toBe(0);
    for (const source of sources) { expect(source.stop).toHaveBeenCalledOnce(); expect(source.disconnect).toHaveBeenCalledOnce(); }
  });
  it('caps UI voices and prevents rapid duplicates without using fallback', async () => {
    const { player, sources, ctx } = fixture(); player.load(async () => ({ duration: 1 })); await flush();
    player.play('click'); player.play('confirm'); expect(sources).toHaveLength(1);
    for (let i = 0; i < 6; i++) { ctx.currentTime += .1; player.play('coin'); }
    expect(sources).toHaveLength(3);
  });
  it('cleans a failed start and ignores decode completion after disposal', async () => {
    const { player, sources, ctx } = fixture();
    player.load(async () => ({ duration: 1 })); await flush();
    const original = ctx.createBufferSource;
    ctx.createBufferSource = () => { const source = original(); source.start.mockImplementation(() => { throw Error('start failed'); }); return source; };
    expect(player.play('hit')).toBe(false); expect(player.voices.size).toBe(0);
    expect(sources[0].disconnect).toHaveBeenCalledOnce();
    const late = fixture().player, pending = [];
    late.load(() => new Promise(resolve => pending.push(resolve))); late.dispose();
    pending.forEach(resolve => resolve({ duration: 1 })); await flush();
    expect(late.buffers.size).toBe(0); expect(late.play('hit')).toBe(false);
  });
  it('keeps long music separate from the short sample-only player', () => {
    const source = readFileSync('game/src/audio/sound.samples.player.js', 'utf8');
    expect(source).not.toMatch(/Howl|MUSIC_TRACKS|sound\.music/);
    const runtime = readFileSync('game/src/audio/sound.js', 'utf8');
    expect(runtime).toContain('new SceneMusicPlayer');
    expect(runtime).toContain('new SampleOnlyPlayer');
  });
  it('preserves phase side and fails silently for unknown names', () => {
    expect(resolveSampleCue('phase', { side: 'foe' })).toBe('phaseFoe');
    expect(resolveSampleCue('phase')).toBe('phaseSelf'); expect(fixture().player.play('unknown')).toBe(false);
  });
  it('covers previous synthesis, jsfxr and every literal public SFX call', () => {
    const inv = JSON.parse(readFileSync('docs/evidence/2026-10-17-sample-only-sfx/inventory.json'));
    for (const id of [...inv.oldSynthEvents, ...inv.oldJsfxrEvents]) expect(SAMPLE_CUES[resolveSampleCue(id)], id).toBeTruthy();
    function walk(dir) { return readdirSync(dir, { withFileTypes: true }).flatMap(f => f.isDirectory() ? walk(`${dir}/${f.name}`) : f.name.endsWith('.js') ? [`${dir}/${f.name}`] : []); }
    for (const file of walk('game/src')) {
      if (file.endsWith('sfx-audition.js')) continue;
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(/\.sfx(?:\?\.)?\(['"]([A-Za-z]+)['"]/g)) expect(SAMPLE_CUES[resolveSampleCue(match[1])], `${file}: ${match[1]}`).toBeTruthy();
    }
  });
  it('contains no synthesis or legacy loader in the active short-sound chain, and all samples exist', () => {
    for (const file of ['sound.js', 'sound.samples.catalog.js', 'sound.samples.player.js']) {
      const source = readFileSync(`game/src/audio/${file}`, 'utf8');
      expect(source).not.toMatch(/createOscillator|createBuffer\(|jsfxr\/|sound\.scape|sound\.bank|sound\.ui-samples/);
    }
    for (const cue of Object.values(SAMPLE_CUES)) for (const file of cue.files) expect(readFileSync(`game/${file}`).length).toBeGreaterThan(0);
  });
});
