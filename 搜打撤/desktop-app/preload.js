const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdtDesktop', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app-quit'),
  // 首页留言：追加写入 suggestions.json（处理见 main.js suggestions-append）
  appendSuggestion: (entry) => ipcRenderer.invoke('suggestions-append', entry),
  // 留言库：读取全部历史留言 / 按 ts 删除一条未完成留言
  readSuggestions: () => ipcRenderer.invoke('suggestions-read'),
  deleteSuggestion: (ts) => ipcRenderer.invoke('suggestions-delete', ts),
});
