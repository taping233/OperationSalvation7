import { SAMPLE_CUES } from '../game/src/audio/sound.samples.catalog.js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('howler', () => ({ Howl: class {}, Howler: { mute: vi.fn(), ctx: null } }));

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function fakeContext() {
  const contexts = [];
  const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() });
  const node = () => ({ gain: parameter(), frequency: parameter(), Q: parameter(), playbackRate: parameter(),
    threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(),
    connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn() });
  class AudioContext {
    constructor() {
      this.state = 'running'; this.currentTime = 0; this.sampleRate = 100;
      this.gains = []; this.sources = []; this.oscillators = []; contexts.push(this);
      this.decodeAudioData = vi.fn(() => Promise.resolve(this.createBuffer()));
      this.close = vi.fn(() => { this.state = 'closed'; return Promise.resolve(); });
      this.resume = vi.fn(() => { this.state = 'running'; return Promise.resolve(); });
    }
    createGain() { const gain = node(); this.gains.push(gain); return gain; }
    createDynamicsCompressor() { return node(); }
    createBiquadFilter() { return node(); }
    createOscillator() { const oscillator = node(); this.oscillators.push(oscillator); return oscillator; }
    createBufferSource() { const source = node(); this.sources.push(source); return source; }
    createBuffer() {
      const data = new Float32Array([0.4, -0.5]);
      return { numberOfChannels: 1, duration: 0.1, getChannelData: vi.fn(() => data) };
    }
  }
  return { AudioContext, contexts };
}

let context;
async function importSound(fetchImpl = async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) })) {
  vi.stubGlobal('fetch', vi.fn(fetchImpl));
  await import('../game/src/audio/sound.js');
  return window.SDT.Sound;
}
// Flush download/decode promises without expiring the new request deadlines.
const flush = async () => { for (let i=0;i<800;i++) await Promise.resolve(); };

beforeEach(() => {
  window.SDT?.Sound?.dispose?.();
  vi.resetModules(); vi.useFakeTimers(); localStorage.clear();
  context = fakeContext(); vi.stubGlobal('AudioContext', context.AudioContext);
});
afterEach(() => {
  window.SDT?.Sound?.dispose?.();
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); localStorage.clear();
});

describe('SFX mute and audio instance lifecycle', () => {
  it('prepares UI confirmation samples before the longer battle sample queue', async () => {
    const sound = await importSound();
    sound.ensure();
    for (let i=0;i<800;i++) await Promise.resolve();
    const urls = fetch.mock.calls.map(([url]) => url);
    const confirm = urls.findIndex(url => url.includes('/original-ui-1018/confirm.wav'));
    const battle = urls.findIndex(url => url.includes('/mixkit-1018/268.wav'));
    expect(confirm).toBeGreaterThanOrEqual(0);
    expect(battle).toBeGreaterThan(confirm);
  });
  it('silences already scheduled samples/tones and restores the user volume', async () => {
    const sound = await importSound(() => new Promise(() => {}));
    sound.ensure(); sound.sfx('danger');
    const bus = context.contexts[0].gains[1];
    expect(bus.gain.value).toBe(1.5);
    sound.setSfxMuted(true); expect(bus.gain.value).toBe(0);
    sound.setSfxVolume(0.5); expect(bus.gain.value).toBe(0);
    sound.setSfxMuted(false); expect(bus.gain.value).toBeCloseTo(1.5 * 10 ** -0.75);
    sound.setMuted(true); sound.setSfxMuted(true); sound.setSfxMuted(false);
    expect(context.contexts[0].gains[0].gain.value).toBe(0);
  });

  it('starts with a silent SFX bus when the saved SFX setting is off', async () => {
    localStorage.setItem('sdt-sfx-off', '1');
    const sound = await importSound(() => new Promise(() => {})); sound.ensure();
    expect(context.contexts[0].gains[1].gain.value).toBe(0);
  });

  it('keeps two shared fetch/decode jobs and does not queue duplicate preloads', async () => {
    const requests = [];
    const sound = await importSound((url, options) => {
      const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise;
    });
    sound.ensure(); sound.ensure();
    expect(context.contexts).toHaveLength(1); expect(requests).toHaveLength(2);
    requests[0].resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await flush();
    expect(requests).toHaveLength(3);
    sound.ensure(); expect(requests).toHaveLength(3);
  });

  it('does not exceed two active decodes while the shared queue is waiting', async () => {
    const decodes = [];
    const sound = await importSound(); sound.ensure();
    context.contexts[0].decodeAudioData.mockImplementation(() => {
      const pending = deferred(); decodes.push(pending); return pending.promise;
    });
    await flush(); expect(fetch).toHaveBeenCalledTimes(2); expect(decodes).toHaveLength(2);
    decodes[0].resolve(context.contexts[0].createBuffer()); await flush();
    expect(fetch).toHaveBeenCalledTimes(3); expect(decodes).toHaveLength(3);
    sound.dispose(); decodes[1].resolve(context.contexts[0].createBuffer()); decodes[2].resolve(context.contexts[0].createBuffer());
    await flush(); expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('aborts in-flight fetches, ignores late responses and leaves no decode pump timer', async () => {
    const requests = [];
    const sound = await importSound((url, options) => {
      const pending = deferred(); requests.push({ url, options, ...pending }); return pending.promise;
    });
    sound.ensure(); const oldContext = context.contexts[0];
    sound.dispose(); sound.dispose();
    for (const request of requests) request.resolve({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) });
    await flush();
    expect(requests).toHaveLength(2);
    expect(oldContext.decodeAudioData).not.toHaveBeenCalled();
    expect(requests.every(request => request.options?.signal?.aborted)).toBe(true);
    expect(oldContext.close).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    expect(sound.ensure()).toBe(false);
  });

  it('does not normalize or cache an active decode that resolves after disposal', async () => {
    const sound = await importSound();
    const decoding = deferred(); sound.ensure();
    const oldContext = context.contexts[0]; oldContext.decodeAudioData.mockReturnValue(decoding.promise);
    await flush(); expect(oldContext.decodeAudioData).toHaveBeenCalledTimes(2);
    const lateBuffer = oldContext.createBuffer(); sound.dispose(); decoding.resolve(lateBuffer); await flush();
    expect(lateBuffer.getChannelData).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    sound.sfx('click'); expect(oldContext.sources).toHaveLength(0);
  });

  it('reinitializes without old listeners, queued loads or closed-context reuse', async () => {
    const first = await importSound(() => new Promise(() => {})); first.ensure();
    const oldContext = context.contexts[0]; vi.resetModules();
    const second = await importSound(() => new Promise(() => {}));
    document.dispatchEvent(new Event('pointerdown'));
    expect(oldContext.close).toHaveBeenCalledOnce();
    expect(context.contexts).toHaveLength(2); expect(first.ensure()).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(2);
    second.dispose(); document.dispatchEvent(new Event('keydown'));
    expect(context.contexts).toHaveLength(2);
  });
});

describe('partial SFX asset availability', () => {
  it.each(['hit', 'hurt', 'parry', 'draw'])('plays only available %s siblings when one catalog file is missing', async cue => {
    const missing = SAMPLE_CUES[cue].files[0];
    const sound = await importSound(async url => ({ ok: !url.split('?')[0].endsWith(missing), status: 404, arrayBuffer: async () => new ArrayBuffer(1) }));
    sound.ensure(); await flush(); sound.sfx(cue);
    expect(context.contexts[0].oscillators).toHaveLength(0);
    expect(context.contexts[0].sources).toHaveLength(SAMPLE_CUES[cue].files.length > 1 ? 1 : 0);
  });

  it('stays silent without synthesis when every sampled sibling fails', async () => {
    const sound = await importSound(async () => ({ ok: false, status: 404 }));
    sound.ensure(); await flush(); sound.sfx('click');
    expect(context.contexts[0].oscillators).toHaveLength(0);
    expect(context.contexts[0].sources).toHaveLength(0);
  });

  it('preserves original sample dynamics without normalization', async () => {
    const buffers = [];
    const sound = await importSound(); sound.ensure();
    context.contexts[0].decodeAudioData.mockImplementation(() => {
      const buffer = context.contexts[0].createBuffer(); buffers.push(buffer); return Promise.resolve(buffer);
    });
    await flush(); sound.sfx('deny');
    const buffer = context.contexts[0].sources[0].buffer;
    expect(buffers).toContain(buffer);
    expect(buffer.getChannelData).not.toHaveBeenCalled();
  });
});

describe('CC0 UI integration', () => {
  it('plays the original-dynamics UI buffer and shares mute bus', async () => {
    const sound = await importSound(); sound.ensure(); await flush();
    const ctx = context.contexts[0];
    sound.sfx('confirm');
    const source = ctx.sources.at(-1);
    expect(Array.from(source.buffer.getChannelData(0))).toEqual([expect.closeTo(0.4), -0.5]);
    expect(ctx.gains.at(-1).gain.value).toBe(0.65);
    sound.setSfxMuted(true); expect(ctx.gains[1].gain.value).toBe(0);
    const urls = fetch.mock.calls.map(([url]) => url);
    const confirm = urls.findIndex(url => url.includes('/original-ui-1018/confirm.wav'));
    expect(confirm).toBeGreaterThanOrEqual(0);
    expect(confirm).toBeLessThan(urls.findIndex(url => url.includes('/mixkit-1018/268.wav')));
    expect(urls.some(url => url.includes('/selected32-1018/safe-store.wav'))).toBe(true);
  });
});

it('does not request or play legacy synthesis when CC0 confirmation fails', async () => {
  const sound = await importSound(async url => ({ ok: !url.includes('/original-ui-1018/confirm.wav'), status: 404, arrayBuffer: async () => new ArrayBuffer(1) }));
  sound.ensure(); await flush(); sound.sfx('confirm');
  const ctx = context.contexts[0];
  expect(ctx.sources).toHaveLength(0);
  expect(ctx.oscillators).toHaveLength(0);
  expect(fetch.mock.calls.some(([url]) => url.includes('/jsfxr/'))).toBe(false);
});
