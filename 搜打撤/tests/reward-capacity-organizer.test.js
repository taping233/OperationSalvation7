import { beforeEach, describe, expect, it, vi } from 'vitest';
import { openRewardCapacityOrganizer } from '../game/src/ui/reward-capacity-organizer.js';
let UI, stacks, fits, options, root, current;
const click = action => root.querySelector(`[data-organize="${action}"]`).click();
beforeEach(() => {
  document.body.innerHTML='<div id="overlay"><div id="body"></div></div>';
  UI={el:{overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#body')},showOverlay:(_,html)=>UI.el.ovBody.innerHTML=html};
  stacks=[{card:{name:'长剑'},uids:['a','b','c'],count:3}]; fits=false; current=true;
  options={UI,card:{name:'待领法术'},readStacks:()=>stacks,canReceive:()=>fits,capacity:()=> '背包 16/16 格 · 安全格 0/3 格',current:()=>current,
    moveToSafe:vi.fn(()=>{stacks=[];fits=true;return true;}),discardOne:vi.fn(()=>{stacks[0].uids.shift();stacks[0].count--;return true;}),
    onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()};
  root=openRewardCapacityOrganizer(options);
});
describe('奖励上下文腾位',()=>{
  it('丢弃确认、保留和整理后不重置列表位置', () => {
    root.querySelector('.reward-organizer-list').scrollTop = 180;
    click('discard');
    expect(root.querySelector('.reward-organizer-list').scrollTop).toBe(180);
    click('keep');
    expect(root.querySelector('.reward-organizer-list').scrollTop).toBe(180);
    click('discard'); click('confirm');
    expect(root.querySelector('.reward-organizer-list').scrollTop).toBe(180);
    click('return'); expect(options.onReturn).toHaveBeenCalledOnce();
  });

  it('返回与未确认丢弃均零写；目标保留',()=>{click('discard');expect(root.textContent).toContain('无法取回');click('keep');click('return');expect(options.onReturn).toHaveBeenCalledOnce();expect(options.discardOne).not.toHaveBeenCalled();expect(options.moveToSafe).not.toHaveBeenCalled();expect(options.onClaim).not.toHaveBeenCalled();});
  it('仅确认丢弃1张，3→2仍不腾格，回执明确已生效',()=>{click('discard');click('confirm');expect(options.discardOne).toHaveBeenCalledOnce();expect(stacks[0].count).toBe(2);expect(root.textContent).toContain('已丢弃：长剑 ×1；还需腾出位置');expect(root.querySelector('[data-organize="claim"]').disabled).toBe(true);click('return');expect(options.onReturn).toHaveBeenCalledOnce();});
  it('存安全格后再明确领取，不自动领',()=>{click('safe');expect(options.onClaim).not.toHaveBeenCalled();expect(root.textContent).toContain('已移入安全格：长剑 ×3');click('claim');expect(options.onClaim).toHaveBeenCalledOnce();click('claim');expect(options.onClaim).toHaveBeenCalledOnce();});
  it('安全格失败保目标/堆，完整背包可继续',()=>{options.moveToSafe.mockReturnValue(false);click('safe');expect(root.textContent).toContain('未能移入安全格，请重试');expect(stacks[0].count).toBe(3);click('bag');expect(options.onFullBag).toHaveBeenCalledOnce();});
  it('旧渲染按钮和旧页面回调均不能提交',()=>{const old=root.querySelector('[data-organize="safe"]');click('discard');old.click();expect(options.moveToSafe).not.toHaveBeenCalled();UI.el.ovBody.innerHTML='<p>其他页</p>';click('confirm');expect(options.discardOne).not.toHaveBeenCalled();});
  it('领取前容量发生变化时拒绝领取并提示继续整理',()=>{click('safe');fits=false;click('claim');expect(options.onClaim).not.toHaveBeenCalled();expect(root.textContent).toContain('空间已变化');});
  it.each([['claim', '领取'], ['confirm', '丢弃确认'], ['return', '返回']])('会话失效后旧%s按钮拒绝%s，容量足够且页面仍保留', (action) => {
    fits=true;
    root=openRewardCapacityOrganizer(options);
    click('discard');
    const button=root.querySelector(`[data-organize="${action}"]`);
    const before=structuredClone(stacks), html=root.innerHTML;
    expect(options.current()).toBe(true);
    expect(button.disabled).toBe(false);
    current=false;
    expect(options.current()).toBe(false);
    expect(options.canReceive()).toBe(true);
    expect(root.isConnected).toBe(true);
    expect(UI.el.ovBody.contains(root)).toBe(true);
    button.click(); button.click();
    expect(stacks).toEqual(before);
    expect(root.innerHTML).toBe(html);
    expect(options.onClaim).not.toHaveBeenCalled();
    expect(options.discardOne).not.toHaveBeenCalled();
    expect(options.moveToSafe).not.toHaveBeenCalled();
    expect(options.onReturn).not.toHaveBeenCalled();
    expect(options.onFullBag).not.toHaveBeenCalled();
  });
});

describe('奖励整理连续键盘焦点', () => {
  const button = (action, index) => root.querySelector(`[data-organize="${action}"]${index == null ? '' : `[data-index="${index}"]`}`);
  const activate = (action, index) => { const target = button(action, index); target.focus(); target.click(); return target; };
  beforeEach(() => {
    stacks = ['木材', '草药', '矿石'].map((name, i) => ({ card:{ name, type:'资源' }, uids:[`${i}a`, `${i}b`], count:2 }));
    options.discardOne.mockImplementation(stack => {
      const item = stacks.find(s => s.uids[0] === stack.uids[0]);
      item.uids.shift(); item.count--;
      stacks = stacks.filter(s => s.count);
      return true;
    });
    root = openRewardCapacityOrganizer(options);
  });
  it('第二张卡进入丢弃确认时聚焦安全的保留，不自动丢弃', () => {
    activate('discard', 1);
    expect(document.activeElement).toBe(button('keep'));
    expect(options.discardOne).not.toHaveBeenCalled();
  });
  it('保留后回到原卡丢弃入口，数据不变', () => {
    activate('discard', 1); activate('keep');
    expect(document.activeElement).toBe(button('discard', 1));
    expect(stacks[1].count).toBe(2);
  });
  it('确认仅丢弃一张，仍有同叠时焦点留在同卡入口', () => {
    activate('discard', 1); activate('confirm');
    expect(document.activeElement).toBe(button('discard', 1));
    expect(stacks[1].count).toBe(1);
    expect(options.discardOne).toHaveBeenCalledOnce();
  });
  it('原卡整叠消失后聚焦相邻卡，不跳回列表头', () => {
    stacks[1].uids = ['1a']; stacks[1].count = 1;
    root = openRewardCapacityOrganizer(options);
    activate('discard', 1); activate('confirm');
    expect(stacks.map(s => s.card.name)).toEqual(['木材', '矿石']);
    expect(document.activeElement).toBe(button('discard', 1));
  });
  it('最后一张丢弃后聚焦返回奖励，不自动离开或领取', () => {
    stacks = [{card:{name:'草药',type:'资源'},uids:['a'],count:1}];
    root = openRewardCapacityOrganizer(options);
    activate('discard', 0); activate('confirm');
    expect(document.activeElement).toBe(button('return'));
    expect(options.onReturn).not.toHaveBeenCalled();
    expect(options.onClaim).not.toHaveBeenCalled();
  });
  it('移入安全格清空列表后也保留可继续操作的焦点', () => {
    activate('safe', 1);
    expect(document.activeElement).toBe(button('return'));
    expect(options.onClaim).not.toHaveBeenCalled();
  });
  it('最后一行移除后退到前一行，焦点恢复不触发页面滚动', () => {
    stacks[2].uids = ['2a']; stacks[2].count = 1;
    root = openRewardCapacityOrganizer(options);
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      activate('discard', 2); activate('confirm');
      expect(document.activeElement).toBe(button('discard', 1));
      expect(focus).toHaveBeenLastCalledWith({preventScroll:true});
    } finally { focus.mockRestore(); }
  });
  it('安全格失败且新状态禁用时退到同卡非破坏性的操作入口', () => {
    options.safeAvailability = () => ({ok:true,reason:''});
    options.moveToSafe.mockImplementation(() => { options.safeAvailability = () => ({ok:false,reason:'安全格已满'}); return false; });
    // Use a dynamic port so a capacity change is observed by the same organizer.
    root = openRewardCapacityOrganizer({...options,safeAvailability:stack => options.safeAvailability(stack)});
    activate('safe', 1);
    expect(button('safe', 1).disabled).toBe(true);
    expect(document.activeElement).toBe(button('discard', 1));
    expect(options.discardOne).not.toHaveBeenCalled();
  });
  it('旧页面按钮不能抢走新页面焦点', () => {
    activate('discard', 1);
    const stale = button('keep');
    UI.el.ovBody.innerHTML = '<button id="new-page">新页面</button>';
    const next = document.querySelector('#new-page'); next.focus(); stale.click();
    expect(document.activeElement).toBe(next);
    expect(options.discardOne).not.toHaveBeenCalled();
  });

});
