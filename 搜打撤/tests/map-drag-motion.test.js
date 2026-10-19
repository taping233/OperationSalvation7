import { describe, expect, it } from 'vitest';
import { cameraPanBounds, createMapDragMotion } from '../game/src/core/map-drag-motion.js';

function harness({ zoom = 1, reduced = false } = {}) {
  let time = 0, serial = 0;
  const frames = new Map();
  const camera = { map:{ cols:20, rows:20, tile:48 }, cx:400, cy:400, zoom,
    clamp() {
      const b = cameraPanBounds(this.map, this);
      this.cx = Math.max(b.minX, Math.min(b.maxX, this.cx));
      this.cy = Math.max(b.minY, Math.min(b.maxY, this.cy));
    } };
  const pan = createMapDragMotion(camera, { now:() => time, reduced:() => reduced,
    requestFrame: callback => { frames.set(++serial, callback); return serial; },
    cancelFrame: id => frames.delete(id) });
  return { camera, pan, frames, advance(ms) { time += ms; },
    tick(ms = 16) { time += ms; const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback(time)); },
    settle() { for (let i = 0; i < 400 && frames.size; i++) this.tick(); } };
}

describe('地图直接拖动与松手物理', () => {
  it.each([.5, 1, 2])('zoom=%s 时指针与地图屏幕位移一致，拖动时不另开补间', zoom => {
    const h = harness({ zoom }); h.pan.begin(); h.advance(20); h.pan.move(40, 20);
    expect((400 - h.camera.cx) * zoom).toBeCloseTo(40);
    expect((400 - h.camera.cy) * zoom).toBeCloseTo(20);
    expect(h.frames.size).toBe(0);
  });
  it('松手沿释放方向减速，最后停止提交动画', () => {
    const h = harness(); h.pan.begin(); h.advance(20); h.pan.move(20, 0); h.advance(20); h.pan.move(20, 0);
    const released = h.camera.cx; h.pan.release(); h.tick();
    expect(h.camera.cx).toBeLessThan(released);
    h.settle(); expect(h.frames.size).toBe(0);
    expect(h.camera.cx).toBeGreaterThanOrEqual(0);
    const stopped = h.camera.cx; h.tick(1000); expect(h.camera.cx).toBe(stopped);
  });
  it('拖住停稳后松手不保留旧速度', () => {
    const h = harness(); h.pan.begin(); h.advance(20); h.pan.move(60, 0); h.advance(110);
    const stopped = h.camera.cx; h.pan.release(); h.settle();
    expect(h.camera.cx).toBe(stopped);
  });
  it('边缘拉动有阻力，松手回到合法范围并停止', () => {
    const h = harness(); h.pan.begin(); h.advance(40); h.pan.move(10000, -10000);
    expect(h.camera.cx).toBeLessThan(0); expect(h.camera.cx).toBeGreaterThan(-80);
    expect(h.camera.cy).toBeLessThan(1040);
    h.pan.release(); h.settle();
    expect(h.camera.cx).toBeGreaterThanOrEqual(0);
    expect(h.camera.cy).toBeLessThanOrEqual(960);
    expect(h.frames.size).toBe(0);
  });
  it('新拖动取消旧惯性，旧帧不能接管新位置', () => {
    const h = harness(); h.pan.begin(); h.advance(20); h.pan.move(50, 0); h.pan.release();
    h.pan.begin(); h.advance(20); h.pan.move(-15, 0);
    const position = h.camera.cx; h.tick();
    expect(h.camera.cx).toBe(position); expect(h.frames.size).toBe(0);
  });
  it('覆盖层/状态变化取消惯性，取消或减动效不留后台动画', () => {
    const h = harness(); let allowed = true;
    h.pan.begin(); h.advance(20); h.pan.move(50, 0); h.pan.release(() => allowed);
    allowed = false; h.tick(); expect(h.frames.size).toBe(0);
    const reduced = harness({ reduced:true }); reduced.pan.begin(); reduced.advance(20); reduced.pan.move(50, 0); reduced.pan.release();
    expect(reduced.frames.size).toBe(0);
  });
  it.each([.2, 1, 2])('zoom=%s 时大幅拖动及惯性结束都使用当前节点边界', zoom => {
    const h = harness({ zoom });
    Object.assign(h.camera, { viewW:1000, viewH:600, detailInset:250,
      layerGame:{ layerIdx:0, nodePos:[[{x:200,y:300},{x:1400,y:1300}]] } });
    h.camera.clamp();
    h.pan.begin(); h.advance(20); h.pan.move(10000, -10000); h.pan.release(); h.settle();
    const bounds = cameraPanBounds(h.camera.map, h.camera);
    expect(h.camera.cx).toBeGreaterThanOrEqual(bounds.minX);
    expect(h.camera.cx).toBeLessThanOrEqual(bounds.maxX);
    expect(h.camera.cy).toBeGreaterThanOrEqual(bounds.minY);
    expect(h.camera.cy).toBeLessThanOrEqual(bounds.maxY);
    expect(h.frames.size).toBe(0);
  });
});
