import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
let UI, SDT, probes, useLoadEvents;
const card = index => ({ id: `probe-${index}`, name: `慢图 ${index}`, type: '法术', cost: 1, desc: '' });
beforeEach(async () => {
  vi.useFakeTimers(); probes = []; useLoadEvents = false;
  SDT = (await import('../game/src/core/sdt-facade.js')).default;
  ({ UI } = await import('../game/src/ui/ui.js'));
  document.body.innerHTML = '<div id="overlay"></div>';
  SDT.UiScale = { scale: () => 1, rect: () => ({ left: 0, top: 0, width: 400, height: 500 }) };
  SDT.Art = { cardIcon: (value, options) => `<img src="/${options?.low ? 'thumb' : 'original'}-${value.id}.webp">`, decodeIn() {} };
  SDT.Cards = { all: () => [], DMG_TYPES: ['法术'], rarityOf: () => '稀有', cardHTML: () => '<div class="hs-card">卡牌</div>' };
  SDT.Sound = { sfx() {} };
  vi.stubGlobal('matchMedia', () => ({ matches: false }));
  vi.stubGlobal('Image', class {
    src = ''; naturalHeight = 100; naturalWidth = 100;
    removeAttribute(name) { if (name === 'src') this.src = ''; }
    constructor() {
      probes.push(this);
      if (!useLoadEvents) this.decode = () => new Promise((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
    }
  });
  UI.el.overlay = document.getElementById('overlay');
});
afterEach(async () => { document.getElementById('cardZoom')?._closeCardZoom(true); for (const probe of probes) probe.resolve?.(); await Promise.resolve(); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); document.body.replaceChildren(); });
describe('photo high-resolution probe ownership', () => {
  it('closing twelve different photos best-effort cancels all probes without touching displayed thumbnails', () => {
    for (let i = 0; i < 12; i++) {
      UI.showCardZoom(card(i), { presentation: 'photo' });
      vi.advanceTimersByTime(140);
      const zoom = document.getElementById('cardZoom');
      const thumbnail = zoom.querySelector('.cz-photo-image img');
      zoom._closeCardZoom(true);
      expect(thumbnail.getAttribute('src')).toBe(`/thumb-probe-${i}.webp`);
    }
    expect(document.getElementById('cardZoom')).toBeNull();
    expect(probes).toHaveLength(12);
    expect(probes.every(probe => probe.src === '' && probe.onload === null && probe.onerror === null)).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('a late cancelled decode cannot overwrite the new photo', async () => {
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    const prior = document.getElementById('cardZoom'); prior._closeCardZoom(true);
    UI.showCardZoom(card(2), { presentation: 'photo' });
    const nextImage = document.querySelector('#cardZoom .cz-photo-image img');
    probes[0].resolve(); await Promise.resolve(); await Promise.resolve();
    expect(nextImage.getAttribute('src')).toBe('/thumb-probe-2.webp');
    expect(prior.isConnected).toBe(false);
  });
});

describe('photo probe cancellation boundaries and fallback', () => {
  it('closing before the entrance timer prevents the original probe entirely', () => {
    UI.showCardZoom(card(1), { presentation: 'photo' });
    document.getElementById('cardZoom')._closeCardZoom(true);
    vi.advanceTimersByTime(500);
    expect(probes).toHaveLength(0);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('retains the thumbnail until successful decode and does not cancel the committed original', async () => {
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    const zoom = document.getElementById('cardZoom');
    const image = zoom.querySelector('.cz-photo-image img');
    expect(image.getAttribute('src')).toBe('/thumb-probe-1.webp');
    probes[0].resolve(); await Promise.resolve(); await Promise.resolve();
    expect(image.getAttribute('src')).toBe('/original-probe-1.webp');
    expect(zoom.style.getPropertyValue('--cz-photo-ratio')).toBe('1');
    zoom._closeCardZoom(true);
    expect(probes[0].src).toBe('/original-probe-1.webp');
    expect(image.getAttribute('src')).toBe('/original-probe-1.webp');
  });
  it('a stale close can only cancel its own probe after the next photo starts loading', async () => {
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    const old = document.getElementById('cardZoom');
    UI.showCardZoom(card(2), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    expect(probes[0].src).toBe('');
    old._closeCardZoom(true);
    expect(probes[1].src).toBe('/original-probe-2.webp');
    probes[0].resolve(); probes[1].resolve(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('#cardZoom .cz-photo-image img').getAttribute('src')).toBe('/original-probe-2.webp');
  });
  it('a failed original leaves the already visible thumbnail intact', async () => {
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    probes[0].naturalHeight = probes[0].naturalWidth = 0;
    probes[0].reject(new Error('decode failed'));
    await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('#cardZoom .cz-photo-image img').getAttribute('src')).toBe('/thumb-probe-1.webp');
  });
  it('clears both fallback image handlers immediately when closing without decode support', () => {
    useLoadEvents = true;
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    expect(probes[0].onload).toBeTypeOf('function');
    expect(probes[0].onerror).toBeTypeOf('function');
    const lateLoad = probes[0].onload;
    document.getElementById('cardZoom').querySelector('.cz-close').click();
    expect(probes[0].src).toBe('');
    expect(probes[0].onload).toBeNull();
    expect(probes[0].onerror).toBeNull();
    lateLoad();
  });
  it('fallback load success upgrades the image and releases both handlers', async () => {
    useLoadEvents = true;
    UI.showCardZoom(card(1), { presentation: 'photo' }); vi.advanceTimersByTime(140);
    probes[0].onload(); await Promise.resolve(); await Promise.resolve();
    expect(document.querySelector('#cardZoom .cz-photo-image img').getAttribute('src')).toBe('/original-probe-1.webp');
    expect(probes[0].onload).toBeNull();
    expect(probes[0].onerror).toBeNull();
  });
});
