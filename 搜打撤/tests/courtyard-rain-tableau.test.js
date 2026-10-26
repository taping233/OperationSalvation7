// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createRainTableau } from '../game/src/hub/courtyard.rain-tableau.js';

const makeScene = (width = 960, height = 540, options = {}) => {
  const context = Object.fromEntries(['save', 'restore', 'setTransform', 'clearRect', 'fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'clip', 'ellipse'].map(name => [name, vi.fn()]));
  context.paints = [];
  context.fill = vi.fn(function() { this.paints.push({ color: this.fillStyle, alpha: this.globalAlpha }); });
  const canvas = { width, height, getContext: () => context };
  return { scene: createRainTableau(canvas, options), context, canvas };
};
// 以可见四边形独立判定，避免用引擎的逆投影验证引擎自身。
const inside = (point, polygon) => polygon.every((start, index) => {
  const end = polygon[(index + 1) % polygon.length];
  return (end.x - start.x) * (point.y - start.y) - (end.y - start.y) * (point.x - start.x) >= -1e-6;
});
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

describe('手绘透视雨台', () => {
  it('庭院景观模式在实际点击处泛圈，不受旧台面裁切，画布外输入不生效', () => {
    const { scene, context } = makeScene(960, 540, { sceneBackdrop:true });
    expect(scene.tap(60, 60)).toBe(true);
    const ripple = scene.getDiagnostics().ripples.at(-1);
    expect(ripple.x).toBeCloseTo(60);
    expect(ripple.y).toBeCloseTo(60);
    expect(scene.tap(-1, 60)).toBe(false);
    expect(scene.tap(60, 541)).toBe(false);
    scene.render(0, false);
    expect(context.clip).not.toHaveBeenCalled();
  });

  it('可见台面、雨滴落点与点击命中共享几何，四角边界也可命中', () => {
    const { scene } = makeScene();
    const snapshot = scene.getDiagnostics();
    const center = midpoint(snapshot.surface[0], snapshot.surface[2]);
    expect(snapshot.surface[1].x - snapshot.surface[3].x).toBeGreaterThan(snapshot.surface[2].y - snapshot.surface[0].y);
    for (const corner of snapshot.surface) expect(scene.tap(corner.x, corner.y)).toBe(true);
    for (const drop of snapshot.drops) expect(inside(drop.landing, snapshot.water)).toBe(true);
    expect(scene.tap(center.x, center.y)).toBe(true);
    const clicked = scene.getDiagnostics().ripples.at(-1);
    expect(clicked.x).toBeCloseTo(center.x); expect(clicked.y).toBeCloseTo(center.y);
    expect(scene.tap(snapshot.surface[0].x, snapshot.surface[0].y - 1)).toBe(false);
    expect(scene.tap(snapshot.surface[1].x + 1, snapshot.surface[1].y)).toBe(false);
    expect(scene.tap(center.x, snapshot.surface[2].y + 1)).toBe(false);
    expect(scene.tap(NaN, center.y)).toBe(false);
  });

  it('水圈经同一台面比例压成椭圆，画布裁切限制在水面内', () => {
    const { scene, context } = makeScene();
    scene.render(0, false);
    const snapshot = scene.getDiagnostics(), surface = snapshot.surface;
    const ratio = (surface[1].x - surface[3].x) / (surface[2].y - surface[0].y);
    expect(context.clip).toHaveBeenCalledTimes(1);
    expect(context.ellipse.mock.calls.length).toBeGreaterThan(0);
    for (const [x, y, rx, ry] of context.ellipse.mock.calls) {
      expect(inside({ x, y }, snapshot.surface)).toBe(true);
      expect(rx / ry).toBeCloseTo(ratio);
    }
  });

  it('暂停与减少动效仍可绘制完整初帧，静态 render 不推进时间、雨滴或水圈', () => {
    const { scene, context } = makeScene();
    const before = scene.getDiagnostics();
    expect(before.ripplesCount).toBeGreaterThan(0);
    for (let i = 0; i < 8; i++) scene.render(10, false);
    scene.render(0, true); scene.render(NaN, true); scene.render(-1, true);
    expect(scene.getDiagnostics()).toEqual(before);
    expect(context.fillRect).toHaveBeenCalled(); expect(context.stroke).toHaveBeenCalled();
  });

  it('点击水圈扩散并渐退，超过寿命后回收；实际降雨持续产生台内水圈', () => {
    const { scene } = makeScene();
    const surface = scene.getDiagnostics().surface, center = midpoint(surface[0], surface[2]);
    scene.tap(center.x, center.y);
    const start = scene.getDiagnostics().ripples.find(ripple => ripple.source === 'tap');
    for (let i = 0; i < 8; i++) scene.render(.1);
    const spread = scene.getDiagnostics().ripples.find(ripple => ripple.source === 'tap');
    expect(spread.radius).toBeGreaterThan(start.radius); expect(spread.opacity).toBeLessThan(start.opacity);
    for (let i = 0; i < 16; i++) scene.render(.1);
    const snapshot = scene.getDiagnostics();
    expect(snapshot.ripples.some(ripple => ripple.source === 'tap')).toBe(false);
    expect(snapshot.ripples.some(ripple => ripple.age < .2)).toBe(true);
    for (const ripple of snapshot.ripples) expect(inside(ripple, snapshot.water)).toBe(true);
  });

  it('大雨增加落雨数量，连续降雨和密集点击都不突破粒子上限', () => {
    const { scene } = makeScene();
    const fine = scene.getDiagnostics().dropsCount;
    expect(scene.setIntensity(80)).toBe(true);
    expect(scene.getDiagnostics().dropsCount).toBeGreaterThan(fine);
    const surface = scene.getDiagnostics().surface, center = midpoint(surface[0], surface[2]);
    for (let i = 0; i < 300; i++) {
      scene.tap(center.x, center.y); scene.render(.1);
      const snapshot = scene.getDiagnostics();
      expect(snapshot.dropsCount).toBeLessThanOrEqual(snapshot.limits.drops);
      expect(snapshot.ripplesCount).toBeLessThanOrEqual(snapshot.limits.ripples);
    }
    expect(scene.setIntensity(40)).toBe(true); expect(scene.getDiagnostics().dropsCount).toBe(fine);
    expect(scene.setIntensity(90)).toBe(false); expect(scene.getDiagnostics().intensity).toBe(40);
  });

  it('尺寸变化保持模拟进度，重新计算台面后命中与落点仍正确', () => {
    const { scene, canvas } = makeScene();
    scene.render(.1); const before = scene.getDiagnostics();
    scene.resize(760, 470); scene.resize(760, 470);
    const after = scene.getDiagnostics();
    expect(after.time).toBe(before.time); expect(after.ripples.map(r => r.age)).toEqual(before.ripples.map(r => r.age));
    expect(canvas.width).toBe(760); expect(canvas.height).toBe(470);
    expect(after.surface).not.toEqual(before.surface);
    for (const drop of after.drops) expect(inside(drop.landing, after.water)).toBe(true);
    const center = midpoint(after.surface[0], after.surface[2]); expect(scene.tap(center.x, center.y)).toBe(true);
    scene.resize(Infinity, -12); expect(canvas.width).toBe(1); expect(canvas.height).toBe(1);
  });

  it('三套色盘改变画面颜色而保留模拟，诊断快照不能改写运行状态', () => {
    const { scene, context } = makeScene();
    const before = scene.getDiagnostics(); scene.render(0, false);
    expect(context.paints.some(paint => paint.color === '#7f928b' && paint.alpha === 1)).toBe(true);
    context.paints.length = 0; scene.setPalette('moss'); scene.render(0, false);
    expect(context.paints.some(paint => paint.color === '#879475' && paint.alpha === 1)).toBe(true);
    expect(scene.getDiagnostics().palette).toBe('moss');
    expect(scene.getDiagnostics().drops).toEqual(before.drops);
    context.paints.length = 0; scene.setPalette('clay'); scene.render(0, false);
    expect(context.paints.some(paint => paint.color === '#b58b79' && paint.alpha === 1)).toBe(true);
    expect(scene.setPalette('unknown')).toBe(false); expect(scene.getDiagnostics().palette).toBe('clay');
    const snapshot = scene.getDiagnostics();
    expect(Object.isFrozen(snapshot)).toBe(true); expect(Object.isFrozen(snapshot.drops[0].landing)).toBe(true);
  });

  it('长间隔不积累失控补帧，销毁可重复且后续操作无效', () => {
    const { scene, context } = makeScene();
    scene.render(500); expect(scene.getDiagnostics().time).toBe(.1);
    scene.dispose(); scene.dispose();
    expect(context.clearRect).toHaveBeenCalledTimes(1);
    expect(scene.render(.1)).toBe(false); expect(scene.tap(480, 324)).toBe(false);
    expect(scene.resize(10, 10)).toBe(false); expect(scene.setIntensity(80)).toBe(false); expect(scene.setPalette('clay')).toBe(false);
    expect(scene.getDiagnostics().dropsCount).toBe(0); expect(scene.getDiagnostics().ripplesCount).toBe(0);
  });
});
