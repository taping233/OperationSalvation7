// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    localStorage.setItem('sdt-title-wallpaper', 'ensemble');
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
    expect(selection()).toBe('ensemble');
    viewButton.click();
    expect(title.classList.contains('wallpaper-only')).toBe(false);
    expect(title.querySelector('.title-inner').hasAttribute('inert')).toBe(false);
    expect(viewButton.getAttribute('aria-pressed')).toBe('false');
    expect({ ...localStorage }).toEqual(stored);
  });

  it('keeps the snow cover by default and cycles both directions without changing game saves', async () => {
    localStorage.setItem('game-save-fixture', 'untouched');
    await boot();
    expect(selection()).toBe('snow');
    button().click();
    expect(selection()).toBe('ensemble');
    expect(button().getAttribute('aria-label')).toContain('当前第2张');
    expect(button().textContent).toContain('2/2');
    expect(localStorage.getItem('sdt-title-wallpaper')).toBe('ensemble');
    button().click();
    expect(selection()).toBe('snow');
    expect(button().textContent).toContain('1/2');
    expect(localStorage.getItem('game-save-fixture')).toBe('untouched');
  });

  it('restores the second wallpaper on a new page load', async () => {
    await boot();
    button().click();
    vi.resetModules();
    document.body.innerHTML = html;
    await boot();
    expect(selection()).toBe('ensemble');
    expect(button().textContent).toContain('2/2');
  });

  it('uses the first wallpaper for an unknown saved preference', async () => {
    localStorage.setItem('sdt-title-wallpaper', 'retired');
    await boot();
    expect(selection()).toBe('snow');
    button().click();
    expect(selection()).toBe('ensemble');
  });

  it('still switches when preference storage is unavailable', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    await boot();
    button().click();
    expect(selection()).toBe('ensemble');
    button().click();
    expect(selection()).toBe('snow');
  });
});
