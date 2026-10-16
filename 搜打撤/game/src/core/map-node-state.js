import { nodeRestoreAt } from '../run/node-restore-state.js';
// Display projection only; consuming a cell remains owned by the run flow.
const CONSUMABLE_TYPES = new Set(['battle', 'shop', 'coin', 'wood', 'chest', 'rations', 'key', 'fire', 'event', 'resource']);

const status = (id, label, detail, tone, icon) => ({ id, label, detail, tone, icon });
const rewardHandled = reward => {
  if (!reward || ['chest','opening'].includes(reward.rewardStage) || !Array.isArray(reward.cards)) return false;
  const has = (indices, index) => indices instanceof Set ? indices.has(index) : Array.isArray(indices) && indices.includes(index);
  return reward.cards.every((_, index) => has(reward.taken, index) || has(reward.lost, index))
    && (!(reward.coins > 0) || reward.coinsReceived === true);
};
const chestRewardsHandled = saved => Array.isArray(saved.queue) && saved.queue.length > 0
  && saved.queue.every((slot, index) => slot.completed === true
    || rewardHandled(index === saved.index - 1 ? saved.current || slot.reward : slot.reward));

// 呈现状态与移动规则分别投影；本函数不修改节点、存档或 visited。
export function mapNodeStatus(game, node) {
  if (!node) return status('transit', '', '', 'quiet', 'map');
  const key = `${node.li},${node.idx}`, type = node.def?.type;
  const chest = game.nodeChestRewards?.[key];
  const reward = game.nodeRewards?.[key];
  const supply = game.entrySupply;
  const entryPending = supply?.layerIdx === node.li && supply.trackPos === node.idx
    && Array.isArray(supply.cardIds) && Array.isArray(supply.taken) && supply.taken.length < supply.cardIds.length;
  const restorePending = nodeRestoreAt(game, node.li, node.idx);
  if (chest || ['event-choice','resource'].includes(reward?.type) && reward.taken === null || entryPending || restorePending
    || type === 'altar' && game.altarActivated && game.altarRewardPending) {
    return status('pending', '待领奖', chest && chestRewardsHandled(chest)
      ? '奖励已处理，进入节点确认后继续。'
      : '可回地图整理，回到此节点继续领取。', 'gold', 'archive');
  }
  if (type === 'shop') return game.visited?.[key]
    ? status('shop-closed', '已离店', '本次交易已结束，闸门与道路仍可通行。', 'quiet', 'exit')
    : status('shop-open', '营业中', '离开此节点前可反复进店，货架保留。', 'safe', 'coin');
  if (isConsumedMapNode(game, node)) return status('completed', '已完成', '内容已结算，仍可通行。', 'quiet', 'check');
  const door = game.doorKeys?.has(key) || game.layerData?.[node.li]?.doors?.some(item => item.at === node.idx);
  if (door || !CONSUMABLE_TYPES.has(type) && !['altar','boss'].includes(type)) {
    return status('transit', '', door || type === 'door' ? '闸门仍可通行。' : '', 'quiet', door || type === 'door' ? 'door' : 'map');
  }
  const tone = ['battle','boss'].includes(type) ? 'danger' : ['chest','resource','coin','key'].includes(type) ? 'gold'
    : ['fire','wood'].includes(type) ? 'warm' : type === 'rations' ? 'safe' : 'mystery';
  const detail = ['battle','boss'].includes(type) ? '战斗结束后完成，战斗中不能整理背包。'
    : type === 'event' ? '选择前可回地图，原事件会保留。' : '完成前可回地图整理后重进。';
  return status('incomplete', '未完成', detail, tone, 'question');
}

export function isConsumedMapNode(game, node) {
  if (!node) return false;
  if (nodeRestoreAt(game, node.li, node.idx)) return false;
  if (game.nodeChestRewards?.[`${node.li},${node.idx}`]
    || game.nodeRewards?.[`${node.li},${node.idx}`]?.type === 'event-choice'
      && game.nodeRewards[`${node.li},${node.idx}`].taken === null) return false;
  const isDoor = game.doorKeys?.has(`${node.li},${node.idx}`) ||
    game.layerData?.[node.li]?.doors?.some(door => door.at === node.idx);
  if (isDoor) return false;
  if (node.def?.type === 'altar') return !!game.altarActivated && !game.altarRewardPending;
  if (node.def?.type === 'boss') return !!game.bossKilled;
  return CONSUMABLE_TYPES.has(node.def?.type) && !!game.visited?.[`${node.li},${node.idx}`];
}
