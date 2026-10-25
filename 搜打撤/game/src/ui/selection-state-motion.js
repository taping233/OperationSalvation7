import '../../css/selection-state-motion.css';
import { retargetVisual, clearVisual } from './target-motion.js';

const definitions = [
  { group: '.bag-rail', item: '.bag-rz', selected: '.bag-rz.on', kind: 'zone' },
  { group: '.bag-tools', item: '.bag-pill', selected: '.bag-pill.on', kind: 'filter' },
  { group: '.settings-nav', item: '.settings-tab', selected: '.settings-tab[aria-selected="true"]', kind: 'settings' },
  { group: '.bg-nav', item: '.bg-nav-item', selected: '.bg-nav-item[aria-current="step"]', kind: 'guide', tint:'206,182,107' },
  { group: '.ag-filters', item: '[data-gallery-filter]', selected: '[data-gallery-filter][aria-pressed="true"]', kind: 'achievement-filter', tint:'255,198,11' },
  { group: '.ag-view', item: '[data-gallery-view]', selected: '[data-gallery-view][aria-pressed="true"]', kind: 'achievement-view', tint:'57,61,57' },
];
const installations = new WeakMap();

// One decorative plate per retained control group; business selection stays synchronous.
export function installSelectionStateMotion(root = document.body) {
  if (!root) return () => {};
  if (installations.has(root)) return installations.get(root);
  const groups = new Map();
  let frame = 0;
  let disposed = false;
  let membershipDirty = true;
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(update);
  };
  const resize = typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  function release(group, state) {
    clearVisual(state.plate);
    state.plate.remove();
    delete group.dataset.selectionMotion;
    delete group.dataset.selectionMotionReady;
    resize?.unobserve(group);
    for (const item of state.items) resize?.unobserve(item);
    groups.delete(group);
  }
  function update() {
    frame = 0;
    if (disposed) return;
    if (membershipDirty) refreshMembership();
    for (const [group, state] of groups) {
      const { definition } = state;
      const selected = group.querySelector(definition.selected);
      const bounds = group.getBoundingClientRect();
      const rect = selected?.getBoundingClientRect();
      const visible = rect && rect.width > 0 && rect.height > 0 && bounds.width > 0 && bounds.height > 0;
      if (!visible) {
        if (state.signature !== 'hidden') retargetVisual(state.plate, { opacity: 0 });
        state.signature = 'hidden';
        state.ready = false;
        delete group.dataset.selectionMotionReady;
        continue;
      }
      // Rectangles include ancestor page scaling; animation coordinates belong to the group.
      const scaleX = group.offsetWidth ? bounds.width / group.offsetWidth : 1;
      const scaleY = group.offsetHeight ? bounds.height / group.offsetHeight : 1;
      const computed = getComputedStyle(selected);
      const tint = definition.tint || (definition.kind === 'settings'
        ? computed.getPropertyValue('--settings-category-tint').trim() || '204,181,139'
        : '108,155,169');
      const target = {
        x: (rect.left - bounds.left) / scaleX + group.scrollLeft - group.clientLeft,
        y: (rect.top - bounds.top) / scaleY + group.scrollTop - group.clientTop,
        width: rect.width / scaleX, height: rect.height / scaleY,
        color: `rgb(${tint})`, opacity: 1,
      };
      const signature = JSON.stringify(target);
      if (state.signature === signature) continue;
      retargetVisual(state.plate, target, state.ready ? {} : { duration: 0 });
      state.signature = signature;
      state.ready = true;
      // Static business-state paint stays visible until this plate has a real pose.
      group.dataset.selectionMotionReady = '';
    }
  }
  function refreshMembership() {
    membershipDirty = false;
    for (const [group, state] of groups) {
      if (!root.contains(group) || !group.matches(state.definition.group)) release(group, state);
    }
    for (const definition of definitions) {
      const candidates = [.../** @type {NodeListOf<HTMLElement>} */ (root.querySelectorAll(definition.group))];
      if (root.matches?.(definition.group)) candidates.unshift(root);
      for (const group of candidates) {
        let state = groups.get(group);
        if (!state) {
          const plate = document.createElement('span');
          plate.className = 'selection-state-plate';
          plate.setAttribute('aria-hidden', 'true');
          group.dataset.selectionMotion = definition.kind;
          group.append(plate);
          state = { plate, definition, signature: '', ready: false, items: new Set() };
          groups.set(group, state);
          resize?.observe(group);
        }
        const items = new Set(group.querySelectorAll(definition.item));
        for (const item of state.items) if (!items.has(item)) resize?.unobserve(item);
        for (const item of items) if (!state.items.has(item)) resize?.observe(item);
        state.items = items;
      }
    }
  }
  // Ignore animated inline styles: observing them would create a frame feedback loop.
  // Scroll and resize change geometry, not membership. Only DOM/class changes
  // need the root/group scans; selection and visibility still measure next frame.
  const observer = new MutationObserver(records => {
    if (records.some(record => record.type === 'childList' || record.attributeName === 'class')) membershipDirty = true;
    schedule();
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true,
    attributeFilter: ['class', 'aria-selected', 'aria-pressed', 'aria-current', 'hidden'] });
  window.addEventListener('resize', schedule);
  root.addEventListener('scroll', schedule, true);
  const dispose = () => {
    disposed = true;
    observer.disconnect();
    resize?.disconnect();
    cancelAnimationFrame(frame);
    window.removeEventListener('resize', schedule);
    root.removeEventListener('scroll', schedule, true);
    for (const [group, state] of groups) release(group, state);
    installations.delete(root);
  };
  installations.set(root, dispose);
  update();
  return dispose;
}
