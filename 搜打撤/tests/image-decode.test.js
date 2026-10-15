import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeImagesIn } from '../game/src/core/image-decode.js';

let image, frames;
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
beforeEach(() => {
  document.body.innerHTML = '<img src="/first.webp" loading="lazy">';
  image = document.querySelector('img'); frames = [];
  image.decode = vi.fn(() => Promise.resolve());
  Object.defineProperty(image, 'complete', { configurable: true, value: false });
  vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
});
afterEach(() => { document.body.replaceChildren(); vi.unstubAllGlobals(); });

describe('图片解码与补绘生命周期', () => {
  it('二十次刷新只登记一次load/解码/补绘，完成后再次调用仍命中', async () => {
    for (let i = 0; i < 20; i++) decodeImagesIn(document.body);
    expect(image.loading).toBe('eager');
    image.dispatchEvent(new Event('load')); await flush();
    expect(image.decode).toHaveBeenCalledTimes(1); expect(frames).toHaveLength(1);
    expect(image.style.visibility).toBe('hidden'); frames.shift()();
    expect(image.style.visibility).toBe('');
    decodeImagesIn(document.body); expect(image.decode).toHaveBeenCalledTimes(1);
  });
  it('解码完成后移除的图不闪烁，重新挂载允许再解码', async () => {
    decodeImagesIn(document.body); image.remove();
    image.dispatchEvent(new Event('load')); await flush(); expect(frames).toHaveLength(0);
    document.body.append(image); decodeImagesIn(document.body);
    image.dispatchEvent(new Event('load')); await flush(); expect(image.decode).toHaveBeenCalledTimes(2);
  });
  it('切换src不接受旧解码结果，只补绘新源', async () => {
    let oldDone;
    image.decode.mockImplementationOnce(() => new Promise(resolve => { oldDone = resolve; }));
    decodeImagesIn(document.body); image.dispatchEvent(new Event('load'));
    image.src = '/second.webp'; decodeImagesIn(document.body);
    oldDone(); await flush(); expect(frames).toHaveLength(0);
    image.dispatchEvent(new Event('load')); await flush();
    expect(image.decode).toHaveBeenCalledTimes(2); expect(frames).toHaveLength(1);
  });
  it('加载错误或解码失败可在之后重试', async () => {
    decodeImagesIn(document.body); image.dispatchEvent(new Event('error'));
    image.decode.mockRejectedValueOnce(new Error('decode'));
    decodeImagesIn(document.body); image.dispatchEvent(new Event('load')); await flush();
    expect(frames).toHaveLength(0);
    decodeImagesIn(document.body); image.dispatchEvent(new Event('load')); await flush();
    expect(image.decode).toHaveBeenCalledTimes(2); expect(frames).toHaveLength(1);
  });
  it('缓存完成的图直接解码，补绘后恢复原有visibility及优先级', async () => {
    Object.defineProperty(image, 'complete', { value: true });
    Object.defineProperty(image, 'naturalWidth', { value: 64 });
    image.style.setProperty('visibility', 'visible', 'important');
    decodeImagesIn(document.body); await flush(); frames.shift()();
    expect(image.decode).toHaveBeenCalledTimes(1);
    expect(image.style.getPropertyValue('visibility')).toBe('visible');
    expect(image.style.getPropertyPriority('visibility')).toBe('important');
  });
  it('decode同步抛错仍可重试，无decode环境不添加无效回调', async () => {
    image.decode.mockImplementationOnce(() => { throw new Error('unsupported'); });
    decodeImagesIn(document.body); image.dispatchEvent(new Event('load'));
    decodeImagesIn(document.body); image.dispatchEvent(new Event('load')); await flush();
    expect(image.decode).toHaveBeenCalledTimes(2);
    image.decode = undefined; image.src = '/third.webp';
    expect(() => decodeImagesIn(document.body)).not.toThrow();
  });
});
