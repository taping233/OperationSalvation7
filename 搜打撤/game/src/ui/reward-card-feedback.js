import { showSettledCardFeedback } from './card-result-feedback.js';
import { REWARD_DESTINATION } from './reward-state.js';

// Caller supplies only cards already granted successfully. This never grants or retries.
export function showRewardCardFeedback(stage, cards, { mode = 'chest', token, sceneSelector = '.reward-replica,.cqo-overview' } = {}) {
  if (!cards?.length) return;
  const groups = new Map();
  for (const card of cards) {
    if (!card?.name) continue;
    const key = card.id || card.name;
    const item = groups.get(key);
    if (item) item.count++;
    else groups.set(key, { kind:REWARD_DESTINATION, name:card.name, card:{ ...card }, count:1 });
  }
  showSettledCardFeedback(stage, [...groups.values()], { mode, token, sceneSelector });
}
