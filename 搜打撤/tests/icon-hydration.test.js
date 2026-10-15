import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { observeIconHydration } from '../game/src/core/icon-hydration.js';

let observer, frames, hydrate, scrubAttrs;
const hasTokens = text => /\[\[icon:|❤/.test(text);
const deliver = async () => { await Promise.resolve(); };
beforeEach(() => {
  frames = []; hydrate = vi.fn(); scrubAttrs = vi.fn();
  document.body.replaceChildren();
  vi.stubGlobal('requestAnimationFrame', fn => { frames.push(fn); return frames.length; });
  observer = observeIconHydration(document.body, { hydrate, scrubAttrs, hasTokens });
});
afterEach(() => { observer.disconnect(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe('全局图标增量处理', () => {
  it('同批父子新增只扫描最上层，兄弟子树各处理一次', async () => {
    const page = document.createElement('section'); document.body.append(page);
    for (let i = 0; i < 400; i++) page.append(document.createElement('span'));
    const sibling = document.createElement('aside'); document.body.append(sibling);
    const contains = vi.spyOn(Node.prototype, 'contains');
    await deliver(); expect(frames).toHaveLength(1); frames.shift()();
    expect(hydrate.mock.calls.map(([root]) => root)).toEqual([page, sibling]);
    expect(contains).not.toHaveBeenCalled(); contains.mockRestore();
  });
  it('脱离节点不处理；重新挂载子树仍可处理', async () => {
    const page = document.createElement('section'); document.body.append(page); page.remove();
    await deliver(); frames.shift()(); expect(hydrate).not.toHaveBeenCalled();
    document.body.append(page); await deliver(); frames.shift()(); expect(hydrate).toHaveBeenCalledWith(page);
  });
  it('普通数字文字刷新不触发扫描，图标文字仍扫描其父节点', async () => {
    const value = document.createElement('b'); document.body.append(value);
    await deliver(); frames.shift()(); hydrate.mockClear();
    value.textContent = '123'; await deliver(); expect(frames).toHaveLength(0);
    value.textContent = '❤'; await deliver(); frames.shift()(); expect(hydrate).toHaveBeenCalledWith(value);
  });
  it('标签属性只清理对应元素；生成的位图不再安排整页扫描', async () => {
    document.body.setAttribute('aria-label', '[[icon:heart]] 生命');
    const image = document.createElement('img'); image.className = 'ic'; document.body.append(image);
    await deliver();
    expect(scrubAttrs).toHaveBeenCalledWith(document.body);
    expect(scrubAttrs).toHaveBeenCalledWith(image);
    expect(frames).toHaveLength(0); expect(hydrate).not.toHaveBeenCalled();
    document.body.removeAttribute('aria-label');
  });
});

describe('图标字符串转换', () => {
  it('快速分支与富文本保留转义、属性清理和emoji语义', async () => {
    observer.disconnect();
    vi.stubGlobal('MutationObserver', undefined);
    await import('../game/src/core/icons-bitmap.js');
    const { Icons } = window.SDT;
    expect(Icons.rich('<b>普通文本 123</b>')).toBe('<b>普通文本 123</b>');
    expect(Icons.rich('[[icon:heart]]')).toContain('data-asset-key="icon-heart"');
    expect(Icons.rich('💚')).toContain('data-asset-key="icon-heart"');
    expect(Icons.rich('💚')).toContain('data-asset-key="icon-heart"');
    expect(Icons.rich('<b title="❤">文字</b>')).toBe('<b title="❤">文字</b>');
    document.body.innerHTML = '<p title="[[icon:heart]] 生命"></p>';
    document.querySelector('p').textContent = '<img onerror=alert(1)> 💚 [[icon:bag]]';
    Icons.hydrate(document.body);
    expect(document.querySelector('p').getAttribute('title')).toBe('生命');
    expect(document.querySelectorAll('img')).toHaveLength(2);
    expect(document.querySelector('[onerror]')).toBeNull();
    expect(document.querySelector('p').textContent).toContain('<img onerror=alert(1)>');
  });
});
