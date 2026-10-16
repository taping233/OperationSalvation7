import { beforeEach, describe, expect, it } from 'vitest';
import { isConsumedMapNode } from '../game/src/core/map-node-state.js';
import { mapNodeInfo } from '../game/src/core/node-info.js';
import { expeditionRoutes, renderExpeditionPanel, setExpeditionPreview } from '../game/src/run/expedition.view.js';
import { findMapTravelPath } from '../game/src/run/map-travel-path.js';

const makeGame = (extra = {}) => {
  const logical = [
    { def:{ type:'blank' }, next:[[0, 1]] },
    { def:{ type:'altar' }, next:[[0, 0], [0, 2]] },
    { def:{ type:'boss' }, next:[[0, 1]] },
  ];
  return { runActive:true, state:'idle', layerIdx:0, trackPos:1, hp:20, maxHp:30,
    layerData:[{ logical, doors:[] }], nodes:logical.map((cell, idx) => ({ li:0, idx, def:cell.def })),
    visited:{ '0,1':1 }, seen:{ '0,0':1, '0,1':1, '0,2':1 }, altarActivated:false, altarRewardPending:false,
    ...extra,
  };
};
const preview = g => {
  setExpeditionPreview(g, g.nodes[1]); renderExpeditionPanel(null, g, icon => icon);
  return document.querySelector('.expedition-map-preview');
};
beforeEach(() => { document.body.innerHTML = '<aside id="sidebar"></aside>'; });

describe('祭坛完成态的地图信息与脚下入口', () => {
  it.each([
    ['未激活', false, false, '完成前可回地图整理后重进。'],
    ['已激活待领奖', true, true, '可回地图整理，回到此节点继续领取。'],
  ])('%s仍可查看本地内容，不误写已完成，离开返回保留状态', (_label, active, pending, hint) => {
    const g = makeGame({ altarActivated:active, altarRewardPending:pending });
    const before = JSON.stringify(g), local = preview(g);
    expect(local.querySelector('b').textContent).toBe('祭坛');
    expect(local.querySelector('.expedition-preview-hint').textContent).toBe(hint);
    expect(local.querySelector('[data-route-enter]').disabled).toBe(false);
    expect(local.querySelector('[data-route-enter]').textContent).toContain(pending ? '继续领奖' : '查看本地内容');
    g.trackPos = 0; const outside = preview(g);
    expect(outside.querySelector('[data-route-enter]').disabled).toBe(false);
    g.trackPos = 1; preview(g);
    expect(JSON.stringify(g)).toBe(before);
  });

  it('已激活且无待领奖时显示完成，只禁用脚下查看，卡牌/标记/visited不变', () => {
    const g = makeGame({ altarActivated:true, altarRewardPending:false });
    const before = JSON.stringify(g), strip = preview(g);
    expect(strip.querySelector('b').textContent).toBe('祭坛');
    expect(strip.querySelector('.expedition-preview-hint').textContent).toContain('内容已结算');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);
    expect(strip.querySelector('[data-route-enter]').textContent).toContain('本地内容已完成');
    expect(JSON.stringify(g)).toBe(before);
  });

  it('无visited数量变化的待领→完成→待领切换能使预览缓存失效', () => {
    const g = makeGame({ altarActivated:true, altarRewardPending:true });
    const strip = preview(g), beforeCount = Object.keys(g.visited).length;
    const pendingKey = strip.dataset.viewKey;
    g.altarRewardPending = false; renderExpeditionPanel(null, g, icon => icon);
    expect(Object.keys(g.visited)).toHaveLength(beforeCount);
    expect(strip.dataset.viewKey).not.toBe(pendingKey);
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(true);
    g.altarRewardPending = true; renderExpeditionPanel(null, g, icon => icon);
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);
    expect(strip.querySelector('.expedition-preview-hint').textContent).toBe('可回地图整理，回到此节点继续领取。');
  });

  it('完成祭坛仍能直接进入/离开，现有多跳路径不穿越祭坛规则不变', () => {
    const g = makeGame({ trackPos:0, altarActivated:true, altarRewardPending:false });
    const strip = preview(g);
    expect(strip.querySelector('b').textContent).toBe('祭坛');
    expect(strip.querySelector('[data-route-enter]').disabled).toBe(false);
    expect(strip.querySelector('[data-route-enter]').textContent).toContain('进入该地点');
    expect(expeditionRoutes(g)[0]).toMatchObject({ name:'祭坛', cleared:true });
    expect(findMapTravelPath(g, { li:0, idx:1 })).toEqual([{ li:0, idx:1 }]);
    expect(findMapTravelPath(g, { li:0, idx:2 })).toBeNull();
    g.trackPos = 1;
    expect(findMapTravelPath(g, { li:0, idx:0 })).toEqual([{ li:0, idx:0 }]);
    expect(findMapTravelPath(g, { li:0, idx:2 })).toEqual([{ li:0, idx:2 }]);
  });

  it('普通完成节点的脚下查看与层门兼容不受祭坛投影影响', () => {
    const g = makeGame({ altarActivated:true, altarRewardPending:false });
    g.nodes[1].def.type = 'battle';
    expect(preview(g).querySelector('[data-route-enter]').disabled).toBe(true);
    g.nodes[1].def.type = 'altar'; g.layerData[0].doors.push({ at:1 });
    expect(isConsumedMapNode(g, g.nodes[1])).toBe(false);
    expect(mapNodeInfo(g, g.nodes[1])[0]).toBe('层间闸门');
    expect(preview(g).querySelector('[data-route-enter]').disabled).toBe(false);
  });
});
