import { storeGet, storeSet } from '../core/storage.js';

const preferenceKey = 'sdt-title-wallpaper';
const wallpapers = ['snow', 'ensemble'];
const title = document.getElementById('title');
const button = document.getElementById('btnTitleWallpaper');
const viewButton = document.getElementById('btnTitleWallpaperView');

if (title && viewButton) {
  viewButton.addEventListener('click', () => {
    const viewing = title.classList.toggle('wallpaper-only');
    title.querySelector('.title-inner').toggleAttribute('inert', viewing);
    viewButton.setAttribute('aria-pressed', String(viewing));
    viewButton.querySelector('span').textContent = viewing ? '恢复界面' : '只看壁纸';
    viewButton.title = viewing ? '恢复主页界面' : '隐藏界面，只看壁纸';
  });
}

if (title && button) {
  let index = Math.max(0, wallpapers.indexOf(storeGet(preferenceKey)));
  const render = () => {
    title.dataset.homeWallpaper = wallpapers[index];
    const count = `${index + 1}/${wallpapers.length}`;
    const label = `切换壁纸，当前第${index + 1}张，共${wallpapers.length}张`;
    button.querySelector('[data-wallpaper-count]').textContent = count;
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
