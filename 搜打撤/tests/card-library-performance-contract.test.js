// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

async function setup({ moduleGate = Promise.resolve() } = {}) {
  vi.resetModules();
  document.body.innerHTML = '<section id="viewport"></section><div id="overlay" hidden></div>';
  const state = {
    game: { state: 'title' },
    cardPageOpen: false,
    moduleImports: 0,
    mounts: 0,
    closes: 0,
    loading: [],
    cancelPending: null,
    originState: 'title',
  };

  vi.doMock('../game/src/run/game.session.js', () => ({ game: state.game }));
  vi.doMock('../game/src/hub/game.cardslib.common.js', () => {
    const common = {
      CARD_DESIGNER_WRITES_ENABLED: false,
      Sfx: {},
      cardHTML: () => '',
      configureCardNavigation() {},
      configurePendingCardPageEntry(cancel) { state.cancelPending = cancel; },
      setCardPageOpen(value) { state.cardPageOpen = !!value; },
      closeCardPageTop() {
        if (state.cancelPending?.()) return;
        state.closes += 1;
        state.cardPageOpen = false;
        state.game.state = state.originState;
      },
    };
    Object.defineProperty(common, 'cardPageOpen', { get: () => state.cardPageOpen });
    return common;
  });
  vi.doMock('../game/src/hub/game.cardslib.page.js', async () => {
    state.moduleImports += 1;
    await moduleGate;
    return {
      openCardLibrary: () => {
        state.mounts += 1;
        state.game.state = 'modal';
      },
      preparePhotoStudioEntry: async () => {},
      finishPhotoStudioEntry: () => {},
      openCardDesigner: () => {},
    };
  });
  vi.doMock('../game/src/ui/page-loading.js', () => ({
    runPageLoading({ open, signal }) {
      return new Promise((resolve, reject) => {
        const loading = { ready: false, result: undefined, finishFade: null };
        state.loading.push(loading);
        const onAbort = () => resolve(false);
        signal.addEventListener('abort', onAbort, { once: true });
        loading.finishFade = () => resolve(loading.result);
        Promise.resolve().then(open).then(result => {
          loading.ready = true;
          loading.result = result;
        }).catch(reject);
      });
    },
  }));

  const facade = await import('../game/src/hub/game.cardslib.js');
  return { facade, state };
}

afterEach(() => {
  vi.doUnmock('../game/src/run/game.session.js');
  vi.doUnmock('../game/src/hub/game.cardslib.common.js');
  vi.doUnmock('../game/src/hub/game.cardslib.page.js');
  vi.doUnmock('../game/src/ui/page-loading.js');
  vi.resetModules();
  document.body.innerHTML = '';
});

describe('照相馆打开性能与就绪行为', () => {
  it('重复打开共享同一等待过程，页面只挂载一次', async () => {
    const { facade, state } = await setup();

    const first = facade.openCardLibrary();
    const repeated = facade.openCardLibrary();
    expect(repeated).toBe(first);
    expect(state.loading).toHaveLength(1);
    await vi.waitFor(() => expect(state.mounts).toBe(1));
    expect(state.game.state).toBe('modal');
    expect(state.cardPageOpen).toBe(true);

    state.loading[0].finishFade();
    await first;
    expect(state.mounts).toBe(1);
    expect(state.moduleImports).toBe(1);
  });

  it('挂载前取消不调用页面入口，随后可重新打开并完成挂载', async () => {
    const moduleGate = deferred();
    const { facade, state } = await setup({ moduleGate: moduleGate.promise });

    const cancelled = facade.openCardLibrary();
    expect(facade.cardPageLoading).toBe(true);
    expect(facade.cancelPendingCardPageOpen()).toBe(true);
    await expect(cancelled).resolves.toBe(false);
    expect(state.mounts).toBe(0);
    expect(state.game.state).toBe('title');
    expect(state.cardPageOpen).toBe(false);

    const reopened = facade.openCardLibrary();
    moduleGate.resolve();
    await vi.waitFor(() => expect(state.mounts).toBe(1));
    expect(state.game.state).toBe('modal');
    expect(state.loading).toHaveLength(2);
    state.loading[1].finishFade();
    await reopened;
    expect(state.mounts).toBe(1);
  });

  it('ready 后淡出期间可立即关闭，并恢复原来源状态', async () => {
    const { facade, state } = await setup();

    const opening = facade.openCardLibrary();
    await vi.waitFor(() => expect(state.mounts).toBe(1));
    expect(facade.cardPageLoading).toBe(false);
    expect(state.game.state).toBe('modal');
    expect(state.loading[0].ready).toBe(true);

    facade.closeCardPageTop();
    expect(state.closes).toBe(1);
    expect(state.game.state).toBe('title');
    expect(state.cardPageOpen).toBe(false);
    await expect(opening).resolves.toBe(false);
  });
});
