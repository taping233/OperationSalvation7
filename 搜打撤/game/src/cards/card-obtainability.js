import { isClassCard } from './card-rarity.js';

// Shared by live random pools and preparation source explanations.
export function isRandomObtainableCard(card) {
  if (!card || ['初始', '职业', '衍生', '棱彩'].includes(card.rarity)) return false;
  if (card.type === '能力卡' || card.type === '生物') return false;
  if (isClassCard(card)) return false;
  return !card.unrandom;
}
