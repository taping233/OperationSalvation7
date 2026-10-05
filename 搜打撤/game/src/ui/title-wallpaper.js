import { storeGet, storeSet } from '../core/storage.js';

const preferenceKey = 'sdt-title-wallpaper';
const wallpapers = ['snow', 'ensemble'];
const title = document.getElementById('title');
const button = document.getElementById('btnTitleWallpaper');

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
