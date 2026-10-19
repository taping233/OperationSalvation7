import { describe, it, expect, vi } from 'vitest';
import { chestRewardOverviewHTML } from '../game/src/ui/chest-reward-overview.js';
import { stackTransferSlotDelta } from '../game/src/core/card-capacity.js';
import { createRewardOrganizer } from '../game/src/hub/game.reward-organizer.js';
import fs from 'node:fs';
import postcss from 'postcss';

describe('本批收获摘要与安全格可用性',()=>{
  it('只按显式领取记录聚合同名，显示去向，不把箱子候选当收获',()=>{
    document.body.innerHTML=chestRewardOverviewHTML({complete:true,claimedCards:[{name:'冰刺'},{name:'冰刺'},{name:'宠物蛋'}],boxes:[{index:0,name:'箱',completed:true,takenCount:3,lostCount:2}]});
    const receipt=document.querySelector('.cqo-receipt');
    expect(receipt.getAttribute('aria-label')).toBe('本次已入背包');
    expect([...receipt.querySelectorAll('li')].map(el=>el.textContent)).toEqual(['冰刺 ×2','宠物蛋 ×1']);
    expect(document.querySelector('[data-act=chestFinish]')).not.toBeNull();
  });
  it('全部放弃不伪造入背包记录，仍可继续',()=>{
    document.body.innerHTML=chestRewardOverviewHTML({complete:true,boxes:[{index:0,completed:true,lostCount:3}]});
    expect(document.querySelector('.cqo-receipt')).toBeNull();
    expect(document.body.textContent).toContain('已放弃 3 张');
  });
  it.each([[2,1,0],[3,1,1],[1,5,1],[2,5,2]])('安全格同名已有%i张，移动%i张，新增%i格', (same,count,delta)=>{
    expect(stackTransferSlotDelta(Array.from({length:same},()=>({safe:true,card:{name:'木材'}})),'木材',true,count,3)).toBe(delta);
  });
  it('真实adapter满格可叠仍启用，整叠超限显示原因，容量变动点击再查',()=>{
    document.body.innerHTML='<div id="overlay"><div id="body"></div></div>';
    const UI={el:{overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#body')},showOverlay:(_,html)=>UI.el.ovBody.innerHTML=html};
    const game={ownedCards:[{uid:'safe',safe:true,card:{name:'木材'}},{uid:'move',card:{name:'木材'}}],stackCapOf:()=>3,canReceiveCard:()=>false};
    const move=vi.fn(()=>true);
    const open=createRewardOrganizer({UI,game,shaName:'初始攻击',usedSlots:()=>16,bagCap:()=>16,safeUsed:()=>1,safeCap:()=>1,moveStackSafe:move,discardOwnedCard:vi.fn()});
    const opts={card:{name:'目标'},current:()=>true,onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()};
    open(opts); const old=document.querySelector('[data-organize=safe]'); expect(old.disabled).toBe(false);
    game.ownedCards.push({uid:'safe2',safe:true,card:{name:'木材'}},{uid:'safe3',safe:true,card:{name:'木材'}});
    old.click(); expect(move).not.toHaveBeenCalled();
    expect(document.querySelector('[data-organize=safe]').disabled).toBe(true);
    expect(document.body.textContent).toContain('整叠需 1 格，安全格余 0 格');
    open(opts);
    expect(document.body.textContent).toContain('安全格暂放不下');
  });
  it('安全格已超容量时，同名零增格也拒绝，与真实移动容量守卫一致',()=>{
    document.body.innerHTML='<div id="overlay"><div id="body"></div></div>';
    const UI={el:{overlay:document.querySelector('#overlay'),ovBody:document.querySelector('#body')},showOverlay:(_,html)=>UI.el.ovBody.innerHTML=html};
    const game={ownedCards:[{uid:'safe',safe:true,card:{name:'木材'}},{uid:'other',safe:true,card:{name:'装备'}},{uid:'move',card:{name:'木材'}}],stackCapOf:()=>3,canReceiveCard:()=>false};
    const before=JSON.stringify(game.ownedCards);
    const move=vi.fn(()=>2+stackTransferSlotDelta(game.ownedCards,'木材',true,1,3)<=1);
    const open=createRewardOrganizer({UI,game,shaName:'初始攻击',usedSlots:()=>16,bagCap:()=>16,safeUsed:()=>2,safeCap:()=>1,moveStackSafe:move,discardOwnedCard:vi.fn()});
    open({card:{name:'目标'},current:()=>true,onReturn:vi.fn(),onClaim:vi.fn(),onFullBag:vi.fn()});
    const button=document.querySelector('[data-organize=safe]');
    expect(stackTransferSlotDelta(game.ownedCards,'木材',true,1,3)).toBe(0);
    expect(button.disabled).toBe(true);
    button.click();
    expect(move).not.toHaveBeenCalled();
    expect(JSON.stringify(game.ownedCards)).toBe(before);
    expect(document.body.textContent).toContain('整叠需 0 格，安全格余 0 格');
  });
  it('四项保留四列阅读宽度，完成摘要有限高可滚动',()=>{
    const css=postcss.parse(fs.readFileSync('game/css/chest-reward-overview.css','utf8'));
    const values=selector=>{const result={};css.walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(decl=>result[decl.prop]=decl.value);});return result;};
    expect(values('body #overlay .card .cqo-frame .cqp-dialog .reward-replica[data-reward-count="4"] .reward-objects')).toMatchObject({'grid-template-columns':'repeat(4,280px)','max-width':'none'});
    const receipt=values('body #overlay .card .cqo-frame .cqo-receipt');
    expect(receipt.overflow).toBe('auto');
    expect(Number.parseFloat(receipt['max-height'])).toBeGreaterThan(0);
    expect(Number.parseFloat(receipt['max-height'])).toBeLessThanOrEqual(180);
  });
});
