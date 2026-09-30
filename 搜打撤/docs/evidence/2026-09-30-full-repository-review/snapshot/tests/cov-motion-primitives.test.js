/* 覆盖缺口补测 U8（find-C-0100 #4）：core/motion-primitives 动画数学底座。
 * 数值性质契约：缓动端点/值域/单调性/对称性、弹簧过冲与收敛（与 settleMs 联动）、
 * 弧线跳跃端点落地与拱顶、衰减振荡静置与包络、全族确定性（同参恒同果）。
 * 纯时间函数零 DOM，一行 import 直测。零生产改动。 */
import { describe, expect, it } from 'vitest';
import { clamp01, decayOsc, ease, hopPoint, settleMs, spring } from '../game/src/core/motion-primitives.js';

const EPS = 1e-9;
// [0,1] 采样步长 0.01（101 点，含端点）
const SAMPLES = Array.from({ length: 101 }, (_, i) => i / 100);

describe('motion-primitives clamp01', () => {
  it('区间内恒等，区间外钳到 0/1', () => {
    expect(clamp01(-0.5)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.37)).toBe(0.37);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(2)).toBe(1);
  });
});

describe('motion-primitives ease 曲线族', () => {
  const names = Object.keys(ease);

  it('全部曲线端点精确：f(0)=0、f(1)=1', () => {
    for (const name of names) {
      expect(ease[name](0), `${name} 起点`).toBe(0);
      expect(ease[name](1), `${name} 终点`).toBe(1);
    }
  });

  it('全部曲线输出有界 [0,1] 且单调不减', () => {
    for (const name of names) {
      let prev = -Infinity;
      for (const u of SAMPLES) {
        const v = ease[name](u);
        expect(v, `${name}(${u}) 不应低于 0`).toBeGreaterThanOrEqual(-EPS);
        expect(v, `${name}(${u}) 不应超过 1`).toBeLessThanOrEqual(1 + EPS);
        expect(v, `${name} 在 u=${u} 处应单调不减`).toBeGreaterThanOrEqual(prev - EPS);
        prev = v;
      }
    }
  });

  it('对称 S（smooth/smoother/cubicInOut）：中点过半且 f(u)+f(1-u)=1', () => {
    for (const name of ['smooth', 'smoother', 'cubicInOut']) {
      expect(ease[name](0.5), `${name} 中点`).toBeCloseTo(0.5, 12);
      for (const u of SAMPLES) {
        expect(ease[name](u) + ease[name](1 - u), `${name} 对称性 u=${u}`).toBeCloseTo(1, 9);
      }
    }
  });

  it('out 系（cubicOut/quintOut）快起缓收：中点已走过半程', () => {
    expect(ease.cubicOut(0.5)).toBeCloseTo(0.875, 12);
    expect(ease.quintOut(0.5)).toBeCloseTo(0.96875, 12);
    expect(ease.linear(0.5), 'linear 恒等').toBe(0.5);
  });
});

describe('motion-primitives spring 弹簧', () => {
  it('t≤0 返回 0（受力前静止）', () => {
    const f = spring();
    expect(f(0)).toBe(0);
    expect(f(-1)).toBe(0);
  });

  it('默认参数：欠阻尼过冲后回稳，采样有界且收敛到 1', () => {
    const f = spring();
    let peak = -Infinity;
    for (let ms = 0; ms <= 1000; ms += 5) {
      const v = f(ms / 1000);
      expect(Number.isFinite(v), `t=${ms}ms 不应为 NaN/Infinity`).toBe(true);
      expect(v, `t=${ms}ms 不应为负`).toBeGreaterThanOrEqual(0);
      expect(v, `t=${ms}ms 过冲应有界`).toBeLessThanOrEqual(1.2);
      peak = Math.max(peak, v);
    }
    expect(peak, '欠阻尼应有可见过冲（默认档注释 ~8%）').toBeGreaterThan(1.03);
    expect(Math.abs(1 - f(1)), '1s 处应收敛到 1').toBeLessThan(1e-3);
  });

  it('收敛时长与 settleMs 联动：2× settle 后 |1-f| 低于 eps', () => {
    for (const params of [{}, { zeta: 0.5, omega: 10 }, { zeta: 0.62, omega: 18 }, { zeta: 0.8, omega: 24 }]) {
      const f = spring(params);
      const tSettle = settleMs(params) / 1000;
      expect(Math.abs(1 - f(tSettle)), `settle 时刻参数 ${JSON.stringify(params)} 应接近收敛`).toBeLessThan(0.05);
      expect(Math.abs(1 - f(2 * tSettle)), `2× settle 后 eps=${0.02} 内收敛`).toBeLessThan(0.02);
    }
  });

  it('阻尼比参数钳制：极端 zeta 不产生 NaN', () => {
    for (const zeta of [0, -5, 3, 100]) {
      const v = spring({ zeta, omega: 18 })(1);
      expect(Number.isFinite(v), `zeta=${zeta} 应被钳制后仍有限`).toBe(true);
    }
  });

  it('确定性：同参数恒同结果（无随机无状态）', () => {
    const f = spring({ zeta: 0.62, omega: 18 });
    expect(f(0.17)).toBe(f(0.17));
  });
});

describe('motion-primitives settleMs 收敛时长', () => {
  it('回归锚：omega=18、zeta=.62 → 351ms（源码注释「约 0.35s 收敛」）', () => {
    expect(settleMs({ zeta: 0.62, omega: 18 })).toBe(351);
  });

  it('结果为正整数毫秒', () => {
    for (const params of [{}, { zeta: 0.5, omega: 10 }, { eps: 0.05 }]) {
      const ms = settleMs(params);
      expect(Number.isInteger(ms), `参数 ${JSON.stringify(params)} 应为整数毫秒`).toBe(true);
      expect(ms).toBeGreaterThan(0);
    }
  });

  it('单调性：eps 越松越短、omega/zeta 越大越快收敛', () => {
    expect(settleMs({ eps: 0.1 })).toBeLessThan(settleMs({ eps: 0.02 }));
    expect(settleMs({ omega: 36 })).toBeLessThan(settleMs({ omega: 18 }));
    expect(settleMs({ zeta: 0.8 })).toBeLessThan(settleMs({ zeta: 0.6 }));
  });
});

describe('motion-primitives hopPoint 弧线跳跃', () => {
  const from = { x: 0, y: 0 };
  const to = { x: 100, y: 40 };

  it('端点落地：u=0 得 from、u=1 得 to（拱高项归零）', () => {
    expect(hopPoint(0, from, to)).toEqual({ x: 0, y: 0 });
    expect(hopPoint(1, from, to)).toEqual({ x: 100, y: 40 });
  });

  it('进度钳制：越界 u 兜到两端', () => {
    expect(hopPoint(-1, from, to)).toEqual({ x: 0, y: 0 });
    expect(hopPoint(2, from, to)).toEqual({ x: 100, y: 40 });
  });

  it('默认参数中点为拱顶：x 过半、y 抬升一个 height', () => {
    expect(hopPoint(0.5, from, to, { height: 120 })).toEqual({ x: 50, y: -100 }); // 40*0.5 - 120
  });

  it('height=0 退化为直线插值', () => {
    expect(hopPoint(0.5, from, to, { height: 0 })).toEqual({ x: 50, y: 20 });
  });

  it('水平分量沿曲线单调前进', () => {
    let prevX = -Infinity;
    for (const u of SAMPLES) {
      const p = hopPoint(u, from, to);
      expect(p.x, `u=${u} 的 x 应单调不减`).toBeGreaterThanOrEqual(prevX - EPS);
      prevX = p.x;
    }
  });
});

describe('motion-primitives decayOsc 接触衰减振荡', () => {
  it('静置期（t≤t0）恒为 0', () => {
    expect(decayOsc(0.1, 0.5)).toBe(0);
    expect(decayOsc(0.5, 0.5)).toBe(0);
  });

  it('受力后有界衰减：|v| ≤ amp·e^(-decay·dt) 且最终趋零', () => {
    const amp = 0.16;
    const decay = 9;
    let sawPositive = false;
    let sawNegative = false;
    for (let ms = 1; ms <= 400; ms += 1) {
      const t = ms / 1000;
      const v = decayOsc(t, 0, { amp, decay });
      expect(Math.abs(v), `t=${ms} 超出指数包络`).toBeLessThanOrEqual(amp * Math.exp(-decay * t) + EPS);
      sawPositive ||= v > 0;
      sawNegative ||= v < 0;
    }
    expect(sawPositive, '应出现正半周').toBe(true);
    expect(sawNegative, '应出现负半周（振荡变号）').toBe(true);
    expect(Math.abs(decayOsc(10, 0, { amp, decay })), '远期应衰减趋零').toBeLessThan(1e-6);
  });

  it('amp 线性缩放、确定性', () => {
    const a = decayOsc(0.03, 0, { amp: 0.32 });
    const b = decayOsc(0.03, 0, { amp: 0.16 });
    expect(a).toBeCloseTo(2 * b, 15);
    expect(decayOsc(0.03, 0)).toBe(decayOsc(0.03, 0));
  });
});
