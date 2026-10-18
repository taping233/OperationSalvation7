import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync('game/dev/restore-capacity-review.html', 'utf8');
// Exercise the real startup prefix without loading gameplay or touching persistence.
const prefix = html.split('<script type="module">')[1].split('await new Promise')[0];
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
const start = new AsyncFunction('loadModule', prefix.replaceAll('import(', 'loadModule(') + '\n}');
afterEach(() => {
  delete window.__restoreFixtureStarted;
  delete window.SDT;
  document.body.replaceChildren();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('复原夹具的轻量启动', () => {
  it('仅启动一次，只跳过后台全目录预取，真实图片/场景入口保持原状', async () => {
    const warm = vi.fn(), warmBatched = vi.fn(), decodeIn = vi.fn();
    window.SDT = { Art: { warm, warmBatched, decodeIn, prefetchBatched: vi.fn() } };
    const fetch = vi.fn().mockResolvedValue({ text: async () => '<body><div id="warmupTip"></div></body>' });
    vi.stubGlobal('fetch', fetch);
    const load = vi.fn().mockResolvedValue({});
    const event = vi.spyOn(document, 'dispatchEvent');
    await start(load); await start(load);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(load.mock.calls.flat()).toEqual(['/src/core/art.js', '/src/main.js']);
    expect(event).toHaveBeenCalledTimes(1);
    expect(window.SDT.Art.warm).toBe(warm);
    expect(window.SDT.Art.warmBatched).toBe(warmBatched);
    expect(window.SDT.Art.decodeIn).toBe(decodeIn);
    expect(document.getElementById('warmupTip').style.display).toBe('none');
    const progress = vi.fn();
    await window.SDT.Art.prefetchBatched(['unrelated.webp'], progress);
    expect(progress).not.toHaveBeenCalled(); // No fake success count.
    expect(html).toContain('UI.el.overlay.append(controls)');
    expect(html).toContain('sizeControls();window.addEventListener');
  });
  it('真实入口加载失败仍然拒绝，不吞掉失败', async () => {
    window.SDT = { Art: {} };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ text: async () => '<body></body>' }));
    await expect(start(vi.fn().mockRejectedValue(new Error('asset failed')))).rejects.toThrow('asset failed');
  });
});
