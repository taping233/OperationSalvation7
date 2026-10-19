import { beforeEach, expect, it, vi } from 'vitest';
import { selectionState, selectionKey, cancelSelection, syncSelectionPrompt } from '../game/src/battle/view/battle.selection-ui.js';
const base = () => ({ battleToken:'one', phase:'player', hand:['a'], busy:false });
const findCard = () => ({ card:{ name:'测试牌' } });
let stage, current;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"></div></div>';
  stage = document.querySelector('.battle-stage'); current = { snapshot:base(), clickUid:null };
});
it.each([
  ['click', {}, 'a'], ['card', { pendingTarget:{ uid:'a', card:{name:'牌'}, hint:'选另一敌人 · Esc 取消', excludedTargetIndex:0 } }],
  ['item', { pendingItem:{ uid:'p', card:{name:'药水'} } }], ['slam', {slamPending:true}], ['dart', {dartPending:true}],
  ['infusion', {infusing:{uid:'a',card:{name:'牌'}}}],
])('projects %s through the same selection model', (kind, extra, clickUid = null) => {
  const snap = {...base(),...extra};
  const state = selectionState(snap,{clickUid,findCard});
  expect(state.kind).toBe(kind); expect(state.detail).not.toContain('Esc');
  expect(selectionKey(snap,state)).not.toBe('');
});
it.each(['click','item','card','slam','dart','infusion','aim'])('cancels %s once through adapters and does not submit', kind => {
  const snapshot=base(), commands={cancelPendingTarget:vi.fn(),cancelInfusion:vi.fn(),submitCardPlay:vi.fn()};
  const clearAim=vi.fn(), clearClick=vi.fn(), clearFeedback=vi.fn();
  if(kind==='card') snapshot.pendingTarget={uid:'a'};
  if(kind==='item') snapshot.pendingItem={uid:'p'};
  if(kind==='slam') snapshot.slamPending=true;
  if(kind==='dart') snapshot.dartPending=true;
  if(kind==='infusion') snapshot.infusing={uid:'a'};
  const before=JSON.stringify(snapshot);
  expect(cancelSelection({snapshot,commands,hasAim:kind==='aim',clickUid:kind==='click'?'a':null,clearAim,clearClick,clearFeedback,restoreFocus:true})).toBe(true);
  expect(commands.cancelPendingTarget).toHaveBeenCalledTimes(['item','card','slam','dart'].includes(kind)?1:0);
  expect(commands.cancelInfusion).toHaveBeenCalledTimes(kind==='infusion'?1:0);
  expect(clearAim).toHaveBeenCalledTimes(kind==='aim'?1:0);
  expect(clearClick).toHaveBeenCalledTimes(kind==='click'?1:0);
  if(kind==='click') expect(clearClick).toHaveBeenCalledWith({restoreFocus:true});
  expect(clearFeedback).toHaveBeenCalledTimes(1);expect(commands.submitCardPlay).not.toHaveBeenCalled();expect(JSON.stringify(snapshot)).toBe(before);
});
function sync(onCancel=vi.fn()) { syncSelectionPrompt(stage,current.snapshot,{...current,findCard,getCurrent:()=>current,onCancel}); return onCancel; }
it('updates one shared strip without replacing an unchanged focused control',()=>{
  current.clickUid='a'; sync(); const button=stage.querySelector('button');button.focus();sync();
  expect(stage.querySelectorAll('[data-selection-prompt]')).toHaveLength(1);expect(stage.querySelector('button')).toBe(button);expect(document.activeElement).toBe(button);
  current={snapshot:{...base(),pendingItem:{uid:'p',card:{name:'药水'}}},clickUid:null};const cancel=sync();
  expect(stage.querySelectorAll('[data-selection-prompt]')).toHaveLength(1);expect(stage.textContent).toContain('点击一名敌人');stage.querySelector('button').click();expect(cancel).toHaveBeenCalledTimes(1);
});
it.each(['battle','uid','step','hidden','inert','detached','busy','closing','aria-hidden'])('rejects stale cancellation after %s changes',change=>{
  current.snapshot.pendingTarget={uid:'a',card:{name:'牌'},excludedTargetIndex:0};const cancel=sync();const button=stage.querySelector('button');
  if(change==='battle')current.snapshot.battleToken='two';
  if(change==='uid')current.snapshot.pendingTarget.uid='b';
  if(change==='step')current.snapshot.pendingTarget.excludedTargetIndex=1;
  if(change==='hidden')document.getElementById('overlay').hidden=true;
  if(change==='inert')stage.setAttribute('inert','');
  if(change==='detached')stage.remove();
  if(change==='closing')document.getElementById('overlay').classList.add('closing');
  if(change==='aria-hidden')stage.setAttribute('aria-hidden','true');
  if(change==='busy')current.snapshot.busy=true;
  button.click();expect(cancel).not.toHaveBeenCalled();
});
it('clears the strip on idle, infusion and resolution without cancelling any core operation',()=>{
  for(const state of [{}, {infusing:{uid:'a'}}, {busy:true}]){
    current={snapshot:base(),clickUid:'a'};sync();expect(stage.querySelector('button')).not.toBeNull();
    current={snapshot:{...base(),...state},clickUid:null};const cancel=sync();expect(stage.querySelector('button')).toBeNull();expect(cancel).not.toHaveBeenCalled();
  }
});
it.each(['stage-token','current-stage'])('rejects a still-connected old stage: %s', change => {
  current.clickUid='a';const cancel=sync();const button=stage.querySelector('button');
  if(change==='stage-token')stage._battleToken='another';else current.stage=document.createElement('div');
  button.click();expect(cancel).not.toHaveBeenCalled();
});
it('distinguishes keyboard activation from a pointer cancellation',()=>{
  current.clickUid='a';const cancel=sync();const button=stage.querySelector('button');
  button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}));expect(cancel).toHaveBeenLastCalledWith({restoreFocus:false});
  button.click();expect(cancel).toHaveBeenLastCalledWith({restoreFocus:true});
});
it('rejects an old button after cancelling and reselecting the same UID',()=>{
  current.clickUid='a';const cancel=sync();const old=stage.querySelector('button');
  current.clickUid=null;sync();current.clickUid='a';sync(cancel);
  old.click();expect(cancel).not.toHaveBeenCalled();stage.querySelector('button').click();expect(cancel).toHaveBeenCalledTimes(1);
});
