import { describe, it, expect, vi } from 'vitest';
import { chestRewardOverviewHTML } from '../game/src/ui/chest-reward-overview.js';
import { stackTransferSlotDelta } from '../game/src/core/card-capacity.js';
import { createRewardOrganizer } from '../game/src/hub/game.reward-organizer.js';
import postcss from 'postcss';
import { readCssSource } from './helpers/css-source.js';

describe('本批收获摘要与安全格可用性',()=>{
  it('领取完成保留继续探索入口，不显示入包汇总块',()=>{
    document.body.innerHTML=chestRewardOverviewHTML({complete:true,boxes:[{index:0,name:'箱',completed:true,takenCount:3,lostCount:2}]});
    expect(document.querySelector('.cqo-receipt')).toBeNull();
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
  it('多项使用共用300px卡列并允许换行，完成摘要不占独立区域',()=>{
    const css=postcss.parse(readCssSource('game/css/room-rewards.css','utf8'));
    const values=selector=>{const result={};css.walkRules(rule=>{if(rule.selectors.includes(selector))rule.walkDecls(decl=>result[decl.prop]=decl.value);});return result;};
    expect(values('body #overlay .card .room-reward .reward-objects')).toMatchObject({'display':'flex','flex-wrap':'wrap','justify-content':'center'});
    expect(values('body #overlay .card .room-reward .reward-unit')).toMatchObject({flex:'0 0 300px',width:'300px'});
    expect(values('body #overlay .card .room-reward .reward-unit .reward-card')).toMatchObject({'min-width':'300px','max-width':'300px'});
    const receipt=values('body #overlay .card .cqo-frame .cqo-receipt');
    expect(receipt).toEqual({});
  });
});
