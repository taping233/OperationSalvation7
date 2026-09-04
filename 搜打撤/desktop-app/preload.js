const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdtDesktop', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app-quit'),
});
