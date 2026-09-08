/* 五层种子化地图适配层：生成器只产出纯图数据，本模块补充显示元数据。 */
import { generateLayeredMap } from './map-generator.js';

const LAYER_NAMES = ['外围荒地', '风雪哨线', '冻土遗迹', '高危战区', '污染核心'];
const LAYER_COLORS = ['#78b9d6', '#9fcf8d', '#d8ae68', '#c8869b', '#b77ad8'];

export function createLayeredMap(seed = 0) {
  const generated = generateLayeredMap(seed);
  return generated.layers.map((layer, li) => ({
    id: `layer-${li + 1}`, name: `第${li + 1}层 · ${LAYER_NAMES[li]}`,
    nameEn: `Layer ${li + 1} · ${LAYER_NAMES[li]}`, color: LAYER_COLORS[li],
    generatorVersion: generated.generatorVersion, layoutVersion: generated.layoutVersion,
    gridBounds: layer.gridBounds,
    nodes: layer.nodes, entrances: [layer.entry], entranceNames: [layer.nodes[layer.entry].name],
    doors: layer.doors || [], altarEntrances: [], exit: layer.exit,
    logical: layer.nodes.map(n => ({ grid: [], fire: n.type === 'fire', oldIdx: n.idx,
      def: { type: n.type, name: n.name, extraction: n.extraction }, id: n.id,
      row: n.row, x: n.x, next: n.next })),
  }));
}
