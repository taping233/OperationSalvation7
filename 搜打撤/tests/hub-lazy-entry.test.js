import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let h;

async function setup() {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', fn => setTimeout(fn, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="viewport"></div><div id="overlay"><div id="ovBody"><section class="slot-page">选档</section></div></div>';
  h = {
    game: { state: 'modal', runActive: false }, slot: 1, isOpen: false,
    hubGate: deferred(), cardGate: deferred(), hubImports: vi.fn(), cardImports: vi.fn(),
    startNewGame: vi.fn(), log: vi.fn(), base: { slot: 1, data: { coins: 17 } },
    close: null,
  };
  const mount = cls => {
    document.getElementById('ovBody').innerHTML = `<section class="${cls}" id="${cls === 'hub-page' ? 'hubMain' : 'cardLibrary'}"></section>`;
    h.game.state = 'modal';
  };
  h.openHub = vi.fn(() => mount('hub-page'));
  h.openCard = vi.fn(() => mount('card-library-page'));
  window.SDT = { Base: h.base, UI: { log: h.log } };
  vi.doMock('../game/src/core/motion.js', () => ({ reduceMotion: () => true }));
  vi.doMock('../game/src/run/game.session.js', () => ({ game: h.game, getActiveSlot: () => h.slot, startNewGame: h.startNewGame }));
  vi.doMock('../game/src/hub/game.hub.depart.js', () => { throw new Error('Departure runtime must not enter the initial facade graph'); });
  vi.doMock('../game/src/hub/game.cardslib.common.js', () => {
    const common = {
      CARD_DESIGNER_WRITES_ENABLED: false, Sfx: {}, cardHTML() {}, configureCardNavigation() {},
      configurePendingCardPageEntry(cancel) { h.close = cancel; },
      closeCardPageTop() { return h.close?.(); },
      setCardPageOpen(value) { h.isOpen = value; },
    };
    Object.defineProperty(common, 'cardPageOpen', { get: () => h.isOpen });
    return common;
  });
  vi.doMock('../game/src/hub/game.hub.runtime.js', async () => {
    h.hubImports();
    await h.hubGate.promise;
    return { openBaseHub: h.openHub, closeBase: vi.fn(), renderHub: vi.fn(), renderHomeScene: h.openHub };
  });
  vi.doMock('../game/src/hub/game.cardslib.page.js', async () => {
    h.cardImports();
    await h.cardGate.promise;
    return { openCardLibrary: h.openCard, openCardDesigner: h.openCard, preparePhotoStudioEntry: async () => {}, finishPhotoStudioEntry: () => {} };
  });
  h.hub = await import('../game/src/hub/game.hub.js');
  h.selection = await import('../game/src/hub/departure.selection-state.js');
  h.cancel = await import('../game/src/ui/page-entry-cancellation.js');
  return h;
}

async function finish(promise) {
  h.hubGate.resolve(); h.cardGate.resolve();
  await vi.dynamicImportSettled();
  await vi.runAllTimersAsync();
  return promise;
}

afterEach(async () => {
  h?.cancel.cancelPendingPageEntries();
  h?.hubGate.resolve(); h?.cardGate.resolve();
  await vi.dynamicImportSettled();
  await vi.runAllTimersAsync();
  for (const file of ['core/motion', 'run/game.session', 'hub/game.hub.depart', 'hub/game.cardslib.common', 'hub/game.hub.runtime', 'hub/game.cardslib.page']) {
    vi.doUnmock(`../game/src/${file}.js`);
  }
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); h = null;
});

beforeEach(setup);

it('选档预载未选档也能准备模块，复用同一请求且不挂载或写存档', async () => {
  h.slot = null;
  const before = document.body.innerHTML;
  const write = vi.spyOn(Storage.prototype, 'setItem');
  const first = h.hub.preloadBaseHub();
  expect(h.hub.preloadBaseHub()).toBe(first);
  h.hubGate.resolve(); await vi.dynamicImportSettled(); await first;
  expect(h.hubImports).toHaveBeenCalledOnce();
  expect(h.openHub).not.toHaveBeenCalled(); expect(h.startNewGame).not.toHaveBeenCalled();
  expect(h.hub.baseHubLoading).toBe(false); expect(h.isOpen).toBe(false);
  expect(document.body.innerHTML).toBe(before); expect(write).not.toHaveBeenCalled();
});

it('点击进入复用仍在进行的预载，不二次装载且只打开基地一次', async () => {
  const prepared = h.hub.preloadBaseHub();
  const opening = h.hub.openBaseHub('deploy');
  await vi.advanceTimersByTimeAsync(32);
  await finish(opening); await prepared;
  expect(h.hubImports).toHaveBeenCalledOnce();
  expect(h.openHub).toHaveBeenCalledExactlyOnceWith('deploy');
});

it('退役家具门面冷调用不载入 runtime、不导航、不写数据', async () => {
  const before = document.body.innerHTML;
  const data = structuredClone(h.base.data);
  const write = vi.spyOn(Storage.prototype, 'setItem');
  try {
    await expect(h.hub.renderHomeScene()).resolves.toBe(false);
    await expect(h.hub.renderHomeScene()).resolves.toBe(false);
    await vi.dynamicImportSettled();
    expect(h.hubImports).not.toHaveBeenCalled();
    expect(h.openHub).not.toHaveBeenCalled();
    expect(h.startNewGame).not.toHaveBeenCalled();
    expect(document.body.innerHTML).toBe(before);
    expect(h.base.data).toEqual(data);
    expect(write).not.toHaveBeenCalled();
  } finally { write.mockRestore(); }
});

it('退役门面调用不会取消已经受理的正常基地加载', async () => {
  const pending = h.hub.openBaseHub('deploy');
  await expect(h.hub.renderHomeScene()).resolves.toBe(false);
  await finish(pending);
  expect(h.openHub).toHaveBeenCalledOnce();
  expect(document.getElementById('hubMain')).not.toBeNull();
});

describe('基地真实按需入口', () => {
  it('公开 deployPick 同步读取唯一 live binding，不提前装载整备页面', () => {
    expect(h.hub.deployPick).toBeNull();
    const picks = { 'card:live': 2 };
    h.selection.replaceDeployPick(picks);
    expect(h.hub.deployPick).toBe(picks);
    picks['card:live'] += 1;
    expect(h.hub.deployPick['card:live']).toBe(3);
    h.selection.replaceDeployPick(null);
    expect(h.hub.deployPick).toBeNull();
    expect(h.hubImports).not.toHaveBeenCalled();
  });

  it('标题等待不拉取页面，没有已选档时只打开选档', async () => {
    await vi.advanceTimersByTimeAsync(10_000);
    expect(h.hubImports).not.toHaveBeenCalled();
    h.slot = null; h.game.state = 'title';
    await expect(h.hub.openBaseHub()).resolves.toBe(false);
    expect(h.startNewGame).toHaveBeenCalledOnce();
    expect(h.hubImports).not.toHaveBeenCalled();
  });

  it('同档同入口重复点击只载入/挂载一次，共享档案原对象不变', async () => {
    const base = h.base, data = h.base.data;
    const first = h.hub.openBaseHub('deploy');
    expect(h.hub.openBaseHub('deploy')).toBe(first);
    expect(h.hub.baseHubLoading).toBe(true);
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    await vi.advanceTimersByTimeAsync(32);
    await finish(first);
    expect(h.hubImports).toHaveBeenCalledOnce();
    expect(h.openHub).toHaveBeenCalledOnce();
    expect(window.SDT.Base).toBe(base); expect(base.data).toBe(data); expect(data.coins).toBe(17);
    expect(h.hub.baseHubLoading).toBe(false);
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it.each(['Escape', 'title', 'slot', 'body', 'run'])('%s 废弃旧入口，迟到模块不会复活基地', async reason => {
    const first = h.hub.openBaseHub();
    await vi.advanceTimersByTimeAsync(32);
    if (reason === 'Escape') h.cancel.cancelPendingPageEntries();
    if (reason === 'title') { h.cancel.cancelPendingPageEntries(); h.game.state = 'title'; }
    if (reason === 'slot') { h.slot = 2; h.base.slot = 2; }
    if (reason === 'body') document.getElementById('ovBody').innerHTML = '<section>设置</section>';
    if (reason === 'run') h.game.runActive = true;
    expect(await finish(first)).toBe(false);
    expect(h.openHub).not.toHaveBeenCalled();
    expect(h.isOpen).toBe(false);
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it('已完成撤离/死亡/放弃的 done 状态允许回基地，正在对局仍拒绝', async () => {
    h.game.state = 'done';
    const opening = h.hub.openBaseHub();
    await vi.advanceTimersByTimeAsync(32); await finish(opening);
    expect(h.openHub).toHaveBeenCalledOnce();
    h.game.runActive = true;
    await expect(h.hub.openBaseHub()).resolves.toBe(false);
    expect(h.openHub).toHaveBeenCalledOnce();
  });

  it('更新基地页签最后请求获胜，旧 finally 不吞新请求', async () => {
    const old = h.hub.openBaseHub('deploy');
    await vi.advanceTimersByTimeAsync(32);
    const next = h.hub.openBaseHub('stash');
    await vi.advanceTimersByTimeAsync(32);
    expect(await finish(old)).toBe(false);
    await next;
    expect(h.openHub).toHaveBeenCalledOnce();
    expect(h.openHub).toHaveBeenCalledWith('stash');
    expect(h.hubImports).toHaveBeenCalledOnce();
  });

  it('旧 hub finally 不清新 activeEntry，新 cover 保留自己的 promise/aria-busy', async () => {
    const old = h.hub.openBaseHub('deploy'); await vi.advanceTimersByTimeAsync(32);
    const next = h.hub.openBaseHub('stash');
    expect(next).not.toBe(old);
    expect(await old).toBe(false);
    expect(h.hub.baseHubLoading).toBe(true);
    expect(h.hub.openBaseHub('stash')).toBe(next);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    expect(h.cancel.cancelPendingPageEntries()).toBe(true);
    expect(await finish(next)).toBe(false);
    expect(h.openHub).not.toHaveBeenCalled();
  });

  it('cards→hub→cards 旧 cards finally 不解除新 cards 注册或吞新 promise', async () => {
    const cards = await import('../game/src/hub/game.cardslib.js');
    const old = cards.openCardLibrary(); await vi.advanceTimersByTimeAsync(32);
    const middle = h.hub.openBaseHub(); await vi.advanceTimersByTimeAsync(32);
    const next = cards.openCardLibrary();
    expect(next).not.toBe(old);
    expect(await old).toBe(false); expect(await middle).toBe(false);
    expect(cards.cardPageLoading).toBe(true);
    expect(cards.openCardLibrary()).toBe(next);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    expect(h.cancel.cancelPendingPageEntries()).toBe(true);
    expect(await finish(next)).toBe(false);
    expect(h.openCard).not.toHaveBeenCalled(); expect(h.openHub).not.toHaveBeenCalled();
  });

  it('加载失败释放覆盖/开关/缓存；同页重试成功', async () => {
    const first = h.hub.openBaseHub();
    await vi.advanceTimersByTimeAsync(32);
    h.hubGate.reject(new Error('network unavailable'));
    await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await first).toBe(false);
    expect(h.isOpen).toBe(false); expect(h.hub.baseHubLoading).toBe(false);
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining('载入失败'), 'warn');
    // 重新提供成功的依赖，模拟瞬时下载失败后的再次 import。
    vi.doMock('../game/src/hub/game.hub.runtime.js', () => ({ openBaseHub: h.openHub, closeBase() {}, renderHub() {}, renderHomeScene: h.openHub }));
    const retry = h.hub.openBaseHub();
    await vi.runAllTimersAsync(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    await retry;
    expect(h.openHub).toHaveBeenCalledOnce();
  });

  it('终局首次下载失败保留原回基地按钮，可直接再次点击重试', async () => {
    h.game.state = 'done';
    document.getElementById('ovBody').innerHTML = '<section class="terminal-result"><button id="goBase">回基地</button></section>';
    const button = document.getElementById('goBase');
    let pending;
    button.addEventListener('click', () => { pending = h.hub.openBaseHub('deploy'); });
    button.click(); await vi.advanceTimersByTimeAsync(32);
    h.hubGate.reject(new Error('first fetch failed'));
    await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await pending).toBe(false);
    expect(h.game.state).toBe('done'); expect(button.isConnected).toBe(true);
    expect(h.isOpen).toBe(false); expect(document.querySelector('.page-loading')).toBeNull();
    vi.doMock('../game/src/hub/game.hub.runtime.js', () => ({ openBaseHub: h.openHub, closeBase() {}, renderHub() {}, renderHomeScene: h.openHub }));
    button.click(); await vi.runAllTimersAsync(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    await pending;
    expect(h.openHub).toHaveBeenCalledOnce(); expect(document.getElementById('hubMain')).not.toBeNull();
  });

  it('终局回基地入口直接返回异步结果，不提前收走可重试来源按钮', () => {
    for (const file of ['game/src/run/game.run.altar.js', 'game/src/run/game.session.death.js', 'game/src/ui/menu-leave.js']) {
      const source = readFileSync(file, 'utf8');
      expect(source).not.toMatch(/UI\.act\('(?:goBase|again)', \(\) => \{ UI\.hideOverlay\(\); (?:runtime\.)?openBaseHub/);
      expect(source).toContain('bindSettlementActions({');
      expect(source).toMatch(/goBase:\s*\(\) => (?:runtime\.)?openBaseHub\('deploy'\)/);
    }
  });

  it.each(['hub-to-cards', 'cards-to-hub'])('%s 相互取消，各自目标不会吃掉对方 loading promise', async direction => {
    const cards = await import('../game/src/hub/game.cardslib.js');
    const old = direction === 'hub-to-cards' ? h.hub.openBaseHub() : cards.openCardLibrary();
    await vi.advanceTimersByTimeAsync(32);
    const next = direction === 'hub-to-cards' ? cards.openCardLibrary() : h.hub.openBaseHub('classes');
    await vi.advanceTimersByTimeAsync(32);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(await finish(old)).toBe(false);
    await next;
    expect(h.openHub).toHaveBeenCalledTimes(direction === 'cards-to-hub' ? 1 : 0);
    expect(h.openCard).toHaveBeenCalledTimes(direction === 'hub-to-cards' ? 1 : 0);
  });

  it('基地→照相馆→设置：两份迟到模块都不得覆盖最后导航', async () => {
    const cards = await import('../game/src/hub/game.cardslib.js');
    const first = h.hub.openBaseHub(); await vi.advanceTimersByTimeAsync(32);
    const second = cards.openCardLibrary(); await vi.advanceTimersByTimeAsync(32);
    h.cancel.cancelPendingPageEntries();
    document.getElementById('ovBody').innerHTML = '<section class="settings-page">设置</section>';
    await finish(first); await second;
    expect(h.openHub).not.toHaveBeenCalled(); expect(h.openCard).not.toHaveBeenCalled();
    expect(document.querySelector('.settings-page')).not.toBeNull();
  });

  it('门面按需共享动态 import，样式保持静态且不自行安排空闲任务', () => {
    const source = readFileSync('game/src/hub/game.hub.js', 'utf8');
    expect(source).toContain("import('./game.hub.runtime.js')");
    expect(source).not.toMatch(/from ['"].*game\.hub\.runtime\.js/);
    expect(source).not.toMatch(/requestIdleCallback|setTimeout|modulepreload/);
    expect(source).toContain("import '../../css/base-personnel-v12.css'");
  });
});
