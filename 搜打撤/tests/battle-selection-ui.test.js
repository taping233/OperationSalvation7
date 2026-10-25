import { beforeEach, expect, it, vi } from 'vitest';
import { selectionState, selectionKey, cancelSelection, syncSelectionPrompt } from '../game/src/battle/view/battle.selection-ui.js';
const base = () => ({ battleToken:'one', phase:'player', hand:['a'], busy:false });
const findCard = () => ({ card:{ name:'测试牌' } });
let stage;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"></div></div>';
  stage = document.querySelector('.battle-stage');
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
it.each([
  {clickUid:'a'}, {pendingTarget:{uid:'a'}}, {pendingItem:{uid:'p'}},
  {slamPending:true}, {dartPending:true}, {infusing:{uid:'a'}},
])('does not create a target prompt or invoke commands for %j', state => {
  const cancel=vi.fn(),returnToInfusion=vi.fn();
  const snapshot={...base(),...state},before=JSON.stringify(snapshot);
  stage.innerHTML='<div data-selection-prompt><button>取消</button></div><div class="battle-content">战场</div>';
  syncSelectionPrompt(stage,snapshot,{onCancel:cancel,onReturnToInfusion:returnToInfusion});
  syncSelectionPrompt(stage,snapshot,{});
  expect(stage.querySelector('[data-selection-prompt]')).toBeNull();
  expect(stage.querySelector('.battle-content').textContent).toBe('战场');
  expect(cancel).not.toHaveBeenCalled();expect(returnToInfusion).not.toHaveBeenCalled();
  expect(JSON.stringify(snapshot)).toBe(before);
});
