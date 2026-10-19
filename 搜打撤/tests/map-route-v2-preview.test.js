import { describe,it,expect } from 'vitest';
import { createCurrentLayeredMap } from '../game/src/run/layeredMap.js';
import { applyRouteOverlay } from '../game/src/ui/route-overlay.js';
import { applyGuardedRoute } from '../game/src/run/map-route-v2.js';
import { expeditionRoutes,renderExpeditionPanel,setExpeditionPreview } from '../game/src/run/expedition.view.js';
import { findMapTravelPath } from '../game/src/run/map-travel-path.js';
function makeGame(seed=appliedSeed) {
  const previous=applyRouteOverlay({generatorVersion:6,layoutVersion:9,layerData:createCurrentLayeredMap(seed)}).value;
  const value=applyGuardedRoute({generatorVersion:6,layoutVersion:9,layerData:previous.layerData,baseRoutePlan:previous.routePlan}).value;
  const plan=value.routePlan,layer=value.layerData[1],idx=id=>layer.nodes.findIndex(n=>n.id===id),fork=idx(plan.forkNodeId);
  return {...value,layerIdx:1,trackPos:fork,runActive:true,state:'idle',visited:{},seen:{},nodes:value.layerData.flatMap((l,li)=>l.logical.map((n,idx)=>({li,idx,def:n.def}))),hp:30,maxHp:30,ownedCards:[],usedPocket:[],coins:0,
    fork,guard:idx(plan.guardNodeId),reward:idx(plan.rewardNodeId),fire:idx(plan.recoveryNodeId)};
}
const samples=Array.from({length:200},(_,i)=>`audit-map-20261017-${i}`);
const appliedSeed=samples.find(seed=>{const g=makeGame(seed);return g.routePlan.status==='applied' && g.routePlan.removedEdges.length>0;});
const fallbackSeed=samples.find(seed=>makeGame(seed).routePlan.status==='fallback');

describe('route-v2知情选择与真实移动',()=>{
  it('叉口稳定显示功能，不揭奖励内容，不修改seen/随机或变更移动确认',()=>{
    const game=makeGame(),before=JSON.stringify(game),routes=expeditionRoutes(game);
    expect(routes.find(r=>r.idx===game.fire)).toMatchObject({name:'补给支路 · 可往返'});
    expect(routes.find(r=>r.idx===game.guard)).toMatchObject({name:'先战斗，再搜刮'});
    expect(routes.find(r=>r.idx===game.guard).choiceHint).toContain('1场战斗');
    expect(JSON.stringify(game)).toBe(before);
    expect(expeditionRoutes(game)).toEqual(routes);
  });
  it('只在真正叉口提示；商店离店和战斗待领奖不再次宣称恢复/再打1场',()=>{
    const game=makeGame();game.visited[`1,${game.fire}`]=1;
    expect(expeditionRoutes(game).find(r=>r.idx===game.fire).choiceHint).toBeNull();
    game.nodeChestRewards={[`1,${game.guard}`]:{context:{battleSettlement:{}},queue:[{kind:'small'}]}};
    expect(expeditionRoutes(game).find(r=>r.idx===game.guard)).toMatchObject({contentState:'pending',choiceHint:null});
    delete game.nodeChestRewards;game.visited[`1,${game.guard}`]=1;
    expect(expeditionRoutes(game).find(r=>r.idx===game.guard).choiceHint).toBeNull();
    game.trackPos=game.fire;expect(expeditionRoutes(game).every(r=>!r.choiceHint)).toBe(true);
  });
  it('地点详情不会被通用未完成文案盖掉路线提示，已完成会刷新降级',()=>{
    document.body.innerHTML='<aside id="sidebar"><div id="logPanel"></div></aside>';
    const game=makeGame();setExpeditionPreview(game,{li:1,idx:game.guard});renderExpeditionPanel(null,game,icon=>icon);
    expect(document.querySelector('.expedition-preview-hint').textContent).toContain('1场战斗');
    expect(document.querySelectorAll('[data-route-enter]')).toHaveLength(1);
    game.visited[`1,${game.guard}`]=1;renderExpeditionPanel(null,game,icon=>icon);
    expect(document.querySelector('.expedition-preview-hint').textContent).not.toContain('1场战斗');
  });
  it('任意已清普通节点不能穿过未清战斗偷拿箱；战后可往返且删边不再可点击直达',()=>{
    const game=makeGame(),layer=game.layerData[1];
    layer.logical.forEach((node,i)=>{game.seen[`1,${i}`]=1;if(i!==game.guard&&i!==game.reward)game.visited[`1,${i}`]=1;});
    expect(findMapTravelPath(game,{li:1,idx:game.reward})).toBeNull();
    game.visited[`1,${game.guard}`]=1;
    expect(findMapTravelPath(game,{li:1,idx:game.reward})).toContainEqual({li:1,idx:game.guard});
    game.trackPos=game.reward;
    expect(findMapTravelPath(game,{li:1,idx:game.fork})).toContainEqual({li:1,idx:game.guard});
    const removed=game.routePlan.removedEdges[0],a=layer.logical.findIndex(n=>n.id===removed.aNodeId),b=layer.logical.findIndex(n=>n.id===removed.bNodeId);
    expect(layer.logical[a].next).not.toContainEqual([1,b]);expect(layer.logical[b].next).not.toContainEqual([1,a]);
  });
  it('v2回退继续展示原v1路线提示，不把未应用路线说成新选择',()=>{
    const g=makeGame(fallbackSeed);expect(g.routePlan.status).toBe('fallback');
    const p=g.routePlan.baseRoutePlan;if(p.status==='applied'){
      g.trackPos=g.layerData[1].logical.findIndex(n=>n.id===p.startNodeId);
      const routes=expeditionRoutes(g);expect(routes.some(r=>r.name==='补给支路 · 物资点')).toBe(true);expect(routes.every(r=>!r.choiceHint)).toBe(true);
    }
  });
});
