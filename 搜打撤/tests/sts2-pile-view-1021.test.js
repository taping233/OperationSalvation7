// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildPileStacks, battlePileBodyHTML } from '../game/src/battle/view/battle.pile-view.js';
import { createBattleDecisionPresenter, bindBattleDecisionInspection, restoreCombatScene } from '../game/src/battle/view/battle.decision-shell.js';
import { bindBattlePageAction } from '../game/src/battle/view/battle.page-activity.js';

const card = Object.freeze({ id:'starter-attack', name:'初始攻击', type:'武术', cost:1, dmg:2, desc:'造成 2 点攻击伤害。' });
const face = (c, size) => `<div class="hs-card" data-size="${size}"><b>${c.name}</b><div class="hsc-desc" tabindex="0">${c.desc}</div></div>`;
const entries = Array.from({ length:99 }, (_, i) => Object.freeze({ uid:`hidden-draw-${i}`, card }));

describe('pile display copies and effective card identities', () => {
  it('groups 99 identical instances while retaining every UID without changing a frozen source', () => {
    const source = Object.freeze(entries.slice()), before = JSON.stringify(source);
    const stacks = buildPileStacks(source);
    expect(stacks).toHaveLength(1);
    expect(stacks[0]).toMatchObject({ card, count:99, uids:entries.map(entry => entry.uid) });
    stacks[0].uids.reverse();
    expect(JSON.stringify(source)).toBe(before);
    expect(stacks[0].uids).not.toBe(source);
  });

  it.each([
    {cost:0}, {dmg:7}, {desc:'额外规则'}, {rarity:'传说'},
    {rules:{triggers:{onPlay:[{op:'draw',amount:2}]}}},
  ])('keeps same-ID effective variants separate: %j', change => {
    const variant = Object.freeze({ ...card, ...change });
    const source = Object.freeze([{ uid:'original', card }, { uid:'variant', card:variant }]);
    expect(buildPileStacks(source).map(stack => stack.count)).toEqual([1,1]);
    expect(new Set(buildPileStacks(source).flatMap(stack => stack.uids))).toEqual(new Set(['original','variant']));
  });

  it('canonicalizes object field order and sorts only the copied display list', () => {
    const copy = { desc:card.desc, dmg:card.dmg, cost:card.cost, type:card.type, name:card.name, id:card.id };
    const other = { ...card, id:'another', name:'另一张牌', desc:'抽 1 张牌。' };
    const source = [{ uid:'first', card:other }, { uid:'second', card }, { uid:'third', card:copy }];
    const before = JSON.stringify(source);
    const forward = battlePileBodyHTML({ cards:source, cardHTML:face, kind:'deck' });
    const backward = battlePileBodyHTML({ cards:[...source].reverse(), cardHTML:face, kind:'deck' });
    expect(forward.html).toBe(backward.html);
    expect(forward.stacks.find(stack => stack.card.id===card.id).count).toBe(2);
    expect(JSON.stringify(source)).toBe(before);
    expect(forward.html).not.toMatch(/first|second|third|下一张|抽牌顺序|data-uid/);
  });

  it.each(['deck','grave'])('%s has full cards and one return action without a repeated rules column', kind => {
    const root = document.createElement('div');
    root.innerHTML = battlePileBodyHTML({ cards:entries, cardHTML:face, kind }).html;
    expect(root.querySelector('[data-battle-pile-view]').dataset.pileTotal).toBe('99');
    expect(root.querySelectorAll('.battle-pile-card')).toHaveLength(1);
    expect(root.querySelector('.hs-card').dataset.size).toBe('lg');
    expect(root.querySelector('.battle-pile-count').textContent).toBe('×99');
    expect(root.querySelector('.battle-pile-card').dataset.act).toBe('btDecisionInspect');
    expect(root.querySelector('.battle-decision-inspect,.battle-pile-note,.battle-pile-context,.ov-stats')).toBeNull();
    expect(root.querySelector('.ov-btns button').dataset.act).toBe(kind==='deck'?'btDeckBack':'btGraveBack');
    expect(root.innerHTML).not.toContain('hidden-draw-');
  });

  it.each(['deck','grave'])('%s empty state offers the same return without a phantom card', kind => {
    const root = document.createElement('div');
    root.innerHTML = battlePileBodyHTML({ cards:[], cardHTML:face, kind }).html;
    expect(root.querySelector('[data-pile-total]').dataset.pileTotal).toBe('0');
    expect(root.querySelector('.battle-pile-empty').textContent).toBe(kind==='deck'?'牌库已空':'消耗牌堆为空');
    expect(root.querySelector('.battle-pile-card')).toBeNull();
    expect(root.querySelectorAll('.ov-btns button')).toHaveLength(1);
  });
});

const SDT = (await import('../game/src/core/sdt-facade.js')).default;
const { UI } = await import('../game/src/ui/ui.js');
let snapshot, show;
const actualCards = [{ uid:'real-a', card }, { uid:'real-b', card:{ ...card, id:'other', name:'长规则牌', desc:'规则\n'.repeat(90) } }];

describe('pile reading and return lifecycle through the existing UI', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<main id="viewport"><div id="heroAva">旅</div><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
    SDT.Icons={rich:x=>x,img:()=>''}; SDT.Sound={sfx(){}}; SDT.Motion={overlayIn(){},reduceMotion:()=>true};
    SDT.Cards={all:()=>actualCards.map(entry=>entry.card),DMG_TYPES:['武术'],rarityOf:()=> '古朴',cardHTML:face};
    SDT.Art={cardIcon:()=>'',decodeIn(){}};
    UI._acts={}; UI._overlayInerted=[]; UI._overlayReturnFocus=null; UI._roomActive=false; UI.init();
    snapshot={battleToken:1021,turn:4,energy:2,maxEnergy:2,opts:{isBoss:false},drawPile:['real-b','real-a'],consumedPile:['real-a']};
    show=createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:2})});
  });
  afterEach(() => {
    document.querySelector('#cardZoom')?._closeCardZoom?.(true);
    UI._cancelPageBg?.(); vi.clearAllTimers(); vi.useRealTimers(); document.body.replaceChildren(); document.body.className='';
  });

  function open(kind='deck') {
    const {html,stacks}=battlePileBodyHTML({cards:actualCards,cardHTML:face,kind});
    show(kind==='deck'?'剩余牌库':'消耗牌堆',html,true,snapshot);
    bindBattleDecisionInspection({UI,getSnapshot:()=>snapshot,cards:stacks.map(stack=>stack.card),snapshot});
    const back=kind==='deck'?'btDeckBack':'btGraveBack';
    bindBattlePageAction({UI,getSnapshot:()=>snapshot,snapshot},back,()=>restoreCombatScene(UI,snapshot.battleToken));
    return {root:document.querySelector('.battle-decision'),inspect:UI._acts.btDecisionInspect,back:UI._acts[back]};
  }

  it.each(['deck','grave'])('%s opens large reading and returns to the same grid, scroll and button', kind => {
    const before=JSON.stringify(snapshot), {root}=open(kind);
    const grid=root.querySelector('.battle-pile-grid'); grid.scrollTop=218;
    const button=[...root.querySelectorAll('.battle-pile-card')].find(node=>node.textContent.includes('长规则牌'));
    expect(root.querySelector('.battle-pile-total').textContent).toBe('2 张');
    expect(root.querySelector('.battle-decision-head').textContent).not.toMatch(/回合|能量/);
    expect(root.querySelectorAll('.battle-pile-card [tabindex="0"]')).toHaveLength(0);
    button.focus(); button.click();
    expect(document.querySelector('#cardZoom')).not.toBeNull();
    expect(UI.el.overlay.inert).toBe(true);
    expect(document.querySelector('#cardZoom').textContent).toContain('长规则牌');
    document.querySelector('#cardZoom .cz-close').click();
    vi.runOnlyPendingTimers();
    expect(document.querySelector('#cardZoom')).toBeNull();
    expect(document.querySelector('.battle-decision')).toBe(root);
    expect(grid.scrollTop).toBe(218); expect(document.activeElement).toBe(button);
    expect(UI.el.overlay.inert).toBe(false); expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('preserves the independent grid scroll and focus through a same-page refresh', () => {
    const {root}=open(); root.querySelector('.battle-pile-grid').scrollTop=144;
    const button=root.querySelector('[data-i="1"]'); button.focus();
    const refreshed=open();
    expect(refreshed.root.querySelector('.battle-pile-grid').scrollTop).toBe(144);
    expect(document.activeElement.dataset.i).toBe('1');
    expect(document.activeElement).not.toBe(button);
  });

  it.each(['deck','grave'])('%s returns to the retained battlefield opener and invalidates old callbacks', kind => {
    UI.showOverlay('', '<div class="battle-stage"><button id="opener">牌堆</button></div>', 'battle');
    const scene=document.querySelector('.battle-stage'); scene._battleToken=snapshot.battleToken;
    const opener=document.getElementById('opener'); opener.focus();
    const old=open(kind), before=JSON.stringify(snapshot);
    expect(scene.hasAttribute('inert')).toBe(true);
    old.root.querySelector('.battle-pile-back').click();
    expect(document.querySelector('.battle-decision')).toBeNull();
    expect(document.querySelector('.battle-stage')).toBe(scene);
    expect(scene.hasAttribute('inert')).toBe(false); expect(document.activeElement).toBe(opener);
    const current=open(kind); old.inspect({i:'0'}); old.back();
    expect(document.querySelector('.battle-decision')).toBe(current.root);
    expect(document.querySelector('#cardZoom')).toBeNull(); expect(JSON.stringify(snapshot)).toBe(before);
  });

  it.each(['hidden','closing','inert','token','page'])('ignores a stale/noninteractive pile inspection: %s', state => {
    const old=open();
    if(state==='hidden')UI.el.overlay.hidden=true;
    if(state==='closing')UI.el.overlay.classList.add('closing');
    if(state==='inert')UI.el.overlay.setAttribute('inert','');
    if(state==='token')snapshot={...snapshot,battleToken:1022};
    if(state==='page')UI.showOverlay('宝箱','<button>领取</button>','chest');
    const before=JSON.stringify(snapshot); old.inspect({i:'0'});
    expect(document.querySelector('#cardZoom')).toBeNull(); expect(JSON.stringify(snapshot)).toBe(before);
  });
});
