import { describe, expect, it, vi } from 'vitest';
import { isConsumedMapNode } from '../game/src/core/map-node-state.js';
import { drawTacticalIcon } from '../game/src/core/renderer.icons.js';
import { getMapNodeArt, mapNodeArtHTML } from '../game/src/core/map-node-art.js';
import { mapNodeInfo, NODE_INFO } from '../game/src/core/node-info.js';

const node = type => ({ li: 0, idx: 1, def: { type } });
const game = extra => ({ layerIdx: 0, trackPos: 1, visited: { '0,1': 1 }, layerData: [{ doors: [] }], ...extra });

describe('已消耗地图节点展示', () => {
  it('空白地图与详情复用新手绘图源，六类原图源仍保留', () => {
    expect(getMapNodeArt('blank').url).toContain('blank-symbol-foreground-1013-v1.webp');
    expect(mapNodeArtHTML('blank')).toContain(getMapNodeArt('blank').url);
    expect(mapNodeArtHTML('blank')).toContain('empty-node-icon');
    for(const type of ['fire','battle','shop','event','door','chest'])expect(getMapNodeArt(type).url).toContain('1012-v5.webp');
  });
  it.each(['battle', 'shop', 'coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event', 'resource'])('%s 完成结算后保留原类型并标注完成，未消费前保留原说明', type => {
    expect(isConsumedMapNode(game(), node(type))).toBe(true);
    expect(isConsumedMapNode(game({ visited: {} }), node(type))).toBe(false);
    expect(mapNodeInfo(game(), node(type))[0]).toBe(`${NODE_INFO[type][0]} · 已完成`);
    expect(mapNodeInfo(game(), node(type))[2]).toBe(NODE_INFO[type][2]);
    expect(mapNodeInfo(game({ visited:{} }), node(type))).toEqual(NODE_INFO[type]);
  });

  it.each(['entrance', 'door', 'emergencyExit', 'extraction', 'altar'])('已访问 %s 仍保留可用地点图标', type => {
    expect(isConsumedMapNode(game(), node(type))).toBe(false);
  });

  it('普通内容兼作层门时保留层门；首脑只以实际击败状态标注完成', () => {
    expect(isConsumedMapNode(game({ layerData: [{ doors: [{ at: 1 }] }] }), node('battle'))).toBe(false);
    expect(isConsumedMapNode(game({ doorKeys: new Set(['0,1']) }), node('fire'))).toBe(false);
    expect(isConsumedMapNode(game(), node('boss'))).toBe(false);
    expect(isConsumedMapNode(game({ visited: {}, bossKilled: true }), node('boss'))).toBe(true);
  });

  it('遗留战术空白符号helper保持圆和短横，消耗查询不改变节点数据', () => {
    const ctx = Object.fromEntries(['save', 'restore', 'beginPath', 'arc', 'stroke', 'moveTo', 'lineTo'].map(method => [method, vi.fn()]));
    drawTacticalIcon(ctx, 'blank', 30, 40, 2, '#abc');
    expect(ctx.arc).toHaveBeenCalledWith(30, 40, 16, 0, Math.PI * 2);
    expect(ctx.moveTo).toHaveBeenCalledWith(24, 40);
    expect(ctx.lineTo).toHaveBeenCalledWith(36, 40);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    const source = game();
    const before = JSON.stringify(source);
    isConsumedMapNode(source, node('battle'));
    expect(JSON.stringify(source)).toBe(before);
  });
});
