// Long BGM uses the browser media backend; never falls back to whole-file WebAudio decoding.
export class SceneMusicPlayer {
  constructor(createTrack, { fadeInMs = 1100, fadeOutMs = 900, backend = 'html5', onError = () => {}, onStateChange = () => {} } = {}) {
    if (!['html5', 'webaudio'].includes(backend)) throw new Error('Unsupported music backend');
    this.backend = backend;
    this.lastError = null;
    this.failedScene = null;
    this.createTrack = createTrack;
    this.fadeInMs = fadeInMs;
    this.fadeOutMs = fadeOutMs;
    this.onError = onError;
    this.onStateChange = onStateChange;
    this.entries = new Map();
    this.current = null;
    this.desired = null;
    this.enabled = false;
    this.volume = 0;
  }

  playing() { return !!this.current?.track.playing(); }

  set(scene, options) {
    this.setState(scene, options);
    this.onStateChange();
  }

  setState(scene, { enabled, volume, immediate = false }) {
    const changed = this.desired !== scene || this.enabled !== enabled;
    const gainChanged = this.volume !== volume;
    if (changed) { this.failedScene = null; this.lastError = null; }
    this.desired = scene;
    this.enabled = !!enabled;
    this.volume = volume;
    if (!this.enabled || !scene) {
      // 静音同时卸载排队/解锁中的音轨，避免恢复上下文后执行旧播放请求。
      for (const entry of [...this.entries.values()]) {
        if (immediate) this.release(entry);
        else this.fadeOut(entry);
      }
      if (immediate) this.current = null;
      return;
    }
    if (changed) {
      for (const stale of this.entries.values()) {
        if (stale.scene !== scene && stale !== this.current && (!stale.confirmed || !stale.track.playing())) this.release(stale);
      }
    }
    // Waiting/blocked/failed next tracks must not freeze the audible current track's slider or ducking.
    if (gainChanged && this.current?.scene !== scene && this.current?.track.playing()) this.applyVolume(this.current, volume, 100);
    if (this.failedScene === scene) return;
    let entry = this.entries.get(scene);
    if (!entry) {
      entry = { scene, token: 0, timer: null, track: null, loading: false, starting: false, blocked: false, confirmed: false, backend: this.backend };
      this.entries.set(scene, entry);
      entry.generation = 0;
      const create = () => {
        const generation = ++entry.generation;
        const current = () => entry.generation === generation && this.entries.get(scene) === entry;
        const callbacks = {
        load: () => {
          if (!current()) return;
          entry.loading = false;
          if (this.desired === scene && this.enabled) this.activate(entry);
          else this.release(entry);
          this.onStateChange();
        },
        error: (_, error) => {
          if (!current()) return;
          entry.loading = false;
          this.failedScene = scene;
          this.lastError = { scene, stage: 'load', message: String(error) };
          this.onError(scene, error);
          // Keep the previous valid track audible if the next file fails to load.
          if (this.current !== entry || !entry.track.playing()) this.release(entry);
          this.onStateChange();
        },
        play: () => {
          if (!current()) return;
          entry.starting = false;
          if (!this.enabled || this.desired !== scene) return;
          this.commit(entry);
          this.onStateChange();
        },
        playError: (_, error) => {
          if (!current()) return;
          entry.starting = false;
          entry.blocked = true;
          this.lastError = { scene, stage: 'play', message: String(error || 'Playback blocked; waiting for user gesture') };
          this.onStateChange();
        },
        unlock: () => {
          if (!current()) return;
          if (this.enabled && this.desired === scene) { entry.blocked = false; this.activate(entry); this.onStateChange(); }
        },
        };
        return this.createTrack(scene, callbacks, { html5: this.backend === 'html5', backend: this.backend });
      };
      entry.track = create();
    }
    if (entry.track.state() === 'unloaded') {
      if (!entry.loading) { entry.loading = true; entry.track.load(); }
    } else if (entry.track.state() === 'loaded' && (changed || this.current !== entry || (!entry.track.playing() && !entry.starting))) {
      this.activate(entry);
    } else if (gainChanged && this.current === entry && entry.track.playing()) {
      this.applyVolume(entry, volume, 100);
    }
  }

  activate(entry) {
    if (!this.enabled || this.desired !== entry.scene || this.entries.get(entry.scene) !== entry || entry.starting || entry.blocked) return;
    this.cancel(entry);
    const track = entry.track;
    track.mute(false);
    entry.targetVolume = this.volume;
    if (!track.playing()) {
      track.volume(0); entry.starting = true;
      track.play(); // Only a real play callback may retire the previous audible track.
    } else this.commit(entry);
  }

  commit(entry) {
    if (!entry.track.playing()) return;
    this.cancel(entry);
    for (const other of this.entries.values()) if (other !== entry) this.fadeOut(other);
    this.current = entry;
    entry.confirmed = true; entry.blocked = false;
    this.lastError = null;
    this.applyVolume(entry, this.volume, this.fadeInMs);
  }

  retryFailed() {
    // Explicit retry only: normal sync/input must not repeatedly download a failed file.
    if (!this.enabled || !this.desired || this.failedScene !== this.desired) return false;
    if (this.current?.scene === this.desired && this.current.track.playing()) return false;
    this.failedScene = null;
    this.lastError = null;
    this.set(this.desired, { enabled: this.enabled, volume: this.volume });
    return true;
  }

  retryBlocked() {
    const entry = this.entries.get(this.desired);
    if (!this.enabled || !entry?.blocked) return;
    entry.blocked = false;
    this.activate(entry);
    this.onStateChange();
  }

  applyVolume(entry, volume, duration) {
    entry.targetVolume = volume;
    const from = entry.track.volume();
    // Howler 的零差 fade 不会结束 interval；直接写音量也能取消先前的淡变。
    if (from === volume) entry.track.volume(volume);
    else entry.track.fade(from, volume, duration);
  }

  cancel(entry) {
    entry.token++;
    if (entry.timer !== null) { clearTimeout(entry.timer); entry.timer = null; }
  }

  fadeOut(entry) {
    const track = entry.track;
    if (!track) return;
    if (!track.playing()) {
      if (entry.scene !== this.desired && !entry.loading) this.release(entry);
      return;
    }
    if (entry.timer !== null) return;
    const token = ++entry.token;
    track.mute(false);
    this.applyVolume(entry, 0, this.fadeOutMs);
    entry.timer = setTimeout(() => {
      entry.timer = null;
      if (entry.token !== token || (this.enabled && this.desired === entry.scene)) return;
      this.release(entry);
    }, this.fadeOutMs + 32);
  }

  release(entry) {
    this.cancel(entry);
    entry.starting = false;
    entry.track.pause();
    entry.track.mute(true);
    entry.track.unload();
    if (this.entries.get(entry.scene) === entry) this.entries.delete(entry.scene);
    if (this.current === entry) this.current = null;
  }

  dispose() {
    this.enabled = false;
    this.desired = null;
    for (const entry of [...this.entries.values()]) this.release(entry);
    this.current = null;
  }

  snapshot() {
    const position = entry => {
      try {
        const value = entry?.track.seek?.();
        return typeof value === 'number' && Number.isFinite(value) ? value : null;
      } catch { return null; }
    };
    return { backend: this.backend, volume: this.current?.track.volume() ?? 0, targetVolume: this.volume, playing: this.playing(), positionSeconds: position(this.current), error: this.lastError, canRetry: !!(this.enabled && this.desired && this.failedScene === this.desired && !(this.current?.scene === this.desired && this.current.track.playing())), requested: this.desired, current: this.current?.scene || null, enabled: this.enabled,
      fadeInMs: this.fadeInMs, fadeOutMs: this.fadeOutMs,
      tracks: [...this.entries.values()].map(e => ({ scene: e.scene, backend: e.backend, positionSeconds: position(e), state: e.track.state(), playing: e.track.playing(), volume: e.track.volume(), fadingOut: e.timer !== null })) };
  }
}
