import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, writeFileSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runInNewContext } from 'node:vm';
import { JSDOM } from 'jsdom';

const require = createRequire(import.meta.url);
const { createDesktopLog, installDesktopGuard } = require('../desktop-app/runtime-guard.cjs');
const { attachStartupWindow } = require('../desktop-app/startup-window.cjs');
const dirs = [];
afterEach(() => { for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true }); });
function setup() {
  const directory = mkdtempSync(path.join(tmpdir(), 'c7-runtime-')); dirs.push(directory);
  const app = new EventEmitter(); app.getPath = () => directory; app.getVersion = () => '0.60.0'; app.quit = vi.fn();
  const dialog = { showMessageBox: vi.fn(async () => ({ response: 0 })) };
  const ipcMain = new EventEmitter(), processEmitter = new EventEmitter();
  const guard = installDesktopGuard({ app, dialog, ipcMain, processEmitter });
  const win = new EventEmitter(), contents = new EventEmitter();
  win.webContents = contents; win.isVisible = () => true; win.isDestroyed = () => false;
  win.loadURL = vi.fn(async () => {});
  guard.attach(win);
  const logs = () => readFileSync(guard.file, 'utf8').trim().split('\n').map(JSON.parse);
  return { app, dialog, ipcMain, processEmitter, guard, win, contents, logs };
}
const flush = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

describe('desktop runtime failure guard', () => {
  it('survives the real startup-window cleanup after the game is revealed', async () => {
    const t = setup();
    t.contents.send = vi.fn(); t.win.show = vi.fn();
    class Splash extends EventEmitter {
      constructor() { super(); this.webContents = new EventEmitter(); this.webContents.send = vi.fn(); this.destroyed = false; }
      isDestroyed() { return this.destroyed; }
      destroy() { this.destroyed = true; this.emit('closed'); }
      show() {}
      loadFile() { return Promise.resolve(); }
    }
    const splash = attachStartupWindow({ BrowserWindow: Splash, ipcMain: t.ipcMain, app: t.app }, t.win);
    splash.emit('ready-to-show');
    expect(t.contents.listenerCount('render-process-gone')).toBe(2);
    t.ipcMain.emit('startup-ready', { sender: t.contents });
    t.ipcMain.emit('startup-covered', { sender: t.contents });
    expect(t.win.show).toHaveBeenCalledOnce();
    expect(t.contents.listenerCount('render-process-gone')).toBe(1);
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 }); await flush();
    expect(t.dialog.showMessageBox).toHaveBeenCalledOnce();
    expect(t.win.loadURL).toHaveBeenLastCalledWith('app://sdt/index.html');
    t.win.emit('closed');
  });
  it('records a crash after startup and restores the bundled entry only after the user chooses retry', async () => {
    const t = setup(); let choose;
    t.dialog.showMessageBox.mockImplementationOnce(() => new Promise(resolve => { choose = resolve; }));
    t.contents.emit('render-process-gone', {}, { reason: 'oom', exitCode: 5 });
    expect(t.logs()).toContainEqual(expect.objectContaining({ kind: 'render-process-gone', reason: 'oom', exitCode: 5 }));
    expect(t.win.loadURL).not.toHaveBeenCalled();
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    expect(t.dialog.showMessageBox).toHaveBeenCalledOnce();
    choose({ response: 0 }); await flush();
    expect(t.win.loadURL).toHaveBeenCalledExactlyOnceWith('app://sdt/index.html');
    expect(t.app.quit).not.toHaveBeenCalled();
  });
  it('allows exit, handles failed recovery and ignores late dialog resolution after close', async () => {
    const t = setup();
    t.dialog.showMessageBox.mockResolvedValueOnce({ response: 1 });
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 }); await flush();
    expect(t.app.quit).toHaveBeenCalledOnce(); expect(t.win.loadURL).not.toHaveBeenCalled();
    t.win.loadURL.mockRejectedValueOnce(new Error('entry missing'));
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 }); await flush();
    expect(t.logs().some(row => row.kind === 'renderer-retry-failed')).toBe(true);
    let choose;
    t.dialog.showMessageBox.mockImplementationOnce(() => new Promise(resolve => { choose = resolve; }));
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    t.win.emit('closed'); choose({ response: 0 }); await flush();
    expect(t.win.loadURL).toHaveBeenCalledTimes(1);
    expect(t.contents.listenerCount('render-process-gone')).toBe(0);
    expect(t.ipcMain.listenerCount('desktop-page-error')).toBe(0);
  });
  it('does not show recovery during boot, normal exit or shutdown; records GPU and main-process errors', () => {
    const t = setup();
    t.win.isVisible = () => false;
    t.contents.emit('render-process-gone', {}, { reason: 'crashed', exitCode: 1 });
    t.win.isVisible = () => true;
    t.contents.emit('render-process-gone', {}, { reason: 'clean-exit', exitCode: 0 });
    t.app.emit('before-quit');
    t.contents.emit('render-process-gone', {}, { reason: 'killed', exitCode: 1 });
    expect(t.dialog.showMessageBox).not.toHaveBeenCalled();
    t.app.emit('child-process-gone', {}, { type: 'GPU', reason: 'crashed', exitCode: 7 });
    t.processEmitter.emit('uncaughtExceptionMonitor', new Error('fatal'), 'unhandledRejection');
    expect(t.logs()).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'child-process-gone', type: 'GPU', exitCode: 7 }),
      expect.objectContaining({ kind: 'main-process-error', message: 'fatal', origin: 'unhandledRejection' }),
    ]));
    expect(t.processEmitter.listenerCount('uncaughtException')).toBe(0);
  });
  it('records failed images only from its own renderer and releases the IPC listener on close', () => {
    const t = setup(), detail = { url: 'app://sdt/assets/缺图.webp', type: 'IMG' };
    t.ipcMain.emit('desktop-page-error', { sender: {} }, detail);
    t.ipcMain.emit('desktop-page-error', { sender: t.contents }, { url: 'https://example.com/private' });
    expect(t.logs()).toHaveLength(1);
    t.ipcMain.emit('desktop-page-error', { sender: t.contents }, detail);
    expect(t.logs().at(-1)).toMatchObject({ kind: 'page-error', ...detail });
    t.win.emit('closed');
    t.ipcMain.emit('desktop-page-error', { sender: t.contents }, detail);
    expect(t.logs()).toHaveLength(2);
  });
  it('bounds log size and never turns an unwritable log into an application failure', () => {
    const t = setup(); writeFileSync(t.guard.file, '{"old":true}\n'.repeat(30000));
    t.guard.record('after-trim');
    expect(statSync(t.guard.file).size).toBeLessThan(140 * 1024);
    expect(t.logs().at(-1).kind).toBe('after-trim');
    expect(() => createDesktopLog(path.join(t.guard.file, 'invalid')).record('failure')).not.toThrow();
  });
  it('the preload forwards real image error events without exposing arbitrary file access', () => {
    const dom = new JSDOM('<img src="app://sdt/assets/missing.webp">', { url: 'app://sdt/index.html' });
    const ipcRenderer = new EventEmitter(); ipcRenderer.send = vi.fn();
    runInNewContext(readFileSync('desktop-app/preload.js', 'utf8'), {
      require: () => ({ contextBridge: { exposeInMainWorld() {} }, ipcRenderer }),
      window: dom.window, document: dom.window.document, location: dom.window.location,
      MutationObserver: dom.window.MutationObserver, requestAnimationFrame() {}, cancelAnimationFrame() {}, setTimeout, clearTimeout,
    });
    dom.window.document.querySelector('img').dispatchEvent(new dom.window.Event('error'));
    expect(ipcRenderer.send).toHaveBeenCalledWith('desktop-page-error', expect.objectContaining({ url: 'app://sdt/assets/missing.webp', type: 'IMG' }));
    dom.window.close();
  });
});
