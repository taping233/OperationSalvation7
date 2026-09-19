import { sdtDefine } from './sdt-facade.js';
class RenderScheduler {
  constructor({ activeFps = 120, idleFps = 0 } = {}) {
    this.activeInterval = 1000 / activeFps;
    this.idleInterval = idleFps > 0 ? 1000 / idleFps : Infinity;
    this.lastDraw = -Infinity;
    this.nextDraw = -Infinity;
    this.interval = null;
    this.dirty = true;
    this.wasActive = null;
    this.wake = null;
  }

  setWake(callback) {
    this.wake = typeof callback === 'function' ? callback : null;
  }

  invalidate() {
    this.dirty = true;
    this.wake?.();
  }

  shouldDraw(now, { covered = false, active = false } = {}) {
    if (covered) return false;
    const activityChanged = this.wasActive !== active;
    this.wasActive = active;
    // 空闲地图是静态画面：首次进入、活动结束的收尾帧、或输入/状态显式失效时才画。
    // 主循环仍负责逻辑计时，但不再无意义地提交 60 次整图 Canvas 绘制。
    if (!active) {
      if (!this.dirty && !activityChanged) return false;
      this.lastDraw = now;
      this.nextDraw = Infinity;
      this.interval = Infinity;
      this.dirty = false;
      return true;
    }
    const interval = active ? this.activeInterval : this.idleInterval;
    if (this.dirty || !Number.isFinite(this.nextDraw)) {
      this.lastDraw = now;
      this.nextDraw = now + interval;
      this.interval = interval;
      this.dirty = false;
      return true;
    }
    if (interval !== this.interval) {
      this.nextDraw = this.lastDraw + interval;
      this.interval = interval;
    }
    if (now < this.nextDraw - 0.5) return false;
    // Deadline 基于理想节拍推进，而不是基于晚到的实际帧重新计时。
    // 这样目标 FPS 在非整数倍刷新率屏幕上会均匀跨越刷新周期，不会持续向后漂移。
    const elapsedDeadlines = Math.max(1, Math.floor((now - this.nextDraw) / interval) + 1);
    this.nextDraw += elapsedDeadlines * interval;
    this.lastDraw = now;
    return true;
  }
}

// 120fps 目标（老板 2026-09-06）：单帧渲染实测 ~1.4ms（预算 8.33ms），余量充足；
// active 全速 120（移动/战斗），idle 由状态失效事件驱动，不持续提交静态画面。
const renderScheduler = new RenderScheduler({ activeFps: 120, idleFps: 0 });
sdtDefine('RenderScheduler', renderScheduler);

export { RenderScheduler, renderScheduler };
