/* ============================================================
 * renderer.fx.js —— FX 状态壳：hitStop 顿帧
 *
 * 旧版还带 2D 飘字/落点脉冲/震屏的队列与绘制；地图 3D 场景化后该套
 * 2D 特效已废弃（老板 2026-09-19 定：原特效不好看，删除不重做），
 * 只保留 hitStop——timeScale 仍被 game.boot.js 主循环消费。
 * ESM 消费者直接导入同一 FX 对象；SDT.FX 保留为页面与调试兼容入口。
 * 本模块不创建画布或访问 DOM，可由无浏览器的会话内核加载。
 * ============================================================ */
import SDT, { sdtDefine } from './sdt-facade.js';
// 反馈三档预设（game-feel）：顿帧只按事件重要度触发
const TIERS = {
  small:  { stop: null },
  medium: { stop: null },
  large:  { stop: [70, 0.12] },   // [毫秒, 冻结时的 timeScale]
};
export const FX = {
  timeScale: 1,   // hit-stop 用：主循环把 dt 乘上它；恢复走真实时间 setTimeout
  // 顿帧：短暂冻结世界（真实时间恢复；每次 impact 只触发一次，勿逐帧调用）
  hitStop(ms, scale) {
    if (this._stopTimer) return;
    this.timeScale = scale;
    this._stopTimer = setTimeout(() => { this.timeScale = 1; this._stopTimer = null; }, ms);
  },
  // 三档反馈捆绑：顿帧（+可选音效）。tier: 'small' | 'medium' | 'large'
  /** @param {number} _wx @param {number} _wy @param {{tier?:string,sfx?:string}} [options] */
  feedback(_wx, _wy, { tier = 'medium', sfx } = {}) {
    const t = TIERS[tier] || TIERS.medium;
    if (t.stop) this.hitStop(t.stop[0], t.stop[1]);
    if (sfx && SDT.Sound) SDT.Sound.sfx(sfx);
  },
};
sdtDefine('FX', FX);
