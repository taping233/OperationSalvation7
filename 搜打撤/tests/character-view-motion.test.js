import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCharacterViewMotion } from '../game/src/ui/character-view-motion.js';

const nativeAnimate = Object.getOwnPropertyDescriptor(Element.prototype, 'animate');
afterEach(() => {
  vi.restoreAllMocks(); vi.unstubAllGlobals();
  if (nativeAnimate) Object.defineProperty(Element.prototype, 'animate', nativeAnimate);
  else delete Element.prototype.animate;
  document.body.replaceChildren(); document.body.classList.remove('reduce-motion');
});
const portrait = name => {
  const node = document.createElement('div');
  node.dataset.character = name;
  node.innerHTML = '<div class="art-figure-wrap"><img></div>';
  return node;
};
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

describe('人物与皮肤交叠切换', () => {
  it('新图解码前保留旧图，乱序完成只显示最后选择', async () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel() {} }));
    vi.stubGlobal('matchMedia', () => ({ matches:false }));
    Object.defineProperty(Element.prototype, 'animate', { configurable:true, value:animate });
    const old = portrait('old'); document.body.append(old);
    const first = portrait('first'), last = portrait('last');
    let readyFirst, readyLast;
    first.querySelector('img').decode = () => new Promise(resolve => { readyFirst = resolve; });
    last.querySelector('img').decode = () => new Promise(resolve => { readyLast = resolve; });
    const motion = createCharacterViewMotion();
    motion.swapPortrait(old, first, 1);
    motion.swapPortrait(old, last, -1);
    expect(old.isConnected).toBe(true);
    readyLast(); await flush();
    expect(last.isConnected).toBe(true);
    expect(first.isConnected).toBe(false);
    expect(last.querySelector('[data-portrait-outgoing]').dataset.character).toBe('old');
    expect(animate).toHaveBeenCalledTimes(2);
    readyFirst(); await flush();
    expect(last.isConnected).toBe(true);
    expect(first.isConnected).toBe(false);
  });

  it('减弱动态效果时立即切换，不等待解码或残留旧图层', () => {
    document.body.classList.add('reduce-motion');
    const old = portrait('old'), next = portrait('next'); document.body.append(old);
    const decode = vi.fn(() => new Promise(() => {})); next.querySelector('img').decode = decode;
    createCharacterViewMotion().swapPortrait(old, next);
    expect(next.isConnected).toBe(true);
    expect(decode).not.toHaveBeenCalled();
    expect(next.querySelector('[data-portrait-outgoing]')).toBeNull();
  });
});
