import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../game/src/ui/settings-navigation.js', () => ({ captureSettingsNavigation:()=>null,initSettingsNavigation:()=>{}, settingsLayoutHTML:groups=>Object.values(groups).join('') }));
vi.mock('../game/src/ui/settings-input.js', () => ({ inputSettingsHTML:()=>'',bindInputSettings:()=>{} }));
vi.mock('../game/src/ui/performance-settings.js', () => ({ performanceSettingsHTML:()=>'',bindPerformanceSettings:()=>{} }));
vi.mock('../game/src/ui/settings-audio.js', () => ({ bindSettingsAudio:()=>{} }));
import { createMenuSettingsPage } from '../game/src/ui/menu-settings.js';
import { createMenuFeedbackPages } from '../game/src/ui/menu-feedback.js';
import { createMenuDataPage } from '../game/src/ui/menu-data.js';

function setup() {
  document.body.innerHTML='<section id="overlay"><div id="ovBody"></div></section>';
  const game={state:'modal',toggles:{},discoveredPairs:new Set()}, acts={};
  const UI={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},
    act:(name,fn)=>{acts[name]=fn;},showOverlay(_title,html){UI.el.ovBody.innerHTML=html;},hideOverlay:vi.fn(),confirmAction:vi.fn()};
  return {UI,game,acts};
}
afterEach(()=>document.body.replaceChildren());

describe('settings child return ownership',()=>{
  it.each(['inbox','data'])('%s rejects a return from a child whose page was replaced',kind=>{
    const {UI,game,acts}=setup(), inbox=vi.fn(),data=vi.fn(),original=vi.fn(),newer=vi.fn();
    const flow=createMenuSettingsPage({UI,game,document,runtime:{syncDevVisibility:()=>{}},getActiveSlot:()=>1,
      openSuggestionInbox:inbox,openDataPageUi:data,battleRestartHTML:()=>'',bindBattleRestart:()=>{},
      readCards:()=>({}),readNotes:()=>({}),readMotion:()=>({}),readSound:()=>({musicVolume:0,sfxVolume:0})});
    flow.openSettings({returnTo:original}); acts[kind==='inbox'?'openInbox':'openDataPageUi']();
    const [entryFlag,back]=(kind==='inbox'?inbox:data).mock.calls[0];
    expect(entryFlag).toBe(kind==='data');
    flow.openSettings({returnTo:newer}); back(); acts.closeSettings();
    expect(original).not.toHaveBeenCalled(); expect(newer).toHaveBeenCalledOnce();
  });

  it('inbox title entry keeps title return while a settings entry invokes its captured return',()=>{
    const {UI,game,acts}=setup(),back=vi.fn(),fallback=vi.fn();
    const flow=createMenuFeedbackPages({UI,game,document,esc:String,getActiveSlot:()=>1,openSettings:fallback,
      desktop:()=>({readSuggestions:async()=>({ok:true,list:[]})}),readSound:()=>({}),readIcons:()=>({rich:String})});
    flow.openSuggestionInbox(false,back); acts.sugBack(); expect(back).toHaveBeenCalledOnce();
    flow.openSuggestionInbox(true,back); acts.sugBack(); expect(game.state).toBe('title');
    expect(back).toHaveBeenCalledOnce(); expect(fallback).not.toHaveBeenCalled();
  });

  it('data page returns through its own settings callback',()=>{
    const {UI}=setup(),back=vi.fn(),fallback=vi.fn();
    const flow=createMenuDataPage({UI,document,openSettings:fallback,readIcons:()=>({rich:String}),
      openDataPage:({onRender})=>{UI.el.ovBody.innerHTML='<section class="pg"><div class="doom-stats"></div></section>';const root=UI.el.ovBody.firstElementChild;onRender({root,isCurrent:()=>root.isConnected,revision:UI._overlayRevision});}});
    flow.openDataPageUi(true,back); UI.el.ovBody.querySelector('.ak-back-tl').click();
    expect(back).toHaveBeenCalledOnce(); expect(fallback).not.toHaveBeenCalled();
  });
});
