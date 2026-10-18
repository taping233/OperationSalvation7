const { contextBridge, ipcRenderer } = require('electron');

// The isolated preload reads DOM readiness, never the page's JavaScript namespace.
window.addEventListener('DOMContentLoaded', () => {
  let sentReady = false;
  let sentCovered = false;
  const reveal = () => { document.documentElement.dataset.desktopStartup = 'preparing'; };
  const play = () => { document.documentElement.dataset.desktopStartup = 'playing'; };
  const cancel = () => { document.documentElement.dataset.desktopStartup = 'cancelled'; };
  ipcRenderer.on('startup-reveal', reveal);
  ipcRenderer.on('startup-play', play);
  ipcRenderer.on('startup-cancel', cancel);
  function cleanup() {
    observer.disconnect();
    ipcRenderer.removeListener('startup-reveal', reveal);
    ipcRenderer.removeListener('startup-play', play);
    ipcRenderer.removeListener('startup-cancel', cancel);
  }
  function checkReady() {
    const startup = document.documentElement.dataset.desktopStartup;
    if (startup === 'covered' && !sentCovered) {
      sentCovered = true;
      ipcRenderer.send('startup-covered');
    }
    if (startup === 'complete' || startup === 'cancelled') { cleanup(); return; }
    const state = document.body?.dataset.state;
    const bound = document.getElementById('title')?.dataset.controlsBound === 'true';
    if (sentReady || !state || state === 'boot' || !bound) return;
    sentReady = true;
    requestAnimationFrame(() => requestAnimationFrame(() => ipcRenderer.send('startup-ready')));
  }
  const observer = new MutationObserver(checkReady);
  observer.observe(document.documentElement, { attributes: true, subtree: true, attributeFilter: ['data-state', 'data-controls-bound', 'data-desktop-startup'] });
  checkReady();
  window.addEventListener('pagehide', cleanup, { once: true });
}, { once: true });

contextBridge.exposeInMainWorld('sdtDesktop', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app-quit'),
  // 首页留言：追加写入 suggestions.json（处理见 main.js suggestions-append）
  appendSuggestion: (entry) => ipcRenderer.invoke('suggestions-append', entry),
  // 留言库：读取全部历史留言 / 按 ts 删除一条未完成留言
  readSuggestions: () => ipcRenderer.invoke('suggestions-read'),
  deleteSuggestion: (ts) => ipcRenderer.invoke('suggestions-delete', ts),
});
