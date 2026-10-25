import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
let UI, createGameMenuController, controller, rebuild, clear;
const noop=()=>{};
function dom() {
  document.body.innerHTML='<main id="viewport"><div id="heroAva"></div><div id="title"></div><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
}
beforeAll(async () => {
  dom();
  window.SDT={ Icons:{rich:x=>x}, Sound:{sfx:noop,scene:noop,musicVolume:1,sfxVolume:1}, Motion:{overlayIn:noop} };
  ({UI}=await import('../game/src/ui/ui.js'));
  ({createGameMenuController}=await import('./helpers/menu-controller.js'));
});
beforeEach(() => {
  vi.useFakeTimers(); vi.stubGlobal('requestAnimationFrame',fn=>setTimeout(fn,16)); vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  dom(); UI._lastMode=null; UI._hideTimer=null; UI._overlayInerted=[]; UI._acts={}; UI.init();
  clear=vi.fn(()=>false); rebuild=vi.fn();
  const game={state:'title',toggles:{index:false},devMode:false};
  const SDT=window.SDT;
  SDT.Notes={clearAll:clear}; SDT.Cards={clearAll:noop};
  controller=createGameMenuController({SDT,UI,game,runtime:{rebuildNotes:rebuild,syncDevVisibility:noop}});
  UI.log=vi.fn();
  controller.openSettings();
  document.querySelector('#settings-tab-general').click();
  document.querySelector('.settings-danger').closest('details').open=true;
});
afterEach(() => { document.querySelector('[data-confirm-cancel]')?.click(); UI.hideOverlay({immediate:true}); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); });
describe('真实设置入口清空备注回执',()=>{
  it('首次只确认；失败时不重建或报告已清空，提示原内容保留',async ()=>{
    const button=document.querySelector('[data-act="wipeNotes"]'); button.click();
    expect(clear).not.toHaveBeenCalled();
    document.querySelector('[data-confirm-submit]').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(clear).toHaveBeenCalledOnce();
    expect(rebuild).not.toHaveBeenCalled();
    expect(UI.log).not.toHaveBeenCalledWith('已清空全部格子备注','warn');
    expect(UI.log).toHaveBeenCalledWith(expect.stringContaining('原内容已保留'),'warn');
  });
  it('失败重试真实成功后才重建并显示完成',async ()=>{
    const button=document.querySelector('[data-act="wipeNotes"]'); button.click(); document.querySelector('[data-confirm-submit]').click();
    await vi.advanceTimersByTimeAsync(0);
    clear.mockReturnValue(true); document.querySelector('[data-confirm-submit]').click();
    await vi.advanceTimersByTimeAsync(0);
    expect(clear).toHaveBeenCalledTimes(2); expect(rebuild).toHaveBeenCalledOnce();
    expect(UI.log).toHaveBeenLastCalledWith('已清空全部格子备注','warn');
  });
});
