// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import postcss from 'postcss';
import { createBattleDecisionPresenter, bindBattleDecisionInspection } from '../game/src/battle/view/battle.decision-shell.js';
import { battleHandSelectBodyHTML, battlePileBodyHTML } from '../game/src/battle/view/battle.decision-content.js';
import { battleDiscoverBodyHTML } from '../game/src/battle/view/battle.discover-view.js';
import { readCssSource } from './helpers/css-source.js';

const SDT=(await import('../game/src/core/sdt-facade.js')).default;
const {UI}=await import('../game/src/ui/ui.js');
let snapshot,show;
const card={id:'read-only',name:'详情卡',type:'法术',rarity:'古朴',cost:1,desc:'完整规则'};
const face=()=>'<div class="hs-card">详情卡</div>';
beforeEach(()=>{
  vi.useFakeTimers();
  document.body.innerHTML='<main id="viewport"><div id="heroAva">旅</div><button id="background">背景</button><div id="overlay" tabindex="-1" hidden><div class="card"><h2 id="ovTitle"></h2><div id="ovBody"></div></div></div></main>';
  SDT.Icons={rich:x=>x,img:()=>''};SDT.Sound={sfx(){}};SDT.Motion={overlayIn(){},reduceMotion:()=>true};
  SDT.Cards={all:()=>[card],DMG_TYPES:['法术'],rarityOf:c=>c.rarity,cardHTML:face};SDT.Art={cardIcon:()=>'',decodeIn(){}};
  UI._acts={};UI._overlayInerted=[];UI._overlayReturnFocus=null;UI._roomActive=false;UI.init();
  snapshot={battleToken:99,turn:3,energy:1,maxEnergy:2,opts:{isBoss:true}};
  show=createBattleDecisionPresenter({UI,getSnapshot:()=>snapshot,R:()=>({battleEnergy:2})});
});
afterEach(()=>{document.querySelector('#cardZoom')?._closeCardZoom?.(true);UI._cancelPageBg?.();vi.clearAllTimers();vi.useRealTimers();document.body.replaceChildren();document.body.className='';});

it.each([['宝箱','chest','reward-replica'],['事件','scene','event-scene'],['基地','page','base-camp']])('战斗二级页替换为%s后不残留宽壳、标题或选择器命中',(_name,mode,cls)=>{
  show('剩余牌库',battlePileBodyHTML({cards:[{uid:'a',card}],cardHTML:face,kind:'deck',isBoss:true}).html,true,snapshot);
  expect(document.querySelector('#overlay:has(.battle-decision-unified)')).not.toBeNull();
  UI.showOverlay(_name,`<section class="${cls}"><button>本页操作</button></section>`,mode);
  expect(document.querySelector('.battle-decision-unified')).toBeNull();
  expect(document.getElementById('ovTitle').textContent).toBe(_name);
  expect(document.querySelector('#overlay:has(.battle-decision-unified)')).toBeNull();
  expect(document.querySelector('.card').classList.contains('discover')).toBe(false);
  expect(document.querySelector('#ovBody').style.cssText).toBe('');
  const css=postcss.parse(readCssSource('game/css/battle-decision.css','utf8'));
  css.walkRules(rule=>{expect(document.querySelector(rule.selector),rule.selector).toBeNull();});
});
it('查看详情后关闭，原支付页、滚动、输入上下文和焦点不变',()=>{
  const selection={act:'payment',n:2,selectedUids:['paid'],mandatory:true,payment:{card:{name:'来源'}}};
  show('支付代价',battleHandSelectBodyHTML({pool:[{uid:'a',card}],handSelecting:selection,cardHTML:face}),'discover',snapshot);
  bindBattleDecisionInspection({UI,getSnapshot:()=>snapshot,cards:[card],snapshot});
  const root=document.querySelector('.battle-decision'),content=root.querySelector('.battle-decision-content');
  const button=root.querySelector('[data-act="btDecisionInspect"]');
  content.scrollTop=128;button.focus();UI._acts.btDecisionInspect(button.dataset);
  expect(document.querySelector('#cardZoom')).not.toBeNull();
  expect(UI.el.overlay.inert).toBe(true);
  document.querySelector('#cardZoom')._closeCardZoom(true);
  expect(document.querySelector('.battle-decision')).toBe(root);
  expect(content.scrollTop).toBe(128);expect(document.activeElement).toBe(button);
  expect(UI.el.overlay.inert).toBe(false);expect(selection.n).toBe(2);expect(selection.selectedUids).toEqual(['paid']);
});
it('旧详情动作在换页、隐藏或换战斗后无效',()=>{
  const html=battleHandSelectBodyHTML({pool:[{uid:'a',card}],handSelecting:{n:1,act:'copy',mandatory:false},cardHTML:face});
  const open=()=>{show('选牌',html,'discover',snapshot);bindBattleDecisionInspection({UI,getSnapshot:()=>snapshot,cards:[card],snapshot});return UI._acts.btDecisionInspect;};
  const old=open();UI.showOverlay('宝箱','<button>领取</button>','chest');old({i:'0'});expect(document.querySelector('#cardZoom')).toBeNull();
  const hidden=open();UI.el.overlay.hidden=true;hidden({i:'0'});expect(document.querySelector('#cardZoom')).toBeNull();
  const stale=open();snapshot={...snapshot,battleToken:100};stale({i:'0'});expect(document.querySelector('#cardZoom')).toBeNull();
});

it.each(['closing', 'inert', 'aria-hidden'])('rejects detail actions on a noninteractive page: %s', state => {
  show('选牌',battleHandSelectBodyHTML({pool:[{uid:'a',card}],handSelecting:{n:1,act:'copy',mandatory:false},cardHTML:face}),'discover',snapshot);
  bindBattleDecisionInspection({UI,getSnapshot:()=>snapshot,cards:[card],snapshot});
  if(state==='closing')UI.el.overlay.classList.add('closing');else UI.el.overlay.setAttribute(state,state==='inert'?'':'true');
  UI._acts.btDecisionInspect({i:'0'});expect(document.querySelector('#cardZoom')).toBeNull();
});
it('returns secondary page focus to the original battlefield opener', async () => {
  const {restoreCombatScene}=await import('../game/src/battle/view/battle.secondary-overlay.js');
  UI.showOverlay('', '<div class="battle-stage"><button id="pileOpener">消耗牌堆</button></div>', 'battle');
  const scene=document.querySelector('.battle-stage');scene._battleToken=snapshot.battleToken;
  const opener=document.querySelector('#pileOpener');opener.focus();
  show('消耗牌堆',battlePileBodyHTML({cards:[{uid:'a',card}],cardHTML:face,kind:'grave',isBoss:false}).html,true,snapshot);
  expect(scene.hasAttribute('inert')).toBe(true);
  expect(restoreCombatScene(UI,snapshot.battleToken)).toBe(true);
  expect(document.activeElement).toBe(opener);expect(scene.hasAttribute('inert')).toBe(false);
});

it('same discovery refresh keeps the staged choice and both scroll axes; a new round starts fresh', () => {
  snapshot.discovering = { roundId:1 };
  const body = token => battleDiscoverBodyHTML({ candidates:[{card},{card:{...card,id:'second',name:'另一张'}}],cardHTML:face,action:'选择 1 张',remaining:1,pageToken:token });
  show('发现',body('round-1'),'discover',snapshot);
  let row=document.querySelector('[data-selection-scroll]');
  row.scrollLeft=312;row.scrollTop=18;
  document.querySelector('[data-act="btDiscover"][data-i="1"]').click();
  show('发现',body('round-1'),'discover',snapshot);
  row=document.querySelector('[data-selection-scroll]');
  expect(row.scrollLeft).toBe(312);expect(row.scrollTop).toBe(18);
  expect(document.querySelector('[data-act="btDiscover"][data-i="1"]').getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelector('[data-act="btDiscoverConfirm"]').disabled).toBe(false);
  snapshot.discovering = { roundId:2 };
  show('发现',body('round-2'),'discover',snapshot);
  expect(document.querySelector('[data-selection-scroll]').scrollLeft).toBe(0);
  expect(document.querySelector('[data-discovery-selected="true"]')).toBeNull();
  expect(document.querySelector('[data-act="btDiscoverConfirm"]').disabled).toBe(true);
});

it('hand-selection refresh retains its horizontal position and the next candidate focus without leaking into another selection', () => {
  snapshot.handSelecting={selectionId:1};
  const body=pool=>battleHandSelectBodyHTML({pool,handSelecting:{n:1,act:'copy',mandatory:false},cardHTML:face});
  const pool=[{uid:'a',card},{uid:'b',card:{...card,id:'next',name:'下一张'}}];
  show('选牌',body(pool),'discover',snapshot);
  document.querySelector('[data-selection-scroll]').scrollLeft=180;
  document.querySelector('[data-act="btPickHand"][data-uid="a"]').focus();
  show('选牌',body(pool.slice(1)),'discover',snapshot);
  expect(document.querySelector('[data-selection-scroll]').scrollLeft).toBe(180);
  expect(document.activeElement.dataset.uid).toBe('b');
  snapshot.handSelecting={selectionId:2};
  show('选牌',body(pool),'discover',snapshot);
  expect(document.querySelector('[data-selection-scroll]').scrollLeft).toBe(0);
});
