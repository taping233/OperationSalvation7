import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({ prepare: vi.fn(), create: vi.fn() }));
vi.mock('../game/src/ui/camp-entry.js', () => ({
  cityCutDuration: 980, prepareCityCut: h.prepare, createCityCut: h.create,
}));
vi.mock('../game/src/ui/page-visual-ready.js', () => ({ visualFrame: vi.fn(async () => {}) }));
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
let cleanup;
beforeEach(async () => {
  vi.useFakeTimers(); vi.resetModules();
  document.body.innerHTML = '<button id="home">主页</button>';
  document.body.className = '';
  delete document.documentElement.dataset.desktopStartup;
  window.matchMedia = vi.fn(() => ({ matches: false }));
  h.create.mockImplementation(() => { const cut = document.createElement('div'); cut.className = 'camp-entry-cut'; return cut; });
  h.prepare.mockResolvedValue(true);
  const module = await import('../game/src/ui/startup-transition.js');
  // The new instance replaces automatic entry without retaining its observer.
  cleanup = module.installStartupTransition();
});
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers(); vi.clearAllMocks(); });

describe('startup uses the common city cut', () => {
  it('leaves ordinary web startup alone and holds the cut until artwork is ready', async () => {
    expect(h.create).not.toHaveBeenCalled();
    let settle;
    h.prepare.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    document.documentElement.dataset.desktopStartup = 'preparing'; await flush();
    expect(h.create).toHaveBeenCalledWith(expect.objectContaining({ scene: 'departure', title: '进入城市' }));
    expect(document.querySelector('.page-cut-waiting')).not.toBeNull();
    expect(document.documentElement.dataset.desktopStartup).toBe('preparing');
    settle(true); await flush();
    expect(document.documentElement.dataset.desktopStartup).toBe('covered');
    const key = new KeyboardEvent('keydown', { key: 'Enter', cancelable: true });
    window.dispatchEvent(key);
    expect(key.defaultPrevented).toBe(true);
    document.documentElement.dataset.desktopStartup = 'playing'; await flush();
    expect(document.querySelector('.page-cut-waiting')).toBeNull();
    await vi.advanceTimersByTimeAsync(160);
    expect(document.querySelector('.desktop-startup-cut')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(980);
    expect(document.querySelector('.desktop-startup-cut')).toBeNull();
    expect(document.documentElement.dataset.desktopStartup).toBe('complete');
    expect(document.getElementById('home')).not.toBeNull();
  });
  it('cancels without a late artwork callback bringing the cut back', async () => {
    let settle;
    h.prepare.mockReturnValueOnce(new Promise(resolve => { settle = resolve; }));
    document.documentElement.dataset.desktopStartup = 'preparing'; await flush();
    document.documentElement.dataset.desktopStartup = 'cancelled'; await flush();
    settle(true); await flush();
    expect(document.querySelector('.desktop-startup-cut')).toBeNull();
    expect(document.documentElement.dataset.desktopStartup).toBe('cancelled');
  });
  it('respects reduced motion and completes without adding a cut or timer', async () => {
    document.body.classList.add('reduce-motion');
    document.documentElement.dataset.desktopStartup = 'preparing'; await flush();
    expect(document.documentElement.dataset.desktopStartup).toBe('covered');
    expect(h.create).not.toHaveBeenCalled();
    document.documentElement.dataset.desktopStartup = 'playing'; await flush();
    expect(document.documentElement.dataset.desktopStartup).toBe('complete');
    expect(vi.getTimerCount()).toBe(0);
  });
  it('reveals the ready home without a cut when decorative preparation throws', async () => {
    h.prepare.mockRejectedValueOnce(new Error('decoration failed'));
    document.documentElement.dataset.desktopStartup = 'preparing'; await flush();
    expect(document.documentElement.dataset.desktopStartup).toBe('covered');
    expect(document.querySelector('.desktop-startup-cut')).toBeNull();
    document.documentElement.dataset.desktopStartup = 'playing'; await flush();
    expect(document.documentElement.dataset.desktopStartup).toBe('complete');
  });
});
