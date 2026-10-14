import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Howl } from 'howler';
import { SceneMusicPlayer } from '../game/src/audio/sound.music.player.js';

function harness() {
  const tracks = [], errors = [];
  const player = new SceneMusicPlayer((scene, callbacks, options = {}) => {
    let state = 'unloaded', playing = false, volume = 0;
    const track = {
      scene, options, callbacks,
      load: vi.fn(() => { state = 'loading'; }),
      ready: () => { state = 'loaded'; callbacks.load(); },
      fail: error => callbacks.error(null, error),
      state: () => state, playing: () => playing,
      volume: value => { if (value !== undefined) volume = value; if (value !== undefined) track.pendingFade = null; return volume; },
      mute: vi.fn(), pause: vi.fn(() => { playing = false; }), unload: vi.fn(() => { state = 'unloaded'; }),
      play: vi.fn(() => { playing = true; callbacks.play(); }),
      started: () => { playing = true; callbacks.play(); },
      fade: vi.fn((from, to) => { volume = from; track.pendingFade = to; }),
    };
    tracks.push(track); return track;
  }, { onError: (...args) => errors.push(args) });
  const set = (scene, options = {}) => player.set(scene, { enabled: true, volume: 0.12, ...options });
  return { tracks, errors, player, set };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('scene BGM media fallback lifecycle', () => {
  it('falls back exactly once for decoding and reports only final failure', () => {
    const h = harness(); h.set('title'); const first = h.tracks[0];
    first.fail('Decoding audio data failed.');
    expect(first.unload).toHaveBeenCalledOnce(); expect(h.tracks).toHaveLength(2);
    const media = h.tracks[1]; expect(media.options.html5).toBe(true); expect(media.load).toHaveBeenCalledOnce();
    media.fail('Decoding failed again');
    expect(h.tracks).toHaveLength(2); expect(h.errors).toEqual([['title', 'Decoding failed again']]);
    expect(h.player.snapshot().tracks).toHaveLength(0);
  });

  it('does not change channels for a network error', () => {
    const h = harness(); h.set('title'); h.tracks[0].fail('404');
    expect(h.tracks).toHaveLength(1); expect(h.errors).toEqual([['title', '404']]);
  });

  it('keeps valid previous music if both next-song channels fail', () => {
    const h = harness(); h.set('board'); h.tracks[0].ready();
    h.set('shop'); h.tracks[1].fail('Decoding failed'); h.tracks[2].fail('media error');
    expect(h.player.snapshot().current).toBe('board'); expect(h.tracks[0].playing()).toBe(true);
    expect(h.tracks[0].pause).not.toHaveBeenCalled();
  });

  it('ignores callbacks from the first channel after replacing it', () => {
    const h = harness(); h.set('title'); const first = h.tracks[0]; first.fail('Decoding failed');
    first.ready(); first.fail('404'); first.callbacks.unlock(); first.callbacks.playError();
    expect(first.play).not.toHaveBeenCalled(); expect(h.errors).toHaveLength(0);
    expect(h.tracks[1].play).not.toHaveBeenCalled();
    h.tracks[1].ready(); expect(h.tracks[1].play).toHaveBeenCalledOnce();
  });

  it.each(['leave', 'mute', 'dispose'])('releases an in-flight media fallback on %s and ignores all late callbacks', action => {
    const h = harness(); h.set('title'); h.tracks[0].fail('Decoding failed'); const media = h.tracks[1];
    if (action === 'leave') h.set('board');
    if (action === 'mute') h.set('title', { enabled: false, immediate: true });
    if (action === 'dispose') h.player.dispose();
    expect(media.unload).toHaveBeenCalledOnce();
    media.ready(); media.fail('late error'); media.callbacks.unlock(); media.callbacks.play(); media.callbacks.playError();
    expect(media.play).not.toHaveBeenCalled(); expect(h.errors).toHaveLength(0);
    expect(h.player.snapshot().tracks.some(track => track.scene === 'title')).toBe(false);
  });

  it.each([0, 0.054, 0.25])('uses latest slider/ducking value %s after a suspended play request starts', volume => {
    const h = harness(); h.set('title'); const track = h.tracks[0]; track.play.mockImplementation(() => {});
    track.ready(); h.set('title', { volume }); track.started();
    expect(track.play).toHaveBeenCalledOnce();
    if (volume === 0) { expect(track.volume()).toBe(0); expect(track.pendingFade).not.toBe(0.12); }
    else expect(track.pendingFade).toBe(volume);
  });
});


describe('Howler equal-volume fade regression', () => {
  it('does not create a permanent zero-delta fade interval at zero music volume', () => {
    let callbacks;
    const track = realFadeTrack(() => callbacks.play());
    const player = new SceneMusicPlayer((_scene, handlers) => { callbacks = handlers; return track; });
    player.set('title', { enabled: true, volume: 0 }); track._state = 'loaded'; callbacks.load();
    vi.advanceTimersByTime(5000);
    const timerCount = vi.getTimerCount(); player.dispose();
    expect(timerCount).toBe(0);
  });
});


function realFadeTrack(onPlay) {
  const track = Object.create(Howl.prototype);
  Object.assign(track, { _state: 'unloaded', _playLock: false, _volume: 0, _muted: false, _webAudio: false,
    _sounds: [{ _id: 1, _volume: 0, _muted: false, _paused: true, _node: { volume: 0 } }], _queue: [],
    _emit: vi.fn(), load() { this._state = 'loading'; },
    play() { this._sounds[0]._paused = false; onPlay(); },
    pause() { this._sounds[0]._paused = true; }, unload() { this._stopFade(1); this._state = 'unloaded'; } });
  return track;
}

it('preserves nonzero fades and cancels real Howler fade/release timers across rapid changes', () => {
  const tracks = [], handlers = [];
  const player = new SceneMusicPlayer((_scene, callbacks) => {
    const track = realFadeTrack(() => callbacks.play()); tracks.push(track); handlers.push(callbacks); return track;
  });
  player.set('title', { enabled: true, volume: 0.12 }); tracks[0]._state = 'loaded'; handlers[0].load();
  expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(700); expect(vi.getTimerCount()).toBe(0);
  for (let i = 0; i < 5; i++) {
    player.set('shop', { enabled: true, volume: 0.12 }); tracks.at(-1)._state = 'loaded'; handlers.at(-1).load();
    vi.advanceTimersByTime(100);
    player.set('title', { enabled: true, volume: 0.12 });
    vi.advanceTimersByTime(100);
  }
  player.dispose(); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(5000); expect(vi.getTimerCount()).toBe(0);
});

it('ignores an old onplay Promise after reentry and cannot change the replacement gain', () => {
  const h = harness(); h.set('title'); const old = h.tracks[0]; old.play.mockImplementation(() => {}); old.ready();
  h.set('title', { enabled: false, immediate: true }); h.set('title', { volume: 0.25 });
  const replacement = h.tracks[1]; replacement.ready();
  old.started();
  expect(replacement.pendingFade).toBe(0.25); expect(replacement.play).toHaveBeenCalledOnce();
  expect(old.fade).toHaveBeenCalledTimes(1); expect(h.player.snapshot().current).toBe('title');
});
