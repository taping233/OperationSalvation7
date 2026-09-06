/* ============================================================
 * renderer.fx.js —— 渲染特效状态与绘制
 *
 * 从 renderer.js 拆出：FX 队列（飘字 / 落点脉冲 / 震屏）、震屏偏移
 * 计算与特效层绘制。SDT.FX 仍在渲染器模块组求值阶段挂载，
 * 早于 game.session.js 顶层读取，导入顺序不可移到其后。
 * ============================================================ */
const SDT = window.SDT;
const TAU = Math.PI * 2;
const T0 = SDT.MAP.tile;   // 缩放基准单位（特效尺寸用）

  // ---------- FX：飘字 / 落点脉冲 / 震屏 ----------
  const FX = {
    floats: [], pulses: [], shakes: [],
    // v0.22：飘字加大加久（结算反馈要一眼看清，不能一闪而过）
    float(text, wx, wy, color, big) {
      this.floats.push({ text, x: wx + (Random.random('visual') - 0.5) * 10, y: wy,
        color, big: !!big, t0: -1, dur: big ? 2.1 : 1.7 });
    },
    pulse(wx, wy, color) { this.pulses.push({ x: wx, y: wy, color, t0: -1, dur: 0.55 }); },
    shake(power, dur) { this.shakes.push({ power, dur, t0: -1 }); },
    clear() { this.floats.length = 0; this.pulses.length = 0; this.shakes.length = 0; },
  };
  SDT.FX = FX;

  // ---------- FX 渲染（脉冲 / 飘字 / 震屏偏移） ----------
  function shakeOffset(t) {
    let dx = 0, dy = 0;
    for (let i = FX.shakes.length - 1; i >= 0; i--) {
      const s = FX.shakes[i];
      if (s.t0 < 0) s.t0 = t;
      const k = (t - s.t0) / s.dur;
      if (k >= 1) { FX.shakes.splice(i, 1); continue; }
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
      if (k >= 1) { FX.pulses.splice(i, 1); continue; }
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
      if (k >= 1) { FX.floats.splice(i, 1); continue; }
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
