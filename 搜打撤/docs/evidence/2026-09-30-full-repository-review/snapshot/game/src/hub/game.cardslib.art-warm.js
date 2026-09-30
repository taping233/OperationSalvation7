/* 照相馆缩略图预解码预热（拆分自 game.cardslib.js，行为原样保留）。
   卡面缩略图预解码：启动时的全量预热清单补的是 assets/ 原图，库页显示的是
   assets/thumbs/ 缩略图，不补这一步首轮滚动就得边滚边解码（实测首轮滚动
   32~35fps → 44~45fps，>50ms 长帧减半）。解码在解码线程，不占主线程。 */

let libArtObserver = null;
let libArtRoot = null;

function decodeLibImage(image) {
  image.loading = 'eager';
  if (!image.getAttribute('src') && image.dataset.libSrc) {
    image.src = image.dataset.libSrc;
    delete image.dataset.libSrc;
  }
  try { image.decode?.()?.catch?.(() => { /* 解码失败：图已显示，忽略 */ }); } catch { /* decode 不可用：跳过 */ }
}

export function warmLibArt() {
  const grid = document.getElementById('libGrid');
  if (!grid) return;
  // 当前页创建后观察近屏缩略图；网格根节点变化时重建 observer。
  if (libArtRoot !== grid) {
    libArtObserver?.disconnect();
    libArtObserver = null;
    libArtRoot = grid;
  }
  const images = [...grid.querySelectorAll('.studio-photo-art img[data-lib-src]:not([data-lib-warm]), .studio-photo-art img[src]:not([data-lib-warm])')];
  images.forEach(image => { image.dataset.libWarm = '1'; });
  // 图片先保留 data-lib-src；只有接近视口才赋 src 并异步解码，避免原生 lazy 提前加载整批。
  if (typeof IntersectionObserver !== 'function') {
    images.forEach(decodeLibImage);
  } else {
    if (!libArtObserver) {
      libArtObserver = new IntersectionObserver(entries => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          decodeLibImage(entry.target);
          libArtObserver?.unobserve(entry.target);
        }
      }, { root: grid, rootMargin: '55% 0px' });
    }
    images.forEach(image => libArtObserver.observe(image));
  }
  document.querySelectorAll('#libPreview img[src]').forEach(decodeLibImage);
}

// 关页 / 筛选重绘时彻底复位观察器（原 closeLibPage / renderLibGrid 的内联三连）
export function resetLibArtWarmup() {
  libArtObserver?.disconnect();
  libArtObserver = null;
  libArtRoot = null;
}
