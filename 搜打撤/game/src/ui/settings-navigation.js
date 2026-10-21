import '../../css/settings-navigation.css';
import '../../css/home-ui-tokens.css';
import { enterSurface } from './surface-motion.js';
import { enterSettingsCut } from './settings-transition.js';

/** @type {[string, string, string[]][]} */
const CATEGORIES = [
  ['general', '通用', ['general']],
  ['display', '画面与反馈', ['display']],
  ['audio', '音频', ['audio']],
  ['data', '数据管理', ['records', 'danger']],
  ['about', '关于', ['credits']],
];

// Build the final structure before the overlay mounts: no connected group moves or
// checkbox reparenting. Callers supply trusted, freshly rendered control HTML.
export function settingsLayoutHTML(groups) {
  const tabs = CATEGORIES.map(([key, title], index) =>
    `<button type="button" class="settings-tab" id="settings-tab-${key}" role="tab" aria-controls="settings-panel-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}"><span>${title}</span></button>`).join('');
  const panels = CATEGORIES.map(([key, title, names], index) =>
    `<section class="settings-panel" id="settings-panel-${key}" role="tabpanel" aria-labelledby="settings-tab-${key}"${index ? ' hidden' : ''}><header class="settings-panel-head"><h3>${title}</h3></header>${names.map(name => groups[name]).join('')}</section>`).join('');
  return `<div class="settings settings-layout"><nav class="settings-nav" role="tablist" aria-label="设置分类" aria-orientation="vertical">${tabs}</nav><div class="settings-content">${panels}</div></div>`;
}

const initialized = new WeakSet();
export function initSettingsNavigation(root) {
  if (!root || initialized.has(root)) return;
  initialized.add(root);
  root.dataset.settingsWallpaper = document.getElementById('title')?.dataset.homeWallpaper || 'snow-road';
  const nav = /** @type {HTMLElement} */ (root.querySelector('.settings-nav'));
  const content = /** @type {HTMLElement} */ (root.querySelector('.settings-content'));
  const tabs = [.../** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('.settings-tab'))];
  const panels = [.../** @type {NodeListOf<HTMLElement>} */ (content.querySelectorAll('.settings-panel'))];
  panels.forEach(panel => {
    /** @type {NodeListOf<HTMLButtonElement>} */ (panel.querySelectorAll('.chk, .btn-row, .hint')).forEach((item, index) => {
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
