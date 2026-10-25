import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCharacterViewMotion } from '../game/src/ui/character-view-motion.js';

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

function setup() {
  document.body.innerHTML = '<div id="overlay"><div class="cls2-stage"><div class="cls2-fullart" data-character="wu"><img src="/wu.webp"></div></div></div>';
  const current = document.querySelector('.cls2-fullart');
  const template = document.createElement('template');
  template.innerHTML = '<div class="cls2-fullart" data-character="changwuyu"><img src="/changwuyu.webp" loading="lazy"></div>';
  const next = template.content.firstElementChild;
  const image = next.querySelector('img');
  Object.defineProperty(image, 'naturalWidth', { value: 1024 });
  return { current, next, image };
}

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

describe('选人模板立绘准备', () => {
  it('先脱离惰性模板文档再解码，准备完成前保留当前立绘', async () => {
    const { current, next, image } = setup();
    expect(next.ownerDocument).not.toBe(document);
    let decoded;
    image.decode = vi.fn(() => {
      expect(image.ownerDocument).toBe(document);
      expect(next.isConnected).toBe(false);
      return new Promise(resolve => { decoded = resolve; });
    });
    createCharacterViewMotion().swapPortrait(current, next, 1);
    expect(current.isConnected).toBe(true);
    expect(image.loading).toBe('eager');
    decoded(); await flush();
    expect(next.isConnected).toBe(true);
    expect(current.isConnected).toBe(false);
    expect(image.dataset.visualState).toBe('ready');
    expect(document.querySelector('.visual-resource-recovery')).toBeNull();
  });

  it('快速切人仍只显示最后选择，旧解码完成不覆盖', async () => {
    const { current, next:first, image:firstImage } = setup();
    const template = document.createElement('template');
    template.innerHTML = '<div class="cls2-fullart" data-character="baita"><img src="/baita.webp"></div>';
    const last = template.content.firstElementChild, lastImage = last.querySelector('img');
    Object.defineProperty(lastImage, 'naturalWidth', { value:1024 });
    let finishFirst, finishLast;
    firstImage.decode = () => new Promise(resolve => { finishFirst = resolve; });
    lastImage.decode = () => new Promise(resolve => { finishLast = resolve; });
    const motion = createCharacterViewMotion();
    motion.swapPortrait(current, first, 1);
    motion.swapPortrait(current, last, 1);
    finishLast(); await flush();
    finishFirst(); await flush();
    expect(last.isConnected).toBe(true);
    expect(first.isConnected).toBe(false);
  });

  it('图片失败时保留旧图，重试可显示同一张模板立绘', async () => {
    const { current, next, image } = setup();
    image.decode = vi.fn().mockRejectedValueOnce(new Error('load failed')).mockResolvedValueOnce();
    createCharacterViewMotion().swapPortrait(current, next, 1);
    await flush();
    expect(current.isConnected).toBe(true);
    expect(current.dataset.portraitPreparation).toBe('unavailable');
    current.querySelector('button').click(); await flush();
    expect(next.isConnected).toBe(true);
    expect(document.querySelector('.visual-resource-recovery')).toBeNull();
  });
});
