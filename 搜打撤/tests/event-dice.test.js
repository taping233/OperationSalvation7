import { flushEventActions } from './helpers/event-dice-async.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEventDiceController, diceStep } from '../game/src/ui/event-dice.js';
import { Random } from '../game/src/core/random.js';
import { openShopCommission, commissionEligibleSlots } from '../game/src/run/shop-commission.js';
import { rollEventDice } from './helpers/event-dice-async.js';
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
  it('大池先后台不放回抽六项，保存后重进不再抽样，六点均能结算对应奖励',async ()=>{
    for (let point=1;point<=6;point++) {
      const rng=vi.spyOn(Random,'random').mockReturnValue(.9),h=harness();
      const outcomes=Array.from({length:20},(_,i)=>({label:`装备${i}`,value:`gear${i}`}));
      await h.open({outcomes,sides:20});
      const step=h.owner.dice.reward;
      expect(step.sides).toBe(6);expect(step.outcomes).toHaveLength(6);
      expect(new Set(step.outcomes.map(o=>o.value)).size).toBe(6);
      expect(step.outcomes[0].value).toBe('gear18');expect(outcomes).toHaveLength(20);
      expect(h.UI.el.ovBody.querySelectorAll('.event-die-face')).toHaveLength(6);
      expect(h.UI.el.ovBody.querySelectorAll('.event-dice-rules p')).toHaveLength(6);
      const owner=JSON.parse(JSON.stringify(h.owner)),calls=rng.mock.calls.length;
      await h.open({owner,outcomes:[],sides:20});expect(rng.mock.calls.length).toBe(calls);
      rng.mockReturnValue((point-.5)/6);
      await h.UI._acts.eventDiceRoll();await h.UI._acts.eventDiceContinue();
      expect(h.done).toHaveBeenCalledExactlyOnceWith(step.outcomes[point-1].value);
    }
  });
  it.each([1,2,3,4,5,6])('不足六个候选也用六面骰：%s点始终有结果',point=>{
    const step=diceStep({},'small',Array.from({length:5},(_,value)=>({value})));
    expect(step.sides).toBe(6);
    expect(step.outcomes[Math.floor((point-1)*step.outcomes.length/step.sides)]).toBeDefined();
  });
  it('旧多面骰已投奖励迁移后保持不变，未投候选只抽样一次',()=>{
    vi.spyOn(Random,'random').mockReturnValue(.5);
    const outcomes=Array.from({length:20},(_,value)=>({value}));
    const owner={dice:{old:{sides:20,outcomes,result:17}}};
    const step=diceStep(owner,'old',[]);
    expect(step.sides).toBe(6);expect(step.outcomes).toHaveLength(6);
    expect(step.outcomes[step.result-1].value).toBe(16);
    const saved=JSON.parse(JSON.stringify(step));diceStep(owner,'old',[]);expect(step).toEqual(saved);
  });
  it.each([1,2,3,4,5,6])('%s 点准确对应两档，确认前不结算，旧按钮不重复结算',async point=>{
    vi.spyOn(Random,'random').mockReturnValue((point-.5)/6);
    const h=harness();await h.open();
    expect(h.UI.el.ovBody.textContent).toContain('1～3 点');
    expect(h.UI.el.ovBody.textContent).toContain('4～6 点');
    await h.UI._acts.eventDiceRoll(); await flushEventActions();expect(h.done).not.toHaveBeenCalled();
    expect(h.owner.dice.reward.result).toBe(point);
    const confirm=h.UI._acts.eventDiceContinue;await confirm();await flushEventActions();await confirm(); await flushEventActions();
    expect(h.done).toHaveBeenCalledExactlyOnceWith(point<=3?'fragment':'coins');
  });
  it('JSON恢复同一候选、同一点数，不重投或重收费用',async ()=>{
    const rng=vi.spyOn(Random,'random').mockReturnValue(.7),h=harness(),pay=vi.fn(()=>true);
    await h.open({beforeRoll:pay});await h.UI._acts.eventDiceRoll(); await flushEventActions();
    const owner=JSON.parse(JSON.stringify(h.owner));
    await h.open({owner,beforeRoll:pay,outcomes:[{label:'新候选',value:'wrong'}]});
    await h.UI._acts.eventDiceRoll();await flushEventActions();await h.UI._acts.eventDiceContinue(); await flushEventActions();
    expect(h.done).toHaveBeenCalledWith('coins');expect(rng).toHaveBeenCalledTimes(1);expect(pay).toHaveBeenCalledTimes(1);
  });
  it('新页面/新对局接管后，旧按钮与恢复hook不会发奖或覆盖页面',async ()=>{
    const h=harness();await h.open();const roll=h.UI._acts.eventDiceRoll;
    h.invalidate();h.UI.el.ovBody.innerHTML='<main>新局</main>';h.restore();await roll(); await flushEventActions();
    expect(h.UI.el.ovBody.textContent).toBe('新局');expect(h.owner.dice.reward.result).toBeNull();
  });
  it('保存失败不允许确认结算，恢复后重试原结果',async ()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();await h.open();
    h.save.mockReturnValue(false);await h.UI._acts.eventDiceRoll();await flushEventActions();await h.UI._acts.eventDiceContinue(); await flushEventActions();expect(h.done).not.toHaveBeenCalled();
    h.save.mockReturnValue(true);await h.UI._acts.eventDiceContinue(); await flushEventActions();expect(h.done).toHaveBeenCalledExactlyOnceWith('fragment');
  });
});

describe('下一商店委托',()=>{
  it('排除初始攻击、已售出与已有免费商品，投两次免两格；剧情确认后不重复执行',async ()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();
    const stock=[
      {card:{id:'sha',name:'杀'},price:1,shaReplenish:5},
      {card:{id:'e1',name:'绷带'},price:2}, {card:{id:'e2',name:'宝剑'},price:5},
      {card:{id:'e3',name:'旧免费'},price:0,free:true}, {card:{id:'e4',name:'已售'},price:3,sold:true},
    ];
    expect(commissionEligibleSlots(stock,{id:'sha',name:'杀'}).map(x=>x.index)).toEqual([1,2]);
    const pending={status:'pending'},game={shopStock:stock,nodeRewards:{'0,1':{commission:pending}},layerIdx:0,trackPos:2};
    const renderShop=vi.fn();const args={game,UI:h.UI,SDT:{Cards:{SHA:{id:'sha',name:'杀'}}},stockKey:'next',save:h.save,current:()=>true,renderShop,leave:vi.fn()};
    expect(openShopCommission(args)).toBe(true); await flushEventActions();expect(stock[1].price).toBe(2);
    expect(h.UI.el.ovBody.textContent).toContain('中断的接应 · 交付凭据');
    await h.UI._acts.commissionStart();await flushEventActions();await rollEventDice(h.UI);
    expect(pending.slots).toEqual([1,2]);expect(stock.filter(x=>x.commissionFree)).toHaveLength(2);expect(stock[0].price).toBe(1);
    expect(h.UI.el.ovBody.textContent).toContain('凭据已经兑付');expect(renderShop).not.toHaveBeenCalled();
    await h.UI._acts.commissionEnterShop(); await flushEventActions();expect(renderShop).toHaveBeenCalledOnce();expect(pending.announced).toBe(true);
    expect(openShopCommission(args)).toBe(false);
    expect(openShopCommission({...args,stockKey:'other'})).toBe(false);
  });
  it('中途离开后JSON恢复，原店保留第一格；未兑付凭据换店清草稿不先发免费商品',async ()=>{
    vi.spyOn(Random,'random').mockReturnValue(0);const h=harness();
    const game={nodeRewards:{a:{commission:{status:'pending'}}},shopStock:[1,2,3].map(i=>({card:{id:`c${i}`,name:`货${i}`},price:2}))};
    const args={game,UI:h.UI,SDT:{Cards:{SHA:{id:'sha',name:'杀'}}},stockKey:'A',save:h.save,current:()=>true,renderShop:vi.fn(),leave:vi.fn()};
    openShopCommission(args); await flushEventActions();await h.UI._acts.commissionStart();await flushEventActions();await h.UI._acts.eventDiceRoll();await flushEventActions();await h.UI._acts.eventDiceContinue(); await flushEventActions();
    await h.UI._acts.eventDiceLeave(); await flushEventActions();const restored=JSON.parse(JSON.stringify(game));
    expect(restored.nodeRewards.a.commission.slots).toEqual([0]);
    const moved=JSON.parse(JSON.stringify(restored));
    expect(openShopCommission({...args,game:moved,stockKey:'B'})).toBe(true); await flushEventActions();
    expect(moved.nodeRewards.a.commission).toMatchObject({status:'pending',shopKey:'B',slots:[]});
    expect(moved.shopStock.filter(s=>s.commissionFree)).toHaveLength(0);
    openShopCommission({...args,game:restored}); await flushEventActions();await h.UI._acts.commissionStart();await flushEventActions();await rollEventDice(h.UI);
    expect(restored.nodeRewards.a.commission.slots).toEqual([0,1]);
    expect(restored.shopStock.filter(s=>s.commissionFree)).toHaveLength(2);
  });
});


describe('异步投骰检查点', () => {
  it('投骰与确认保存未完成时重复动作不再次扣款、随机或发奖', async () => {
    const h=harness(), pay=vi.fn(()=>true); vi.spyOn(Random,'random').mockReturnValue(.1);
    await h.open({beforeRoll:pay});
    let releaseRoll; h.save.mockImplementationOnce(()=>new Promise(resolve=>releaseRoll=resolve));
    const roll=h.UI._acts.eventDiceRoll, first=roll(); await flushEventActions();
    await roll(); expect(pay).toHaveBeenCalledOnce(); expect(Random.random).toHaveBeenCalledOnce(); expect(h.done).not.toHaveBeenCalled();
    releaseRoll(true); await first;
    let releaseConfirm; h.save.mockImplementationOnce(()=>new Promise(resolve=>releaseConfirm=resolve));
    const confirm=h.UI._acts.eventDiceContinue, confirmation=confirm(); await flushEventActions();
    await confirm(); expect(h.done).not.toHaveBeenCalled(); releaseConfirm(true); await confirmation;
    expect(h.done).toHaveBeenCalledExactlyOnceWith('fragment');
  });
  it('初次保存等待中运行上下文失效，迟到完成不覆盖新页面', async () => {
    const h=harness(); let release; h.save.mockImplementationOnce(()=>new Promise(resolve=>release=resolve));
    const opening=h.open(); h.invalidate(); h.UI.el.ovBody.innerHTML='<main>新页面</main>';
    release(true); expect(await opening).toBe(false); expect(h.UI.el.ovBody.textContent).toBe('新页面'); expect(h.done).not.toHaveBeenCalled();
  });
});
