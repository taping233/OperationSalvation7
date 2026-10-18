import { getPerformanceSettings, onPerformanceSettingsChange } from './performance-settings.js';
import { sdtDefine } from './sdt-facade.js';
class RenderScheduler {
  // 静态画面零绘制；有限时长动画也遵循预算，输入/状态失效立即补画。
  constructor({ activeFps = 120 } = {}) {
    this.activeInterval = 1000 / activeFps;
    this.lastDraw = -Infinity;
    this.nextDraw = -Infinity;
    this.interval = null;
    this.dirty = true;
    this.animationDirty = false;
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

  invalidateAnimation() {
    this.animationDirty = true;
    this.wake?.();
  }

  shouldDraw(now, { covered = false, active = false } = {}) {
    if (covered) return false;
    const activityChanged = this.wasActive !== active;
    this.wasActive = active;
    // 空闲地图是静态画面：首次进入、活动结束的收尾帧、或输入/状态显式失效时才画。
    // 主循环仍负责逻辑计时，但不再无意义地提交 60 次整图 Canvas 绘制。
    if (!active && !this.animationDirty) {
      if (!this.dirty && !activityChanged) return false;
      this.lastDraw = now;
      this.nextDraw = now + this.activeInterval;
      this.interval = this.activeInterval;
      this.dirty = false;
      this.animationDirty = false;
      return true;
    }
    const interval = this.activeInterval;
    if (this.dirty || (activityChanged && active) || !Number.isFinite(this.nextDraw)) {
      this.lastDraw = now;
      this.nextDraw = now + interval;
      this.interval = interval;
      this.dirty = false;
      this.animationDirty = false;
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
    this.animationDirty = false;
    return true;
  }
}

// Only draw submission is capped; simulation and direct input invalidations stay immediate.
const renderScheduler = new RenderScheduler({ activeFps: getPerformanceSettings().fps });
onPerformanceSettingsChange(({ fps }) => {
  renderScheduler.activeInterval = 1000 / fps;
  renderScheduler.invalidate();
});
sdtDefine('RenderScheduler', renderScheduler);

export { RenderScheduler, renderScheduler };
