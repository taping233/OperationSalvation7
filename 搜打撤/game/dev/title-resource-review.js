// Standalone diagnostic controller. No production JS imports or storage access.
export function mountTitleResourceReview(doc = document, win = window) {
  const fragment = doc.querySelector('#titleReviewTemplate').content.cloneNode(true);
  doc.body.prepend(fragment);
  const title = doc.querySelector('#title');
  const status = doc.querySelector('#reviewStatus');
  const toggle = doc.querySelector('#pauseDecorations');
  const wallpaper = doc.querySelector('#reviewWallpaper');
  const params = new URLSearchParams(win.location.search);
  const started = win.performance.now();
  let pulses = 0;
  let stopped = false;
  function resize() {
    const root = doc.documentElement;
    root.dataset.gameLayout = 'landscape';
    root.style.setProperty('--game-layout-width', '1920px');
    root.style.setProperty('--game-layout-height', '1080px');
    root.style.zoom = String(Math.min(win.innerWidth / 1920, win.innerHeight / 1080));
    title.style.setProperty('--home-travel', '1160px');
  }
  function report() {
    const images = [...doc.images];
    const loaded = images.filter(img => img.complete && img.naturalWidth > 0).length;
    // Resource Timing observes CSS backgrounds too; it does not request/decode images.
    // Completed entries are not proof of successful decode; data: grain SVG is excluded.
    const resources = win.performance.getEntriesByType?.('resource') || [];
    const imageUrls = new Set(resources.filter(e => /\.(?:png|webp|jpe?g|svg)(?:[?#]|$)/i.test(e.name)).map(e => e.name));
    const seconds = Math.floor((win.performance.now() - started) / 1000);
    status.textContent = `存活 ${seconds}s · 心跳 ${pulses} · 页面 ${doc.visibilityState} · DOM 图片成功 ${loaded}/${images.length} · 图片请求完成 ${imageUrls.size}（含 CSS，非解码计数）· CSS ${doc.body.classList.contains('title-review-paused') ? '暂停' : '运行'}`;
    title.querySelector('[data-clock]').textContent = new Date().toLocaleTimeString('en-GB');
  }
  function setPaused(paused) {
    doc.body.classList.toggle('title-review-paused', paused);
    toggle.setAttribute('aria-pressed', String(paused));
    toggle.textContent = paused ? '恢复首页装饰 CSS' : '暂停首页装饰 CSS';
    report();
  }
  function chooseWallpaper() {
    title.dataset.homeWallpaper = wallpaper.value;
    title.querySelector('[data-wallpaper-count]').textContent = wallpaper.value === 'snow-road' ? '1/2' : '2/2';
  }
  const click = () => setPaused(!doc.body.classList.contains('title-review-paused'));
  toggle.addEventListener('click', click);
  wallpaper.addEventListener('change', chooseWallpaper);
  if (params.get('wallpaper') === 'baita-heixiang') wallpaper.value = 'baita-heixiang';
  chooseWallpaper(); resize(); setPaused(params.get('paused') === '1');
  const timer = win.setInterval(() => { pulses++; report(); }, 1000);
  win.addEventListener('resize', resize);
  function stop() {
    if (stopped) return;
    stopped = true;
    win.clearInterval(timer);
    win.removeEventListener('resize', resize);
    win.removeEventListener('pagehide', stop);
    toggle.removeEventListener('click', click);
    wallpaper.removeEventListener('change', chooseWallpaper);
  }
  win.addEventListener('pagehide', stop);
  return stop;
}
if (import.meta.env.DEV) mountTitleResourceReview();
