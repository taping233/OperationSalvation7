// Composition layers for the home cover: diagonal slab, corner brackets, ghost word, side rail, beams, plate index and sweep.
const title = document.getElementById('title');
const inner = title?.querySelector('.title-inner');

function make(tag, className) {
  const el = document.createElement(tag);
  el.className = className;
  el.setAttribute('aria-hidden', 'true');
  return el;
}

if (title && inner && title.classList.contains('home-composed')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../css/home-layers.css', import.meta.url).href;
  link.dataset.homeLayers = '1';
  document.head.appendChild(link);

  const slash = make('div', 'home-slash');
  slash.innerHTML = '<svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" focusable="false">'
    + '<defs><linearGradient id="hlSlashFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#080a0e" stop-opacity="0"/>'
    + '<stop offset=".22" stop-color="#080a0e" stop-opacity=".62"/><stop offset=".8" stop-color="#080a0e" stop-opacity=".62"/>'
    + '<stop offset="1" stop-color="#080a0e" stop-opacity="0"/></linearGradient></defs>'
    + '<polygon points="24,0 100,0 100,100 0,100" fill="url(#hlSlashFill)"/>'
    + '<line class="hs-edge" pathLength="1" x1="24" y1="0" x2="0" y2="100" stroke="#ffffff" stroke-opacity=".34" stroke-width="1" vector-effect="non-scaling-stroke"/>'
    + '<line class="hs-accent" pathLength="1" x1="24" y1="0" x2="19" y2="21" stroke="#ffd23c" stroke-width="2" vector-effect="non-scaling-stroke"/></svg>';
  title.insertBefore(slash, inner);
  title.insertBefore(make('div', 'home-beams'), inner);

  const ghost = make('div', 'home-ghost');
  ghost.innerHTML = '<div class="home-ghost-track">' + '<span>CODE NAME 7</span>'.repeat(4) + '</div>';
  title.insertBefore(ghost, inner);

  for (const corner of ['tl', 'tr', 'bl', 'br']) title.insertBefore(make('i', `home-corner home-corner-${corner}`), inner);

  const rail = make('div', 'home-rail');
  rail.innerHTML = '<span class="home-rail-text">Winter Speculation · Ascension Council · 2026</span><span class="home-rail-ruler"></span>';
  inner.appendChild(rail);

  title.querySelectorAll('.home-primary > .home-plate, .home-secondary > .home-plate').forEach((plate, i) => {
    const index = make('span', 'home-index');
    index.textContent = String(i + 1).padStart(2, '0');
    plate.appendChild(index);
    if (!plate.classList.contains('home-start')) plate.appendChild(make('i', 'home-sweep'));
  });
}
