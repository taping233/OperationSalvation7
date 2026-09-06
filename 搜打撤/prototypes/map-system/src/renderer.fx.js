/* ============================================================
 * renderer.fx.js —— 渲染特效状态与绘制
 *
 * 从 renderer.js 拆出：FX 队列（飘字 / 落点脉冲 / 震屏）、震屏偏移
 * 计算与特效层绘制。SDT.FX 仍在渲染器模块组求值阶段挂载，
 * 早于 game.session.js 顶层读取，导入顺序不可移到其后。
 * ============================================================ */
import { Random } from './random.js';
const SDT = window.SDT;
const TAU = Math.PI * 2;
const T0 = SDT.MAP.tile;   // 缩放基准单位（特效尺寸用）

  // ---------- FX：飘字 / 落点脉冲 / 震屏 ----------
  const reduceShake = () => {
    try { return localStorage.getItem('sdt-reduce-shake') === '1'; } catch (e) { return false; }
  };
  // 反馈三档预设（game-feel）：震动/顿帧只按事件重要度触发，反馈必须回落到静止态
  const TIERS = {
    small:  { shake: 0, stop: null },
    medium: { shake: 5, stop: null },
    large:  { shake: 9, stop: [70, 0.12] },   // [毫秒, 冻结时的 timeScale]
  };
  // 对象池（performance-optimization）：战斗高频飘字/脉冲/震屏复用对象，避免逐帧 GC
  const pool = { floats: [], pulses: [], shakes: [] };
  const acquire = kind => pool[kind].pop() || {};
  const release = (kind, obj) => pool[kind].push(obj);
  const FX = {
    floats: [], pulses: [], shakes: [],
    timeScale: 1,   // hit-stop 用：主循环把 dt 乘上它；恢复走真实时间 setTimeout
    // v0.22：飘字加大加久（结算反馈要一眼看清，不能一闪而过）
    float(text, wx, wy, color, big) {
      const f = acquire('floats');
      f.text = text; f.x = wx + (Random.random('visual') - 0.5) * 10; f.y = wy;
      f.color = color; f.big = !!big; f.t0 = -1; f.dur = big ? 2.1 : 1.7;
      this.floats.push(f);
    },
    pulse(wx, wy, color) {
      const p = acquire('pulses');
      p.x = wx; p.y = wy; p.color = color; p.t0 = -1; p.dur = 0.55;
      this.pulses.push(p);
    },
    shake(power, dur) {
      if (reduceShake()) return;   // 无障碍：减少屏幕震动（顿帧/音效/飘字保留）
      const s = acquire('shakes');
      s.power = power; s.dur = dur; s.t0 = -1;
      this.shakes.push(s);
    },
    // 顿帧：短暂冻结世界（真实时间恢复；每次 impact 只触发一次，勿逐帧调用）
    hitStop(ms, scale) {
      if (this._stopTimer) return;
      this.timeScale = scale;
      this._stopTimer = setTimeout(() => { this.timeScale = 1; this._stopTimer = null; }, ms);
    },
    // 三档反馈捆绑：飘字 + 震动 + 顿帧（+可选音效）。tier: 'small' | 'medium' | 'large'
    feedback(wx, wy, { text, color, big, tier = 'medium', sfx } = {}) {
      const t = TIERS[tier] || TIERS.medium;
      if (text) this.float(text, wx, wy, color, big);
      if (t.shake) this.shake(t.shake, 0.35);
      if (t.stop) this.hitStop(t.stop[0], t.stop[1]);
      if (sfx && SDT.Sound) SDT.Sound.sfx(sfx);
    },
    clear() {
      this.floats.forEach(f => release('floats', f)); this.floats.length = 0;
      this.pulses.forEach(p => release('pulses', p)); this.pulses.length = 0;
      this.shakes.forEach(s => release('shakes', s)); this.shakes.length = 0;
    },
  };
  SDT.FX = FX;

  // ---------- FX 渲染（脉冲 / 飘字 / 震屏偏移） ----------
  function shakeOffset(t) {
    let dx = 0, dy = 0;
    for (let i = FX.shakes.length - 1; i >= 0; i--) {
      const s = FX.shakes[i];
      if (s.t0 < 0) s.t0 = t;
      const k = (t - s.t0) / s.dur;
      if (k >= 1) { release('shakes', FX.shakes[i]); FX.shakes[i] = FX.shakes[FX.shakes.length - 1]; FX.shakes.pop(); continue; }
      const d = s.power * (1 - k);
      dx += Math.sin(t * 93) * d;
      dy += Math.cos(t * 81) * d;
    }
    return [dx, dy];
  }

  function drawFX(ctx, game) {
    const z = game.cam.zoom, t = game.time;
    // 落点脉冲
    for (let i = FX.pulses.length - 1; i >= 0; i--) {
      const p = FX.pulses[i];
      if (p.t0 < 0) p.t0 = t;
      const k = (t - p.t0) / p.dur;
      if (k >= 1) { release('pulses', FX.pulses[i]); FX.pulses[i] = FX.pulses[FX.pulses.length - 1]; FX.pulses.pop(); continue; }
      ctx.save();
      ctx.strokeStyle = p.color;
      ctx.globalAlpha = (1 - k) * 0.85;
      ctx.lineWidth = 2.5 / z * (1 - k * 0.5);
      ctx.beginPath(); ctx.arc(p.x, p.y, T0 * (0.3 + k * 0.75), 0, TAU); ctx.stroke();
      ctx.globalAlpha = (1 - k) * 0.22;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, T0 * (0.3 + k * 0.75), 0, TAU); ctx.fill();
      ctx.restore();
    }
    // 飘字
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let i = FX.floats.length - 1; i >= 0; i--) {
      const f = FX.floats[i];
      if (f.t0 < 0) f.t0 = t;
      const k = (t - f.t0) / f.dur;
      if (k >= 1) { release('floats', FX.floats[i]); FX.floats[i] = FX.floats[FX.floats.length - 1]; FX.floats.pop(); continue; }
      const ease = 1 - Math.pow(1 - k, 3);
      ctx.font = `800 ${(f.big ? 26 : 19) / z}px "Cascadia Code","Noto Sans SC Sub","Microsoft YaHei",sans-serif`;
      ctx.globalAlpha = k > 0.72 ? (1 - k) / 0.28 : 1;
      const y = f.y - T0 * (0.5 + ease * 0.95);
      ctx.lineWidth = 5.5 / z;
      ctx.strokeStyle = 'rgba(5,8,12,0.85)';
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, y);
    }
    ctx.restore();
  }

export { FX, shakeOffset, drawFX };
