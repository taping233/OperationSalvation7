// Keep the staging page and its card nodes mounted during local selection changes.
import { bindCardNavigation, pulseNumber } from './hub.presentation.js';
import { departureStackKey } from './base-departure.commands.js';
const mountedViews = new WeakMap();
const bagFaces = new WeakMap();
function stackPresentation(stack) {
  try { return JSON.stringify([departureStackKey(stack), stack.card]); }
  catch { return null; }
}
function captureView(root, pool, entries, stash, cells, renderCard) {
  const rows = entries.map(({ node }) => ({ node,
    own:node.getElementsByClassName('dep-own')[0], picked:node.getElementsByClassName('dep-picked-count')[0] }));
  const byId = id => { const node = root.ownerDocument.getElementById(id); return node && root.contains(node) ? node : root.querySelector(`#${id}`); };
  const bag = byId('depBag');
  if (bag && cells && renderCard) for (const [index, cell] of cells.entries()) {
    const node = bag.children[index];
    if (node) bagFaces.set(node, { html:renderCard(cell.card), face:node.firstElementChild, count:node.getElementsByClassName('dep-n')[0] });
  }
  mountedViews.set(root, { pool, rows, bag, signatures:stash.map(stackPresentation),
    slots:root.querySelector('[data-dep-slots]'), summary:byId('depSummary'),
    footer:byId('depCapacity'), status:byId('depStatus'), pets:[...root.getElementsByClassName('pet-chip')] });
}
function currentView(root, stash) {
  const view = mountedViews.get(root);
  if (!view || !root.contains(view.pool) || !root.contains(view.bag) || stash.length !== view.signatures.length) return null;
  const nodes = view.pool.getElementsByClassName('dep-card');
  if (nodes.length !== view.rows.length) return null;
  for (let i = 0; i < stash.length; i++) {
    const signature = stackPresentation(stash[i]);
    if (signature === null || signature !== view.signatures[i]) return null;
  }
  for (let i = 0; i < view.rows.length; i++) {
    const row = view.rows[i];
    if (nodes[i] !== row.node || !row.node.contains(row.own) || !row.node.contains(row.picked)) return null;
  }
  for (const node of [view.slots, view.summary, view.footer, view.status, ...view.pets]) if (node && !root.contains(node)) return null;
  return view;
}
export function bindDepartureFilters(root, stash, { filters = {}, rarities = [], types = [], rarityOf = card => card.rarity, onFiltersChange = /** @type {(filters:{rarity:string,type:string,cost:string}) => void} */ (() => {}), cells = undefined, renderCard = undefined } = {}) {
  const pool = root?.querySelector('#depPool');
  const selects = {
    rarity: root?.querySelector('#depFilterRarity'),
    type: root?.querySelector('#depFilterType'),
    cost: root?.querySelector('#depFilterCost'),
  };
  if (!pool || Object.values(selects).some(select => !select)) return;
  bindCardNavigation(pool, '.dep-card', { activate: false });
  bindCardNavigation(root.querySelector('#depBag'), '.bag-cell[tabindex]', { activate: false });
  const byName = new Map(stash.map(stack => [departureStackKey(stack), stack.card]));
  const entries = [...pool.querySelectorAll('.dep-card')].map(node => {
    const card = byName.get(node.dataset.stackKey || node.dataset.name) || {};
    return { node, rarity: rarityOf(card) || '', type: card.type || '', cost: card.cost == null ? 'none' : String(card.cost) };
  });
  const fillOptions = (select, values, label, format = value => value) => {
    const choices = [{ value: '', label }, ...[...new Set(values.filter(Boolean))].map(value => ({ value, label: format(value) }))];
    select.replaceChildren(...choices.map(choice => {
      const option = root.ownerDocument.createElement('option');
      option.value = choice.value;
      option.textContent = choice.label;
      return option;
    }));
  };
  fillOptions(selects.rarity, [...rarities, ...entries.map(entry => entry.rarity)], '不限稀有度');
  fillOptions(selects.type, [...types, ...entries.map(entry => entry.type)], '不限类型');
  const costs = [...new Set(entries.map(entry => entry.cost))].sort((a, b) => a === 'none' ? 1 : b === 'none' ? -1 : Number(a) - Number(b));
  fillOptions(selects.cost, costs, '不限费用', value => value === 'none' ? '无费用' : `${value}费`);
  Object.entries(selects).forEach(([key, select]) => { select.value = filters[key] || ''; });
  const count = root.querySelector('#depFilterCount');
  const empty = root.querySelector('#depNoResults');
  const reset = root.querySelector('#depFilterReset');
  const notices = [...pool.querySelectorAll('.ov-empty')];
  const apply = () => {
    const next = /** @type {{rarity:string,type:string,cost:string}} */ (Object.fromEntries(Object.entries(selects).map(([key, select]) => [key, select.value])));
    const criteria = Object.entries(next).filter(([, value]) => value);
    const active = criteria.length > 0;
    let visible = 0;
    for (const entry of entries) {
      entry.node.hidden = !criteria.every(([key, value]) => entry[key] === value);
      if (!entry.node.hidden) visible++;
    }
    if (count) count.textContent = `显示 ${visible}/${entries.length}`;
    if (empty) empty.hidden = visible > 0 || !active;
    if (reset) reset.disabled = !active;
    notices.forEach(notice => { notice.hidden = active; });
    pool.scrollTop = 0;
    onFiltersChange(next);
  };
  Object.values(selects).forEach(select => select.addEventListener('change', apply));
  reset?.addEventListener('click', () => {
    Object.values(selects).forEach(select => { select.value = ''; });
    apply();
  });
  apply();
  captureView(root, pool, entries, stash, cells, renderCard);
}

function setAttribute(node, name, value) {
  if (value == null) { if (node.hasAttribute(name)) node.removeAttribute(name); }
  else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
function setText(node, value, pulse = false) {
  if (node && node.textContent !== value) { node.textContent = value; if (pulse) pulseNumber(node); }
}
function setHTML(node, value) { if (node && node.innerHTML !== value) node.innerHTML = value; }
function reconcileCells(bag, cells, capacity, renderCell, renderCard, rich, selectionLocked) {
  const named = new Map(), empty = [];
  for (const node of bag.children) {
    const key = node.dataset.stackKey || node.dataset.name;
    if (!key) empty.push(node);
    else { if (!named.has(key)) named.set(key, []); named.get(key).push(node); }
  }
  const next = [];
  for (let i = 0; i < Math.max(capacity, cells.length); i++) {
    const cell = cells[i];
    let node = cell ? named.get(cell.stackKey || cell.card.name)?.shift() : empty.shift();
    if (!cell) {
      if (!node) { node = bag.ownerDocument.createElement('div'); node.className = 'bag-cell empty'; node.setAttribute('aria-hidden', 'true'); }
    } else {
      const html = renderCard(cell.card), saved = node && bagFaces.get(node);
      if (!saved || saved.html !== html || node.firstElementChild !== saved.face || !node.contains(saved.count)) {
        const template = bag.ownerDocument.createElement('template'); template.innerHTML = rich(renderCell(cell));
        node = template.content.firstElementChild;
        bagFaces.set(node, { html, face:node.firstElementChild, count:node.getElementsByClassName('dep-n')[0] });
      } else {
        const name = cell.card.name;
        const removable = !selectionLocked && cell.selectableCount > 0 && cell.sources?.[0]?.stackKey;
        const fixedLabel = cell.fixedCount ? `含固定初始牌 ${cell.fixedCount} 张；` : '';
        const actionLabel = removable ? '点击查看，拖回仓库移除 1 张自选卡' : '点击查看详情';
        setAttribute(node, 'class', `bag-cell ${cell.fixed ? 'fixed' : 'filled'}`);
        setAttribute(node, 'draggable', removable ? 'true' : null);
        setAttribute(node, 'data-remove-key', removable || null);
        setAttribute(node, 'aria-label', `${name} ×${cell.count}，${fixedLabel}${actionLabel}`);
        setAttribute(node, 'title', `${name} ×${cell.count} · ${fixedLabel}${actionLabel}`);
        setText(saved.count, `×${cell.count}`);
      }
    }
    next.push(node);
  }
  next.forEach((node, index) => { if (bag.children[index] !== node) bag.insertBefore(node, bag.children[index] || null); });
  while (bag.children.length > next.length) bag.lastElementChild.remove();
}

function reconcileBag(bag, html, rich) {
  const template = bag.ownerDocument.createElement('template');
  template.innerHTML = rich(html);
  const named = new Map();
  const empty = [];
  for (const cell of bag.children) {
    if (cell.dataset.name) {
      const key = cell.dataset.stackKey || cell.dataset.name;
      if (!named.has(key)) named.set(key, []);
      named.get(key).push(cell);
    }
    else empty.push(cell);
  }
  const next = [];
  for (const wanted of template.content.children) {
    const cell = wanted.dataset.name ? named.get(wanted.dataset.stackKey || wanted.dataset.name)?.shift() : empty.shift();
    const node = cell || wanted;
    if (cell) {
      for (const key of ['class', 'aria-label', 'title', 'draggable', 'data-remove-key']) {
        const value = wanted.getAttribute(key);
        if (value === null) cell.removeAttribute(key);
        else if (cell.getAttribute(key) !== value) cell.setAttribute(key, value);
      }
      const count = cell.querySelector('.dep-n');
      const nextCount = wanted.querySelector('.dep-n');
      if (count && nextCount) count.textContent = nextCount.textContent;
    }
    next.push(node);
  }
  next.forEach((node, index) => {
    if (bag.children[index] !== node) bag.insertBefore(node, bag.children[index] || null);
  });
  while (bag.children.length > next.length) bag.lastElementChild.remove();
}

export function updateDepartureView(root, { stash, picks, availability = undefined, selectionLocked = false, bagHtml = undefined, cells, renderCell, renderCard, slots, capacity, capacityHtml, hint, petId, rich, summaryHtml }) {
  const view = currentView(root, stash);
  if (cells && !view) return false;
  const byName = new Map(stash.map(stack => [departureStackKey(stack), stack]));
  const rows = view?.rows || [...root.querySelectorAll('#depPool .dep-card')].map(node => ({ node, own:node.getElementsByClassName('dep-own')[0], picked:node.getElementsByClassName('dep-picked-count')[0] }));
  for (const { node:card, own:owned, picked:pickedCount } of rows) {
    const name = card.dataset.name;
    const key = card.dataset.stackKey || name;
    const stack = byName.get(key);
    if (!stack) continue;
    const selected = picks[key] || 0;
    const remaining = Math.max(0, stack.count - selected);
    const addState = availability?.get(key);
    const canAdd = addState ? addState.canAdd : remaining > 0;
    const reason = addState?.reason || '仓库中没有更多此卡';
    if (card.classList.contains('picked') !== (selected > 0)) card.classList.toggle('picked', selected > 0);
    if (card.classList.contains('drained') !== (remaining <= 0)) card.classList.toggle('drained', remaining <= 0);
    card.classList.toggle('unavailable', !canAdd);
    setAttribute(card, 'data-can-add', String(canAdd));
    setAttribute(card, 'draggable', canAdd ? 'true' : null);
    setAttribute(card, 'aria-pressed', selected > 0 ? 'true' : 'false');
    setAttribute(card, 'aria-label', canAdd ? `带入${name}，还可带 ${remaining} 张` : `${name}，${reason}，点击查看详情`);
    setAttribute(card, 'title', canAdd ? `${name} · 还可带 ${remaining}` : `${name} · ${reason} · 点击查看详情`);
    setText(owned, String(remaining), true);
    if (pickedCount) {
      setText(pickedCount, String(selected), true);
      setAttribute(pickedCount, 'title', `已选带入 ${selected} 张`);
    }
  }
  const bag = view?.bag || root.querySelector('#depBag');
  if (bag) {
    if (cells) reconcileCells(bag, cells, capacity, renderCell, renderCard, rich, selectionLocked);
    else reconcileBag(bag, bagHtml, rich);
    bag.classList.toggle('full', slots >= capacity);
  }
  const count = view ? view.slots : root.querySelector('[data-dep-slots]');
  if (count) {
    const changed = count.textContent !== `${slots}/${capacity}`;
    if (changed) count.textContent = `${slots}/${capacity}`;
    count.classList.toggle('fulled', slots >= capacity);
    if (changed) pulseNumber(count);
  }
  const summary = view?.summary || root.querySelector('#depSummary');
  if (summary && summaryHtml !== undefined) setHTML(summary, rich(summaryHtml));
  const footer = view?.footer || root.querySelector('#depCapacity');
  setHTML(footer, rich(capacityHtml));
  const status = view?.status || root.querySelector('#depStatus');
  if (status) {
    status.hidden = !hint;
    setHTML(status, hint ? rich(hint) : '');
  }
  (view?.pets || root.querySelectorAll('.pet-chip')).forEach(chip => chip.classList.toggle('on', chip.dataset.id === petId));
  return true;
}
