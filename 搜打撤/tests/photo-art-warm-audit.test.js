// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren(); });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { resolve, promise }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('照相馆图片队列隔离', () => {
  it('两次自动尝试后提供手动恢复，重置页面即移除入口并隔离旧完成', async () => {
    vi.resetModules();vi.useFakeTimers();vi.stubGlobal('IntersectionObserver',undefined);
    document.body.innerHTML='<section><div id="libGrid"><button><span class="studio-photo-art"><img data-lib-src="/missing.webp"></span></button></div></section>';
    const image=document.querySelector('img');image.decode=vi.fn(()=>Promise.reject(new Error('unavailable')));
    const {warmLibArt,resetLibArtWarmup}=await import('../game/src/hub/game.cardslib.art-warm.js');
    warmLibArt();await flush();
    expect(document.querySelector('.list-image-recovery')).toBeNull();
    await vi.advanceTimersByTimeAsync(350);await flush();
    expect(image.decode).toHaveBeenCalledTimes(2);
    const retry=document.querySelector('.list-image-recovery button');
    expect(retry).not.toBeNull();expect(retry.closest('#libGrid')).toBeNull();
    resetLibArtWarmup();
    expect(document.querySelector('.list-image-recovery')).toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(image.decode).toHaveBeenCalledTimes(2);
  });
  it('解码最多并发四张，旧页重置后迟到完成不启动旧队列', async () => {
    vi.resetModules(); vi.stubGlobal('IntersectionObserver', undefined);
    document.body.innerHTML = '<div id="libGrid"></div><div id="libPreview"></div>';
    const grid = document.getElementById('libGrid');
    grid.innerHTML = Array.from({ length: 9 }, (_, i) => `<span class="studio-photo-art"><img data-lib-src="/fixture-${i}.png"></span>`).join('');
    const images = [...grid.querySelectorAll('img')], gates = images.map(() => deferred());
    images.forEach((image, i) => { image.decode = vi.fn(() => gates[i].promise); });
    const { warmLibArt, resetLibArtWarmup } = await import('../game/src/hub/game.cardslib.art-warm.js');
    warmLibArt();
    expect(images.filter(image => image.decode.mock.calls.length)).toHaveLength(4);
    gates[0].resolve(); await flush();
    expect(images.filter(image => image.decode.mock.calls.length)).toHaveLength(5);
    resetLibArtWarmup();
    gates.forEach(gate => gate.resolve()); await flush();
    expect(images.slice(5).every(image => !image.decode.mock.calls.length)).toBe(true);
  });
  it('同一图幂等预热；更换根后旧observer回调不赋src，新的图仍能预热', async () => {
    vi.resetModules();
    const observers = [];
    vi.stubGlobal('IntersectionObserver', class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() {} unobserve() {} disconnect() { this.disconnected = true; }
    });
    document.body.innerHTML = '<div id="libGrid"><span class="studio-photo-art"><img data-lib-src="/old.png"></span></div>';
    const old = document.querySelector('img'); old.decode = vi.fn(() => Promise.resolve());
    const { warmLibArt, resetLibArtWarmup } = await import('../game/src/hub/game.cardslib.art-warm.js');
    warmLibArt();
    document.getElementById('libGrid').remove();
    document.body.insertAdjacentHTML('beforeend', '<div id="libGrid"><span class="studio-photo-art"><img data-lib-src="/new.png"></span></div>');
    const next = document.querySelector('img'); next.decode = vi.fn(() => Promise.resolve());
    warmLibArt({ nearViewport: true, roots: [next.parentElement] });
    observers[0].callback([{ target: old, isIntersecting: true }]);
    expect(old.getAttribute('src')).toBeNull();
    expect(observers[0].disconnected).toBe(true);
    warmLibArt({ nearViewport: true, roots: [next.parentElement] }); await flush();
    expect(next.decode).toHaveBeenCalledTimes(1);
    resetLibArtWarmup();
  });
});
