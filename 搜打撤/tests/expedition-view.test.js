import { describe, expect, it, beforeEach, vi } from 'vitest';
import { expeditionObjective, expeditionRoutes, getExpeditionPreview, renderExpeditionPanel, setExpeditionPreview } from '../game/src/run/expedition.view.js';

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
  nodes: layer.logical.map((cell, idx) => ({ li: 0, idx, def: cell.def })),
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
    expect(route.hint).toContain('已完成');
  });

  it('目标和低血量目标文案随状态变化', () => {
    expect(expeditionObjective(makeGame({ hp: 7 })).text).toContain('生命危急');
    expect(expeditionObjective(makeGame({ layerIdx: 2, layerData: [{}, {}, layer] })).text).toContain('献祭 3 张');
    expect(expeditionObjective(makeGame({ layerIdx: 3, layerData: [{}, {}, {}, layer], bossKilled: true })).text).toContain('终局撤离点');
  });

  it('第三层同时说明紧急撤离代价和第四层深入目标', () => {
    const objective = expeditionObjective(makeGame({ layerIdx: 2 }));
    expect(objective.text).toContain('献祭 3 张');
    expect(objective.text).toContain('深入第四层');
  });

  it('第四层按祭坛未激活、奖励待领和首脑已解锁分别提示下一步', () => {
    const g = makeGame({ layerIdx: 3 });
    expect(expeditionObjective(g).text).toContain('弃 3 张卡牌');
    expect(expeditionObjective({ ...g, altarActivated: true, altarRewardPending: true }).text).toContain('领取奖励');
    expect(expeditionObjective({ ...g, altarActivated: true, altarRewardPending: false }).text).toContain('编组牌库');
  });

  it('首脑胜利后的低血量仍提示终局撤离通关，未胜利仍提示治疗', () => {
    const g = makeGame({ layerIdx: 3, hp: 1, bossKilled: true });
    expect(expeditionObjective(g).text).toContain('完成通关');
    expect(expeditionObjective(g).tone).toBe('gold');
    expect(expeditionObjective({ ...g, bossKilled: false }).text).toContain('生命危急');
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
    expect(routes.map(r => r.ariaLabel)).toEqual(['遭遇战 · 路线1（节点 2） · 未完成', '遭遇战 · 路线2（节点 3） · 未完成']);
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
  beforeEach(() => {
    document.body.innerHTML = '<aside id="sidebar"></aside><nav id="expeditionChapter"></nav>';
  });

  it.each([[0, 'empty', 0], [4, 'ready', 1], [12, 'tight', 3], [16, 'full', 4], [20, 'full', 4]])('背包占格%s用进度条展示状态，读屏仍获得准确容量', (used, state) => {
    renderExpeditionPanel(null, makeGame({usedSlots:()=>used, bagCap:()=>16}), icon=>icon);
    const bag = document.querySelector('[data-expedition-tool="bag"]');
    expect(bag.dataset.capacityState).toBe(state);
    expect(bag.querySelector('.expedition-bag-capacity i').style.width).toBe(`${Math.min(100, used / 16 * 100)}%`);
    expect(bag.querySelector('.expedition-bag-capacity').getAttribute('aria-hidden')).toBe('true');
    expect(bag.querySelector('strong').textContent).toBe(`${used}/16`);
    expect(bag.textContent).not.toMatch(/余|已满|格/);
    expect(bag.getAttribute('aria-label')).toContain(`占格 ${used}/16`);
    expect(bag.style.getPropertyValue('--bag-fill')).toBe(`${Math.min(100, used / 16 * 100)}%`);
  });

  it('默认只保留工具带，不创建路线目录或显示空预览', () => {
    renderExpeditionPanel(null, makeGame(), icon => icon);
    expect(document.getElementById('routePanel')).toBeNull();
    expect(document.querySelectorAll('.route-option')).toHaveLength(0);
    expect(document.querySelector('.expedition-map-preview').hidden).toBe(true);
    expect([...document.querySelectorAll('[data-expedition-tool]')].map(el=>el.dataset.expeditionTool)).toEqual(['bag','safe','pocket','focus','overview']);
    expect(document.querySelector('.expedition-chibi')).toBeNull();
  });

  it('选中相邻节点时只显示该节点身份、可达状态与明确进入动作', () => {
    const g = makeGame();
    setExpeditionPreview(g, g.nodes[1]);
    renderExpeditionPanel(null, g, icon => icon);
    const strip = document.querySelector('.expedition-map-preview');
    expect(strip.hidden).toBe(false);
    expect(strip.querySelector('b').textContent).toBe('遭遇战');
    expect(strip.textContent).toContain('可以前往');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);
    expect(strip.querySelectorAll('button')).toHaveLength(2);
    expect(document.getElementById('routePanel')).toBeNull();
  });

  it('已消耗的相邻节点与脚下节点保留原类型并明确已完成，仍可进入', () => {
    const g = makeGame({ visited: { '0,1': 1 } });
    setExpeditionPreview(g, g.nodes[1]);
    renderExpeditionPanel(null, g, icon => icon);
    let strip = document.querySelector('.expedition-map-preview');
    expect(strip.querySelector('b').textContent).toBe('遭遇战');
    expect(strip.querySelector('.empty-node-icon')).toBeNull();
    expect(strip.querySelector('.map-node-painted')).not.toBeNull();
    expect(strip.textContent).toContain('内容已结算');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);
    g.trackPos = 1;
    setExpeditionPreview(g, g.nodes[1]);
    renderExpeditionPanel(null, g, icon => icon);
    strip = document.querySelector('.expedition-map-preview');
    expect(strip.querySelector('b').textContent).toBe('遭遇战');
    expect(strip.querySelector('.empty-node-icon')).toBeNull();
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);
    expect(document.querySelector('.expedition-toolbar-location')).toBeNull();
    expect(strip.querySelectorAll('.map-node-painted')).toHaveLength(1);
  });

  it('行动中保留单节点信息，但进入动作不可用', () => {
    const g = makeGame({ state: 'moving' });
    setExpeditionPreview(g, g.nodes[1]);
    renderExpeditionPanel(null, g, icon => icon);
    const strip = document.querySelector('.expedition-map-preview');
    expect(strip.textContent).toContain('遭遇战');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);
    expect(document.querySelectorAll('.route-option')).toHaveLength(0);
  });

  it('已知但不相邻节点可读类别和受限状态，不能从预览进入', () => {
    const g = makeGame({ nodes: [...makeGame().nodes, { li: 0, idx: 3, def: { type: 'shop' } }] });
    setExpeditionPreview(g, g.nodes[3]);
    renderExpeditionPanel(null, g, icon => icon);
    const strip = document.querySelector('.expedition-map-preview');
    expect(strip.textContent).toContain('商店');
    expect(strip.textContent).toContain('暂不可前往');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);
  });

  it('低生命战斗预览给出风险提示，恢复后更新且不改变游戏状态', () => {
    const g=makeGame({hp:5});
    setExpeditionPreview(g,g.nodes[1]);
    const before=JSON.stringify(g);
    renderExpeditionPanel(null,g,icon=>icon);
    const strip=document.querySelector('.expedition-map-preview');
    expect(strip.dataset.nodeTone).toBe('danger');
    expect(strip.querySelector('.expedition-preview-risk').textContent).toContain('生命偏低');
    expect(JSON.stringify(g)).toBe(before);
    g.hp=g.maxHp;
    renderExpeditionPanel(null,g,icon=>icon);
    expect(strip.querySelector('.expedition-preview-risk')).toBeNull();
  });

  it('闸门覆盖底层战斗类型时，预览使用通道身份而非危险标记', () => {
    const g=makeGame({hp:5,layerData:[{...layer,doors:[{at:1,reverse:false}]}]});
    setExpeditionPreview(g,g.nodes[1]);
    renderExpeditionPanel(null,g,icon=>icon);
    const strip=document.querySelector('.expedition-map-preview');
    expect(strip.querySelector('b').textContent).toBe('层间闸门');
    expect(strip.dataset.nodeTone).toBe('neutral');
    expect(strip.querySelector('.expedition-preview-risk')).toBeNull();
  });

  it('预览绑定当前位置，换节点后旧选择失效', () => {
    const g = makeGame();
    setExpeditionPreview(g, g.nodes[1]);
    renderExpeditionPanel(null, g, icon => icon);
    g.trackPos = 1;
    g.moveTarget = null;
    renderExpeditionPanel(null, g, icon => icon);
    expect(getExpeditionPreview(g)).toBeNull();
    expect(document.querySelector('.expedition-map-preview').hidden).toBe(true);
  });

  it('相同状态保留预览节点，已探索与门身份变化后更新单节点内容', () => {
    const g = makeGame({ layerData: [{ ...layer, doors: [] }] });
    g.moveTarget = { li: 0, idx: 1 };
    renderExpeditionPanel(null, g, icon => icon);
    const strip = document.querySelector('.expedition-map-preview');
    const enter = strip.querySelector('[data-route-enter]');
    renderExpeditionPanel(null, g, icon => icon);
    expect(strip.querySelector('[data-route-enter]')).toBe(enter);
    g.visited['0,1'] = 1;
    renderExpeditionPanel(null, g, icon => icon);
    expect(strip.textContent).toContain('已完成');
    g.layerData[0].doors = [{ at: 1, reverse: false }];
    renderExpeditionPanel(null, g, icon => icon);
    expect(strip.textContent).toContain('层间闸门');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);
  });

  it('工具带复用日志DOM，位置摘要不写入game状态且不重复创建', () => {
    document.body.insertAdjacentHTML('beforeend', '<section id="logPanel"><button>日志</button></section><button id="bagBtnFloat">背包</button>');
    const log = document.getElementById('logPanel');
    const bag = document.getElementById('bagBtnFloat');
    const g = makeGame();
    const before = JSON.stringify(g);
    renderExpeditionPanel(null, g, icon => icon);
    renderExpeditionPanel(null, g, icon => icon);
    expect(document.querySelectorAll('.expedition-nav-summary')).toHaveLength(1);
    expect(document.querySelectorAll('.expedition-map-preview')).toHaveLength(1);
    expect(document.querySelector('.expedition-toolbar-location')).toBeNull();
    expect(document.querySelector('.expedition-nav-summary').textContent).toContain('背包');
    expect(log.parentElement.id).toBe('sidebar');
    expect(bag.parentElement).toBe(document.body);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('当前位置预览有查看本地内容入口，且转义可变层名', () => {
    const g = makeGame({ layerData: [{ ...layer, name: '<img src=x onerror=alert(1)>' }] });
    setExpeditionPreview(g, g.nodes[0]);
    renderExpeditionPanel(null, g, () => '<i></i>');
    const strip = document.querySelector('.expedition-map-preview');
    expect(strip.textContent).toContain('当前位置');
    expect(strip.querySelector('[data-route-enter]').textContent).toContain('查看本地内容');
    expect(document.querySelector('#expeditionChapter img')).toBeNull();
    expect(document.getElementById('expeditionChapter').textContent).toContain('<img');
  });
  it('地图不渲染操作图例和地点列表，消耗区保持原标签', () => {
    const g = makeGame({ usedPocket:[{ card:{ type:'装备' }, count:2 }] });
    renderExpeditionPanel(null, g, icon => icon);
    expect(document.querySelector('.expedition-map-guide')).toBeNull();
    expect(document.querySelector('[data-expedition-tool="pocket"]').getAttribute('aria-label')).toBe('消耗区：已消耗卡牌 2');
  });
});

describe('地图取景入口语义',()=>{
  it('全景与定位公开范围和快捷键，未知地点不承诺揭示',()=>{
    document.body.innerHTML='<aside id="sidebar"></aside><nav id="expeditionChapter"></nav>';
    renderExpeditionPanel(null,makeGame(),icon=>icon);
    const overview=document.querySelector('[data-expedition-tool="overview"]');
    expect(overview.textContent).toContain('全景');
    expect(overview.title).toContain('未探明地点仅显示剪影');
    expect(overview.getAttribute('aria-label')).toContain('未知地点保留迷雾');
    expect(document.querySelector('[data-expedition-tool="focus"]').title).toContain('当前位置与相邻路线');
  });
});


it('移动期间侧栏不改取景与inset，抵达后的侧栏改动平滑取景', () => {
  document.body.innerHTML='<aside id="sidebar"></aside><nav id="expeditionChapter"></nav>';
  const cam={viewW:1920,detailInset:0,frameMode:'travel',setDetailInset:vi.fn(function(width){this.detailInset=width}),frameExploration:vi.fn()};
  const g=makeGame({cam,state:'moving',moveTarget:{li:0,idx:1}});
  renderExpeditionPanel(null,g,icon=>icon);
  expect(cam.frameMode).toBe('travel');expect(cam.setDetailInset).not.toHaveBeenCalled();expect(cam.frameExploration).not.toHaveBeenCalled();
  cam.frameMode='routes';g.state='idle';
  renderExpeditionPanel(null,g,icon=>icon);
  expect(cam.frameExploration).toHaveBeenCalledWith(g,false,{glide:true});
});
