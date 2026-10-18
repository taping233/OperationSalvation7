import '../../css/event-signal-puzzle.css';

const DIRECTIONS = ['上', '右', '下', '左'];
const ports = rotation => [rotation, (rotation + 1) % 4];

// Presentation-only variants. Never read or advance the run's random service.
export function createSignalPuzzleState(seed = '') {
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  const variant = hash & 1;
  const solution = variant ? [3, 1] : [2, 0];
  return {
    variant,
    rotations: solution.map((rotation, index) => (rotation + 1 + ((hash >>> (index * 8 + 1)) % 3)) % 4),
    open: false,
  };
}

export function signalPuzzleConnected(state) {
  const first = ports(state.rotations[0]), second = ports(state.rotations[1]);
  const outgoing = state.variant ? 0 : 2;
  return first.includes(3) && first.includes(outgoing) && second.includes((outgoing + 2) % 4) && second.includes(1);
}

function screenHTML(state) {
  const firstY = state.variant ? 154 : 66, secondY = 220 - firstY;
  const sign = state.variant ? -1 : 1;
  return `<summary class="signal-puzzle-entry">看看信号屏 <small>可选</small><span aria-hidden="true"></span></summary>
    <div class="signal-puzzle-screen">
      <p class="signal-puzzle-rule">转动两块线路，把终端连到无人机。</p>
      <div class="signal-puzzle-board">
        <svg viewBox="0 0 320 220" class="signal-puzzle-wires" aria-hidden="true" focusable="false">
          <path class="signal-wire" d="M30 ${firstY}H92 M124 ${firstY + sign * 32}V${secondY - sign * 32} M156 ${secondY}H272"/>
          <path class="signal-port-arrow" d="M69 ${firstY - 5}l7 5-7 5 M247 ${secondY - 5}l7 5-7 5"/>
          <g class="signal-terminal" transform="translate(8 ${firstY - 13})"><rect width="23" height="21" rx="2"/><path d="M4 5h15M6 12h11M8 25h8M12 21v4"/></g>
          <g class="signal-drone" transform="translate(274 ${secondY - 13})"><path d="M5 9h22v15H5zM0 3h12m8 0h12M6 3v6m20-6v6M11 24v4m10-4v4"/><circle class="signal-drone-lamp" cx="16" cy="16" r="3"/></g>
          <text x="24" y="${firstY + 45}" text-anchor="middle">终端</text>
          <text x="289" y="${secondY + 45}" text-anchor="middle">无人机</text>
        </svg>
        ${[firstY, secondY].map((y, index) => `<button type="button" class="signal-puzzle-tile" data-signal-tile="${index}" style="--signal-y:${y / 220 * 100}%">
          <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 0V32H64"/><circle cx="32" cy="2" r="2"/><circle cx="62" cy="32" r="2"/></svg>
        </button>`).join('')}
        <span class="signal-puzzle-pulse" aria-hidden="true" style="--signal-start-y:${firstY / 220 * 100}%;--signal-end-y:${secondY / 220 * 100}%"></span>
      </div>
      <div class="signal-puzzle-bottom"><span class="signal-puzzle-status" role="status" aria-live="polite"></span><button type="button" class="signal-puzzle-close">收起</button></div>
    </div>`;
}

// The caller keeps this UI-only state across bag returns. No rewards, storage or game actions are accepted.
export function mountEventSignalPuzzle(scene, state, current = () => true) {
  const host = scene?.querySelector('.node-summary');
  if (!host || !state || host.querySelector('.event-signal-puzzle')) return null;
  const panel = document.createElement('details');
  panel.className = 'event-signal-puzzle';
  panel.innerHTML = screenHTML(state);
  panel.open = state.open;
  host.append(panel);
  const summary = panel.querySelector('summary');
  const status = panel.querySelector('.signal-puzzle-status');
  const tiles = [...panel.querySelectorAll('[data-signal-tile]')];
  const view = panel.ownerDocument.defaultView;
  const scroller = panel.closest('.node-main');
  let scrollBeforeOpen = null;
  const reveal = () => {
    if (!scroller) return;
    // Move only this event's inner reading area, never the page or fixed action footer.
    const target = panel.getBoundingClientRect().height <= scroller.clientHeight
      ? panel : panel.querySelector('.signal-puzzle-screen');
    const top = target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop;
    scroller.scrollTop = Math.max(0, Math.min(scroller.scrollHeight - scroller.clientHeight, scroller.scrollTop + top));
  };
  let disposed = false, listening = false;
  const live = () => !disposed && scene.isConnected && panel.isConnected && current();
  const sync = (animate = false) => {
    const connected = signalPuzzleConnected(state);
    panel.classList.toggle('is-connected', connected);
    panel.dataset.signalConnected = String(connected);
    if (animate && connected) panel.classList.add('signal-just-connected');
    tiles.forEach((tile, index) => {
      const rotation = state.rotations[index];
      tile.style.setProperty('--signal-angle', `${rotation * 90}deg`);
      tile.dataset.rotation = String(rotation);
      tile.setAttribute('aria-label', `第${index + 1}块线路，线口朝${ports(rotation).map(port => DIRECTIONS[port]).join('和')}，按回车旋转`);
      tile.setAttribute('aria-disabled', String(connected));
    });
    status.textContent = connected ? '信号已连通' : '点线路旋转 · 可直接领取补给';
  };
  const rotate = index => {
    if (!live() || !panel.open || signalPuzzleConnected(state)) return;
    state.rotations[index] = (state.rotations[index] + 1) % 4;
    sync(true);
  };
  const close = () => {
    if (!live()) return;
    state.open = false;
    panel.open = false;
    updateEscape();
    if (scroller && scrollBeforeOpen !== null) scroller.scrollTop = scrollBeforeOpen;
    summary.focus({ preventScroll: true });
  };
  const escape = event => {
    if (!live() || !panel.open || event.key !== 'Escape' || event.isComposing || event.keyCode === 229 || !panel.contains(event.target)) return;
    // Stop before the event page's capture handler, preserving its pending reward selection.
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };
  function updateEscape() {
    const needed = !disposed && panel.open;
    if (needed === listening) return;
    listening = needed;
    if (needed) view.addEventListener('keydown', escape, true);
    else view.removeEventListener('keydown', escape, true);
  }
  tiles.forEach((tile, index) => {
    tile.addEventListener('click', () => rotate(index));
    tile.addEventListener('keydown', event => {
      if (!['Enter', ' '].includes(event.key) || event.isComposing) return;
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) rotate(index);
    });
  });
  summary.addEventListener('click', event => {
    if (!live()) return;
    event.preventDefault();
    if (panel.open) { close(); return; }
    scrollBeforeOpen = scroller?.scrollTop ?? null;
    state.open = panel.open = true;
    updateEscape();
    reveal();
  });
  panel.addEventListener('toggle', () => {
    if (!live()) return;
    state.open = panel.open;
    updateEscape();
  });
  panel.querySelector('.signal-puzzle-close').addEventListener('click', close);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    updateEscape();
    observer.disconnect();
  };
  // The overlay replaces the scene on close, reward execution, bag entry and navigation.
  const observer = new MutationObserver(() => { if (!scene.isConnected || !panel.isConnected) dispose(); });
  observer.observe(scene.parentElement, { childList: true, subtree: true });
  sync();
  updateEscape();
  if (panel.open) reveal();
  return { panel, dispose };
}
