// Presentation reads settled records only. It never grants, retries or resolves choices.
export const REWARD_DESTINATION = 'bag';
export const REWARD_RECEIVED = '已入背包';
export const REWARD_FORFEITED = '已永久放弃';

export function rewardCardState(taken, lost, index) {
  return taken.has(index) ? 'received' : lost.has(index) ? 'forfeited' : 'pending';
}

export function rewardProgress(cards, taken, lost) {
  const received = [], pending = [];
  let forfeited = 0;
  cards.forEach((card, index) => {
    const state = rewardCardState(taken, lost, index);
    if (state === 'received') received.push(card);
    else if (state === 'forfeited') forfeited++;
    else pending.push(card);
  });
  return { received, pending, takenCount:received.length, lostCount:forfeited, cardCount:cards.length };
}

export function rewardCardStatus(state, choice = false) {
  return state === 'received' ? `${choice ? '✓ 已选择 · ' : ''}${REWARD_RECEIVED}`
    : state === 'forfeited' ? REWARD_FORFEITED : '';
}

export function rewardBoxSummary({ takenCount = 0, lostCount = 0, cardCount = 0, completed = false, choice = false, rule = '' }) {
  if (!takenCount && !lostCount) return completed ? '已结束' : rule;
  const parts = [];
  if (takenCount) parts.push(`已领取 ${takenCount} 张`);
  if (lostCount) parts.push(choice && takenCount ? `其余 ${lostCount} 张已放弃` : `已放弃 ${lostCount} 张`);
  const remaining = Math.max(0, cardCount - takenCount - lostCount);
  if (!completed && remaining) parts.push(`剩余 ${remaining} 张待处理`);
  return parts.join(' · ');
}
