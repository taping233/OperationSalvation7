import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRunEventController } from '../game/src/run/game.run.events.js';
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const narrative = text => ({ intro:text, choices:[{label:'继续',choose:()=> '已记录'}] });
const flush = async () => { for (let i=0;i<12;i++) await Promise.resolve(); };
function harness() {
  document.body.innerHTML='<div id="overlay"><div id="body"><div class="flow-transition"></div></div></div>';
  const card={id:'ownership-custom-event',type:'事件',name:'普通事件',desc:'原描述'};
  const game={state:'idle',layerIdx:0,trackPos:1,nodeRewards:{},visited:{},seed:1,ownedCards:[],hp:30,maxHp:30};
  const UI={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('body')},_overlayRevision:1,
    acts:{},act(name,fn){this.acts[name]=fn;},refresh:vi.fn(),hideOverlay:vi.fn(),log:vi.fn()};
  const nodeShell=vi.fn(spec=>{UI._overlayRevision++;UI.el.overlay.hidden=false;UI.el.overlay.classList.remove('closing');delete UI.el.overlay.dataset.uiClosing;
    UI.el.ovBody.innerHTML=`<section><h1>${spec.title}</h1><p>${spec.sub||''}</p>${spec.body}${spec.foot||''}</section>`;});
  const story=deferred(),commit=deferred();let back;
  const ports={game,UI,nodeShell,enterNode:async()=>true,getCards:()=>({all:()=>[card]}),pick:deck=>deck[0],
    eventOptionHTML:(_choice,index)=>`<button data-act="evtChoice" data-i="${index}">继续</button>`,eventNarrative:vi.fn(()=>story.promise),lastLampNarrative:vi.fn(),storyCommands:{record:vi.fn()},
    captureRunContext:()=>()=>true,createCardChoice:()=>({resume:()=>false}),setBagReturnHook:fn=>{back=fn;},
    setCardPageOpen:vi.fn(),bagSlots:{showBackpack:()=>nodeShell({title:'背包',body:''})},
    saveGame:vi.fn(()=>true),consumeCurrentCell:vi.fn(),sound:vi.fn(),serializeReward:()=>({})};
  return {...ports,story,commit,controller:createRunEventController(ports),back:()=>back?.()};
}
const replace=h=>h.nodeShell({title:'设置',body:''});
afterEach(()=>document.body.replaceChildren());
describe('普通事件叙事所有权与旧系列退役',()=>{
  it('drops late narrative after another same-node page takes ownership',async()=>{
    const h=harness(),opening=h.controller.runEventDeck();await flush();replace(h);h.story.resolve(narrative('旧叙事'));await opening;
    expect(h.UI.el.ovBody.textContent).toBe('设置');expect(h.consumeCurrentCell).not.toHaveBeenCalled();
  });
  it('does not resurrect a narrative after a replacement page opens then closes',async()=>{
    const h=harness(),opening=h.controller.runEventDeck();await flush();replace(h);h.UI._overlayRevision++;h.UI.el.ovBody.replaceChildren();h.UI.el.overlay.hidden=true;
    h.story.resolve(narrative('旧叙事'));await opening;expect(h.UI.el.ovBody.textContent).toBe('');
  });
  it('allows the original completed transition to finish clearing naturally',async()=>{
    const h=harness();h.UI.el.overlay.dataset.uiClosing='1';const opening=h.controller.runEventDeck();await flush();
    h.UI._overlayRevision++;h.UI.el.ovBody.replaceChildren();h.UI.el.overlay.hidden=true;h.story.resolve(narrative('当前叙事'));await opening;
    expect(h.UI.el.ovBody.textContent).toContain('当前叙事');expect(h.UI.acts.evtNext).toBeTypeOf('function');
  });
  it('a newer event request invalidates an earlier same-node narrative',async()=>{
    const h=harness(),next=deferred();h.eventNarrative.mockImplementationOnce(()=>h.story.promise).mockImplementationOnce(()=>next.promise);
    const first=h.controller.runEventDeck();await flush();const second=h.controller.runEventDeck();await flush();
    next.resolve(narrative('新叙事'));await second;h.story.resolve(narrative('旧叙事'));await first;
    expect(h.UI.el.ovBody.textContent).toContain('新叙事');expect(h.UI.el.ovBody.textContent).not.toContain('旧叙事');
  });
  it.each(['page','closing','uiClosing','detached'])('keeps the bound event without late presentation after checkpoint and %s',async change=>{
    const h=harness();h.UI.el.ovBody.innerHTML='<main>当前页面</main>';h.saveGame.mockReturnValueOnce(h.commit.promise);const opening=h.controller.runEventDeck();await flush();
    if(change==='page')replace(h);if(change==='closing')h.UI.el.overlay.classList.add('closing');if(change==='uiClosing')h.UI.el.overlay.dataset.uiClosing='1';if(change==='detached')h.UI.el.overlay.remove();
    const count=h.nodeShell.mock.calls.length;h.commit.resolve(true);await opening;
    expect(h.nodeShell).toHaveBeenCalledTimes(count);expect(h.eventNarrative).not.toHaveBeenCalled();expect(h.consumeCurrentCell).not.toHaveBeenCalled();
    expect(h.game.nodeRewards['0,1'].eventId).toBe('ownership-custom-event');expect(h.lastLampNarrative).not.toHaveBeenCalled();expect(h.storyCommands.record).not.toHaveBeenCalled();
  });
  it('old ordinary-event actions cannot settle another page',async()=>{
    const h=harness();h.story.resolve(narrative('叙事'));await h.controller.runEventDeck();const stale=h.UI.acts.evtChoice;replace(h);await stale({i:0});expect(h.consumeCurrentCell).not.toHaveBeenCalled();
  });
  it('a failed checkpoint cannot redraw another page or restore the retired series',async()=>{
    const h=harness();h.UI.el.ovBody.innerHTML='<main>当前页面</main>';h.saveGame.mockReturnValueOnce(h.commit.promise);const opening=h.controller.runEventDeck();await flush();replace(h);h.commit.resolve(false);await opening;
    expect(h.UI.el.ovBody.textContent).toBe('设置');expect(h.storyCommands.record).not.toHaveBeenCalled();expect(h.UI.acts.lastLampChoiceRetry).toBeUndefined();
  });
  it('bag return uses a fresh ordinary page and invalidates its old finish action',async()=>{
    const h=harness();h.story.resolve(narrative('叙事'));await h.controller.runEventDeck();const stale=h.UI.acts.evtChoice;h.UI.acts.evtBag();await stale({i:0});expect(h.consumeCurrentCell).not.toHaveBeenCalled();
    h.back();expect(h.UI.el.ovBody.textContent).toContain('叙事');await h.UI.acts.evtChoice({i:0});await flush();expect(h.consumeCurrentCell).toHaveBeenCalledOnce();expect(h.storyCommands.record).not.toHaveBeenCalled();
  });
});
