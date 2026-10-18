/* map-reveals.js —— 战争迷雾揭示时刻登记（节点 popIn 揭示演出的共享状态）。
 * run 域（game.session.board.js 的 markSeen）差分记录新揭示节点的时刻，渲染层
 * （renderer.drawIcons）按 spring 进度对节点做放大/淡入；驱动器在揭示窗口内保持
 * renderScheduler 失效，让「空闲地图零绘制」口径下也能播完这段一次性动画。
 * 时刻用 game.time（主循环逻辑时钟，秒）而非墙钟：hit-stop 冻结时演出同步冻结。 */
import { renderScheduler } from './render-scheduler.js';
import { settleMs, spring } from './motion-primitives.js';

const REVEAL_SPRING = { zeta: 0.62, omega: 13 };
const REVEAL_SETTLE_S = settleMs({ ...REVEAL_SPRING, eps: 0.02 }) / 1000;
const progress = spring(REVEAL_SPRING);

/** key "li,idx" -> game.time（秒）；播完即卸，长局不积累 */
const revealedAt = new Map();

/** markSeen 差分出的新揭示节点登记时刻，并确保驱动器在窗口内保持重绘 */
export function noteReveal(key, time) {
  revealedAt.set(key, time);
  drive();
}

/** 节点当前揭示进度 0→1（未登记=1；已收敛的登记项就地卸载） */
export function revealProgress(key, now) {
  const t0 = revealedAt.get(key);
  if (t0 == null) return 1;
  const u = now - t0;
  if (u >= REVEAL_SETTLE_S) { revealedAt.delete(key); return 1; }
  return progress(Math.max(0, u));
}

let driving = false;
let stopAt = 0;
function drive() {
  stopAt = Math.max(stopAt, performance.now() + REVEAL_SETTLE_S * 1000 + 250);
  if (driving || typeof requestAnimationFrame !== 'function') return;
  driving = true;
  const tick = (now) => {
    if (now < stopAt) {
      renderScheduler.invalidateAnimation();
      requestAnimationFrame(tick);
    } else {
      driving = false;
      renderScheduler.invalidate();
    }
  };
  requestAnimationFrame(tick);
}
