import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneMusicPlayer } from '../game/src/audio/sound.music.player.js';
import { MUSIC_TRACKS, overlayMusicScene, resolveMusicScene } from '../game/src/audio/sound.music.catalog.js';

function harness() {
  const tracks = new Map();
  const errors = [];
  const player = new SceneMusicPlayer((scene, callbacks) => {
    let state = 'unloaded', playing = false, gain = 0, muted = true;
    const track = {
      load: vi.fn(() => { state = 'loading'; }),
      ready() { state = 'loaded'; callbacks.load(); },
      fail() { callbacks.error(null, 'decode failure'); },
      state: () => state,
      playing: () => playing,
      volume(value) { if (value !== undefined) gain = value; return gain; },
      mute: vi.fn(value => { muted = value; }),
      play: vi.fn(() => { playing = true; }),
      pause: vi.fn(() => { playing = false; }),
      unload: vi.fn(() => { state = 'unloaded'; }),
      fade: vi.fn(),
      muted: () => muted,
    };
    tracks.set(scene, track);
    return track;
  }, { onError: (...args) => errors.push(args) });
  const set = (scene, opts = {}) => player.set(scene, { enabled: true, volume: 0.12, ...opts });
  return { player, tracks, errors, set };
}

describe('scene BGM crossfades', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('loads only after audio is enabled and begins a zero-to-target fade on readiness', () => {
    const { set, tracks } = harness();
    set('title', { enabled: false });
    expect(tracks.size).toBe(0);
    set('title');
    expect(tracks.get('title').load).toHaveBeenCalledTimes(1);
    expect(tracks.get('title').play).not.toHaveBeenCalled();
    tracks.get('title').ready();
    expect(tracks.get('title').fade).toHaveBeenLastCalledWith(0, 0.12, 650);
    expect(tracks.get('title').muted()).toBe(false);
  });

  it('keeps the previous music audible while the next cue loads, then fades and frees it', () => {
    const { set, tracks, player } = harness();
    set('board'); tracks.get('board').ready(); tracks.get('board').volume(0.12);
    set('shop');
    expect(tracks.get('board').playing()).toBe(true);
    expect(tracks.get('board').fade).toHaveBeenCalledTimes(1);
    tracks.get('shop').ready();
    expect(tracks.get('board').fade).toHaveBeenLastCalledWith(0.12, 0, 500);
    expect(tracks.get('board').muted()).toBe(false);
    expect(tracks.get('shop').fade).toHaveBeenLastCalledWith(0, 0.12, 650);
    vi.advanceTimersByTime(532);
    expect(tracks.get('board').unload).toHaveBeenCalledOnce();
    expect(player.snapshot().current).toBe('shop');
    expect(player.snapshot().tracks).toHaveLength(1);
  });

  it('does not let an old fade timer pause a rapidly reentered scene', () => {
    const { set, tracks, player } = harness();
    set('board'); tracks.get('board').ready(); tracks.get('board').volume(0.12);
    set('fire'); tracks.get('fire').ready();
    vi.advanceTimersByTime(180);
    tracks.get('board').volume(0.06);
    set('board');
    expect(tracks.get('board').fade).toHaveBeenLastCalledWith(0.06, 0.12, 650);
    vi.advanceTimersByTime(1000);
    expect(tracks.get('board').pause).not.toHaveBeenCalled();
    expect(tracks.get('board').play).toHaveBeenCalledTimes(1);
    expect(player.snapshot().current).toBe('board');
  });

  it('ignores a late load after its scene was left', () => {
    const { set, tracks, player } = harness();
    set('title'); tracks.get('title').ready();
    set('altar'); set('base');
    tracks.get('altar').ready();
    expect(tracks.get('altar').play).not.toHaveBeenCalled();
    expect(tracks.get('altar').unload).toHaveBeenCalledOnce();
    tracks.get('base').ready();
    expect(player.snapshot().current).toBe('base');
  });

  it('pauses immediately when muted/hidden and fades back in without a second decode', () => {
    const { set, tracks } = harness();
    set('event'); tracks.get('event').ready(); tracks.get('event').volume(0.12);
    set('event', { enabled: false, immediate: true });
    expect(tracks.get('event').muted()).toBe(true);
    expect(tracks.get('event').playing()).toBe(false);
    expect(tracks.get('event').unload).not.toHaveBeenCalled();
    set('event');
    expect(tracks.get('event').load).toHaveBeenCalledTimes(1);
    expect(tracks.get('event').fade).toHaveBeenLastCalledWith(0, 0.12, 650);
  });

  it('retains a valid old track if the next asset fails and never starts it on a late muted load', () => {
    const { set, tracks, errors, player } = harness();
    set('board'); tracks.get('board').ready();
    set('shop'); tracks.get('shop').fail();
    expect(errors).toHaveLength(1);
    expect(player.snapshot().current).toBe('board');
    expect(tracks.get('board').playing()).toBe(true);
    set('altar'); set('altar', { enabled: false, immediate: true }); tracks.get('altar').ready();
    expect(tracks.get('altar').play).not.toHaveBeenCalled();
  });

  it('does not restart fades on same-scene refresh and smoothly updates ducking/volume', () => {
    const { set, tracks } = harness();
    set('battle'); tracks.get('battle').ready(); tracks.get('battle').volume(0.12);
    set('battle'); set('battle');
    expect(tracks.get('battle').fade).toHaveBeenCalledTimes(1);
    set('battle', { volume: 0.054 });
    expect(tracks.get('battle').fade).toHaveBeenLastCalledWith(0.12, 0.054, 100);
  });
});

describe('scene routing', () => {
  it('keeps old soundscape preferences on the approved file soundtrack', async () => {
    localStorage.setItem('sdt-music-source', 'scape');
    vi.resetModules();
    await import('../game/src/audio/sound.js');
    expect(window.SDT.Sound.musicSource).toBe('original');
    window.SDT.Sound.setMusicSource('scape');
    expect(window.SDT.Sound.musicSource).toBe('original');
    expect(localStorage.getItem('sdt-music-source')).toBe('original');
    localStorage.removeItem('sdt-music-source');
  });

  it('uses exactly four tracks across base, nodes, settlements and bosses', () => {
    expect(Object.keys(MUSIC_TRACKS)).toEqual(['title', 'board', 'battle', 'shop']);
    expect(resolveMusicScene('base', null)).toBe('title');
    for (const scene of ['exit', 'fire', 'event', 'altar', 'extraction']) {
      expect(resolveMusicScene('board', scene)).toBe('board');
    }
    expect(resolveMusicScene('board', 'shop')).toBe('shop');
    expect(resolveMusicScene('title', 'success')).toBe('title');
    expect(resolveMusicScene('title', 'defeat')).toBe('title');
    for (const id of ['boss_general', 'boss_orc', 'boss_elem']) {
      expect(resolveMusicScene('battle', 'shop', id)).toBe('battle');
    }
    expect(resolveMusicScene('battle', null, 'nest_unknown')).toBe('battle');
    expect(resolveMusicScene(null, 'shop')).toBe(null);
  });

  it('preserves scene music under temporary overlays but exits it on a new page or close', () => {
    expect(overlayMusicScene(null, { mode: 'bagpage' }, 'shop')).toBe('shop');
    expect(overlayMusicScene(null, { mode: true }, 'fire')).toBe('fire');
    expect(overlayMusicScene(null, { mode: 'page' }, 'shop')).toBe(null);
    expect(overlayMusicScene(null, {}, 'altar')).toBe(null);
    expect(overlayMusicScene(null, { mode: 'doom' }, 'event')).toBe('defeat');
  });
});
