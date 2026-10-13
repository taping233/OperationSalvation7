import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const pond = vi.hoisted(() => ({ resize: vi.fn(), tap: vi.fn(), pointer: vi.fn(), render: vi.fn(), dispose: vi.fn() }));
vi.mock('../game/src/hub/courtyard-vendor/KoiPond.js', () => ({ createKoiPond: () => pond }));
const rain = vi.hoisted(() => ({ resize:vi.fn(), render:vi.fn(), tap:vi.fn(() => true), setIntensity:vi.fn(), setPalette:vi.fn(), dispose:vi.fn() }));
vi.mock('../game/src/hub/courtyard.rain-tableau.js', () => ({ createRainTableau:() => rain }));
import { courtyardV3HTML, mountCourtyardV3 } from '../game/src/hub/hub.courtyard-v3.js';

let media, frames, raf, cancel, resizeObserver, dispose, hidden;
beforeEach(() => {
  vi.clearAllMocks();
  media = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() };
  frames = new Map(); let sequence = 0;
  raf = vi.fn(callback => { frames.set(++sequence, callback); return sequence; });
  cancel = vi.fn(id => { frames.delete(id); });
  vi.stubGlobal('requestAnimationFrame', raf); vi.stubGlobal('cancelAnimationFrame', cancel);
  vi.stubGlobal('matchMedia', () => media);
  resizeObserver = { observe: vi.fn(), disconnect: vi.fn() };
  vi.stubGlobal('ResizeObserver', class { constructor() { return resizeObserver; } });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ fillRect:vi.fn(), drawImage:vi.fn() });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ width: 900, height: 500, left: 0, top: 0 });
  hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.stubGlobal('AudioContext', vi.fn());
});
afterEach(() => { dispose?.(); dispose = null; document.body.replaceChildren(); document.body.classList.remove('reduce-motion'); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const mount = view => {
  document.body.innerHTML = courtyardV3HTML(view);
  dispose = mountCourtyardV3(document.body, view);
  return document.querySelector('[data-courtyard]');
};
describe('庭院独立页生命周期', () => {
  it('默认只启动一个本地动画，声音关闭；暂停和恢复对应取消与启动', () => {
    const root = mount('koi');
    expect(frames.size).toBe(1);
    expect(window.AudioContext).not.toHaveBeenCalled();
    expect(root.querySelector('[data-courtyard-control="sound"]').getAttribute('aria-pressed')).toBe('false');
    const pause = root.querySelector('[data-courtyard-control="pause"]');
    pause.click(); expect(frames.size).toBe(0); expect(pause.textContent).toBe('继续');
    pause.click(); expect(frames.size).toBe(1); expect(pause.textContent).toBe('暂停');
    root.querySelector('[data-courtyard-control="feed"]').click();
    expect(pond.tap).toHaveBeenCalledWith(450, 250);
  });
  it('减少动效不持续调度，仍显示静态雨景；离开释放画布和监听', () => {
    media.matches = true;
    const root = mount('rain');
    expect(frames.size).toBe(0);
    expect(rain.render).toHaveBeenCalledWith(0, false);
    expect(root.classList.contains('is-still')).toBe(true);
    dispose(); dispose();
    expect(resizeObserver.disconnect).toHaveBeenCalledTimes(1);
    expect(media.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    expect(root.querySelector('.courtyard-v3-canvas').width).toBe(1);
    expect(rain.dispose).toHaveBeenCalledTimes(1);
  });
  it('隐藏页停止调度；恢复后继续；销毁后操作不再唤起动画或投喂', () => {
    const root = mount('koi');
    hidden.mockReturnValue(true); document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(0);
    hidden.mockReturnValue(false); document.dispatchEvent(new Event('visibilitychange'));
    expect(frames.size).toBe(1);
    dispose();
    expect(frames.size).toBe(0); expect(pond.dispose).toHaveBeenCalledTimes(1);
    const calls = raf.mock.calls.length;
    root.querySelector('[data-courtyard-control="pause"]').click();
    root.querySelector('[data-courtyard-control="interact"]').click();
    document.dispatchEvent(new Event('visibilitychange'));
    expect(raf.mock.calls.length).toBe(calls); expect(pond.tap).not.toHaveBeenCalled();
  });
  it('声音只由手动打开；暂停挂起，离开停止音源并关闭上下文', () => {
    const source = { connect: vi.fn(), start: vi.fn(), stop: vi.fn(), disconnect: vi.fn() };
    const filter = { type: '', frequency: { value: 0 }, connect: vi.fn() };
    const gain = { gain: { value: 0 }, connect: vi.fn() };
    const audio = {
      sampleRate: 100, destination: {}, createBuffer: vi.fn(() => ({ getChannelData: () => new Float32Array(200) })),
      createBufferSource: () => source, createBiquadFilter: () => filter, createGain: () => gain,
      resume: vi.fn(() => Promise.resolve()), suspend: vi.fn(() => Promise.resolve()), close: vi.fn(() => Promise.resolve()),
    };
    vi.stubGlobal('AudioContext', vi.fn(function() { return audio; }));
    const root = mount('koi');
    expect(window.AudioContext).not.toHaveBeenCalled();
    root.querySelector('[data-courtyard-control="sound"]').click();
    expect(source.start).toHaveBeenCalledTimes(1); expect(audio.resume).toHaveBeenCalled();
    expect(root.querySelector('[data-courtyard-control="sound"]').getAttribute('aria-pressed')).toBe('true');
    root.querySelector('[data-courtyard-control="pause"]').click(); expect(audio.suspend).toHaveBeenCalled();
    root.querySelector('[data-courtyard-control="rain"]').click();
    expect(source.stop).toHaveBeenCalledTimes(1); expect(source.disconnect).toHaveBeenCalled();
    expect(audio.close).toHaveBeenCalledTimes(1);
    root.querySelector('[data-courtyard-control="rain"]').click();
    expect(source.start).toHaveBeenCalledTimes(1);
    expect(root.querySelector('[data-courtyard-control="sound"]').getAttribute('aria-pressed')).toBe('false');
    dispose(); expect(audio.close).toHaveBeenCalledTimes(1);
  });
  it('雨势与三配色沿同一引擎，静态情况下交互仍可产生反馈', () => {
    const root = mount('rain');
    root.querySelector('[data-courtyard-control="interact"]').click();
    expect(rain.setIntensity).toHaveBeenCalledWith(80);
    root.querySelector('[data-palette="moss"]').click();
    expect(rain.setPalette).toHaveBeenCalledWith('moss');
    expect(root.querySelector('[data-palette="moss"]').getAttribute('aria-pressed')).toBe('true');
    root.querySelector('.courtyard-v3-canvas').dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
    expect(rain.tap).toHaveBeenCalledWith(450, 250);
    expect(root.querySelector('.courtyard-v3-status').textContent).toBe('已投喂 · 雨圈散开');
  });
  it('关闭雨隐藏雨层并停止雨交互，保留单循环、投喂和指针交互；再次打开恢复雨', () => {
    const root = mount('rain');
    const toggle = root.querySelector('[data-courtyard-control="rain"]');
    toggle.click();
    expect(root.querySelector('.courtyard-v3-rain-layer').hidden).toBe(true);
    expect(toggle.textContent).toBe('开启雨');
    expect(root.querySelector('[data-courtyard-control="sound"]').disabled).toBe(true);
    expect([...root.querySelectorAll('[data-palette]')].every(button=>button.disabled)).toBe(true);
    expect(frames.size).toBe(1);
    rain.render.mockClear(); rain.tap.mockClear(); pond.tap.mockClear();
    root.querySelector('[data-courtyard-control="feed"]').click();
    expect(pond.tap).toHaveBeenCalledWith(450, 250);
    expect(rain.tap).not.toHaveBeenCalled(); expect(rain.render).not.toHaveBeenCalled();
    const canvas = root.querySelector('.courtyard-v3-canvas');
    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX:300, clientY:200 }));
    expect(pond.pointer).toHaveBeenCalledWith(300, 200);
    canvas.dispatchEvent(new Event('pointerleave')); expect(pond.pointer).toHaveBeenCalledWith(null, null);
    toggle.click(); expect(root.querySelector('.courtyard-v3-rain-layer').hidden).toBe(false);
    expect([...root.querySelectorAll('[data-palette]')].every(button=>!button.disabled)).toBe(true);
    expect(root.querySelector('[data-courtyard-control="sound"]').getAttribute('aria-pressed')).toBe('false');
    expect(rain.render).toHaveBeenCalled(); expect(frames.size).toBe(1);
  });
  it('应用内减少动效设置在开启时静态，运行中切换立即停止并可恢复', async () => {
    document.body.classList.add('reduce-motion');
    const root = mount('koi');
    expect(frames.size).toBe(0); expect(root.classList.contains('is-still')).toBe(true);
    expect(root.querySelector('[data-courtyard-control="pause"]').disabled).toBe(true);
    document.body.classList.remove('reduce-motion'); await Promise.resolve();
    expect(frames.size).toBe(1); expect(root.classList.contains('is-still')).toBe(false);
    document.body.classList.add('reduce-motion'); await Promise.resolve();
    expect(frames.size).toBe(0); expect(root.classList.contains('is-still')).toBe(true);
  });
});
