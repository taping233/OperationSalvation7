import { createCityCut } from './camp-entry.js';
import { interfaceReducedMotion } from './interface-motion.js';

const sceneryURL = new URL('../../assets/ui/settings-shutter-1011.webp', import.meta.url).href;
const preload = new Image();
preload.decoding = 'async';
preload.src = sceneryURL;
let cleanup = null;

// 复用基地/成就的通用斜切字牌；页面先正常打开，装饰切幕不等待或拦截输入。
export function enterSettingsCut(page) {
  cleanup?.();
  cleanup = null;
  const overlay = page?.closest('#overlay');
  const card = page?.closest('.card');
  if (interfaceReducedMotion() || !overlay || !card) return;
  const cut = createCityCut({ archive: '系统档案', title: '设置',
    subtitle: 'SETTINGS / 界面与反馈', destination: 'SETTINGS', watermark: 'SYSTEM' });
  cut.querySelector('.camp-entry-scenery img').src = sceneryURL;
  card.append(cut);
  let timer;
  const finish = () => {
    clearTimeout(timer);
    observer.disconnect();
    cut.remove();
    if (cleanup === finish) cleanup = null;
  };
  const observer = new MutationObserver(() => {
    if (!page.isConnected || !overlay.contains(page) || overlay.hidden || overlay.dataset.uiClosing) finish();
  });
  observer.observe(overlay, { childList: true, subtree: true, attributes: true,
    attributeFilter: ['hidden', 'data-ui-closing'] });
  timer = setTimeout(finish, 980);
  cleanup = finish;
}
