/* 四层种子化地图适配层：生成器只产出纯图数据，本模块补充显示元数据。 */
import { generateLayeredMap } from './map-generator.js';

const LAYER_NAMES = ['外围荒地', '风雪哨线', '冻土遗迹', '污染核心'];
// 横幅英文层名（09-24 老板：lb-en 要纯英文配金色花体，此前误拼中文名）
const LAYER_NAMES_EN = ['Outer Wastes', 'Blizzard Watchline', 'Permafrost Ruins', 'Polluted Core'];
const LAYER_COLORS = ['#78b9d6', '#9fcf8d', '#d8ae68', '#b77ad8'];

export function createLayeredMap(seed = 0) {
  const generated = generateLayeredMap(seed);
  // 第四层（li=3）由生成器直接产出「祭坛 → 首脑」终局三连格（弃3激活祭坛选奖励、
  // 过祭坛战首脑、胜后终局撤离），本层只做透传与显示命名。
  return generated.layers.map((layer, li) => ({
    id: `layer-${li + 1}`, name: `第${li + 1}层 · ${LAYER_NAMES[li]}`,
    nameEn: `Layer ${li + 1} · ${LAYER_NAMES_EN[li]}`, color: LAYER_COLORS[li],
    generatorVersion: generated.generatorVersion, layoutVersion: generated.layoutVersion,
    gridBounds: layer.gridBounds,
    nodes: layer.nodes, entrances: [layer.entry], entranceNames: [layer.nodes[layer.entry].name],
    doors: layer.doors || [], altarEntrances: layer.altarEntrances || [], exit: layer.exit,
    logical: layer.nodes.map(n => ({ grid: [], fire: n.type === 'fire', oldIdx: n.idx,
      def: { type: n.type, name: n.name, extraction: n.extraction }, id: n.id,
      row: n.row, x: n.x, next: n.next })),
  }));
}
