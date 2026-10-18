const path = require('path');

// A separate renderer keeps the loading screen responsive while the game boots.
function attachStartupWindow({ BrowserWindow, ipcMain, app, screen }, game) {
  const area = screen?.getDisplayMatching(game.getBounds()).workArea;
  const width = Math.min(880, area?.width || 880), height = Math.min(540, area?.height || 540);
  const splash = new BrowserWindow({
    width, height, resizable: false, fullscreen: false, fullscreenable: false,
    movable: true, maximizable: false,
    ...(area ? { x: Math.round(area.x + (area.width - width) / 2), y: Math.round(area.y + (area.height - height) / 2) } : { center: true }),
    backgroundColor: '#080b0e', show: false, frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'startup-preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true,
    },
  });
  let finished = false;
  let failed = false;
  let preparing = false;
  let revealTimer;
  let bootTimer;
  let loadAttempt = 0;
  const sendFailure = () => {
    if (!finished && !splash.isDestroyed()) {
      failed = true;
      preparing = false;
      clearTimeout(revealTimer);
      clearTimeout(bootTimer);
      game.webContents.send('startup-cancel');
      splash.webContents.send('startup-status', 'failed');
    }
  };
  const loadGame = () => {
    const attempt = ++loadAttempt;
    failed = false;
    clearTimeout(bootTimer);
    bootTimer = setTimeout(sendFailure, 15000);
    splash.webContents.send('startup-status', 'loading');
    game.loadURL('app://sdt/index.html').catch(() => { if (attempt === loadAttempt) sendFailure(); });
  };
  const reveal = (animated) => {
    if (finished || failed) return;
    finished = true;
    clearTimeout(revealTimer);
    splash.webContents.send('startup-status', 'ready');
    game.show();
    game.webContents.send(animated ? 'startup-play' : 'startup-cancel');
    splash.destroy();
    cleanup();
  };
  const ready = (event) => {
    if (event.sender !== game.webContents || finished || failed || preparing) return;
    preparing = true;
    clearTimeout(bootTimer);
    game.webContents.send('startup-reveal');
    // Missing/older game assets must never trap the player behind a loading screen.
    revealTimer = setTimeout(() => reveal(false), 4500);
  };
  const covered = (event) => {
    if (event.sender === game.webContents && preparing) reveal(true);
  };
  const retry = (event) => {
    if (event.sender === splash.webContents && !finished && failed) loadGame();
  };
  const quit = (event) => {
    if (event.sender === splash.webContents) app.quit();
  };
  const failLoad = (_event, code, _description, _url, mainFrame) => {
    if (mainFrame && code !== -3) sendFailure(); // Ignore navigation cancellation on retry.
  };
  function cleanup() {
    clearTimeout(revealTimer);
    clearTimeout(bootTimer);
    ipcMain.removeListener('startup-ready', ready);
    ipcMain.removeListener('startup-covered', covered);
    ipcMain.removeListener('startup-retry', retry);
    ipcMain.removeListener('startup-quit', quit);
    game.webContents.removeListener('did-fail-load', failLoad);
    game.webContents.removeListener('render-process-gone', sendFailure);
  }
  ipcMain.on('startup-ready', ready);
  ipcMain.on('startup-covered', covered);
  ipcMain.on('startup-retry', retry);
  ipcMain.on('startup-quit', quit);
  game.webContents.on('did-fail-load', failLoad);
  game.webContents.on('render-process-gone', sendFailure);
  game.once('closed', () => {
    finished = true;
    cleanup();
    if (!splash.isDestroyed()) splash.destroy();
  });
  splash.once('closed', () => {
    if (!finished) app.quit();
  });
  splash.once('ready-to-show', () => {
    if (finished) return;
    splash.show();
    loadGame();
  });
  splash.loadFile(path.join(__dirname, 'startup.html')).catch(() => {
    // A missing splash must not leave the application permanently hidden.
    if (finished) return;
    finished = true;
    cleanup();
    game.show();
    game.loadURL('app://sdt/index.html').catch(error => console.error(error));
    splash.destroy();
  });
  return splash;
}

module.exports = { attachStartupWindow };
