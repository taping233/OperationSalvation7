import { SAMPLE_CUES } from '../game/src/audio/sound.samples.catalog.js';
const expectedSampleCount = new Set(Object.values(SAMPLE_CUES).flatMap(cue => cue.files)).size;
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ contexts: [], tracks: [], blockNextPlay: false }));
vi.mock('howler', () => ({
  Howler: { mute: vi.fn(), ctx: null },
  Howl: class {
    constructor(options) {
      this.options = options; this.status = 'unloaded'; this.audible = false; this.gain = 0;
      this.play = vi.fn(() => {
        if (h.blockNextPlay) { h.blockNextPlay = false; options.onplayerror(null, 'blocked'); }
        else { this.audible = true; options.onplay(); }
      });
      this.fade = vi.fn((_from, to) => { this.gain = to; });
      this.mute = vi.fn();
      this.pause = vi.fn(() => { this.audible = false; });
      this.unload = vi.fn(() => { this.status = 'unloaded'; });
      h.tracks.push(this);
    }
    load() { this.status = 'loaded'; this.options.onload(); }
    state() { return this.status; }
    playing() { return this.audible; }
    volume(value) { if (value !== undefined) this.gain = value; return this.gain; }
    seek() { return 0; }
  },
}));

function contextClass() {
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => ({ gain: parameter(), frequency: parameter(), playbackRate: parameter(),
    threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(),
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  return class {
    constructor() {
      this.state = 'running'; this.currentTime = 0; this.gains = []; this.sources = [];
      this.decodeAudioData = vi.fn(async () => ({ duration: 0.2, numberOfChannels: 1 }));
      this.resume = vi.fn(async () => { this.state = 'running'; });
      this.close = vi.fn(async () => { this.state = 'closed'; }); h.contexts.push(this);
    }
    createGain() { const gain = node(); this.gains.push(gain); return gain; }
    createDynamicsCompressor() { return node(); }
    createBiquadFilter() { return node(); }
    createBufferSource() { const source = node(); this.sources.push(source); return source; }
  };
}
const flush = async () => { for (let i = 0; i < 1800; i++) await Promise.resolve(); };
const gesture = type => document.dispatchEvent(new Event(type));
async function loadSound() { await import('../game/src/audio/sound.js'); return window.SDT.Sound; }

beforeEach(() => {
  window.SDT?.Sound?.dispose?.(); vi.resetModules();
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] }); localStorage.clear();
  h.contexts = []; h.tracks = []; h.blockNextPlay = false;
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  vi.stubGlobal('AudioContext', contextClass());
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })));
});
afterEach(async () => {
  window.SDT?.Sound?.dispose?.();
  await vi.runAllTimersAsync(); // jsdom queues one-shot storage notifications for saved settings.
  const timers = vi.getTimerCount();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  expect(timers).toBe(0);
});

it.each(['sdt-muted', 'sdt-sfx-off'])('does not initialize short samples across repeated gestures with saved %s', async setting => {
  localStorage.setItem(setting, '1'); const sound = await loadSound();
  for (let i = 0; i < 10; i++) { gesture('pointerdown'); gesture('keydown'); sound.sfx('click'); }
  await flush(); expect(h.contexts).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
});

it.each(['sdt-muted', 'sdt-sfx-off'])('initializes once on the first enabled SFX after restoring %s', async setting => {
  localStorage.setItem(setting, '1'); const sound = await loadSound(); gesture('pointerdown');
  if (setting === 'sdt-muted') sound.setMuted(false); else sound.setSfxMuted(false);
  sound.sfx('confirm'); await flush();
  expect(h.contexts).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(expectedSampleCount);
  expect(h.contexts[0].decodeAudioData).toHaveBeenCalledTimes(expectedSampleCount);
  expect(h.contexts[0].sources).toHaveLength(0); // A not-yet-ready cue is never replayed late.
  sound.sfx('hit'); expect(h.contexts[0].sources).toHaveLength(1);
  gesture('pointerdown'); gesture('keydown'); await flush();
  expect(h.contexts).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(expectedSampleCount);
});

it('preserves normal first-gesture loading, suspended-context resume and SFX gains', async () => {
  const sound = await loadSound(); gesture('pointerdown'); await flush();
  const ctx = h.contexts[0]; expect(fetch).toHaveBeenCalledTimes(expectedSampleCount);
  ctx.state = 'suspended'; gesture('keydown'); expect(ctx.resume).toHaveBeenCalledOnce();
  sound.setSfxVolume(0.5); const gain = 1.5 * Math.pow(10, -0.75);
  expect(ctx.gains[1].gain.value).toBeCloseTo(gain);
  sound.setSfxMuted(true); expect(ctx.gains[1].gain.value).toBe(0);
  sound.setSfxMuted(false); expect(ctx.gains[1].gain.value).toBeCloseTo(gain);
  sound.setMuted(true); expect(ctx.gains[0].gain.value).toBe(0);
  sound.setMuted(false); expect(ctx.gains[0].gain.value).toBe(1);
  expect(h.contexts).toHaveLength(1);
});

it('retries blocked HTML5 music and preserves its fades and switch while SFX stays off', async () => {
  localStorage.setItem('sdt-sfx-off', '1'); const sound = await loadSound();
  h.blockNextPlay = true; sound.music('title');
  const track = h.tracks[0]; expect(track.options.html5).toBe(true);
  expect(sound.musicPlayback.playing).toBe(false); gesture('pointerdown');
  expect(track.play).toHaveBeenCalledTimes(2); expect(sound.musicPlayback.playing).toBe(true);
  expect(track.fade).toHaveBeenLastCalledWith(0, 0.45, 1100);
  gesture('keydown'); expect(track.fade).toHaveBeenCalledTimes(1);
  sound.setMusicVolume(0.5); expect(track.fade.mock.calls.at(-1)[2]).toBe(100);
  sound.setMusicMuted(true); expect(track.unload).toHaveBeenCalledOnce();
  sound.setMusicMuted(false); expect(h.tracks).toHaveLength(2);
  expect(sound.musicPlayback.playing).toBe(true);
  expect(h.contexts).toHaveLength(0); expect(fetch).not.toHaveBeenCalled();
});

it('restores music from global mute without requiring short-sample initialization', async () => {
  localStorage.setItem('sdt-muted', '1'); const sound = await loadSound();
  sound.music('title'); gesture('pointerdown'); expect(h.tracks).toHaveLength(0);
  sound.setMuted(false); expect(sound.musicPlayback.playing).toBe(true);
  expect(h.contexts).toHaveLength(0);
  gesture('keydown'); await flush();
  expect(h.contexts).toHaveLength(1); expect(fetch).toHaveBeenCalledTimes(expectedSampleCount);
});
