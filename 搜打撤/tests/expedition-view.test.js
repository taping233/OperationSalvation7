import { describe, expect, it, beforeEach } from 'vitest';
import { expeditionObjective, expeditionRoutes, renderExpeditionPanel } from '../game/src/expedition.view.js';

const layer = {
  logical: [
    { def: { type: 'entrance' }, next: [[0, 1], [0, 1], [1, 0], [0, 2]] },
    { def: { type: 'battle' }, next: [] },
    { def: { type: 'chest' }, next: [] },
  ],
  doors: [],
};

const makeGame = (extra = {}) => ({
  runActive: true, state: 'idle', layerIdx: 0, trackPos: 0,
  layerData: [layer], visited: {}, hp: 30, maxHp: 30, bossKilled: false,
  ...extra,
});

describe('expedition view route projection', () => {
  it('只列当前层相邻节点，去重并过滤跨层/非法边', () => {
    const routes = expeditionRoutes(makeGame());
    expect(routes.map(r => r.idx)).toEqual([1, 2]);
    expect(routes.every(r => r.li === 0)).toBe(true);
  });

  it('已访问普通节点仍可通行但标为已探索；门、撤离点保留专用状态', () => {
    const g = makeGame({ visited: { '0,1': 1 } });
    const route = expeditionRoutes(g).find(r => r.idx === 1);
    expect(route.cleared).toBe(true);
    expect(route.tone).toBe('quiet');
    expect(route.hint).toContain('已探索');
  });

  it('目标和低血量目标文案随状态变化', () => {
    expect(expeditionObjective(makeGame({ hp: 7 })).text).toContain('生命危急');
    expect(expeditionObjective(makeGame({ layerIdx: 2, layerData: [{}, {}, layer] })).text).toContain('献祭 3 张');
    expect(expeditionObjective(makeGame({ layerIdx: 3, layerData: [{}, {}, {}, layer], bossKilled: true })).text).toContain('终局撤离点');
  });

  it('同名相邻路线获得稳定的可视与无障碍区分，并保留节点索引', () => {
    const g = makeGame({
      layerData: [{ logical: [
        { def: { type: 'entrance' }, next: [[0, 1], [0, 2]] },
        { def: { type: 'battle' }, next: [] },
        { def: { type: 'battle' }, next: [] },
      ], doors: [] }],
    });
    const routes = expeditionRoutes(g);
    expect(routes.map(r => r.name)).toEqual(['遭遇战 · 路线1', '遭遇战 · 路线2']);
    expect(routes.map(r => r.ariaLabel)).toEqual(['遭遇战 · 路线1（节点 2）', '遭遇战 · 路线2（节点 3）']);
    expect(routes.map(r => r.idx)).toEqual([1, 2]);
  });

  it('只在路线起点标出补给支路和交战支路',()=>{
    const logical=[{id:'start',def:{type:'event'},next:[[0,1],[0,2]]},{id:'supply',def:{type:'chest'},next:[]},{id:'risk',def:{type:'battle'},next:[]}];
    const g=makeGame({layerData:[{logical,doors:[]}],routePlan:{status:'applied',layerIndex:0,startNodeId:'start',supplyNodeId:'supply',riskNodeId:'risk'}});
    expect(expeditionRoutes(g).map(r=>r.name)).toEqual(['补给支路 · 物资点','交战支路 · 遭遇战']);
    expect(expeditionRoutes({...g,trackPos:1})).toEqual([]);
  });
});

describe('expedition view DOM rendering', () => {
  let panel;
  beforeEach(() => {
    document.body.innerHTML = '<section id="routePanel"><div class="route-title"></div><p class="route-objective"></p><div class="route-options"></div></section>';
    panel = document.getElementById('routePanel');
  });

  it('对局非 idle 时禁用路线按钮，并保留相邻路线列表', () => {
    renderExpeditionPanel(panel, makeGame({ state: 'moving' }), icon => icon);
    expect(panel.querySelectorAll('button.route-option')).toHaveLength(2);
    expect([...panel.querySelectorAll('button')].every(button => button.disabled)).toBe(true);
    expect(panel.querySelector('.route-title').textContent).toBe('行动进行中');
  });

  it('状态未变化时稳定复用 DOM，状态变化时恢复原路线焦点', () => {
    const g = makeGame();
    renderExpeditionPanel(panel, g, icon => icon);
    const first = panel.querySelector('[data-route-index="1"]');
    first.focus();
    const before = panel.querySelector('.route-options');
    renderExpeditionPanel(panel, g, icon => icon);
    expect(panel.querySelector('.route-options')).toBe(before);
    const changed = makeGame({ moveTarget: { li: 0, idx: 2 } });
    renderExpeditionPanel(panel, changed, icon => icon);
    expect(document.activeElement?.dataset.routeIndex).toBe('1');
  });

  it('同名路线按钮的 aria-label 与 data-route-index 一一对应', () => {
    const g = makeGame({
      layerData: [{ logical: [
        { def: { type: 'entrance' }, next: [[0, 1], [0, 2]] },
        { def: { type: 'battle' }, next: [] },
        { def: { type: 'battle' }, next: [] },
      ], doors: [] }],
    });
    renderExpeditionPanel(panel, g, icon => icon);
    const buttons = [...panel.querySelectorAll('.route-option')];
    expect(buttons.map(b => b.dataset.routeIndex)).toEqual(['1', '2']);
    expect(buttons.map(b => b.getAttribute('aria-label'))).toEqual([
      '遭遇战 · 路线1（节点 2）', '遭遇战 · 路线2（节点 3）',
    ]);
  });

  it('转义快照可变的层名和路线文本',()=>{
    document.body.insertAdjacentHTML('beforeend','<div id="expeditionChapter"></div>');
    const g=makeGame({layerData:[{...layer,name:'<img src=x onerror=alert(1)>'}]});
    renderExpeditionPanel(panel,g,()=>'<i></i>');
    expect(document.querySelector('#expeditionChapter img')).toBeNull();
    expect(document.getElementById('expeditionChapter').textContent).toContain('<img');
  });
});
