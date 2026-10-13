// One audible track plus a pending/fading track; no eager decoding of the album.
export class SceneMusicPlayer {
  constructor(createTrack, { fadeInMs = 650, fadeOutMs = 500, onError = () => {} } = {}) {
    this.createTrack = createTrack;
    this.fadeInMs = fadeInMs;
    this.fadeOutMs = fadeOutMs;
    this.onError = onError;
    this.entries = new Map();
    this.current = null;
    this.desired = null;
    this.enabled = false;
    this.volume = 0;
  }

  playing() { return !!this.current?.track.playing(); }

  set(scene, { enabled, volume, immediate = false }) {
    const changed = this.desired !== scene || this.enabled !== enabled;
    const gainChanged = this.volume !== volume;
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
        if (stale.loading && stale.scene !== scene && stale !== this.current) this.release(stale);
      }
    }
    let entry = this.entries.get(scene);
    if (!entry) {
      entry = { scene, token: 0, timer: null, track: null, loading: false, starting: false };
      this.entries.set(scene, entry);
      entry.generation = 0;
      const create = (html5 = false) => {
        const generation = ++entry.generation;
        const current = () => entry.generation === generation && this.entries.get(scene) === entry;
        const callbacks = {
        load: () => {
          if (!current()) return;
          entry.loading = false;
          if (this.desired === scene && this.enabled) this.activate(entry);
          else this.release(entry);
        },
        error: (_, error) => {
          if (!current()) return;
          entry.loading = false;
          // 解码失败只切换一次浏览器媒体通道；404/403等网络错误保留原错误处理。
          if (!html5 && /decod/i.test(String(error)) && this.enabled && this.desired === scene) {
            entry.track.unload();
            entry.track = create(true);
            entry.loading = true;
            entry.track.load();
            return;
          }
          this.onError(scene, error);
          // Keep the previous valid track audible if the next file fails to load.
          if (this.current !== entry) this.release(entry);
        },
        play: () => { if (current()) entry.starting = false; },
        playError: () => { if (current()) entry.starting = false; },
        unlock: () => {
          if (!current()) return;
          if (!entry.track.playing() && !entry.starting) this.activate(entry);
        },
        };
        return html5 ? this.createTrack(scene, callbacks, { html5:true }) : this.createTrack(scene, callbacks);
      };
      entry.track = create();
    }
    if (entry.track.state() === 'unloaded') {
      if (!entry.loading) { entry.loading = true; entry.track.load(); }
    } else if (entry.track.state() === 'loaded' && (changed || this.current !== entry || (!entry.track.playing() && !entry.starting))) {
      this.activate(entry);
    } else if (gainChanged && this.current === entry && entry.track.playing()) {
      entry.track.fade(entry.track.volume(), volume, 100);
    }
  }

  activate(entry) {
    if (!this.enabled || this.desired !== entry.scene || this.entries.get(entry.scene) !== entry || entry.starting) return;
    this.cancel(entry);
    for (const other of this.entries.values()) if (other !== entry) this.fadeOut(other);
    this.current = entry;
    const track = entry.track;
    track.mute(false);
    if (!track.playing()) { track.volume(0); entry.starting = true; track.play(); }
    track.fade(track.volume(), this.volume, this.fadeInMs);
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
    track.fade(track.volume(), 0, this.fadeOutMs);
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
    return { requested: this.desired, current: this.current?.scene || null, enabled: this.enabled,
      fadeInMs: this.fadeInMs, fadeOutMs: this.fadeOutMs,
      tracks: [...this.entries.values()].map(e => ({ scene: e.scene, state: e.track.state(), playing: e.track.playing(), volume: e.track.volume(), fadingOut: e.timer !== null })) };
  }
}
