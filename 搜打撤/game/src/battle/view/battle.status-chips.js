import { esc, escAttr } from '../../core/shared.js';
import { STATUS_ICONS } from '../../ui/status-icons.js';
import '../../../css/battle-status-chips.css';

const SHORT_NAMES = { atkUp:'强攻', spellUp:'强法', immune:'免伤', swordForm:'剑仙', natureForm:'满月', cosmosForm:'宇宙', atkDown:'弱攻' };
const readingRegions = new WeakSet();

function currentAmount(key, value, meta, curse) {
  if (meta.flag) return '';
  if (meta.timed || (curse && !meta.stack)) return `${value}回合`;
  if (curse || key === 'dodge') return `${value}${key === 'dodge' ? '次' : '层'}`;
  return `${value}`;
}

export function statusChipsHTML(status = {}, combat, { compact = false } = {}) {
  const family = (keys, metadata, curse) => keys.filter(key => (status[key] || 0) > 0).map(key => {
    const meta = metadata[key];
    if (!meta) return '';
    const amount = currentAmount(key, status[key], meta, curse);
    const amountValue = amount ? String(status[key]) : '';
    const amountUnit = amount.slice(amountValue.length);
    const name = compact ? SHORT_NAMES[key] || meta.name : meta.name;
    const icon = STATUS_ICONS[key] ? `[[icon:${STATUS_ICONS[key]}]]` : meta.icon || '';
    const label = `${meta.name}${amount ? ` ${amount}` : ' · 生效中'}`;
    const note = amount ? `当前：${label}` : '当前生效';
    return `<span class="${curse ? 'bt-curse c-' : 'bt-buff b-'}${escAttr(key)} status-chip${compact ? ' status-chip-compact' : ''}" data-status-key="${curse ? 'curse' : 'buff'}:${escAttr(key)}" data-term="${escAttr(key)}" tabindex="0" aria-label="${escAttr(label)}" data-ui-tip data-ui-tip-title="${escAttr(meta.name)}" data-ui-tip-text="${escAttr(meta.desc || '')}" data-ui-tip-note="${escAttr(note)}"><span class="status-icon" aria-hidden="true">${icon}</span><span class="status-name">${esc(name)}</span>${amount ? `<span class="status-amount"><span class="status-value">${esc(amountValue)}</span>${amountUnit ? `<span class="status-unit">${esc(amountUnit)}</span>` : ''}</span>` : ''}</span>`;
  });
  return family(combat.BUFFS, combat.BUFF_META, false).concat(family(combat.CURSES, combat.CURSE_META, true)).join('');
}

// Reuse status nodes while their neighbours change. Tooltip-owned aria-describedby
// and the actual focused element survive; extra enemy/player markers stay separate.
export function reconcileStatusChips(container, html, rich = value => value) {
  const template = container.ownerDocument.createElement('template');
  template.innerHTML = rich(html);
  let list = container.querySelector(':scope > .status-chip-list');
  const existing = new Map([...(list || container).children].filter(node => node.hasAttribute('data-status-key'))
    .map(node => [node.getAttribute('data-status-key'), node]));
  const desired = [];
  for (const fresh of [...template.content.children]) {
    const key = fresh.getAttribute('data-status-key');
    const current = key && existing.get(key);
    if (!current) {
      if (!fresh.hasAttribute('tabindex')) fresh.setAttribute('tabindex', '0');
      desired.push(fresh); continue;
    }
    for (const attribute of [...fresh.attributes]) {
      if (current.getAttribute(attribute.name) !== attribute.value) current.setAttribute(attribute.name, attribute.value);
    }
    if (!current.hasAttribute('tabindex')) current.setAttribute('tabindex', '0');
    if (!fresh.classList.contains('status-chip') && current.innerHTML !== fresh.innerHTML) current.innerHTML = fresh.innerHTML;
    for (const selector of ['.status-name', '.status-amount', '.status-icon']) {
      const before = current.querySelector(selector), after = fresh.querySelector(selector);
      if (!before && after) current.append(after);
      else if (before && !after) before.remove();
      else if (before && after && before.innerHTML !== after.innerHTML) before.innerHTML = after.innerHTML;
    }
    desired.push(current);
  }
  if (!desired.length) {
    container.replaceChildren();
    container.removeAttribute('role'); container.removeAttribute('aria-label');
    for (const key of ['uiTip', 'uiTipTitle', 'uiTipText', 'uiTipNote']) delete container.dataset[key];
    return;
  }
  if (!list) {
    list = container.ownerDocument.createElement('div');
    list.className = 'status-chip-list';
    const previous = [...container.childNodes];
    container.append(list);
    for (const node of previous) list.append(node);
  }
  if (!readingRegions.has(container)) {
    // Scrolling or reading a status must not bubble into the unit's target click.
    container.addEventListener('click', event => event.stopPropagation());
    readingRegions.add(container);
  }
  let summary = container.querySelector(':scope > .status-chip-summary');
  if (!summary) {
    summary = container.ownerDocument.createElement('span');
    summary.className = 'status-chip-summary'; summary.setAttribute('aria-hidden', 'true');
    container.append(summary);
  }
  container.setAttribute('role', 'group');
  container.setAttribute('aria-label', `状态与标记，共${desired.length}项。超出区域可上下滚动，或按 Tab 逐项查看。`);
  container.dataset.uiTip = '';
  container.dataset.uiTipTitle = '状态与标记';
  container.dataset.uiTipText = `共${desired.length}项。所有状态和标记都保留在当前列表中。`;
  container.dataset.uiTipNote = '超出区域可上下滚动；按 Tab 逐项聚焦查看。';
  const caption = `${desired.length}项↕`;
  if (summary.textContent !== caption) summary.textContent = caption;
  const keep = new Set(desired);
  for (const child of [...list.childNodes]) if (!keep.has(child)) child.remove();
  let cursor = list.firstChild;
  for (const node of desired) {
    if (node === cursor) cursor = cursor.nextSibling;
    else list.insertBefore(node, cursor);
  }
}
