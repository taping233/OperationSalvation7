import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const source = (relative) => readFileSync(resolve(process.cwd(), relative), 'utf8');
const harness = vi.hoisted(() => ({
  game: { state: 'title' },
  isOpen: false,
  cancelPending: null,
  resolvePage: null,
  pageGate: null,
  openLibrary: null,
}));

describe('照相馆按需页面边界', () => {
  it('启动门面只静态依赖共享层，页面实现由用户入口动态装载', () => {
    const facade = source('game/src/hub/game.cardslib.js');
    const page = source('game/src/hub/game.cardslib.page.js');

    expect(facade).toContain("import('./game.cardslib.page.js')");
    expect(facade).not.toMatch(/from\s+['"]\.\/game\.cardslib\.page\.js['"]/);
    expect(facade).toContain('cardPageOpen');
    expect(facade).toContain('closeCardPageTop');
    expect(facade).toContain('CARD_DESIGNER_WRITES_ENABLED');
    expect(page).toContain("from './game.cardslib.designer.js'");
    expect(page).toContain("from './game.cardslib.photo-fps.js'");
    expect(facade).toContain("from '../ui/page-loading.js'");
    expect(page).not.toContain("from '../ui/page-loading.js'");
    expect(page).toContain('configureCardPageClosers({ closeLibrary: closeLibPage, closeDesigner });');
  });

  it('关闭或切换页面会废弃仍在等待页面模块的打开请求', () => {
    const facade = source('game/src/hub/game.cardslib.js');
    const quickNav = source('game/src/ui/quick-nav.js');
    expect(facade).toContain('const request = ++pageRequest');
    expect(facade).toContain('if (request !== pageRequest || pending !== entry ||');
    expect(facade).toContain('entry.controller.abort();');
    expect(facade).toContain('if (pageEntryPromise) return pageEntryPromise;');
    expect(facade).toContain('originOverlayHidden: overlay?.hidden,');
    expect(facade).toContain('originRoot: originBody?.firstElementChild,');
    expect(facade).toContain('pendingPageEntry?.wasCardPageOpen ?? cardPageOpen');
    expect(facade).toContain('pageRequest += 1;');
    expect(facade).toContain('pageModulePromise = null;');
    expect(quickNav).toContain("if (page.id !== 'cardslib') cancelPendingCardPageOpen();");
  });

  it.each([
    { name: '标题页', state: 'title', isOpen: false },
    { name: '基地弹层', state: 'modal', isOpen: true },
  ])('pending Escape 在$name只取消卡页请求并恢复原页面开关', async ({ state: originState, isOpen: wasOpen }) => {
    vi.resetModules();
    harness.game.state = originState;
    harness.isOpen = wasOpen;
    harness.openLibrary = vi.fn();
    harness.pageGate = new Promise((resolve) => { harness.resolvePage = resolve; });
    vi.doMock('../game/src/run/game.session.js', () => ({ game: harness.game }));
    vi.doMock('../game/src/hub/game.cardslib.common.js', () => {
      const common = {
        CARD_DESIGNER_WRITES_ENABLED: false,
        Sfx: {}, cardHTML: () => '', navigation: {}, configureCardNavigation() {},
        setCardPageOpen(value) { harness.isOpen = value; },
        configurePendingCardPageEntry(cancel) { harness.cancelPending = cancel; },
        closeCardPageTop() { return harness.cancelPending?.(); },
      };
      Object.defineProperty(common, 'cardPageOpen', { get: () => harness.isOpen });
      return common;
    });
    vi.doMock('../game/src/hub/game.cardslib.page.js', async () => {
      await harness.pageGate;
      return { openCardLibrary: harness.openLibrary, openCardDesigner: vi.fn() };
    });
    vi.doMock('../game/src/ui/page-loading.js', () => ({
      runPageLoading({ open, signal }) {
        const aborted = new Promise(resolve => signal.addEventListener('abort', () => resolve(false), { once: true }));
        return Promise.race([Promise.resolve().then(open), aborted]);
      },
    }));

    try {
      const facade = await import('../game/src/hub/game.cardslib.js');
      const firstOpening = facade.openCardLibrary();
      const opening = facade.openCardLibrary();
      expect(opening).toBe(firstOpening);
      expect(facade.cardPageLoading).toBe(true);
      expect(harness.isOpen).toBe(true);
      facade.closeCardPageTop();
      expect(facade.cardPageLoading).toBe(false);
      expect(harness.isOpen).toBe(wasOpen);
      harness.resolvePage();
      await firstOpening;
      await opening;
      expect(harness.openLibrary).not.toHaveBeenCalled();
      expect(harness.game.state).toBe(originState);
    } finally {
      vi.doUnmock('../game/src/run/game.session.js');
      vi.doUnmock('../game/src/hub/game.cardslib.common.js');
      vi.doUnmock('../game/src/hub/game.cardslib.page.js');
      vi.doUnmock('../game/src/ui/page-loading.js');
      vi.resetModules();
    }
  });
});
