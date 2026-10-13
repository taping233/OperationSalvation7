// Keep the staging page and its card nodes mounted during local selection changes.
export function bindDepartureFilters(root, stash, { filters = {}, rarities = [], types = [], rarityOf = card => card.rarity, onFiltersChange = () => {} } = {}) {
  const pool = root?.querySelector('#depPool');
  const selects = {
    rarity: root?.querySelector('#depFilterRarity'),
    type: root?.querySelector('#depFilterType'),
    cost: root?.querySelector('#depFilterCost'),
  };
  if (!pool || Object.values(selects).some(select => !select)) return;
  const byName = new Map(stash.map(stack => [stack.card.name, stack.card]));
  const entries = [...pool.querySelectorAll('.dep-card')].map(node => {
    const card = byName.get(node.dataset.name) || {};
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
    const next = Object.fromEntries(Object.entries(selects).map(([key, select]) => [key, select.value]));
    const active = Object.values(next).some(Boolean);
    let visible = 0;
    for (const entry of entries) {
      entry.node.hidden = !Object.entries(next).every(([key, value]) => !value || entry[key] === value);
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
}

function reconcileBag(bag, html, rich) {
  const template = bag.ownerDocument.createElement('template');
  template.innerHTML = rich(html);
  const named = new Map();
  const empty = [];
  for (const cell of bag.children) {
    if (cell.dataset.name) named.set(cell.dataset.name, cell);
    else empty.push(cell);
  }
  const next = [];
  for (const wanted of template.content.children) {
    const cell = wanted.dataset.name ? named.get(wanted.dataset.name) : empty.shift();
    const node = cell || wanted;
    if (cell) {
      for (const key of ['class', 'aria-label', 'title', 'draggable']) {
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

export function updateDepartureView(root, { stash, picks, bagHtml, slots, capacity, capacityHtml, hint, petId, rich }) {
  const byName = new Map(stash.map(stack => [stack.card.name, stack]));
  for (const card of root.querySelectorAll('#depPool .dep-card')) {
    const name = card.dataset.name;
    const stack = byName.get(name);
    if (!stack) continue;
    const selected = picks[name] || 0;
    const remaining = Math.max(0, stack.count - selected);
    card.classList.toggle('picked', selected > 0);
    card.classList.toggle('drained', remaining <= 0);
    card.setAttribute('aria-pressed', selected > 0 ? 'true' : 'false');
    card.setAttribute('aria-label', `带入${name}，还可带 ${remaining} 张`);
    card.title = `${name} · 点击或拖到右侧背包带入（还可带 ${remaining}）`;
    const owned = card.querySelector('.dep-own');
    if (owned) owned.textContent = String(remaining);
    const pickedCount = card.querySelector('.dep-picked-count');
    if (pickedCount) {
      pickedCount.textContent = String(selected);
      pickedCount.title = `已选带入 ${selected} 张`;
    }
  }
  const bag = root.querySelector('#depBag');
  if (bag) {
    reconcileBag(bag, bagHtml, rich);
    bag.classList.toggle('full', slots >= capacity);
  }
  const count = root.querySelector('[data-dep-slots]');
  if (count) {
    count.textContent = `${slots}/${capacity}`;
    count.classList.toggle('fulled', slots >= capacity);
  }
  const footer = root.querySelector('#depCapacity');
  if (footer) footer.innerHTML = rich(capacityHtml);
  const status = root.querySelector('#depStatus');
  if (status) {
    status.hidden = !hint;
    status.innerHTML = hint ? rich(hint) : '';
  }
  root.querySelectorAll('.pet-chip').forEach(chip => chip.classList.toggle('on', chip.dataset.id === petId));
}
