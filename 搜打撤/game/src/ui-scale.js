/* ============================================================
 * ui-scale.js —— 全局 UI 等比缩放（2026-09-19）
 *
 * 以 1920×1080 为设计基准：zoom = min(视口宽/1920, 视口高/1080)，完全跟随不设限。
 * zoom 挂 <html>：一次生效全部 DOM——flex 布局照常铺满窗口、文字按缩放后尺寸
 * 重排渲染不糊、浏览器自动换算事件坐标；media query 仍按真实视口判定不受影响。
 *
 * 两套坐标口径（zoom≠1 时差 zoom 倍，混用必错位）：
 *   视口坐标 = e.clientX/Y、getBoundingClientRect()（显示位置）
 *   布局坐标 = style.left/top、transform、canvas 内部绘制（zoom 缩放前的值）
 * 凡「读显示坐标、写布局坐标」处一律经 rect()/pt() 换算；rect 对 rect 的纯比值
 * （缩放比、相对位移比例）两头抵消无需换算。
 * ============================================================ */
import SDT from './sdt-facade.js';

const BASE_W = 1920, BASE_H = 1080;
let z = 1;

function apply() {
  z = Math.min(window.innerWidth / BASE_W, window.innerHeight / BASE_H) || 1;
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

SDT.UiScale = { rect, pt, scale, apply };
export { rect, pt, scale, apply };
