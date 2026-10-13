// Display projection only; consuming a cell remains owned by the run flow.
const CONSUMABLE_TYPES = new Set(['battle', 'shop', 'coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event', 'resource']);

export function isConsumedMapNode(game, node) {
  if (!node) return false;
  const isDoor = game.doorKeys?.has(`${node.li},${node.idx}`) ||
    game.layerData?.[node.li]?.doors?.some(door => door.at === node.idx);
  if (isDoor) return false;
  if (node.def?.type === 'boss') return !!game.bossKilled;
  return CONSUMABLE_TYPES.has(node.def?.type) && !!game.visited?.[`${node.li},${node.idx}`];
}
