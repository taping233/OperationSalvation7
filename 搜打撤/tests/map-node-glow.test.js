import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshReduceMotion } from '../game/src/core/motion.js';
import { noteGlowPulse, glowPulse, GLOW_BREATH_S } from '../game/src/core/map-node-glow.js';
import { drawMapNodeBadge } from '../game/src/core/map-node-art.js';

const mockCtx = () => {
  const gradient = { addColorStop: vi.fn() };
  return {
    gradient,
    createRadialGradient: vi.fn(() => gradient),
    save: vi.fn(), restore: vi.fn(), beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(),
    stroke: vi.fn(), moveTo: vi.fn(), lineTo: vi.fn(), fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    globalAlpha: 1,
  };
};

afterEach(() => {
  localStorage.removeItem('sdt-reduce-motion');
  refreshReduceMotion();
});

describe('当前/可达节点辉光呼吸窗口', () => {
  it('振幅从 1 线性收束到 0，窗口外与起点前恒为 0', () => {
    noteGlowPulse(100);
    expect(glowPulse(100)).toBe(1);
    expect(glowPulse(100 + GLOW_BREATH_S / 2)).toBeCloseTo(0.5);
    expect(glowPulse(100 + GLOW_BREATH_S)).toBe(0);
    expect(glowPulse(100 + GLOW_BREATH_S * 3)).toBe(0);
    expect(glowPulse(50)).toBe(1); // 起点前按满振幅钳制（game.time 单调时实际不会出现）
  });

  it('reduce-motion 下不重开呼吸窗口，振幅恒 0（静态辉光）', () => {
    localStorage.setItem('sdt-reduce-motion', '1');
    refreshReduceMotion();
    noteGlowPulse(100);
    expect(glowPulse(100)).toBe(0);
    expect(glowPulse(100.5)).toBe(0);
  });

  it('current 与 legal 状态绘制辉光光晕，known 状态不绘制', () => {
    const current = mockCtx(), legal = mockCtx(), known = mockCtx();
    drawMapNodeBadge(current, 'blank', '当前营地', 'current', { time: 3, pulse: 1 });
    drawMapNodeBadge(legal, 'blank', '废墟', 'legal', { time: 3, pulse: 1 });
    drawMapNodeBadge(known, 'blank', '远处', 'known', { time: 3, pulse: 0 });
    expect(current.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(legal.createRadialGradient).toHaveBeenCalledTimes(1);
    expect(known.createRadialGradient).not.toHaveBeenCalled();
    // current 光晕半径大于 legal，青色系着色
    const [ , , rCurrent ] = current.createRadialGradient.mock.calls[0];
    const [ , , rLegal ] = legal.createRadialGradient.mock.calls[0];
    expect(rCurrent).toBeGreaterThan(rLegal);
    expect(current.gradient.addColorStop.mock.calls[0][0]).toBe(0);
  });

  it('pulse=0 时仍保留静态辉光（窗口收束后寻路标记不消失）', () => {
    const ctx = mockCtx();
    drawMapNodeBadge(ctx, 'blank', '当前营地', 'current', { time: 9, pulse: 0 });
    expect(ctx.createRadialGradient).toHaveBeenCalledTimes(1);
    const [ , , rStatic ] = ctx.createRadialGradient.mock.calls[0];
    const breathing = mockCtx();
    drawMapNodeBadge(breathing, 'blank', '当前营地', 'current', { time: 9, pulse: 1 });
    const [ , , rBreath ] = breathing.createRadialGradient.mock.calls[0];
    expect(rBreath).toBeGreaterThanOrEqual(rStatic);
  });
});
