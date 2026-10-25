export const isBattleOnlyBagCard = card => card?.id === 'tt3-mystery-potion';
export const isLegacyDiscoveryToken = card => card?.id === 'tt4-shine-token';
// Preserve the historically narrower preview eligibility for old snapshots.
export const isLegacyRestorePreviewCard = card => ['cmtn6bge52qt', 'tt-crystal'].includes(card?.id);

// Ordered compatibility for old snapshots and custom text-only items. Native
// structured bag operations are executed before these fallback capabilities.
export function bagUseCompatibility(card) {
  const desc = card.desc || '';
  if (isBattleOnlyBagCard(card)) return { kind:'battleOnly', amount:0 };
  if (card.id === 'tt-crystal' || /复活最多\s*3\s*张卡牌/.test(desc)) return { kind:'crystal', amount:3 };
  if (card.name === '复原药水' || /复原.{0,4}(两|2).{0,3}张卡牌/.test(desc)) return { kind:'restore', amount:2 };
  const rations = desc.match(/获得\s*(\d+)\s*份?\s*口粮/) || desc.match(/口粮\s*[×x]\s*(\d+)/);
  if (rations) return { kind:'rations', amount:+rations[1] };
  const wood = desc.match(/木材\s*[×x]\s*(\d+)/);
  if (wood) return { kind:'wood', amount:+wood[1] };
  if (card.id === 'tt-token-gold' || /(?:抽取|随机获取)\s*1\s*张传说卡/.test(desc)) return { kind:'gold', amount:1 };
  if (card.id === 'tt-token-color' || /觉醒/.test(desc)) return { kind:'awaken', amount:1 };
  if (isLegacyDiscoveryToken(card) || /发现\s*1\s*张传说卡/.test(desc)) return { kind:'discover', amount:1 };
  if (/随机神秘效果/.test(desc)) return { kind:'mystery', amount:1 };
  const heal = /回复\s*(\d+)\s*点生命/.exec(desc);
  return { kind:'heal', amount:heal ? +heal[1] : 0 };
}

export { isLegacyCatGift as grantsApolloBonus } from '../cards/card-legacy-battle-policy.js';
