// @vitest-environment node
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { JSDOM } from 'jsdom';
import { describe, it, expect, vi } from 'vitest';
const html = readFileSync('game/dev/title-resource-review.html', 'utf8');
const js = readFileSync('game/dev/title-resource-review.js', 'utf8');
const original = new JSDOM(readFileSync('game/index.html', 'utf8')).window.document;
function setup(query = '') {
  const dom = new JSDOM(html, { url: `http://localhost/dev/title-resource-review.html${query}`, runScripts: 'outside-only' });
  const win = dom.window;
  let tick;
  win.setInterval = vi.fn(fn => { tick = fn; return 123; });
  win.clearInterval = vi.fn();
  win.performance.getEntriesByType = vi.fn(() => [
    {name:'http://localhost/assets/title-wordmark.png'},
    {name:'http://localhost/assets/reconstruction/wallpaper-snow-road-1016.webp?v=1016b'},
    {name:'http://localhost/assets/title-wordmark.png'},
    {name:'http://localhost/css/base.css'},
  ]);
  win.eval(js.replace('export function ', 'function ').replace('if (import.meta.env.DEV) mountTitleResourceReview();', 'window.mountReview = mountTitleResourceReview;'));
  const stop = win.mountReview();
  return { win, doc:win.document, tick:()=>tick(), stop, close:()=>{stop();win.close();} };
}
describe('isolated title CSS/image diagnostic', () => {
  it('is DEV-only, with no game module import, canvas, media, storage or network machinery', () => {
    expect(js).toContain('if (import.meta.env.DEV)');
    expect(js).not.toMatch(/\bimport\s*(?:\(|["'{*])|\bfetch\s*\(|new\s+(?:Image|Audio|Worker)|(?:local|session)Storage|requestAnimationFrame|\.decode\s*\(/);
    const doc = new JSDOM(html).window.document;
    expect(doc.querySelectorAll('script')).toHaveLength(1);
    expect(doc.querySelector('script').getAttribute('src')).toBe('/dev/title-resource-review.js');
    expect(doc.querySelector('#title')).toBeNull(); // inert until DEV gate mounts
    expect(doc.querySelector('#titleReviewTemplate').content.querySelectorAll('canvas,audio,video,iframe,script')).toHaveLength(0);
  });
  it('preserves actual title IDs, SVG art, wordmark and complete base stylesheet order', () => {
    const {doc,close}=setup();
    for (const el of original.querySelector('#title').querySelectorAll('[id]')) expect(doc.getElementById(el.id)).not.toBeNull();
    const oldSVG=[...original.querySelectorAll('#title svg')].map(n=>n.outerHTML);
    const newSVG=[...doc.querySelectorAll('#title svg')].map(n=>n.outerHTML);
    for (const svg of oldSVG) expect(newSVG).toContain(svg);
    expect(doc.querySelector('#title img').outerHTML).toBe(original.querySelector('#title img').outerHTML);
    const links=[...doc.querySelectorAll('link[rel=stylesheet]')].map(n=>n.getAttribute('href'));
    const oldLinks=[...original.querySelectorAll('link[rel=stylesheet]')].map(n=>n.getAttribute('href'));
    expect(links.slice(0,oldLinks.length)).toEqual(oldLinks);
    for(const href of links) expect(existsSync(resolve('game',href))).toBe(true);
    for(const selector of ['.home-depth','.home-mist','.home-grain','.home-flash','.home-sheen','.home-slash','.home-beams','.home-ghost','.home-rail','.home-readout']) expect(doc.querySelectorAll(selector)).toHaveLength(1);
    expect(doc.querySelectorAll('.home-spark')).toHaveLength(6);
    expect(doc.querySelectorAll('.home-near-snow i')).toHaveLength(6);
    expect(doc.querySelectorAll('.home-corner')).toHaveLength(4);
    expect(doc.querySelectorAll('.home-hover-glow')).toHaveLength(7);
    expect(doc.querySelectorAll('.home-index')).toHaveLength(7);
    expect(doc.querySelectorAll('canvas')).toHaveLength(0);
    close();
  });
  it('observes image requests without creating images and exposes live pulses', () => {
    const {doc,win,tick,close}=setup();
    expect(win.setInterval).toHaveBeenCalledTimes(1);
    expect(win.setInterval).toHaveBeenCalledWith(expect.any(Function),1000);
    expect(doc.querySelector('#reviewStatus').textContent).toContain('图片请求完成 2');
    tick(); tick();
    expect(doc.querySelector('#reviewStatus').textContent).toContain('心跳 2');
    expect(doc.images).toHaveLength(1);
    doc.querySelector('#mStart').click();
    expect(doc.querySelector('#title').hidden).toBe(false);
    expect(win.location.pathname).toBe('/dev/title-resource-review.html');
    close();
  });
  it('toggles CSS pause without changing DOM/assets, supports cold paused and wallpaper query cases', () => {
    const {doc,close}=setup('?paused=1&wallpaper=baita-heixiang');
    const title=doc.querySelector('#title'), before=title.innerHTML;
    expect(title.dataset.homeWallpaper).toBe('baita-heixiang');
    expect(doc.body.classList.contains('title-review-paused')).toBe(true);
    doc.querySelector('#pauseDecorations').click();
    expect(doc.body.classList.contains('title-review-paused')).toBe(false);
    expect(doc.querySelector('#pauseDecorations').getAttribute('aria-pressed')).toBe('false');
    expect(title.innerHTML).toBe(before);
    expect(html).toContain('animation-play-state:paused!important;transition:none!important;');
    const select=doc.querySelector('#reviewWallpaper');select.value='snow-road';select.dispatchEvent(new doc.defaultView.Event('change'));
    expect(title.dataset.homeWallpaper).toBe('snow-road');
    close();
  });
  it('cleans its sole interval and listeners on pagehide, idempotently', () => {
    const {win,doc,stop,close}=setup();
    win.dispatchEvent(new win.Event('pagehide'));
    stop();
    expect(win.clearInterval).toHaveBeenCalledTimes(1);
    expect(win.clearInterval).toHaveBeenCalledWith(123);
    doc.querySelector('#pauseDecorations').click();
    expect(doc.body.classList.contains('title-review-paused')).toBe(false);
    close();
  });
});
