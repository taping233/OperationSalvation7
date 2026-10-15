// 回调不进入存档；战斗奖励保存重建胜利结算所需的数据。
export function validBattleRewardContinuation(value, game) {
  if (!value || value.version !== 1 || !value.node || !value.opts) return false;
  if (value.node.layerIdx !== game.layerIdx || value.node.trackPos !== game.trackPos
    || typeof value.opts.isBoss !== 'boolean' || value.node.isBoss !== value.opts.isBoss
    || !Array.isArray(value.opts.foeNames) || value.opts.foeNames.some(name => typeof name !== 'string')
    || typeof value.progressRecorded !== 'boolean') return false;
  if (value.slotId != null && (!Number.isInteger(value.slotId) || value.slotId < 1 || value.slotId > 5 || typeof value.runId !== 'string')) return false;
  if (value.node.encounterId !== value.opts.encounterId || (value.opts.encounterId != null && typeof value.opts.encounterId !== 'string')) return false;
  const progress = value.victoryProgress;
  if (value.slotId != null && !progress) return false;
  return progress == null || (Array.isArray(progress.foeNames) && progress.foeNames.every(name => typeof name === 'string')
    && typeof progress.isBoss === 'boolean' && typeof progress.classId === 'string'
    && Number.isFinite(progress.xpMultiplier) && progress.xpMultiplier >= 0);
}

const validContext = (context, game) => context?.battleSettlement
  ? validBattleRewardContinuation(context.battleSettlement, game) : context?.onCell === true;

export function serializeChestReward(game, queue, index, current, context) {
  if (!validContext(context, game) || !current || !queue.length) return null;
  return JSON.parse(JSON.stringify({ version:1, seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos,
    queue, index, context, current:{ ...current, taken:[...(current.taken || [])], lost:[...(current.lost || [])] } }));
}
export function restoreChestReward(game, saved) {
  if (!saved || saved.version !== 1 || saved.seed !== game.seed || saved.layerIdx !== game.layerIdx || saved.trackPos !== game.trackPos
    || !validContext(saved.context, game) || !Array.isArray(saved.queue) || saved.queue.some(q => !q || !['small','medium','large','class','boss'].includes(q.kind))
    || !Number.isInteger(saved.index) || saved.index < 1 || saved.index > saved.queue.length) return null;
  const c = saved.current;
  if (!c || !['small','medium','large','class','boss'].includes(c.kind) || !Array.isArray(c.cards) || c.cards.some(card => !card || typeof card.name !== 'string')
    || !Number.isFinite(c.coins) || c.coins < 0 || typeof c.coinsReceived !== 'boolean') return null;
  const validIndices = list => Array.isArray(list) && list.every(i => Number.isInteger(i) && i >= 0 && i < c.cards.length);
  if (!validIndices(c.taken) || !validIndices(c.lost) || c.taken.some(i => c.lost.includes(i))) return null;
  if (c.rewardStage != null && !['chest','opening','cards'].includes(c.rewardStage)) return null;
  if (['chest','opening'].includes(c.rewardStage) && (c.taken.length || c.lost.length || c.coinsReceived)) return null;
  const copy = JSON.parse(JSON.stringify(saved));
  copy.current.rewardStage ||= 'cards'; // 旧快照已经进入领奖页，不再次领取宝箱。
  copy.current.taken = new Set(copy.current.taken); copy.current.lost = new Set(copy.current.lost);
  return copy;
}
