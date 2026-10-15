// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { bindPhotoStudioTabMarker, updatePhotoStudioTabMarker } from '../game/src/hub/photo-studio-tabs.js';

const originalObserver = window.ResizeObserver;
const releases = [];
const originalFrame = window.requestAnimationFrame;
const originalCancel = window.cancelAnimationFrame;
let frames;
let nextFrame;
beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  window.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  window.cancelAnimationFrame = id => frames.delete(id);
});
const flushFrames = () => { const queued = [...frames.values()]; frames.clear(); queued.forEach(callback => callback()); };
afterEach(() => {
  releases.splice(0).forEach(release => release());
  window.ResizeObserver = originalObserver;
  window.requestAnimationFrame = originalFrame;
  window.cancelAnimationFrame = originalCancel;
  document.body.replaceChildren();
});

function fixture(firstWidth = 60) {
  const tabs = document.createElement('div');
  tabs.innerHTML = '<button class="type-tab on">全部</button><button class="type-tab">法术</button>';
  document.body.append(tabs);
  const boxes = [{ x: 0, y: 4, width: firstWidth, height: 35 }, { x: 80, y: 4, width: 78, height: 35 }];
  const buttons = [...tabs.children];
  const measurements = { widths: 0 };
  buttons.forEach((button, index) => Object.defineProperties(button, {
    offsetLeft: { get: () => boxes[index].x }, offsetTop: { get: () => boxes[index].y },
    offsetWidth: { get: () => { measurements.widths++; return boxes[index].width; } }, offsetHeight: { get: () => boxes[index].height },
  }));
  return { tabs, buttons, boxes, measurements };
}

function observerMock() {
  const instances = [];
  window.ResizeObserver = class {
    constructor(callback) { this.callback = callback; this.targets = []; instances.push(this); }
    observe(target) { this.targets.push(target); }
    disconnect() { this.disconnected = true; }
    notify() { this.callback([]); }
  };
  return instances;
}

describe('照相馆分类标记的布局与销毁', () => {
  it('标签变宽、换行及换选后，标记跟随当前标签而非初始位置', () => {
    const instances = observerMock();
    const { tabs, buttons, boxes } = fixture();
    releases.push(bindPhotoStudioTabMarker(tabs));
    flushFrames();
    expect(instances[0].targets).toEqual([tabs, ...buttons]);
    buttons[0].classList.remove('on');
    buttons[1].classList.add('on');
    Object.assign(boxes[1], { x: 24, y: 48, width: 96, height: 40 });
    instances[0].notify();
    flushFrames();
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('24px');
    expect(tabs.style.getPropertyValue('--studio-tab-y')).toBe('86px');
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('96');
  });

  it('初始不可测量时保留静态选中态，尺寸出现后才启用移动标记', () => {
    const instances = observerMock();
    const { tabs, boxes } = fixture(0);
    releases.push(bindPhotoStudioTabMarker(tabs));
    flushFrames();
    expect(tabs.dataset.studioMarker).toBeUndefined();
    boxes[0].width = 72;
    instances[0].notify();
    flushFrames();
    expect(tabs.dataset.studioMarker).toBe('ready');
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('72');
  });

  it('关页后释放观察器和窗口事件，并拒绝已经排队的观察回调', () => {
    const instances = observerMock();
    const { tabs, boxes } = fixture();
    const release = bindPhotoStudioTabMarker(tabs);
    flushFrames();
    release();
    boxes[0].width = 180;
    window.dispatchEvent(new Event('resize'));
    instances[0].notify();
    flushFrames();
    expect(instances[0].disconnected).toBe(true);
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('60');
  });

  it('没有尺寸观察器时仍可通过窗口事件刷新，并可安全销毁空入口', () => {
    window.ResizeObserver = undefined;
    const { tabs, boxes } = fixture();
    releases.push(bindPhotoStudioTabMarker(tabs));
    flushFrames();
    boxes[0].width = 84;
    window.dispatchEvent(new Event('resize'));
    flushFrames();
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('84');
    expect(() => bindPhotoStudioTabMarker(null)()).not.toThrow();
  });

  it('同轮构建、筛选和resize只排一次更新，关页取消未执行的标记', () => {
    const instances = observerMock();
    const { tabs, buttons } = fixture();
    const release = bindPhotoStudioTabMarker(tabs);
    releases.push(release);
    updatePhotoStudioTabMarker(tabs);
    instances[0].notify();
    expect(frames.size).toBe(1);
    buttons[0].classList.remove('on'); buttons[1].classList.add('on');
    flushFrames();
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('80px');
    updatePhotoStudioTabMarker(tabs);
    const late = [...frames.values()][0];
    release();
    expect(frames.size).toBe(0);
    buttons[1].classList.remove('on'); buttons[0].classList.add('on');
    late();
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('80px');
  });
  it('换选复用尺寸，标签变宽或换行由尺寸观察器重新测量', () => {
    const instances = observerMock();
    const { tabs, buttons, boxes, measurements } = fixture();
    releases.push(bindPhotoStudioTabMarker(tabs)); flushFrames();
    const initialReads = measurements.widths;
    buttons[0].classList.remove('on'); buttons[1].classList.add('on');
    updatePhotoStudioTabMarker(tabs); flushFrames();
    expect(measurements.widths).toBe(initialReads);
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('80px');
    Object.assign(boxes[1], { x: 24, y: 48, width: 96 });
    instances[0].notify(); flushFrames();
    expect(measurements.widths).toBeGreaterThan(initialReads);
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('24px');
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('96');
  });
});
