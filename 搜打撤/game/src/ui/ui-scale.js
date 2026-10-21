// @ts-check
/* ============================================================
 * ui-scale.js —— 全局 UI 等比缩放（2026-09-19）
 *
 * 以 1920×1080 为设计基准，按视口宽高比例的较小值统一缩放全部元素。
 * 固定 1920×1080 横屏布局，zoom 挂 <html> 统一缩放，窗口多余区域留边。
 * 页面不按窗口宽高重排；文字、按钮、地图和弹层共用同一缩放系数。
 *
 * 不设小窗缩放下限，也不单独放大文字或按钮；不提供竖屏布局。
 *
 * 两套坐标口径（zoom≠1 时差 zoom 倍，混用必错位）：
 *   视口坐标 = e.clientX/Y、getBoundingClientRect()（显示位置）
 *   布局坐标 = style.left/top、transform、canvas 内部绘制（zoom 缩放前的值）
 * 凡「读显示坐标、写布局坐标」处一律经 rect() 换算；rect 对 rect 的纯比值
 * （缩放比、相对位移比例）两头抵消无需换算。
 * ============================================================ */
import SDT from '../core/sdt-facade.js';

const BASE_W = 1920, BASE_H = 1080;
let z = 1;

/**
 * Return the CSS zoom for a viewport without reading global browser state.
 * @param {number} width  视口宽（CSS 像素；非法值按 1 处理）
 * @param {number} height  视口高（CSS 像素）
 * @returns {number} 全部元素共用的等比缩放系数
 */
function scaleForViewport(width, height) {
  const w = Number(width), h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return 1;
  return Math.min(w / BASE_W, h / BASE_H);
}

/** 把当前视口的统一缩放写入 <html>，无返回值。 */
function apply() {
  z = scaleForViewport(window.innerWidth, window.innerHeight);
  document.documentElement.dataset.gameLayout = 'landscape';
  document.documentElement.style.setProperty('--game-layout-width', `${BASE_W}px`);
  document.documentElement.style.setProperty('--game-layout-height', `${BASE_H}px`);
  document.documentElement.style.zoom = z === 1 ? '' : String(z);
}
apply();
window.addEventListener('resize', apply);

/* 元素矩形：视口坐标 → 布局坐标（zoom 抵消后即 CSS 布局值） */
/**
 * @param {Element} el  任意 DOM 元素
 * @returns {{left: number, top: number, width: number, height: number, right: number, bottom: number}} 布局坐标矩形
 */
function rect(el) {
  const r = el.getBoundingClientRect();
  return { left: r.left / z, top: r.top / z, width: r.width / z, height: r.height / z, right: r.right / z, bottom: r.bottom / z };
}
/* 当前缩放系数 */
/** @returns {number} 当前全局缩放系数 */
function scale() { return z; }

/** @returns {{width: number, height: number}} 游戏横屏画面的显示尺寸（CSS 像素），不含留边。 */
function viewport() { return { width: BASE_W * z, height: BASE_H * z }; }

export const UiScale = SDT.UiScale = { rect, scale, viewport, apply, scaleForViewport };
export { rect, scale, viewport, apply, scaleForViewport, BASE_W, BASE_H };
