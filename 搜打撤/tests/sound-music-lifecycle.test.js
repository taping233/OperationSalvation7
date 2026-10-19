import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Howl } from 'howler';
import { SceneMusicPlayer } from '../game/src/audio/sound.music.player.js';

function harness() {
  const tracks = [], errors = [];
  const player = new SceneMusicPlayer((scene, callbacks, options = {}) => {
    let state = 'unloaded', playing = false, volume = 0, position = 0;
    const track = {
      scene, options, callbacks,
      load: vi.fn(() => { state = 'loading'; }),
      ready: () => { state = 'loaded'; callbacks.load(); },
      fail: error => callbacks.error(null, error),
      state: () => state, playing: () => playing,
      seek: () => position, advance: seconds => { position = seconds; },
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

describe('scene BGM explicit media lifecycle', () => {
  it('selects HTML5 on the first load and never falls back after decode failure', () => {
    const h = harness(); h.set('title'); const media = h.tracks[0];
    expect(media.options).toEqual({ html5: true, backend: 'html5' });
    media.fail('Decoding audio data failed.'); h.set('title'); h.set('title');
    expect(media.unload).toHaveBeenCalledOnce(); expect(h.tracks).toHaveLength(1);
    expect(h.errors).toEqual([['title', 'Decoding audio data failed.']]);
    expect(h.player.snapshot()).toMatchObject({ backend: 'html5', playing: false, current: null,
      error: { scene: 'title', stage: 'load', message: 'Decoding audio data failed.' } });
    expect(h.player.snapshot().tracks).toHaveLength(0);
  });
  it('does not automatically retry network failure; toggling music still recovers', () => {
    const h = harness(); h.set('title'); h.tracks[0].fail('404'); h.set('title');
    expect(h.tracks).toHaveLength(1); expect(h.errors).toEqual([['title', '404']]);
    h.set('title', { enabled: false, immediate: true }); h.set('title');
    expect(h.tracks).toHaveLength(2); expect(h.tracks[1].options.html5).toBe(true);
  });
  it('retries only the current failed load once per explicit request and ignores stale callbacks', () => {
    const h = harness(); h.set('title'); const failed = h.tracks[0]; failed.fail('network');
    expect(h.player.snapshot().canRetry).toBe(true);
    expect(h.player.retryFailed()).toBe(true);
    expect(h.player.snapshot()).toMatchObject({ canRetry: false, error: null });
    expect(h.player.retryFailed()).toBe(false); h.set('title');
    expect(h.tracks).toHaveLength(2); expect(h.tracks[1].load).toHaveBeenCalledOnce();
    failed.fail('late'); failed.ready(); expect(h.player.snapshot().error).toBe(null);
    h.tracks[1].fail('still offline'); expect(h.player.snapshot().canRetry).toBe(true);
    expect(h.player.retryFailed()).toBe(true); h.tracks[2].ready(); h.tracks[2].advance(17);
    expect(h.player.retryFailed()).toBe(false);
    expect(h.tracks[2].play).toHaveBeenCalledOnce(); expect(h.player.snapshot().positionSeconds).toBe(17);
  });
  it('keeps old music and latest gain until an explicitly retried scene actually starts', () => {
    const h = harness(); h.set('board'); const old = h.tracks[0]; old.ready(); old.advance(12);
    h.set('shop'); h.tracks[1].fail('offline'); h.set('shop', { volume: .06 });
    h.player.retryFailed(); expect(old.play).toHaveBeenCalledOnce(); expect(old.pause).not.toHaveBeenCalled();
    const next = h.tracks[2]; next.play.mockImplementation(() => {}); next.ready();
    expect(h.player.snapshot().current).toBe('board'); next.started();
    expect(next.pendingFade).toBe(.06); vi.advanceTimersByTime(932); expect(old.unload).toHaveBeenCalledOnce();
  });
  it.each(['mute', 'leave', 'dispose'])('does not retry a stale failure after %s', action => {
    const h = harness(); h.set('title'); h.tracks[0].fail('offline');
    if (action === 'mute') h.set('title', { enabled: false, immediate: true });
    if (action === 'leave') h.set('shop');
    if (action === 'dispose') h.player.dispose();
    const count = h.tracks.length;
    expect(h.player.retryFailed()).toBe(false); expect(h.tracks).toHaveLength(count);
  });
  it('keeps previous music if the next media load fails, without another channel', () => {
    const h = harness(); h.set('board'); h.tracks[0].ready();
    h.set('shop'); h.tracks[1].fail('media error');
    expect(h.player.snapshot().current).toBe('board'); expect(h.tracks[0].playing()).toBe(true);
    expect(h.tracks[0].pause).not.toHaveBeenCalled(); expect(h.tracks).toHaveLength(2);
  });
  it('ignores every callback from a failed and released media track', () => {
    const h = harness(); h.set('title'); const failed = h.tracks[0]; failed.fail('media error');
    failed.ready(); failed.fail('late'); failed.callbacks.unlock(); failed.callbacks.playError(); failed.started();
    expect(failed.play).not.toHaveBeenCalled(); expect(h.errors).toHaveLength(1);
    expect(h.player.snapshot().current).toBe(null); expect(h.player.snapshot().playing).toBe(false);
  });
  it.each(['leave', 'mute', 'dispose'])('releases pending media on %s and ignores late callbacks', action => {
    const h = harness(); h.set('title'); const media = h.tracks[0];
    if (action === 'leave') h.set('board');
    if (action === 'mute') h.set('title', { enabled: false, immediate: true });
    if (action === 'dispose') h.player.dispose();
    expect(media.unload).toHaveBeenCalledOnce();
    media.ready(); media.fail('late error'); media.callbacks.unlock(); media.callbacks.play(); media.callbacks.playError();
    expect(media.play).not.toHaveBeenCalled(); expect(h.errors).toHaveLength(0);
    expect(h.player.snapshot().tracks.some(track => track.scene === 'title')).toBe(false);
  });
  it('only retires old music after confirmed media playback, and exposes position', () => {
    const h = harness(); h.set('board'); const old = h.tracks[0]; old.ready(); old.advance(12.5);
    expect(h.player.snapshot()).toMatchObject({ playing: true, positionSeconds: 12.5 });
    h.set('battle'); const next = h.tracks[1]; next.play.mockImplementation(() => {}); next.ready();
    expect(h.player.snapshot().current).toBe('board'); expect(old.pause).not.toHaveBeenCalled();
    next.callbacks.playError(null, 'autoplay blocked');
    expect(h.player.snapshot().error.stage).toBe('play'); expect(old.playing()).toBe(true);
    next.callbacks.unlock(); next.started(); next.advance(1.25);
    expect(h.player.snapshot()).toMatchObject({ backend: 'html5', current: 'battle', playing: true, positionSeconds: 1.25, error: null });
    vi.advanceTimersByTime(932); expect(old.unload).toHaveBeenCalledOnce();
    h.set('shop'); const shop = h.tracks[2]; shop.ready(); vi.advanceTimersByTime(931);
    expect(next.unload).not.toHaveBeenCalled(); vi.advanceTimersByTime(1);
    expect(next.unload).toHaveBeenCalledOnce(); expect(h.tracks.every(t => t.options.html5)).toBe(true);
    expect(h.player.snapshot().tracks).toHaveLength(1); h.player.dispose(); expect(shop.unload).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('updates the surviving old track volume after a new media load failure', () => {
    const h = harness(); h.set('board'); const old = h.tracks[0]; old.ready(); old.volume(.12);
    h.set('battle'); h.tracks[1].fail('network'); h.set('battle', { volume: .06 });
    expect(old.pendingFade).toBe(.06); expect(h.tracks).toHaveLength(2);
  });
  it('keeps one looping media entry across repeated play callbacks and frees it on mute', () => {
    const h = harness(); h.set('battle'); const track = h.tracks[0]; track.ready();
    track.advance(119); track.callbacks.play(); track.advance(.5); track.callbacks.play();
    expect(h.tracks).toHaveLength(1); expect(track.load).toHaveBeenCalledOnce(); expect(track.play).toHaveBeenCalledOnce();
    expect(h.player.snapshot()).toMatchObject({ playing: true, positionSeconds: .5 });
    h.set('battle', { enabled: false, immediate: true }); expect(track.unload).toHaveBeenCalledOnce();
    expect(h.player.snapshot().playing).toBe(false); expect(vi.getTimerCount()).toBe(0);
  });
  it('releases an optimistic-playing pending track when a third scene supersedes it', () => {
    const h = harness(); h.set('board'); const board = h.tracks[0]; board.ready();
    h.set('battle'); const battle = h.tracks[1]; battle.play.mockImplementation(() => {});
    battle.ready(); battle.playing = () => true; // Howler marks playing before its Promise resolves.
    h.set('shop'); h.tracks[2].fail('network failure'); battle.started();
    expect(battle.unload).toHaveBeenCalledOnce(); expect(board.playing()).toBe(true);
    expect(h.player.snapshot().current).toBe('board'); expect(h.player.snapshot().tracks).toHaveLength(1);
  });
  it('does not retry blocked playback on sync; only unlock or a user gesture retries', () => {
    const h = harness(); h.set('title'); const track = h.tracks[0]; track.play.mockImplementation(() => {}); track.ready();
    track.callbacks.playError(null, 'blocked'); for (let i=0;i<4;i++) h.set('title');
    expect(track.play).toHaveBeenCalledOnce(); h.player.retryBlocked(); expect(track.play).toHaveBeenCalledTimes(2);
    h.player.retryBlocked(); expect(track.play).toHaveBeenCalledTimes(2);
    track.callbacks.playError(null, 'blocked'); track.callbacks.unlock(); expect(track.play).toHaveBeenCalledTimes(3);
  });
  it.each(['loading', 'blocked'])('updates audible old-track gain while the next track is %s', state => {
    const h = harness(); h.set('board'); const old = h.tracks[0]; old.ready(); old.volume(.12);
    h.set('battle'); const next = h.tracks[1];
    if (state === 'blocked') { next.play.mockImplementation(() => {}); next.ready(); next.callbacks.playError(null, 'blocked'); }
    h.set('battle', { volume: 0 }); expect(old.pendingFade).toBe(0);
    h.set('battle', { volume: .054 }); expect(old.pendingFade).toBe(.054);
    expect(h.player.snapshot().current).toBe('board'); expect(old.pause).not.toHaveBeenCalled();
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
  expect(vi.getTimerCount()).toBe(1); vi.advanceTimersByTime(1200); expect(vi.getTimerCount()).toBe(0);
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
  expect(old.fade).not.toHaveBeenCalled(); expect(h.player.snapshot().current).toBe('title');
});
