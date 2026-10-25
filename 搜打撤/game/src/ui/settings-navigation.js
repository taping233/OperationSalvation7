import '../../css/settings-navigation.css';
import '../../css/home-ui-tokens.css';
import { enterSurface } from './surface-motion.js';
import { transitionRegion } from './region-transition.js';

/** @type {[string, string, string[]][]} */
const CATEGORIES = [
  ['general', '通用', ['general', 'records', 'danger', 'credits']],
  ['display', '画面与反馈', ['display']],
  ['audio', '音频', ['audio']],
  ['input', '输入', ['input']],
];

// Build the final structure before the overlay mounts: no connected group moves or
// checkbox reparenting. Callers supply trusted, freshly rendered control HTML.
export function settingsLayoutHTML(groups) {
  const tabs = CATEGORIES.map(([key, title], index) =>
    `<button type="button" class="settings-tab" id="settings-tab-${key}" role="tab" aria-controls="settings-panel-${key}" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}"><span class="ui-control-label">${title}</span></button>`).join('');
  const panels = CATEGORIES.map(([key, title, names], index) =>
    `<section class="settings-panel" id="settings-panel-${key}" role="tabpanel" aria-labelledby="settings-tab-${key}"${index ? ' hidden' : ''}><header class="settings-panel-head"><h3>${title}</h3></header>${names.map(name => ['records','danger','credits'].includes(name) ? `<details class="settings-secondary" id="settings-extra-${name}"><summary>${{records:'数据与档案',danger:'危险操作',credits:'致谢与来源'}[name]}</summary>${groups[name]}</details>` : groups[name]).join('')}</section>`).join('');
  return `<div class="settings settings-layout"><nav class="settings-nav" role="tablist" aria-label="设置分类" aria-orientation="vertical">${tabs}</nav><div class="settings-content">${panels}</div></div>`;
}

const initialized = new WeakMap();
export function captureSettingsNavigation(root) { return initialized.get(root)?.capture() || null; }
export function initSettingsNavigation(root, context = null) {
  if (!root || initialized.has(root)) return;
  const nav = /** @type {HTMLElement} */ (root.querySelector('.settings-nav'));
  const content = /** @type {HTMLElement} */ (root.querySelector('.settings-content'));
  const tabs = [.../** @type {NodeListOf<HTMLElement>} */ (nav.querySelectorAll('.settings-tab'))];
  const panels = [.../** @type {NodeListOf<HTMLElement>} */ (content.querySelectorAll('.settings-panel'))];
  let selected = Math.max(0, CATEGORIES.findIndex(([key]) => key === context?.category));
  let requested = selected;
  const readingPositions = new Map((context?.positions || []).filter(([key, top]) =>
    CATEGORIES.some(([category]) => category === key) && Number.isFinite(top) && top >= 0));
  const updateMarker = index => {
    const top = tabs[index].offsetTop;
    const height = tabs[index].offsetHeight;
    nav.style.setProperty('--settings-marker-top', `${top}px`);
    nav.style.setProperty('--settings-marker-height', `${height}px`);
  };
  const apply = index => {
    root.dataset.settingsCategory = CATEGORIES[index][0];
    tabs.forEach((tab, i) => {
      tab.setAttribute('aria-selected', String(i === index));
      tab.tabIndex = i === index ? 0 : -1;
      panels[i].hidden = i !== index;
    });
    content.scrollTop = readingPositions.get(CATEGORIES[index][0]) || 0;
    updateMarker(index);
  };
  initialized.set(root, { capture:() => {
    readingPositions.set(CATEGORIES[selected][0], content.scrollTop);
    return { category:CATEGORIES[selected][0], positions:[...readingPositions] };
  } });
  const select = (index, focus = false) => {
    if (requested === index) {
      if (focus) tabs[index].focus();
      return;
    }
    requested = index;
    readingPositions.set(CATEGORIES[selected][0], content.scrollTop);
    if (focus) tabs[index].focus();
    void transitionRegion(content, () => {
      apply(index);
      selected = index;
    }, { direction:index - selected, isCurrent:() => root.isConnected }).then(changed => {
      if (!changed && requested === index) requested = selected;
    });
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
  apply(selected);
  // 首次打开沿公共导航区域入场；分类切换只更新上面的内容与选中标记。
  enterSurface(root.closest('#overlay'), { restart: false });
}
