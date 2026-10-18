const fs = require('node:fs');
const path = require('node:path');

function createDesktopLog(directory) {
  const file = path.join(directory, 'logs', 'desktop.jsonl');
  function record(kind, detail = {}) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      // Bound disk use without allowing a logging failure to stop the game.
      if (fs.existsSync(file) && fs.statSync(file).size > 256 * 1024) {
        const tail = fs.readFileSync(file).subarray(-128 * 1024).toString('utf8');
        fs.writeFileSync(file, tail.slice(tail.indexOf('\n') + 1));
      }
      fs.appendFileSync(file, JSON.stringify({ time: new Date().toISOString(), kind, ...detail }) + '\n');
    } catch { /* Read-only/full profile: preserve the original application behaviour. */ }
  }
  return { file, record };
}

function installDesktopGuard({ app, dialog, ipcMain, processEmitter = process }) {
  const log = createDesktopLog(app.getPath('userData'));
  let quitting = false;
  app.on('before-quit', () => { quitting = true; });
  app.on('child-process-gone', (_event, detail) => log.record('child-process-gone', {
    type: detail.type, reason: detail.reason, exitCode: detail.exitCode,
  }));
  // Monitor rather than swallow fatal exceptions or change Node's exit behaviour.
  processEmitter.on('uncaughtExceptionMonitor', (error, origin) => log.record('main-process-error', {
    origin, message: error.message, stack: error.stack,
  }));
  log.record('session-start', { version: app.getVersion(), platform: process.platform });

  function attach(win) {
    const contents = win.webContents;
    let closed = false, recovering = false;
    async function recover(detail) {
      log.record('render-process-gone', { reason: detail.reason, exitCode: detail.exitCode });
      if (quitting || closed || recovering || win.isDestroyed() || !win.isVisible() || detail.reason === 'clean-exit') return;
      recovering = true;
      try {
        const { response } = await dialog.showMessageBox(win, {
          type: 'error', title: '游戏画面异常', message: '游戏画面已停止运行',
          detail: `可以从最近存档重新进入，未保存的进度可能丢失。\n诊断日志：${log.file}`,
          buttons: ['重新进入', '退出游戏'], defaultId: 0, cancelId: 1, noLink: true,
        });
        if (quitting || closed || win.isDestroyed()) return;
        if (response !== 0) { app.quit(); return; }
        log.record('renderer-retry');
        await win.loadURL('app://sdt/index.html');
      } catch (error) {
        log.record('renderer-retry-failed', { message: error.message });
        if (!closed && !quitting) app.quit();
      } finally { recovering = false; }
    }
    const gone = (_event, detail) => { void recover(detail); };
    const failed = (_event, code, description, url, mainFrame) => {
      if (code !== -3) log.record('navigation-error', { code, description, url, mainFrame });
    };
    const preload = (_event, preloadPath, error) => log.record('preload-error', { preloadPath, message: error.message });
    const pageError = (event, detail) => {
      if (event.sender !== contents || !detail || typeof detail.url !== 'string' || !detail.url.startsWith('app://sdt/')) return;
      log.record('page-error', { type: String(detail.type || '').slice(0, 30), url: detail.url.slice(0, 2048), message: String(detail.message || '').slice(0, 2000) });
    };
    contents.on('render-process-gone', gone);
    contents.on('did-fail-load', failed);
    contents.on('preload-error', preload);
    ipcMain.on('desktop-page-error', pageError);
    win.once('closed', () => {
      closed = true;
      contents.removeListener('render-process-gone', gone);
      contents.removeListener('did-fail-load', failed);
      contents.removeListener('preload-error', preload);
      ipcMain.removeListener('desktop-page-error', pageError);
    });
  }
  return { ...log, attach };
}

module.exports = { createDesktopLog, installDesktopGuard };
