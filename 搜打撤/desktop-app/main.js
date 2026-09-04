/* 搜打撤 · 代号7 —— 唯一 Electron 外壳实现 */
const { app, BrowserWindow, Menu, protocol, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, '..', 'prototypes', 'map-system');

// protocol.handle 会把请求头交给 Undici；User-Agent 必须保持 ByteString。
// 中文 productName 若进入 User-Agent，会让 Electron 44 的本地资源请求失败。
app.userAgentFallback = `Codename7/${app.getVersion()} Electron/${process.versions.electron} Chrome/${process.versions.chrome}`;

function gameVersion() {
  try {
    return JSON.parse(fs.readFileSync(path.join(GAME_DIR, 'version.json'), 'utf8')).version;
  } catch (_) {
    return app.getVersion();
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

function registerGameProtocol() {
  const root = path.normalize(GAME_DIR);
  protocol.handle('app', async (req) => {
    try {
      const url = new URL(req.url);
      let rel = decodeURIComponent(url.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(root, rel));
      if (file !== root && !file.startsWith(root + path.sep)) {
        return new Response('forbidden', { status: 403 });
      }

      const stat = await fs.promises.stat(file).catch(() => null);
      if (!stat || !stat.isFile()) return new Response('not found', { status: 404 });
      return net.fetch(pathToFileURL(file).toString());
    } catch (_) {
      return new Response('not found', { status: 404 });
    }
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1150,
    minHeight: 700,
    backgroundColor: '#080b0e',
    title: `搜打撤 · 代号7 v${gameVersion()}`,
    icon: path.join(__dirname, 'app.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL('app://sdt/index.html');
  win.webContents.on('did-fail-load', (_event, code, description, url, isMainFrame) => {
    if (isMainFrame) console.error(`桌面页面加载失败：${code} ${description} (${url})`);
  });
  win.once('ready-to-show', () => win.show());
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    if (url.startsWith('https://') || url.startsWith('http://')) shell.openExternal(url);
    return { action: 'deny' };
  });
  return win;
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) {
      if (win.isMinimized()) win.restore();
      win.show();
      win.focus();
    }
  });
  app.whenReady().then(() => {
    registerGameProtocol();
    Menu.setApplicationMenu(null);
    createWindow();
  });
}

ipcMain.on('app-quit', () => app.quit());
app.on('window-all-closed', () => app.quit());
