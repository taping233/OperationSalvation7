import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => { vi.resetModules(); localStorage.clear(); document.body.innerHTML = ''; });
afterEach(() => { vi.restoreAllMocks(); localStorage.clear(); delete document.body.dataset.renderQuality; });

describe('rendering preferences', () => {
  it('defaults conservatively, validates persisted fields and restores a saved preference', async () => {
    localStorage.setItem('sdt-performance', '{broken');
    let prefs = await import('../game/src/core/performance-settings.js');
    expect(prefs.getPerformanceSettings()).toEqual({ quality: 'balanced', fps: 60 });
    expect(prefs.normalizePerformanceSettings({ quality: 'bogus', fps: 10 })).toEqual({ quality: 'balanced', fps: 60 });
    expect(prefs.setPerformanceSettings({ quality: 'low', fps: 30 })).toEqual({ quality: 'low', fps: 30, saved: true });
    expect(document.body.dataset.renderQuality).toBe('low');
    vi.resetModules(); prefs = await import('../game/src/core/performance-settings.js');
    expect(prefs.getPerformanceSettings()).toEqual({ quality: 'low', fps: 30 });
  });
  it('applies changes when storage is unavailable and releases subscribers', async () => {
    const prefs = await import('../game/src/core/performance-settings.js');
    const listener = vi.fn(), unsubscribe = prefs.onPerformanceSettingsChange(listener);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(prefs.setPerformanceSettings({ quality: 'high', fps: 120 }).saved).toBe(false);
    expect(listener).toHaveBeenCalledWith({ quality: 'high', fps: 120 });
    unsubscribe(); prefs.setPerformanceSettings({ fps: 30 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
  it('real controls apply immediately, persist and explicitly report failed saves', async () => {
    const ui = await import('../game/src/ui/performance-settings.js');
    document.body.innerHTML = ui.performanceSettingsHTML(); ui.bindPerformanceSettings(document.body);
    const quality = document.querySelector('#setQuality'), fps = document.querySelector('#setFrameLimit');
    quality.value = 'low'; quality.dispatchEvent(new Event('change'));
    fps.value = '30'; fps.dispatchEvent(new Event('change'));
    expect(JSON.parse(localStorage.getItem('sdt-performance'))).toEqual({ quality: 'low', fps: 30 });
    expect(document.querySelector('#setQualityHelp').textContent).toContain('适合省电');
    expect(document.querySelector('#setQualityHelp').textContent).not.toContain('采样');
    expect(document.querySelector('#setQualityTechnical').textContent).toContain('0.75×');
    expect(document.querySelector('.performance-details').open).toBe(false);
    expect(fps.getAttribute('aria-describedby')).toBe('setFrameHelp');
    expect(document.querySelector('#setFrameHelp').textContent).toContain('最高 60 帧');
    expect(document.querySelector('#setFrameHelp').textContent).toContain('最高 30 帧');
    expect(quality.closest('label').classList.contains('performance-setting')).toBe(true);
    expect(quality.closest('label').classList.contains('chk')).toBe(false);
    expect(document.querySelector('#setPerformanceStatus').textContent).toBe('已保存，立即生效');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    fps.value = '60'; fps.dispatchEvent(new Event('change'));
    expect(document.querySelector('#setPerformanceStatus').textContent).toContain('未能保存');
  });
  it('keeps unsaved feedback when settings are closed and reopened, then clears it after a successful retry', async () => {
    localStorage.setItem('sdt-performance', JSON.stringify({ quality: 'balanced', fps: 60 }));
    const ui = await import('../game/src/ui/performance-settings.js');
    const prefs = await import('../game/src/core/performance-settings.js');
    const open = () => {
      document.body.innerHTML = ui.performanceSettingsHTML();
      ui.bindPerformanceSettings(document.body);
    };
    open();
    const save = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    const quality = document.querySelector('#setQuality');
    quality.value = 'low'; quality.dispatchEvent(new Event('change'));
    document.body.replaceChildren();
    open();
    expect(document.querySelector('#setQuality').value).toBe('low');
    expect(prefs.getPerformanceSettings()).toEqual({ quality: 'low', fps: 60 });
    expect(document.querySelector('#setPerformanceStatus').textContent).toContain('未能保存');
    expect(document.querySelector('#setPerformanceStatus').textContent).toContain('重新加载游戏');
    expect(JSON.parse(localStorage.getItem('sdt-performance'))).toEqual({ quality: 'balanced', fps: 60 });
    save.mockRestore();
    const fps = document.querySelector('#setFrameLimit');
    fps.value = '30'; fps.dispatchEvent(new Event('change'));
    expect(document.querySelector('#setPerformanceStatus').textContent).toBe('已保存，立即生效');
    open();
    expect(document.querySelector('#setPerformanceStatus').textContent).not.toContain('未能保存');
    expect(document.querySelector('#setQuality').value).toBe('low');
    expect(document.querySelector('#setFrameLimit').value).toBe('30');
    vi.resetModules();
    const reloaded = await import('../game/src/core/performance-settings.js');
    expect(reloaded.getPerformanceSettings()).toEqual({ quality: 'low', fps: 30 });
  });
  it('restores the last saved values only on reload after a failed write', async () => {
    localStorage.setItem('sdt-performance', JSON.stringify({ quality: 'high', fps: 120 }));
    let prefs = await import('../game/src/core/performance-settings.js');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    prefs.setPerformanceSettings({ quality: 'low', fps: 30 });
    expect(prefs.getPerformanceSettings()).toEqual({ quality: 'low', fps: 30 });
    vi.resetModules(); prefs = await import('../game/src/core/performance-settings.js');
    expect(prefs.getPerformanceSettings()).toEqual({ quality: 'high', fps: 120 });
    const ui = await import('../game/src/ui/performance-settings.js');
    document.body.innerHTML = ui.performanceSettingsHTML();
    expect(document.querySelector('#setPerformanceStatus').textContent).not.toContain('未能保存');
  });
  it('updates the shared scheduler without changing clock or gameplay state', async () => {
    const prefs = await import('../game/src/core/performance-settings.js');
    const { renderScheduler } = await import('../game/src/core/render-scheduler.js');
    expect(renderScheduler.activeInterval).toBeCloseTo(1000 / 60);
    prefs.setPerformanceSettings({ fps: 30 });
    expect(renderScheduler.activeInterval).toBeCloseTo(1000 / 30);
    expect(renderScheduler.shouldDraw(0, { active: true })).toBe(true);
    expect(renderScheduler.shouldDraw(17, { active: true })).toBe(false);
    prefs.setPerformanceSettings({ fps: 120 });
    expect(renderScheduler.shouldDraw(18, { active: true })).toBe(true);
  });
});
