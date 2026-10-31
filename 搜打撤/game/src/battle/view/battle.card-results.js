import { showCardFeedback } from './battle.card-feedback.js';

export function showBattleCardResults(stage, events = []) {
  if (!stage) return;
  showCardFeedback(stage, events);
}
