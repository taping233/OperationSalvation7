import { hasStructuredEquipField } from './card-trigger-contract.js';

// Display-only context; do not change canonical execution descriptions.
export function battleStartExplanation(card) {
  const isStartEquip = card?.type === '装备' &&
    (hasStructuredEquipField(card, 'battleStart')
      ? (card.rules?.equip?.battleStart?.length || 0) > 0
      : /对战开始时/.test(String(card.desc || '')));
  return isStartEquip ? '仅在 BOSS 战编入本场牌库时，开战自动生效；普通战不触发。' : '';
}
