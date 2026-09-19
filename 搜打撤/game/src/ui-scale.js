/* ============================================================
 * ui-scale.js —— 全局 UI 等比缩放（2026-09-19）
 *
 * 以 1920×1080 为设计基准：先按视口等比适配；低于可读性下限时不再继续缩小。
 * zoom 挂 <html>：一次生效全部 DOM——flex 布局照常铺满窗口、文字按缩放后尺寸
 * 重排渲染不糊、浏览器自动换算事件坐标；media query 仍按真实视口判定不受影响。
 *
 * 小窗策略：MIN_ZOOM=0.85。窗口不足基准尺寸时保留至少 85% 的设计字号/控件，
 * html zoom 的额外宽高交给 100%/flex/grid/滚动容器消化（不强行裁切或加横向滚动）。
 * 因此基准 16px 正文有效下限约 13.6px，常用 44px 交互控件有效下限约 37px；
 * 低于此窗口仍可能需要浏览器自身缩放或滚动，这是可读性优先的明确取舍。
 *
 * 两套坐标口径（zoom≠1 时差 zoom 倍，混用必错位）：
 *   视口坐标 = e.clientX/Y、getBoundingClientRect()（显示位置）
 *   布局坐标 = style.left/top、transform、canvas 内部绘制（zoom 缩放前的值）
 * 凡「读显示坐标、写布局坐标」处一律经 rect()/pt() 换算；rect 对 rect 的纯比值
 * （缩放比、相对位移比例）两头抵消无需换算。
 * ============================================================ */
import SDT from './sdt-facade.js';

const BASE_W = 1920, BASE_H = 1080;
const MIN_ZOOM = 0.85;
let z = 1;

/**
 * Return the CSS zoom for a viewport without reading global browser state.
 * At/above the reference resolution the old fit-to-window behaviour remains;
 * below it, the readability floor intentionally leaves a larger CSS layout
 * viewport inside the same physical window.
 */
function scaleForViewport(width, height) {
  const w = Number(width), h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  return Math.max(MIN_ZOOM, Math.min(w / BASE_W, h / BASE_H));
}

function apply() {
  const fit = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H);
  z = scaleForViewport(window.innerWidth, window.innerHeight);
  // CSS can afford larger typography/control hit areas only while the floor is
  // active; keeping this state explicit avoids changing the 1920x1080 layout.
  document.documentElement.toggleAttribute('data-ui-scale-floor', Number.isFinite(fit) && fit > 0 && fit < MIN_ZOOM);
  document.documentElement.style.zoom = z === 1 ? '' : String(z);
}
apply();
window.addEventListener('resize', apply);

/* 元素矩形：视口坐标 → 布局坐标（zoom 抵消后即 CSS 布局值） */
function rect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left / z, top: r.top / z, width: r.width / z, height: r.height / z, right: r.right / z, bottom: r.bottom / z };
}
/* 视口坐标点 → 布局坐标点 */
function pt(x, y) { return { x: x / z, y: y / z }; }
/* 当前缩放系数 */
function scale() { return z; }

SDT.UiScale = { rect, pt, scale, apply, scaleForViewport };
export { rect, pt, scale, apply, scaleForViewport, BASE_W, BASE_H, MIN_ZOOM };
