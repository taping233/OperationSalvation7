import { afterEach, describe, expect, it, vi } from 'vitest';
import { bindCardBrowser, cardBrowserHTML, refreshCardBrowser } from '../game/src/ui/card-browser.js';

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); });
describe('explicit card browser columns', () => {
  it('shows four cards per page regardless of available width, preserving next/previous and filtering', () => {
    document.body.innerHTML = cardBrowserHTML('four-column-feedback','招式',
      Array.from({length:9},(_,i)=>`<button data-browser-key="${i}">${i}</button>`).join(''), {rows:1,columns:4});
    const root = document.querySelector('[data-card-browser]');
    const track = root.querySelector('.card-browser-track');
    Object.defineProperty(track,'clientWidth',{value:1800});
    bindCardBrowser(root);
    const shown = () => [...track.children].filter(e=>!e.hidden).map(e=>e.dataset.browserKey);
    expect(shown()).toEqual(['0','1','2','3']);
    root.querySelector('[data-browser-page="next"]').click();
    expect(shown()).toEqual(['4','5','6','7']);
    root.querySelector('[data-browser-page="previous"]').click();
    expect(shown()).toEqual(['0','1','2','3']);
    track.children[0].dataset.browseFiltered='true';
    refreshCardBrowser(root,{reset:true});
    expect(shown()).toEqual(['1','2','3','4']);
  });

  it('recomputes pagination once after a burst of image loads', () => {
    const frames = [];
    vi.stubGlobal('requestAnimationFrame', callback => { frames.push(callback); return frames.length; });
    document.body.innerHTML = cardBrowserHTML('image-load-feedback', '招式',
      Array.from({ length: 12 }, (_, i) => `<button data-browser-key="${i}"><img alt=""></button>`).join(''),
      { rows: 1, columns: 4 });
    const root = document.querySelector('[data-card-browser]');
    Object.defineProperty(root.querySelector('.card-browser-track'), 'clientWidth', { value: 900 });
    const items = [...root.querySelectorAll('[data-browser-key]')];
    const shown = () => items.filter(item => !item.hidden).map(item => item.dataset.browserKey);
    bindCardBrowser(root);
    root.querySelector('[data-browser-page="next"]').click();
    expect(shown()).toEqual(['4', '5', '6', '7']);

    items.slice(0, 10).forEach(item => { item.dataset.browseFiltered = 'true'; });
    for (let i = 0; i < 100; i++) items[i % items.length].querySelector('img').dispatchEvent(new Event('load'));
    expect(frames).toHaveLength(1);
    expect(shown()).toEqual(['4', '5', '6', '7']);
    frames[0]();
    expect(shown()).toEqual(['10', '11']);
    expect(root.querySelector('[data-browser-page="next"]').disabled).toBe(true);

    items[10].querySelector('img').dispatchEvent(new Event('load'));
    expect(frames).toHaveLength(2);
    root.remove();
    vi.stubGlobal('getComputedStyle', () => { throw new Error('detached browser refreshed'); });
    expect(() => frames[1]()).not.toThrow();
  });
});
