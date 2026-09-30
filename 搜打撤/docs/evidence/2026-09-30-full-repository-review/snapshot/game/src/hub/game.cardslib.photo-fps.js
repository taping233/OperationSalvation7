/* 卡牌库开发模式性能探针（拆分自 game.cardslib.js，行为原样保留）。
   开发模式 ?photoFps=1：采样 DOM 页的 rAF 间隔，不使用被遮挡画布的 FPS 统计。 */

// 卡页开关由宿主（game.cardslib.js 照相馆壳）注入，避免壳↔切片循环依赖
let isCardPageOpen = () => false;

export function configurePhotoFps(deps) {
  if (deps && typeof deps.isCardPageOpen === 'function') isCardPageOpen = deps.isCardPageOpen;
}

const photoFpsEnabled = import.meta.env.DEV && new URLSearchParams(location.search).has('photoFps');

let photoFpsProbe = null;
let photoFpsSettledTimer = null;

function stopPhotoFpsProbe() {
  if (!photoFpsProbe) return;
  cancelAnimationFrame(photoFpsProbe.frame);
  photoFpsProbe.observer?.disconnect();
  photoFpsProbe.frameObserver?.disconnect();
  photoFpsProbe = null;
}

function samplePhotoFps(label, duration = 2500, requireOpen = true) {
  if (!photoFpsEnabled) return;
  stopPhotoFpsProbe();
  const started = performance.now();
  let previous = started;
  const gaps = [];
  const slowFrames = [];
  const longTasks = [];
  const longAnimationFrames = [];
  const observer = typeof PerformanceObserver === 'function'
    ? new PerformanceObserver(list => list.getEntries().forEach(entry => longTasks.push(entry.duration)))
    : null;
  try { observer?.observe({ type: 'longtask', buffered: false }); } catch { /* 环境不支持 longtask 条目：性能探针降级 */ }
  const frameObserver = typeof PerformanceObserver === 'function'
    ? new PerformanceObserver(list => list.getEntries().forEach(entry => longAnimationFrames.push({
      duration: +entry.duration.toFixed(1),
      renderMs: +(entry.duration - (entry.renderStart - entry.startTime)).toFixed(1),
      layoutMs: +(entry.duration - (entry.styleAndLayoutStart - entry.startTime)).toFixed(1),
      scripts: entry.scripts?.slice(0, 2).map(script => [script.invoker, +script.duration.toFixed(1)]),
    })))
    : null;
  try { frameObserver?.observe({ type: 'long-animation-frame', buffered: false }); } catch { /* 环境不支持 LoAF 条目：性能探针降级 */ }
  const probe = { frame: 0, observer, frameObserver };
  photoFpsProbe = probe;
  const tick = now => {
    if (photoFpsProbe !== probe || (requireOpen && !isCardPageOpen())) return;
    const gap = now - previous;
    gaps.push(gap);
    if (gap > 20) slowFrames.push([+(now - started).toFixed(0), +gap.toFixed(1)]);
    previous = now;
    if (now - started < duration) { probe.frame = requestAnimationFrame(tick); return; }
    const sorted = [...gaps].sort((a, b) => a - b);
    console.info('[photo-fps]', JSON.stringify({
      label,
      fps: +(gaps.length * 1000 / (now - started)).toFixed(1),
      frameP95: +sorted[Math.floor(sorted.length * .95)].toFixed(1),
      frameMax: +sorted[sorted.length - 1].toFixed(1),
      over8ms: gaps.filter(gap => gap > 8.33).length,
      over20ms: gaps.filter(gap => gap > 20).length,
      longTasks: longTasks.length,
      longTaskMax: +Math.max(0, ...longTasks).toFixed(1),
      longAnimationFrames: longAnimationFrames.slice(0, 8),
      slowFrames,
      frames: gaps.length,
      visible: document.visibilityState,
    }));
    stopPhotoFpsProbe();
  };
  probe.frame = requestAnimationFrame(tick);
}

// 打开页面时清掉上一轮的稳定态采样定时器（原 renderCardLibrary / closeLibPage 内的 clearTimeout）
function clearPhotoFpsSettledTimer() {
  clearTimeout(photoFpsSettledTimer);
}

// 开库 1.8s 后若仍停留在照相馆页内，再采一段 settled-idle 稳定态帧率
function scheduleSettledPhotoFps() {
  if (!photoFpsEnabled) return;
  clearTimeout(photoFpsSettledTimer);
  photoFpsSettledTimer = setTimeout(() => {
    if (isCardPageOpen()) samplePhotoFps('settled-idle', 3500);
  }, 1800);
}

export {
  photoFpsEnabled,
  stopPhotoFpsProbe,
  samplePhotoFps,
  clearPhotoFpsSettledTimer,
  scheduleSettledPhotoFps,
};
