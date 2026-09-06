/* 搜打撤 · 代号7 —— 唯一 Electron 外壳实现 */
const { app, BrowserWindow, Menu, protocol, ipcMain, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

// 2560x1440 / 120 FPS 合成必须使用独显；默认自动选择在本机落到了 Iris Xe。
// Electron 官方开关会在混合显卡机器上请求高性能 GPU，须在 ready 前设置。
app.commandLine.appendSwitch('force_high_performance_gpu');

const GAME_DIR = app.isPackaged
  ? path.join(process.resourcesPath, 'game')
  : path.join(__dirname, 'game');

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
      backgroundThrottling: false,
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

// ---------- 首页留言（写给 Friday）：追加写入 output/suggestions.json ----------
// 开发直跑优先写仓库 output 目录（Friday 直接读该文件）；打包版无相对仓库，写 userData。
ipcMain.handle('suggestions-append', (_event, entry) => {
  const item = {
    ts: String(entry?.ts || new Date().toISOString()),
    target: entry?.target && typeof entry.target === 'object'
      ? { name: String(entry.target.name || ''), selector: String(entry.target.selector || '') }
      : null,
    at: entry?.at && typeof entry.at === 'object' ? { x: +entry.at.x || 0, y: +entry.at.y || 0 } : null,
    text: String(entry?.text || '').trim().slice(0, 2000),
  };
  if (!item.text) return { ok: false };
  const targets = app.isPackaged
    ? [path.join(app.getPath('userData'), 'suggestions.json')]
    : [path.join(__dirname, '..', 'prototypes', 'map-system', 'output', 'suggestions.json'),
       path.join(app.getPath('userData'), 'suggestions.json')];
  for (const file of targets) {
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      let data = { suggestions: [] };
      try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { /* 首次无文件 */ }
      if (!Array.isArray(data.suggestions)) data.suggestions = [];
      data.suggestions.push(item);
      fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
      return { ok: true };
    } catch (_) { /* 尝试下一个候选路径 */ }
  }
  return { ok: false };
});

ipcMain.on('app-quit', () => app.quit());
app.on('window-all-closed', () => app.quit());
