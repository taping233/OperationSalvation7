// Shared toolbar health presentation. Never writes game state or queues gameplay actions.
const mounted = new WeakMap();

function renderHealthNumbers(root, current, maximum) {
  const text = root.querySelector('#hpText');
  if (!text) return;
  let value = text.querySelector(':scope > .hp-current');
  let rest = text.querySelector(':scope > .hp-rest');
  if (!value) { value = root.ownerDocument.createElement('span'); value.className = 'hp-current'; }
  if (!rest) { rest = root.ownerDocument.createElement('span'); rest.className = 'hp-rest'; }
  if (text.childNodes.length !== 2 || text.firstChild !== value || text.lastChild !== rest) text.replaceChildren(value, rest);
  if (value.textContent !== String(current)) value.textContent = String(current);
  if (rest.textContent !== `/${maximum}`) rest.textContent = `/${maximum}`;
}

export function mountMapHealthHud(root) {
  const body = /** @type {HTMLElement} */ (root.querySelector('.hp-hud-body'));
  const tip = /** @type {HTMLElement} */ (root.querySelector('#mapHealthTip'));
  if (!body) return null;
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
  root.setAttribute('role', 'img');
  root.removeAttribute('tabindex');
  root.removeAttribute('aria-controls');
  root.removeAttribute('aria-expanded');
  if (tip) { tip.hidden = true; tip.replaceChildren(); }
  let previous = null, timer, active = false, snapshot = '';
  const stop = event => event.stopPropagation();
  root.addEventListener('pointerdown', stop, { signal: abort.signal });
  root.addEventListener('click', stop, { signal: abort.signal });
  const clearFeedback = () => {
    clearTimeout(timer);
    root.classList.remove('health-hurt', 'health-heal');
    delta.textContent = '';
  };
  return {
    update({ hp, maxHp, active: nextActive = true, instant = false }) {
      const current = Math.max(0, Number.isFinite(hp) ? hp : 0);
      const maximum = Math.max(0, Number.isFinite(maxHp) ? maxHp : 0);
      // Cached state may outlive a legacy text rewrite. Repair only the owned
      // number nodes before the fast path; tooltip and feedback stay untouched.
      renderHealthNumbers(root, current, maximum);
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
      const bar = /** @type {HTMLElement} */ (root.querySelector('#hpBar'));
      if (bar) bar.style.width = `${(pct * 100).toFixed(1)}%`;
      if (!active || instant) clearFeedback();
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
