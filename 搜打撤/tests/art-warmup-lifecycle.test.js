import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let images, idle, background, Art, settings;
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
const flushMicrotasks = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const flushIdle = () => { while (idle.length) idle.shift()(); };
beforeEach(async () => {
  vi.resetModules(); localStorage.clear(); images = []; idle = []; background = [];
  vi.stubGlobal('Image', WarmImage);
  // Capture unexpected speculative background work separately from explicit warm calls.
  vi.stubGlobal('scheduler', { postTask: vi.fn(task => { background.push(task); return Promise.resolve(); }) });
  vi.stubGlobal('requestIdleCallback', fn => { idle.push(fn); return idle.length; });
  await import('../game/src/core/art.js'); Art = window.SDT.Art;
  settings = await import('../game/src/core/performance-settings.js');
});
afterEach(() => { localStorage.clear(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('图片预热失败与池生命周期', () => {
  it('non-retained card warm still uses two decode slots and deduplicates successful URLs', async () => {
    let finishFirst;
    const decode = vi.spyOn(WarmImage.prototype, 'decode')
      .mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }));
    Art.warm(['card-a', 'card-b', 'card-a', 'card-c'], { retain: false });
    expect(images.map(image => image.src)).toEqual(['card-a', 'card-b']);
    expect(Art.warmStats()).toMatchObject({ count: 0, bytes: 0 });
    images[0].loaded(1254, 1254);
    await flushMicrotasks();
    expect(images).toHaveLength(2);
    images[1].loaded(1254, 1254);
    await flushMicrotasks();
    expect(images.map(image => image.src)).toEqual(['card-a', 'card-b', 'card-c']);
    images[2].loaded(896, 679);
    finishFirst();
    await flushMicrotasks();
    expect(decode).toHaveBeenCalledTimes(3);
    expect(Art.warmStats()).toMatchObject({ count: 0, bytes: 0 });
    Art.warm(['card-a', 'card-b', 'card-c'], { retain: false });
    expect(images).toHaveLength(3);
  });

  it('warm shares two slots across calls, deduplicates queued URLs and waits for decode', async () => {
    let resolveFirst;
    vi.spyOn(WarmImage.prototype, 'decode').mockImplementationOnce(() => new Promise(resolve => { resolveFirst = resolve; }));
    Art.warm(['queue-a', 'queue-b', 'queue-c', 'queue-c']); Art.warm(['queue-c', 'queue-d']);
    expect(images.map(image => image.src)).toEqual(['queue-a', 'queue-b']);
    images[0].loaded(); await flushMicrotasks(); expect(images).toHaveLength(2);
    images[1].failed(); expect(images.map(image => image.src)).toEqual(['queue-a', 'queue-b', 'queue-c']);
    resolveFirst(); await flushMicrotasks(); expect(images.map(image => image.src)).toEqual(['queue-a', 'queue-b', 'queue-c', 'queue-d']);
    images[2].loaded(); images[3].loaded(); await flushMicrotasks();
    Art.warm(['queue-a', 'queue-c', 'queue-d']); expect(images).toHaveLength(4);
    Art.warm(['queue-b']); expect(images.at(-1).src).toBe('queue-b'); expect(images).toHaveLength(5);
  });
  it('warm decode failure advances the queue and can retry without a stale error releasing another slot', async () => {
    vi.spyOn(WarmImage.prototype, 'decode').mockRejectedValueOnce(new Error('decode'));
    Art.warm(['decode-bad', 'in-flight', 'next']);
    images[0].loaded(); await flushMicrotasks(); expect(images.at(-1).src).toBe('next');
    const count = images.length; images[0].failed(); expect(images).toHaveLength(count);
    Art.warm(['decode-bad']); expect(images).toHaveLength(count);
    images[1].failed(); expect(images.at(-1).src).toBe('decode-bad');
  });
  it('an error while decoding keeps its slot until settlement and preserves queued retry deduplication', async () => {
    let rejectDecode;
    vi.spyOn(WarmImage.prototype, 'decode').mockImplementationOnce(() => new Promise((_, reject) => { rejectDecode = reject; }));
    Art.warm(['racy', 'busy', 'other']); images[0].loaded(); images[0].failed();
    Art.warm(['racy']); expect(images).toHaveLength(2);
    rejectDecode(new Error('late decode failure')); await flushMicrotasks();
    expect(images.at(-1).src).toBe('other');
    Art.warm(['racy']); images[1].failed(); expect(images.at(-1).src).toBe('racy');
    images[2].failed(); expect(images.filter(image => image.src === 'racy')).toHaveLength(2);
  });
  it('a synchronous decode exception does not block later items', () => {
    vi.spyOn(WarmImage.prototype, 'decode').mockImplementationOnce(() => { throw new Error('decode'); });
    Art.warm(['throws', 'busy', 'next']); images[0].loaded();
    expect(images.at(-1).src).toBe('next');
  });
  it('warm skips late decode for an evicted pending image while retained images still decode', () => {
    const decode = vi.spyOn(WarmImage.prototype, 'decode');
    const max = Art.warmStats().maxCount;
    Art.warm(['evicted-0.webp']);
    Art.warmBatched(Array.from({ length: max }, (_, i) => `pressure-${i}.webp`), null, max);
    images[0].loaded(); expect(decode).not.toHaveBeenCalled();
    images.at(-1).loaded(); expect(decode).toHaveBeenCalledTimes(1);
    expect(images[0].src).toBe('evicted-0.webp');
  });
  it('warmBatched finishes an evicted late load without decode or stalled progress', async () => {
    const decode = vi.spyOn(WarmImage.prototype, 'decode'), progress = vi.fn();
    const done = Art.warmBatched(['batch-evicted.webp', 'batch-normal.webp'], progress, 1);
    const evicted = images[0];
    Art.warmBatched(Array.from({ length: Art.warmStats().maxCount }, (_, i) => `pressure-${i}.webp`), null, Art.warmStats().maxCount);
    evicted.loaded(); expect(decode).not.toHaveBeenCalled();
    expect(progress.mock.calls.at(-1)).toEqual([1, 2]);
    flushIdle(); const normal = images.at(-1);
    expect(normal.src).toBe('batch-normal.webp'); normal.loaded();
    await Promise.resolve(); await Promise.resolve(); flushIdle(); await done;
    expect(decode).toHaveBeenCalledTimes(1);
    expect(progress.mock.calls).toEqual([[0, 2], [1, 2], [2, 2]]);
    evicted.failed(); expect(progress.mock.calls.at(-1)).toEqual([2, 2]);
  });
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
  it('explicit enemy image warming still releases failed decode and permits retry', async () => {
    vi.spyOn(WarmImage.prototype, 'decode').mockRejectedValueOnce(new Error('decode failed'));
    const url = 'assets/portraits/cut/enemies/infantry.webp?v=dev';
    Art.warm([url]); images[0].loaded();
    await flushMicrotasks();
    expect(Art.warmStats().count).toBe(0);
    Art.warm([url]); expect(images).toHaveLength(2);
  });
  it('普通warm失败可重试，不保留时不进入位图池', () => {
    Art.warm(['one.webp']); images[0].failed(); expect(Art.warmStats().count).toBe(0);
    Art.warm(['one.webp'], { retain: false }); images[1].loaded();
    expect(Art.warmStats().count).toBe(0); expect(Art.warmStats().bytes).toBe(0);
  });
  it('被张数淘汰的迟到load不重新计账', () => {
    const max = Art.warmStats().maxCount;
    Art.warmBatched(Array.from({ length: max + 1 }, (_, i) => `late-${i}.webp`), null, max + 1);
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
    settings.setPerformanceSettings({ quality: 'high' });
    Art.warmBatched(['large-0.webp', 'large-1.webp', 'large-2.webp', 'large-3.webp'], null, 4);
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


describe('quality-scoped retained image budget', () => {
  const MiB = 1024 * 1024;
  it('reports 48/96/192 MiB and an FPS-only change preserves the budget', () => {
    expect(Art.warmStats().maxBytes).toBe(96 * MiB);
    settings.setPerformanceSettings({ quality: 'low' }); expect(Art.warmStats().maxBytes).toBe(48 * MiB);
    settings.setPerformanceSettings({ fps: 30 }); expect(Art.warmStats().maxBytes).toBe(48 * MiB);
    settings.setPerformanceSettings({ quality: 'high' }); expect(Art.warmStats().maxBytes).toBe(192 * MiB);
  });
  it('downgrading trims references immediately without changing image src or visible DOM; upgrading does not reload', () => {
    settings.setPerformanceSettings({ quality: 'high' });
    Art.warmBatched(['a', 'b', 'c'], null, 3); images.forEach(image => image.loaded(4096, 2048));
    document.body.innerHTML = '<img src="visible.webp">'; const markup = document.body.innerHTML;
    expect(Art.warmStats().bytes).toBe(96 * MiB);
    settings.setPerformanceSettings({ quality: 'low' });
    expect(Art.warmStats()).toMatchObject({ count: 1, bytes: 32 * MiB });
    expect(images.map(image => image.src)).toEqual(['a', 'b', 'c']); expect(document.body.innerHTML).toBe(markup);
    settings.setPerformanceSettings({ quality: 'high' }); expect(images).toHaveLength(3);
    expect(Art.warmStats().bytes).toBe(32 * MiB);
  });
  it('a pending oversized image uses the new budget and does not evict smaller retained images', () => {
    settings.setPerformanceSettings({ quality: 'high' }); Art.warm(['small', 'oversized']);
    images[0].loaded(2048, 2048); settings.setPerformanceSettings({ quality: 'low' });
    images[1].loaded(4096, 4096);
    expect(Art.warmStats()).toMatchObject({ count: 1, bytes: 16 * MiB });
    expect(images[0].__released).not.toBe(true); expect(images[1].__released).toBe(true);
    expect(images[1].src).toBe('oversized');
  });
  it('a single image larger than the current limit is not kept in the pool', () => {
    settings.setPerformanceSettings({ quality: 'low' }); Art.warm(['oversized']); images[0].loaded(4096, 4096);
    expect(Art.warmStats()).toMatchObject({ count: 0, bytes: 0 });
  });
  it('downgrade removes oversized loaded entries before FIFO eviction and late load cannot revive them', () => {
    settings.setPerformanceSettings({ quality: 'high' }); Art.warmBatched(['small', 'large'], null, 2);
    images[0].loaded(2048, 2048); images[1].loaded(4096, 4096);
    settings.setPerformanceSettings({ quality: 'low' });
    expect(Art.warmStats()).toMatchObject({ count: 1, bytes: 16 * MiB });
    images[1].dispatchEvent(new Event('load')); expect(Art.warmStats().bytes).toBe(16 * MiB);
  });
  it('importing Art on the title page schedules no speculative enemy image decoding', async () => {
    while (background.length) { background.shift()(); await flushMicrotasks(); }
    expect(images).toHaveLength(0);
    expect(Art.warmStats()).toMatchObject({ count: 0, bytes: 0 });
  });
  it('cold visible enemy figures select their cut URL without a warm-pool entry', () => {
    document.body.innerHTML = `<figure class="sts-figure">${Art.monsterArt('infantry')}</figure>`;
    const img = document.querySelector('img'), original = img.getAttribute('src');
    const expected = original.replace('/portraits/enemies/', '/portraits/cut/enemies/');
    Art.cutoutFigures(document.body);
    expect(img.getAttribute('src')).toBe(expected);
    const onerror = img.onerror;
    Art.cutoutFigures(document.body);
    expect(img.onerror).toBe(onerror);
    expect(images).toHaveLength(0);
    expect(Art.warmStats()).toMatchObject({ count: 0, bytes: 0 });
  });
  it('a cold missing cut image still falls back to its original URL once', () => {
    document.body.innerHTML = `<figure class="sts-figure">${Art.monsterArt('infantry')}</figure>`;
    const img = document.querySelector('img'), original = img.getAttribute('src');
    Art.cutoutFigures(document.body);
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe(original);
    expect(img.onerror).toBeNull();
  });
  it('a late cut error cannot replace a newer visible image source', () => {
    document.body.innerHTML = `<figure class="sts-figure">${Art.monsterArt('infantry')}</figure>`;
    const img = document.querySelector('img');
    Art.cutoutFigures(document.body);
    img.src = 'newer-enemy.webp';
    img.dispatchEvent(new Event('error'));
    expect(img.getAttribute('src')).toBe('newer-enemy.webp');
    expect(img.onerror).toBeNull();
  });
});
