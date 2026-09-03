/* 预加载脚本：给页面暴露一个最小的桌面桥
 * 游戏代码检测 window.sdtDesktop 存在时即为桌面模式（如「退出游戏」真正退出程序）；
 * 用普通浏览器打开 index.html 时不存在此对象，行为保持不变。
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sdtDesktop', {
  isDesktop: true,
  quit: () => ipcRenderer.send('app-quit'),
});
