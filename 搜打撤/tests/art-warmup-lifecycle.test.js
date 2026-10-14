import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let images, idle, background, Art;
class WarmImage extends EventTarget {
  naturalWidth = 0; naturalHeight = 0; complete = false;
  constructor() { super(); images.push(this); }
  decode() { return Promise.resolve(); }
  loaded(width = 64, height = 64) {
    this.naturalWidth = width; this.naturalHeight = height; this.complete = true;
    this.onload?.(); this.dispatchEvent(new Event('load'));
  }
  failed() { this.onerror?.(); this.dispatchEvent(new Event('error')); }
}
const flushIdle = () => { while (idle.length) idle.shift()(); };
beforeEach(async () => {
  vi.resetModules(); images = []; idle = []; background = [];
  vi.stubGlobal('Image', WarmImage);
  // Enemy background predecode remains queued, isolated from the explicitly tested batches.
  vi.stubGlobal('scheduler', { postTask: vi.fn(task => { background.push(task); return Promise.resolve(); }) });
  vi.stubGlobal('requestIdleCallback', fn => { idle.push(fn); return idle.length; });
  await import('../game/src/core/art.js'); Art = window.SDT.Art;
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('图片预热失败与池生命周期', () => {
  it('失败图片出池，本批仅完成一次，不自动无限重试，后续warm可重试', async () => {
    const progress = vi.fn(); const done = Art.warmBatched(['failed.webp'], progress);
    images[0].failed(); flushIdle(); await done;
    expect(Art.warmStats().count).toBe(0);
    expect(progress.mock.calls).toEqual([[0, 1], [1, 1]]);
    expect(images).toHaveLength(1);
    Art.warm(['failed.webp']); expect(images).toHaveLength(2);
  });
  it('失败后下一批可以重新加载同一URL', async () => {
    const first = Art.warmBatched(['retry.webp']); images[0].failed(); flushIdle(); await first;
    const second = Art.warmBatched(['retry.webp']);
    expect(images).toHaveLength(2);
    images[1].loaded(); await Promise.resolve(); await Promise.resolve(); flushIdle(); await second;
    expect(Art.warmStats().count).toBe(1);
    expect(Art.warmStats().bytes).toBe(64 * 64 * 4);
  });
  it('敌人空闲预解码失败也释放统一池，并允许之后按需重试', async () => {
    vi.spyOn(WarmImage.prototype, 'decode').mockRejectedValueOnce(new Error('decode failed'));
    background.shift()();
    await vi.waitFor(() => expect(Art.warmStats().count).toBe(0));
    Art.warm([images[0].src]); expect(images).toHaveLength(2);
  });
  it('普通warm失败可重试，不保留时不进入位图池', () => {
    Art.warm(['one.webp']); images[0].failed(); expect(Art.warmStats().count).toBe(0);
    Art.warm(['one.webp'], { retain: false }); images[1].loaded();
    expect(Art.warmStats().count).toBe(0); expect(Art.warmStats().bytes).toBe(0);
  });
  it('被张数淘汰的迟到load不重新计账', () => {
    const max = Art.warmStats().maxCount;
    Art.warm(Array.from({ length: max + 1 }, (_, i) => `late-${i}.webp`));
    images[0].loaded(1000, 1000);
    expect(Art.warmStats().count).toBe(max); expect(Art.warmStats().bytes).toBe(0);
    images.at(-1).loaded(80, 80); expect(Art.warmStats().bytes).toBe(80 * 80 * 4);
  });
  it('load后的迟到decode与error交错只结算一次，不重复进度或复活字节账', async () => {
    let finishDecode;
    vi.spyOn(WarmImage.prototype, 'decode').mockImplementationOnce(() => new Promise(resolve => { finishDecode = resolve; }));
    const progress = vi.fn(), done = Art.warmBatched(['late-decode.webp'], progress);
    images[0].loaded(); images[0].failed(); flushIdle(); await done;
    expect(Art.warmStats().bytes).toBe(0); expect(Art.warmStats().count).toBe(0);
    finishDecode(); await Promise.resolve(); await Promise.resolve(); flushIdle();
    expect(progress.mock.calls).toEqual([[0, 1], [1, 1]]);
    Art.warm(['late-decode.webp']); expect(images).toHaveLength(2);
  });
  it('解码字节超预算淘汰最旧图片，失败释放已记账图片也准确扣账', () => {
    Art.warm(['large-0.webp', 'large-1.webp', 'large-2.webp', 'large-3.webp']);
    images.forEach(image => image.loaded(4096, 4096));
    expect(Art.warmStats().count).toBe(3); expect(Art.warmStats().bytes).toBe(Art.warmStats().maxBytes);
    images.at(-1).failed(); expect(Art.warmStats().count).toBe(2); expect(Art.warmStats().bytes).toBe(2 * 4096 * 4096 * 4);
  });
  it('已成功预热URL去重，不重新请求', async () => {
    const first = Art.warmBatched(['ok.webp', 'ok.webp']); images[0].loaded();
    await Promise.resolve(); await Promise.resolve(); flushIdle(); await first;
    await Art.warmBatched(['ok.webp']); Art.warm(['ok.webp']); expect(images).toHaveLength(1);
  });
});
