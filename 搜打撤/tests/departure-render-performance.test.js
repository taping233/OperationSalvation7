import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esc } from '../game/src/core/shared.js';
const ports=vi.hoisted(()=>({choice:vi.fn(),start:vi.fn(),hub:vi.fn()}));
vi.mock('../game/src/run/game.session.js',()=>({MAP:{rules:{starterSha:5}},MODES:{standard:{id:'standard',name:'标准'}},
  game:{stackCapOf:card=>card.id==='starter-attack'?5:card.type==='装备'?1:3},newRun:ports.start,requestClassChoice:ports.choice}));
vi.mock('../game/src/hub/game.cardslib.js',()=>({Sfx:{tick(){}},_set_cardPageOpen:vi.fn()}));
vi.mock('../game/src/hub/game.hub.bridge.js',()=>({slots:{renderHub:ports.hub}}));
vi.mock('../game/src/ui/departure-transition.js',()=>({enterDepartureCut:vi.fn(),enterDepartureStep:vi.fn(),startDepartureHandoff:()=>new Promise(()=>{})}));
let departure,base,ui,actions,cardMemo;
const key=id=>`card:${id}`;
function card(id,type='法术'){return{id,name:`卡牌${id}`,type,rarity:'古朴',cost:1,desc:'原始规则'};}
function open(){departure.openDepartPrep();ports.choice.mock.lastCall[0].onSelect('法师',()=>true);}
function add(id='a'){actions.pickAdd({stackKey:key(id)});}
function drop(id='a'){
  const event=new Event('drop',{bubbles:true,cancelable:true});
  Object.defineProperty(event,'dataTransfer',{value:{getData:()=>key(id)}});
  document.getElementById('depPool').dispatchEvent(event);
}
function selected(id='a'){return document.querySelector(`#depBag [data-stack-key="${key(id)}"]`);}
function pool(id='a'){return document.querySelector(`#depPool [data-stack-key="${key(id)}"]`);}
beforeEach(async()=>{
  vi.resetModules();Object.values(ports).forEach(mock=>mock.mockReset());actions={};cardMemo=new WeakMap();
  base={slot:1,data:{selMode:'standard',pocket:[],stash:[{card:card('a'),count:3},{card:card('b'),count:3},{card:card('c','装备'),count:1}]},
    PETS:[],bagCap:()=>6,safeCap:()=>2,carriedPet:()=>null,ownedPets:()=>[],setPet:()=>true,petById:()=>({name:'宠物',desc:'效果'})};
  document.body.innerHTML='<div id="overlay"><div id="ovBody"></div></div>';
  ui={el:{overlay:document.getElementById('overlay'),ovBody:document.getElementById('ovBody')},_acts:actions,
    act(name,handler){actions[name]=handler;},log:vi.fn(),showCardZoom:vi.fn(),
    showOverlay(_title,html){this.el.overlay.hidden=false;this.el.ovBody.innerHTML=html;}};
  ui.el.ovBody.addEventListener('click',event=>{const button=event.target.closest('[data-act]');if(button&&!button.disabled)actions[button.dataset.act]?.({...button.dataset});});
  window.SDT={UI:ui,Base:base,Cards:{SHA:{id:'starter-attack',name:'初始攻击',type:'武术',rarity:'初始'},RARITIES:['古朴'],TYPES:['法术','装备'],
    all:()=>base.data.stash.map(s=>s.card),rarityOf:c=>c.rarity,
    // Match the real renderer's identity memo: changing an original instance must
    // still reach a fresh presentation object when its content changes.
    cardHTML(c){if(!cardMemo.has(c))cardMemo.set(c,`<div class="hs-card" data-card-id="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.desc||'')}</span><i>${c.cost??''}</i></div>`);return cardMemo.get(c);}},
    Icons:{rich:html=>html},Sound:{sfx:vi.fn()}};
  vi.stubGlobal('matchMedia',()=>({matches:true}));vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',vi.fn());
  departure=await import('../game/src/hub/game.hub.depart.js');
});
afterEach(()=>{document.body.replaceChildren();vi.restoreAllMocks();vi.unstubAllGlobals();});

describe('整备完整刷新与卡格复用',()=>{
  it('只解析新增卡格；数量增减和最后一张删除保留其他节点且不重新绑定',()=>{
    open();const root=document.getElementById('depMain'),fixed=document.querySelector('#depBag .fixed');
    const html=vi.spyOn(Element.prototype,'innerHTML','set'),bind=vi.spyOn(EventTarget.prototype,'addEventListener');
    add();const first=selected();
    expect(html.mock.contexts.filter(node=>node instanceof window.HTMLTemplateElement)).toHaveLength(1);
    html.mockClear();bind.mockClear();add();
    expect(selected()).toBe(first);expect(selected().querySelector('.dep-n').textContent).toBe('×2');
    expect(html.mock.contexts.filter(node=>node instanceof window.HTMLTemplateElement)).toHaveLength(0);
    expect(bind).not.toHaveBeenCalled();
    drop();expect(selected()).toBe(first);expect(selected().querySelector('.dep-n').textContent).toBe('×1');
    drop();expect(selected()).toBeNull();expect(departure.deployPick[key('a')]).toBe(0);
    expect(document.getElementById('depMain')).toBe(root);expect(document.querySelector('#depBag .fixed')).toBe(fixed);
    expect(document.getElementById('depBag').children).toHaveLength(6);expect(bind).not.toHaveBeenCalled();
  });

  it('稳态不重复查询每张卡计数节点或不存在的占格标签',()=>{
    base.data.stash=Array.from({length:25},(_,i)=>({card:card(`n${i}`),count:3}));open();add('n0');
    const query=vi.spyOn(Element.prototype,'querySelector');add('n0');
    expect(query.mock.calls.filter(([selector])=>['.dep-own','.dep-picked-count','[data-dep-slots]'].includes(selector))).toHaveLength(0);
    expect(departure.deployPick[key('n0')]).toBe(2);expect(pool('n0').getAttribute('aria-pressed')).toBe('true');
  });

  it('携带项重排只移动既有卡格，数量不回退也不重新解析卡面',()=>{
    open();add();add('b');const a=selected(),b=selected('b');
    const html=vi.spyOn(Element.prototype,'innerHTML','set');
    const count=departure.deployPick[key('a')];delete departure.deployPick[key('a')];departure.deployPick[key('a')]=count;add('b');
    expect([...document.querySelectorAll('#depBag [data-stack-key]')].map(n=>n.dataset.stackKey)).toEqual([key('b'),key('a')]);
    expect(selected()).toBe(a);expect(selected('b')).toBe(b);expect(b.querySelector('.dep-n').textContent).toBe('×2');
    expect(html.mock.contexts.filter(node=>node instanceof window.HTMLTemplateElement)).toHaveLength(0);
  });

  it('原卡实例的名称/说明/费用原地变化会刷新卡面与筛选；数量变化不冻结',async ()=>{
    open();add();const before=document.getElementById('depMain'),source=base.data.stash[0].card;
    source.name='改名后的牌';source.desc='更新后的规则';source.cost=4;source.type='武术';
    (await actions.depPet({id:'dog'}));
    expect(base.data.stash[0].card).toBe(source);expect(document.getElementById('depMain')).not.toBe(before);
    expect(pool().textContent).toContain('更新后的规则');expect(pool().textContent).toContain('改名后的牌');
    expect(selected().querySelector('.hs-card').textContent).toContain('更新后的规则');
    expect([...document.getElementById('depFilterCost').options].map(o=>o.value)).toContain('4');
    base.data.stash[0].count=2;(await actions.depPet({id:'dog'}));
    expect(pool().querySelector('.dep-own').textContent).toBe('1');
    expect(selected().querySelector('.dep-n').textContent).toBe('×1');
  });

  it.each(['replace','delete','insert','reorder','variant'])('%s 库存结构变化使旧根失效，按当前库存完整重绘',async change=>{
    open();add();const root=document.getElementById('depMain'),oldAdd=actions.pickAdd;
    if(change==='replace')base.data.stash[0].card={...base.data.stash[0].card,desc:'替换对象的新卡面'};
    if(change==='delete')base.data.stash.splice(0,1);
    if(change==='insert')base.data.stash.unshift({card:card('new'),count:2});
    if(change==='reorder')base.data.stash.reverse();
    if(change==='variant')base.data.stash[0].variantKey='foil';
    (await actions.depPet({id:'dog'}));
    expect(document.getElementById('depMain')).not.toBe(root);
    const expected=base.data.stash.map(s=>`${key(s.card.id)}${s.variantKey?`:${s.variantKey}`:''}`);
    expect([...document.querySelectorAll('#depPool .dep-card')].map(n=>n.dataset.stackKey)).toEqual(expected);
    const before={...departure.deployPick};oldAdd({stackKey:key('b')});expect(departure.deployPick).toEqual(before);
    if(change==='replace')expect(pool().textContent).toContain('替换对象的新卡面');
  });

  it.each(['counter','pool-row','bag-face','bag-root'])('%s DOM被移除后不会使用旧节点缓存',async kind=>{
    open();add();
    if(kind==='counter')pool().querySelector('.dep-own').remove();
    if(kind==='pool-row')pool().remove();
    if(kind==='bag-face')selected().querySelector('.hs-card').remove();
    if(kind==='bag-root')document.getElementById('depBag').remove();
    (await actions.depPet({id:'dog'}));
    expect(pool().querySelector('.dep-own').textContent).toBe('2');
    expect(selected().querySelector('.hs-card').textContent).toContain('原始规则');
    expect(document.getElementById('depBag').children).toHaveLength(6);
  });

  it('容量拒绝和筛选在复用路径保持当前值',async ()=>{
    base.bagCap=()=>2;open();add();add('b');
    expect(departure.deployPick[key('b')]).toBeUndefined();expect(document.getElementById('depStatus').textContent).toContain('背包格数已满');
    expect(document.getElementById('depCapacity').textContent).toContain('2/2');
    const filter=document.getElementById('depFilterType');filter.value='装备';filter.dispatchEvent(new Event('change'));
    expect([...document.querySelectorAll('#depPool .dep-card')].map(n=>n.hidden)).toEqual([true,true,false]);
    (await actions.depPet({id:'dog'}));expect(filter.value).toBe('装备');expect(pool('a').hidden).toBe(true);
  });

  it('多轮复用只执行一次现有drop监听，重绘后的旧回调不抢新页',async ()=>{
    open();add();add();(await actions.depPet({id:'dog'}));(await actions.depPet({id:'dog'}));
    drop();expect(departure.deployPick[key('a')]).toBe(1);
    const old=actions.pickAdd;base.data.stash[0].card.desc='触发完整重绘';(await actions.depPet({id:'dog'}));
    old({stackKey:key('a')});expect(departure.deployPick[key('a')]).toBe(1);
    add();expect(departure.deployPick[key('a')]).toBe(2);
  });
});
