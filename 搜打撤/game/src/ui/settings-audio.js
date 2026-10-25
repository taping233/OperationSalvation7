import '../../css/settings-audio.css';

// Live feedback belongs to this settings page only; no polling or automatic download retries.
export function bindSettingsAudio(root, overlay, sound) {
  const status = /** @type {HTMLElement} */ (root.querySelector('#setMusicStatus'));
  const retry = /** @type {HTMLButtonElement} */ (root.querySelector('#setMusicRetry'));
  const sfxStatus = root.querySelector('#setSfxStatus');
  const sfxRetry = /** @type {HTMLButtonElement | null} */ (root.querySelector('#setSfxRetry'));
  const events = new AbortController();
  const current = () => root.isConnected && !overlay.hidden && overlay.contains(root);
  const stop = () => { events.abort(); observer.disconnect(); };
  const update = () => {
    if (!current()) { stop(); return; }
    const state = sound.musicPlayback;
    retry.hidden = !state?.canRetry;
    retry.disabled = !state?.canRetry;
    let message = '';
    if (state?.muted) message = '音乐已静音。';
    else if (state?.error?.stage === 'load') message = state.current && state.playing
      ? '当前场景音乐加载失败，仍在播放上一首。可手动重试。'
      : '音乐加载失败，请检查网络后重试。';
    else if (state?.error?.stage === 'play') message = '音乐播放等待浏览器授权，请点击页面或按键后重试。';
    else if (state?.enabled && state.requested && (!state.playing || state.current !== state.requested)) message = '正在加载音乐…';
    else if (state?.playing) message = '音乐播放正常。';
    if (status.textContent !== message) status.textContent = message;
    if (sfxStatus && sfxRetry) {
      const state = sound.sfxPlayback;
      const canRetry = !!state?.canRetry && !state?.muted && !state?.hidden;
      sfxRetry.hidden = !canRetry; sfxRetry.disabled = !canRetry;
      const message = state?.muted ? '音效已静音。' : state?.hidden ? '页面隐藏时暂停音效。'
        : state?.loading ? `正在加载音效（${state.loaded || 0} 项已就绪）…`
        : state?.failed ? `${state.failed} 项音效加载失败，可手动重试。`
        : state?.loaded ? '音效已就绪。' : '首次点击或按键后加载音效。';
      if (sfxStatus.textContent !== message) sfxStatus.textContent = message;
    }
  };
  const observer = new MutationObserver(() => { if (!current()) stop(); });
  observer.observe(overlay, { attributes: true, attributeFilter: ['hidden'], childList: true, subtree: true });
  document.addEventListener('sdt-sfx-state', update, { signal: events.signal });
  document.addEventListener('sdt-music-state', update, { signal: events.signal });
  document.addEventListener('sdt-overlay-close', stop, { signal: events.signal });
  retry.addEventListener('click', () => {
    if (!current()) { stop(); return; }
    if (!sound.musicPlayback?.canRetry) { update(); return; }
    sound.retryMusic();
    update();
  }, { signal: events.signal });
  sfxRetry?.addEventListener('click', () => {
    if (!current()) { stop(); return; }
    if (sound.sfxPlayback?.canRetry) sound.retrySamples?.();
    update();
  }, { signal: events.signal });
  update();
  return stop;
}
