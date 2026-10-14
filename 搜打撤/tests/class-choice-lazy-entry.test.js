import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { architectureViolations, buildModuleGraph, readModuleSources } from '../scripts/architecture-graph.mjs';

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
let h;
beforeEach(async () => {
  vi.resetModules(); vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', callback => setTimeout(callback, 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  document.body.innerHTML = '<div id="viewport"></div><div id="overlay"><div id="ovBody"><section id="hubMain"><button id="deploy">选择人物</button></section></div></div>';
  h = { slot: 1, game: { state:'modal', runActive:false, seed:'same', discoveredPairs:new Set(), myClass:null },
    base: { slot:1, data:{ coins:17 } }, gate:deferred(), imports:vi.fn(), exit:vi.fn(), log:vi.fn(), cancel:vi.fn(), actions:{} };
  h.open = vi.fn(() => {
    document.getElementById('ovBody').innerHTML = '<section class="cls2-page">人物选择</section>';
    return true;
  });
  window.SDT = { game:h.game, Base:h.base, UI:{ log:h.log,
    showOverlay:vi.fn((_title, html) => { document.getElementById('ovBody').innerHTML = html; }),
    act:(name, action) => { h.actions[name] = action; } } };
  vi.doMock('../game/src/core/motion.js', () => ({ reduceMotion: () => true }));
  vi.doMock('../game/src/run/game.session.js', () => ({ game:h.game, getActiveSlot:() => h.slot, exitToTitle:h.exit }));
  vi.doMock('../game/src/run/game.run.class-choice.page.js', async () => {
    h.imports(); await h.gate.promise; return { openClassChoice:h.open };
  });
  h.facade = await import('../game/src/run/game.run.class-choice.js');
  h.cancellation = await import('../game/src/ui/page-entry-cancellation.js');
});
afterEach(async () => {
  h?.cancellation.cancelPendingPageEntries(); h?.gate.resolve();
  await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
  for (const file of ['core/motion', 'run/game.session', 'run/game.run.class-choice.page']) vi.doUnmock(`../game/src/${file}.js`);
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren();
});
async function finish(request) {
  h.gate.resolve(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync(); return request;
}

describe('选角真实按需叶入口', () => {
  it('等待标题/基地不导入页面，战斗/巢穴/标题状态也不偷偷加载', async () => {
    await vi.advanceTimersByTimeAsync(10_000); expect(h.imports).not.toHaveBeenCalled();
    for (const state of ['title', 'moving', 'done']) {
      h.game.state = state; await expect(h.facade.openClassChoice()).resolves.toBe(false);
    }
    h.game.state = 'modal'; h.game.battleActive = true;
    await expect(h.facade.openClassChoice()).resolves.toBe(false);
    h.game.battleActive = false; h.game.nestActive = true;
    await expect(h.facade.openClassChoice()).resolves.toBe(false);
    expect(h.imports).not.toHaveBeenCalled();
  });

  it('重复请求共用 Promise/一次导入一次挂载，保留 Base/game 原对象', async () => {
    const base = h.base, data = h.base.data, game = h.game;
    const request = h.facade.openClassChoice({ onCancel:h.cancel });
    expect(h.facade.openClassChoice({ onCancel:h.cancel })).toBe(request);
    await vi.advanceTimersByTimeAsync(32); await finish(request);
    expect(h.imports).toHaveBeenCalledOnce(); expect(h.open).toHaveBeenCalledOnce();
    expect(window.SDT.Base).toBe(base); expect(base.data).toBe(data); expect(window.SDT.game).toBe(game);
    expect(data.coins).toBe(17); expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
  });

  it.each(['slot', 'base-owner', 'body', 'title', 'run', 'class', 'state', 'source-hidden', 'options'])('等待时 %s 改变使迟到模块失效', async reason => {
    let optionCurrent = true;
    const request = h.facade.openClassChoice({ onCancel:h.cancel, isCurrent:() => optionCurrent });
    await vi.advanceTimersByTimeAsync(32);
    if (reason === 'slot') { h.slot = 2; h.base.slot = 2; }
    if (reason === 'base-owner') window.SDT.Base = { ...h.base };
    if (reason === 'body') document.getElementById('ovBody').innerHTML = '<section>设置</section>';
    if (reason === 'title') { h.cancellation.cancelPendingPageEntries(); h.game.state = 'title'; }
    if (reason === 'run') h.game.discoveredPairs = new Set();
    if (reason === 'class') h.game.myClass = '战士';
    if (reason === 'state') h.game.state = 'idle';
    if (reason === 'source-hidden') document.getElementById('overlay').hidden = true;
    if (reason === 'options') optionCurrent = false;
    expect(await finish(request)).toBe(false); expect(h.open).not.toHaveBeenCalled();
    expect(h.cancel).not.toHaveBeenCalled(); expect(h.exit).not.toHaveBeenCalled();
    expect(document.querySelector('.page-loading')).toBeNull();
  });

  it.each([false, true])('Escape取消返回来源；恢复未选角run由选档消费方处理（%s）', async recoveringRun => {
    h.game.runActive = recoveringRun;
    const request = h.facade.openClassChoice({ recoveringRun, ...(recoveringRun ? {} : { onCancel:h.cancel }) });
    await vi.advanceTimersByTimeAsync(32);
    const event = new KeyboardEvent('keydown', { key:'Escape', bubbles:true, cancelable:true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(await request).toBe(false);
    expect(h.game.runActive).toBe(recoveringRun);
    expect(h.cancel).toHaveBeenCalledTimes(recoveringRun ? 0 : 1);
    expect(h.exit).not.toHaveBeenCalled(); await finish(request); expect(h.open).not.toHaveBeenCalled();
  });

  it('直接newRun取消回标题；输入法组合及repeat不会取消', async () => {
    h.game.runActive = true;
    const request = h.facade.openClassChoice(); await vi.advanceTimersByTimeAsync(32);
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', isComposing:true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', repeat:true }));
    expect(h.exit).not.toHaveBeenCalled();
    window.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape' }));
    expect(await request).toBe(false); expect(h.exit).toHaveBeenCalledOnce();
  });

  it('网络失败保留基地原按钮，释放cover/缓存后同按钮可重试', async () => {
    const button = document.getElementById('deploy'); let request;
    button.addEventListener('click', () => { request = h.facade.openClassChoice({ onCancel:h.cancel }); });
    button.click(); await vi.advanceTimersByTimeAsync(32); h.gate.reject(new Error('offline'));
    await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await request).toBe(false); expect(button.isConnected).toBe(true);
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining('进度已保留'), 'warn');
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
    vi.doMock('../game/src/run/game.run.class-choice.page.js', () => ({ openClassChoice:h.open }));
    button.click(); await vi.runAllTimersAsync(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await request).toBe(true); expect(h.open).toHaveBeenCalledOnce();
  });

  it('直接newRun失败提供重试，重试只开选角，不重新准备出征', async () => {
    h.game.state = 'idle'; h.game.runActive = true;
    const runToken = h.game.discoveredPairs;
    const request = h.facade.openClassChoice(); await vi.advanceTimersByTimeAsync(32);
    h.gate.reject(new Error('offline')); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await request).toBe(false); expect(h.game.state).toBe('modal');
    expect(document.querySelector('[data-act="retryClassChoice"]')).not.toBeNull();
    vi.doMock('../game/src/run/game.run.class-choice.page.js', () => ({ openClassChoice:h.open }));
    const retry = h.actions.retryClassChoice(); await vi.runAllTimersAsync(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await retry).toBe(true); expect(h.game.discoveredPairs).toBe(runToken); expect(h.game.runActive).toBe(true);
  });

  it('换请求时旧finally不会清新Promise/cover/取消注册', async () => {
    const first = h.facade.openClassChoice({ initialCharacter:'wu', onCancel:h.cancel });
    await vi.advanceTimersByTimeAsync(32);
    const next = h.facade.openClassChoice({ initialCharacter:'baita', onCancel:h.cancel });
    expect(await first).toBe(false);
    expect(h.facade.openClassChoice({ initialCharacter:'baita', onCancel:h.cancel })).toBe(next);
    expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    expect(h.cancellation.cancelPendingPageEntries()).toBe(true);
    expect(await finish(next)).toBe(false); expect(h.open).not.toHaveBeenCalled();
  });

  it('其他页面互斥会取消选角，旧模块不会复活；加载成功但空卡池仍报告false', async () => {
    const first = h.facade.openClassChoice({ onCancel:h.cancel }); await vi.advanceTimersByTimeAsync(32);
    const otherCancel = vi.fn(() => true);
    h.cancellation.beginPageEntryCancellation('other-page', otherCancel);
    expect(await finish(first)).toBe(false); expect(h.open).not.toHaveBeenCalled();
    h.open.mockReturnValue(false);
    const empty = h.facade.openClassChoice({ onCancel:h.cancel }); await finish(empty);
    expect(await empty).toBe(false); expect(otherCancel).toHaveBeenCalledOnce();
  });
});

describe('选角首屏边界守卫', () => {
  it('叶实现/人物动效不在main静态闭包，门面仅字面量动态加载，无idle预取', () => {
    const graph = buildModuleGraph(readModuleSources(resolve('game/src')));
    const visited = new Set();
    const visit = name => { if (visited.has(name)) return; visited.add(name);
      for (const edge of graph.get(name)?.dependencies || []) if (edge.kind !== 'dynamic') visit(edge.target); };
    visit('main.js');
    expect(visited.has('run/game.run.class-choice.js')).toBe(true);
    expect(visited.has('run/game.run.class-choice.page.js')).toBe(false);
    expect(visited.has('ui/character-view-motion.js')).toBe(false);
    const facade = readFileSync('game/src/run/game.run.class-choice.js', 'utf8');
    expect(facade).toContain("import('./game.run.class-choice.page.js')");
    expect(facade).not.toMatch(/requestIdleCallback|postTask|setTimeout|manualChunks/);
  });
  it.each(["import './game.run.class-choice.page.js';", "export { openClassChoice } from './game.run.class-choice.page.js';"])(
    '禁止门面静态拉回页面：%s', statement => {
      const sources = new Map([['run/game.run.class-choice.js', statement], ['run/game.run.class-choice.page.js', 'export const openClassChoice = true;']]);
      expect(architectureViolations(buildModuleGraph(sources))).toContain(
        'run/game.run.class-choice.js:1: run/game.run.class-choice.page.js 只能由 run/game.run.class-choice.js 动态加载');
    });
});
