import { SAMPLE_CUES, resolveSampleCue } from './sound.samples.catalog.js';
import { SFX_PRIORITY } from './sound.policy.js';

// 仅播放已经解码的文件。失败、未解锁或未知事件静默，不生成声音、不补播旧请求。
export class SampleOnlyPlayer {
  constructor(ctx, output, { catalog = SAMPLE_CUES, onStateChange = () => {} } = {}) {
    this.ctx = ctx; this.output = output; this.catalog = catalog;
    this.buffers = new Map(); this.voices = new Set(); this.cursors = new Map();
    this.disposed = false; this.loading = false; this.lastUiStart = -Infinity;
    this.onStateChange = onStateChange; this.failed = new Map(); this.pendingFiles = new Set();
    this.decode = null; this.loadPromise = null; this.enabled = true; this.voiceSequence = 0;
  }

  load(decode, { failedOnly = false } = {}) {
    if (this.disposed) return Promise.resolve();
    if (this.loading) return this.loadPromise;
    this.decode = decode;
    const critical = ['confirm', 'error', 'deny', 'hit', 'hurt', 'danger', 'victory', 'bossVictory', 'defeat', 'runClear', 'extractionSuccess'];
    const priorityFiles = critical.flatMap(id => this.catalog[id]?.files || []);
    const files = [...new Set([...priorityFiles, ...Object.values(this.catalog).flatMap(cue => cue.files)])]
      .filter(file => !this.buffers.has(file) && (!failedOnly || this.failed.has(file)));
    if (!files.length) return Promise.resolve();
    this.loading = true;
    files.forEach(file => { this.failed.delete(file); this.pendingFiles.add(file); });
    this.onStateChange();
    const loadOne = async file => {
      try {
        let buffer;
        for (let attempt = 0; attempt < 2; attempt++) {
          try { buffer = await decode(file); break; }
          catch (error) { if (this.disposed || attempt === 1) throw error; }
        }
        if (!this.disposed) this.buffers.set(file, buffer);
      } catch (error) {
        if (!this.disposed) this.failed.set(file, String(error?.message || error));
      } finally { this.pendingFiles.delete(file); if (!this.disposed) this.onStateChange(); }
    };
    this.loadPromise = Promise.all(files.map(loadOne)).finally(() => {
      this.loading = false; this.loadPromise = null; if (!this.disposed) this.onStateChange();
    });
    return this.loadPromise;
  }

  retryFailed() {
    if (this.disposed || this.loading || !this.failed.size || !this.decode) return false;
    void this.load(this.decode, { failedOnly: true });
    return true;
  }

  snapshot() {
    return { loading: this.loading, loaded: this.buffers.size, pending: this.pendingFiles.size,
      failed: this.failed.size, canRetry: !this.loading && this.failed.size > 0,
      failedFiles: [...this.failed.keys()] };
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) for (const voice of [...this.voices]) this.release(voice, true);
  }

  release(voice, stop = false) {
    if (!this.voices.delete(voice)) return;
    voice.source.onended = null;
    if (stop) { try { voice.source.stop(); } catch { /* 已结束 */ } }
    voice.source.disconnect(); voice.gain.disconnect(); voice.filter?.disconnect();
  }

  play(name, opts = {}) {
    if (this.disposed || !this.enabled || this.ctx.state !== 'running') return false;
    const id = resolveSampleCue(name, opts), cue = Object.hasOwn(this.catalog, id) ? this.catalog[id] : null;
    if (!cue) return false;
    const available = cue.files.map(file => this.buffers.get(file)).filter(Boolean);
    if (!available.length) return false;
    const isUi = cue.group === 'ui';
    if (isUi && (this.ctx.currentTime - this.lastUiStart < 0.035
      || [...this.voices].filter(v => v.isUi).length >= 3)) return true;
    const priority = SFX_PRIORITY[id] ?? (isUi ? 1 : 2);
    const isResult = cue.group === 'result';
    // One of the ten voices belongs to results; ordinary combat cannot occupy it.
    const ordinary = [...this.voices].filter(voice => !voice.isResult);
    const capped = this.voices.size >= 10 || !isResult && ordinary.length >= 9;
    if (capped) {
      const eligible = [...this.voices].filter(voice => voice.priority < priority || isResult && voice.isResult);
      eligible.sort((a, b) => a.priority - b.priority || a.sequence - b.sequence);
      if (!eligible.length) return true;
      this.release(eligible[0], true);
    }
    let source, gain, filter, voice;
    try {
      source = this.ctx.createBufferSource(); gain = this.ctx.createGain();
      const cursor = this.cursors.get(id) || 0;
      source.buffer = available[cursor % available.length];
      source.playbackRate.value = id === 'foeLunge' ? Math.max(1, Math.min(1.5, opts.rateScale || 1)) : (cue.rate || 1);
      const level = cue.gain * (cue.gainScale ?? 1);
      gain.gain.value = level;
      if (cue.lowpass) {
        filter = this.ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = cue.lowpass;
        source.connect(filter); filter.connect(gain);
      } else source.connect(gain);
      gain.connect(this.output);
      voice = { source, gain, filter, priority, isUi, isResult, sequence: ++this.voiceSequence };
      this.voices.add(voice);
      source.onended = () => this.release(voice);
      if (cue.maxDuration) {
        const duration = Math.min(cue.maxDuration, source.buffer.duration);
        gain.gain.setValueAtTime(level, this.ctx.currentTime);
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
    this.buffers.clear(); this.cursors.clear(); this.failed.clear(); this.pendingFiles.clear();
  }
}
