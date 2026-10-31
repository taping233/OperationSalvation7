import postcss from 'postcss';
import { beforeEach, expect, it, vi } from 'vitest';
import { createBattleDraw } from '../game/src/battle/core/battle.draw.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';
import { readCssSource } from './helpers/css-source.js';

let stage;
beforeEach(() => {
  document.body.innerHTML = '<div id="overlay"><div class="battle-stage"></div></div>';
  stage = document.querySelector('.battle-stage');
  stage._battleToken = 1;
  runtime.set$hand([]);
  runtime.clearBattlePiles();
  runtime.set$lastDrawnUids([]);
  runtime.clearBattlePresentation();
});

it('真实发牌端口保留逐张获得事件并区分手牌与牌库去向', () => {
  const draw = createBattleDraw({ alive: () => [], fireAcquire: vi.fn() });
  const first = draw.addTempCard({ id: 'a', name: '火球' });
  const second = draw.addTempCard({ id: 'a', name: '火球' });
  const third = draw.addTempCard({ id: 'b', name: '冰箭' });
  const deck = draw.addDeckCard({ id: 'c', name: '雷击' });
  expect(runtime.cardAnims).toEqual([
    expect.objectContaining({ kind: 'draw', uid: first, name: '火球', acquired: true }),
    expect.objectContaining({ kind: 'draw', uid: second, name: '火球', acquired: true }),
    expect.objectContaining({ kind: 'draw', uid: third, name: '冰箭', acquired: true }),
    expect.objectContaining({ kind: 'shuffle', uid: deck, name: '雷击' }),
  ]);
  expect(runtime.hand).toEqual([first, second, third]);
  expect(runtime.drawPile).toEqual([deck]);
});

it('顶部透明空白区不截获舞台输入，实际顶栏控件保留交互', () => {
  const rules = new Map();
  postcss.parse(readCssSource('game/css/battle-stage.css', 'utf8')).walkRules(rule => {
    const values = rules.get(rule.selector) || {};
    rule.walkDecls(d => { values[d.prop] = d.value; }); rules.set(rule.selector, values);
  });
  expect(rules.get('#overlay .battle-stage.sts .sts-topbar')?.['pointer-events']).toBe('none');
  expect(rules.get('#overlay .battle-stage.sts .sts-topbar > :is(.sts-encounter,.bt-potions)')?.['pointer-events']).toBe('auto');
  stage.classList.add('sts');
  stage.insertAdjacentHTML('afterbegin', '<div class="sts-topbar"><div class="sts-encounter">回合</div><div class="bt-potions"><button>道具</button></div></div>');
  const style = document.createElement('style');
  style.textContent = [...rules].filter(([selector]) => selector.includes('.sts-topbar')).map(([selector, values]) => `${selector}{${Object.entries(values).map(([name, value]) => `${name}:${value}`).join(';')}}`).join('');
  document.head.appendChild(style);
  try {
    expect(getComputedStyle(stage.querySelector('.sts-topbar')).pointerEvents).toBe('none');
    for (const selector of ['.sts-encounter', '.bt-potions', '.bt-potions button']) {
      expect(getComputedStyle(stage.querySelector(selector)).pointerEvents).toBe('auto');
    }
  } finally { style.remove(); }
});

it('锦囊与普通获得保留各自事件来源，均正常入手', () => {
  const draw = createBattleDraw({ alive: () => [], fireAcquire: vi.fn() });
  draw.addTempCard({id:'p',name:'冰封千里'}, {source:'pouch'});
  draw.addTempCard({id:'n',name:'普通发现'});
  expect(runtime.cardAnims).toMatchObject([
    { kind: 'draw', name: '冰封千里', acquired: true, source: 'pouch' },
    { kind: 'draw', name: '普通发现', acquired: true },
  ]);
  expect(runtime.cardAnims[1].source).toBeUndefined();
  expect(runtime.hand).toHaveLength(2);
  expect(runtime.granted.map(o => o.card)).toEqual([{id:'p',name:'冰封千里'},{id:'n',name:'普通发现'}]);
});

it('queued discoveries retain distinct source events alongside acquired copies and pouch', () => {
 const draw=createBattleDraw({alive:()=>[],fireAcquire:vi.fn()});
 const card={id:'same',name:'同名法术'};
 draw.addTempCard(card,{source:'discover-cast'});
 draw.addTempCard(card);draw.addTempCard(card);
 draw.addTempCard(card,{source:'pouch'});
 expect(runtime.cardAnims.map(event=>event.source)).toEqual(['discover-cast',undefined,undefined,'pouch']);
 expect(runtime.cardAnims.every(event=>event.kind==='draw' && event.acquired && event.name===card.name)).toBe(true);
 expect(new Set(runtime.cardAnims.map(event=>event.uid)).size).toBe(4);
 expect(runtime.hand).toHaveLength(4);expect(runtime.granted.map(o=>o.card)).toEqual([card,card,card,card]);
});

it('a discovery rejected by an empty battlefield reports only queued intent; ended battles emit nothing', async () => {
 const {createBattleDiscoverFlow}=await import('../game/src/battle/effects/battle.discover-flow.js');
 const draw=createBattleDraw({alive:()=>[],fireAcquire:vi.fn()});
 let active=true,state={n:1,act:'play',options:[{id:'late',name:'迟到法术'}]};
 const execute=vi.fn(()=>false),finish=vi.fn();
 const flow=createBattleDiscoverFlow({
  cards:{addTempCard:draw.addTempCard,findByUid:uid=>runtime.granted.find(o=>o.uid===uid),fireCatGift(){},queueCardExecution:execute},
  interaction:{get:()=>state,set:value=>{state=value;},getJobs:()=>[],requestRender(){}},random:{next:()=>0},effects:{},output:{log(){}},
  battle:{battleActive:()=>active,firstAliveTarget:()=>null,hasAliveFoes:()=>false,sweepDead(){},finishVictory:finish},
 });
 flow.pickDiscover(0);
 expect(execute).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledOnce();
 expect(runtime.cardAnims).toMatchObject([{kind:'draw',name:'迟到法术',acquired:true,source:'discover-cast'}]);
 expect(execute.mock.calls[0][0]).toBe(runtime.cardAnims[0].uid);
 expect(runtime.hand).toContain(runtime.cardAnims[0].uid);
 const before=runtime.cardAnims.length;active=false;state={n:1,act:'play',options:[{id:'stale',name:'旧选项'}]};flow.pickDiscover(0);
 expect(runtime.cardAnims).toHaveLength(before);expect(execute).toHaveBeenCalledOnce();
});
