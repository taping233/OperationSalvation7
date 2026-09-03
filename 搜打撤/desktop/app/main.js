/* ============================================================
 * 搜打撤 · 代号7 —— 桌面版外壳（Electron 主进程）
 *
 * 启动方式：desktop\electron\electron.exe desktop\app
 *   （推荐直接双击仓库根目录的「启动搜打撤.bat」）
 *
 * 游戏本体仍在 prototypes/map-system，通过自定义 app:// 协议载入：
 * 标准 + 安全协议下 localStorage 稳定可用（三档存档 / 基地 / 卡牌库
 * / 格子备注都会持久化到本应用的数据目录，随程序保存）。
 * ============================================================ */
const { app, BrowserWindow, Menu, protocol, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const GAME_DIR = path.join(__dirname, '..', '..', 'prototypes', 'map-system');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

// app:// 必须注册为标准安全协议，页面才能拥有稳定的源（localStorage 按 origin 持久化）
protocol.registerSchemesAsPrivileged([
  // stream：Chromium 媒体管道（BGM 等 <audio>）要求响应支持 Range 分段
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
]);

// 同一台机器只开一个实例：重复双击时唤起已有窗口
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  });

  app.whenReady().then(() => {
    registerGameProtocol();
    Menu.setApplicationMenu(null); // 游戏不需要浏览器菜单栏（F12 仍可开 DevTools）
    createWindow();
  });
}

function registerGameProtocol() {
  const root = path.normalize(GAME_DIR);
  protocol.handle('app', async (req) => {
    try {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const fp = path.normalize(path.join(root, rel));
      if (fp !== root && !fp.startsWith(root + path.sep)) {
        return new Response('forbidden', { status: 403 });
      }
      // 媒体播放会带 Range 请求；不支持 206 会导致 <audio> 报 SRC_NOT_SUPPORTED
      const stat = await fs.promises.stat(fp).catch(() => null);
      if (!stat) return new Response('not found: ' + req.url, { status: 404 });
      const type = MIME[path.extname(fp).toLowerCase()] || 'application/octet-stream';
      const range = req.headers.get('range');
      if (range) {
        const m = /bytes=(\d*)-(\d*)/.exec(range);
        let start = m && m[1] ? parseInt(m[1]) : 0;
        let end = m && m[2] ? parseInt(m[2]) : stat.size - 1;
        end = Math.min(end, stat.size - 1);
        const fh = await fs.promises.open(fp, 'r');
        const buf = Buffer.alloc(end - start + 1);
        await fh.read(buf, 0, buf.length, start);
        await fh.close();
        return new Response(buf, { status: 206, headers: {
          'content-type': type,
          'content-range': `bytes ${start}-${end}/${stat.size}`,
          'accept-ranges': 'bytes',
          'content-length': String(buf.length),
        } });
      }
      const data = await fs.promises.readFile(fp);
      return new Response(data, {
        headers: { 'content-type': type, 'accept-ranges': 'bytes', 'content-length': String(stat.size) },
      });
    } catch (e) {
      return new Response('not found: ' + req.url, { status: 404 });
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
    title: '搜打撤 · 代号7',
    icon: path.join(__dirname, 'icon.ico'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL('app://sdt/index.html');
  win.once('ready-to-show', () => win.show());

  // F12 开关开发者工具（调试用）
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F12') {
      win.webContents.toggleDevTools();
      e.preventDefault();
    }
  });

  // 页面内若出现外部链接，交给系统浏览器
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('app://')) return { action: 'allow' };
    shell.openExternal(url);
    return { action: 'deny' };
  });

  return win;
}

// 渲染进程点「退出游戏」→ 真正关闭程序
ipcMain.on('app-quit', () => app.quit());

app.on('window-all-closed', () => app.quit());
