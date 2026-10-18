const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdtStartup', {
  retry: () => ipcRenderer.send('startup-retry'),
  quit: () => ipcRenderer.send('startup-quit'),
  onStatus: callback => ipcRenderer.on('startup-status', (_event, status) => callback(status)),
});
