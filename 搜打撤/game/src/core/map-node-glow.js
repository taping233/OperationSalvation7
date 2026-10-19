import { getPerformanceSettings } from './performance-settings.js';
// map-node-glow.js —— 当前/可前往节点辉光的呼吸窗口驱动。
// 口径同 map-reveals：呼吸窗口内保持 renderScheduler 失效，播完回归「空闲地图零绘制」；
// 相位用 game.time（主循环逻辑时钟，秒），hit-stop 冻结时辉光同步冻结。
// 窗口结束后辉光收束为静态常驻（寻路可读性），不保留持续重绘。
import { renderScheduler } from './render-scheduler.js';
import { reduceMotion } from './motion.js';

/** 呼吸窗口时长（game.time 秒）；之后振幅归零、画面回静态 */
export const GLOW_BREATH_S = 5.5;
/** 本轮呼吸起点（game.time 秒）；null=从未触发 */
let startedAt = null;
/** 驱动器失效截止（performance.now 毫秒） */
let stopAt = 0;
let driving = false;

/** 当前/可达集合变化时调用：重开呼吸窗口并驱动失效；reduce-motion 下只留静态辉光 */
export function noteGlowPulse(time) {
  if (reduceMotion() || getPerformanceSettings().quality === 'low') return;
  startedAt = time;
  stopAt = Math.max(stopAt, performance.now() + GLOW_BREATH_S * 1000 + 250);
  if (driving || typeof requestAnimationFrame !== 'function') return;
  driving = true;
  const tick = (now) => {
    if (now < stopAt && !reduceMotion() && getPerformanceSettings().quality !== 'low') {
      renderScheduler.invalidateAnimation();
      requestAnimationFrame(tick);
    } else {
      driving = false;
      renderScheduler.invalidate();
    }
  };
  requestAnimationFrame(tick);
}

/** 呼吸振幅 1→0 线性收束；0=静态辉光。reduce-motion 或窗口外恒 0 */
export function glowPulse(time) {
  if (startedAt == null || reduceMotion() || getPerformanceSettings().quality === 'low') return 0;
  const u = Math.min(1, Math.max(0, (time - startedAt) / GLOW_BREATH_S));
  return 1 - u;
}
