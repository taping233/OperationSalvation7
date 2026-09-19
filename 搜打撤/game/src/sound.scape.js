/* 纯 WebAudio 冬境声景：持续节点 + 音频时钟调制，不创建密集定时器。 */
const MODES = Object.freeze(['title', 'board', 'battle']);

class WinterSoundscape {
  constructor(context, destination) {
    this.ctx = context; this.destination = destination;
    this.root = context.createGain(); this.root.gain.value = 0; this.root.connect(destination);
    this.layers = new Map(); this.nodes = []; this.mode = null; this.volume = 0.11; this.paused = false; this.muted = false;
    this.boss = false; this.tensionGain = null; this.pulseGain = null;   // BOSS 紧张垫（音频 P2#12）
    this._visibility = () => this.setPaused(document.hidden);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this._visibility);
    this._build();
  }
  _node(node) { this.nodes.push(node); return node; }
  _gain(value = 0) { const g = this._node(this.ctx.createGain()); g.gain.value = value; return g; }
  _osc(type, frequency, gain) { const o = this._node(this.ctx.createOscillator()); o.type = type; o.frequency.value = frequency; o.connect(gain); o.start(); return o; }
  _noise(gain) {
    const length = this.ctx.sampleRate * 2, buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate), data = buffer.getChannelData(0);
    // 独立的确定性 LCG：声景噪声不使用 Math.random，也不污染 gameplay Random 流。
    let state = 0x6d2b79f5;
    for (let i = 0; i < length; i++) { state = Math.imul(1664525, state) + 1013904223 | 0; data[i] = (((state >>> 0) / 4294967296) * 2 - 1) * 0.7; }
    const source = this._node(this.ctx.createBufferSource()); source.buffer = buffer; source.loop = true; source.connect(gain); source.start(); return source;
  }
  _layer(name) { const g = this._gain(0); g.connect(this.root); this.layers.set(name, g); return g; }
  _build() {
    const title = this._layer('title');
    [146.83, 220, 277.18].forEach((f, i) => { const g = this._gain(0.018 - i * 0.003); this._osc('sine', f, g); g.connect(title); });
    const board = this._layer('board');
    const wind = this._gain(0.06), filter = this._node(this.ctx.createBiquadFilter());
    filter.type = 'lowpass'; filter.frequency.value = 420; filter.Q.value = 0.35; wind.connect(filter); filter.connect(board); this._noise(wind);
    const bell = this._gain(0.016); this._osc('sine', 523.25, bell); bell.connect(board);
    const bellDepth = this._gain(0.012); this._osc('sine', 0.075, bellDepth); bellDepth.connect(bell.gain);
    const battle = this._layer('battle');
    const drone = this._gain(0.055); this._osc('triangle', 73.42, drone); drone.connect(battle);
    const pulse = this._gain(0.016); this._osc('sine', 110, pulse); pulse.connect(battle);
    const pulseDepth = this._gain(0.009); this._osc('sine', 1.6, pulseDepth); pulseDepth.connect(pulse.gain);
    const tension = this._gain(0.018); this._osc('sawtooth', 146.83, tension); tension.connect(battle);
    this.tensionGain = tension; this.pulseGain = pulse;   // BOSS 态增益抬升用
  }
  _applyMode() {
    const now = this.ctx.currentTime;
    this.layers.forEach((gain, name) => {
      let target = name === this.mode && !this.paused ? 1 : 0;
      // BOSS 垫旁路（P2#12）：即使 mp3 音乐源（mode=null）也把 battle 层半开，
      // 只让 tension/pulse/drone 以低增益透出，与正曲叠加出「首脑战」紧张感
      if (name === 'battle' && this.boss && !this.paused) target = Math.max(target, 0.55);
      gain.gain.cancelScheduledValues(now); gain.gain.setTargetAtTime(target, now, 0.45);
    });
    this.root.gain.cancelScheduledValues(now); this.root.gain.setTargetAtTime(this.muted || this.paused ? 0 : this.volume, now, 0.28);
  }
  setMode(mode) {
    const next = MODES.includes(mode) ? mode : null;
    if (next === this.mode) return;
    this.mode = next; this._applyMode();
  }
  setVolume(value) {
    const next = Math.max(0, Math.min(0.2, Number(value) || 0));
    if (next === this.volume) return;
    this.volume = next; this._applyMode();
  }
  setMuted(muted) {
    const next = !!muted;
    if (next === this.muted) return;
    this.muted = next; this._applyMode();
  }
  setPaused(paused) {
    const next = !!paused;
    if (next === this.paused) return;
    this.paused = next; this._applyMode();
  }
  // BOSS 紧张垫（音频 P2#12）：battle 层旁路 + tension/pulse 增益抬升
  setBoss(on) {
    const next = !!on;
    if (next === this.boss) return;
    this.boss = next;
    const now = this.ctx.currentTime;
    if (this.tensionGain) this.tensionGain.gain.setTargetAtTime(next ? 0.05 : 0.018, now, 0.4);
    if (this.pulseGain) this.pulseGain.gain.setTargetAtTime(next ? 0.028 : 0.009, now, 0.4);
    this._applyMode();
  }
  destroy() {
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this._visibility);
    this.nodes.forEach(node => { try { node.stop?.(); } catch (_) {} try { node.disconnect(); } catch (_) {} });
    try { this.root.disconnect(); } catch (_) {} this.layers.clear(); this.nodes.length = 0; this.mode = null;
  }
}

export { MODES, WinterSoundscape };
