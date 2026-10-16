import '../../css/settings-navigation.css';
import '../../css/home-ui-tokens.css';
import { enterSurface } from './surface-motion.js';
import { enterSettingsCut } from './settings-transition.js';

const CATEGORIES = [
  ['general', '通用', 'GENERAL', '界面信息与辅助功能', ['general']],
  ['display', '画面与反馈', 'DISPLAY', '调整动作反馈与动态效果', ['display']],
  ['audio', '音频', 'AUDIO', '音乐与音效独立调节，修改自动保存', ['audio']],
  ['data', '数据管理', 'DATA', '查看记录与管理本地数据', ['records', 'danger']],
  ['about', '关于', 'ABOUT', '创作来源与鸣谢', ['credits']],
];

// Move existing controls into panels without replacing their nodes or action hooks.
export function initSettingsNavigation(root) {
  if (!root) return;
  root.dataset.settingsWallpaper = document.getElementById('title')?.dataset.homeWallpaper || 'snow-road';
  if (root.classList.contains('settings-tabbed')) return;
  root.classList.add('settings-tabbed');
  const layout = root.querySelector('.settings-layout');
  const nav = document.createElement('nav');
  nav.className = 'settings-nav';
  nav.setAttribute('role', 'tablist');
  nav.setAttribute('aria-label', '设置分类');
  nav.setAttribute('aria-orientation', 'vertical');
  const content = document.createElement('div');
  content.className = 'settings-content';
  const tabs = [];
  const panels = [];
  for (const [key, title, english, description, groups] of CATEGORIES) {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'settings-tab';
    tab.id = `settings-tab-${key}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', `settings-panel-${key}`);
    tab.innerHTML = `<span>${title}</span><small>${english}</small>`;
    const panel = document.createElement('section');
    panel.className = 'settings-panel';
    panel.id = `settings-panel-${key}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    panel.innerHTML = `<header class="settings-panel-head"><small>${english}</small><h3>${title}</h3><p>${description}</p></header>`;
    for (const name of groups) panel.append(root.querySelector(`.settings-${name}`));
    nav.append(tab);
    content.append(panel);
    tabs.push(tab);
    panels.push(panel);
  }
  layout.replaceChildren(nav, content);
  panels.forEach(panel => {
    panel.querySelectorAll('.settings-group').forEach(group => {
      delete group.dataset.surfaceBlock;
      delete group.dataset.surfaceRole;
    });
    panel.querySelectorAll('.chk, .btn-row, .hint').forEach((item, index) => {
      item.style.setProperty('--settings-order', String(Math.min(index + 1, 3)));
    });
  });
  for (const row of root.querySelectorAll('.chk')) {
    if (row.classList.contains('vol')) continue;
    const input = row.querySelector('input');
    const copy = document.createElement('span');
    copy.className = 'settings-row-copy';
    for (const node of Array.from(row.childNodes)) if (node !== input) copy.append(node);
    row.replaceChildren(copy, input);
    input.setAttribute('role', 'switch');
  }
  let selected = -1;
  root.dataset.settingsMotion = 'entry';
  const readingPositions = new Map();
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
    nav.style.setProperty('--settings-marker-top', `${tabs[index].offsetTop}px`);
    nav.style.setProperty('--settings-marker-height', `${tabs[index].offsetHeight}px`);
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
  select(0);
  // 分类布局在 showOverlay 的通用入场之后建立，补挂最终布局的信息区。
  enterSurface(root.closest('#overlay'), { restart: false });
  enterSettingsCut(root);
}
