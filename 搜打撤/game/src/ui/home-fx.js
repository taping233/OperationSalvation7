import { interfaceReducedMotion } from './interface-motion.js';
import '../../css/home-polish.css';
import { watchSurfaceActivity } from './surface-activity.js';

// Home cover details: frame-batched pointer parallax, sparkles, mist, grain, sheen and a status readout.
const title = document.getElementById('title');
const inner = /** @type {HTMLElement} */ (title?.querySelector('.title-inner'));
const brand = /** @type {HTMLElement} */ (title?.querySelector('.home-brand'));
const credits = /** @type {HTMLDialogElement} */ (document.getElementById('homeCredits'));

function sceneInteractive() {
  return !title.hidden && !document.hidden && !credits?.open
    && !title.classList.contains('wallpaper-only') && title.dataset.homePhase !== 'out'
    && !document.body.classList.contains('page-covered') && !document.querySelector('.page-loading');
}

const SPARKS = [
  // x%, y%, delay, size
  [8, 18, 0, 1], [92, 14, 1.3, .8], [96, 64, 2.4, 1], [3, 70, 3.1, .7], [50, 2, .7, .6], [78, 88, 1.9, .8],
];

function make(tag, className, vars = {}) {
  const el = document.createElement(tag);
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  for (const [key, value] of Object.entries(vars)) el.style.setProperty(key, value);
  return el;
}

function bindSpotlight() {
  let frame = 0;
  let x = 0;
  let y = 0;
  const apply = () => {
    frame = 0;
    if (!sceneInteractive() || interfaceReducedMotion()) return;
    const area = title.getBoundingClientRect();
    if (!area.width || !area.height) return;
    title.style.setProperty('--px', ((x - area.left) / area.width * 2 - 1).toFixed(3));
    title.style.setProperty('--py', ((y - area.top) / area.height * 2 - 1).toFixed(3));
  };
  title.addEventListener('pointermove', event => {
      if (!(event.target instanceof Element)) return;
    if (!sceneInteractive() || interfaceReducedMotion()) return;
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });
  const reset = () => {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    title.style.setProperty('--px', '0');
    title.style.setProperty('--py', '0');
  };
  title.addEventListener('pointerleave', reset);
  return reset;
}

function bindSceneAttention(onVisibilityChange) {
  const zoneOf = node => node?.closest?.('.home-primary') ? 'primary'
    : node?.closest?.('.home-collection') ? 'collection'
      : node?.closest?.('.home-system') ? 'system' : null;
  let pointerZone = null;
  let activity = null;
  const sync = state => {
    const interactive = typeof state === 'boolean' ? state : sceneInteractive() && activity?.active() !== false;
    const ambient = interactive && !interfaceReducedMotion() ? 'running' : 'paused';
    if (title.dataset.homeAmbient !== ambient) title.dataset.homeAmbient = ambient;
    onVisibilityChange?.(interactive);
    if (!interactive) {
      pointerZone = null;
      delete title.dataset.homeAttention;
      title.style.setProperty('--px', '0');
      title.style.setProperty('--py', '0');
      return;
    }
    const zone = pointerZone || zoneOf(document.activeElement);
    if (zone) {
      if (title.dataset.homeAttention !== zone) title.dataset.homeAttention = zone;
    } else if (title.hasAttribute('data-home-attention')) delete title.dataset.homeAttention;
  };
  title.addEventListener('pointerover', event => { pointerZone = zoneOf(event.target); sync(); });
  title.addEventListener('pointerleave', () => { pointerZone = null; sync(); });
  title.addEventListener('focusin', sync);
  title.addEventListener('focusout', () => queueMicrotask(sync));
  window.addEventListener('blur', () => { pointerZone = null; delete title.dataset.homeAttention; });
  activity = watchSurfaceActivity(title, { isActive:sceneInteractive, extraRoots:[credits], onRefresh:sync });
  sync();
}

function mountSceneDepth() {
  title.insertBefore(make('div', 'home-depth'), inner);
  const snow = make('div', 'home-near-snow');
  [[12, 7, 13, -3], [28, 9, 16, -10], [43, 6, 14, -7], [69, 8, 18, -14], [83, 10, 15, -5], [93, 6, 19, -17]]
    .forEach(([left, size, duration, delay]) => snow.appendChild(make('i', '', {
      '--x': `${left}%`, '--size': `${size}px`, '--duration': `${duration}s`, '--delay': `${delay}s`,
    })));
  title.insertBefore(snow, inner);
  const sizeTravel = () => title.style.setProperty('--home-travel', `${(title.clientHeight || window.innerHeight) + 80}px`);
  sizeTravel();
  if (typeof ResizeObserver === 'function') new ResizeObserver(sizeTravel).observe(title);
}

const PICKS = new Set(['mStart', 'mGuide', 'mAch', 'btnCardLib', 'mSettings', 'mInbox', 'mCredits', 'btnTitleExit']);

function center(el) {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function ripple(button, event) {
  const box = button.getBoundingClientRect();
  const sx = box.width ? button.clientWidth / box.width : 1;
  const sy = box.height ? button.clientHeight / box.height : 1;
  const x = event.detail ? (event.clientX - box.left) * sx : button.clientWidth / 2;
  const y = event.detail ? (event.clientY - box.top) * sy : button.clientHeight / 2;
  const wave = make('i', 'home-ripple', { '--rx': `${Math.round(x)}px`, '--ry': `${Math.round(y)}px` });
  button.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove());
  setTimeout(() => wave.remove(), 900);
}

// The clicked control keeps a mark through departure and return so the CSS can choreograph both around it.
function bindPick() {
  const clear = () => {
    delete title.dataset.homePick;
    /** @type {HTMLElement} */ (title.querySelector('.is-picked'))?.classList.remove('is-picked');
  };
  new MutationObserver(() => { if (title.dataset.homePhase === 'rest') clear(); })
    .observe(title, { attributes: true, attributeFilter: ['data-home-phase'] });
  // Registered ahead of home-menu-motion's handler, so the phase is still the one before this click.
  title.addEventListener('click', event => {
      if (!(event.target instanceof Element)) return;
    const button = event.target.closest?.('button');
    if (!button || !title.contains(button) || button.closest('dialog') || button.disabled || !PICKS.has(button.id)) return;
    if (title.dataset.homePhase === 'out' || interfaceReducedMotion()) return;
    clear();
    title.dataset.homePick = button.id;
    button.classList.add('is-picked');
    const from = center(button);
    for (const plate of /** @type {NodeListOf<HTMLElement>} */ (title.querySelectorAll('.home-plate'))) {
      const at = center(plate);
      const delay = plate === button ? 0 : Math.min(90, Math.hypot(at.x - from.x, at.y - from.y) / 11);
      plate.style.setProperty('--hd', `${Math.round(delay)}ms`);
    }
    ripple(button, event);
  }, true);
}

function bindWarmupHint() {
  const tip = document.getElementById('warmupTip');
  const num = document.getElementById('warmupNum');
  if (!tip || !num) return;
  const sync = () => tip.toggleAttribute('data-idle', /^0\s*\/\s*0$/.test(num.textContent.trim()));
  sync();
  new MutationObserver(sync).observe(num, { childList: true, characterData: true, subtree: true });
}

if (title && inner && title.classList.contains('home-composed')) {
  for (const plate of /** @type {NodeListOf<HTMLElement>} */ (title.querySelectorAll('.home-plate'))) {
    plate.appendChild(make('i', 'home-hover-glow'));
  }

  if (brand) {
    for (const [x, y, delay, size] of SPARKS) {
      brand.appendChild(make('i', 'home-spark', { '--x': `${x}%`, '--y': `${y}%`, '--t': `${delay}s`, '--s': size }));
    }
  }
  mountSceneDepth();
  title.insertBefore(make('div', 'home-mist'), inner);
  title.insertBefore(make('div', 'home-grain'), inner);
  title.insertBefore(make('div', 'home-flash'), inner);
  /** @type {HTMLElement} */ (title.querySelector('.home-start'))?.appendChild(make('i', 'home-sheen'));

  const readout = make('div', 'home-readout');
  readout.innerHTML = '<i class="home-readout-dot"></i><span>LOCAL <b data-clock>--:--:--</b></span><span>ASCENSION COUNCIL <b data-version></b></span>';
  inner.appendChild(readout);
  const clock = /** @type {HTMLElement} */ (readout.querySelector('[data-clock]'));
  const version = /** @type {HTMLElement} */ (readout.querySelector('[data-version]'));
  const tick = () => {
    if (!sceneInteractive()) return;
    const time = new Date().toLocaleTimeString('en-GB');
    const label = document.getElementById('gameVersion')?.textContent ?? '';
    if (clock.textContent !== time) clock.textContent = time;
    if (version.textContent !== label) version.textContent = label;
  };
  let clockTimer = null;
  const syncClock = active => {
    if (active && clockTimer === null) {
      tick();
      clockTimer = setInterval(tick, 1000);
    } else if (!active && clockTimer !== null) {
      clearInterval(clockTimer);
      clockTimer = null;
    }
  };
  window.addEventListener('pagehide', () => syncClock(false));
  window.addEventListener('pageshow', () => syncClock(sceneInteractive()));

  const resetSpotlight = bindSpotlight();
  bindSceneAttention(active => {
    syncClock(active);
    if (!active || interfaceReducedMotion()) resetSpotlight();
  });
  bindPick();
  bindWarmupHint();
}
