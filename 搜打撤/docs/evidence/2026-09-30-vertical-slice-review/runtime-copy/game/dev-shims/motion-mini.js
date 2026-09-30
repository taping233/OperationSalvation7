/* dev-serve 专用动画 shim（正式构建由 vite 打包 motion/mini）：
   把 motion 常用的 x/y/scale/opacity 关键帧映射到原生 WAAPI。 */
const toFrames = (kf) => {
  const out = {};
  if (kf.opacity != null) out.opacity = kf.opacity;
  const x = kf.x, y = kf.y, sc = kf.scale;
  if (x != null || y != null || sc != null) {
    const len = Math.max(
      Array.isArray(x) ? x.length : 1,
      Array.isArray(y) ? y.length : 1,
      Array.isArray(sc) ? sc.length : 1,
    );
    const frames = [];
    for (let i = 0; i < len; i++) {
      const xv = Array.isArray(x) ? x[i] : x;
      const yv = Array.isArray(y) ? y[i] : y;
      const sv = Array.isArray(sc) ? sc[i] : sc;
      frames.push(`translate(${xv || 0}px, ${yv || 0}px) scale(${sv == null ? 1 : sv})`);
    }
    out.transform = frames;
  }
  return out;
};
export function animate(element, keyframes, options = {}) {
  if (!element || typeof element.animate !== 'function') return { finished: Promise.resolve() };
  const frames = toFrames(keyframes || {});
  const keys = Object.keys(frames);
  if (!keys.length) return { finished: Promise.resolve() };
  const n = Math.max(...keys.map(k => (Array.isArray(frames[k]) ? frames[k].length : 1)));
  const norm = {};
  keys.forEach(k => { norm[k] = Array.isArray(frames[k]) ? frames[k] : Array(n).fill(frames[k]); });
  const ease = Array.isArray(options.ease) ? `cubic-bezier(${options.ease.join(',')})` : (options.ease || 'ease-out');
  const anim = element.animate(norm, {
    duration: (options.duration || 0.3) * 1000,
    delay: (options.delay || 0) * 1000,
    easing: ease,
    fill: 'both',
  });
  return { finished: anim.finished.catch(() => {}) };
}
export default { animate };
