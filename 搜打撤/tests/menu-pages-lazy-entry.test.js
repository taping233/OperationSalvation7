import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolve } from 'node:path';
import { buildModuleGraph, readModuleSources } from '../scripts/architecture-graph.mjs';

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
  document.body.innerHTML = '<div id="viewport"></div><div id="title"></div><div id="exitScr" hidden></div><div id="overlay" hidden><h2 id="ovTitle"></h2><div id="ovBody"><section>来源</section></div></div>';
  localStorage.setItem('sdt-rmb-hint','1');
  h = { game:{ state:'title', seed:'source', runActive:false, battleActive:false, toggles:{}, discoveredPairs:new Set(), ownedCards:[] },
    slot:1, gate:deferred(), imports:vi.fn(), methods:{}, acts:{}, log:vi.fn(), save:vi.fn(async () => ({ ok:true })), clear:vi.fn(),
    base:{ slot:1, peek:() => null }, factory:vi.fn(), runtime:{ resize:vi.fn() } };
  const UI = { el:{ overlay:document.getElementById('overlay'), ovBody:document.getElementById('ovBody') },
    showOverlay(title, html) { document.getElementById('ovTitle').textContent=title; this.el.ovBody.innerHTML=html; this.el.overlay.hidden=false; },
    hideOverlay() { this.el.overlay.hidden=true; }, showScreen(el) { el.hidden=false; }, hideScreen(el) { el.hidden=true; },
    refresh:vi.fn(), log:h.log, act(name, fn) { h.acts[name]=fn; } };
  h.SDT={ UI, game:h.game, Base:h.base, Sound:{ music:vi.fn(), sfx:vi.fn() }, Meta:{ ACHIEVEMENTS:[] } };
  window.SDT=h.SDT;
  h.deps={ SDT:h.SDT, UI, game:h.game, runtime:h.runtime, SLOT_COUNT:1, readSlot:() => null,
    saveSession:h.save, clearAllSlots:h.clear, getActiveSlot:() => h.slot, setActiveSlot:value => { h.slot=value; }, esc:String };
  for (const method of ['startNewGame','openSettings','openLeaveMenu','openTitleGuide','openTitleAchievements','openSuggestionInbox','openSuggestionBox','openDataPageUi']) {
    h.methods[method]=vi.fn(() => { h.game.state='modal'; UI.showOverlay(method, `<section data-page="${method}">${method}</section>`); });
  }
  h.factory.mockImplementation(() => h.methods);
  vi.doMock('../game/src/core/motion.js', () => ({ reduceMotion:() => true }));
  vi.doMock('../game/src/ui/game.menu.pages.js', async () => { h.imports(); await h.gate.promise; return { createGameMenuPages:h.factory }; });
  h.facade=await import('../game/src/ui/game.menu.js');
  h.cancellation=await import('../game/src/ui/page-entry-cancellation.js');
  h.menu=h.facade.createGameMenuController(h.deps);
});
afterEach(async () => {
  h?.cancellation.cancelPendingPageEntries(); h?.gate.resolve();
  await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
  vi.doUnmock('../game/src/ui/game.menu.pages.js'); vi.doUnmock('../game/src/core/motion.js');
  vi.useRealTimers(); vi.unstubAllGlobals(); vi.resetModules(); document.body.replaceChildren(); localStorage.clear();
});
async function finish(request) {
  h.gate.resolve(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync(); return request;
}

describe('菜单真实按需入口', () => {
  it('诊断冷模块等待保留入口事件，热打开不制造模块等待', async () => {
    window.history.replaceState({}, '', '/?runtimeTrace=1');
    const { installRuntimeTrace } = await import('../game/src/core/runtime-trace.local.js');
    const { beginRuntimeStage } = await import('../game/src/core/runtime-trace-stages.local.js');
    const trace = installRuntimeTrace();
    const button = document.createElement('button'); document.body.append(button);
    h.methods.openSettings.mockImplementation(() => { beginRuntimeStage('settings-overlay-sync')(); });
    try {
      button.click(); const request = h.menu.openSettings();
      await vi.advanceTimersByTimeAsync(32);
      button.click(); await finish(request);
      const rows = trace.read().records.filter(row => row.kind === 'stage');
      expect(rows.map(row => [row.stage, row.interaction])).toEqual([
        ['settings-module-wait', 1], ['settings-overlay-sync', 1],
      ]);
      button.click(); h.menu.openSettings();
      expect(trace.read().records.filter(row => row.stage === 'settings-module-wait')).toHaveLength(1);
      expect(trace.read().records.at(-1)).toMatchObject({ stage:'settings-overlay-sync', interaction:3 });
    } finally { trace.destroy(); window.history.replaceState({}, '', '/'); }
  });

  it('诊断模块失败只完成等待阶段，不制造页面挂载阶段', async () => {
    window.history.replaceState({}, '', '/?runtimeTrace=1');
    const { installRuntimeTrace } = await import('../game/src/core/runtime-trace.local.js');
    const trace = installRuntimeTrace();
    const button = document.createElement('button'); document.body.append(button);
    try {
      button.click(); const request = h.menu.openSettings(); await vi.advanceTimersByTimeAsync(32);
      h.gate.reject(new Error('private failure'));
      await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
      expect(await request).toBe(false);
      const rows = trace.read().records.filter(row => row.kind === 'stage');
      expect(rows).toEqual([expect.objectContaining({ stage:'settings-module-wait', interaction:1 })]);
      expect(JSON.stringify(trace.read())).not.toContain('private failure');
    } finally { trace.destroy(); window.history.replaceState({}, '', '/'); }
  });

  it('同步构造/标题与长时间空闲都不提前导入页面', async () => {
    h.menu.showTitle();
    expect(h.game.state).toBe('title'); expect(h.runtime.resize).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(10000);
    expect(h.imports).not.toHaveBeenCalled(); expect(h.factory).not.toHaveBeenCalled();
  });

  it('冷入口有可见反馈，同请求合并，热入口同步复用同一工厂', async () => {
    const game=h.game, base=h.base;
    const request=h.menu.openSettings();
    expect(h.menu.openSettings()).toBe(request);
    expect(h.facade.menuPageLoading).toBe(true);
    expect(document.querySelector('.page-loading')?.textContent).toContain('正在准备菜单内容');
    expect(document.getElementById('viewport').getAttribute('aria-busy')).toBe('true');
    await vi.advanceTimersByTimeAsync(32); await finish(request);
    expect(h.imports).toHaveBeenCalledOnce(); expect(h.factory).toHaveBeenCalledOnce();
    expect(h.methods.openSettings).toHaveBeenCalledOnce(); expect(h.facade.menuPageLoading).toBe(false);
    expect(document.querySelector('.page-loading')).toBeNull();
    expect(document.getElementById('viewport').hasAttribute('aria-busy')).toBe(false);
    expect(h.menu.openTitleGuide()).toBeUndefined();
    expect(h.methods.openTitleGuide).toHaveBeenCalledOnce(); expect(h.factory).toHaveBeenCalledOnce();
    expect(window.SDT.game).toBe(game); expect(window.SDT.Base).toBe(base);
    expect(h.save).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
  });

  it('真实按钮连续click忽略不同MouseEvent对象并复用同一冷请求', async () => {
    document.getElementById('title').innerHTML='<button id="mGuide">指南</button>';
    h.menu.showTitle(); const button=document.getElementById('mGuide');
    button.click(); const cover=document.querySelector('.page-loading');
    button.click(); expect(document.querySelector('.page-loading')).toBe(cover);
    await vi.advanceTimersByTimeAsync(32); await finish();
    expect(h.imports).toHaveBeenCalledOnce(); expect(h.factory).toHaveBeenCalledOnce(); expect(h.methods.openTitleGuide).toHaveBeenCalledExactlyOnceWith();
  });

  it('不同面板最后意图优先，旧finally不清掉新载入状态', async () => {
    const old=h.menu.openSettings(); await vi.advanceTimersByTimeAsync(32);
    const next=h.menu.openSuggestionInbox(true);
    await old;
    expect(h.facade.menuPageLoading).toBe(true); expect(document.querySelectorAll('.page-loading')).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(32); expect(await finish(old)).toBe(false); await next;
    expect(h.imports).toHaveBeenCalledOnce(); expect(h.factory).toHaveBeenCalledOnce();
    expect(h.methods.openSettings).not.toHaveBeenCalled();
    expect(h.methods.openSuggestionInbox).toHaveBeenCalledExactlyOnceWith(true);
  });

  it.each(['Escape','title','slot','base-owner','run','state','body','hidden','other-page'])('%s取消或换上下文后迟到页面不能复活/执行存档动作', async reason => {
    const before=localStorage.length;
    const request=h.menu.openLeaveMenu(); await vi.advanceTimersByTimeAsync(32);
    if (reason==='Escape') expect(h.facade.cancelPendingMenuPageOpen()).toBe(true);
    if (reason==='title') h.menu.showTitle();
    if (reason==='slot') h.slot=2;
    if (reason==='base-owner') h.SDT.Base={ ...h.base };
    if (reason==='run') h.game.discoveredPairs=new Set();
    if (reason==='state') h.game.state='done';
    if (reason==='body') h.deps.UI.el.ovBody.innerHTML='<section>新页面</section>';
    if (reason==='hidden') h.deps.UI.el.overlay.hidden=false;
    const otherCancel=() => false;
    if (reason==='other-page') h.cancellation.beginPageEntryCancellation('other-test', otherCancel);
    expect(await finish(request)).toBe(false);
    expect(h.methods.openLeaveMenu).not.toHaveBeenCalled(); expect(h.factory).not.toHaveBeenCalled();
    expect(h.save).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled(); expect(localStorage.length).toBe(before);
    expect(document.querySelector('.page-loading')).toBeNull(); expect(h.facade.menuPageLoading).toBe(false);
    h.cancellation.releasePageEntryCancellation('other-test', otherCancel);
  });

  it('取消后再次打开复用已到达模块，只实例化/挂载一次', async () => {
    const first=h.menu.startNewGame(); await vi.advanceTimersByTimeAsync(32);
    h.facade.cancelPendingMenuPageOpen(); await finish(first);
    const second=h.menu.startNewGame(); await vi.runAllTimersAsync(); await second;
    expect(h.imports).toHaveBeenCalledOnce(); expect(h.factory).toHaveBeenCalledOnce();
    expect(h.methods.startNewGame).toHaveBeenCalledOnce();
  });

  it('导入失败保留来源并给出反馈，下一次请求真正重试且可成功', async () => {
    const failure=deferred(); const load=vi.fn().mockReturnValueOnce(failure.promise).mockResolvedValue({ createGameMenuPages:h.factory });
    const menu=h.facade.createGameMenuController(h.deps, { loadPages:load });
    const root=h.deps.UI.el.ovBody.firstElementChild;
    const first=menu.openSettings(); await vi.advanceTimersByTimeAsync(32); failure.reject(new Error('网络中断'));
    await vi.runAllTimersAsync(); expect(await first).toBe(false);
    expect(h.log).toHaveBeenCalledWith(expect.stringContaining('页面加载失败，请重试'), 'warn');
    expect(h.deps.UI.el.ovBody.firstElementChild).toBe(root); expect(h.game.state).toBe('title');
    const second=menu.openSettings(); await vi.runAllTimersAsync(); await second;
    expect(load).toHaveBeenCalledTimes(2); expect(h.factory).toHaveBeenCalledOnce(); expect(h.methods.openSettings).toHaveBeenCalledOnce();
  });

  it('生产默认导入失败也清掉缓存，原入口下一次点击可重新导入', async () => {
    const first=h.menu.openSettings(); await vi.advanceTimersByTimeAsync(32);
    h.gate.reject(new Error('首次模块请求失败')); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await first).toBe(false); expect(h.factory).not.toHaveBeenCalled();
    vi.doMock('../game/src/ui/game.menu.pages.js', () => ({ createGameMenuPages:h.factory }));
    const second=h.menu.openSettings(); await vi.runAllTimersAsync(); await vi.dynamicImportSettled(); await vi.runAllTimersAsync();
    expect(await second).not.toBe(false); expect(h.factory).toHaveBeenCalledOnce(); expect(h.methods.openSettings).toHaveBeenCalledOnce();
  });

  it('退出等待完整保存回执并取消迟到页面', async () => {
    const request=h.menu.openLeaveMenu(); await vi.advanceTimersByTimeAsync(32);
    await h.menu.quitGame(); expect(h.save).toHaveBeenCalledOnce(); expect(document.getElementById('exitScr').hidden).toBe(false);
    expect(await finish(request)).toBe(false); expect(h.methods.openLeaveMenu).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
  });

  it('真实离开页冷加载可取消；重试挂载也不保存，只有明确点击保存才调用一次', async () => {
    const gate=deferred(); const real=await vi.importActual('../game/src/ui/game.menu.pages.js');
    const load=vi.fn(() => gate.promise); const menu=h.facade.createGameMenuController(h.deps,{ loadPages:load });
    const old=menu.openLeaveMenu(); await vi.advanceTimersByTimeAsync(32);
    h.facade.cancelPendingMenuPageOpen(); gate.resolve(real); await vi.runAllTimersAsync(); expect(await old).toBe(false);
    expect(h.save).not.toHaveBeenCalled(); expect(h.acts.leaveSave).toBeUndefined();
    const next=menu.openLeaveMenu(); await vi.runAllTimersAsync(); await next;
    expect(document.querySelector('[data-act="leaveSave"]')).not.toBeNull();
    expect(h.save).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
    await h.acts.leaveSave(); expect(h.save).toHaveBeenCalledOnce(); expect(h.game.state).toBe('title');
  });

  it.each(['startNewGame','openSettings'])('真实%s冷挂载不会被页面自己的取消仲裁误取消', async method => {
    const real=await vi.importActual('../game/src/ui/game.menu.pages.js');
    const menu=h.facade.createGameMenuController(h.deps,{ loadPages:async () => real });
    const request=menu[method](); await vi.runAllTimersAsync();
    expect(await request).not.toBe(false); expect(h.facade.menuPageLoading).toBe(false);
    expect(h.deps.UI.el.overlay.hidden).toBe(false); expect(document.querySelector('.page-loading')).toBeNull();
    expect(h.save).not.toHaveBeenCalled(); expect(h.clear).not.toHaveBeenCalled();
  });

  it('初始静态图不反穿页面与独占渲染依赖，页面不静态依赖会话', () => {
    const graph=buildModuleGraph(readModuleSources(resolve(process.cwd(),'game/src')));
    const reachable=new Set(); const visit=id => { if(reachable.has(id))return; reachable.add(id); for(const dep of graph.get(id)?.dependencies || [])if(dep.kind!=='dynamic')visit(dep.target); };
    visit('main.js');
    for(const file of ['ui/game.menu.pages.js','ui/achievement-gallery.js','ui/achievement-motion.js','ui/beginner-guide.js','ui/beginner-guide-diagrams.js','ui/feedback.local.js','ui/slot-emblems.js','ui/settings-navigation.js']) expect(reachable.has(file),file).toBe(false);
    expect(graph.get('ui/game.menu.pages.js').dependencies.some(dep=>dep.target==='run/game.session.js')).toBe(false);
  });
});
