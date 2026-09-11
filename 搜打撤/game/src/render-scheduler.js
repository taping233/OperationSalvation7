import { sdtDefine } from './sdt-facade.js';
class RenderScheduler {
  constructor({ activeFps = 120, idleFps = 60 } = {}) {
    this.activeInterval = 1000 / activeFps;
    this.idleInterval = 1000 / idleFps;
    this.lastDraw = -Infinity;
    this.nextDraw = -Infinity;
    this.interval = null;
    this.dirty = true;
  }

  invalidate() { this.dirty = true; }

  shouldDraw(now, { covered = false, active = false } = {}) {
    if (covered) return false;
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
// active 全速 120（掷骰/移动/战斗/棋盘待机动画），idle 60 兜底标题等非对局画面。
const renderScheduler = new RenderScheduler({ activeFps: 120, idleFps: 60 });
sdtDefine('RenderScheduler', renderScheduler);

export { RenderScheduler, renderScheduler };
