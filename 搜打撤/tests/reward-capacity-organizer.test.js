import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
let UI, stacks, fits, options, root;
const click = action => root.querySelector(`[data-organize="${action}"]`).click();
beforeEach(() => {
  document.body.innerHTML='<div id="overlay"><div id="body"></div></div>';
  UI={el:{overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#body')},showOverlay:(_,html)=>UI.el.ovBody.innerHTML=html};
  stacks=[{card:{name:'长剑'},uids:['a','b','c'],count:3}]; fits=false;
  options={UI,card:{name:'待领法术'},readStacks:()=>stacks,canReceive:()=>fits,capacity:()=> '背包 16/16 格 · 安全格 0/3 格',current:()=>true,
    moveToSafe:vi.fn(()=>{stacks=[];fits=true;return true;}),discardOne:vi.fn(()=>{stacks[0].uids.shift();stacks[0].count--;return true;}),
    onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()};
  root=openRewardCapacityOrganizer(options);
});
describe('奖励上下文腾位',()=>{
  it('返回与未确认丢弃均零写；目标保留',()=>{click('discard');expect(root.textContent).toContain('无法取回');click('keep');click('return');expect(options.onReturn).toHaveBeenCalledOnce();expect(options.discardOne).not.toHaveBeenCalled();expect(options.moveToSafe).not.toHaveBeenCalled();expect(options.onClaim).not.toHaveBeenCalled();});
  it('仅确认丢弃1张，3→2仍不腾格，回执明确已生效',()=>{click('discard');click('confirm');expect(options.discardOne).toHaveBeenCalledOnce();expect(stacks[0].count).toBe(2);expect(root.textContent).toContain('已丢弃：长剑 ×1；还需腾出位置');expect(root.querySelector('[data-organize="claim"]').disabled).toBe(true);click('return');expect(options.onReturn).toHaveBeenCalledOnce();});
  it('存安全格后再明确领取，不自动领',()=>{click('safe');expect(options.onClaim).not.toHaveBeenCalled();expect(root.textContent).toContain('已移入安全格：长剑 ×3');click('claim');expect(options.onClaim).toHaveBeenCalledOnce();click('claim');expect(options.onClaim).toHaveBeenCalledOnce();});
  it('安全格失败保目标/堆，完整背包可继续',()=>{options.moveToSafe.mockReturnValue(false);click('safe');expect(root.textContent).toContain('安全格放不下');expect(stacks[0].count).toBe(3);click('bag');expect(options.onFullBag).toHaveBeenCalledOnce();});
  it('旧渲染按钮和旧页面回调均不能提交',()=>{const old=root.querySelector('[data-organize="safe"]');click('discard');old.click();expect(options.moveToSafe).not.toHaveBeenCalled();UI.el.ovBody.innerHTML='<p>其他页</p>';click('confirm');expect(options.discardOne).not.toHaveBeenCalled();});
  it('领取前再核容量与当前会话',()=>{click('safe');fits=false;click('claim');expect(options.onClaim).not.toHaveBeenCalled();expect(root.textContent).toContain('空间已变化');});
});
