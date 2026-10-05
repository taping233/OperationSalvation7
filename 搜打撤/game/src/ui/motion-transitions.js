/* ui.motion-transitions.js —— T4 全界面开合成对动画（D9-T4）装载器。
 * 职责：向 document.head 注入 css/motion-transitions.css 的 <link>——
 * index.html 静态 link 不可编辑（在途属地），运行时注入保证新样式恒位于
 * winter.css 等全部静态样式之后生效（Vite dev 直接引用源路径，build 经
 * new URL 资产管线重写 hash 文件名）。
 * 2026-10-04 增补：链式接入页面转场三件套编排（T1/T3 闸门）、D10 通讯演出
 * （comm-feed，?commDemo=1 演示）。本文件对 overlay.js 保持纯副作用。
 * 【10-04 老板令撤回】D13 首页排版重做（title-relayout）已下线移除。 */
import './transitions-director.js';

const HREF = new URL('../../css/motion-transitions.css', import.meta.url).href;

if (typeof document !== 'undefined' && !document.querySelector('link[data-motion-transitions]')) {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = HREF;
  link.dataset.motionTransitions = '1';
  document.head.appendChild(link);
}
