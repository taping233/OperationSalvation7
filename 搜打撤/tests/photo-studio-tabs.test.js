// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { bindPhotoStudioTabMarker } from '../game/src/hub/photo-studio-tabs.js';

const originalObserver = window.ResizeObserver;
const releases = [];
afterEach(() => {
  releases.splice(0).forEach(release => release());
  window.ResizeObserver = originalObserver;
  document.body.replaceChildren();
});

function fixture(firstWidth = 60) {
  const tabs = document.createElement('div');
  tabs.innerHTML = '<button class="type-tab on">全部</button><button class="type-tab">法术</button>';
  document.body.append(tabs);
  const boxes = [{ x: 0, y: 4, width: firstWidth, height: 35 }, { x: 80, y: 4, width: 78, height: 35 }];
  const buttons = [...tabs.children];
  buttons.forEach((button, index) => Object.defineProperties(button, {
    offsetLeft: { get: () => boxes[index].x }, offsetTop: { get: () => boxes[index].y },
    offsetWidth: { get: () => boxes[index].width }, offsetHeight: { get: () => boxes[index].height },
  }));
  return { tabs, buttons, boxes };
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
    expect(instances[0].targets).toEqual([tabs, ...buttons]);
    buttons[0].classList.remove('on');
    buttons[1].classList.add('on');
    Object.assign(boxes[1], { x: 24, y: 48, width: 96, height: 40 });
    instances[0].notify();
    expect(tabs.style.getPropertyValue('--studio-tab-x')).toBe('24px');
    expect(tabs.style.getPropertyValue('--studio-tab-y')).toBe('86px');
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('96');
  });

  it('初始不可测量时保留静态选中态，尺寸出现后才启用移动标记', () => {
    const instances = observerMock();
    const { tabs, boxes } = fixture(0);
    releases.push(bindPhotoStudioTabMarker(tabs));
    expect(tabs.dataset.studioMarker).toBeUndefined();
    boxes[0].width = 72;
    instances[0].notify();
    expect(tabs.dataset.studioMarker).toBe('ready');
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('72');
  });

  it('关页后释放观察器和窗口事件，并拒绝已经排队的观察回调', () => {
    const instances = observerMock();
    const { tabs, boxes } = fixture();
    const release = bindPhotoStudioTabMarker(tabs);
    release();
    boxes[0].width = 180;
    window.dispatchEvent(new Event('resize'));
    instances[0].notify();
    expect(instances[0].disconnected).toBe(true);
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('60');
  });

  it('没有尺寸观察器时仍可通过窗口事件刷新，并可安全销毁空入口', () => {
    window.ResizeObserver = undefined;
    const { tabs, boxes } = fixture();
    releases.push(bindPhotoStudioTabMarker(tabs));
    boxes[0].width = 84;
    window.dispatchEvent(new Event('resize'));
    expect(tabs.style.getPropertyValue('--studio-tab-width')).toBe('84');
    expect(() => bindPhotoStudioTabMarker(null)()).not.toThrow();
  });
});
