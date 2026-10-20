import { afterEach, describe, expect, it, vi } from 'vitest';
import { createKoiPond } from '../game/src/hub/courtyard-vendor/KoiPond.js';

const BODY_COLORS = ['#e6dfce', '#dddcd0', '#ceb578', '#c46c51'];
function canvasHarness(width = 1000, height = 600, options = {}) {
  let seed = 89471;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  let matrix = [1, 0, 0, 1, 0, 0], path = [], stack = [];
  const frames = { fills: [], strokes: [], clears: 0 };
  const point = (x, y) => [matrix[0] * x + matrix[2] * y + matrix[4], matrix[1] * x + matrix[3] * y + matrix[5]];
  const command = (name, values) => path.push({ name, values, points: Array.from({ length: values.length / 2 }, (_, i) => point(values[i * 2], values[i * 2 + 1])) });
  const ctx = {
    fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    clearRect() { frames.fills = []; frames.strokes = []; frames.clears++; },
    save() { stack.push({ matrix: [...matrix], fill: this.fillStyle, stroke: this.strokeStyle, alpha: this.globalAlpha, line: this.lineWidth }); },
    restore() { const state = stack.pop(); matrix = state.matrix; this.fillStyle = state.fill; this.strokeStyle = state.stroke; this.globalAlpha = state.alpha; this.lineWidth = state.line; },
    translate(x, y) { const translated = point(x, y); matrix[4] = translated[0]; matrix[5] = translated[1]; },
    rotate(angle) {
      const [a, b, c, d] = matrix, cos = Math.cos(angle), sin = Math.sin(angle);
      matrix[0] = a * cos + c * sin; matrix[1] = b * cos + d * sin;
      matrix[2] = c * cos - a * sin; matrix[3] = d * cos - b * sin;
    },
    scale(x, y) { matrix[0] *= x; matrix[1] *= x; matrix[2] *= y; matrix[3] *= y; },
    beginPath() { path = []; },
    moveTo(...values) { command('move', values); },
    lineTo(...values) { command('line', values); },
    quadraticCurveTo(...values) { command('quadratic', values); },
    bezierCurveTo(...values) { command('bezier', values); },
    arc(x, y, radius) { path.push({ name: 'arc', values: [x, y, radius], points: [point(x, y)] }); },
    closePath() { path.push({ name: 'close', values: [], points: [] }); },
    clip() {},
    fill() { frames.fills.push({ style: this.fillStyle, alpha: this.globalAlpha, matrix: [...matrix], path }); },
    stroke() { frames.strokes.push({ style: this.strokeStyle, width: this.lineWidth, matrix: [...matrix], path }); },
  };
  const pond = createKoiPond({ width, height, getContext: () => ctx }, { random, ...options });
  return { pond, frames, bodies: () => frames.fills.filter(fill => BODY_COLORS.includes(fill.style)),
    food: () => frames.fills.filter(fill => fill.style === '#d7aa66'),
    ripples: () => frames.strokes.filter(stroke => stroke.style.startsWith('rgba(225,237,218,')) };
}
const positions = harness => harness.bodies().map(body => ({ x: body.matrix[4], y: body.matrix[5] }));
const averageDistance = (points, x, y) => points.reduce((total, p) => total + Math.hypot(p.x - x, p.y - y), 0) / points.length;

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('锦鲤连续画法与有界模拟', () => {
  it('每条鱼为连续闭合曲线，池宽比例受控；不自行创建循环或监听', () => {
    const raf = vi.fn(), listener = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf); vi.stubGlobal('addEventListener', listener);
    const h = canvasHarness(); h.pond.render(0, false);
    expect(h.bodies()).toHaveLength(9);
    for (const body of h.bodies()) {
      expect(body.path.filter(p => p.name === 'quadratic')).toHaveLength(14);
      expect(body.path.at(-1).name).toBe('close');
      const length = Math.hypot(body.matrix[0], body.matrix[1]);
      expect(length).toBeGreaterThanOrEqual(36); expect(length).toBeLessThanOrEqual(54);
    }
    expect(h.frames.strokes.every(stroke => stroke.width < 1)).toBe(true);
    expect(raf).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
  });
  it('静态绘制保持鱼身、食物与涟漪状态；大时间步受限', () => {
    const h = canvasHarness(); h.pond.tap(500, 300); h.pond.render(0, false);
    const still = structuredClone(h.frames);
    h.pond.render(60, false);
    expect(h.frames.fills).toEqual(still.fills); expect(h.frames.strokes).toEqual(still.strokes);
    const before = positions(h); h.pond.render(60, true);
    const after = positions(h);
    after.forEach((p, i) => expect(Math.hypot(p.x - before[i].x, p.y - before[i].y)).toBeLessThan(1.5));
  });
  it('缩放保留相对位置，并同步鱼身比例；极小与无效尺寸不产生非有限坐标', () => {
    const h = canvasHarness(); h.pond.render(0, false); const before = positions(h);
    h.pond.resize(500, 300); h.pond.render(0, false);
    positions(h).forEach((p, i) => { expect(p.x).toBeCloseTo(before[i].x / 2); expect(p.y).toBeCloseTo(before[i].y / 2); });
    h.bodies().forEach(body => expect(Math.hypot(body.matrix[0], body.matrix[1])).toBeLessThanOrEqual(27));
    h.pond.resize(1, 1); h.pond.resize(NaN, Infinity); h.pond.render(0.05);
    for (const fill of h.frames.fills) for (const item of fill.path) for (const p of item.points) expect(p.every(Number.isFinite)).toBe(true);
  });
  it('鱼群缓慢趋近投喂点，边缘投喂同样限制在岸内安全区', () => {
    const h = canvasHarness(); h.pond.render(0, false);
    const before = averageDistance(positions(h), 500, 300); h.pond.tap(500, 300);
    for (let i = 0; i < 80; i++) h.pond.render(0.05);
    expect(averageDistance(positions(h), 500, 300)).toBeLessThan(before * 0.92);
    h.pond.tap(-100, 1200); h.pond.render(0, false);
    const edgeFood = h.food().at(-1).path[0].points[0];
    expect(edgeFood[0]).toBeGreaterThan(100); expect(edgeFood[1]).toBeLessThan(540);
  });
  it('持续投喂、吃食与闲游不积累：食物和包括吃食在内的涟漪各最多 24 个，最终消散', () => {
    const h = canvasHarness();
    for (let i = 0; i < 700; i++) {
      h.pond.tap(500 + Math.sin(i) * 240, 300 + Math.cos(i) * 150);
      h.pond.render(0.05);
      expect(h.food().length).toBeLessThanOrEqual(24); expect(h.ripples().length).toBeLessThanOrEqual(24);
      let outOfBounds = null;
      for (const body of h.bodies()) for (const item of body.path) for (const [x, y] of item.points) {
        if (!Number.isFinite(x) || x < 100 || x > 900 || !Number.isFinite(y) || y < 60 || y > 540) {
          outOfBounds = { frame:i, x, y };
          break;
        }
      }
      expect(outOfBounds).toBeNull();
    }
    for (let i = 0; i < 330; i++) h.pond.render(0.05);
    expect(h.food()).toHaveLength(0); expect(h.ripples()).toHaveLength(0);
  });
  it('吃食确实消耗食物，新增吃食涟漪在交互已满时仍遵守 24 个上限', () => {
    const h = canvasHarness(); h.pond.render(0, false); const fish = positions(h)[0];
    for (let i = 0; i < 24; i++) h.pond.tap(fish.x, fish.y);
    h.pond.render(0.05); h.pond.render(0, false);
    expect(h.food().length).toBeLessThan(24); expect(h.ripples()).toHaveLength(24);
  });
  it('划过九条鱼逐条发现，同一条不重复计数；吃食计数只在实际吃到后变化', () => {
    const onProgress = vi.fn();
    const h = canvasHarness(1000, 600, { onProgress }); h.pond.render(0, false);
    expect(onProgress).toHaveBeenLastCalledWith({ found:0, total:9, eaten:0 });
    const fish = positions(h);
    for (const p of fish) h.pond.pointer(p.x, p.y);
    expect(onProgress).toHaveBeenLastCalledWith({ found:9, total:9, eaten:0 });
    const calls = onProgress.mock.calls.length; h.pond.pointer(fish[0].x, fish[0].y);
    expect(onProgress).toHaveBeenCalledTimes(calls);
    h.pond.tap(fish[0].x, fish[0].y); expect(onProgress).toHaveBeenCalledTimes(calls);
    h.pond.render(0.05); expect(onProgress).toHaveBeenLastCalledWith({ found:9, total:9, eaten:1 });
    h.pond.reset(); expect(onProgress).toHaveBeenLastCalledWith({ found:0, total:9, eaten:0 });
  });
  it('指针连续移动的涟漪受时间节流与数量上限约束；离开和静态不堆积', () => {
    const h = canvasHarness();
    for (let i = 0; i < 300; i++) h.pond.pointer(500, 300);
    h.pond.render(0, false); expect(h.ripples()).toHaveLength(1);
    for (let i = 0; i < 500; i++) { h.pond.pointer(500 + Math.sin(i) * 200, 300); h.pond.render(0.05); }
    expect(h.ripples().length).toBeLessThanOrEqual(24);
    h.pond.pointer(null, null);
    for (let i = 0; i < 50; i++) h.pond.render(0.05);
    expect(h.ripples()).toHaveLength(0);
  });
  it('重置清除交互并重建九条鱼；销毁幂等，后续所有接口不会重新绘制或创建鱼', () => {
    const h = canvasHarness(); h.pond.tap(500, 300); h.pond.reset(); h.pond.render(0, false);
    expect(h.bodies()).toHaveLength(9); expect(h.food()).toHaveLength(0); expect(h.ripples()).toHaveLength(0);
    h.pond.dispose(); const cleared = h.frames.clears;
    h.pond.dispose(); h.pond.reset(); h.pond.tap(500, 300); h.pond.resize(500, 300); h.pond.render(0.05);
    expect(h.frames.clears).toBe(cleared); expect(h.frames.fills).toHaveLength(0); expect(h.frames.strokes).toHaveLength(0);
  });
});


describe('锦鲤单帧身体投影复用', () => {
  it('九条鱼静态绘制的正弦调用从330降到141，绘制路径数保持不变', () => {
    const h = canvasHarness();
    const sin = vi.spyOn(Math, 'sin');
    h.pond.render(0, false);
    expect(sin).toHaveBeenCalledTimes(141);
    expect(h.bodies()).toHaveLength(9);
    expect(h.frames.fills.filter(fill => fill.style === 'rgba(40,66,65,0.16)')).toHaveLength(9);
  });
  it('左右轮廓仍等于原逐侧公式；阴影和本体共享当帧形状而不冻结后续姿态', () => {
    const h = canvasHarness(1000, 600, { random: () => 0.5 });
    h.pond.render(0, false);
    const widths = [0.035, 0.087, 0.105, 0.086, 0.052, 0.023, 0.009];
    const side = sign => widths.map((w, i) => {
      const t = i / (widths.length - 1);
      return { x: -t * 0.82, y: Math.sin(Math.PI - t * 2.8) * 0.032 * t * t + w * sign };
    });
    const points = [...side(-1), ...side(1).reverse()];
    const expected = points.map((p, i) => {
      const next = points[(i + 1) % points.length];
      return [p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2];
    });
    expect(h.bodies()[0].path.filter(p => p.name === 'quadratic').map(p => p.values)).toEqual(expected);
    const original = h.bodies()[0].path;
    h.pond.render(0.05, true);
    expect(h.bodies()[0].path).not.toEqual(original);
    const shadows = h.frames.fills.filter(fill => fill.style === 'rgba(40,66,65,0.16)');
    h.bodies().forEach((body, i) => expect(body.path.map(p => p.values)).toEqual(shadows[i].path.map(p => p.values)));
  });
});
