import '../../css/settings-navigation.css';
import '../../css/home-ui-tokens.css';
import { enterSurface } from './surface-motion.js';
import { enterSettingsCut } from './settings-transition.js';

const CATEGORIES = [
  ['general', '通用', 'GENERAL', '界面信息与辅助功能', ['general']],
  ['display', '画面与反馈', 'DISPLAY', '画质、动画绘制上限与动作反馈', ['display']],
  ['audio', '音频', 'AUDIO', '音乐与音效独立调节，修改自动保存', ['audio']],
  ['data', '数据管理', 'DATA', '查看记录与管理本地数据', ['records', 'danger']],
  ['about', '关于', 'ABOUT', '创作来源与鸣谢', ['credits']],
];

// Build the final structure before the overlay mounts: no connected group moves or
// checkbox reparenting. Callers supply trusted, freshly rendered control HTML.
export function settingsLayoutHTML(groups) {
  const tabs = CATEGORIES.map(([key, title, english], index) =>
    `<button type="button" class="settings-tab" id="settings-tab-${key}" role="tab" aria-controls="settings-panel-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}"><span>${title}</span><small>${english}</small></button>`).join('');
  const panels = CATEGORIES.map(([key, title, english, description, names], index) =>
    `<section class="settings-panel" id="settings-panel-${key}" role="tabpanel" aria-labelledby="settings-tab-${key}"${index ? ' hidden' : ''}><header class="settings-panel-head"><small>${english}</small><h3>${title}</h3><p>${description}</p></header>${names.map(name => groups[name]).join('')}</section>`).join('');
  return `<div class="settings settings-layout"><nav class="settings-nav" role="tablist" aria-label="设置分类" aria-orientation="vertical">${tabs}</nav><div class="settings-content">${panels}</div></div>`;
}

const initialized = new WeakSet();
export function initSettingsNavigation(root) {
  if (!root || initialized.has(root)) return;
  initialized.add(root);
  root.dataset.settingsWallpaper = document.getElementById('title')?.dataset.homeWallpaper || 'snow-road';
  const nav = root.querySelector('.settings-nav');
  const content = root.querySelector('.settings-content');
  const tabs = [...nav.querySelectorAll('.settings-tab')];
  const panels = [...content.querySelectorAll('.settings-panel')];
  panels.forEach(panel => {
    panel.querySelectorAll('.chk, .btn-row, .hint').forEach((item, index) => {
      item.style.setProperty('--settings-order', String(Math.min(index + 1, 3)));
    });
  });
  // The freshly mounted HTML already selects general and hides the other panels.
  let selected = 0;
  const readingPositions = new Map();
  const updateMarker = index => {
    const markerTop = tabs[index].offsetTop;
    const markerHeight = tabs[index].offsetHeight;
    nav.style.setProperty('--settings-marker-top', `${markerTop}px`);
    nav.style.setProperty('--settings-marker-height', `${markerHeight}px`);
  };
  const select = (index, focus = false) => {
    if (selected === index) {
      if (focus) tabs[index].focus();
      return;
    }
    if (selected >= 0) {
      readingPositions.set(selected, content.scrollTop);
      root.dataset.settingsMotion = 'change';
    }
    root.dataset.settingsCategory = CATEGORIES[index][0];
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    content.scrollTop = readingPositions.get(index) || 0;
    updateMarker(index);
    selected = index;
    if (focus) tabs[index].focus();
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(index));
    tab.addEventListener('keydown', event => {
      let target;
      if (event.key === 'ArrowDown') target = (index + 1) % tabs.length;
      if (event.key === 'ArrowUp') target = (index + tabs.length - 1) % tabs.length;
      if (event.key === 'Home') target = 0;
      if (event.key === 'End') target = tabs.length - 1;
      if (target === undefined) return;
      event.preventDefault();
      select(target, true);
    });
  });
  updateMarker(0);
  // 保留既有设置入场时序；后续资源就绪揭幕仍由通用包装器负责。
  enterSurface(root.closest('#overlay'), { restart: false });
  enterSettingsCut(root);
}
