import { describe, expect, it } from 'vitest';
import { summarizePerfSample } from '../game/src/core/perf-probe.local.js';

describe('Vite 页面探针汇总', () => {
  it('分别报告 rAF 帧间隔、同步绘制耗时和长任务', () => {
    const result = summarizePerfSample({
      mode: 'pan', elapsed: 1000, gaps: [10, 10, 20, 30], draws: [1, 2, 9],
      longTasks: [55, 70], viewport: { cssWidth: 1280, cssHeight: 720, dpr: 1 }, loopTicks: 5,
    });
    expect(result.frameP95Ms).toBe(30);
    expect(result.over20msPercent).toBe(25);
    expect(result.drawP95Ms).toBe(9);
    expect(result.drawHz).toBe(3);
    expect(result.longTaskMaxMs).toBe(70);
  });

  it('空闲零绘制保留 null 耗时，不伪造为零毫秒绘制', () => {
    const result = summarizePerfSample({
      mode: 'idle', elapsed: 1000, gaps: [16, 17], draws: [], longTasks: [], viewport: {}, loopTicks: 4,
    });
    expect(result.drawCalls).toBe(0);
    expect(result.drawP95Ms).toBeNull();
    expect(result.drawMaxMs).toBeNull();
  });
});
