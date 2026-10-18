import { readFileSync } from 'node:fs';
import postcss from 'postcss';
import { beforeEach, expect, it, vi } from 'vitest';
import { cardResultRows, showBattleCardResults } from '../game/src/battle/view/battle.card-results.js';
import { createBattleDraw } from '../game/src/battle/core/battle.draw.js';
import * as runtime from '../game/src/battle/runtime/battle.runtime.js';

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

it('真实发牌端口区分获得新牌和普通抽牌，合并重复卡名并标明去向', () => {
  const draw = createBattleDraw({ alive: () => [], fireAcquire: vi.fn() });
  draw.addTempCard({ id: 'a', name: '火球' });
  draw.addTempCard({ id: 'a', name: '火球' });
  draw.addTempCard({ id: 'b', name: '冰箭' });
  draw.addDeckCard({ id: 'c', name: '雷击' });
  showBattleCardResults(stage, [...runtime.cardAnims, { kind: 'draw', name: '普通抽牌' }]);
  const panel = stage.querySelector('.bt-card-results');
  expect(panel.textContent).toContain('获得卡牌 · 置入手牌【火球】×2、【冰箭】');
  expect(panel.textContent).toContain('获得卡牌 · 洗入牌库【雷击】');
  expect(panel.textContent).not.toContain('普通抽牌');
  expect(runtime.hand).toHaveLength(3);
  expect(runtime.drawPile).toHaveLength(1);
});

it('随机释放逐发列出实际卡牌、目标与来源，重绘保留记录，换场清空', () => {
  showBattleCardResults(stage, [
    { kind: 'surge', name: '火球', targetName: '敌人甲', i: 1, n: 4 },
    { kind: 'surge', name: '冰箭', targetName: '敌人乙', i: 2, n: 4 },
    { kind: 'surge', name: '三重火球', targetName: '敌人甲', sourceName: '火球符文', i: 1, n: 1 },
  ]);
  expect(stage.textContent).toContain('法力奔涌 · 随机释放 1/4【火球】 → 敌人甲');
  expect(stage.textContent).toContain('随机释放 2/4【冰箭】 → 敌人乙');
  expect(stage.textContent).toContain('火球符文 · 随机释放【三重火球】 → 敌人甲');
  stage.replaceChildren();
  showBattleCardResults(stage, []);
  expect(stage.querySelectorAll('.bt-card-result')).toHaveLength(3);
  stage._battleToken = 2;
  showBattleCardResults(stage, []);
  expect(stage.querySelector('.bt-card-results')).toBeNull();
});

it('只记录已结算的卡牌，转义卡名并保留最近六条结果', () => {
  expect(cardResultRows([{ kind: 'play', name: '打出的牌' }, { kind: 'burn', name: '消耗的牌' }])).toEqual([]);
  for (let i = 0; i < 8; i++) showBattleCardResults(stage, [{ kind: 'draw', acquired: true, name: `牌${i}<img onerror="bad()">` }]);
  expect(stage.querySelectorAll('.bt-card-result')).toHaveLength(6);
  expect(stage.textContent).not.toContain('牌0');
  expect(stage.textContent).toContain('牌7<img onerror="bad()">');
  expect(stage.querySelector('img')).toBeNull();
});


it('正式舞台结果日志与道具栏横向分区，高度封顶且保留滚动', () => {
  const declarations = selector => {
    const result = {};
    for (const file of ['battle.css', 'battle-stage.css']) {
      postcss.parse(readFileSync(`game/css/${file}`, 'utf8')).walkRules(rule => {
        if (rule.selector === selector) rule.walkDecls(d => { result[d.prop] = d.value; });
      });
    }
    return result;
  };
  const log = { ...declarations('.bt-card-results'), ...declarations('#overlay .battle-stage.sts>.bt-card-results') };
  const items = declarations('#overlay .battle-stage.sts>.bt-potions');
  const infusion = declarations('#overlay .battle-stage.sts>.bt-infuse');
  const topbar = declarations('#overlay .battle-stage.sts .sts-topbar');
  expect(log.right).toBe('auto');
  expect(log['box-sizing']).toBe('border-box');
  expect(log.overflow).toBe('auto');
  expect(log['pointer-events']).toBe('auto');
  const px = value => Number.parseFloat(value);
  // 当前平台逻辑画布1920宽；同一缩放变换保持两个区间不相交。
  expect(px(log.left)).toBeGreaterThan(px(items.left) + px(items['max-width']));
  // 玩家中心400/名牌宽290；四敌第一名牌左界约1056，单首脑更靠右。
  expect(px(log.left)).toBeGreaterThan(400 + 290 / 2);
  expect(px(log.left) + px(log.width)).toBeLessThan(1056);
  expect(px(log.top) + px(log['max-height'])).toBeLessThan(px(infusion.top));
  expect(px(log['z-index'])).toBeLessThan(px(infusion['z-index']));
  expect(px(log['z-index'])).toBeLessThan(px(topbar['z-index']));
  for (let i = 0; i < 12; i++) showBattleCardResults(stage, [{ kind: 'surge', name: `招式${i}`, targetName: '敌人', i: 1, n: 1 }]);
  const panel = stage.querySelector('.bt-card-results');
  expect(panel.getAttribute('role')).toBe('log');
  expect(panel.getAttribute('aria-live')).toBe('polite');
  expect(panel.querySelectorAll('.bt-card-result')).toHaveLength(6);
  expect(panel.textContent).toContain('招式11');
});

it('顶部透明空白区不截获日志输入，实际顶栏控件保留交互', () => {
  const rules = new Map();
  postcss.parse(readFileSync('game/css/battle-stage.css', 'utf8')).walkRules(rule => {
    const values = rules.get(rule.selector) || {};
    rule.walkDecls(d => { values[d.prop] = d.value; }); rules.set(rule.selector, values);
  });
  expect(rules.get('#overlay .battle-stage.sts .sts-topbar')?.['pointer-events']).toBe('none');
  expect(rules.get('#overlay .battle-stage.sts .sts-topbar > :is(.sts-encounter,.sts-options)')?.['pointer-events']).toBe('auto');
  stage.classList.add('sts');
  stage.insertAdjacentHTML('afterbegin', '<div class="sts-topbar"><div class="sts-encounter">回合</div><details class="sts-options" open><summary>选项</summary><div class="sts-options-menu"><button>设置</button></div></details></div>');
  const style = document.createElement('style');
  style.textContent = [...rules].filter(([selector]) => selector.includes('.sts-topbar')).map(([selector, values]) => `${selector}{${Object.entries(values).map(([name, value]) => `${name}:${value}`).join(';')}}`).join('');
  document.head.appendChild(style);
  try {
    expect(getComputedStyle(stage.querySelector('.sts-topbar')).pointerEvents).toBe('none');
    for (const selector of ['.sts-encounter', '.sts-options', '.sts-options summary', '.sts-options-menu button']) {
      expect(getComputedStyle(stage.querySelector(selector)).pointerEvents).toBe('auto');
    }
  } finally { style.remove(); }
});

it('用户回看日志后，无新增结果的真实DOM更新保留节点及滚动位置', () => {
  showBattleCardResults(stage, [{ kind:'draw', acquired:true, name:'第一张' }, { kind:'surge', name:'第二张' }]);
  const panel = stage.querySelector('.bt-card-results');
  Object.defineProperties(panel, { scrollHeight:{ configurable:true, value:113 }, clientHeight:{ configurable:true, value:76 } });
  panel.scrollTop = 35.7966;
  panel.scrollTop = 0; // DOM模拟用户向上滚动；jsdom不执行浏览器滚轮默认行为。
  panel.dispatchEvent(new Event('scroll'));
  showBattleCardResults(stage, []);
  showBattleCardResults(stage, [{ kind:'play', name:'不产生结果日志的动作' }]);
  expect(stage.querySelector('.bt-card-results')).toBe(panel);
  expect(panel.scrollTop).toBe(0);
  expect(panel.querySelectorAll('.bt-card-result')).toHaveLength(2);
});

it('锦囊来源只改结果标签，普通获得仍入手且不与取出施放合并', () => {
  const draw = createBattleDraw({ alive: () => [], fireAcquire: vi.fn() });
  draw.addTempCard({id:'p',name:'冰封千里'}, {source:'pouch'});
  draw.addTempCard({id:'n',name:'普通发现'});
  showBattleCardResults(stage, runtime.cardAnims);
  expect(stage.textContent).toContain('法师锦囊 · 取出施放【冰封千里】');
  expect(stage.textContent).toContain('获得卡牌 · 置入手牌【普通发现】');
  expect(runtime.hand).toHaveLength(2);
  expect(runtime.granted.map(o => o.card)).toEqual([{id:'p',name:'冰封千里'},{id:'n',name:'普通发现'}]);
});

it('queued discoveries remain separate from acquired copies and pouch, without claiming execution success', () => {
 const draw=createBattleDraw({alive:()=>[],fireAcquire:vi.fn()});
 const card={id:'same',name:'同名法术'};
 draw.addTempCard(card,{source:'discover-cast'});
 draw.addTempCard(card);draw.addTempCard(card);
 draw.addTempCard(card,{source:'pouch'});
 showBattleCardResults(stage,runtime.cardAnims);
 const rows=[...stage.querySelectorAll('.bt-card-result')];
 expect(rows).toHaveLength(3);
 expect(rows[0].textContent).toBe('发现卡牌 · 排队施放【同名法术】');
 expect(rows[1].textContent).toBe('获得卡牌 · 置入手牌【同名法术】×2');
 expect(rows[2].textContent).toBe('法师锦囊 · 取出施放【同名法术】');
 expect(stage.textContent).not.toMatch(/已施放|施放成功/);
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
 flow.pickDiscover(0);showBattleCardResults(stage,runtime.cardAnims);
 expect(execute).toHaveBeenCalledOnce();expect(finish).toHaveBeenCalledOnce();
 expect(stage.querySelector('.bt-card-result').textContent).toBe('发现卡牌 · 排队施放【迟到法术】');
 expect(stage.textContent).not.toMatch(/已施放|施放成功/);
 const before=runtime.cardAnims.length;active=false;state={n:1,act:'play',options:[{id:'stale',name:'旧选项'}]};flow.pickDiscover(0);
 expect(runtime.cardAnims).toHaveLength(before);expect(execute).toHaveBeenCalledOnce();
});
