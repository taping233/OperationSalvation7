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
  node.innerHTML = '<div class="art-figure-wrap"><img src="/portrait.webp"></div>';
  Object.defineProperty(node.querySelector('img'),'naturalWidth',{value:300});
  node.querySelector('img').decode=async()=>{};
  return node;
};
const flush = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

describe('人物与皮肤交叠切换', () => {
  it('换肤保留画框与待机进度，只在同一位置交叠淡入淡出', async () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel() {} }));
    vi.stubGlobal('matchMedia', () => ({ matches: false }));
    Object.defineProperty(Element.prototype, 'animate', { configurable: true, value: animate });
    const old = portrait('wu'), next = portrait('wu');
    for (const node of [old, next]) {
      const surface = document.createElement('div');
      surface.className = 'roster-art-surface';
      surface.append(node.firstElementChild); node.append(surface);
    }
    old.dataset.skin = 'default'; next.dataset.skin = 'casual';
    const oldSurface = old.firstElementChild, newSurface = next.firstElementChild;
    const incomingIdle = { animationName: 'idleWu', currentTime: 0 };
    old.querySelector('.art-figure-wrap').getAnimations = () => [{ animationName: 'idleWu', currentTime: 17320 }];
    next.querySelector('.art-figure-wrap').getAnimations = () => [incomingIdle];
    document.body.innerHTML='<div id="overlay"></div>'; document.querySelector('#overlay').append(old);
    createCharacterViewMotion().swapPortrait(old, next);
    await flush();
    expect(old.isConnected).toBe(true);
    expect(old.dataset.skin).toBe('casual');
    expect(old.children.length).toBe(2);
    expect(newSurface.parentElement).toBe(old);
    expect(oldSurface.parentElement).toBe(old);
    expect(oldSurface.dataset.portraitOutgoing).toBe('true');
    expect(incomingIdle.currentTime).toBe(17320);
    for (const [frames] of animate.mock.calls) expect(frames.every(frame => !frame.transform || !frame.transform.includes('scale'))).toBe(true);
  });

  it('新图解码前保留旧图，乱序完成只显示最后选择', async () => {
    const animate = vi.fn(() => ({ finished: new Promise(() => {}), cancel() {} }));
    vi.stubGlobal('matchMedia', () => ({ matches:false }));
    Object.defineProperty(Element.prototype, 'animate', { configurable:true, value:animate });
    const old = portrait('old'); document.body.innerHTML='<div id="overlay"></div>'; document.querySelector('#overlay').append(old);
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

  it('减弱动态效果仍等待新图准备，随后立即切换且不残留旧层', async () => {
    document.body.classList.add('reduce-motion');
    const old = portrait('old'), next = portrait('next'); document.body.innerHTML='<div id="overlay"></div>'; document.querySelector('#overlay').append(old);
    const decode = vi.fn(async () => {}); next.querySelector('img').decode = decode;
    createCharacterViewMotion().swapPortrait(old, next);
    expect(old.isConnected).toBe(true); await flush();
    expect(next.isConnected).toBe(true);
    expect(decode).toHaveBeenCalledOnce();
    expect(next.querySelector('[data-portrait-outgoing]')).toBeNull();
  });
});
