vi.mock('../game/src/ui/region-transition.js',()=>({transitionRegion:async(_root,render)=>{render();return true;},cancelRegionTransition(){}}));
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmAction } from '../game/src/ui/confirm-dialog.js';
import { registerScreenOwner, currentScreenOwner, gameplayInputAllowed } from '../game/src/ui/screen-owner.js';
import { bindInputSettings, inputSettingsHTML } from '../game/src/ui/settings-input.js';
import { Input } from '../game/src/core/input.js';
import { installRunTopBar } from '../game/src/ui/run-top-bar.js';
import { collectCardTips } from '../game/src/ui/card-tip-groups.js';
import { bindEndTurnHold } from '../game/src/ui/end-turn-hold.js';
import { settingsLayoutHTML, initSettingsNavigation } from '../game/src/ui/settings-navigation.js';
import { createCombatRuntime } from '../game/src/battle/core/combat.factory.js';

let UI; const releases=[];
const key=(target,value,extra={})=>{const event=new KeyboardEvent('keydown',{key:value,bubbles:true,cancelable:true,...extra});target.dispatchEvent(event);return event;};
const flush=()=>vi.advanceTimersByTimeAsync(0);
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const cardA={id:'ui-a',name:'甲牌',type:'法术',cost:1,desc:'造成法术伤害',dmg:3,dmgType:'spell'};
const cardB={...cardA,id:'ui-b',name:'乙牌',desc:'获得1层闪避'};
beforeAll(async()=>{
  window.SDT ||= {}; Object.assign(window.SDT,{Icons:{rich:x=>x,img:()=>'',TYPE_ART:{}},Sound:{sfx(){},scene(){}},
    Cards:{all:()=>[cardA,cardB],cardHTML:card=>`<div class="hs-card"><h3>${card.name}</h3><div class="hsc-desc">${card.desc}</div></div>`,deriveDraw:()=>0}});
  ({UI}=await import('../game/src/ui/ui.js'));
});
beforeEach(()=>{
  vi.useFakeTimers();localStorage.clear();Input.reset();
  document.body.innerHTML='<button id="source">原按钮</button><div id="overlay"><div id="ovBody"></div></div>';
  UI.el={overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')};UI._acts={};UI._baseActs={};UI._overlayInerted=[];
});
afterEach(()=>{
  document.getElementById('cardZoom')?._closeCardZoom?.(true);document.querySelector('[data-confirm-cancel]')?.click();
  for(const release of releases.splice(0))release();document.body.innerHTML='';currentScreenOwner();
  vi.clearAllTimers();vi.useRealTimers();vi.restoreAllMocks();localStorage.clear();
});

describe('确认层与输入所有权',()=>{
  it('业务即时取消，旧视觉壳不可交互且退场不能移除新确认框',async()=>{
    const old=confirmAction({title:'旧确认',message:'测试'});
    document.querySelector('[data-confirm-cancel]').click();
    expect(await old).toBe(false);
    const retiring=document.querySelector('.confirmation-leaving');
    expect(retiring.inert).toBe(true); expect(retiring.getAttribute('aria-hidden')).toBe('true');
    expect(retiring.querySelector('[id],[data-confirm-submit],[data-confirm-cancel]')).toBeNull();
    const fresh=confirmAction({title:'新确认',message:'测试'});
    const current=document.getElementById('actionConfirmation');
    await vi.advanceTimersByTimeAsync(200);
    expect(retiring.isConnected).toBe(false); expect(current.isConnected).toBe(true);
    document.querySelector('[data-confirm-cancel]').click(); expect(await fresh).toBe(false);
  });
  it('取消不执行写入，恢复原焦点与原页面的inert状态',async()=>{
    const source=document.getElementById('source');source.focus();const write=vi.fn();
    const result=confirmAction({title:'删除档位',message:'原档会被覆盖',onConfirm:write});
    expect(source.inert).toBe(true);expect(gameplayInputAllowed()).toBe(false);
    document.querySelector('[data-confirm-cancel]').click();expect(await result).toBe(false);
    expect(write).not.toHaveBeenCalled();expect(source.inert).toBe(false);expect(document.activeElement).toBe(source);expect(gameplayInputAllowed()).toBe(true);
  });
  it('等待中的确认只执行一次，失败保留原层并允许重试成功',async()=>{
    const pending=deferred(),write=vi.fn().mockReturnValueOnce(pending.promise).mockResolvedValue(true);
    const result=confirmAction({title:'操作',message:'保存后完成',onConfirm:write});
    const submit=document.querySelector('[data-confirm-submit]');submit.click();submit.click();key(submit,'Escape');
    expect(write).toHaveBeenCalledOnce();expect(document.getElementById('actionConfirmation')).not.toBeNull();
    pending.resolve(false);await flush();expect(submit.disabled).toBe(false);expect(document.querySelector('.confirmation-status').textContent).toContain('未完成');
    submit.click();expect(await result).toBe(true);expect(write).toHaveBeenCalledTimes(2);expect(document.getElementById('actionConfirmation')).toBeNull();
  });
  it('Esc逐次只退出最高层，底层保持原状',()=>{
    const page=document.createElement('main'),zoom=document.createElement('aside');document.body.append(page,zoom);
    const backPage=vi.fn(),backZoom=vi.fn(()=>zoom.remove());
    releases.push(registerScreenOwner({root:page,onBack:backPage,priority:10}),registerScreenOwner({root:zoom,onBack:backZoom,priority:50}));
    key(zoom,'Escape');expect(backZoom).toHaveBeenCalledOnce();expect(backPage).not.toHaveBeenCalled();
    key(page,'Escape');expect(backPage).toHaveBeenCalledOnce();
  });
  it('改键监听中的Esc只取消改键，再按Esc才关闭设置',()=>{
    const root=document.createElement('main');root.innerHTML=inputSettingsHTML();document.body.append(root);
    const close=vi.fn(),confirm=vi.fn();releases.push(registerScreenOwner({root,onBack:close}));bindInputSettings(root,confirm);
    const change=root.querySelector('[data-rebind="backpack"]');change.click();key(change,'Escape');
    expect(close).not.toHaveBeenCalled();expect(root.querySelector('[data-binding-status]').textContent).toBe('已取消修改');expect(Input.bindingLabel('backpack')).toBe('B');
    key(change,'Escape');expect(close).toHaveBeenCalledOnce();
  });
  it('冲突改键尚未确认时保留原绑定，来源设置离页后迟到批准不改键',async()=>{
    const root=document.createElement('main');root.innerHTML=inputSettingsHTML();document.body.append(root);const pending=deferred(),confirm=vi.fn(()=>pending.promise);bindInputSettings(root,confirm);
    root.querySelector('[data-rebind="backpack"]').click();key(root,'f');expect(confirm).toHaveBeenCalledOnce();expect(Input.bindingLabel('backpack')).toBe('B');
    root.remove();pending.resolve(true);await flush();expect(Input.bindingLabel('backpack')).toBe('B');expect(Input.bindingLabel('camFocus')).toBe('F');
  });
});

describe('卡牌说明、大图和保存回执',()=>{
  it('地图与房间移动同一顶栏节点，保留控件身份并留在可交互模态范围',()=>{
    document.body.classList.remove('lobby');
    const map=document.createElement('main'); map.id='viewport';
    map.innerHTML='<aside><button id="heroAva"></button></aside><nav id="expeditionChapter"></nav><div id="resHud"></div><div id="topBtns"><button id="btnHome"></button><button id="btnMute"></button><div id="hpHud"></div></div>';
    document.body.append(map);
    const nodes=['heroAva','hpHud','expeditionChapter','resHud','btnHome','btnMute'].map(id=>document.getElementById(id));
    const shell={el:{viewport:map,overlay:UI.el.overlay}};
    UI.el.overlay.hidden=true;
    const controller=installRunTopBar(shell);
    const bar=controller.bar;
    expect(bar.hidden).toBe(false);expect(bar.parentNode).toBe(map);
    expect([...bar.querySelector('.run-top-actions').children].map(node=>node.id)).toEqual(['btnHome','btnMute','btnBattleOptions']);
    expect(bar.querySelector('#btnBattleOptions').hidden).toBe(true);
    expect([...bar.querySelector('.run-top-person').children].map(node=>node.id)).toEqual(['heroAva','hpHud']);
    UI.el.overlay.hidden=false;
    document.dispatchEvent(new CustomEvent('sdt-overlay-mode',{detail:'battle'}));
    expect(bar.parentNode).toBe(UI.el.overlay);
    for(const node of nodes)expect(node.closest('#runTopBar')).toBe(bar);
    UI.el.viewport=map; UI.el.overlay.hidden=true;
    document.dispatchEvent(new CustomEvent('sdt-overlay-close'));
    UI._restoreOverlayBackground();
    expect(bar.parentNode).toBe(map);
    for(const node of nodes)expect(document.getElementById(node.id)).toBe(node);
  });
  it('重复出现的伤害/状态词条只出现一次，闪避说明符合实际四类伤害行为',()=>{
    const card={...cardA,desc:'法术伤害，法术伤害。闪避与闪避。'};const tips=collectCardTips(card);
    expect(tips.filter(tip=>tip.id==='spellDamage')).toHaveLength(1);expect(tips.filter(tip=>tip.id==='dodge')).toHaveLength(1);
    expect(tips.map(tip=>tip.name)).toContain('闪避');
    const combat=createCombatRuntime();for(const type of Object.values(combat.TYPES)){const target={hp:10,status:{dodge:1}};expect(combat.dealDamage({atk:4,spellPower:4},target,3,type).dealt).toBe(0);expect(target.status.dodge).toBe(0);}
  });
  it('列表切换到下一卡牌清除上一牌的操作footer，返回时不复用旧按钮',()=>{
    const from=document.getElementById('source'),claim=vi.fn();UI._acts.claim=claim;
    UI.showCardZoom(cardA,{from,items:[cardA,cardB],index:0,hideNote:true,footer:'<button data-act="claim" data-id="ui-a">领取甲牌</button>'});
    expect(document.querySelector('#cardZoom .cz-foot button').dataset.id).toBe('ui-a');
    document.querySelector('[data-cz-next]').click();expect(document.querySelector('#cardZoom .cz-foot')).toBeNull();expect(document.querySelector('#cardZoom').textContent).toContain('乙牌');
    key(document.querySelector('#cardZoom'),'ArrowLeft');expect(document.querySelector('#cardZoom .cz-foot')).toBeNull();expect(claim).not.toHaveBeenCalled();
  });
  it('列表大图的来源已移除时，旧footer不能执行资源动作',()=>{
    const from=document.getElementById('source'),claim=vi.fn();UI._acts.claim=claim;
    UI.showCardZoom(cardA,{from,items:[cardA,cardB],index:0,hideNote:true,footer:'<button data-act="claim">领取</button>'});
    from.remove();document.querySelector('#cardZoom .cz-foot button').click();expect(claim).not.toHaveBeenCalled();
  });
  it('对局检查点成功不能抹掉整档保存失败，整档成功后才解除失败',()=>{
    const retry=vi.fn();installRunTopBar({_retrySave:retry});const send=detail=>document.dispatchEvent(new CustomEvent('sdt-save-state',{detail}));
    send({state:'failed',scope:'session',message:'基地保存失败'});send({state:'saving',scope:'run'});send({state:'saved',scope:'run'});
    expect(document.querySelector('[data-save-label]').textContent).toBe('基地保存失败');expect(document.querySelector('[data-save-retry]').hidden).toBe(false);
    document.querySelector('[data-save-retry]').click();expect(retry).toHaveBeenCalledOnce();
    send({state:'saved',scope:'session'});expect(document.querySelector('[data-save-retry]').hidden).toBe(true);expect(document.querySelector('[data-save-label]').textContent).toBe('已保存');
  });
});

describe('设置导航和结束回合',()=>{
  it('竖向分类键盘切换、焦点与各分类滚动位置独立保留',()=>{
    const root=document.createElement('main');root.innerHTML=settingsLayoutHTML({general:'通用',records:'档案',danger:'危险',credits:'来源',display:'画面',audio:'声音',input:'输入'});document.body.append(root);initSettingsNavigation(root);
    const content=root.querySelector('.settings-content'),general=root.querySelector('#settings-tab-general');content.scrollTop=155;
    key(general,'ArrowDown');expect(document.activeElement.id).toBe('settings-tab-display');expect(root.querySelector('#settings-panel-general').hidden).toBe(true);expect(content.scrollTop).toBe(0);
    content.scrollTop=83;key(document.activeElement,'Home');expect(content.scrollTop).toBe(155);key(document.activeElement,'End');expect(document.activeElement.id).toBe('settings-tab-input');
    key(document.activeElement,'ArrowDown');expect(document.activeElement.id).toBe('settings-tab-general');key(document.activeElement,'ArrowDown');expect(content.scrollTop).toBe(83);
  });
  it('长按早松取消，持续650ms只结束一次且之后点击不重复',async()=>{
    localStorage.setItem('sdt-end-turn-hold','1');const button=document.createElement('button'),run=vi.fn();document.body.append(button);bindEndTurnHold(button,run);
    key(button,'Enter');await vi.advanceTimersByTimeAsync(649);button.dispatchEvent(new KeyboardEvent('keyup',{key:'Enter',bubbles:true}));await vi.advanceTimersByTimeAsync(20);expect(run).not.toHaveBeenCalled();
    key(button,'Enter');key(button,'Enter',{repeat:true});await vi.advanceTimersByTimeAsync(650);button.click();expect(run).toHaveBeenCalledOnce();
  });
  it.each([{ctrlKey:true},{altKey:true},{metaKey:true},{isComposing:true},{keyCode:229}])('修饰/输入法事件%s不触发普通动作或长按结束回合',async modifiers=>{
    expect(Input.actionFor(new KeyboardEvent('keydown',{key:'b',...modifiers}))).toBeNull();
    localStorage.setItem('sdt-end-turn-hold','1');const button=document.createElement('button'),run=vi.fn();document.body.append(button);bindEndTurnHold(button,run);
    key(button,'Enter',modifiers);await vi.advanceTimersByTimeAsync(700);expect(run).not.toHaveBeenCalled();
  });
});
