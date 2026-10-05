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
      for (const entry of this.entries.values()) this.fadeOut(entry, immediate);
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
      entry = { scene, token: 0, timer: null, track: null, loading: false };
      this.entries.set(scene, entry);
      entry.track = this.createTrack(scene, {
        load: () => {
          entry.loading = false;
          if (this.entries.get(scene) !== entry) return;
          if (this.desired === scene && this.enabled) this.activate(entry);
          else this.release(entry);
        },
        error: (_, error) => {
          entry.loading = false;
          this.onError(scene, error);
          // Keep the previous valid track audible if the next file fails to load.
          if (this.current !== entry) this.release(entry);
        },
      });
    }
    if (entry.track.state() === 'unloaded') {
      if (!entry.loading) { entry.loading = true; entry.track.load(); }
    } else if (entry.track.state() === 'loaded' && (changed || this.current !== entry)) {
      this.activate(entry);
    } else if (gainChanged && this.current === entry && entry.track.playing()) {
      entry.track.fade(entry.track.volume(), volume, 100);
    }
  }

  activate(entry) {
    if (!this.enabled || this.desired !== entry.scene || this.entries.get(entry.scene) !== entry) return;
    this.cancel(entry);
    for (const other of this.entries.values()) if (other !== entry) this.fadeOut(other, false);
    this.current = entry;
    const track = entry.track;
    track.mute(false);
    if (!track.playing()) { track.volume(0); track.play(); }
    track.fade(track.volume(), this.volume, this.fadeInMs);
  }

  cancel(entry) {
    entry.token++;
    if (entry.timer !== null) { clearTimeout(entry.timer); entry.timer = null; }
  }

  fadeOut(entry, immediate) {
    const track = entry.track;
    if (!track) return;
    if (immediate) {
      this.cancel(entry);
      track.mute(true);
      track.pause();
      return;
    }
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
    entry.track.pause();
    entry.track.mute(true);
    entry.track.unload();
    if (this.entries.get(entry.scene) === entry) this.entries.delete(entry.scene);
    if (this.current === entry) this.current = null;
  }

  snapshot() {
    return { requested: this.desired, current: this.current?.scene || null, enabled: this.enabled,
      fadeInMs: this.fadeInMs, fadeOutMs: this.fadeOutMs,
      tracks: [...this.entries.values()].map(e => ({ scene: e.scene, state: e.track.state(), playing: e.track.playing(), volume: e.track.volume(), fadingOut: e.timer !== null })) };
  }
}
