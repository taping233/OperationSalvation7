import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRunResourceController } from '../game/src/run/game.run.resources.js';
import { createEventLifecycle } from '../game/src/run/event-lifecycle.js';

const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const cards=[{id:'ownership-wood',name:'木材',type:'资源',rarity:'古朴'},{id:'ownership-rations',name:'口粮',type:'资源',rarity:'古朴'}];
function harness() {
  document.body.innerHTML='<div id="overlay"><div id="ovBody"></div></div>';
  const UI={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},_acts:{},
    act(name,action){this._acts[name]=action;},log:vi.fn(),refresh:vi.fn(),
    showOverlay:vi.fn((_title,html)=>{UI.el.ovBody.innerHTML=html;UI.el.overlay.hidden=false;}),
    hideOverlay:vi.fn(()=>{UI.el.overlay.hidden=true;})};
  const game={seed:'same-run',runActive:true,state:'modal',layerIdx:0,trackPos:1,layerData:[{}],discoveredPairs:new Set(),nodeRewards:{},ownedCards:[],visited:{},coins:18,canReceiveCard:()=>true};
  const save=vi.fn(async()=>true),grant=vi.fn(card=>{game.ownedCards.push({uid:`owned-${game.ownedCards.length}`,card});return true;}),consume=vi.fn(()=>{game.visited['0,1']=1;});
  const setBagReturnHook=vi.fn();
  const resources=createRunResourceController({game,UI,dom:document,getCards:()=>({all:()=>cards,DROP_WEIGHTS:{古朴:1},isRandomObtainable:()=>true,cardHTML:card=>`<div class="hs-card">${card.name}</div>`}),rich:html=>html,saveGame:save,
    captureRunContext:()=>()=>true,grantEventCard:grant,consumeCurrentCell:consume,setBagReturnHook,bagSlots:{showBackpack(){}}});
  const replace=()=>{UI.showOverlay('系统菜单','<main id="replacement"><button>系统操作</button><p>原阅读状态</p></main>');return UI.el.ovBody.firstElementChild;};
  return {UI,game,save,grant,consume,setBagReturnHook,resources,replace};
}
beforeEach(()=>{window.SDT ||= {};window.SDT.Cards={cardHTML:card=>`<div>${card.name}</div>`};});
afterEach(()=>{document.body.innerHTML='';vi.restoreAllMocks();});
async function grantedResource(h) {
  const done=vi.fn();await h.resources.openResourcePick(done);
  h.save.mockResolvedValueOnce(false);await h.UI._acts.resTake({i:0});
  expect(h.game.ownedCards).toHaveLength(1);expect(h.game.nodeRewards['0,1'].taken).toBe(0);
  return done;
}

describe('保存等待期间页面被替换的并发回归',()=>{
  it.each([true,false])('资源重试保存完成=%s，不重渲系统菜单也不重发已领卡',async saved=>{
    const h=harness();await grantedResource(h);const gate=deferred(),retry=h.UI._acts.resRetrySave,take=h.UI._acts.resTake;
    h.save.mockReturnValueOnce(gate.promise);const saving=retry();const saveCount=h.save.mock.calls.length;
    const replacement=h.replace(),refreshCount=h.UI.refresh.mock.calls.length;
    gate.resolve(saved);await saving;await retry();await take({i:0});
    expect(h.UI.el.ovBody.firstElementChild).toBe(replacement);expect(replacement.textContent).toContain('原阅读状态');expect(h.UI.el.overlay.hidden).toBe(false);
    expect(h.UI.refresh).toHaveBeenCalledTimes(refreshCount);expect(h.save).toHaveBeenCalledTimes(saveCount);expect(h.grant).toHaveBeenCalledOnce();expect(h.consume).toHaveBeenCalledOnce();expect(h.game.ownedCards).toHaveLength(1);
  });
  it.each([true,false])('资源退出保存完成=%s，不关闭新背包页也不再次发放',async saved=>{
    const h=harness(),done=await grantedResource(h);const gate=deferred(),skip=h.UI._acts.resSkip,take=h.UI._acts.resTake;
    h.save.mockReturnValueOnce(gate.promise);const saving=skip();const saveCount=h.save.mock.calls.length;
    const replacement=h.replace();gate.resolve(saved);expect(await saving).toBe(false);await skip();await take({i:1});
    expect(h.UI.el.ovBody.firstElementChild).toBe(replacement);expect(h.UI.el.overlay.hidden).toBe(false);expect(h.UI.hideOverlay).not.toHaveBeenCalled();expect(done).not.toHaveBeenCalled();
    expect(h.game.state).toBe('modal');expect(h.save).toHaveBeenCalledTimes(saveCount);expect(h.grant).toHaveBeenCalledOnce();expect(h.game.ownedCards).toHaveLength(1);
  });
  it.each([true,false])('事件退出保存完成=%s，同一探索中的新页面不被关闭或替换成保存失败页',async saved=>{
    const h=harness();const lifecycle=createEventLifecycle({game:h.game,UI:h.UI,saveGame:h.save,
      nodeShell:({body})=>h.UI.showOverlay('',`<main>${body}</main>`),nodeOpt:action=>`<button data-act="${action}">重试</button>`,captureRunContext:()=>()=>true,
      createCardChoice:()=>({resume:()=>false}),setBagReturnHook:h.setBagReturnHook});
    lifecycle.eventNodeShell({body:'<button data-act="eventExit">返回地图</button>'});const oldExit=h.UI._acts.eventExit;
    const gate=deferred();h.save.mockReturnValueOnce(gate.promise);const saving=lifecycle.closeEventFlow(),saveCount=h.save.mock.calls.length;
    const replacement=h.replace();gate.resolve(saved);expect(await saving).toBe(false);await oldExit();
    expect(h.UI.el.ovBody.firstElementChild).toBe(replacement);expect(h.UI.el.overlay.hidden).toBe(false);expect(h.UI.hideOverlay).not.toHaveBeenCalled();expect(h.UI.refresh).not.toHaveBeenCalled();
    expect(h.game.state).toBe('modal');expect(h.game.coins).toBe(18);expect(h.game.visited).toEqual({});expect(h.game.ownedCards).toEqual([]);expect(h.save).toHaveBeenCalledTimes(saveCount);expect(h.grant).not.toHaveBeenCalled();
  });
});
