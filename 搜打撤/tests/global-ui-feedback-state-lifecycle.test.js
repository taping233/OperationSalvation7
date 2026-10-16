import { beforeAll, beforeEach, afterEach, it, expect, vi } from 'vitest';
let UI, createGameMenuController, controller, game;
let listeners, listenerSpy;
const noop=()=>{};
function dom() {
  document.body.innerHTML='<main id="viewport"><div id="heroAva"></div><div id="title"><button id="source">标题操作</button></div><div id="exitScr" hidden></div><div id="overlay" hidden tabindex="-1"><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div><div id="sugLayer" hidden><h3 id="sugHead"></h3><p id="sugWhere"></p><textarea id="sugText"></textarea><textarea id="sugSteps"></textarea><textarea id="sugExpected"></textarea><textarea id="sugActual"></textarea><button id="sugSaveBtn">保存</button><button id="sugCancelBtn">返回</button></div></main>';
}
beforeAll(async()=>{
  dom();
  window.SDT={ Icons:{rich:x=>x}, Sound:{sfx:noop,scene:noop,music:noop,musicVolume:1,sfxVolume:1}, Motion:{overlayIn:noop,reduceMotion:()=>false}, Base:{peek:()=>null}, Meta:{ACHIEVEMENTS:[]}, Cards:{} };
  ({UI}=await import('../game/src/ui/ui.js'));
  ({createGameMenuController}=await import('./helpers/menu-controller.js'));
});
beforeEach(()=>{
  vi.useFakeTimers(); vi.stubGlobal('requestAnimationFrame',fn=>setTimeout(fn,16)); vi.stubGlobal('cancelAnimationFrame',clearTimeout);
  dom(); UI._overlayInerted=[]; UI._lastMode=null; UI._hideTimer=null; UI.init(); UI.refresh=noop;
  listeners=[];
  const add=document.addEventListener.bind(document);
  listenerSpy=vi.spyOn(document,'addEventListener').mockImplementation((type,fn,options)=>{listeners.push([type,fn,options]);add(type,fn,options);});
  game={state:'title',toggles:{index:false},devMode:false};
  controller=createGameMenuController({SDT:window.SDT,UI,game,runtime:{resize:noop,syncDevVisibility:noop},SLOT_COUNT:1,readSlot:()=>null,setActiveSlot:noop,esc:String});
  controller.showTitle();
  delete window.sdtDesktop;
});
function openFeedback(){
  document.getElementById('source').dispatchEvent(new MouseEvent('contextmenu',{bubbles:true}));
  expect(game.state).toBe('modal');
}
afterEach(()=>{ listeners.forEach(([type,fn,options])=>document.removeEventListener(type,fn,options));listenerSpy.mockRestore(); UI.hideOverlay({immediate:true}); vi.clearAllTimers(); vi.useRealTimers(); vi.unstubAllGlobals(); delete window.sdtDesktop; });
it('真实反馈返回淡出结束不能覆盖较新设置页的 modal 状态',async()=>{
  openFeedback();
  document.getElementById('sugCancelBtn').click();
  controller.openSettings();
  expect(game.state).toBe('modal');
  await vi.advanceTimersByTimeAsync(250);
  expect(document.querySelector('.settings-page')).not.toBeNull();
  expect(UI.el.overlay.hidden).toBe(false);
  expect(game.state).toBe('modal');
});
it.each(['title','idle','modal'])('当前%s来源关闭时同步恢复，视觉仍沿原淡出',async source=>{
  game.state=source;
  if(source==='modal') UI.showOverlay('来源','<section id="sourcePage"><button>来源按钮</button></section>','page');
  openFeedback();
  document.getElementById('sugCancelBtn').click();
  expect(game.state).toBe(source);
  expect(document.getElementById('sugLayer').hidden).toBe(false);
  await vi.advanceTimersByTimeAsync(250);
  expect(document.getElementById('sugLayer').hidden).toBe(true);
  expect(game.state).toBe(source);
});
it('留言尚开时较新导航先接管，旧取消只关闭留言',async()=>{
  openFeedback(); controller.openSettings();
  document.getElementById('sugCancelBtn').click();
  expect(game.state).toBe('modal');
  await vi.advanceTimersByTimeAsync(250);
  expect(game.state).toBe('modal');
  expect(document.querySelector('.settings-page')).not.toBeNull();
});
it('较新导航后的迟到保存成功只收旧留言，不还原旧来源',async()=>{
  let finish; window.sdtDesktop={appendSuggestion:()=>new Promise(resolve=>{finish=resolve;})};
  openFeedback(); document.getElementById('sugText').value='旧留言';
  const pending=document.getElementById('sugSaveBtn').onclick();
  controller.openSettings(); finish(true); await pending;
  await vi.advanceTimersByTimeAsync(250);
  expect(document.getElementById('sugLayer').hidden).toBe(true);
  expect(game.state).toBe('modal');
  expect(document.querySelector('.settings-page')).not.toBeNull();
});
it('取消后较新导航与迟到保存不再产生第二次返回',async()=>{
  let finish; window.sdtDesktop={appendSuggestion:()=>new Promise(resolve=>{finish=resolve;})};
  openFeedback(); document.getElementById('sugText').value='旧留言';
  const pending=document.getElementById('sugSaveBtn').onclick();
  document.getElementById('sugCancelBtn').click(); controller.openSettings();
  finish(true); await pending; await vi.advanceTimersByTimeAsync(250);
  expect(game.state).toBe('modal');
  expect(document.querySelector('.settings-page')).not.toBeNull();
});
it('换局而原overlay未换页时旧取消不改新idle状态',async()=>{
  openFeedback(); game.discoveredPairs=new Set(); game.state='idle';
  document.getElementById('sugCancelBtn').click();
  await vi.advanceTimersByTimeAsync(250);
  expect(game.state).toBe('idle');
});
