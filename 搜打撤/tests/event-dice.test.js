import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventDiceController } from '../game/src/ui/event-dice.js';
import { Random } from '../game/src/core/random.js';
import { openShopCommission, commissionEligibleSlots } from '../game/src/run/shop-commission.js';
import { rollEventDice } from './helpers/event-dice.js';
vi.mock('../game/src/core/random.js', () => ({Random:{random:vi.fn()}}));

function harness() {
  document.body.innerHTML = '<div id="body"></div>';
  const UI = {el:{ovBody:document.getElementById('body')},_acts:{},
    act:(name,fn) => UI._acts[name]=fn,showOverlay:(_,html) => UI.el.ovBody.innerHTML=html,log:vi.fn()};
  let valid = true, hook;
  const save=vi.fn(() => true), done=vi.fn(), owner={};
  const options={UI,SDT:{Sound:{sfx:vi.fn()}},save,
    show:({body})=>UI.el.ovBody.innerHTML=body,
    bind:act=>{const page=UI.el.ovBody.firstElementChild;return ()=>valid && UI.el.ovBody.firstElementChild===page && !!page.querySelector(`[data-act="${act}"]`);},
    onLeave:vi.fn(),setReturn:fn=>hook=fn};
  const open=(extra={})=>createEventDiceController(options).open({owner,key:'reward',title:'试投',sides:6,
    outcomes:[{label:'碎片',value:'fragment'},{label:'3 币',value:'coins'}],done,current:()=>valid,...extra});
  return {UI,save,done,owner,open,options,invalidate:()=>valid=false,restore:()=>hook()};
}
afterEach(()=>vi.restoreAllMocks());

describe('玩家投骰',()=>{
  it.each([1,2,3,4,5,6])('%s 点准确对应两档，确认前不结算，旧按钮不重复结算',point=>{
    vi.spyOn(Random,'random').mockReturnValue((point-.5)/6);
    const h=harness();h.open();
    expect(h.UI.el.ovBody.textContent).toContain('1～3 点');
    expect(h.UI.el.ovBody.textContent).toContain('4～6 点');
    h.UI._acts.eventDiceRoll();expect(h.done).not.toHaveBeenCalled();
    expect(h.owner.dice.reward.result).toBe(point);
    const confirm=h.UI._acts.eventDiceContinue;confirm();confirm();
    expect(h.done).toHaveBeenCalledExactlyOnceWith(point<=3?'fragment':'coins');
  });
  it('JSON恢复同一候选、同一点数，不重投或重收费用',()=>{
    const rng=vi.spyOn(Random,'random').mockReturnValue(.7),h=harness(),pay=vi.fn(()=>true);
    h.open({beforeRoll:pay});h.UI._acts.eventDiceRoll();
    const owner=JSON.parse(JSON.stringify(h.owner));
    h.open({owner,beforeRoll:pay,outcomes:[{label:'新候选',value:'wrong'}]});
    h.UI._acts.eventDiceRoll();h.UI._acts.eventDiceContinue();
    expect(h.done).toHaveBeenCalledWith('coins');expect(rng).toHaveBeenCalledTimes(1);expect(pay).toHaveBeenCalledTimes(1);
  });
  it('新页面/新对局接管后，旧按钮与恢复hook不会发奖或覆盖页面',()=>{
    const h=harness();h.open();const roll=h.UI._acts.eventDiceRoll;
    h.invalidate();h.UI.el.ovBody.innerHTML='<main>新局</main>';h.restore();roll();
    expect(h.UI.el.ovBody.textContent).toBe('新局');expect(h.owner.dice.reward.result).toBeNull();
  });
  it('保存失败不允许确认结算，恢复后重试原结果',()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();h.open();
    h.save.mockReturnValue(false);h.UI._acts.eventDiceRoll();h.UI._acts.eventDiceContinue();expect(h.done).not.toHaveBeenCalled();
    h.save.mockReturnValue(true);h.UI._acts.eventDiceContinue();expect(h.done).toHaveBeenCalledExactlyOnceWith('fragment');
  });
});

describe('下一商店委托',()=>{
  it('排除初始攻击、已售出与已有免费商品，投两次免两格；剧情确认后不重复执行',()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();
    const stock=[
      {card:{id:'sha',name:'杀'},price:1,shaReplenish:5},
      {card:{id:'e1',name:'绷带'},price:2}, {card:{id:'e2',name:'宝剑'},price:5},
      {card:{id:'e3',name:'旧免费'},price:0,free:true}, {card:{id:'e4',name:'已售'},price:3,sold:true},
    ];
    expect(commissionEligibleSlots(stock,{id:'sha',name:'杀'}).map(x=>x.index)).toEqual([1,2]);
    const pending={status:'pending'},game={shopStock:stock,nodeRewards:{'0,1':{commission:pending}},layerIdx:0,trackPos:2};
    const renderShop=vi.fn();const args={game,UI:h.UI,SDT:{Cards:{SHA:{id:'sha',name:'杀'}}},stockKey:'next',save:h.save,current:()=>true,renderShop,leave:vi.fn()};
    expect(openShopCommission(args)).toBe(true);expect(stock[1].price).toBe(2);
    expect(h.UI.el.ovBody.textContent).toContain('送到下一家店的信');
    h.UI._acts.commissionStart();rollEventDice(h.UI);
    expect(pending.slots).toEqual([1,2]);expect(stock.filter(x=>x.commissionFree)).toHaveLength(2);expect(stock[0].price).toBe(1);
    expect(h.UI.el.ovBody.textContent).toContain('校工已经替你结了账');expect(renderShop).not.toHaveBeenCalled();
    h.UI._acts.commissionEnterShop();expect(renderShop).toHaveBeenCalledOnce();expect(pending.announced).toBe(true);
    expect(openShopCommission(args)).toBe(false);
    expect(openShopCommission({...args,stockKey:'other'})).toBe(false);
  });
  it('中途离开后JSON恢复，已选的第一格不会重复，也不会换店刷新免单',()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();
    const game={nodeRewards:{a:{commission:{status:'pending'}}},shopStock:[1,2,3].map(i=>({card:{id:`c${i}`,name:`货${i}`},price:2}))};
    const args={game,UI:h.UI,SDT:{Cards:{SHA:{id:'sha',name:'杀'}}},stockKey:'A',save:h.save,current:()=>true,renderShop:vi.fn(),leave:vi.fn()};
    openShopCommission(args);h.UI._acts.commissionStart();h.UI._acts.eventDiceRoll();h.UI._acts.eventDiceContinue();
    h.UI._acts.eventDiceLeave();const restored=JSON.parse(JSON.stringify(game));
    expect(openShopCommission({...args,game:restored,stockKey:'B'})).toBe(false);
    openShopCommission({...args,game:restored});h.UI._acts.commissionStart();rollEventDice(h.UI);
    expect(restored.nodeRewards.a.commission.slots).toEqual([0,1]);
    expect(restored.shopStock.filter(s=>s.commissionFree)).toHaveLength(2);
  });
});
