const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdtDesktop', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app-quit'),
  // 首页留言：追加写入 suggestions.json（处理见 main.js suggestions-append）
  appendSuggestion: (entry) => ipcRenderer.invoke('suggestions-append', entry),
});
