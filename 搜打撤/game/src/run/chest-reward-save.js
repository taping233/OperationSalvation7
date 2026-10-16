// 回调不进入存档；战斗奖励保存重建胜利结算所需的数据。
export function validBattleRewardContinuation(value, game) {
  if (!value || value.version !== 1 || !value.node || !value.opts) return false;
  if (value.node.layerIdx !== game.layerIdx || value.node.trackPos !== game.trackPos
    || typeof value.opts.isBoss !== 'boolean' || value.node.isBoss !== value.opts.isBoss
    || !Array.isArray(value.opts.foeNames) || value.opts.foeNames.some(name => typeof name !== 'string')
    || typeof value.progressRecorded !== 'boolean'
    || (value.progressCommitted !== undefined && typeof value.progressCommitted !== 'boolean')) return false;
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

const KINDS = new Set(['small','medium','large','class','boss']);
const normalize = value => value instanceof Set ? [...value].sort((a,b) => a-b)
  : Array.isArray(value) ? value.map(normalize)
    : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(key => [key,normalize(value[key])])) : value;
const sameData = (first, second) => JSON.stringify(normalize(first)) === JSON.stringify(normalize(second));
const rewardJSON = reward => ({ ...reward, taken:[...(reward.taken || [])], lost:[...(reward.lost || [])] });

function restoreReward(reward) {
  if (!reward || !KINDS.has(reward.kind) || !Array.isArray(reward.cards)
    || reward.cards.some(card => !card || typeof card.name !== 'string')
    || !Number.isFinite(reward.coins) || reward.coins < 0 || typeof reward.coinsReceived !== 'boolean') return null;
  if (reward.choiceCount !== undefined && (!Number.isInteger(reward.choiceCount) || reward.choiceCount < 1 || reward.choiceCount > reward.cards.length)) return null;
  if (reward.claimMode !== undefined && !['one','all'].includes(reward.claimMode)) return null;
  const validIndices = list => Array.isArray(list) && new Set(list).size === list.length
    && list.every(i => Number.isInteger(i) && i >= 0 && i < reward.cards.length);
  if (!validIndices(reward.taken) || !validIndices(reward.lost) || reward.taken.some(i => reward.lost.includes(i))) return null;
  if (reward.rewardStage != null && !['chest','opening','cards'].includes(reward.rewardStage)) return null;
  if (['chest','opening'].includes(reward.rewardStage) && (reward.taken.length || reward.lost.length)) return null;
  const copy = JSON.parse(JSON.stringify(reward));
  copy.rewardStage ||= 'cards'; // 旧固定奖励已进入卡牌页，不重新掷卡或再领取宝箱。
  copy.claimMode ??= copy.kind === 'medium' ? 'one' : 'all';
  copy.taken = new Set(copy.taken); copy.lost = new Set(copy.lost);
  return copy;
}

export function serializeChestReward(game, queue, index, current, context, options = {}) {
  if (!validContext(context, game) || !current || !Array.isArray(queue) || !queue.length) return null;
  try {
    const value = { version:1, seed:game.seed, layerIdx:game.layerIdx, trackPos:game.trackPos,
      queue:queue.map(slot => ({ ...slot, ...(slot.reward ? { reward:rewardJSON(slot.reward) } : {}) })),
      index, context, current:rewardJSON(current),
      screen:options.screen ?? (current.rewardStage === 'chest' ? 'overview' : 'cards') };
    // current 是活动槽位的兼容入口；保存时以活动对象覆盖同槽位，避免引用被替换后留下旧进度。
    if (Number.isInteger(index) && value.queue[index - 1]) value.queue[index - 1].reward = value.current;
    return JSON.parse(JSON.stringify(value));
  } catch { return null; }
}

export function restoreChestReward(game, saved) {
  if (!saved || saved.version !== 1 || saved.seed !== game.seed || saved.layerIdx !== game.layerIdx || saved.trackPos !== game.trackPos
    || !validContext(saved.context, game) || !Array.isArray(saved.queue)
    || saved.queue.some(slot => !slot || !KINDS.has(slot.kind) || (slot.completed !== undefined && typeof slot.completed !== 'boolean'))
    || !Number.isInteger(saved.index) || saved.index < 1 || saved.index > saved.queue.length
    || (saved.screen !== undefined && !['overview','cards'].includes(saved.screen))) return null;
  const current = restoreReward(saved.current);
  if (!current || saved.queue[saved.index - 1].kind !== current.kind) return null;
  const copy = JSON.parse(JSON.stringify(saved));
  for (let i = 0; i < copy.queue.length; i++) {
    const slot = copy.queue[i];
    if (slot.reward != null) {
      slot.reward = restoreReward(slot.reward);
      if (!slot.reward || slot.reward.kind !== slot.kind) return null;
    }
    // 旧顺序流程的前序箱没有保存内容，已经结算；绝不为它们补掷或重建领取入口。
    if (saved.screen === undefined && i < saved.index - 1 && slot.reward == null) slot.completed = true;
    if (i === saved.index - 1) {
      if (slot.reward && !sameData(slot.reward, current)) return null;
      slot.reward = current;
    }
    if (slot.completed && slot.reward && (slot.reward.cards.some((_, at) => !slot.reward.taken.has(at) && !slot.reward.lost.has(at))
      || (slot.reward.coins > 0 && !slot.reward.coinsReceived))) return null;
  }
  copy.current = current; // 与 queue[index-1].reward 共用对象，逐张领取时两处保持同义。
  copy.screen = saved.screen ?? (current.rewardStage === 'chest' ? 'overview' : 'cards');
  return copy;
}

// 已揭晓奖励归属节点；暂离地图或访问其他节点不会覆盖它。
export function validNodeChestRewards(game, rewards) {
  return !!rewards && typeof rewards === 'object' && !Array.isArray(rewards)
    && Object.entries(rewards).every(([key, saved]) => /^\d+,\d+$/.test(key)
      && saved && Number.isInteger(saved.layerIdx) && saved.layerIdx >= 0
      && Number.isInteger(saved.trackPos) && saved.trackPos >= 0 && key === `${saved.layerIdx},${saved.trackPos}`
      && !!restoreChestReward({ ...game, layerIdx:saved.layerIdx, trackPos:saved.trackPos }, saved));
}

export function nodeChestRewardAt(game) {
  const saved = game.nodeChestRewards?.[`${game.layerIdx},${game.trackPos}`];
  return saved && restoreChestReward(game, saved) ? saved : null;
}

// 活动页与节点表可同时存在；两份同坐标快照必须描述同一份进度。
export function matchingChestRewards(game, first, second) {
  return sameData(restoreChestReward(game, first), restoreChestReward(game, second));
}
