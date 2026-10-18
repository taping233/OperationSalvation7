import { isQueuedCastSource } from '../core/battle.card-presentation.js';
import { showSettledCardFeedback } from '../../ui/card-result-feedback.js';
export { CARD_FEEDBACK_LAYOUT, clearCardFeedback } from '../../ui/card-result-feedback.js';

// Battle adapter excludes generated cards queued for casting from retained hand gains.
export function showCardFeedback(stage, events = []) {
  showSettledCardFeedback(stage, events.filter(event => event.kind !== 'draw' || !isQueuedCastSource(event.source)));
}
