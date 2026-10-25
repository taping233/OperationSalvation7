import { storeGet, storeSet } from '../core/storage.js';
import { hideHomeForWallpaper, restoreHomeFromWallpaper } from './home-menu-motion.js';

const preferenceKey = 'sdt-title-wallpaper';
const wallpapers = ['snow-road', 'baita-heixiang', 'xingyue-piano', 'wu-bass', 'baita-station', 'xingyue-reeds', 'companions-dinner'];
const title = document.getElementById('title');
const button = /** @type {HTMLButtonElement} */ (document.getElementById('btnTitleWallpaper'));
const viewButton = /** @type {HTMLButtonElement} */ (document.getElementById('btnTitleWallpaperView'));

if (title && viewButton) {
  viewButton.addEventListener('click', () => {
    const viewing = title.classList.toggle('wallpaper-only');
    /** @type {HTMLElement} */ (title.querySelector('.title-inner')).toggleAttribute('inert', viewing);
    viewButton.setAttribute('aria-pressed', String(viewing));
    /** @type {HTMLElement} */ (viewButton.querySelector('span')).textContent = viewing ? '恢复界面' : '只看壁纸';
    viewButton.title = viewing ? '恢复主页界面' : '隐藏界面，只看壁纸';
    if (viewing) hideHomeForWallpaper();
    else restoreHomeFromWallpaper();
  });
}

if (title && button) {
  const savedIndex = wallpapers.indexOf(storeGet(preferenceKey));
  let index = savedIndex >= 0 ? savedIndex : wallpapers.indexOf('wu-bass');
  const render = () => {
    title.dataset.homeWallpaper = wallpapers[index];
    const count = `${index + 1}/${wallpapers.length}`;
    const label = `切换壁纸，当前第${index + 1}张，共${wallpapers.length}张`;
    /** @type {HTMLElement} */ (button.querySelector('[data-wallpaper-count]')).textContent = count;
    button.setAttribute('aria-label', label);
    button.title = label;
  };
  render();
  button.addEventListener('click', () => {
    index = (index + 1) % wallpapers.length;
    render();
    storeSet(preferenceKey, wallpapers[index]);
  });
}
