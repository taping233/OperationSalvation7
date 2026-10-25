import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindSettingsAudio } from '../game/src/ui/settings-audio.js';
import { readCssSource } from './helpers/css-source.js';

let cleanup;
function setup(initial) {
  document.body.innerHTML = '<div id="overlay"><div class="settings-page"><p id="setMusicStatus" role="status"></p><button id="setMusicRetry">重试加载音乐</button></div></div>';
  const overlay = document.getElementById('overlay'), root = overlay.firstElementChild;
  const sound = { musicPlayback: initial, retryMusic: vi.fn(() => {
    sound.musicPlayback = { enabled: true, requested: 'title', playing: false, canRetry: false, error: null };
    document.dispatchEvent(new Event('sdt-music-state'));
  }) };
  cleanup = bindSettingsAudio(root, overlay, sound);
  const change = state => { sound.musicPlayback = state; document.dispatchEvent(new Event('sdt-music-state')); };
  return { overlay, root, sound, change, status: root.querySelector('p'), retry: root.querySelector('button') };
}
afterEach(() => { cleanup?.(); document.body.innerHTML = ''; });
const failed = { enabled: true, requested: 'title', playing: false, canRetry: true, error: { stage: 'load' } };
describe('settings music recovery feedback', () => {
  it('keeps the retry hidden despite the theme button display rule', () => {
    expect(readCssSource('game/css/settings-audio.css', 'utf8')).toMatch(/#overlay \.pg\.settings-page #setMusicRetry\[hidden\]\s*\{\s*display:\s*none;/);
  });
  it('shows failure, disables repeated loading clicks and follows asynchronous success/failure', () => {
    const h = setup(failed); expect(h.status.textContent).toContain('加载失败'); expect(h.retry.hidden).toBe(false);
    h.retry.click(); h.retry.click(); expect(h.sound.retryMusic).toHaveBeenCalledOnce();
    expect(h.status.textContent).toBe('正在加载音乐…'); expect(h.retry.hidden).toBe(true);
    h.change(failed); h.retry.click(); expect(h.sound.retryMusic).toHaveBeenCalledTimes(2);
    h.change({ enabled: true, requested: 'title', current: 'title', playing: true, canRetry: false });
    expect(h.status.textContent).toBe('音乐播放正常。'); expect(h.retry.hidden).toBe(true);
  });
  it('explains retained previous music and distinguishes mute and autoplay blocks', () => {
    const h = setup({ ...failed, current: 'board', playing: true });
    expect(h.status.textContent).toContain('仍在播放上一首');
    h.change({ muted: true, canRetry: false }); expect(h.status.textContent).toBe('音乐已静音。'); expect(h.retry.hidden).toBe(true);
    h.change({ error: { stage: 'play' }, canRetry: false }); expect(h.status.textContent).toContain('浏览器授权'); expect(h.retry.hidden).toBe(true);
  });
  it.each(['close', 'replace', 'hide'])('releases stale listeners on %s and cannot retry from detached settings', async action => {
    const h = setup(failed);
    if (action === 'close') document.dispatchEvent(new Event('sdt-overlay-close'));
    if (action === 'replace') h.root.remove();
    if (action === 'hide') h.overlay.hidden = true;
    await Promise.resolve();
    h.change({ playing: true, current: 'title' }); h.retry.click();
    expect(h.status.textContent).toContain('加载失败'); expect(h.sound.retryMusic).not.toHaveBeenCalled();
  });
});
