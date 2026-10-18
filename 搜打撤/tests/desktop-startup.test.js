import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { attachStartupWindow } = require('../desktop-app/startup-window.cjs');
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

function setup() {
  const windows = [];
  class Window extends EventEmitter {
    constructor(options) {
      super(); this.options = options; windows.push(this);
      this.webContents = new EventEmitter();
      this.webContents.send = vi.fn();
      this.show = vi.fn();
      this.destroyed = false;
      this.destroy = vi.fn(() => { this.destroyed = true; this.emit('closed'); });
      this.loadURL = vi.fn(() => Promise.resolve());
      this.loadFile = vi.fn(() => Promise.resolve());
    }
    isDestroyed() { return this.destroyed; }
  }
  const game = new Window();
  const ipcMain = new EventEmitter();
  const app = { quit: vi.fn() };
  const splash = attachStartupWindow({ BrowserWindow: Window, ipcMain, app }, game);
  return { game, ipcMain, app, splash };
}

describe('desktop startup window lifecycle', () => {
  it('shows the lightweight splash before loading the game and waits for real readiness', () => {
    const { game, splash, ipcMain, app } = setup();
    expect(game.loadURL).not.toHaveBeenCalled();
    splash.emit('ready-to-show');
    expect(splash.show).toHaveBeenCalledOnce();
    expect(game.loadURL).toHaveBeenCalledWith('app://sdt/index.html');
    game.emit('ready-to-show');
    expect(game.show).not.toHaveBeenCalled();
    ipcMain.emit('startup-ready', { sender: splash.webContents });
    expect(game.show).not.toHaveBeenCalled();
    ipcMain.emit('startup-ready', { sender: game.webContents });
    expect(game.show).not.toHaveBeenCalled();
    expect(game.webContents.send).toHaveBeenLastCalledWith('startup-reveal');
    ipcMain.emit('startup-covered', { sender: splash.webContents });
    expect(game.show).not.toHaveBeenCalled();
    ipcMain.emit('startup-covered', { sender: game.webContents });
    expect(game.show).toHaveBeenCalledOnce();
    expect(game.webContents.send).toHaveBeenLastCalledWith('startup-play');
    expect(splash.destroy).toHaveBeenCalledOnce();
    expect(app.quit).not.toHaveBeenCalled();
    expect(ipcMain.listenerCount('startup-ready')).toBe(0);
  });

  it('keeps the splash on main-frame failure, allows only splash retry, and recovers', () => {
    const { game, splash, ipcMain } = setup();
    splash.emit('ready-to-show');
    game.webContents.emit('did-fail-load', {}, -6, 'missing', '', true);
    expect(splash.webContents.send).toHaveBeenLastCalledWith('startup-status', 'failed');
    ipcMain.emit('startup-ready', { sender: game.webContents });
    expect(game.show).not.toHaveBeenCalled();
    ipcMain.emit('startup-retry', { sender: game.webContents });
    expect(game.loadURL).toHaveBeenCalledOnce();
    ipcMain.emit('startup-retry', { sender: splash.webContents });
    expect(game.loadURL).toHaveBeenCalledTimes(2);
    ipcMain.emit('startup-ready', { sender: game.webContents });
    ipcMain.emit('startup-covered', { sender: game.webContents });
    expect(game.show).toHaveBeenCalledOnce();
  });

  it('ignores cancelled/subframe loads; reports renderer crashes and rejected loads', async () => {
    const { game, splash, ipcMain } = setup();
    splash.emit('ready-to-show');
    game.webContents.emit('did-fail-load', {}, -3, 'cancelled', '', true);
    game.webContents.emit('did-fail-load', {}, -6, 'missing', '', false);
    expect(splash.webContents.send).toHaveBeenCalledTimes(1);
    game.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    expect(splash.webContents.send).toHaveBeenLastCalledWith('startup-status', 'failed');
    game.loadURL.mockRejectedValueOnce(new Error('offline'));
    ipcMain.emit('startup-retry', { sender: splash.webContents });
    await Promise.resolve();
    expect(splash.webContents.send).toHaveBeenLastCalledWith('startup-status', 'failed');
  });

  it('falls back after a missing game transition handshake instead of staying hidden', () => {
    const { game, splash, ipcMain } = setup();
    splash.emit('ready-to-show');
    ipcMain.emit('startup-covered', { sender: game.webContents });
    expect(game.show).not.toHaveBeenCalled();
    ipcMain.emit('startup-ready', { sender: game.webContents });
    vi.advanceTimersByTime(4499);
    expect(game.show).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(game.show).toHaveBeenCalledOnce();
    expect(game.webContents.send).toHaveBeenLastCalledWith('startup-cancel');
    expect(splash.destroy).toHaveBeenCalledOnce();
  });
  it('cancels a pending cut after load failure and rejects its late covered notification', () => {
    const { game, splash, ipcMain } = setup();
    splash.emit('ready-to-show');
    ipcMain.emit('startup-ready', { sender: game.webContents });
    game.webContents.emit('render-process-gone', {}, { reason: 'crashed' });
    ipcMain.emit('startup-covered', { sender: game.webContents });
    vi.advanceTimersByTime(5000);
    expect(game.show).not.toHaveBeenCalled();
    expect(splash.destroy).not.toHaveBeenCalled();
    expect(game.webContents.send).toHaveBeenLastCalledWith('startup-cancel');
  });

  it('quits from the splash and cleans up when the game closes during loading', () => {
    const { game, splash, ipcMain, app } = setup();
    ipcMain.emit('startup-quit', { sender: game.webContents });
    expect(app.quit).not.toHaveBeenCalled();
    ipcMain.emit('startup-quit', { sender: splash.webContents });
    expect(app.quit).toHaveBeenCalledOnce();
    game.emit('closed');
    expect(splash.destroy).toHaveBeenCalledOnce();
    expect(ipcMain.eventNames()).toHaveLength(0);
    expect(game.webContents.listenerCount('render-process-gone')).toBe(0);
    splash.emit('ready-to-show');
    expect(game.loadURL).not.toHaveBeenCalled();
  });

  it('falls back to a visible game if the splash file cannot load', async () => {
    // Exercise the actual loadFile rejection, rather than bypassing the error handler.
    const ipcMain = new EventEmitter(), app = { quit: vi.fn() };
    const game = new EventEmitter();
    game.webContents = new EventEmitter();
    game.show = vi.fn(); game.loadURL = vi.fn(() => Promise.resolve());
    class MissingSplash extends EventEmitter {
      constructor() { super(); this.webContents = new EventEmitter(); }
      loadFile() { return Promise.reject(new Error('missing')); }
      destroy() { this.emit('closed'); }
    }
    attachStartupWindow({ BrowserWindow: MissingSplash, ipcMain, app }, game);
    await Promise.resolve();
    expect(game.show).toHaveBeenCalledOnce();
    expect(game.loadURL).toHaveBeenCalledOnce();
    expect(app.quit).not.toHaveBeenCalled();
  });
});

describe('desktop readiness bridge', () => {
  it('requires both initialized controls and a non-boot state, then waits two frames', async () => {
    const dom = new JSDOM('<body data-state="boot"><main id="title"></main></body>', { url: 'https://local.test' });
    const frames = [];
    const ipcRenderer = new EventEmitter();
    ipcRenderer.send = vi.fn();
    const observer = dom.window.MutationObserver;
    runInNewContext(readFileSync('desktop-app/preload.js', 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld() {} }, ipcRenderer }),
      window: dom.window, document: dom.window.document, MutationObserver: observer,
      requestAnimationFrame: callback => frames.push(callback),
    });
    dom.window.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
    dom.window.document.getElementById('title').dataset.controlsBound = 'true';
    await Promise.resolve();
    expect(frames).toHaveLength(0);
    dom.window.document.body.dataset.state = 'title';
    await Promise.resolve();
    expect(ipcRenderer.send).not.toHaveBeenCalled();
    frames.shift()(); frames.shift()();
    expect(ipcRenderer.send).toHaveBeenCalledExactlyOnceWith('startup-ready');
    ipcRenderer.emit('startup-reveal');
    expect(dom.window.document.documentElement.dataset.desktopStartup).toBe('preparing');
    dom.window.document.documentElement.dataset.desktopStartup = 'covered';
    await Promise.resolve();
    expect(ipcRenderer.send).toHaveBeenLastCalledWith('startup-covered');
    ipcRenderer.emit('startup-play');
    expect(dom.window.document.documentElement.dataset.desktopStartup).toBe('playing');
    dom.window.close();
  });

  it('includes all splash resources in the desktop package', () => {
    const pkg = JSON.parse(readFileSync('desktop-app/package.json', 'utf8'));
    for (const file of ['startup-window.cjs', 'startup-preload.cjs', 'startup.html']) {
      expect(pkg.build.files).toContain(file);
      expect(readFileSync(`desktop-app/${file}`, 'utf8').length).toBeGreaterThan(0);
    }
  });
});

describe('loading screen feedback', () => {
  it('keeps waiting after 12 seconds and exposes retry only after a real load failure', () => {
    vi.useFakeTimers();
    const source = readFileSync('desktop-app/startup.html', 'utf8');
    const dom = new JSDOM(source, { runScripts: 'outside-only' });
    const bridge = { retry: vi.fn(), quit: vi.fn(), onStatus: vi.fn() };
    dom.window.sdtStartup = bridge;
    dom.window.setTimeout = setTimeout;
    dom.window.clearTimeout = clearTimeout;
    dom.window.setInterval = setInterval;
    dom.window.clearInterval = clearInterval;
    try {
      dom.window.eval(source.match(/<script>([\s\S]*?)<\/script>/)[1]);
      const doc = dom.window.document;
      expect(doc.getElementById('retry').hidden).toBe(true);
      expect(doc.getElementById('status').textContent).toBe('正在准备进入城市');
      vi.advanceTimersByTime(12000);
      expect(doc.getElementById('hint').textContent).toContain('仍在等待');
      expect(Number(doc.getElementById('progress').getAttribute('aria-valuenow'))).toBeGreaterThan(8);
      const update = bridge.onStatus.mock.calls[0][0];
      update('failed');
      const stoppedProgress = doc.getElementById('progressNumber').textContent;
      vi.advanceTimersByTime(6000);
      expect(doc.getElementById('progressNumber').textContent).toBe(stoppedProgress);
      expect(doc.getElementById('retry').hidden).toBe(false);
      doc.getElementById('retry').click();
      expect(bridge.retry).toHaveBeenCalledOnce();
      update('loading');
      expect(doc.getElementById('retry').hidden).toBe(true);
      expect(doc.body.classList.contains('failed')).toBe(false);
      vi.advanceTimersByTime(240000);
      expect(doc.getElementById('progressNumber').textContent).toBe('94%');
      update('ready');
      expect(doc.getElementById('progressNumber').textContent).toBe('100%');
      expect(vi.getTimerCount()).toBe(0);
      doc.getElementById('quit').click();
      expect(bridge.quit).toHaveBeenCalledOnce();
    } finally {
      dom.window.close();
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
