// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../game/src/ui/interface-motion.js', () => ({ interfaceReducedMotion: () => false }));

const html = readFileSync('game/index.html', 'utf8');
const boot = () => import('../game/src/ui/title-wallpaper.js');
const button = () => document.getElementById('btnTitleWallpaper');
const selection = () => document.getElementById('title').dataset.homeWallpaper;

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  document.body.innerHTML = html;
});
afterEach(() => vi.restoreAllMocks());

describe('home wallpaper preference', () => {
  it('temporarily hides the interface and restores it without changing wallpaper or saves', async () => {
    localStorage.setItem('sdt-title-wallpaper', 'baita-heixiang');
    localStorage.setItem('game-save-fixture', 'untouched');
    await boot();
    const title = document.getElementById('title');
    const viewButton = document.getElementById('btnTitleWallpaperView');
    const stored = { ...localStorage };
    viewButton.click();
    expect(title.classList.contains('wallpaper-only')).toBe(true);
    expect(title.querySelector('.title-inner').hasAttribute('inert')).toBe(true);
    expect(viewButton.getAttribute('aria-pressed')).toBe('true');
    expect(viewButton.textContent).toContain('恢复界面');
    expect(selection()).toBe('baita-heixiang');
    viewButton.click();
    expect(title.classList.contains('wallpaper-only')).toBe(false);
    expect(title.querySelector('.title-inner').hasAttribute('inert')).toBe(false);
    expect(viewButton.getAttribute('aria-pressed')).toBe('false');
    expect({ ...localStorage }).toEqual(stored);
  });

  it('keeps the snow road first and cycles the second wallpaper without changing game saves', async () => {
    localStorage.setItem('game-save-fixture', 'untouched');
    await boot();
    expect(selection()).toBe('snow-road');
    expect(button().disabled).toBe(false);
    expect(button().hidden).toBe(false);
    expect(button().textContent).toContain('1/2');
    button().click();
    expect(selection()).toBe('baita-heixiang');
    expect(button().getAttribute('aria-label')).toContain('当前第2张，共2张');
    expect(button().textContent).toContain('2/2');
    expect(localStorage.getItem('sdt-title-wallpaper')).toBe('baita-heixiang');
    button().click();
    expect(selection()).toBe('snow-road');
    expect(button().textContent).toContain('1/2');
    expect(localStorage.getItem('game-save-fixture')).toBe('untouched');
  });

  it('keeps the wallpaper ready and completes restoration after all staggered controls', async () => {
    vi.useFakeTimers();
    try {
      await boot();
      const title = document.getElementById('title');
      const view = document.getElementById('btnTitleWallpaperView');
      view.click(); view.click();
      expect(title.dataset.homeSceneReady).toBe('1');
      expect(title.dataset.homeReveal).toBeDefined();
      const delay = id => parseInt(document.getElementById(id).style.getPropertyValue('--home-enter-delay'));
      expect(delay('mStart')).toBeLessThan(delay('mGuide'));
      expect(delay('mGuide')).toBeLessThan(delay('mAch'));
      expect(delay('mAch')).toBeLessThan(delay('btnCardLib'));
      await vi.advanceTimersByTimeAsync(1000);
      expect(title.dataset.homePhase).toBe('in');
      await vi.advanceTimersByTimeAsync(500);
      expect(title.dataset.homePhase).toBe('rest');
      expect(title.dataset.homeReveal).toBeUndefined();
      view.click(); view.click();
      await vi.advanceTimersByTimeAsync(200);
      view.click(); // 立即再隐藏，不允许旧恢复计时器把它重新切回入场。
      await vi.runAllTimersAsync();
      expect(title.classList.contains('wallpaper-only')).toBe(true);
      expect(title.dataset.homePhase).toBe('rest');
    } finally { vi.useRealTimers(); }
  });

  it('restores the second wallpaper on a new page load', async () => {
    await boot();
    button().click();
    vi.resetModules();
    document.body.innerHTML = html;
    await boot();
    expect(selection()).toBe('baita-heixiang');
    expect(button().textContent).toContain('2/2');
  });

  it.each(['snow', 'ensemble', 'retired'])('uses the new wallpaper for retired or unknown preference %s', async preference => {
    localStorage.setItem('sdt-title-wallpaper', preference);
    await boot();
    expect(selection()).toBe('snow-road');
    button().click();
    expect(selection()).toBe('baita-heixiang');
  });

  it('still switches when preference storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await boot();
    button().click();
    expect(selection()).toBe('baita-heixiang');
    button().click();
    expect(selection()).toBe('snow-road');
  });
});
