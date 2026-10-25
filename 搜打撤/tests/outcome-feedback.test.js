import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { afterOutcomeFeedback, playOutcomeFeedback } from '../game/src/ui/outcome-feedback.js';
import { motionTiming } from '../game/src/ui/motion-presets.js';

let root, scene;
beforeEach(()=>{
  vi.useFakeTimers(); document.body.className='';
  document.body.innerHTML='<main><section><button>下一步</button></section></main>';
  root=document.querySelector('main');scene=root.firstElementChild;scene.animate=vi.fn();
  window.SDT={Sound:{sfx:vi.fn()}};
});
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();document.body.replaceChildren();});

it('同一页面的新反馈取消旧反馈，旧回调不续流且只保留一场',async()=>{
  const next=vi.fn();
  const previous=afterOutcomeFeedback(root,{kind:'heal',hpBefore:1,hpAfter:3},next);
  const replacement=playOutcomeFeedback(root,{kind:'restore',cards:[{name:'牌'}]});
  expect(await previous).toBe(false);expect(next).not.toHaveBeenCalled();
  expect(scene.querySelectorAll('.outcome-feedback')).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(motionTiming.outcomeShort+motionTiming.completionSlack);
  expect(await replacement).toBe(true);
});
it('隐藏拥有页面立即取消，并恢复原按钮状态',async()=>{
  const next=vi.fn();const result=afterOutcomeFeedback(root,{kind:'sacrifice',blocking:true,compact:false,cards:[{name:'代价'}]},next);
  expect(scene.querySelector('button').disabled).toBe(true);root.hidden=true;
  await Promise.resolve();expect(await result).toBe(false);expect(next).not.toHaveBeenCalled();
  expect(scene.querySelector('button').disabled).toBe(false);expect(vi.getTimerCount()).toBe(0);
});
it('无动画能力和减少动态效果保留同步续流，复原声音只触发一次',()=>{
  document.body.classList.add('reduce-motion');const next=vi.fn(()=>17);
  expect(afterOutcomeFeedback(root,{kind:'restore',cards:[{name:'原卡'}]},next)).toBe(17);
  expect(next).toHaveBeenCalledOnce();expect(window.SDT.Sound.sfx).toHaveBeenCalledExactlyOnceWith('cardRestore');
  expect(scene.querySelector('.outcome-feedback')).toBeNull();
});
it('祭坛与信标共用献祭卡片，显示真实代价和指定去向',async()=>{
  const cards=[{name:'甲'},{name:'乙'},{name:'丙'}];const before=JSON.stringify(cards);
  const result=playOutcomeFeedback(root,{kind:'sacrifice',cards,destination:'撤离信标',compact:false});
  expect(scene.querySelectorAll('.fire-rest-reveal-card')).toHaveLength(3);
  expect(scene.textContent).toContain('3 张');expect(scene.textContent).toContain('撤离信标充能完成');
  await vi.advanceTimersByTimeAsync(motionTiming.outcomeRitual+motionTiming.completionSlack);
  expect(await result).toBe(true);expect(JSON.stringify(cards)).toBe(before);
});
it('过期来源不播放声音、不改页面，也不调用续流',()=>{
  const next=vi.fn();expect(afterOutcomeFeedback(root,{kind:'restore',cards:[{name:'过期'}],isCurrent:()=>false},next)).toBe(false);
  expect(window.SDT.Sound.sfx).not.toHaveBeenCalled();expect(next).not.toHaveBeenCalled();
});
