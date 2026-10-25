import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCardZoomController } from '../game/src/ui/card-zoom-controller.js';
import { loadPhotoSource, releasePhotoSource } from '../game/src/ui/card-zoom-photo-source.js';

const card = { id: 'zoom-a', name: '甲', type: '法术' };
let hosts;
beforeEach(() => { vi.useFakeTimers(); hosts = []; });
afterEach(() => {
  document.getElementById('cardZoom')?._closeCardZoom(true);
  hosts.forEach(host => host.el.overlay.remove());
  document.body.classList.remove('zoom-open');
  vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals();
});
function services(label) {
  return {
    cards: { all: vi.fn(() => [card]), cardHTML: vi.fn(() => `<article>${label}</article>`), rarityOf: () => '普通', DMG_TYPES: [], deriveDraw: () => 0 },
    art: { cardIcon: vi.fn(() => `<img src="/${label}.webp">`), decodeIn: vi.fn() },
    scale: { rect: vi.fn(() => ({ left: 0, top: 0, width: 0, height: 0 })), scale: vi.fn(() => 1) },
    sound: { sfx: vi.fn() },
  };
}
function hostFor(controller) {
  const overlay = document.createElement('section');
  const ovBody = document.createElement('div');
  ovBody.innerHTML = '<main><button>来源</button></main>';
  overlay.append(ovBody); document.body.append(overlay);
  const host = { el: { overlay, ovBody }, _acts: { mutate: vi.fn() },
    showCardZoom(c, opts) { controller.show(this, c, opts); } };
  hosts.push(host); return host;
}
function setup() {
  let live = services('first');
  const controller = createCardZoomController({ readCards: () => live.cards,
    readArt: () => live.art, readScale: () => live.scale, readSound: () => live.sound });
  return { controller, get live() { return live; }, replace(next) { live = next; } };
}

describe('card zoom ownership and live service ports', () => {
  it('reads replacement services when reopening on a different host and releases the previous host', () => {
    const h = setup();
    const firstHost = hostFor(h.controller);
    firstHost.showCardZoom(card);
    const old = document.getElementById('cardZoom');
    expect(old.textContent).toContain('first');
    expect(firstHost.el.overlay.inert).toBe(true);
    const next = services('second'); h.replace(next);
    const secondHost = hostFor(h.controller);
    secondHost.showCardZoom(card, { presentation: 'photo' });
    expect(old.isConnected).toBe(false);
    expect(firstHost.el.overlay.inert).toBe(false);
    expect(secondHost.el.overlay.inert).toBe(true);
    const zoom = document.getElementById('cardZoom');
    expect(zoom.querySelector('img').getAttribute('src')).toBe('/second.webp');
    expect(next.cards.all).toHaveBeenCalledOnce();
    expect(next.art.decodeIn).toHaveBeenCalledWith(zoom);
    expect(next.scale.rect).toHaveBeenCalled();
    expect(next.sound.sfx).toHaveBeenCalledWith('hover');
  });

  it.each(['host', 'root', 'source'])('rejects stale footer actions after %s invalidation', invalidation => {
    const h = setup(); const host = hostFor(h.controller);
    const source = host.el.ovBody.querySelector('button');
    host.showCardZoom(card, { from: source, footer: '<button data-act="mutate">修改</button>' });
    const button = document.querySelector('#cardZoom [data-act]');
    button.click();
    expect(host._acts.mutate).toHaveBeenCalledOnce();
    if (invalidation === 'host') {
      const replacement = document.createElement('div');
      replacement.innerHTML = '<main>下一页</main>';
      host.el.overlay.append(replacement); host.el.ovBody = replacement;
    } else if (invalidation === 'root') host.el.ovBody.innerHTML = '<main>下一页</main>';
    else source.remove();
    button.click();
    expect(host._acts.mutate).toHaveBeenCalledOnce();
    expect(document.getElementById('cardZoom').inert).toBe(true);
  });

  it('drops a prior footer while browsing and keeps composition arrows from navigating', () => {
    const h = setup(); const host = hostFor(h.controller);
    const second = { ...card, id: 'zoom-b', name: '乙' };
    host.showCardZoom(card, { items: [card, second], footer: '<button data-act="mutate">修改</button>' });
    let zoom = document.getElementById('cardZoom');
    zoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', isComposing: true, bubbles: true }));
    expect(document.getElementById('cardZoom')).toBe(zoom);
    zoom.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    zoom = document.getElementById('cardZoom');
    expect(zoom.getAttribute('aria-label')).toContain('乙');
    expect(zoom.querySelector('.cz-foot')).toBeNull();
  });

  it('releases a cancelled photo probe before its pending decode settles', async () => {
    let complete;
    const probe = { src: '', naturalWidth: 80, naturalHeight: 100,
      removeAttribute(name) { if (name === 'src') this.src = ''; },
      decode: () => new Promise(resolve => { complete = resolve; }) };
    vi.stubGlobal('Image', function () { return probe; });
    const zoom = document.createElement('div'); const visible = document.createElement('img');
    visible.src = '/thumbnail.webp'; zoom.append(visible); document.body.append(zoom);
    const request = loadPhotoSource(zoom, '/original.webp', visible);
    releasePhotoSource(request);
    expect(request.dispose).toBeTypeOf('function');
    expect(probe.src).toBe('');
    complete(); await Promise.resolve(); await Promise.resolve();
    expect(visible.getAttribute('src')).toBe('/thumbnail.webp');
    zoom.remove();
  });
});
