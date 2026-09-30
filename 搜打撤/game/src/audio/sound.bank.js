import library from '../../assets/sfx/alternatives/arknights-runtime/library.json' with { type: 'json' };
import { assetUrl } from '../core/asset-url.js';
import { SFX_PRIORITY } from './sound.policy.js';

export const SFX_ALIASES = Object.freeze({
  hit: 'attackSlash', strike: 'attackPierce', scene: 'eventEnter',
  turnSelf: 'phaseSelf', turnFoe: 'phaseFoe',
});
export function resolveSfx(name, opts = {}) {
  return name === 'phase' ? (opts.side === 'foe' ? 'phaseFoe' : 'phaseSelf') : SFX_ALIASES[name] || name;
}

// 保持已经试听配平的音量；不再把每个文件归一化到满幅，也不使用旧合成回退。
export class SampleSfxBank {
  constructor(ctx, output, { catalog = library, fetcher = fetch, clock = () => performance.now() } = {}) {
    this.ctx = ctx;
    this.output = output;
    this.fetcher = url => fetcher(url);
    this.clock = clock;
    this.cues = new Map(catalog.cues.map(cue => [cue.id, cue]));
    this.buffers = new Map();
    this.queue = [];
    this.decoding = 0;
    this.voices = new Set();
    this.pending = new Map();
    this.enabled = true;
    this.epoch = 0;
    this.ambientId = null;
    this.ambientVoice = null;
  }

  load(id) {
    if (this.buffers.has(id)) return this.buffers.get(id);
    const cue = this.cues.get(id);
    if (!cue) return Promise.resolve(null);
    const promise = new Promise(resolve => this.queue.push({ id, cue, resolve }));
    this.buffers.set(id, promise);
    this.pump();
    return promise;
  }

  pump() {
    while (this.decoding < 2 && this.queue.length) {
      const { id, cue, resolve } = this.queue.shift();
      this.decoding++;
      const url = assetUrl(cue.variants[0].src);
      this.fetcher(url).then(response => {
        if (!response.ok) throw new Error(`SFX ${id}: ${response.status}`);
        return response.arrayBuffer();
      }).then(bytes => this.ctx.decodeAudioData(bytes)).then(resolve, error => {
        this.buffers.delete(id); // 下一次操作可重试，失败时不播另一种声音。
        console.warn('[sound]', error.message);
        resolve(null);
      }).finally(() => { this.decoding--; this.pump(); });
    }
  }

  prewarm() {
    ['click', 'hover', 'confirm', 'open', 'close', 'card', 'attackSlash', 'hurt'].forEach(id => this.load(id));
  }

  play(name, opts = {}) {
    const id = resolveSfx(name, opts);
    if (!this.enabled || !this.cues.has(id)) return false;
    if (this.cues.get(id).loop) { this.ambient(id); return true; }
    const token = { time: this.clock(), epoch: this.epoch };
    this.pending.set(id, token);
    this.load(id).then(buffer => {
      if (!buffer || !this.enabled || token.epoch !== this.epoch || this.pending.get(id) !== token) return;
      this.pending.delete(id);
      // 首次解码太晚的操作音直接跳过，避免页面已经离开后补响。
      const maxAge = ['click', 'hover', 'cardSelect'].includes(id) ? 250 : 1200;
      if (this.clock() - token.time > maxAge) return;
      this.start(id, buffer, opts);
    });
    return true;
  }

  start(id, buffer, opts = {}, loop = false) {
    const cue = this.cues.get(id);
    const priority = cue.priority ?? SFX_PRIORITY[id] ?? (['hover', 'click'].includes(id) ? 0 : 2);
    if (!loop && this.voices.size >= 10) {
      const oldest = [...this.voices].find(voice => voice.priority <= priority);
      if (!oldest) return null;
      oldest.source.stop();
      this.voices.delete(oldest);
    }
    const source = this.ctx.createBufferSource(), gain = this.ctx.createGain();
    source.buffer = buffer;
    source.loop = loop;
    // 仅前摇随快进缩短；命中与界面音保持认可版本的音色。
    source.playbackRate.value = id === 'foeLunge' ? Math.max(1, Math.min(1.5, opts.rateScale || 1)) : 1;
    gain.gain.value = loop ? (cue.gain ?? .12) : (cue.gain ?? .5);
    source.connect(gain); gain.connect(this.output);
    const voice = { source, gain, priority };
    if (!loop) this.voices.add(voice);
    source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
    source.start();
    return voice;
  }

  ambient(id) {
    if (id === this.ambientId) return;
    this.ambientId = id;
    if (this.ambientVoice) {
      const old = this.ambientVoice;
      old.gain.gain.cancelScheduledValues(this.ctx.currentTime);
      old.gain.gain.setTargetAtTime(0, this.ctx.currentTime, .06);
      old.source.stop(this.ctx.currentTime + .25);
      this.ambientVoice = null;
    }
    if (!id || !this.enabled || !this.cues.get(id)?.loop) return;
    const epoch = this.epoch;
    this.load(id).then(buffer => {
      if (buffer && this.enabled && epoch === this.epoch && this.ambientId === id) {
        this.ambientVoice = this.start(id, buffer, {}, true);
      }
    });
  }

  setEnabled(on) {
    if (this.enabled === on) return;
    this.enabled = on;
    this.epoch++;
    this.pending.clear();
    for (const voice of this.voices) voice.source.stop();
    this.voices.clear();
    const id = this.ambientId;
    this.ambient(null);
    if (on) this.ambient(id);
  }
}
