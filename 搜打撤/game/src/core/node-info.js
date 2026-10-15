// Shared, presentation-only labels for map nodes and expedition routes.
import { isConsumedMapNode } from './map-node-state.js';
export const NODE_INFO = {
  blank: ['空白节点', '内容已消耗 · 仍可通行', 'map', 'quiet'],
  battle: ['遭遇战', '准备迎敌 · 胜利后搜刮', 'swords', 'danger'],
  boss: ['首脑', '终局挑战 · 检查随身卡牌', 'skull', 'danger'],
  chest: ['物资点', '搜寻卡牌与补给', 'gem', 'gold'],
  resource: ['物资格', '按爆率刷新 2 张随机资源卡 · 选 1 带走', 'gem', 'gold'],
  fire: ['火堆', '恢复生命 · 复原消耗卡牌', 'fire', 'warm'],
  shop: ['商店', '用金币补充装备与卡牌', 'coin', 'safe'],
  event: ['未知事件', '新的机遇，也可能有代价', 'question', 'mystery'],
  door: ['层间闸门', '前往下一片区域', 'door', 'gold'],
  emergencyExit: ['紧急撤离', '第三层 · 献祭 3 张卡牌离开', 'exit', 'safe'],
  extraction: ['终局撤离', '击败首脑后带回战利品', 'exit', 'safe'],
  altar: ['祭坛', '选择能力 · 准备决战', 'sparkles', 'mystery'],
  coin: ['金币', '拾取金币', 'coin', 'gold'],
  key: ['钥匙', '搜集开门物资', 'key', 'gold'],
  wood: ['木材', '收集基地升级物资', 'wood', 'warm'],
  rations: ['口粮', '收集远征补给', 'bread', 'safe'],
  entrance: ['入口', '已建立的行进路线', 'flag', 'safe'],
};

export function mapNodeInfo(game, node) {
  const door = game.layerData?.[node?.li]?.doors?.some(item => item.at === node.idx) ||
    game.doorKeys?.has(`${node?.li},${node?.idx}`);
  const type = door ? 'door' : node?.def?.type;
  const info = NODE_INFO[type] || ['已知地点', '查看当前已知区域', 'map', 'quiet'];
  return isConsumedMapNode(game, node)
    ? [`${info[0]} · 已完成`, '已探索 · 内容已消耗，仍可通行', info[2], 'quiet']
    : info;
}
