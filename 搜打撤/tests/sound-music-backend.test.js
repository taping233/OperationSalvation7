import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { configs } = vi.hoisted(() => ({ configs: [] }));
vi.mock('howler', () => ({ Howler: { mute: vi.fn(), ctx: null }, Howl: class {
  constructor(options) { this.options = options; this.loaded = false; this.running = false; this.gain = 0; this.seconds = 0; configs.push(this); }
  state() { return this.loaded ? 'loaded' : 'unloaded'; }
  load() { this.loaded = true; this.options.onload(); }
  play() { this.running = true; this.options.onplay(); }
  playing() { return this.running; }
  volume(value) { if (value !== undefined) this.gain = value; return this.gain; }
  fade(_from, to) { this.gain = to; }
  seek() { return this.seconds; }
  mute() {}
  pause() { this.running = false; }
  unload() { this.loaded = false; }
} }));
beforeEach(() => { window.SDT?.Sound?.dispose?.(); vi.resetModules(); vi.useFakeTimers(); configs.length = 0; localStorage.clear(); });
afterEach(() => { window.SDT?.Sound?.dispose?.(); vi.useRealTimers(); localStorage.clear(); });
it('requests looping HTML5 media for every actual music scene and exposes real position', async () => {
  await import('../game/src/audio/sound.js'); const sound = window.SDT.Sound;
  for (const mode of ['title', 'board', 'battle']) { sound.music(mode); vi.advanceTimersByTime(600); }
  expect(configs).toHaveLength(3);
  for (const track of configs) expect(track.options).toMatchObject({ html5: true, loop: true, preload: false });
  configs[2].seconds = 4.2;
  expect(sound.musicPlayback).toMatchObject({ backend: 'html5', current: 'battle', playing: true, positionSeconds: 4.2, muted: false, volume: 0.45 });
  sound.setMusicMuted(true); expect(sound.musicPlayback).toMatchObject({ muted: true, playing: false });
  expect(sound.musicPlayback.tracks).toHaveLength(0); expect(configs.every(t => !t.running && !t.loaded)).toBe(true);
});
it('does not load BGM at boot when the music UI switch was persisted off', async () => {
  localStorage.setItem('sdt-music-off', '1'); await import('../game/src/audio/sound.js');
  window.SDT.Sound.music('title'); expect(configs).toHaveLength(0);
  window.SDT.Sound.setMusicMuted(false); expect(configs).toHaveLength(1); expect(configs[0].options.html5).toBe(true);
});
