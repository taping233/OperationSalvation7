// Map-only health presentation. Never writes game state or queues gameplay actions.
const mounted = new WeakMap();

export function mountMapHealthHud(root) {
  const body = root.querySelector('.hp-hud-body');
  const tip = root.querySelector('#mapHealthTip');
  if (!body || !tip) return null;
  const doc = root.ownerDocument;
  const abort = new doc.defaultView.AbortController();
  const label = doc.createElement('span');
  label.className = 'map-health-heading';
  label.innerHTML = '<span>生命</span><span class="map-health-state"></span>';
  body.prepend(label);
  const delta = doc.createElement('span');
  delta.className = 'map-health-delta';
  delta.setAttribute('aria-hidden', 'true');
  body.append(delta);
  root.dataset.healthHud = '';
  root.setAttribute('role', 'button');
  root.tabIndex = 0;
  root.setAttribute('aria-controls', tip.id);
  root.setAttribute('aria-expanded', 'false');
  let previous = null, timer, active = false, snapshot = '';
  const setOpen = open => {
    root.setAttribute('aria-expanded', String(open));
    root.dataset.healthDismissed = String(!open);
  };
  const stop = event => event.stopPropagation();
  root.addEventListener('pointerdown', stop, { signal: abort.signal });
  root.addEventListener('click', event => {
    event.stopPropagation();
    if (active) setOpen(root.getAttribute('aria-expanded') !== 'true');
  }, { signal: abort.signal });
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat && active) setOpen(root.getAttribute('aria-expanded') !== 'true');
    }
  }, { signal: abort.signal });
  root.addEventListener('pointerenter', () => { root.dataset.healthDismissed = 'false'; }, { signal: abort.signal });
  root.addEventListener('focus', () => { root.dataset.healthDismissed = 'false'; }, { signal: abort.signal });
  root.addEventListener('focusout', () => setOpen(false), { signal: abort.signal });
  doc.addEventListener('pointerdown', event => {
    if (!root.contains(event.target)) setOpen(false);
  }, { signal: abort.signal });
  const clearFeedback = () => {
    clearTimeout(timer);
    root.classList.remove('health-hurt', 'health-heal');
    delta.textContent = '';
  };
  return {
    update({ hp, maxHp, active: nextActive = true, instant = false }) {
      const current = Math.max(0, Number.isFinite(hp) ? hp : 0);
      const maximum = Math.max(0, Number.isFinite(maxHp) ? maxHp : 0);
      const nextSnapshot = `${current}/${maximum}/${nextActive}`;
      if (snapshot === nextSnapshot && !instant) return;
      snapshot = nextSnapshot;
      const pct = maximum > 0 ? Math.min(1, current / maximum) : 0;
      const low = current > 0 && pct <= .25;
      const wasActive = active;
      active = nextActive;
      root.dataset.healthActive = String(active);
      root.classList.toggle('health-low', low);
      label.lastElementChild.textContent = current === 0 ? '耗尽' : low ? '偏低' : '';
      root.setAttribute('aria-label', `生命 ${current}，上限 ${maximum}${low ? '，生命偏低' : ''}`);
      tip.innerHTML = `<strong>生命值</strong><span>当前 ${current} / 上限 ${maximum}</span>`;
      const bar = root.querySelector('#hpBar');
      if (bar) bar.style.width = `${(pct * 100).toFixed(1)}%`;
      if (!active || instant) { clearFeedback(); setOpen(false); }
      if (active && wasActive && !instant && previous !== null && current !== previous) {
        clearFeedback();
        const change = current - previous;
        delta.textContent = `${change > 0 ? '+' : '−'}${Math.abs(change)}`;
        void root.offsetWidth;
        root.classList.add(change > 0 ? 'health-heal' : 'health-hurt');
        timer = setTimeout(clearFeedback, 1000);
      }
      previous = current;
    },
    dispose() {
      abort.abort(); clearFeedback(); label.remove(); delta.remove(); mounted.delete(root);
    },
  };
}

export function updateMapHealthHud(root, state) {
  if (!root) return;
  let controller = mounted.get(root);
  if (!controller) {
    controller = mountMapHealthHud(root);
    if (!controller) return;
    mounted.set(root, controller);
  }
  controller.update(state);
}
