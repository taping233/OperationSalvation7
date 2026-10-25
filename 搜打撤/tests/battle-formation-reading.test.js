// @vitest-environment jsdom
import { beforeEach, expect, it, vi } from 'vitest';

const state=vi.hoisted(()=>({snapshot:null,select:vi.fn()}));
vi.mock('../game/src/battle/core/battle.core.js',()=>({
  commands:{selectDeckCard:state.select},getSnapshot:()=>state.snapshot,AFFIX_META:{},
  R:()=>({battleEnergy:2,battleStartDraw:5,battleTurnDraw:1,bossDeckSize:15}),findEffectiveCard:()=>null,
}));
const UI={el:{},_acts:{},act(name,handler){this._acts[name]=handler;},refresh(){},
  showOverlay(_title,html){this.el.ovBody.innerHTML=html;},showCardZoom:vi.fn()};
window.SDT={UI,game:{},Cards:{cardHTML:card=>`<div class="hs-card">${card.name}</div>`}};
const {renderDeckSelection}=await import('../game/src/battle/view/battle.overlays.js');

beforeEach(()=>{
  document.body.innerHTML='<div id="overlay"><div class="card"><div id="ovBody"></div></div></div>';
  UI.el.ovBody=document.getElementById('ovBody');UI.el.overlay=document.getElementById('overlay');
  UI._acts={};UI.showCardZoom.mockClear();state.select.mockClear();
  state.snapshot={battleToken:17,deckSelection:{selected:['a'],need:2,max:2,starterCount:5,
    boss:{name:'首脑',atk:3,hp:30},cards:[{uid:'a',card:{id:'a',name:'已选卡',type:'武术',desc:'造成伤害'}},
      {uid:'b',card:{id:'b',name:'待选装备',type:'装备',desc:'对战开始时，获得护甲'}}]}};
});

it('formation reading is separate from selecting and keeps the exact inspected card identity',()=>{
  renderDeckSelection(state.snapshot);
  const root=document.querySelector('[data-decision-kind="formation"]');
  const inspect=root.querySelector('[data-act="btDecisionInspect"][data-i="1"]');
  UI._acts.btDecisionInspect(inspect.dataset);
  expect(UI.showCardZoom).toHaveBeenCalledWith(state.snapshot.deckSelection.cards[1].card,expect.objectContaining({returnFocus:inspect,index:1}));
  expect(state.select).not.toHaveBeenCalled();expect(state.snapshot.deckSelection.selected).toEqual(['a']);
  expect(root.querySelectorAll('.battle-select-slot')).toHaveLength(2);
  expect(root.querySelector('.boss-start-note').textContent).toContain('占装备栏');
});

it('selection feedback updates in place and preserves the candidate scroll position',()=>{
  renderDeckSelection(state.snapshot);
  const root=document.querySelector('[data-decision-kind="formation"]'),grid=root.querySelector('[data-selection-scroll]');
  grid.scrollTop=260;
  state.snapshot.deckSelection.selected.push('b');renderDeckSelection(state.snapshot);
  expect(document.querySelector('[data-decision-kind="formation"]')).toBe(root);
  expect(grid.scrollTop).toBe(260);
  expect(root.querySelector('[data-uid="b"]').getAttribute('aria-pressed')).toBe('true');
  expect(root.querySelector('[data-uid="b"] .boss-selection-state').textContent).toBe('已编入');
  expect(root.querySelector('[data-act="bossGo"]').disabled).toBe(false);
});
