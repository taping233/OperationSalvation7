import { SAMPLE_CUES, resolveSampleCue } from './sound.samples.catalog.js';
import { SFX_PRIORITY } from './sound.policy.js';

// 仅播放已经解码的文件。失败、未解锁或未知事件静默，不生成声音、不补播旧请求。
export class SampleOnlyPlayer {
  constructor(ctx, output, { catalog = SAMPLE_CUES } = {}) {
    this.ctx = ctx; this.output = output; this.catalog = catalog;
    this.buffers = new Map(); this.voices = new Set(); this.cursors = new Map();
    this.disposed = false; this.loading = false; this.lastUiStart = -Infinity;
  }

  load(decode) {
    if (this.loading || this.disposed) return;
    this.loading = true;
    for (const file of new Set(Object.values(this.catalog).flatMap(cue => cue.files))) {
      decode(file).then(buffer => {
        if (!this.disposed) this.buffers.set(file, buffer);
      }).catch(() => { /* 兄弟样本仍可播放；没有就绪样本时只保留现有视觉反馈。 */ });
    }
  }

  release(voice, stop = false) {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) { try { voice.source.stop(); } catch { /* 已结束 */ } }
    voice.source.disconnect(); voice.gain.disconnect(); voice.filter?.disconnect();
  }

  play(name, opts = {}) {
    if (this.disposed || this.ctx.state !== 'running') return false;
    const id = resolveSampleCue(name, opts), cue = this.catalog[id];
    if (!cue) return false;
    const available = cue.files.map(file => this.buffers.get(file)).filter(Boolean);
    if (!available.length) return false;
    const isUi = cue.group === 'ui';
    if (isUi && (this.ctx.currentTime - this.lastUiStart < 0.035
      || [...this.voices].filter(v => v.isUi).length >= 3)) return true;
    const priority = SFX_PRIORITY[id] ?? (isUi ? 1 : 2);
    if (this.voices.size >= 10) {
      const victim = [...this.voices].find(v => v.priority < priority);
      if (!victim) return true;
      this.release(victim, true);
    }
    let source, gain, filter, voice;
    try {
      source = this.ctx.createBufferSource(); gain = this.ctx.createGain();
      const cursor = this.cursors.get(id) || 0;
      source.buffer = available[cursor % available.length];
      source.playbackRate.value = id === 'foeLunge' ? Math.max(1, Math.min(1.5, opts.rateScale || 1)) : (cue.rate || 1);
      gain.gain.value = cue.gain;
      if (cue.lowpass) {
        filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cue.lowpass;
        source.connect(filter); filter.connect(gain);
      } else source.connect(gain);
      gain.connect(this.output);
      voice = { source, gain, filter, priority, isUi };
      this.voices.add(voice);
      source.onended = () => this.release(voice);
      if (cue.maxDuration) {
        const duration = Math.min(cue.maxDuration, source.buffer.duration);
        gain.gain.setValueAtTime(cue.gain, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + duration / source.playbackRate.value);
        source.start(0, 0, duration);
      } else source.start();
      this.cursors.set(id, cursor + 1);
      if (isUi) this.lastUiStart = this.ctx.currentTime;
      return true;
    } catch {
      if (voice) this.release(voice, true);
      else { source?.disconnect(); gain?.disconnect(); filter?.disconnect(); }
      return false;
    }
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const voice of [...this.voices]) this.release(voice, true);
    this.buffers.clear(); this.cursors.clear();
  }
}
