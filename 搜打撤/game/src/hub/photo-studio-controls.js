import { motionTiming, motionEasing } from '../ui/motion-presets.js';
import { BASE_H, rect as layoutRect } from '../ui/ui-scale.js';
// Gallery-only choices. Native selects remain the value and input-event contract.
const controls = new WeakMap();

function closeChoices(except) {
  document.querySelectorAll('.studio-unified .studio-choice[open]').forEach(choice => {
    if (choice !== except) choice.open = false;
  });
}

if (typeof document !== 'undefined') {
  document.addEventListener('pointerdown', e => {
    const inside = e.target?.closest?.('.studio-choice');
    closeChoices(inside);
  });
}

function bindChoice(select) {
  if (controls.has(select)) return;
  const shell = select.closest('.studio-select-shell');
  if (!shell) return;
  const choice = document.createElement('details');
  choice.className = 'studio-choice';
  const trigger = document.createElement('summary');
  trigger.className = 'studio-choice-trigger';
  trigger.setAttribute('aria-haspopup', 'listbox');
  const purpose = select.getAttribute('aria-label') || '选择条件';
  trigger.setAttribute('aria-label', purpose);
  trigger.setAttribute('aria-expanded', 'false');
  const value = document.createElement('span');
  trigger.appendChild(value);
  const menu = document.createElement('div');
  menu.className = 'studio-choice-menu';
  menu.id = 'studio-choice-' + select.id;
  menu.setAttribute('role', 'listbox');
  menu.setAttribute('aria-label', trigger.getAttribute('aria-label'));
  trigger.setAttribute('aria-controls', menu.id);
  choice.append(trigger, menu);
  select.classList.add('studio-native-select');
  select.hidden = true;
  select.setAttribute('aria-hidden', 'true');
  shell.appendChild(choice);
  let keyboardOpen = false;
  let menuAnimation = null;
  let typeahead = '';
  let lastTypedAt = 0;

  const buttons = Array.from(select.options).map(option => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'studio-choice-option';
    button.setAttribute('role', 'option');
    button.textContent = option.text;
    if (select.id === 'libRar') button.dataset.rarity = option.value;
    button.disabled = option.disabled;
    button.addEventListener('click', () => {
      const changed = select.value !== option.value;
      select.value = option.value;
      sync();
      choice.open = false;
      trigger.focus({ preventScroll: true });
      // UI owns input delegation; change also remains available to other consumers.
      if (changed) {
        select.dispatchEvent(new Event('input', { bubbles: true }));
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    menu.appendChild(button);
    return button;
  });

  function sync() {
    const selectedLabel = select.selectedOptions[0]?.text || '';
    const fieldLabel = select.id === 'libRar' ? '稀有度' : select.id === 'libSort' ? '排序' : '人物';
    const conditionLabel = select.value === '全部' ? '全部' : selectedLabel;
    value.textContent = fieldLabel + ' · ' + conditionLabel;
    trigger.setAttribute('aria-label', purpose + '，' + selectedLabel);
    choice.classList.toggle('has-condition', select.value !== '全部' && select.id !== 'libSort');
    buttons.forEach((button, index) => {
      const selected = select.options[index].selected;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
  }

  function focusOption(button) {
    if (!button) return;
    buttons.forEach(item => { item.tabIndex = item === button ? 0 : -1; });
    button.focus({ preventScroll: true });
    const top = button.offsetTop;
    // Keep the menu padding visible around the focused option, without moving the page.
    if (top < menu.scrollTop + 8) menu.scrollTop = Math.max(0, top - 8);
    else if (top + button.offsetHeight > menu.scrollTop + menu.clientHeight - 8) {
      menu.scrollTop = top + button.offsetHeight - menu.clientHeight + 8;
    }
  }
  function focusSelected() {
    const selected = buttons[select.selectedIndex];
    focusOption(selected && !selected.disabled ? selected : buttons.find(button => !button.disabled));
  }

  choice.addEventListener('toggle', () => {
    menuAnimation?.cancel();
    menuAnimation = null;
    trigger.setAttribute('aria-expanded', String(choice.open));
    if (choice.open) {
      typeahead = '';
      closeChoices(choice);
      const rect = layoutRect(trigger);
      const below = BASE_H - rect.bottom - 18;
      const above = rect.top - 18;
      const flipped = below < 220 && above > below;
      choice.classList.toggle('opens-up', flipped);
      menu.style.maxHeight = Math.max(90, Math.min(300, flipped ? above : below)) + 'px';
      const selected = buttons[select.selectedIndex];
      if (selected) menu.scrollTop = Math.max(0, selected.offsetTop - menu.clientHeight / 2 + selected.offsetHeight / 2);
      const reduced = document.body.classList.contains('reduce-motion') || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!reduced && menu.animate) menuAnimation = menu.animate([
        { opacity: 0, transform: `translateY(${flipped ? 5 : -5}px)`, clipPath: `inset(${flipped ? '15% 0 0' : '0 0 15%'})` },
        { opacity: 1, transform: 'translateY(0)', clipPath: 'inset(0)' },
      ], { duration: motionTiming.feedback, easing: motionEasing.enter });
      if (keyboardOpen) focusSelected();
    } else sync();
    keyboardOpen = false;
  });

  trigger.addEventListener('keydown', e => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' || e.key === ' ') keyboardOpen = true;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!choice.open) { keyboardOpen = true; choice.open = true; }
      else focusSelected();
    }
  });
  choice.addEventListener('keydown', e => {
    if (!choice.open || e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Escape') {
      e.preventDefault(); e.stopPropagation();
      choice.open = false;
      trigger.focus({ preventScroll: true });
      return;
    }
    if (e.key === 'Tab') {
      choice.open = false;
      trigger.focus({ preventScroll: true });
      return;
    }
    if (!menu.contains(e.target)) return;
    const enabled = buttons.filter(button => !button.disabled);
    const current = enabled.indexOf(e.target);
    let next;
    if (e.key === 'ArrowDown') next = (current + 1) % enabled.length;
    else if (e.key === 'ArrowUp') next = (current - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    else if (e.key.length === 1 && e.key !== ' ' && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = performance.now();
      typeahead = (now - lastTypedAt < 700 ? typeahead : '') + e.key.toLocaleLowerCase();
      lastTypedAt = now;
      const match = enabled.findIndex(button => button.textContent.toLocaleLowerCase().startsWith(typeahead));
      if (match >= 0) next = match;
    }
    if (next !== undefined) {
      e.preventDefault(); e.stopPropagation();
      focusOption(enabled[next]);
    }
  }, true);
  select.addEventListener('input', sync);
  select.addEventListener('change', sync);
  controls.set(select, { sync, choice });
  sync();
}

export function bindPhotoStudioControls(root) {
  root?.querySelectorAll('.studio-select-shell > select').forEach(bindChoice);
}

export function refreshPhotoStudioControls(root) {
  root?.querySelectorAll('.studio-native-select').forEach(select => controls.get(select)?.sync());
}

export function closePhotoStudioControls() { closeChoices(); }
