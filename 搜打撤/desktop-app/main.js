const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { startServer } = require('./server');

let win;

function createWindow(url) {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    title: '搜打撤 · 代号7',
    icon: path.join(__dirname, 'app.ico'),
    autoHideMenuBar: true,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  // 外部链接交给系统浏览器，游戏内导航留在窗口里
  win.webContents.setWindowOpenHandler(({ url: u }) => {
    if (u.startsWith('http://127.0.0.1')) return { action: 'allow' };
    shell.openExternal(u);
    return { action: 'deny' };
  });
  win.loadURL(url);
}

app.whenReady().then(async () => {
  let url;
  try {
    await startServer(18137);
    url = 'http://127.0.0.1:18137/';
  } catch (e) {
    // 端口被占（可能是上次实例残留），换随机端口
    const s = await startServer(0);
    url = `http://127.0.0.1:${s.address().port}/`;
  }
  createWindow(url);
});

app.on('window-all-closed', () => app.quit());
