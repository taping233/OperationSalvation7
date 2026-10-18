// Kenney Interface Sounds 1.0 (CC0). 原始动态保留，增益在播放端控制。
export const UI_SAMPLE_CUES = Object.freeze({
  click: { file: 'click_001', gain: 0.24 },
  cardSelect: { file: 'select_001', gain: 0.20 },
  confirm: { file: 'confirmation_001', gain: 0.24 },
  gain: { file: 'pluck_001', gain: 0.22 },
  coin: { file: 'pluck_001', gain: 0.22 },
});

export class UiSamplePlayer {
  constructor(ctx, output) {
    this.ctx = ctx;
    this.output = output;
    this.buffers = new Map();
    this.voices = new Set();
    this.disposed = false;
    this.loading = false;
    this.lastStart = -Infinity;
  }

  load(decode) {
    if (this.loading || this.disposed) return;
    this.loading = true;
    for (const file of new Set(Object.values(UI_SAMPLE_CUES).map(cue => cue.file))) {
      decode(`assets/sfx/interface-soft/${file}.ogg`).then(buffer => {
        if (!this.disposed) this.buffers.set(file, buffer);
      }).catch(() => { /* 当前操作沿用原回退，不在解码完成后补响。 */ });
    }
  }

  play(name) {
    const cue = UI_SAMPLE_CUES[name];
    const buffer = cue && this.buffers.get(cue.file);
    if (this.disposed || !buffer) return false;
    // 只限制本组UI，抑制时视为已处理，不穿透到更响的旧回退。
    if (this.voices.size >= 3 || this.ctx.currentTime - this.lastStart < 0.035) return true;
    let source, gain;
    try {
      source = this.ctx.createBufferSource();
      gain = this.ctx.createGain();
      source.buffer = buffer;
      gain.gain.value = cue.gain;
      source.connect(gain); gain.connect(this.output);
      const voice = { source, gain };
      source.onended = () => { this.voices.delete(voice); source.disconnect(); gain.disconnect(); };
      source.start();
      this.voices.add(voice);
      this.lastStart = this.ctx.currentTime;
      return true;
    } catch {
      source?.disconnect(); gain?.disconnect();
      return false;
    }
  }

  dispose() {
    this.disposed = true;
    for (const { source, gain } of this.voices) { source.stop(); source.disconnect(); gain.disconnect(); }
    this.voices.clear(); this.buffers.clear();
  }
}
