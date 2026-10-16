import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const html = readFileSync('game/index.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
let dom, win;

function notice() { return win.document.body.querySelector('div'); }
function ready(state = 'title') {
  win.SDT = { game: { state } };
  win.document.getElementById('title').dataset.controlsBound = 'true';
}
function resourceError(tagName) {
  const resource = win.document.createElement(tagName);
  win.document.head.appendChild(resource);
  resource.dispatchEvent(new win.Event('error'));
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  dom = new JSDOM('<body><main id="title"></main></body>', { runScripts: 'outside-only', url: 'http://localhost/' });
  win = dom.window;
  win.Date = Date;
  win.setInterval = vi.fn((callback, ms) => setInterval(callback, ms));
  win.clearInterval = vi.fn(id => clearInterval(id));
  vi.spyOn(win, 'removeEventListener');
  win.eval(source);
});
afterEach(() => {
  win.dispatchEvent(new win.Event('pagehide'));
  dom.window.close();
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('内联启动提示守护', () => {
  it('3s 前不提示，首个超过 3s 的检查只显示中性加载提示', () => {
    vi.advanceTimersByTime(2800);
    expect(notice()).toBeNull();
    vi.advanceTimersByTime(400);
    expect(notice().textContent).toContain('资源加载中');
    expect(notice().textContent).not.toContain('失败');
    expect(notice().querySelector('button')).toBeNull();
    expect(vi.getTimerCount()).toBe(1);
  });

  it('12s 只升级为耗时较长，单个监测仍在，后续检查不重建提示条', () => {
    vi.advanceTimersByTime(12000);
    const slow = notice();
    expect(slow.textContent).toContain('加载耗时较长');
    expect(slow.textContent).not.toContain('失败');
    expect(slow.querySelector('button')).not.toBeNull();
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(60000);
    expect(notice()).toBe(slow);
    expect(win.document.body.querySelectorAll('div')).toHaveLength(1);
    expect(win.setInterval).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
  });

  it.each([
    ['空 SDT 命名空间', () => { win.SDT = {}; }],
    ['已绑定标题但仍处于 boot', () => { ready('boot'); }],
    ['有非 boot 状态但标题未绑定', () => { win.SDT = { game: { state: 'title' } }; }],
    ['只有已绑定标题、没有游戏状态', () => {
      win.SDT = { game: {} };
      win.document.getElementById('title').dataset.controlsBound = 'true';
    }],
  ])('%s 不算完整就绪，不提前停表', (_label, partialReady) => {
    partialReady();
    vi.advanceTimersByTime(3200);
    expect(notice()?.textContent).toContain('资源加载中');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('快速完整就绪时不产生提示，并释放计时器', () => {
    ready();
    vi.advanceTimersByTime(400);
    expect(notice()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(20000);
    expect(notice()).toBeNull();
  });

  it('就绪停表后仍明确报告真实资源错误，关闭时释放事件监听', () => {
    ready();
    vi.advanceTimersByTime(400);
    resourceError('script');
    expect(notice().textContent).toContain('资源加载失败');
    expect(vi.getTimerCount()).toBe(0);
    notice().querySelector('button').click();
    expect(notice()).toBeNull();
    expect(win.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    expect(win.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });

  it.each(['title', 'modal', 'idle'])('12s 后晚就绪（%s）撤掉耗时提示并真正停表', state => {
    vi.advanceTimersByTime(16000);
    expect(notice()).not.toBeNull();
    ready(state);
    vi.advanceTimersByTime(400);
    expect(notice()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    expect(win.clearInterval).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(60000);
    expect(notice()).toBeNull();
  });

  it('关闭耗时提示即释放看护，等待、晚就绪和后续错误都不反复弹出', () => {
    vi.advanceTimersByTime(12000);
    notice().querySelector('button').click();
    expect(notice()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60000);
    ready();
    resourceError('script');
    vi.advanceTimersByTime(400);
    expect(notice()).toBeNull();
    expect(win.clearInterval).toHaveBeenCalledTimes(1);
    expect(win.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    expect(win.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
  });

  it.each([
    ['script', 0], ['script', 3200], ['script', 16000],
    ['link', 0], ['link', 3200], ['link', 16000],
  ])('%s 在 %ims 真实资源报错始终明确失败，不被超时或随后就绪抹掉', (tagName, elapsed) => {
    vi.advanceTimersByTime(elapsed);
    resourceError(tagName);
    const failed = notice();
    expect(failed.textContent).toContain('资源加载失败');
    expect(vi.getTimerCount()).toBe(0);
    ready();
    vi.advanceTimersByTime(20000);
    expect(notice()).toBe(failed);
    expect(notice().textContent).toContain('资源加载失败');
    expect(win.clearInterval).toHaveBeenCalledTimes(1);
    resourceError(tagName);
    expect(notice()).toBe(failed);
    notice().querySelector('button').click();
    resourceError(tagName);
    expect(notice()).toBeNull();
  });

  it('忽略图片和普通 window 错误，不把未经证实的启动延迟报成资源失败', () => {
    resourceError('img');
    win.dispatchEvent(new win.ErrorEvent('error', { message: 'extension metadata error' }));
    expect(notice()).toBeNull();
    vi.advanceTimersByTime(12000);
    expect(notice().textContent).toContain('加载耗时较长');
    expect(notice().textContent).not.toContain('失败');
  });

  it.each([0, 3200, 16000])('页面离开（%ims）释放看护及提示，后续不再创建', elapsed => {
    vi.advanceTimersByTime(elapsed);
    win.dispatchEvent(new win.Event('pagehide'));
    expect(vi.getTimerCount()).toBe(0);
    expect(notice()).toBeNull();
    expect(win.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function), true);
    expect(win.removeEventListener).toHaveBeenCalledWith('pagehide', expect.any(Function));
    vi.advanceTimersByTime(20000);
    expect(notice()).toBeNull();
  });
});
