import { interfaceReducedMotion } from './interface-motion.js';

// Home cover details: frame-batched pointer parallax and plate spotlight, sparkles, mist, grain, sheen and a status readout.
const title = document.getElementById('title');
const inner = title?.querySelector('.title-inner');
const brand = title?.querySelector('.home-brand');

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
  let plate = null;
  let x = 0;
  let y = 0;
  const apply = () => {
    frame = 0;
    if (title.hidden || document.hidden || interfaceReducedMotion() || document.body.classList.contains('page-covered')) return;
    const area = title.getBoundingClientRect();
    title.style.setProperty('--px', ((x - area.left) / area.width * 2 - 1).toFixed(3));
    title.style.setProperty('--py', ((y - area.top) / area.height * 2 - 1).toFixed(3));
    if (!plate) return;
    const box = plate.getBoundingClientRect();
    plate.style.setProperty('--mx', `${Math.round(x - box.left)}px`);
    plate.style.setProperty('--my', `${Math.round(y - box.top)}px`);
  };
  title.addEventListener('pointermove', event => {
    if (interfaceReducedMotion() || document.body.classList.contains('page-covered')) return;
    plate = event.target.closest?.('.home-plate');
    x = event.clientX;
    y = event.clientY;
    if (!frame) frame = requestAnimationFrame(apply);
  }, { passive: true });
  title.addEventListener('pointerleave', () => {
    plate = null;
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    title.style.setProperty('--px', '0');
    title.style.setProperty('--py', '0');
  });
}

const PICKS = new Set(['mStart', 'mGuide', 'mAch', 'btnCardLib', 'mSettings', 'mInbox', 'mCredits', 'btnTitleExit']);

function center(el) {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function ripple(button, event) {
  const box = button.getBoundingClientRect();
  const x = event.detail ? event.clientX - box.left : box.width / 2;
  const y = event.detail ? event.clientY - box.top : box.height / 2;
  const wave = make('i', 'home-ripple', { '--rx': `${Math.round(x)}px`, '--ry': `${Math.round(y)}px` });
  button.appendChild(wave);
  wave.addEventListener('animationend', () => wave.remove());
  setTimeout(() => wave.remove(), 900);
}

// The clicked control keeps a mark through departure and return so the CSS can choreograph both around it.
function bindPick() {
  const clear = () => {
    delete title.dataset.homePick;
    title.querySelector('.is-picked')?.classList.remove('is-picked');
  };
  new MutationObserver(() => { if (title.dataset.homePhase === 'rest') clear(); })
    .observe(title, { attributes: true, attributeFilter: ['data-home-phase'] });
  // Registered ahead of home-menu-motion's handler, so the phase is still the one before this click.
  title.addEventListener('click', event => {
    const button = event.target.closest?.('button');
    if (!button || !title.contains(button) || button.closest('dialog') || button.disabled || !PICKS.has(button.id)) return;
    if (title.dataset.homePhase === 'out' || interfaceReducedMotion()) return;
    clear();
    title.dataset.homePick = button.id;
    button.classList.add('is-picked');
    const from = center(button);
    for (const plate of title.querySelectorAll('.home-plate')) {
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
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/home-polish.css', import.meta.url).href;
  link.dataset.homeFx = '1';
  document.head.appendChild(link);

  if (brand) {
    for (const [x, y, delay, size] of SPARKS) {
      brand.appendChild(make('i', 'home-spark', { '--x': `${x}%`, '--y': `${y}%`, '--t': `${delay}s`, '--s': size }));
    }
  }
  title.insertBefore(make('div', 'home-mist'), inner);
  title.insertBefore(make('div', 'home-grain'), inner);
  title.insertBefore(make('div', 'home-flash'), inner);
  title.querySelector('.home-start')?.appendChild(make('i', 'home-sheen'));

  const readout = make('div', 'home-readout');
  readout.innerHTML = '<i class="home-readout-dot"></i><span>LOCAL <b data-clock>--:--:--</b></span><span>ASCENSION COUNCIL <b data-version></b></span>';
  inner.appendChild(readout);
  const clock = readout.querySelector('[data-clock]');
  const version = readout.querySelector('[data-version]');
  const tick = () => {
    if (title.hidden || document.hidden) return;
    clock.textContent = new Date().toLocaleTimeString('en-GB');
    version.textContent = document.getElementById('gameVersion')?.textContent ?? '';
  };
  tick();
  setInterval(tick, 1000);

  bindSpotlight();
  bindPick();
  bindWarmupHint();
}
